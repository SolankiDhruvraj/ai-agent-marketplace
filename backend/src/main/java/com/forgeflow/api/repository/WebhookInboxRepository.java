package com.forgeflow.api.repository;

import com.forgeflow.api.model.WebhookInboxDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WebhookInboxRepository extends MongoRepository<WebhookInboxDocument, String> {
    Optional<WebhookInboxDocument> findByDeliveryId(String deliveryId);
    boolean existsByDeliveryId(String deliveryId);
    List<WebhookInboxDocument> findTop20ByOrderByReceivedAtDesc();
}
