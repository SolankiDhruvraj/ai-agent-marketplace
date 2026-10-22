package com.forgeflow.api.repository;

import com.forgeflow.api.model.UserSubscriptionDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserSubscriptionRepository extends MongoRepository<UserSubscriptionDocument, String> {
    List<UserSubscriptionDocument> findByOrganizationIdAndStatus(String organizationId, String status);
    Optional<UserSubscriptionDocument> findByOrganizationIdAndAgentSlug(String organizationId, String agentSlug);
    boolean existsByOrganizationIdAndAgentSlug(String organizationId, String agentSlug);
}
