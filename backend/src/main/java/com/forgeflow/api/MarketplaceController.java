package com.forgeflow.api;

import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Public Marketplace API (Accessible WITHOUT authentication).
 * Unauthenticated visitors can view all listed AI agents, their pricing,
 * specs, supported stacks, and benchmark metrics.
 */
@RestController
@RequestMapping("/api/marketplace")
public class MarketplaceController {

    private final List<MarketplaceAgentDto> catalog = List.of(
            new MarketplaceAgentDto(
                    "bug-fix",
                    "Bug Fix Specialist (Senior L5)",
                    "Autonomous software engineer with Dual-Critic review, SBFL fault localization, and automated style linting.",
                    "Java · TypeScript · Python · Go",
                    "₹320 / successful PR",
                    320.0,
                    "Ready",
                    94.8,
                    "3m 40s",
                    List.of("AST Symbol Search", "SBFL Ochiai Localization", "Adversarial Senior Critic", "Automated Linter Guard", "Test Runner"),
                    "2.0.0"
            ),
            new MarketplaceAgentDto(
                    "dependency-remediation",
                    "Dependency Remediation Specialist (Staff L6)",
                    "CVE security vulnerability scanner with SemVer compatibility analysis and non-destructive manifest patching.",
                    "Java (Maven/Gradle) · Node.js (npm/pnpm)",
                    "₹190 / successful PR",
                    190.0,
                    "Ready",
                    98.2,
                    "2m 10s",
                    List.of("CVE Advisory Scanner", "SemVer Compatibility Analyzer", "Manifest Modifier", "Critic Audit", "Regression Tests"),
                    "2.0.0"
            ),
            new MarketplaceAgentDto(
                    "test-repair",
                    "Test Repair Specialist (Senior L5)",
                    "Isolates test flakiness with multi-run diagnostics, synchronizes mock contracts, and repairs assertions without masking defects.",
                    "Java (JUnit 5) · TypeScript (Jest/Vitest)",
                    "₹240 / successful PR",
                    240.0,
                    "Ready",
                    91.5,
                    "2m 55s",
                    List.of("Multi-Run Flakiness Tool", "Mock Synchronizer", "Assertion Doctor", "Senior Critic Audit"),
                    "2.0.0"
            ),
            new MarketplaceAgentDto(
                    "pr-review",
                    "PR Code Review & Audit Specialist (Staff L6)",
                    "Multi-vector static analyzer & interactive PR auditor. Detects security flaws, bugs, performance leaks, computes risk scores, commits AI fixes, and provides live PR chat.",
                    "JavaScript · TypeScript · Python · Java · Go",
                    "₹150 / PR audit",
                    150.0,
                    "Ready",
                    97.4,
                    "45s",
                    List.of("Multi-Vector Static Analyzer", "Risk Scoring Engine", "One-Click AI Fix Committer", "Automated Test Suite Generator", "Interactive Gemini PR Chat"),
                    "2.1.0"
            )
    );

    @GetMapping("/agents")
    public List<MarketplaceAgentDto> getCatalog() {
        return catalog;
    }

    @GetMapping("/agents/{slug}")
    public MarketplaceAgentDto getAgent(@PathVariable String slug) {
        return catalog.stream()
                .filter(a -> a.slug().equalsIgnoreCase(slug))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + slug));
    }

    public record MarketplaceAgentDto(
            String slug,
            String name,
            String description,
            String stack,
            String price,
            double priceInr,
            String availability,
            double verifiedSuccessRate,
            String medianResolutionTime,
            List<String> capabilities,
            String version
    ) {}
}
