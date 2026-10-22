export interface SafetyGateResult {
  passed: boolean;
  violations: string[];
  safeDiff: string;
}

/**
 * Proprietary AST Diff Safety Gate:
 * Evaluates proposed patches against strict enterprise safety invariants
 * before opening any GitHub Pull Request.
 */
export class SafetyDiffGate {

  static evaluatePatch(diff: string): SafetyGateResult {
    const violations: string[] = [];

    const lines = diff.split('\n');

    for (const line of lines) {
      // 1. Invariant: Never delete or mask unit tests
      if (line.startsWith('-') && !line.startsWith('---')) {
        const deletedContent = line.substring(1).trim();
        if (
          deletedContent.includes('@Test') ||
          deletedContent.includes('assert') ||
          deletedContent.includes('expect(')
        ) {
          violations.push(`Forbidden: Deleted test assertion detected: "${deletedContent}"`);
        }

        // 2. Invariant: Never delete public API methods (Binary compatibility break)
        if (deletedContent.startsWith('public ') && deletedContent.includes('(')) {
          violations.push(`API Breakage: Deletion of public method signature: "${deletedContent}"`);
        }
      }

      // 3. Invariant: Prevent remote execution or shell injection
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const addedContent = line.substring(1).trim();
        if (
          addedContent.includes('Runtime.getRuntime().exec') ||
          addedContent.includes('ProcessBuilder') ||
          addedContent.includes('eval(') ||
          addedContent.includes('child_process.exec')
        ) {
          violations.push(`Security Policy Violation: Unsafe process execution API injected.`);
        }

        // 4. Invariant: Prevent credential leakage
        if (
          addedContent.includes('AIzaSy') ||
          addedContent.includes('AKIA') ||
          addedContent.includes('BEGIN PRIVATE KEY') ||
          addedContent.includes('ghp_')
        ) {
          violations.push(`Secret Leakage Violation: Hardcoded credential or API key detected.`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      safeDiff: diff
    };
  }
}
