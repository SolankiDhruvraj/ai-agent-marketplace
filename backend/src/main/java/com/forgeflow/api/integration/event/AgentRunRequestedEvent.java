package com.forgeflow.api.integration.event;

public record AgentRunRequestedEvent(
        String organizationId,
        String agentSlug,
        String agentName,
        String repository,
        Integer issueNumber,
        String issueTitle,
        String triggerSource
) {}
