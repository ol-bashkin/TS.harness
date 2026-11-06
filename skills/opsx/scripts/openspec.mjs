#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredVersion = '1.12.0';
const projectEntry = resolve('node_modules/@fission-ai/openspec/bin/openspec.js');
const useProjectCopy = existsSync(projectEntry);
const executable = useProjectCopy ? process.execPath : 'openspec';
const prefix = useProjectCopy ? [projectEntry] : [];
const env = { ...process.env, OPENSPEC_TELEMETRY: process.env.OPENSPEC_TELEMETRY ?? '0' };
const args = process.argv.slice(2);

const check = spawnSync(executable, [...prefix, '--version'], { encoding: 'utf8', env });
if (check.error || check.status !== 0) {
  const detail = check.error?.message ?? (check.stderr.trim() || `exit ${check.status ?? check.signal}`);
  console.error(`OPSX requires OpenSpec ${requiredVersion}. Could not run ${useProjectCopy ? 'the project copy' : 'openspec on PATH'}: ${detail}`);
  console.error(`From the target project, install @fission-ai/openspec@${requiredVersion} or use a compatible standalone CLI.`);
  process.exit(1);
}

const version = check.stdout.trim();
if (version !== requiredVersion) {
  console.error(`OPSX requires OpenSpec ${requiredVersion}. Found ${JSON.stringify(version)} ${useProjectCopy ? 'in the project' : 'on PATH'}.`);
  process.exit(1);
}

if (args.length === 1 && args[0] === '--version') {
  console.log(version);
} else {
  const result = spawnSync(executable, [...prefix, ...args], { stdio: 'inherit', env });
  if (result.error) console.error(`Could not run OpenSpec: ${result.error.message}`);
  if (result.signal) process.kill(process.pid, result.signal);
  process.exitCode = result.status ?? 1;
}
