package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * MongoDB Vector-enabled Memory Document.
 * Stores Episodic memories (past verified bug fixes & PRs)
 * and Semantic memories (architectural rules, best practices).
 */
@Document(collection = "agent_memories")
public class AgentMemoryDocument {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String agentSlug;

    private MemoryType memoryType; // EPISODIC, SEMANTIC, PROCEDURAL

    private String title;
    private String problemDescription;
    private String rootCausePattern;
    private String patchDiff;
    private List<String> tags;

    /**
     * Vector embedding representation of problem + stack trace (e.g., 384 or 1536 dimensions)
     * Compatible with MongoDB Vector Search index.
     */
    private List<Double> embedding;

    private double similarityScore; // Populated transiently during vector queries
    private int timesReferenced;
    private Instant createdAt;

    public AgentMemoryDocument() {}

    public AgentMemoryDocument(String organizationId, String agentSlug, MemoryType memoryType,
                               String title, String problemDescription, String rootCausePattern,
                               String patchDiff, List<String> tags, List<Double> embedding) {
        this.id = UUID.randomUUID().toString();
        this.organizationId = organizationId;
        this.agentSlug = agentSlug;
        this.memoryType = memoryType;
        this.title = title;
        this.problemDescription = problemDescription;
        this.rootCausePattern = rootCausePattern;
        this.patchDiff = patchDiff;
        this.tags = tags;
        this.embedding = embedding;
        this.timesReferenced = 0;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getAgentSlug() { return agentSlug; }
    public void setAgentSlug(String agentSlug) { this.agentSlug = agentSlug; }

    public MemoryType getMemoryType() { return memoryType; }
    public void setMemoryType(MemoryType memoryType) { this.memoryType = memoryType; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getProblemDescription() { return problemDescription; }
    public void setProblemDescription(String problemDescription) { this.problemDescription = problemDescription; }

    public String getRootCausePattern() { return rootCausePattern; }
    public void setRootCausePattern(String rootCausePattern) { this.rootCausePattern = rootCausePattern; }

    public String getPatchDiff() { return patchDiff; }
    public void setPatchDiff(String patchDiff) { this.patchDiff = patchDiff; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public List<Double> getEmbedding() { return embedding; }
    public void setEmbedding(List<Double> embedding) { this.embedding = embedding; }

    public double getSimilarityScore() { return similarityScore; }
    public void setSimilarityScore(double similarityScore) { this.similarityScore = similarityScore; }

    public int getTimesReferenced() { return timesReferenced; }
    public void setTimesReferenced(int timesReferenced) { this.timesReferenced = timesReferenced; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public enum MemoryType {
        EPISODIC,   // Past resolved PRs & experiences
        SEMANTIC,   // Language contracts & framework idioms
        PROCEDURAL  // Step-by-step verification protocols
    }
}
