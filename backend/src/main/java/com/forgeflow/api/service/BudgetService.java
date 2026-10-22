package com.forgeflow.api.service;

import com.forgeflow.api.model.BillingLedgerEntryDocument;
import com.forgeflow.api.repository.BillingLedgerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BudgetService {

    private static final Logger log = LoggerFactory.getLogger(BudgetService.class);
    private static final double DEFAULT_ORG_CREDIT = 15000.0; // ₹15,000 demo initial balance

    private final BillingLedgerRepository ledgerRepository;

    public BudgetService(BillingLedgerRepository ledgerRepository) {
        this.ledgerRepository = ledgerRepository;
    }

    public synchronized double getAvailableBalance(String organizationId) {
        List<BillingLedgerEntryDocument> entries = ledgerRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
        if (entries.isEmpty()) {
            // Seed initial account credit
            seedInitialCredit(organizationId);
            return DEFAULT_ORG_CREDIT;
        }

        double balance = 0.0;
        for (var entry : entries) {
            balance += entry.getAmountInr();
        }
        return balance;
    }

    public synchronized void seedInitialCredit(String organizationId) {
        BillingLedgerEntryDocument credit = new BillingLedgerEntryDocument(
                organizationId,
                null,
                DEFAULT_ORG_CREDIT,
                BillingLedgerEntryDocument.EntryType.CREDIT,
                "Initial Workspace Allocation (₹" + DEFAULT_ORG_CREDIT + ")"
        );
        ledgerRepository.save(credit);
    }

    /**
     * Atomically reserves budget for a run before execution.
     * Throws BudgetExceededException if insufficient balance.
     */
    public synchronized boolean tryReserveBudget(String organizationId, String runId, double maxSpendInr) {
        double available = getAvailableBalance(organizationId);
        if (available < maxSpendInr) {
            log.warn("Organization {} has insufficient balance (₹{}) for requested reservation of ₹{}",
                    organizationId, available, maxSpendInr);
            return false;
        }

        BillingLedgerEntryDocument reservation = new BillingLedgerEntryDocument(
                organizationId,
                runId,
                -Math.abs(maxSpendInr),
                BillingLedgerEntryDocument.EntryType.RESERVATION,
                "Reserved budget for run " + runId
        );
        ledgerRepository.save(reservation);
        log.info("Reserved ₹{} for runId={}. Remaining balance: ₹{}", maxSpendInr, runId, available - maxSpendInr);
        return true;
    }

    /**
     * Commits actual spend and releases unused reserved portion.
     */
    public synchronized void commitSpend(String organizationId, String runId, double actualSpendInr) {
        // Release previous reservation
        ledgerRepository.findByRunIdAndType(runId, BillingLedgerEntryDocument.EntryType.RESERVATION)
                .ifPresent(res -> {
                    double reservedAmount = Math.abs(res.getAmountInr());
                    double unusedRefund = reservedAmount - actualSpendInr;

                    BillingLedgerEntryDocument commitEntry = new BillingLedgerEntryDocument(
                            organizationId,
                            runId,
                            -Math.abs(actualSpendInr),
                            BillingLedgerEntryDocument.EntryType.COMMIT,
                            "Final spend for run " + runId
                    );
                    ledgerRepository.save(commitEntry);

                    if (unusedRefund > 0) {
                        BillingLedgerEntryDocument refundEntry = new BillingLedgerEntryDocument(
                                organizationId,
                                runId,
                                unusedRefund,
                                BillingLedgerEntryDocument.EntryType.REFUND,
                                "Refunded unused budget allocation"
                        );
                        ledgerRepository.save(refundEntry);
                    }
                });
    }

    /**
     * Full refund if run was cancelled or denied before doing any work.
     */
    public synchronized void releaseReservation(String organizationId, String runId) {
        ledgerRepository.findByRunIdAndType(runId, BillingLedgerEntryDocument.EntryType.RESERVATION)
                .ifPresent(res -> {
                    BillingLedgerEntryDocument refund = new BillingLedgerEntryDocument(
                            organizationId,
                            runId,
                            Math.abs(res.getAmountInr()),
                            BillingLedgerEntryDocument.EntryType.REFUND,
                            "Released unused reservation for cancelled run " + runId
                    );
                    ledgerRepository.save(refund);
                });
    }

    public List<BillingLedgerEntryDocument> getLedger(String organizationId) {
        return ledgerRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }
}
