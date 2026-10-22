package com.forgeflow.api.service;

import com.forgeflow.api.model.AgentRunDocument;
import com.forgeflow.api.model.AgentRunDocument.RunStatus;
import com.forgeflow.api.model.AuditEventDocument;
import com.forgeflow.api.repository.AgentRunRepository;
import com.forgeflow.api.repository.AuditEventRepository;
import com.forgeflow.api.repository.WorkerNodeRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Phase 3 Core Business Logic:
 * - State machine orchestration (QUEUED -> RUNNING -> INVESTIGATING -> PATCHING -> VERIFYING -> AWAITING_REVIEW)
 * - Atomic budget reservation & denial before worker execution
 * - Policy governance gating before tools execute
 */
@Service
public class AgentRunService {

    private final AgentRunRepository runRepository;
    private final AuditEventRepository auditRepository;
    private final WorkerNodeRepository workerRepository;
    private final BudgetService budgetService;
    private final PolicyService policyService;
    private final ReactiveStreamService reactiveStreamService;

    private static final double DEFAULT_RUN_MAX_SPEND = 500.0; // ₹500 budget cap per run

    public AgentRunService(AgentRunRepository runRepository,
                           AuditEventRepository auditRepository,
                           WorkerNodeRepository workerRepository,
                           BudgetService budgetService,
                           PolicyService policyService,
                           ReactiveStreamService reactiveStreamService) {
        this.runRepository   = runRepository;
        this.auditRepository = auditRepository;
        this.workerRepository = workerRepository;
        this.budgetService = budgetService;
        this.policyService = policyService;
        this.reactiveStreamService = reactiveStreamService;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    public List<AgentRunDocument> listRuns(String organizationId) {
        return runRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }

    public Optional<AgentRunDocument> findRun(String runId) {
        return runRepository.findById(runId);
    }

    public List<com.forgeflow.api.model.WorkerNodeDocument> listWorkers() {
        // Return active workers (whose heartbeat was within the last 45 seconds)
        var threshold = java.time.Instant.now().minusSeconds(45);
        var workers = workerRepository.findAll();
        for (var w : workers) {
            if (w.getLastHeartbeat() == null || w.getLastHeartbeat().isBefore(threshold)) {
                w.setStatus(com.forgeflow.api.model.WorkerNodeDocument.WorkerStatus.OFFLINE);
            }
        }
        return workers;
    }

    // ── Distributed Worker Orchestration with Phase 3 State Machine ───────────

    public com.forgeflow.api.model.WorkerNodeDocument registerOrHeartbeatWorker(
            String workerId, String hostname, String ipAddress, List<String> skills) {
        var worker = workerRepository.findByWorkerId(workerId).orElseGet(() ->
                new com.forgeflow.api.model.WorkerNodeDocument(workerId, hostname, ipAddress, skills));
        worker.setHostname(hostname);
        worker.setIpAddress(ipAddress);
        if (skills != null && !skills.isEmpty()) {
            worker.setSupportedSkills(skills);
        }
        worker.setLastHeartbeat(java.time.Instant.now());
        if (worker.getStatus() == com.forgeflow.api.model.WorkerNodeDocument.WorkerStatus.OFFLINE) {
            worker.setStatus(com.forgeflow.api.model.WorkerNodeDocument.WorkerStatus.IDLE);
        }
        return workerRepository.save(worker);
    }

    public synchronized Optional<AgentRunDocument> pollAndClaimRun(String workerId, List<String> workerSkills) {
        var queuedRuns = runRepository.findByStatusOrderByCreatedAtAsc(RunStatus.QUEUED);
        for (var run : queuedRuns) {
            boolean matches = workerSkills == null || workerSkills.isEmpty()
                    || workerSkills.contains(run.getAgentSlug())
                    || workerSkills.contains("*");
            if (matches) {
                // Phase 3 State Machine Transition: Check and Reserve Budget
                double budgetLimit = run.getBudgetLimitInr() != null ? run.getBudgetLimitInr() : DEFAULT_RUN_MAX_SPEND;
                boolean reserved = budgetService.tryReserveBudget(run.getOrganizationId(), run.getId(), budgetLimit);

                if (!reserved) {
                    // Budget exceeded: Deny run and transition to BUDGET_DENIED
                    run.setStatus(RunStatus.BUDGET_DENIED);
                    run.setCurrentStep("Budget limit exceeded: Insufficient account balance");
                    runRepository.save(run);
                    audit(run.getOrganizationId(), "orchestrator", "run.budget_denied", run.getId(),
                            Map.of("reason", "insufficient_funds", "limit", budgetLimit));
                    continue; // Check next run
                }

                // Transition to RUNNING
                run.setStatus(RunStatus.RUNNING);
                run.setAssignedWorkerId(workerId);
                run.setCurrentStep("Claimed by worker " + workerId + " (Budget reserved: ₹" + budgetLimit + ")");
                var saved = runRepository.save(run);
                reactiveStreamService.publishRunUpdate(saved);
                reactiveStreamService.publishStepEvent(saved.getId(), "Claimed", workerId, "Budget reserved ₹" + budgetLimit);

                workerRepository.findByWorkerId(workerId).ifPresent(w -> {
                    w.setStatus(com.forgeflow.api.model.WorkerNodeDocument.WorkerStatus.BUSY);
                    w.setActiveRunId(saved.getId());
                    workerRepository.save(w);
                });

                audit(run.getOrganizationId(), workerId, "run.claimed", saved.getId(),
                        Map.of("workerId", workerId, "agent", run.getAgentSlug(), "reservedInr", budgetLimit));
                return Optional.of(saved);
            }
        }
        return Optional.empty();
    }

    public AgentRunDocument updateRunProgress(String runId, String workerId, String step, RunStatus status) {
        var run = runRepository.findById(runId)
                .orElseThrow(() -> new RunNotFoundException(runId));
        if (status != null) {
            run.setStatus(status);
        }
        run.setCurrentStep(step);
        var saved = runRepository.save(run);
        reactiveStreamService.publishRunUpdate(saved);
        reactiveStreamService.publishStepEvent(runId, step, workerId, "Progress update: " + step);
        return saved;
    }

    public AgentRunDocument completeRun(String runId, String workerId, String diffSummary,
                                        String pullRequestUrl, int inputTokens, int outputTokens,
                                        long executionTimeMs, boolean success) {
        var run = runRepository.findById(runId)
                .orElseThrow(() -> new RunNotFoundException(runId));

        run.setStatus(success ? RunStatus.AWAITING_REVIEW : RunStatus.FAILED);
        run.setDiffSummary(diffSummary);
        run.setPullRequestUrl(pullRequestUrl);
        run.setInputTokens(inputTokens);
        run.setOutputTokens(outputTokens);
        run.setExecutionTimeMs(executionTimeMs);
        run.setCurrentStep(success ? "Pull request created & awaiting human review" : "Execution failed in sandbox");

        // Calculate actual cost
        double tokenCost = ((inputTokens * 0.05) + (outputTokens * 0.15)) / 1000.0;
        double finalCost = Math.max(10.0, tokenCost);
        run.setCostInr(finalCost);

        // Commit spend in ledger and release remainder
        budgetService.commitSpend(run.getOrganizationId(), runId, finalCost);

        var saved = runRepository.save(run);
        reactiveStreamService.publishRunUpdate(saved);
        reactiveStreamService.publishStepEvent(runId, success ? "Completed" : "Failed", workerId,
                "Finished in " + executionTimeMs + "ms, tokens: " + inputTokens + " in/" + outputTokens + " out");

        workerRepository.findByWorkerId(workerId).ifPresent(w -> {
            w.setStatus(com.forgeflow.api.model.WorkerNodeDocument.WorkerStatus.IDLE);
            w.setActiveRunId(null);
            w.setCompletedRunsCount(w.getCompletedRunsCount() + 1);
            workerRepository.save(w);
        });

        audit(run.getOrganizationId(), workerId, success ? "run.completed" : "run.failed", runId,
                Map.of("inputTokens", inputTokens, "outputTokens", outputTokens, "actualSpendInr", finalCost));

        return saved;
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    public AgentRunDocument createRun(String organizationId, String agentSlug,
                                     String agentName, String repository,
                                     Integer issueNumber, String issueTitle) {
        var run = new AgentRunDocument(organizationId, agentSlug, agentName,
                                      repository, issueNumber, issueTitle);
        run.setBudgetLimitInr(DEFAULT_RUN_MAX_SPEND);
        var saved = runRepository.save(run);
        reactiveStreamService.publishRunUpdate(saved);
        audit(organizationId, "system", "run.created", saved.getId(),
              Map.of("repository", repository, "issueNumber", issueNumber, "budgetLimitInr", DEFAULT_RUN_MAX_SPEND));
        return saved;
    }

    public AgentRunDocument cancelRun(String runId, String actor) {
        var run = runRepository.findById(runId)
                .orElseThrow(() -> new RunNotFoundException(runId));

        if (run.getStatus() == RunStatus.AWAITING_REVIEW
                || run.getStatus() == RunStatus.COMPLETED
                || run.getStatus() == RunStatus.FAILED
                || run.getStatus() == RunStatus.CANCELLED
                || run.getStatus() == RunStatus.BUDGET_DENIED) {
            throw new IllegalStateTransitionException(
                    "Run in status " + run.getStatus() + " cannot be cancelled.");
        }

        run.setStatus(RunStatus.CANCELLED);
        run.setCurrentStep("Cancelled by " + actor);
        var saved = runRepository.save(run);

        // Refund reserved funds
        budgetService.releaseReservation(run.getOrganizationId(), runId);

        audit(run.getOrganizationId(), actor, "run.cancelled", runId, Map.of());
        return saved;
    }

    // ── Policy Gateway ────────────────────────────────────────────────────────

    public PolicyService.PolicyDecision evaluateActionPolicy(String runId, String toolName, Map<String, Object> params) {
        var run = runRepository.findById(runId)
                .orElseThrow(() -> new RunNotFoundException(runId));
        return policyService.evaluateToolCall(run.getAgentSlug(), toolName, params);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void audit(String orgId, String actor, String action,
                       String resourceId, Map<String, Object> meta) {
        auditRepository.save(new AuditEventDocument(orgId, actor, action, resourceId, meta));
    }

    // ── Domain exceptions ─────────────────────────────────────────────────────

    public static class RunNotFoundException extends RuntimeException {
        public RunNotFoundException(String id) { super("Run not found: " + id); }
    }

    public static class IllegalStateTransitionException extends RuntimeException {
        public IllegalStateTransitionException(String msg) { super(msg); }
    }
}
