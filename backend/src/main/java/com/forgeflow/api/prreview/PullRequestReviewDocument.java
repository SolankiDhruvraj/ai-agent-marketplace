package com.forgeflow.api.prreview;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * MongoDB document representing a Pull Request Review / Audit.
 * Stored in collection 'pr_reviews'.
 */
@Document(collection = "pr_reviews")
public class PullRequestReviewDocument {

    @Id
    private String id;

    @Indexed
    private String owner;

    @Indexed
    private String repo;

    @Indexed
    private int number;

    private String status; // PENDING, COMPLETED, ERROR, REJECTED
    private String errorMessage;
    private Instant createdAt;
    private Instant updatedAt;

    private List<Map<String, Object>> files;
    private List<Map<String, Object>> issues;
    private Map<String, Object> summary;

    private String githubReviewStatus;
    private String githubReviewUrl;

    public PullRequestReviewDocument() {}

    public PullRequestReviewDocument(String owner, String repo, int number) {
        this.id = owner + ":" + repo + ":" + number;
        this.owner = owner;
        this.repo = repo;
        this.number = number;
        this.status = "PENDING";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }

    public String getRepo() { return repo; }
    public void setRepo(String repo) { this.repo = repo; }

    public int getNumber() { return number; }
    public void setNumber(int number) { this.number = number; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public List<Map<String, Object>> getFiles() { return files; }
    public void setFiles(List<Map<String, Object>> files) { this.files = files; }

    public List<Map<String, Object>> getIssues() { return issues; }
    public void setIssues(List<Map<String, Object>> issues) { this.issues = issues; }

    public Map<String, Object> getSummary() { return summary; }
    public void setSummary(Map<String, Object> summary) { this.summary = summary; }

    public String getGithubReviewStatus() { return githubReviewStatus; }
    public void setGithubReviewStatus(String githubReviewStatus) { this.githubReviewStatus = githubReviewStatus; }

    public String getGithubReviewUrl() { return githubReviewUrl; }
    public void setGithubReviewUrl(String githubReviewUrl) { this.githubReviewUrl = githubReviewUrl; }
}
