// ClarityKit OpenCode plugin — native install without symlinks.
//   opencode.json:  { "plugin": ["claritykit@git+https://github.com/maxi3777/claritykit.git"] }
//
// Does two things (the superpowers pattern):
//   1. config hook: pushes the toolkit's skills/ directory into OpenCode's live
//      config, so all clarify-* skills are discovered — no symlinks, no config edits.
//   2. CLI self-bootstrap: best-effort symlink ~/.local/bin/clarity → tools/clarity,
//      so the `clarity` CLI the skills rely on exists. Never overwrites an existing
//      `clarity` that points elsewhere (respects manual/global installs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at <root>/.opencode/plugins/claritykit.js
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const CLI = path.join(ROOT, 'tools', 'clarity');

function bootstrapCli() {
  try {
    const binDir = path.join(os.homedir(), '.local', 'bin');
    const link = path.join(binDir, 'clarity');
    fs.mkdirSync(binDir, { recursive: true });
    fs.chmodSync(CLI, 0o755);
    if (fs.existsSync(link)) {
      // keep an existing clarity that points elsewhere (manual/global install wins)
      if (fs.realpathSync(link) === fs.realpathSync(CLI)) return;
      if (!fs.existsSync(fs.realpathSync(link))) fs.unlinkSync(link); // dangling → refresh
      else return;
    }
    fs.symlinkSync(CLI, link);
  } catch { /* best effort — `clarity doctor` surfaces the problem if this failed */ }
}

export const ClarityKitPlugin = async () => {
  bootstrapCli();
  return {
    config: async (config) => {
      config.skills ??= {};
      config.skills.paths ??= [];
      if (!config.skills.paths.includes(SKILLS)) config.skills.paths.push(SKILLS);
    },
  };
};

export default ClarityKitPlugin;
