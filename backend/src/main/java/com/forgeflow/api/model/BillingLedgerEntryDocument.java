package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Tracks organization billing ledger, pre-allocated budget reservations, and balances.
 */
@Document(collection = "billing_ledger")
public class BillingLedgerEntryDocument {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String runId;
    private double amountInr; // Positive = credit/top-up, Negative = reservation/charge
    private EntryType type;   // CREDIT, RESERVATION, COMMIT, REFUND
    private String description;
    private Instant createdAt;

    public BillingLedgerEntryDocument() {}

    public BillingLedgerEntryDocument(String organizationId, String runId, double amountInr,
                                      EntryType type, String description) {
        this.organizationId = organizationId;
        this.runId = runId;
        this.amountInr = amountInr;
        this.type = type;
        this.description = description;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public double getAmountInr() { return amountInr; }
    public void setAmountInr(double amountInr) { this.amountInr = amountInr; }

    public EntryType getType() { return type; }
    public void setType(EntryType type) { this.type = type; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public enum EntryType {
        CREDIT, RESERVATION, COMMIT, REFUND
    }
}
