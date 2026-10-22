package com.forgeflow.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forgeflow.api.integration.event.GithubIssueLabeledEvent;
import com.forgeflow.api.model.WebhookInboxDocument;
import com.forgeflow.api.repository.WebhookInboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Service
public class GithubWebhookService {

    private static final Logger log = LoggerFactory.getLogger(GithubWebhookService.class);
    private final WebhookInboxRepository webhookInboxRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final String webhookSecret;

    public GithubWebhookService(
            WebhookInboxRepository webhookInboxRepository,
            ApplicationEventPublisher eventPublisher,
            ObjectMapper objectMapper,
            @Value("${forgeflow.github.webhook-secret:}") String webhookSecret) {
        this.webhookInboxRepository = webhookInboxRepository;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.webhookSecret = webhookSecret != null ? webhookSecret : "";
    }

    /**
     * Validates GitHub HMAC-SHA256 signature header: X-Hub-Signature-256: sha256=...
     * If webhookSecret is unset or blank in dev/test, signature check is safely bypassed.
     */
    public boolean verifySignature(byte[] payloadBytes, String signatureHeader) {
        if (webhookSecret.isBlank()) {
            return true; // Bypass signature in local dev/demo mode
        }
        if (signatureHeader == null || !signatureHeader.startsWith("sha256=")) {
            return false;
        }

        try {
            String expectedHash = signatureHeader.substring("sha256=".length()).trim();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computedHashBytes = mac.doFinal(payloadBytes);
            String computedHex = HexFormat.of().formatHex(computedHashBytes);

            return MessageDigest.isEqual(
                    expectedHash.getBytes(StandardCharsets.UTF_8),
                    computedHex.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            log.error("Failed to verify HMAC signature: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Handles webhook payload with idempotent delivery checking.
     */
    public WebhookResult processWebhook(String deliveryId, String eventType, String rawPayload) {
        if (deliveryId == null || deliveryId.isBlank()) {
            deliveryId = "gen-" + java.util.UUID.randomUUID();
        }

        // 1. Check idempotency: If already accepted or processed, skip replay
        if (webhookInboxRepository.existsByDeliveryId(deliveryId)) {
            log.info("Duplicate GitHub deliveryId={} detected. Skipping idempotent delivery.", deliveryId);
            return new WebhookResult(false, "Duplicate deliveryId " + deliveryId + " already processed", null);
        }

        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            String action = root.has("action") ? root.get("action").asText() : "unknown";
            String repoFullName = root.has("repository") && root.get("repository").has("full_name")
                    ? root.get("repository").get("full_name").asText() : "unknown/repo";

            Integer issueNumber = null;
            String issueTitle = null;
            String issueBody = null;
            String labelName = null;
            String sender = root.has("sender") && root.get("sender").has("login")
                    ? root.get("sender").get("login").asText() : "github-user";

            if (root.has("issue")) {
                JsonNode issue = root.get("issue");
                issueNumber = issue.has("number") ? issue.get("number").asInt() : null;
                issueTitle = issue.has("title") ? issue.get("title").asText() : "";
                issueBody = issue.has("body") && !issue.get("body").isNull() ? issue.get("body").asText() : "";
            }

            if (root.has("label") && root.get("label").has("name")) {
                labelName = root.get("label").get("name").asText();
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("sender", sender);
            summary.put("label", labelName);
            summary.put("issueTitle", issueTitle);

            WebhookInboxDocument inboxDoc = new WebhookInboxDocument(
                    deliveryId,
                    eventType,
                    repoFullName,
                    issueNumber,
                    action,
                    "PENDING",
                    summary
            );
            webhookInboxRepository.save(inboxDoc);

            // 2. Filter for labeled issues: "issues" event with action "labeled"
            if ("issues".equalsIgnoreCase(eventType) && "labeled".equalsIgnoreCase(action)) {
                String orgId = repoFullName.contains("/") ? repoFullName.split("/")[0] : "demo-org";

                GithubIssueLabeledEvent event = new GithubIssueLabeledEvent(
                        deliveryId,
                        repoFullName,
                        issueNumber,
                        issueTitle,
                        issueBody,
                        labelName,
                        sender,
                        orgId
                );

                // Publish internal event
                eventPublisher.publishEvent(event);

                inboxDoc.setStatus("PROCESSED");
                inboxDoc.setProcessedAt(Instant.now());
                webhookInboxRepository.save(inboxDoc);

                return new WebhookResult(true, "Event accepted and published for label: " + labelName, inboxDoc);
            }

            inboxDoc.setStatus("IGNORED");
            inboxDoc.setProcessedAt(Instant.now());
            webhookInboxRepository.save(inboxDoc);
            return new WebhookResult(true, "Webhook received but not an 'issues.labeled' event", inboxDoc);

        } catch (Exception e) {
            log.error("Failed to parse GitHub webhook: {}", e.getMessage(), e);
            WebhookInboxDocument errorDoc = new WebhookInboxDocument(
                    deliveryId, eventType, "unknown", null, "error", "FAILED", Map.of("error", e.getMessage())
            );
            errorDoc.setErrorMessage(e.getMessage());
            webhookInboxRepository.save(errorDoc);
            return new WebhookResult(false, "Malformed JSON or processing error: " + e.getMessage(), errorDoc);
        }
    }

    public List<WebhookInboxDocument> getRecentDeliveries() {
        return webhookInboxRepository.findTop20ByOrderByReceivedAtDesc();
    }

    public record WebhookResult(boolean success, String message, WebhookInboxDocument record) {}
}
