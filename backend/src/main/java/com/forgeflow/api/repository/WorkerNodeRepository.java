package com.forgeflow.api.repository;

import com.forgeflow.api.model.WorkerNodeDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WorkerNodeRepository extends MongoRepository<WorkerNodeDocument, String> {
    Optional<WorkerNodeDocument> findByWorkerId(String workerId);
}
