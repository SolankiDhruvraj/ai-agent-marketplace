package com.forgeflow.api.prreview;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Controller exposing PR Review, AI Chat & Fix endpoints directly to Forgeflow frontend.
 * Forwards heavy LLM static analysis & PR chat to the worker or executes directly.
 */
@RestController
@RequestMapping("/api/pr-reviews")
@CrossOrigin(origins = "*")
public class PullRequestReviewController {

    private final PullRequestReviewRepository repository;
    private final WebClient webClient;

    @Value("${PR_WORKER_URL:http://localhost:4005}")
    private String workerUrl;

    public PullRequestReviewController(PullRequestReviewRepository repository) {
        this.repository = repository;
        this.webClient = WebClient.builder().build();
    }

    /**
     * List recent pull request reviews
     */
    @GetMapping
    public List<PullRequestReviewDocument> listReviews() {
        return repository.findTop20ByOrderByCreatedAtDesc();
    }

    /**
     * Get review details for specific PR
     */
    @GetMapping("/{owner}/{repo}/{number}")
    public ResponseEntity<PullRequestReviewDocument> getReview(
            @PathVariable String owner,
            @PathVariable String repo,
            @PathVariable int number) {
        return repository.findByOwnerAndRepoAndNumber(owner, repo, number)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Trigger review analysis
     */
    @PostMapping("/trigger")
    public Mono<ResponseEntity<Map<String, Object>>> triggerAudit(@RequestBody Map<String, Object> req) {
        return webClient.post()
                .uri(workerUrl + "/github/trigger")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(120))
                .map(body -> ResponseEntity.ok((Map<String, Object>) body))
                .onErrorResume(err -> Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "PR Review analysis worker failed: " + err.getMessage()))));
    }

    /**
     * Apply AI suggested fix to PR branch
     */
    @PostMapping("/apply-fix")
    public Mono<ResponseEntity<Map<String, Object>>> applyFix(@RequestBody Map<String, Object> req) {
        return webClient.post()
                .uri(workerUrl + "/github/apply-fix")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(60))
                .map(body -> ResponseEntity.ok((Map<String, Object>) body))
                .onErrorResume(err -> Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to commit AI fix to GitHub: " + err.getMessage()))));
    }

    /**
     * Interactive PR AI Chat
     */
    @PostMapping("/chat")
    public Mono<ResponseEntity<Map<String, Object>>> chat(@RequestBody Map<String, Object> req) {
        return webClient.post()
                .uri(workerUrl + "/github/chat")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(60))
                .map(body -> ResponseEntity.ok((Map<String, Object>) body))
                .onErrorResume(err -> Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "PR Agent chat error: " + err.getMessage()))));
    }

    /**
     * Sync review directly from worker into MongoDB
     */
    @PostMapping("/sync")
    public ResponseEntity<PullRequestReviewDocument> syncReview(@RequestBody PullRequestReviewDocument doc) {
        doc.setUpdatedAt(java.time.Instant.now());
        PullRequestReviewDocument saved = repository.save(doc);
        return ResponseEntity.ok(saved);
    }
}
