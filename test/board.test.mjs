import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../skills/strategist/scripts/board.mjs', import.meta.url));

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'ts-harness-board-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Initial commit', '--allow-empty');

  function call(...args) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
  }

  function pass(...args) {
    const { status, stdout, stderr } = call(...args);
    assert.equal(status, 0, `${args.join(' ')}\n${stderr}`);
    return stdout.trim();
  }

  function fail(pattern, ...args) {
    const { status, stderr } = call(...args);
    assert.equal(status, 1);
    assert.match(stderr, pattern);
  }

  pass('init', 'old-session');
  return { cwd, pass, fail, snapshot: () => JSON.parse(pass('snapshot')) };
}

test('a stage reservation records a session once and preserves other board fields', t => {
  const { pass, fail, snapshot } = fixture(t);
  pass('add', 'old-session', 'small-change', 'branch=codex/small-change', 'status=dispatched', 'stage=propose');
  fail(/not awaiting/, 'claim', 'old-session', 'small-change', 'apply', 'run:invalid');
  pass('claim', 'old-session', 'small-change', 'propose', 'run:first');
  fail(/not awaiting/, 'claim', 'old-session', 'small-change', 'propose', 'run:duplicate');
  assert.deepEqual(snapshot().changes['small-change'], {
    branch: 'codex/small-change', status: 'dispatched', stage: 'propose', session: 'run:first',
  });
  pass('set', 'old-session', 'small-change', 'status=pause1', 'session=');
  fail(/not awaiting/, 'claim', 'old-session', 'small-change', 'propose', 'run:at-pause');
});

test('only a registered successor can resume the frozen board from the verified handover', t => {
  const { cwd, pass, fail, snapshot } = fixture(t);
  const handover = join(cwd, 'HANDOVER.md');
  writeFileSync(join(cwd, 'notes.md'), 'Next: review the scope before apply.\n');
  pass('add', 'old-session', 'small-change', 'status=pause1', 'receipt=openspec/changes/small-change/pause1.md');
  pass('decision', 'old-session', 'small-change', 'Owner is reviewing the plan.');

  const digest = pass('prepare', 'old-session', 'notes.md');
  const body = readFileSync(handover);
  const restore = JSON.parse(pass('restore'));
  assert.equal(restore.digest, digest);
  assert.match(restore.notes, /Next: review the scope/);
  assert.match(restore.notes, /small-change/);
  assert.match(restore.worktrees, /worktree /);
  assert.equal(restore.board.active, 'old-session');
  fail(/unfrozen/, 'set', 'old-session', 'small-change', 'status=applying');
  fail(/Register this successor/, 'activate', 'new-session', digest);
  fail(/distinct successor/, 'register', 'old-session', digest);
  fail(/digest does not match/, 'register', 'new-session', 'stale-digest');
  pass('register', 'new-session', digest);
  fail(/different successor/, 'register', 'other-session', digest);
  fail(/unfrozen/, 'set', 'new-session', 'small-change', 'status=applying');
  fail(/Only the predecessor/, 'unregister', 'other-session', 'new-session', digest);
  pass('unregister', 'old-session', 'new-session', digest);
  fail(/Register this successor/, 'activate', 'new-session', digest);
  pass('register', 'replacement-session', digest);

  writeFileSync(handover, 'Changed after registration.\n');
  fail(/changed after preparation/, 'activate', 'replacement-session', digest);
  writeFileSync(handover, body);
  pass('activate', 'replacement-session', digest);
  fail(/unfrozen/, 'set', 'old-session', 'small-change', 'status=applying');
  assert.equal(snapshot().active, 'replacement-session');
  assert.equal(snapshot().changes['small-change'].status, 'pause1');
  assert.equal(snapshot().decisions.length, 1);
  pass('set', 'replacement-session', 'small-change', 'status=applying');
  assert.equal(snapshot().changes['small-change'].status, 'applying');

  pass('prepare', 'replacement-session', 'notes.md');
  const history = join(cwd, '.harness', 'handoffs');
  assert.deepEqual(readdirSync(history), [`${digest}.md`]);
  assert.deepEqual(readFileSync(join(history, `${digest}.md`)), body);
});
