package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable audit trail entry. Every significant state change records here.
 */
@Document(collection = "audit_events")
public class AuditEventDocument {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String actor;     // "system" or a user id
    private String action;    // e.g. "run.created", "run.cancelled"
    private String resourceId;
    private Map<String, Object> metadata;
    private Instant createdAt;

    public AuditEventDocument() {}

    public AuditEventDocument(String organizationId, String actor, String action,
                               String resourceId, Map<String, Object> metadata) {
        this.id             = UUID.randomUUID().toString();
        this.organizationId = organizationId;
        this.actor          = actor;
        this.action         = action;
        this.resourceId     = resourceId;
        this.metadata       = metadata;
        this.createdAt      = Instant.now();
    }

    public String getId()              { return id; }
    public String getOrganizationId()  { return organizationId; }
    public String getActor()           { return actor; }
    public String getAction()          { return action; }
    public String getResourceId()      { return resourceId; }
    public Map<String, Object> getMetadata() { return metadata; }
    public Instant getCreatedAt()      { return createdAt; }
}
