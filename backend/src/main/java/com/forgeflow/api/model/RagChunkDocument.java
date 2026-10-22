package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * MongoDB document representing an indexed codebase chunk for RAG.
 * Stored in "code_knowledge_rag" collection.
 */
@Document(collection = "code_knowledge_rag")
@CompoundIndex(name = "repo_chunk_idx", def = "{'repository': 1, 'filePath': 1}")
public class RagChunkDocument {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    @Indexed
    private String repository;

    private String filePath;
    private int startLine;
    private int endLine;
    private String chunkType; // CLASS, METHOD, INTERFACE, CONFIG
    private String symbolIdentifier;
    private String codeContent;

    /**
     * 1024-dimensional vector from Voyage AI (voyage-code-3).
     * Indexed via MongoDB Vector Search index.
     */
    private List<Double> embedding;

    private double score; // Transient similarity score
    private Instant indexedAt;

    public RagChunkDocument() {}

    public RagChunkDocument(String organizationId, String repository, String filePath,
                            int startLine, int endLine, String chunkType,
                            String symbolIdentifier, String codeContent, List<Double> embedding) {
        this.id = UUID.randomUUID().toString();
        this.organizationId = organizationId;
        this.repository = repository;
        this.filePath = filePath;
        this.startLine = startLine;
        this.endLine = endLine;
        this.chunkType = chunkType;
        this.symbolIdentifier = symbolIdentifier;
        this.codeContent = codeContent;
        this.embedding = embedding;
        this.indexedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getRepository() { return repository; }
    public void setRepository(String repository) { this.repository = repository; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public int getStartLine() { return startLine; }
    public void setStartLine(int startLine) { this.startLine = startLine; }

    public int getEndLine() { return endLine; }
    public void setEndLine(int endLine) { this.endLine = endLine; }

    public String getChunkType() { return chunkType; }
    public void setChunkType(String chunkType) { this.chunkType = chunkType; }

    public String getSymbolIdentifier() { return symbolIdentifier; }
    public void setSymbolIdentifier(String symbolIdentifier) { this.symbolIdentifier = symbolIdentifier; }

    public String getCodeContent() { return codeContent; }
    public void setCodeContent(String codeContent) { this.codeContent = codeContent; }

    public List<Double> getEmbedding() { return embedding; }
    public void setEmbedding(List<Double> embedding) { this.embedding = embedding; }

    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }

    public Instant getIndexedAt() { return indexedAt; }
    public void setIndexedAt(Instant indexedAt) { this.indexedAt = indexedAt; }
}
