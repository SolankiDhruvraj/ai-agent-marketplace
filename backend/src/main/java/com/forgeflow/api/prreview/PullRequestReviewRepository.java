package com.forgeflow.api.prreview;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PullRequestReviewRepository extends MongoRepository<PullRequestReviewDocument, String> {

    List<PullRequestReviewDocument> findTop20ByOrderByCreatedAtDesc();

    Optional<PullRequestReviewDocument> findByOwnerAndRepoAndNumber(String owner, String repo, int number);
}
