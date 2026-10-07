#!/usr/bin/env node
// server.mjs <start|stop|status> — manage the per-project ClarityKit preview server.
//
// The server root is NEVER caller-supplied: it is always the staging dir
// (<projectRoot>/docs/clarity) derived from the current cwd (nearest .git upward).
// The AI cannot point the server at the wrong directory because it passes no directory.
//
// Lifecycle is deterministic, not agent-improvised:
//   start  — rebuilds the site, spawns preview server DETACHED (survives the caller's
//            process-group kill), picks a free port derived from the project root,
//            verifies HTTP 200, and records {root, port, pid} in the registry.
//   stop   — kills the recorded pid, verifies the port is freed, removes the entry.
//   status — lists registry entries with liveness (process + HTTP check).
//
// Registry: ~/.claritykit/servers.json — one server per project staging dir.
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clarityDir } from './lib/root.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PREVIEW = path.join(here, 'preview.mjs');
const REGISTRY = path.join(process.env.HOME, '.claritykit', 'servers.json');

const [cmd] = process.argv.slice(2);
// 'serve' is an internal subcommand that receives the root positionally.
const root = cmd === 'serve' ? path.resolve(process.argv[3]) : clarityDir();

// Hidden subcommand: the actual blocking server process, spawned detached by `start`.
if (cmd === 'serve') {
  const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
  const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
  const INDEX_NAME = 'index.html';
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let p = path.join(root, urlPath === '/' ? INDEX_NAME : urlPath);
    if (!path.resolve(p).startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, INDEX_NAME);
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' });
      res.end(data);
    });
  });
  server.listen(port, () => {
    console.log(`open in your browser: http://localhost:${port}/`);
  });
} else if (!['start', 'stop', 'status'].includes(cmd ?? '')) {
  console.error('usage: node server.mjs <start|stop|status>   (root is derived, never passed)');
  process.exit(2);
}

const loadRegistry = () => {
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); }
  catch { return {}; }
};
const saveRegistry = (reg) => {
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true });
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
};

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

const httpOk = (port) => new Promise((resolve) => {
  const req = http.get(`http://localhost:${port}/`, (res) => {
    res.resume();
    resolve(res.statusCode === 200);
  });
  req.on('error', () => resolve(false));
  req.setTimeout(1500, () => { req.destroy(); resolve(false); });
});

const portFree = (port) => new Promise((resolve) => {
  const srv = net.createServer();
  srv.once('error', () => resolve(false));
  srv.once('listening', () => srv.close(() => resolve(true)));
  srv.listen(port);
});

function hashPort(rootPath) {
  let h = 0;
  for (const ch of rootPath) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 8400 + (h % 400); // 8400–8799
}

async function pickPort(rootPath) {
  let p = hashPort(rootPath);
  for (let i = 0; i < 50; i++, p++) {
    if (await portFree(p)) return p;
  }
  throw new Error('no free port in range');
}

function rebuildSite() {
  execFileSync(process.execPath, [PREVIEW, root], { stdio: 'inherit' });
}

async function start() {
  fs.mkdirSync(root, { recursive: true }); // staging dir may not exist yet
  const reg = loadRegistry();
  const existing = reg[root];
  if (existing && alive(existing.pid) && await httpOk(existing.port)) {
    rebuildSite();
    console.log(`already running: http://localhost:${existing.port}/  (pid ${existing.pid}, site rebuilt)`);
    return;
  }
  if (existing) { // stale entry
    if (alive(existing.pid)) { try { process.kill(existing.pid, 'SIGTERM'); } catch {} }
    delete reg[root];
  }

  rebuildSite();
  const port = await pickPort(root);
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true });
  const logFile = path.join(process.env.HOME, '.claritykit', `preview-${port}.log`);
  const logFd = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', root, '--port', String(port)], {
    detached: true,           // new process group / session — survives caller termination
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  fs.closeSync(logFd);

  // wait for the server to actually answer (preview.mjs may bump the port on race;
  // read the real port back from its log)
  let realPort = port;
  const deadline = Date.now() + 8000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const m = fs.readFileSync(logFile, 'utf8').match(/localhost:(\d+)/);
      if (m) realPort = Number(m[1]);
    } catch {}
    if (await httpOk(realPort)) { ok = true; break; }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ok) {
    try { process.kill(child.pid, 'SIGTERM'); } catch {}
    console.error(`failed to start: server did not answer on http://localhost:${realPort}/ — see ${logFile}`);
    process.exit(1);
  }
  reg[root] = { port: realPort, pid: child.pid, startedAt: new Date().toISOString() };
  saveRegistry(reg);
  console.log(`serving ${root}`);
  console.log(`open in your browser: http://localhost:${realPort}/`);
  console.log(`(pid ${child.pid}, detached; log: ${logFile})`);
}

async function stop() {
  const reg = loadRegistry();
  const entry = reg[root];
  if (!entry) {
    console.log(`no server registered for ${root}`);
    return;
  }
  if (alive(entry.pid)) {
    process.kill(entry.pid, 'SIGTERM');
    // a detached server: negative pid kills the whole group if needed
    await new Promise((r) => setTimeout(r, 500));
    if (alive(entry.pid)) process.kill(entry.pid, 'SIGKILL');
  }
  delete reg[root];
  saveRegistry(reg);
  const free = await portFree(entry.port);
  console.log(free
    ? `stopped (port ${entry.port} free)`
    : `stopped process ${entry.pid}, but port ${entry.port} is still in use by something else — check: ss -tlnp | grep ${entry.port}`);
}

async function status() {
  const reg = loadRegistry();
  const entries = Object.entries(reg);
  if (!entries.length) {
    console.log('no servers registered');
    return;
  }
  let pruned = false;
  for (const [r, e] of entries) {
    const procAlive = alive(e.pid);
    const serving = procAlive && (await httpOk(e.port));
    if (!procAlive) { delete reg[r]; pruned = true; continue; } // dead pid: entry is useless
    console.log(`${serving ? 'UP  ' : 'SICK'}  http://localhost:${e.port}/  pid ${e.pid}  ${r}`);
  }
  if (pruned) saveRegistry(reg);
}

if (cmd === 'start' || cmd === 'stop' || cmd === 'status') {
  await { start, stop, status }[cmd]();
} // 'serve' blocks above and never reaches here
