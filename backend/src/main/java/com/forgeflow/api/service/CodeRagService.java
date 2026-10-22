package com.forgeflow.api.service;

import com.forgeflow.api.model.RagChunkDocument;
import com.forgeflow.api.repository.RagChunkRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CodeRagService {

    private final RagChunkRepository ragRepository;
    private final VoyageAiClient voyageClient;

    public CodeRagService(RagChunkRepository ragRepository, VoyageAiClient voyageClient) {
        this.ragRepository = ragRepository;
        this.voyageClient = voyageClient;
    }

    /**
     * Seeds initial codebase chunks for acme/payments-api with Voyage AI embeddings
     */
    @EventListener(ApplicationReadyEvent.class)
    public void seedCodebaseKnowledge() {
        if (ragRepository.count() > 0) return;

        List<ChunkInput> initialCodebase = List.of(
                new ChunkInput(
                        "src/main/java/com/acme/payments/PaymentService.java",
                        40, 65, "METHOD", "PaymentService.processPayment",
                        "public void processPayment(Transaction tx) {\n    // Charges customer card via gateway\n    chargeCard(tx);\n}"
                ),
                new ChunkInput(
                        "src/main/java/com/acme/payments/PaymentLedger.java",
                        15, 35, "CLASS", "PaymentLedger",
                        "public class PaymentLedger {\n    public boolean isProcessed(String idempotencyKey) {\n        return repository.existsByIdempotencyKey(idempotencyKey);\n    }\n}"
                ),
                new ChunkInput(
                        "src/main/java/com/acme/payments/IdempotencyFilter.java",
                        20, 50, "CLASS", "IdempotencyFilter",
                        "public class IdempotencyFilter implements Filter {\n    // Extracts X-Idempotency-Key HTTP header for network retry safety\n}"
                ),
                new ChunkInput(
                        "pom.xml",
                        30, 55, "CONFIG", "pom.xml:dependencies",
                        "<dependency>\n    <groupId>com.stripe</groupId>\n    <artifactId>stripe-java</artifactId>\n    <version>22.10.0</version>\n</dependency>"
                )
        );

        for (var c : initialCodebase) {
            var embedding = voyageClient.embedSingle(c.content(), "document");
            var chunk = new RagChunkDocument(
                    "demo-org",
                    "acme/payments-api",
                    c.filePath(),
                    c.startLine(),
                    c.endLine(),
                    c.chunkType(),
                    c.symbolIdentifier(),
                    c.content(),
                    embedding
            );
            ragRepository.save(chunk);
        }
    }

    /**
     * RAG Retrieval: Performs Cosine Similarity Vector Search over MongoDB code chunks
     * using query embedding from Voyage AI (voyage-code-3).
     */
    public List<RagChunkDocument> retrieveContext(String orgId, String repository, String query, int limit) {
        // Embed the search query using Voyage AI query mode
        var queryEmbedding = voyageClient.embedSingle(query, "query");

        var candidates = ragRepository.findByOrganizationIdAndRepository(orgId, repository);
        if (candidates.isEmpty()) {
            candidates = ragRepository.findAll(); // Fallback across org if repo not isolated
        }

        for (var c : candidates) {
            double sim = cosineSimilarity(queryEmbedding, c.getEmbedding());
            c.setScore(sim);
        }

        candidates.sort(Comparator.comparingDouble(RagChunkDocument::getScore).reversed());
        return candidates.stream().limit(limit).toList();
    }

    /**
     * Indexes a new code snippet into MongoDB with Voyage AI embeddings
     */
    public RagChunkDocument indexChunk(String orgId, String repository, String filePath,
                                       int startLine, int endLine, String chunkType,
                                       String symbolIdentifier, String codeContent) {
        var embedding = voyageClient.embedSingle(codeContent, "document");
        var chunk = new RagChunkDocument(
                orgId, repository, filePath, startLine, endLine,
                chunkType, symbolIdentifier, codeContent, embedding
        );
        return ragRepository.save(chunk);
    }

    private double cosineSimilarity(List<Double> v1, List<Double> v2) {
        if (v1 == null || v2 == null || v1.isEmpty() || v2.isEmpty()) return 0.0;
        int size = Math.min(v1.size(), v2.size());
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < size; i++) {
            dot += v1.get(i) * v2.get(i);
            normA += v1.get(i) * v1.get(i);
            normB += v2.get(i) * v2.get(i);
        }
        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    public record ChunkInput(String filePath, int startLine, int endLine, String chunkType, String symbolIdentifier, String content) {}
}
