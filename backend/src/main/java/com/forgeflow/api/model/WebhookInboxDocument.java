package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * Stores received GitHub webhook delivery events for idempotency and auditability.
 * Ensures duplicate deliveries from GitHub do not trigger multiple agent runs.
 */
@Document(collection = "webhook_inbox")
public class WebhookInboxDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String deliveryId;

    private String eventType;
    private String status; // PENDING, PROCESSED, IGNORED, FAILED
    private String repository;
    private Integer issueNumber;
    private String action;
    private Instant receivedAt;
    private Instant processedAt;
    private String errorMessage;
    private Map<String, Object> payloadSummary;

    public WebhookInboxDocument() {}

    public WebhookInboxDocument(String deliveryId, String eventType, String repository,
                                Integer issueNumber, String action, String status,
                                Map<String, Object> payloadSummary) {
        this.deliveryId = deliveryId;
        this.eventType = eventType;
        this.repository = repository;
        this.issueNumber = issueNumber;
        this.action = action;
        this.status = status;
        this.receivedAt = Instant.now();
        this.payloadSummary = payloadSummary;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDeliveryId() { return deliveryId; }
    public void setDeliveryId(String deliveryId) { this.deliveryId = deliveryId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRepository() { return repository; }
    public void setRepository(String repository) { this.repository = repository; }

    public Integer getIssueNumber() { return issueNumber; }
    public void setIssueNumber(Integer issueNumber) { this.issueNumber = issueNumber; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public Instant getProcessedAt() { return processedAt; }
    public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Map<String, Object> getPayloadSummary() { return payloadSummary; }
    public void setPayloadSummary(Map<String, Object> payloadSummary) { this.payloadSummary = payloadSummary; }
}
