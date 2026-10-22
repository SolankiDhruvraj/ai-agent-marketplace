package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

/**
 * Tracks an agent purchased/hired by a customer organization.
 */
@Document(collection = "user_subscriptions")
@CompoundIndex(name = "org_agent_idx", def = "{'organizationId': 1, 'agentSlug': 1}", unique = true)
public class UserSubscriptionDocument {

    @Id
    private String id;
    private String organizationId;
    private String agentSlug;
    private String agentName;
    private Instant purchasedAt;
    private String status; // ACTIVE, CANCELLED
    private double priceInr;

    public UserSubscriptionDocument() {}

    public UserSubscriptionDocument(String organizationId, String agentSlug, String agentName, double priceInr) {
        this.id = UUID.randomUUID().toString();
        this.organizationId = organizationId;
        this.agentSlug = agentSlug;
        this.agentName = agentName;
        this.purchasedAt = Instant.now();
        this.status = "ACTIVE";
        this.priceInr = priceInr;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getAgentSlug() { return agentSlug; }
    public void setAgentSlug(String agentSlug) { this.agentSlug = agentSlug; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }

    public Instant getPurchasedAt() { return purchasedAt; }
    public void setPurchasedAt(Instant purchasedAt) { this.purchasedAt = purchasedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getPriceInr() { return priceInr; }
    public void setPriceInr(double priceInr) { this.priceInr = priceInr; }
}
