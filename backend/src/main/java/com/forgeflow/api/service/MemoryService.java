package com.forgeflow.api.service;

import com.forgeflow.api.model.AgentMemoryDocument;
import com.forgeflow.api.model.AgentMemoryDocument.MemoryType;
import com.forgeflow.api.repository.AgentMemoryRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class MemoryService {

    private final AgentMemoryRepository memoryRepository;

    public MemoryService(AgentMemoryRepository memoryRepository) {
        this.memoryRepository = memoryRepository;
    }

    /**
     * Seeds initial canonical episodic and semantic memories in MongoDB
     */
    @EventListener(ApplicationReadyEvent.class)
    public void seedInitialKnowledge() {
        if (memoryRepository.count() > 0) return;

        // 1. Episodic Memory: Payment retry duplicate charge
        var episodic1 = new AgentMemoryDocument(
                "global",
                "bug-fix",
                MemoryType.EPISODIC,
                "Spring Boot Idempotent Payment Retry Fix",
                "Fix duplicate charge after network retry in PaymentService",
                "Lack of idempotency check before charging external card gateway",
                "--- a/PaymentService.java\n+++ b/PaymentService.java\n@@ -12,2 +12,4 @@\n+ if (!ledger.isProcessed(tx.getIdempotencyKey())) {\n    chargeCard(tx);\n+ }",
                List.of("java", "spring-boot", "idempotency", "payments", "duplicate"),
                generateMockEmbedding("Fix duplicate charge after retry payment idempotency")
        );
        memoryRepository.save(episodic1);

        // 2. Episodic Memory: Jackson CVE vulnerability upgrade
        var episodic2 = new AgentMemoryDocument(
                "global",
                "dependency-remediation",
                MemoryType.EPISODIC,
                "Jackson Databind CVE-2020-36518 Remediation",
                "Remote code execution in com.fasterxml.jackson.core:jackson-databind < 2.13.2.1",
                "Outdated transitive dependency in pom.xml",
                "--- a/pom.xml\n+++ b/pom.xml\n@@ -45,1 +45,1 @@\n- <jackson.version>2.12.3</jackson.version>\n+ <jackson.version>2.13.4.2</jackson.version>",
                List.of("java", "maven", "jackson", "cve", "security"),
                generateMockEmbedding("Jackson databind vulnerability CVE pom.xml upgrade")
        );
        memoryRepository.save(episodic2);

        // 3. Semantic Memory: Contract Guardrail
        var semantic1 = new AgentMemoryDocument(
                "global",
                "bug-fix",
                MemoryType.SEMANTIC,
                "Java Binary Compatibility & Non-Destructive Diff Invariant",
                "Public API method signatures must never be deleted or modified; wrap them with deprecation instead.",
                "Breaking public contract leads to downstream compiler failures",
                "",
                List.of("java", "api-contract", "backward-compatibility"),
                generateMockEmbedding("Public method signature backward compatibility")
        );
        memoryRepository.save(semantic1);
    }

    /**
     * Recall top-K most relevant episodic & semantic memories using Cosine Similarity Vector Search
     */
    public List<AgentMemoryDocument> recall(String query, String agentSlug, int limit) {
        var queryEmbedding = generateMockEmbedding(query);
        var allMemories = memoryRepository.findAll();

        // Calculate cosine similarity scores
        for (var mem : allMemories) {
            double score = cosineSimilarity(queryEmbedding, mem.getEmbedding());
            // Boost if agent slug matches
            if (agentSlug != null && agentSlug.equalsIgnoreCase(mem.getAgentSlug())) {
                score += 0.15;
            }
            mem.setSimilarityScore(score);
        }

        allMemories.sort(Comparator.comparingDouble(AgentMemoryDocument::getSimilarityScore).reversed());
        return allMemories.stream().limit(limit).toList();
    }

    /**
     * Records a new episodic experience into MongoDB once a PR is approved or verified
     */
    public AgentMemoryDocument recordExperience(String orgId, String agentSlug, String title,
                                                String problem, String rootCause, String patchDiff,
                                                List<String> tags) {
        var embedding = generateMockEmbedding(title + " " + problem + " " + rootCause);
        var doc = new AgentMemoryDocument(
                orgId, agentSlug, MemoryType.EPISODIC,
                title, problem, rootCause, patchDiff, tags, embedding
        );
        return memoryRepository.save(doc);
    }

    /**
     * Cosine similarity calculation between two float vectors
     */
    private double cosineSimilarity(List<Double> v1, List<Double> v2) {
        if (v1 == null || v2 == null || v1.size() != v2.size() || v1.isEmpty()) return 0.0;
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < v1.size(); i++) {
            dot += v1.get(i) * v2.get(i);
            normA += v1.get(i) * v1.get(i);
            normB += v2.get(i) * v2.get(i);
        }
        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Deterministic vector embedding generator (64-dimensional float vector)
     * For production, swap to OpenAI text-embedding-3-small or Ollama nomic-embed-text.
     */
    public List<Double> generateMockEmbedding(String text) {
        int dims = 64;
        List<Double> vec = new ArrayList<>(dims);
        for (int i = 0; i < dims; i++) {
            vec.add(0.0);
        }
        if (text == null || text.isBlank()) return vec;

        String[] words = text.toLowerCase().split("\\W+");
        for (String w : words) {
            if (w.isEmpty()) continue;
            int hash = Math.abs(w.hashCode());
            int idx = hash % dims;
            double val = vec.get(idx) + 1.0;
            vec.set(idx, val);
        }

        // Normalize vector to unit length
        double norm = 0.0;
        for (double d : vec) norm += d * d;
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < dims; i++) {
                vec.set(i, vec.get(i) / norm);
            }
        }
        return vec;
    }
}
