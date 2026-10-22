package com.forgeflow.api;

import com.forgeflow.api.model.AgentRunDocument;
import com.forgeflow.api.model.WorkerNodeDocument;
import com.forgeflow.api.service.AgentRunService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * Worker Protocol REST API:
 * Remote AI employee servers connect to these endpoints to poll jobs,
 * send heartbeats, and report back pull requests & token usage.
 */
@RestController
@RequestMapping("/api/worker")
public class WorkerDispatchController {

    private final AgentRunService runService;

    public WorkerDispatchController(AgentRunService runService) {
        this.runService = runService;
    }

    /** Register worker or send periodic heartbeat */
    @PostMapping("/heartbeat")
    public WorkerNodeDocument heartbeat(@RequestBody WorkerHeartbeatRequest req) {
        return runService.registerOrHeartbeatWorker(req.workerId(), req.hostname(), req.ipAddress(), req.skills());
    }

    /** Remote worker asks for next job matching its specialization */
    @PostMapping("/poll")
    public ResponseEntity<AgentRunDocument> pollJob(@RequestBody WorkerPollRequest req) {
        Optional<AgentRunDocument> job = runService.pollAndClaimRun(req.workerId(), req.skills());
        return job.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** Worker reports progress (e.g. "Cloning repository", "Running tests") */
    @PostMapping("/runs/{id}/progress")
    public AgentRunDocument progress(@PathVariable String id, @RequestBody WorkerProgressRequest req) {
        return runService.updateRunProgress(id, req.workerId(), req.step(), req.status());
    }

    /** Worker finishes execution: reports diff, PR link, tokens, and time */
    @PostMapping("/runs/{id}/complete")
    public AgentRunDocument complete(@PathVariable String id, @RequestBody WorkerCompleteRequest req) {
        return runService.completeRun(
                id,
                req.workerId(),
                req.diffSummary(),
                req.pullRequestUrl(),
                req.inputTokens(),
                req.outputTokens(),
                req.executionTimeMs(),
                req.success()
        );
    }

    /** List all active worker nodes connected to the fleet */
    @GetMapping("/nodes")
    public List<WorkerNodeDocument> listNodes() {
        return runService.listWorkers();
    }

    public record WorkerHeartbeatRequest(
            @NotBlank String workerId,
            String hostname,
            String ipAddress,
            List<String> skills
    ) {}

    public record WorkerPollRequest(
            @NotBlank String workerId,
            List<String> skills
    ) {}

    public record WorkerProgressRequest(
            @NotBlank String workerId,
            String step,
            AgentRunDocument.RunStatus status
    ) {}

    public record WorkerCompleteRequest(
            @NotBlank String workerId,
            String diffSummary,
            String pullRequestUrl,
            int inputTokens,
            int outputTokens,
            long executionTimeMs,
            boolean success
    ) {}
}
