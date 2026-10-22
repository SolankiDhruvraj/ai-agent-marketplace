package com.forgeflow.api.repository;

import com.forgeflow.api.model.AgentRunDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgentRunRepository extends MongoRepository<AgentRunDocument, String> {

    /** All runs for a given organisation, newest first. */
    List<AgentRunDocument> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);

    /** Runs in a specific status for a given org. */
    List<AgentRunDocument> findByOrganizationIdAndStatus(
            String organizationId, AgentRunDocument.RunStatus status);

    /** Count active runs across the platform (for dashboard metrics). */
    long countByStatus(AgentRunDocument.RunStatus status);

    /** Find first queued run matching an agent slug */
    List<AgentRunDocument> findByStatusOrderByCreatedAtAsc(AgentRunDocument.RunStatus status);
}
