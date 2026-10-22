package com.forgeflow.api;

import com.forgeflow.api.model.BillingLedgerEntryDocument;
import com.forgeflow.api.service.BudgetService;
import com.forgeflow.api.service.PolicyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orchestration")
public class OrchestrationController {

    private final BudgetService budgetService;
    private final PolicyService policyService;

    public OrchestrationController(BudgetService budgetService, PolicyService policyService) {
        this.budgetService = budgetService;
        this.policyService = policyService;
    }

    @GetMapping("/budget")
    public ResponseEntity<?> getBudget(@RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId) {
        double balance = budgetService.getAvailableBalance(orgId);
        List<BillingLedgerEntryDocument> ledger = budgetService.getLedger(orgId);
        return ResponseEntity.ok(Map.of(
                "organizationId", orgId,
                "availableBalanceInr", balance,
                "ledgerEntriesCount", ledger.size(),
                "recentLedger", ledger.stream().limit(10).toList()
        ));
    }

    @PostMapping("/policy/evaluate")
    public ResponseEntity<?> evaluatePolicy(@RequestBody EvaluatePolicyRequest req) {
        PolicyService.PolicyDecision decision = policyService.evaluateToolCall(
                req.agentSlug(),
                req.toolName(),
                req.params()
        );
        return ResponseEntity.ok(decision);
    }

    public record EvaluatePolicyRequest(String agentSlug, String toolName, Map<String, Object> params) {}
}
