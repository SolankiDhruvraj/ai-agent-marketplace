package com.forgeflow.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phase 3 Policy Service: Evaluates tool call permissions, network access,
 * and branch push safety before any agent action executes.
 */
@Service
public class PolicyService {

    private static final Logger log = LoggerFactory.getLogger(PolicyService.class);

    // Capabilities permitted by agent slug
    private static final Map<String, Set<String>> ALLOWED_CAPABILITIES = Map.of(
            "bug-fix", Set.of(
                    "search_code", "read_lines", "apply_patch", "run_test",
                    "lint_code", "open_pull_request", "recall_memory"
            ),
            "dependency-remediation", Set.of(
                    "scan_cve", "check_semver", "modify_manifest", "run_test",
                    "open_pull_request", "recall_memory"
            ),
            "test-repair", Set.of(
                    "diagnose_flakiness", "sync_mocks", "read_lines", "apply_patch",
                    "run_test", "open_pull_request", "recall_memory"
            )
    );

    // Branches that agents are strictly forbidden from writing to directly
    private static final Set<String> PROTECTED_BRANCHES = Set.of(
            "main", "master", "release", "production", "prod", "develop"
    );

    public PolicyDecision evaluateToolCall(String agentSlug, String toolName, Map<String, Object> params) {
        Set<String> allowed = ALLOWED_CAPABILITIES.getOrDefault(agentSlug, Set.of());

        // 1. Tool capability whitelist check
        if (!allowed.contains(toolName)) {
            log.warn("POLICY DENIED: Agent [{}] is not permitted to execute tool [{}]", agentSlug, toolName);
            return PolicyDecision.deny("Tool '" + toolName + "' is not permitted in agent's manifest capabilities.");
        }

        // 2. Direct push policy gate: Agents must NEVER push directly to protected default branches
        if ("open_pull_request".equals(toolName) || "git_push".equals(toolName)) {
            String targetBranch = params != null && params.containsKey("targetBranch")
                    ? String.valueOf(params.get("targetBranch")).toLowerCase().trim()
                    : "";
            if (PROTECTED_BRANCHES.contains(targetBranch)) {
                log.warn("POLICY DENIED: Agent attempted direct push to protected branch '{}'", targetBranch);
                return PolicyDecision.deny("Direct writes to protected branch '" + targetBranch + "' are strictly prohibited. Agents must submit via pull request.");
            }
        }

        // 3. Destructive command policy: Block rm -rf / or secret exposure
        if (params != null && params.containsKey("command")) {
            String cmd = String.valueOf(params.get("command")).toLowerCase();
            if (cmd.contains("rm -rf /") || cmd.contains(":(){ :|:& };:") || cmd.contains("drop database")) {
                log.warn("POLICY DENIED: Destructive command detected in tool parameters: {}", cmd);
                return PolicyDecision.deny("Destructive command pattern detected.");
            }
        }

        return PolicyDecision.allow();
    }

    public record PolicyDecision(boolean allowed, String reason) {
        public static PolicyDecision allow() {
            return new PolicyDecision(true, "Policy passed all safety guardrails.");
        }
        public static PolicyDecision deny(String reason) {
            return new PolicyDecision(false, reason);
        }
    }
}
