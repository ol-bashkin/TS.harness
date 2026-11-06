import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../skills/opsx/scripts/openspec.mjs', import.meta.url));

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'ts-harness-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));

  const env = {
    ...process.env,
    OPENSPEC_TELEMETRY: '0',
    XDG_CONFIG_HOME: join(cwd, 'config'),
    XDG_DATA_HOME: join(cwd, 'data'),
  };

  function write(path, content) {
    const file = join(cwd, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  function run(args, overrides = {}) {
    const result = spawnSync(process.execPath, [runner, ...args], {
      cwd,
      env: { ...env, ...overrides },
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    return result;
  }

  function pass(...args) {
    const { status, stdout, stderr } = run(args);
    assert.equal(status, 0, `${args.join(' ')}\n${stdout}\n${stderr}`);
    return stdout;
  }

  return { cwd, write, run, pass };
}

test('reports missing OpenSpec without installing anything', t => {
  const { cwd, run } = fixture(t);
  const result = run(['--version'], { PATH: join(cwd, 'absent') });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires OpenSpec 1\.12\.0.*openspec on PATH/);
});

test('refuses an incompatible project copy even when PATH has OpenSpec', t => {
  const { write, run } = fixture(t);
  write('node_modules/@fission-ai/openspec/bin/openspec.js', `
    if (process.argv[2] !== '--version') throw new Error('must never execute');
    console.log('1.12.1');
  `);
  const result = run(['list']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Found "1\.12\.1" in the project/);
  assert.doesNotMatch(result.stderr, /must never execute/);
});

test('completes an isolated OpenSpec 1.12.0 change and archives its pause records', t => {
  const { cwd, write, pass } = fixture(t);
  const name = 'add-greeting';
  const change = `openspec/changes/${name}`;

  assert.equal(pass('--version').trim(), '1.12.0');
  pass('init', '--tools', 'none', '--no-animation', '--no-copilot-cloud');
  pass('new', 'change', name);
  const initial = JSON.parse(pass('status', '--change', name, '--json'));
  assert.equal(initial.isComplete, false);
  const proposal = JSON.parse(pass('instructions', 'proposal', '--change', name, '--json'));
  assert.equal(proposal.outputPath, 'proposal.md');

  write(`${change}/proposal.md`, `## Why

Provide a predictable greeting for the fixture.

## What Changes

Add a greeting for visitors.

## Capabilities

### New Capabilities
- \`greeting\`: A predictable greeting.

### Modified Capabilities

## Impact

A plain text fixture.
`);
  write(`${change}/design.md`, `## Context

The fixture has no greeting yet.

## Goals / Non-Goals

Provide one predictable greeting.

## Decisions

Store the greeting in a text file.

## Risks / Trade-offs

A static greeting is enough for this fixture.
`);
  write(`${change}/specs/greeting/spec.md`, `## Purpose

Define the greeting displayed to new visitors so the fixture presents a predictable first message.

## ADDED Requirements

### Requirement: Greet a visitor
The fixture SHALL show a greeting to a visitor.

#### Scenario: New visitor
- **WHEN** a visitor opens the fixture
- **THEN** the fixture shows Hello
`);
  write(`${change}/tasks.md`, '## 1. Greeting\n\n- [ ] 1.1 Add the greeting file.\n');
  write(`${change}/pause1.md`, '# Pause 1\n\nProposal ready for review.\n');
  pass('validate', name, '--strict');
  const apply = JSON.parse(pass('instructions', 'apply', '--change', name, '--json'));
  assert.deepEqual(apply.progress, { total: 1, complete: 0, remaining: 1 });

  write('greeting.txt', 'Hello\n');
  write(`${change}/tasks.md`, '## 1. Greeting\n\n- [x] 1.1 Add the greeting file.\n');
  write(`${change}/pause2.md`, '# Pause 2\n\nGreeting implemented.\n');
  write(`${change}/review.md`, '# Review\n\nFixture report for archive compatibility.\n');
  write(`${change}/pauseR.md`, '# Pause R\n\nNo findings in the fixture.\n');
  pass('validate', name, '--strict');
  pass('archive', name, '--yes');
  pass('validate', '--all', '--strict');
  assert.deepEqual(JSON.parse(pass('list', '--changes', '--json')).changes, []);

  const archiveRoot = join(cwd, 'openspec/changes/archive');
  const archives = readdirSync(archiveRoot, { withFileTypes: true }).filter(entry => entry.isDirectory());
  assert.equal(archives.length, 1);
  const archive = archives[0].name;
  assert.match(archive, /-add-greeting$/);
  for (const receipt of ['pause1.md', 'pause2.md', 'review.md', 'pauseR.md']) {
    assert.match(readFileSync(join(archiveRoot, archive, receipt), 'utf8'), /^# /);
  }
  assert.match(readFileSync(join(cwd, 'openspec/specs/greeting/spec.md'), 'utf8'), /SHALL show a greeting/);
});
