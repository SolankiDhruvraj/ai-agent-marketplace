package com.forgeflow.api.service;

import com.forgeflow.api.integration.event.GithubIssueLabeledEvent;
import com.forgeflow.api.model.AgentRunDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Phase 2 Event Listener: Listens for GitHub labeled events and triggers
 * the corresponding specialized marketplace agent if configured.
 *
 * Supported label mapping:
 * - "ai-fix" or "bug" -> "bug-fix" (Bug Fix Specialist)
 * - "security" or "dependencies" -> "dependency-remediation" (Dependency Remediation)
 * - "flaky" or "test" -> "test-repair" (Test Repair Specialist)
 */
@Component
public class GithubIssueEventListener {

    private static final Logger log = LoggerFactory.getLogger(GithubIssueEventListener.class);
    private final AgentRunService agentRunService;

    private static final Map<String, AgentMapping> LABEL_TO_AGENT = Map.of(
            "ai-fix", new AgentMapping("bug-fix", "Bug Fix Specialist (Senior L5)"),
            "bug", new AgentMapping("bug-fix", "Bug Fix Specialist (Senior L5)"),
            "dependencies", new AgentMapping("dependency-remediation", "Dependency Remediation Specialist (Staff L6)"),
            "security", new AgentMapping("dependency-remediation", "Dependency Remediation Specialist (Staff L6)"),
            "flaky", new AgentMapping("test-repair", "Test Repair Specialist (Senior L5)"),
            "test-repair", new AgentMapping("test-repair", "Test Repair Specialist (Senior L5)")
    );

    public GithubIssueEventListener(AgentRunService agentRunService) {
        this.agentRunService = agentRunService;
    }

    @EventListener
    public void onIssueLabeled(GithubIssueLabeledEvent event) {
        log.info("Received GithubIssueLabeledEvent: repo={} issue=#{} label='{}'",
                event.repository(), event.issueNumber(), event.label());

        if (event.label() == null) {
            return;
        }

        String normalizedLabel = event.label().toLowerCase().trim();
        AgentMapping mapping = LABEL_TO_AGENT.get(normalizedLabel);

        if (mapping == null) {
            log.info("Label '{}' does not match any automated agent trigger. Ignoring.", event.label());
            return;
        }

        log.info("Triggering Agent [{}] for issue #{} on repo {}",
                mapping.slug(), event.issueNumber(), event.repository());

        AgentRunDocument run = agentRunService.createRun(
                event.organizationId(),
                mapping.slug(),
                mapping.name(),
                event.repository(),
                event.issueNumber(),
                event.issueTitle() != null ? event.issueTitle() : "Issue #" + event.issueNumber()
        );

        log.info("Successfully queued runId={} for GitHub webhook deliveryId={}", run.getId(), event.deliveryId());
    }

    private record AgentMapping(String slug, String name) {}
}
