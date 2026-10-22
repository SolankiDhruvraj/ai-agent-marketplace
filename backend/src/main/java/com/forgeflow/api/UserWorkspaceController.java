package com.forgeflow.api;

import com.forgeflow.api.model.AgentRunDocument;
import com.forgeflow.api.model.UserSubscriptionDocument;
import com.forgeflow.api.repository.UserSubscriptionRepository;
import com.forgeflow.api.service.AgentRunService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * User Workspace & Dashboard API (Requires authentication/entitlement).
 * Only accessible after signing in.
 * Shows only purchased agents, private runs, token budgets, and repo setups.
 */
@RestController
@RequestMapping("/api/user")
public class UserWorkspaceController {

    private final UserSubscriptionRepository subscriptionRepository;
    private final AgentRunService runService;
    private final MarketplaceController marketplaceController;

    public UserWorkspaceController(
            UserSubscriptionRepository subscriptionRepository,
            AgentRunService runService,
            MarketplaceController marketplaceController) {
        this.subscriptionRepository = subscriptionRepository;
        this.runService = runService;
        this.marketplaceController = marketplaceController;
    }

    /** Returns customer profile, active subscriptions, and credit quota */
    @GetMapping("/me")
    public UserProfileDto getProfile(@RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId) {
        var subscriptions = subscriptionRepository.findByOrganizationIdAndStatus(orgId, "ACTIVE");
        var runs = runService.listRuns(orgId);
        double totalSpend = runs.stream().mapToDouble(AgentRunDocument::getCostInr).sum();

        return new UserProfileDto(
                orgId,
                "Acme Payments Inc.",
                "pro",
                subscriptions,
                runs.size(),
                totalSpend,
                15000.0 // 15,000 INR quota limit
        );
    }

    /** Returns only the agents this user has purchased */
    @GetMapping("/agents")
    public List<PurchasedAgentDto> getMyAgents(@RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId) {
        var subscriptions = subscriptionRepository.findByOrganizationIdAndStatus(orgId, "ACTIVE");
        var catalog = marketplaceController.getCatalog();

        return subscriptions.stream().map(sub -> {
            var catalogEntry = catalog.stream()
                    .filter(c -> c.slug().equalsIgnoreCase(sub.getAgentSlug()))
                    .findFirst()
                    .orElse(null);

            return new PurchasedAgentDto(
                    sub.getId(),
                    sub.getAgentSlug(),
                    sub.getAgentName(),
                    sub.getPurchasedAt(),
                    catalogEntry != null ? catalogEntry.stack() : "Multi-stack",
                    catalogEntry != null ? catalogEntry.capabilities() : List.of(),
                    catalogEntry != null ? catalogEntry.version() : "1.0.0"
            );
        }).toList();
    }

    /** Purchase / Hire an agent from the marketplace */
    @PostMapping("/purchase")
    @ResponseStatus(HttpStatus.CREATED)
    public UserSubscriptionDocument purchaseAgent(
            @RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId,
            @Valid @RequestBody PurchaseRequest req) {

        var agent = marketplaceController.getAgent(req.agentSlug());
        if (subscriptionRepository.existsByOrganizationIdAndAgentSlug(orgId, agent.slug())) {
            throw new AgentAlreadyPurchasedException("You have already hired " + agent.name());
        }

        var sub = new UserSubscriptionDocument(orgId, agent.slug(), agent.name(), agent.priceInr());
        return subscriptionRepository.save(sub);
    }

    /** Get customer's private runs */
    @GetMapping("/runs")
    public List<AgentRunDocument> getMyRuns(@RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId) {
        return runService.listRuns(orgId);
    }

    /** Queue a new run - MUST have purchased the agent first! */
    @PostMapping("/runs")
    @ResponseStatus(HttpStatus.CREATED)
    public AgentRunDocument dispatchRun(
            @RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId,
            @Valid @RequestBody DispatchTaskRequest req) {

        // Check entitlement: user must own this agent to run it
        boolean owns = subscriptionRepository.existsByOrganizationIdAndAgentSlug(orgId, req.agentSlug());
        if (!owns) {
            throw new EntitlementRequiredException(
                    "You must hire '" + req.agentSlug() + "' from the marketplace before you can dispatch work to it.");
        }

        var agent = marketplaceController.getAgent(req.agentSlug());
        return runService.createRun(
                orgId,
                agent.slug(),
                agent.name(),
                req.repository(),
                req.issueNumber(),
                req.issueTitle()
        );
    }

    @ExceptionHandler(AgentAlreadyPurchasedException.class)
    ProblemDetail alreadyPurchased(AgentAlreadyPurchasedException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(EntitlementRequiredException.class)
    ProblemDetail entitlementMissing(EntitlementRequiredException ex) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.getMessage());
        pd.setType(URI.create("https://forgeflow.dev/errors/agent-not-purchased"));
        return pd;
    }

    public record PurchaseRequest(@NotBlank String agentSlug) {}
    public record DispatchTaskRequest(
            @NotBlank String agentSlug,
            @NotBlank String repository,
            @NotNull Integer issueNumber,
            @NotBlank String issueTitle
    ) {}

    public record UserProfileDto(
            String organizationId,
            String companyName,
            String plan,
            List<UserSubscriptionDocument> activeAgents,
            int totalRunsCount,
            double totalSpendInr,
            double creditBudgetInr
    ) {}

    public record PurchasedAgentDto(
            String subscriptionId,
            String slug,
            String name,
            java.time.Instant purchasedAt,
            String stack,
            List<String> capabilities,
            String version
    ) {}

    public static class AgentAlreadyPurchasedException extends RuntimeException {
        public AgentAlreadyPurchasedException(String msg) { super(msg); }
    }

    public static class EntitlementRequiredException extends RuntimeException {
        public EntitlementRequiredException(String msg) { super(msg); }
    }
}
