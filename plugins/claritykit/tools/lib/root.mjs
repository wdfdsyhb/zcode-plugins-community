// Project root derivation — the single source of truth for "where things go".
// Rule: walk upward from cwd to the nearest directory containing `.git`;
// if none exists, fall back to cwd itself. The AI never chooses paths.
import fs from 'node:fs';
import path from 'node:path';

export function findProjectRoot(cwd = process.cwd()) {
  let dir = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(cwd); // no marker found: anchor at cwd
    dir = parent;
  }
}

// ClarityKit's staging area: always <projectRoot>/docs/clarity — never configurable.
export function clarityDir(cwd = process.cwd()) {
  return path.join(findProjectRoot(cwd), 'docs', 'clarity');
}

// Fixed handoff destination for ADRs (industry-standard location).
export function adrDir(cwd = process.cwd()) {
  return path.join(findProjectRoot(cwd), 'docs', 'adr');
}

// Next ADR number in <projectRoot>/docs/adr (ADR-001, ADR-002, ...).
export function nextAdrNumber(cwd = process.cwd()) {
  const dir = adrDir(cwd);
  let max = 0;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const m = /^ADR-(\d+)/i.exec(f);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return String(max + 1).padStart(3, '0');
}
