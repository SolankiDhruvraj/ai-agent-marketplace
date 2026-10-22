package com.forgeflow.api.integration.event;

public record GithubIssueLabeledEvent(
        String deliveryId,
        String repository,
        Integer issueNumber,
        String issueTitle,
        String issueBody,
        String label,
        String sender,
        String organizationId
) {}
