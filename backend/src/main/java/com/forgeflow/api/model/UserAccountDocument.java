package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Stores registered user accounts with securely salted & hashed passwords.
 */
@Document(collection = "users")
public class UserAccountDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    private String passwordHash;
    private String organizationId;
    private String role;
    private Instant createdAt;

    public UserAccountDocument() {}

    public UserAccountDocument(String username, String passwordHash, String organizationId, String role) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.organizationId = organizationId;
        this.role = role != null ? role : "ROLE_USER";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
