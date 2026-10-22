package com.forgeflow.api;

import com.forgeflow.api.model.WebhookInboxDocument;
import com.forgeflow.api.service.GithubWebhookService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Controller receiving GitHub App Webhook events.
 * Listens on /api/webhooks/github.
 */
@RestController
@RequestMapping("/api/webhooks")
public class GithubWebhookController {

    private final GithubWebhookService githubWebhookService;

    public GithubWebhookController(GithubWebhookService githubWebhookService) {
        this.githubWebhookService = githubWebhookService;
    }

    @PostMapping("/github")
    public ResponseEntity<?> receiveWebhook(
            @RequestHeader(value = "X-GitHub-Delivery", required = false) String deliveryId,
            @RequestHeader(value = "X-GitHub-Event", defaultValue = "issues") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody byte[] rawPayloadBytes) {

        // 1. Verify HMAC SHA-256 signature
        if (!githubWebhookService.verifySignature(rawPayloadBytes, signature)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing X-Hub-Signature-256 signature"));
        }

        // 2. Process idempotently
        String rawJson = new String(rawPayloadBytes, StandardCharsets.UTF_8);
        GithubWebhookService.WebhookResult result = githubWebhookService.processWebhook(deliveryId, eventType, rawJson);

        if (!result.success()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/deliveries")
    public List<WebhookInboxDocument> getRecentDeliveries() {
        return githubWebhookService.getRecentDeliveries();
    }
}
