package com.forgeflow.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Tracks a remote AI Employee Worker Server connected to Forgeflow.
 */
@Document(collection = "worker_nodes")
public class WorkerNodeDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String workerId;

    private String hostname;
    private String ipAddress;
    private List<String> supportedSkills;
    private WorkerStatus status;
    private Instant registeredAt;
    private Instant lastHeartbeat;
    private int completedRunsCount;
    private String activeRunId;

    public WorkerNodeDocument() {}

    public WorkerNodeDocument(String workerId, String hostname, String ipAddress, List<String> supportedSkills) {
        this.workerId = workerId;
        this.hostname = hostname;
        this.ipAddress = ipAddress;
        this.supportedSkills = supportedSkills;
        this.status = WorkerStatus.IDLE;
        this.registeredAt = Instant.now();
        this.lastHeartbeat = Instant.now();
        this.completedRunsCount = 0;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getWorkerId() { return workerId; }
    public void setWorkerId(String workerId) { this.workerId = workerId; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public List<String> getSupportedSkills() { return supportedSkills; }
    public void setSupportedSkills(List<String> supportedSkills) { this.supportedSkills = supportedSkills; }

    public WorkerStatus getStatus() { return status; }
    public void setStatus(WorkerStatus status) { this.status = status; }

    public Instant getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(Instant registeredAt) { this.registeredAt = registeredAt; }

    public Instant getLastHeartbeat() { return lastHeartbeat; }
    public void setLastHeartbeat(Instant lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }

    public int getCompletedRunsCount() { return completedRunsCount; }
    public void setCompletedRunsCount(int completedRunsCount) { this.completedRunsCount = completedRunsCount; }

    public String getActiveRunId() { return activeRunId; }
    public void setActiveRunId(String activeRunId) { this.activeRunId = activeRunId; }

    public enum WorkerStatus {
        IDLE, BUSY, OFFLINE
    }
}
