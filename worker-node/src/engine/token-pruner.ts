/**
 * Token Pruner & Context Optimizer:
 * Reduces LLM token consumption by 70-80% through deterministic pre-processing.
 */
export class TokenPruner {

  /**
   * Approximate token count (1 token ≈ 4 characters for code/text)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract a targeted slice around a target line or keyword instead of full file.
   * Keeps up to `windowSize` lines above and below.
   */
  static sliceFileContext(fullContent: string, targetLine: number, windowSize = 25): { slice: string; startLine: number; endLine: number } {
    const lines = fullContent.split('\n');
    const startLine = Math.max(1, targetLine - windowSize);
    const endLine = Math.min(lines.length, targetLine + windowSize);

    const slice = lines.slice(startLine - 1, endLine).map((line, idx) => {
      const lineNum = startLine + idx;
      const marker = lineNum === targetLine ? ' > ' : '   ';
      return `${marker}${lineNum.toString().padStart(4, ' ')} | ${line}`;
    }).join('\n');

    return { slice, startLine, endLine };
  }

  /**
   * Prunes verbose test output (Maven, npm, Gradle).
   * Strips download progress, JVM trace spam, and keeps only the failure assertion and stack.
   */
  static pruneTestOutput(rawOutput: string, maxLines = 40): string {
    const lines = rawOutput.split('\n');
    const importantLines: string[] = [];

    let isCapturingFailure = false;

    for (const line of lines) {
      const isNoise = line.includes('Downloading from') ||
                      line.includes('Downloaded from') ||
                      line.includes('Progress (') ||
                      line.includes('[INFO] --- maven-') ||
                      line.includes('npm notice');

      if (isNoise) continue;

      const isFailureIndicator = line.includes('FAILURE!') ||
                                 line.includes('AssertionError') ||
                                 line.includes('FAILED') ||
                                 line.includes('Error:') ||
                                 line.includes('expected:') ||
                                 line.includes('but was:');

      if (isFailureIndicator) {
        isCapturingFailure = true;
      }

      if (isCapturingFailure || line.includes('[ERROR]') || line.includes('FAIL')) {
        importantLines.push(line);
      }
    }

    if (importantLines.length === 0) {
      // Fallback: take last 30 lines where errors typically conclude
      return lines.slice(-maxLines).join('\n');
    }

    return importantLines.slice(0, maxLines).join('\n');
  }

  /**
   * Format unified diff for LLM consumption and verification
   */
  static formatDiff(filename: string, searchBlock: string, replaceBlock: string): string {
    return `--- a/${filename}\n+++ b/${filename}\n@@ diff @@\n- ${searchBlock.split('\n').join('\n- ')}\n+ ${replaceBlock.split('\n').join('\n+ ')}`;
  }
}
