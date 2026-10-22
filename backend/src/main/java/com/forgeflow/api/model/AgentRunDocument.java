package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

/**
 * MongoDB document representing one agent run.
 * All fields are stored in the "agent_runs" collection.
 */
@Document(collection = "agent_runs")
public class AgentRunDocument {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String agentSlug;
    private String agentName;
    private String repository;
    private Integer issueNumber;
    private String issueTitle;
    private RunStatus status;
    private double costInr;
    private Instant createdAt;
    private Instant updatedAt;

    /** Optional: SHA of the base commit this run was started on. */
    private String baseSha;

    /** Max spend allowed for this run (INR). Null = no hard limit set yet. */
    private Double budgetLimitInr;

    // ── Distributed Worker Execution Fields ──────────────────────────────────
    private String assignedWorkerId;
    private String workerHost;
    private String currentStep;
    private String diffSummary;
    private String pullRequestUrl;
    private int inputTokens;
    private int outputTokens;
    private long executionTimeMs;

    // ── Constructors ──────────────────────────────────────────────────────────

    public AgentRunDocument() {}

    public AgentRunDocument(String organizationId, String agentSlug, String agentName,
                            String repository, Integer issueNumber, String issueTitle) {
        this.id             = UUID.randomUUID().toString();
        this.organizationId = organizationId;
        this.agentSlug      = agentSlug;
        this.agentName      = agentName;
        this.repository     = repository;
        this.issueNumber    = issueNumber;
        this.issueTitle     = issueTitle;
        this.status         = RunStatus.QUEUED;
        this.costInr        = 0.0;
        this.createdAt      = Instant.now();
        this.updatedAt      = Instant.now();
    }

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public String getId()                          { return id; }
    public void   setId(String id)                 { this.id = id; }

    public String getOrganizationId()              { return organizationId; }
    public void   setOrganizationId(String v)      { this.organizationId = v; }

    public String getAgentSlug()                   { return agentSlug; }
    public void   setAgentSlug(String v)           { this.agentSlug = v; }

    public String getAgentName()                   { return agentName; }
    public void   setAgentName(String v)           { this.agentName = v; }

    public String getRepository()                  { return repository; }
    public void   setRepository(String v)          { this.repository = v; }

    public Integer getIssueNumber()                { return issueNumber; }
    public void    setIssueNumber(Integer v)       { this.issueNumber = v; }

    public String getIssueTitle()                  { return issueTitle; }
    public void   setIssueTitle(String v)          { this.issueTitle = v; }

    public RunStatus getStatus()                   { return status; }
    public void      setStatus(RunStatus v)        { this.status = v; this.updatedAt = Instant.now(); }

    public double getCostInr()                     { return costInr; }
    public void   setCostInr(double v)             { this.costInr = v; }

    public Instant getCreatedAt()                  { return createdAt; }
    public void    setCreatedAt(Instant v)         { this.createdAt = v; }

    public Instant getUpdatedAt()                  { return updatedAt; }
    public void    setUpdatedAt(Instant v)         { this.updatedAt = v; }

    public String getBaseSha()                     { return baseSha; }
    public void   setBaseSha(String v)             { this.baseSha = v; }

    public Double getBudgetLimitInr()              { return budgetLimitInr; }
    public void   setBudgetLimitInr(Double v)      { this.budgetLimitInr = v; }

    public String getAssignedWorkerId()            { return assignedWorkerId; }
    public void   setAssignedWorkerId(String v)    { this.assignedWorkerId = v; }

    public String getWorkerHost()                  { return workerHost; }
    public void   setWorkerHost(String v)          { this.workerHost = v; }

    public String getCurrentStep()                 { return currentStep; }
    public void   setCurrentStep(String v)         { this.currentStep = v; }

    public String getDiffSummary()                 { return diffSummary; }
    public void   setDiffSummary(String v)         { this.diffSummary = v; }

    public String getPullRequestUrl()              { return pullRequestUrl; }
    public void   setPullRequestUrl(String v)      { this.pullRequestUrl = v; }

    public int    getInputTokens()                 { return inputTokens; }
    public void   setInputTokens(int v)            { this.inputTokens = v; }

    public int    getOutputTokens()                { return outputTokens; }
    public void   setOutputTokens(int v)           { this.outputTokens = v; }

    public long   getExecutionTimeMs()             { return executionTimeMs; }
    public void   setExecutionTimeMs(long v)       { this.executionTimeMs = v; }

    public enum RunStatus {
        QUEUED, RUNNING, INVESTIGATING, PATCHING, VERIFYING,
        AWAITING_REVIEW, COMPLETED, FAILED, CANCELLED, BUDGET_DENIED
    }
}
