package com.forgeflow.api;

import com.forgeflow.api.model.AgentRunDocument;
import com.forgeflow.api.service.AgentRunService;
import com.forgeflow.api.service.AgentRunService.RunNotFoundException;
import com.forgeflow.api.service.AgentRunService.IllegalStateTransitionException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AgentRunController {

    private final AgentRunService agentRunService;
    private final com.forgeflow.api.repository.UserSubscriptionRepository subscriptionRepository;

    public AgentRunController(AgentRunService agentRunService,
                              com.forgeflow.api.repository.UserSubscriptionRepository subscriptionRepository) {
        this.agentRunService = agentRunService;
        this.subscriptionRepository = subscriptionRepository;
    }

    // ── Application startup initialization ───────────────────────────────────

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        // Clean startup - no demo data seeded
    }

    // ── Agent catalogue ───────────────────────────────────────────────────────

    @GetMapping("/agents")
    public List<AgentDto> agents() {
        return List.of(
            new AgentDto("bug-fix",              "Bug Fix Agent",
                "Investigates labeled bugs, validates a patch, and prepares a pull request.",
                "Java · TypeScript", "₹320 / successful run", "Ready"),
            new AgentDto("dependency-remediation", "Dependency Remediation",
                "Updates vulnerable dependencies with compatibility checks.",
                "Java · Node.js", "₹190 / successful run", "Coming soon"),
            new AgentDto("test-repair",           "Test Repair Agent",
                "Diagnoses flaky or drifting tests without masking regressions.",
                "Java · TypeScript", "₹240 / successful run", "Coming soon")
        );
    }

    // ── Runs ──────────────────────────────────────────────────────────────────

    @GetMapping("/runs")
    public List<AgentRunDocument> runs(
            @RequestParam(defaultValue = "demo-org") String orgId) {
        return agentRunService.listRuns(orgId);
    }

    @PostMapping("/runs")
    @ResponseStatus(HttpStatus.CREATED)
    public AgentRunDocument create(@Valid @RequestBody CreateRunRequest request) {
        return agentRunService.createRun(
                "demo-org",           // TODO: replace with authenticated org from JWT
                "bug-fix",
                request.agentName(),
                request.repository(),
                request.issueNumber(),
                request.issueTitle());
    }

    @PostMapping("/runs/{id}/cancel")
    public AgentRunDocument cancel(@PathVariable String id) {
        return agentRunService.cancelRun(id, "user"); // TODO: replace "user" with JWT subject
    }

    // ── Exception mapping ─────────────────────────────────────────────────────

    @ExceptionHandler(RunNotFoundException.class)
    ProblemDetail notFound(RunNotFoundException ex) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Agent run was not found.");
        detail.setType(URI.create("https://forgeflow.dev/errors/run-not-found"));
        return detail;
    }

    @ExceptionHandler(IllegalStateTransitionException.class)
    ProblemDetail conflict(IllegalStateTransitionException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    record AgentDto(String slug, String name, String description,
                    String stack, String price, String availability) {}

    record CreateRunRequest(
            @NotBlank String agentName,
            @NotBlank String repository,
            @NotNull  Integer issueNumber,
            @NotBlank String issueTitle) {}
}
