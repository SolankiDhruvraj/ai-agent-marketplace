package com.forgeflow.api.repository;

import com.forgeflow.api.model.AuditEventDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditEventRepository extends MongoRepository<AuditEventDocument, String> {

    List<AuditEventDocument> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);
}
