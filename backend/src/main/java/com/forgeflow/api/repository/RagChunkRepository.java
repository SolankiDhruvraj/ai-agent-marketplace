package com.forgeflow.api.repository;

import com.forgeflow.api.model.RagChunkDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RagChunkRepository extends MongoRepository<RagChunkDocument, String> {
    List<RagChunkDocument> findByOrganizationIdAndRepository(String organizationId, String repository);
    void deleteByOrganizationIdAndRepository(String organizationId, String repository);
}
