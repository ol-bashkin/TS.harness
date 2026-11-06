#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const board = fileURLToPath(new URL('./board.mjs', import.meta.url));
const workflowStages = new Set(['explore', 'propose', 'update', 'apply', 'fix', 'sync', 'archive']);
const supportStages = new Set(['review', 'verify', 'diagnose', 'critique']);
const hostArgs = {
  codex: ['exec', '--json', '-'],
  claude: ['--print', '--verbose', '--output-format', 'stream-json', '--permission-prompts', 'none'],
};
const env = { ...process.env };
for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) {
  delete env[variable];
}

function git(directory, ...args) {
  return execFileSync('git', ['-C', directory, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\r?\n$/, '');
}

function within(root, path) {
  const fromRoot = relative(root, path);
  return fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
}

function executorPrompt(change, row, worktree, head, tree, text) {
  const skill = row.stage === 'review' ? 'opsx-review' : 'opsx';
  const skillPath = fileURLToPath(new URL(`../../${skill}/SKILL.md`, import.meta.url));
  const lines = [
    'Execute the single stage authorized in the brief below. Stop at its receipt.',
    `Change: ${change}`,
    `Stage: ${row.stage}`,
    `Worktree: ${worktree}`,
    `Branch: ${row.branch}`,
    `Base: ${row.base || 'Unknown'}`,
    `Starting head: ${head}`,
    `Starting tree: ${tree}`,
    `Expected receipt: ${row.receipt || 'Follow the stage instructions'}`,
  ];
  if (workflowStages.has(row.stage) || row.stage === 'review') {
    lines.push(`Read the packaged stage instructions in ${skillPath}.`);
  }
  lines.push('Keep the coordinator board and HANDOVER.md outside the worker’s writes. Follow the target repository rules.', '', text);
  return lines.join('\n');
}

function writeReceipt(path, receipt) {
  const temp = `${path}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    renameSync(temp, path);
  } catch (error) {
    if (error.code !== 'EEXIST') rmSync(temp, { force: true });
    throw error;
  }
}

function hostSession(host, event) {
  if (host === 'codex' && event.type === 'thread.started') return event.thread_id;
  if (host === 'claude' && (event.type === 'result' || (event.type === 'system' && event.subtype === 'init'))) {
    return event.session_id;
  }
}

async function runHost(host, worktree, prompt, receipt, path, save) {
  const child = spawn(host, hostArgs[host], { cwd: worktree, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let spawnError;
  let receiptError;
  let requestedSignal;
  const stderrLimit = 4_096;
  const stderr = [];
  let stderrBytes = 0;
  let stderrKept = 0;
  const interrupt = () => { requestedSignal = 'SIGINT'; child.kill('SIGINT'); };
  const terminate = () => { requestedSignal = 'SIGTERM'; child.kill('SIGTERM'); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  child.once('error', error => { spawnError = error.code ?? 'UNKNOWN'; });
  child.stdin.on('error', () => {});
  child.stderr.on('data', chunk => {
    stderrBytes += chunk.length;
    const kept = chunk.subarray(0, stderrLimit - stderrKept);
    if (kept.length) {
      stderr.push(kept);
      stderrKept += kept.length;
    }
  });
  child.stdin.end(prompt);

  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (!event || typeof event !== 'object') return;
    const nativeSession = hostSession(host, event);
    if (!receipt.nativeSession && typeof nativeSession === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(nativeSession)) {
      receipt.nativeSession = nativeSession;
      try {
        save();
      } catch (error) {
        receiptError = error;
      }
    }
    if (host === 'codex' && event.type === 'turn.completed') receipt.hostOutcome = 'completed';
    if (host === 'codex' && event.type === 'turn.failed') receipt.hostOutcome = 'failed';
    if (host === 'claude' && event.type === 'result') {
      receipt.hostOutcome = event.is_error || event.subtype !== 'success' ? 'failed' : 'completed';
    }
  });

  const { code, signal } = await new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', terminate);
  receipt.exitCode = code;
  receipt.signal = signal ?? requestedSignal ?? null;
  receipt.finishedAt = new Date().toISOString();
  const failed = spawnError || code !== 0 || receipt.hostOutcome === 'failed';
  receipt.state = failed ? 'failed' : 'finished';
  if (receipt.signal) receipt.state = 'interrupted';
  if (spawnError) receipt.spawnError = spawnError;
  if (receipt.state !== 'finished' && stderrKept) {
    const diagnostics = join(dirname(path), `${receipt.id}.stderr`);
    try {
      writeFileSync(diagnostics, Buffer.concat(stderr, stderrKept), { flag: 'wx', mode: 0o600 });
      receipt.stderr = basename(diagnostics);
      receipt.stderrTruncated = stderrKept < stderrBytes;
    } catch (error) {
      receipt.stderrError = error.code ?? 'UNKNOWN';
    }
  }
  save();
  if (receiptError) throw receiptError;
  return receipt;
}

async function main([actor, change, host, promptFile, ...extra]) {
  if (!actor || !change || !Object.hasOwn(hostArgs, host) || !promptFile || extra.length) {
    throw new Error('Usage: node launch.mjs <actor> <change> <codex|claude> <prompt-file>');
  }
  const root = realpathSync(process.cwd());
  if (realpathSync(git(root, 'rev-parse', '--show-toplevel')) !== root) {
    throw new Error('Run launch.mjs from the coordinator Git worktree root.');
  }
  const boardCommand = (...args) => execFileSync(process.execPath, [board, ...args], { cwd: root, env, encoding: 'utf8' });
  const state = JSON.parse(boardCommand('snapshot'));
  if (state.version !== 1 || state.active !== actor || state.handoff !== null) {
    throw new Error('Only the active strategist may launch a stage while the board is available.');
  }
  if (!Object.hasOwn(state.changes, change)) throw new Error(`Change ${change} is missing from the board.`);
  const row = state.changes[change];
  if (!workflowStages.has(row.stage) && !supportStages.has(row.stage)) throw new Error(`Unsupported stage for ${change}.`);
  if (row.session) throw new Error(`Stage ${change}/${row.stage} already has a session. Reconcile it before retrying.`);
  if (!row.worktree || !row.branch) throw new Error(`Register the change worktree and branch for ${change}.`);

  const worktree = realpathSync(resolve(root, row.worktree));
  const gitCommon = directory => realpathSync(git(directory, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
  if (worktree === root || realpathSync(git(worktree, 'rev-parse', '--show-toplevel')) !== worktree || gitCommon(root) !== gitCommon(worktree)) {
    throw new Error('The change worktree must be a separate, registered worktree of the coordinator repository.');
  }
  if (git(worktree, 'symbolic-ref', '--short', 'HEAD') !== row.branch) throw new Error(`Registered worktree is not on ${row.branch}.`);
  if (row.base) {
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(row.base)) throw new Error('Base must be a full Git commit ID.');
    try {
      git(worktree, 'merge-base', '--is-ancestor', row.base, 'HEAD');
    } catch {
      throw new Error('The registered base is not an ancestor of the worker HEAD.');
    }
  }
  const head = git(worktree, 'rev-parse', 'HEAD');
  const tree = git(worktree, 'rev-parse', 'HEAD^{tree}');

  const resolvedPrompt = realpathSync(resolve(root, promptFile));
  const promptInfo = statSync(resolvedPrompt);
  if (!(within(root, resolvedPrompt) || within(worktree, resolvedPrompt)) || !promptInfo.isFile() || promptInfo.size > 65_536) {
    throw new Error('Use a prompt file of at most 64 KiB inside the coordinator or change worktree.');
  }
  const text = readFileSync(resolvedPrompt, 'utf8').trim();
  if (!text) throw new Error('The authorized stage prompt is empty.');
  const prompt = executorPrompt(change, row, worktree, head, tree, text);

  const id = randomUUID();
  const receipts = join(root, '.harness', 'runs');
  mkdirSync(receipts, { recursive: true, mode: 0o700 });
  if (realpathSync(receipts) !== receipts) throw new Error('Run receipts must be stored inside the coordinator worktree.');
  const path = join(receipts, `${id}.json`);
  const rowDigest = createHash('sha256').update(JSON.stringify(row)).digest('hex');
  const receipt = {
    id, actor, change, stage: row.stage, host, worktree, branch: row.branch, base: row.base || null, head, tree,
    state: 'prepared', startedAt: new Date().toISOString(), nativeSession: null, hostOutcome: 'unknown',
  };
  const save = () => writeReceipt(path, receipt);
  save();
  try {
    boardCommand('claim', actor, change, row.stage, `run:${id}`, rowDigest);
  } catch (error) {
    rmSync(path, { force: true });
    throw error;
  }
  receipt.state = 'running';
  save();
  console.log(JSON.stringify({ event: 'launch.started', id, receipt: relative(root, path) }));
  const result = await runHost(host, worktree, prompt, receipt, path, save);
  console.log(JSON.stringify({ event: 'launch.finished', id, state: result.state, nativeSession: result.nativeSession, hostOutcome: result.hostOutcome, exitCode: result.exitCode }));
  process.exitCode = result.state === 'finished' ? 0 : result.exitCode || 1;
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(`launch: ${error.message}`);
  process.exitCode = 1;
}
