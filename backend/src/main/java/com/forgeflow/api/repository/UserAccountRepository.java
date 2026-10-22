package com.forgeflow.api.repository;

import com.forgeflow.api.model.UserAccountDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAccountRepository extends MongoRepository<UserAccountDocument, String> {
    Optional<UserAccountDocument> findByUsername(String username);
    boolean existsByUsername(String username);
}
