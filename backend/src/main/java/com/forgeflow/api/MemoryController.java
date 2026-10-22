package com.forgeflow.api;

import com.forgeflow.api.model.AgentMemoryDocument;
import com.forgeflow.api.service.MemoryService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller exposing MongoDB AI Memory & Vector Search capabilities.
 */
@RestController
@RequestMapping("/api/memory")
public class MemoryController {

    private final MemoryService memoryService;

    public MemoryController(MemoryService memoryService) {
        this.memoryService = memoryService;
    }

    /**
     * Vector Similarity Recall:
     * Returns top episodic (past PR fixes) and semantic memories matching the query.
     */
    @PostMapping("/recall")
    public List<AgentMemoryDocument> recall(@RequestBody MemoryRecallRequest req) {
        int limit = req.limit() != null && req.limit() > 0 ? req.limit() : 3;
        return memoryService.recall(req.query(), req.agentSlug(), limit);
    }

    /**
     * Records an accepted PR as a permanent episodic memory in MongoDB.
     */
    @PostMapping("/record")
    public AgentMemoryDocument record(@RequestBody RecordExperienceRequest req) {
        return memoryService.recordExperience(
                req.organizationId() != null ? req.organizationId() : "global",
                req.agentSlug(),
                req.title(),
                req.problem(),
                req.rootCause(),
                req.patchDiff(),
                req.tags() != null ? req.tags() : List.of()
        );
    }

    public record MemoryRecallRequest(
            @NotBlank String query,
            String agentSlug,
            Integer limit
    ) {}

    public record RecordExperienceRequest(
            String organizationId,
            @NotBlank String agentSlug,
            @NotBlank String title,
            @NotBlank String problem,
            @NotBlank String rootCause,
            @NotBlank String patchDiff,
            List<String> tags
    ) {}
}
