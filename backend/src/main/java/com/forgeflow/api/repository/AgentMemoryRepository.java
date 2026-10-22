package com.forgeflow.api.repository;

import com.forgeflow.api.model.AgentMemoryDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgentMemoryRepository extends MongoRepository<AgentMemoryDocument, String> {

    List<AgentMemoryDocument> findByAgentSlugAndMemoryType(String agentSlug, AgentMemoryDocument.MemoryType memoryType);

    List<AgentMemoryDocument> findByTagsIn(List<String> tags);

    List<AgentMemoryDocument> findByOrganizationId(String organizationId);
}
