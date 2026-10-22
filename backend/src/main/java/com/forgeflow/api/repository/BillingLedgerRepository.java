package com.forgeflow.api.repository;

import com.forgeflow.api.model.BillingLedgerEntryDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BillingLedgerRepository extends MongoRepository<BillingLedgerEntryDocument, String> {
    List<BillingLedgerEntryDocument> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);
    Optional<BillingLedgerEntryDocument> findByRunIdAndType(String runId, BillingLedgerEntryDocument.EntryType type);
}
