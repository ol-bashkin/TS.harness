import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const board = fileURLToPath(new URL('../skills/strategist/scripts/board.mjs', import.meta.url));
const launch = fileURLToPath(new URL('../skills/strategist/scripts/launch.mjs', import.meta.url));
const unix = { skip: process.platform === 'win32' && 'Fixture host uses an executable shebang' };

const fakeHost = `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('node:fs');
const { basename } = require('node:path');
const host = basename(process.argv[1]);
const prompt = readFileSync(0, 'utf8');
writeFileSync('worker-proof.json', JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2), prompt }));
if (host === 'codex') {
  console.log(JSON.stringify({ type: 'thread.started', thread_id: 'codex-fixture' }));
  console.log(JSON.stringify({ type: 'turn.completed' }));
} else {
  console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'claude-fixture' }));
  process.stderr.write('Fixture host denied a permission\\n' + 'x'.repeat(5000));
  console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, session_id: 'claude-fixture' }));
}
`;

function fixture(t) {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'harness-launch-')));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const cwd = join(scratch, 'coordinator');
  const worktree = join(scratch, 'change worktree');
  const bin = join(scratch, 'bin');
  mkdirSync(cwd);
  mkdirSync(bin);
  for (const host of ['codex', 'claude']) writeFileSync(join(bin, host), fakeHost, { mode: 0o700 });

  function run(executable, args, at = cwd) {
    const result = spawnSync(executable, args, { cwd: at, encoding: 'utf8', env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` } });
    assert.ifError(result.error);
    return result;
  }
  function pass(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  }
  const git = (...args) => pass(run('git', args));
  const boardCommand = (...args) => pass(run(process.execPath, [board, ...args]));
  const launchCommand = (...args) => run(process.execPath, [launch, 'owner-a', 'sample-change', ...args]);

  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=Harness Fixture', '-c', 'user.email=harness@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture', '--allow-empty');
  const base = git('rev-parse', 'HEAD');
  git('worktree', 'add', '-q', '-b', 'sample-branch', worktree);
  boardCommand('init', 'owner-a');
  boardCommand('add', 'owner-a', 'sample-change', 'status=dispatched', 'stage=propose', 'branch=sample-branch', `worktree=${worktree}`, `base=${base}`, 'receipt=openspec/changes/sample-change/pause1.md');
  writeFileSync(join(cwd, 'brief.md'), '# Approved fixture brief\n\nPreserve literal `code` and $(text).\n');

  function state() {
    return JSON.parse(boardCommand('snapshot')).changes['sample-change'];
  }
  function receipt() {
    const directory = join(cwd, '.harness', 'runs');
    const [file, ...extra] = readdirSync(directory).filter(name => name.endsWith('.json'));
    assert.match(file, /^[a-f0-9-]+\.json$/);
    assert.deepEqual(extra, []);
    return JSON.parse(readFileSync(join(directory, file), 'utf8'));
  }
  const workerProof = () => JSON.parse(readFileSync(join(worktree, 'worker-proof.json'), 'utf8'));

  return { cwd, worktree, base, git, boardCommand, launchCommand, pass, receipt, state, workerProof };
}

test('launches Codex in the registered worktree and keeps the stage reserved after exit', unix, t => {
  const { base, worktree, launchCommand, pass, receipt, state, workerProof } = fixture(t);
  const output = pass(launchCommand('codex', 'brief.md')).split('\n').map(line => JSON.parse(line));
  const run = receipt();
  const worker = workerProof();

  assert.equal(output[0].event, 'launch.started');
  assert.equal(output[1].event, 'launch.finished');
  assert.equal(worker.cwd, worktree);
  assert.deepEqual(worker.args, ['exec', '--json', '-']);
  assert.match(worker.prompt, /Stage: propose/);
  assert.match(worker.prompt, /Read the packaged stage instructions in .*opsx[\\/]SKILL\.md/);
  assert.ok(worker.prompt.includes('Preserve literal `code` and $(text).'));
  assert.equal(run.base, base);
  assert.equal(run.nativeSession, 'codex-fixture');
  assert.equal(run.hostOutcome, 'completed');
  assert.equal(run.exitCode, 0);
  assert.equal(state().status, 'dispatched');
  assert.equal(state().session, `run:${run.id}`);

  const duplicate = launchCommand('codex', 'brief.md');
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /already has a session/);
  assert.equal(receipt().id, run.id);
});

test('records Claude host failure even when its process exits zero', unix, t => {
  const { cwd, boardCommand, launchCommand, receipt, state, workerProof } = fixture(t);
  boardCommand('set', 'owner-a', 'sample-change', 'status=review', 'stage=review');
  const result = launchCommand('claude', 'brief.md');
  const run = receipt();
  const worker = workerProof();

  assert.equal(result.status, 1);
  assert.deepEqual(worker.args, ['--print', '--verbose', '--output-format', 'stream-json', '--permission-prompts', 'none']);
  assert.match(worker.prompt, /Read the packaged stage instructions in .*opsx-review[\\/]SKILL\.md/);
  assert.equal(run.state, 'failed');
  assert.equal(run.nativeSession, 'claude-fixture');
  assert.equal(run.hostOutcome, 'failed');
  assert.equal(run.exitCode, 0);
  assert.equal(state().session, `run:${run.id}`);
  assert.equal(run.stderr, `${run.id}.stderr`);
  assert.equal(run.stderrTruncated, true);
  const diagnostics = readFileSync(join(cwd, '.harness', 'runs', run.stderr));
  assert.equal(diagnostics.length, 4096);
  assert.match(diagnostics.toString(), /^Fixture host denied a permission\n/);
  assert.doesNotMatch(result.stdout + result.stderr, /denied a permission/);
});

test('refuses the coordinator tree, a branch mismatch and a frozen board before starting', unix, t => {
  const { cwd, worktree, boardCommand, launchCommand, state } = fixture(t);
  boardCommand('set', 'owner-a', 'sample-change', `worktree=${cwd}`);
  assert.match(launchCommand('codex', 'brief.md').stderr, /separate, registered worktree/);

  boardCommand('set', 'owner-a', 'sample-change', `worktree=${worktree}`, 'branch=wrong-branch');
  assert.match(launchCommand('codex', 'brief.md').stderr, /not on wrong-branch/);

  boardCommand('set', 'owner-a', 'sample-change', 'branch=sample-branch');
  boardCommand('prepare', 'owner-a', 'brief.md');
  assert.match(launchCommand('codex', 'brief.md').stderr, /Only the active strategist/);
  assert.ok(!state().session);
  assert.throws(() => readFileSync(join(worktree, 'worker-proof.json')), { code: 'ENOENT' });
});
