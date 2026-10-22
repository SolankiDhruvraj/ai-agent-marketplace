package com.forgeflow.api;

import com.forgeflow.api.model.RagChunkDocument;
import com.forgeflow.api.service.CodeRagService;
import com.forgeflow.api.service.VoyageAiClient;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for Voyage AI + MongoDB Code RAG (Retrieval-Augmented Generation).
 */
@RestController
@RequestMapping("/api/rag")
public class RagController {

    private final CodeRagService ragService;
    private final VoyageAiClient voyageClient;

    public RagController(CodeRagService ragService, VoyageAiClient voyageClient) {
        this.ragService = ragService;
        this.voyageClient = voyageClient;
    }

    /**
     * RAG Vector Query:
     * Takes an issue title or error message, embeds with Voyage AI,
     * and returns the most relevant code chunks from MongoDB.
     */
    @PostMapping("/query")
    public List<RagChunkDto> query(
            @RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId,
            @RequestBody RagQueryRequest req) {

        int limit = req.limit() != null && req.limit() > 0 ? req.limit() : 3;
        var results = ragService.retrieveContext(orgId, req.repository(), req.query(), limit);

        return results.stream().map(r -> new RagChunkDto(
                r.getId(),
                r.getRepository(),
                r.getFilePath(),
                r.getStartLine(),
                r.getEndLine(),
                r.getChunkType(),
                r.getSymbolIdentifier(),
                r.getCodeContent(),
                r.getScore()
        )).toList();
    }

    /**
     * Manually indexes a code chunk into MongoDB
     */
    @PostMapping("/index")
    public RagChunkDocument index(
            @RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId,
            @RequestBody IndexChunkRequest req) {

        return ragService.indexChunk(
                orgId,
                req.repository(),
                req.filePath(),
                req.startLine(),
                req.endLine(),
                req.chunkType(),
                req.symbolIdentifier(),
                req.codeContent()
        );
    }

    /**
     * Returns RAG status & active Voyage AI embedding model
     */
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return Map.of(
                "embeddingProvider", "Voyage AI",
                "embeddingModel", voyageClient.getModel(),
                "vectorDatabase", "MongoDB (Atlas Vector Search compatible)",
                "vectorDimensions", 1024,
                "distanceMetric", "cosine"
        );
    }

    public record RagQueryRequest(
            @NotBlank String repository,
            @NotBlank String query,
            Integer limit
    ) {}

    public record IndexChunkRequest(
            @NotBlank String repository,
            @NotBlank String filePath,
            int startLine,
            int endLine,
            String chunkType,
            String symbolIdentifier,
            @NotBlank String codeContent
    ) {}

    public record RagChunkDto(
            String id,
            String repository,
            String filePath,
            int startLine,
            int endLine,
            String chunkType,
            String symbolIdentifier,
            String codeContent,
            double similarityScore
    ) {}
}
