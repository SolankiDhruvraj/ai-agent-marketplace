import * as fs from 'fs';
import * as path from 'path';
import { TokenPruner } from '../engine/token-pruner.js';

export class FileTool {
  constructor(private workspaceDir: string) {}

  /**
   * Fast symbol/text search across repo without reading everything into LLM
   */
  search(keyword: string): string[] {
    const results: string[] = [];
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes(keyword)) {
              results.push(path.relative(this.workspaceDir, full));
            }
          } catch {}
        }
      }
    };
    scanDir(this.workspaceDir);
    return results.slice(0, 10);
  }

  /**
   * Reads only a specific line range from a file, returning indexed preview
   */
  readLines(relPath: string, startLine = 1, endLine = 60): string {
    const full = path.join(this.workspaceDir, relPath);
    if (!fs.existsSync(full)) {
      return `File not found: ${relPath}`;
    }
    const content = fs.readFileSync(full, 'utf8');
    const midLine = Math.floor((startLine + endLine) / 2);
    const window = Math.floor((endLine - startLine) / 2);
    const { slice } = TokenPruner.sliceFileContext(content, midLine, window);
    return slice;
  }

  /**
   * Applies localized search/replace block patch (never rewrites entire file)
   */
  applyPatch(relPath: string, searchStr: string, replaceStr: string): { success: boolean; message: string } {
    const full = path.join(this.workspaceDir, relPath);
    if (!fs.existsSync(full)) {
      return { success: false, message: `File not found: ${relPath}` };
    }
    const content = fs.readFileSync(full, 'utf8');
    if (!content.includes(searchStr)) {
      return { success: false, message: `Search block not found in ${relPath}. Make sure whitespace matches exactly.` };
    }
    const updated = content.replace(searchStr, replaceStr);
    fs.writeFileSync(full, updated, 'utf8');
    return { success: true, message: `Patch applied to ${relPath}. Search block replaced.` };
  }
}
