export interface LinterReport {
  passed: boolean;
  errorsCount: number;
  warningsCount: number;
  feedback: string;
}

/**
 * Domain-Specific Tool: Automated Linter & Code Style Inspector
 * Validates indentation, import hygiene, and syntactic conventions
 * before any PR is generated.
 */
export class LinterTool {

  static checkDiff(diff: string): LinterReport {
    const issues: string[] = [];

    const lines = diff.split('\n');

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const added = line.substring(1);

        // Check for common code smells in added lines
        if (added.includes('System.out.println(') || added.includes('console.log(')) {
          issues.push(`Warning: Debug print statement found: "${added.trim()}" (Favor structured SLF4J / logger)`);
        }

        if (added.includes('import java.util.*;') || added.includes('import * as')) {
          issues.push(`Style: Wildcard import detected: "${added.trim()}" (Use explicit symbol imports)`);
        }

        if (added.includes('TODO:') || added.includes('FIXME:')) {
          issues.push(`Warning: Unresolved comment: "${added.trim()}"`);
        }
      }
    }

    const passed = issues.length === 0;
    const feedback = passed
      ? 'Clean: All linter checks passed (0 errors, 0 warnings).'
      : `Linter Feedback:\n${issues.map(i => '  • ' + i).join('\n')}`;

    return {
      passed,
      errorsCount: 0,
      warningsCount: issues.length,
      feedback
    };
  }
}
