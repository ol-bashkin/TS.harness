import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

const fields = ['status', 'branch', 'base', 'worktree', 'stage', 'session', 'receipt', 'pr', 'next'];
const statuses = new Set(['pending', 'brief', 'dispatched', 'pause1', 'applying', 'pause2', 'review', 'pauseR', 'fixing', 'ready', 'merged', 'waiting-owner', 'escalated', 'blocked']);
const stages = new Set(['explore', 'propose', 'update', 'apply', 'review', 'fix', 'verify', 'sync', 'archive', 'diagnose', 'critique']);
const dispatchStatuses = new Set(['dispatched', 'applying', 'review', 'fixing']);
const [command, ...args] = process.argv.slice(2);

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function identity(value) {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value), 'Expected a stable session ID.');
  return value;
}

function changeId(value) {
  requireThat(typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), 'Expected a kebab-case change ID.');
  return value;
}

function singleLine(value, max) {
  requireThat(typeof value === 'string' && !/[\u0000-\u001f\u007f]/.test(value) && value.length <= max, `Expected one line up to ${max} characters.`);
  return value;
}

function record(state, id) {
  requireThat(Object.hasOwn(state.changes, changeId(id)), `Unknown change ${id}.`);
  return state.changes[id];
}

function parseFields(values) {
  const entries = values.map(pair => {
    const at = pair.indexOf('=');
    const key = pair.slice(0, at);
    requireThat(at > 0 && fields.includes(key), `Unknown board field in ${pair}.`);
    const value = singleLine(pair.slice(at + 1), key === 'worktree' || key === 'receipt' ? 1024 : 200);
    if (key === 'status') requireThat(statuses.has(value), `Unknown status ${value}.`);
    if (key === 'stage' && value) requireThat(stages.has(value), `Unknown stage ${value}.`);
    return [key, value];
  });
  requireThat(new Set(entries.map(([key]) => key)).size === entries.length, 'A board field was repeated.');
  return Object.fromEntries(entries);
}

function table(rows) {
  const cell = value => String(value || '—').replaceAll('|', '\\|');
  const line = values => `| ${values.map(cell).join(' | ')} |`;
  return [line(['Change', ...fields]), line(fields.concat('Change').map(() => '---')), ...rows.map(([id, row]) => line([id, ...fields.map(key => row[key])]))].join('\n');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function boardFingerprint({ handoff, ...state }) {
  return hash(JSON.stringify(state));
}

function repository() {
  const root = realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  requireThat(realpathSync(process.cwd()) === root, 'Run the board from the coordinator Git repository root.');
  return root;
}

function inspectPath(path, type, optional = false) {
  const item = lstatSync(path, { throwIfNoEntry: false });
  requireThat((!item && optional) || (type === 'directory' ? item?.isDirectory() : item?.isFile()), `Expected a regular ${type} at ${path}.`);
  return Boolean(item);
}

function atomicWrite(path, contents) {
  inspectPath(path, 'file', true);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function verifiedHandover(state, file, digest) {
  requireThat(state.handoff, 'There is no prepared handover.');
  requireThat(digest === state.handoff.digest, 'Handover digest does not match the board.');
  requireThat(boardFingerprint(state) === state.handoff.board, 'The board changed after the handover was prepared.');
  inspectPath(file, 'file');
  const body = readFileSync(file);
  requireThat(hash(body) === digest, 'HANDOVER.md changed after preparation.');
  return body.toString('utf8');
}

function run() {
  if (!command || command === '--help') {
    console.log('board init <actor> | show [change] | snapshot | add/set <actor> <change> field=value… | decision <actor> <change> <text> | claim <actor> <change> <stage> <session> [row-digest] | prepare <actor> <notes-file> | restore | register <successor> <digest> | unregister <predecessor> <successor> <digest> | activate <successor> <digest>');
    return;
  }

  const root = repository();
  const directory = join(root, '.harness');
  const board = join(directory, 'board.json');
  const handover = join(root, 'HANDOVER.md');
  if (command === 'init' && !inspectPath(directory, 'directory', true)) mkdirSync(directory);
  inspectPath(directory, 'directory');

  function load() {
    inspectPath(board, 'file');
    const state = JSON.parse(readFileSync(board, 'utf8'));
    requireThat(state.version === 1 && state.changes && Array.isArray(state.decisions), 'Unsupported board format.');
    identity(state.active);
    return state;
  }

  if (command === 'snapshot' || command === 'show' || command === 'restore') {
    requireThat(args.length <= (command === 'show' ? 1 : 0), 'Unexpected board arguments.');
    const state = load();
    if (command === 'snapshot') console.log(JSON.stringify(state, null, 2));
    if (command === 'show') {
      console.log(`# Change board\n\nActive strategist: ${state.active}\nHandover: ${state.handoff ? 'frozen' : 'none'}\n\n${table(args.length ? [[args[0], record(state, args[0])]] : Object.entries(state.changes))}`);
    }
    if (command === 'restore') {
      const digest = state.handoff?.digest ?? null;
      const notes = digest ? verifiedHandover(state, handover, digest) : inspectPath(handover, 'file', true) ? readFileSync(handover, 'utf8') : null;
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const worktrees = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' }).trim();
      console.log(JSON.stringify({ digest, notes, head, worktrees, board: state }, null, 2));
    }
    return;
  }

  const lock = join(directory, 'board.lock');
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Board is locked. Check for an active writer before recovering the lock.');
    throw error;
  }

  try {
    if (command === 'init') {
      requireThat(args.length === 1, 'Use init <actor>.');
      requireThat(!existsSync(board), 'Board already initialized.');
      atomicWrite(board, `${JSON.stringify({ version: 1, active: identity(args[0]), handoff: null, changes: {}, decisions: [] }, null, 2)}\n`);
      return;
    }

    const state = load();
    const actor = identity(args[0]);
    if (command === 'unregister') {
      requireThat(args.length === 3, 'Use unregister <predecessor> <successor> <digest>.');
      verifiedHandover(state, handover, args[2]);
      requireThat(actor === state.active && identity(args[1]) === state.handoff.successor, 'Only the predecessor can clear the registered successor.');
      state.handoff.successor = null;
    } else if (command === 'register' || command === 'activate') {
      requireThat(args.length === 2, `Use ${command} <successor> <digest>.`);
      verifiedHandover(state, handover, args[1]);
      requireThat(actor !== state.active, 'A handover requires a distinct successor.');
      if (command === 'register') {
        requireThat(!state.handoff.successor || state.handoff.successor === actor, 'A different successor is already registered.');
        state.handoff.successor = actor;
      } else {
        requireThat(state.handoff.successor === actor, 'Register this successor before activation.');
        state.active = actor;
        state.handoff = null;
      }
    } else {
      requireThat(actor === state.active && !state.handoff, 'Only the active strategist can write an unfrozen board.');
      if (command === 'add' || command === 'set') {
        const id = changeId(args[1]);
        const patch = parseFields(args.slice(2));
        if (command === 'add') {
          requireThat(!Object.hasOwn(state.changes, id), `Change ${id} already exists.`);
          state.changes[id] = { status: 'pending', ...patch };
        } else {
          requireThat(args.length >= 3, 'Provide at least one field to set.');
          Object.assign(record(state, id), patch);
        }
      } else if (command === 'decision') {
        requireThat(args.length === 3 && singleLine(args[2], 500).trim(), 'Use decision <actor> <change> <text>.');
        record(state, args[1]);
        state.decisions.push({ actor, change: args[1], text: args[2], at: new Date().toISOString() });
      } else if (command === 'claim') {
        requireThat(args.length === 4 || args.length === 5, 'Use claim <actor> <change> <stage> <session> [row-digest].');
        const row = record(state, args[1]);
        requireThat(dispatchStatuses.has(row.status) && row.stage === args[2] && stages.has(row.stage) && !row.session, 'The change is not awaiting a launch for this stage.');
        requireThat(args.length === 4 || hash(JSON.stringify(row)) === args[4], 'The board row changed while launch was being prepared.');
        row.session = identity(args[3]);
      } else if (command === 'prepare') {
        requireThat(args.length === 2, 'Use prepare <actor> <notes-file>.');
        const source = realpathSync(args[1]);
        const location = relative(root, source);
        requireThat(location && !isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`) && source !== handover, 'Use a notes file inside this repository, separate from HANDOVER.md.');
        inspectPath(source, 'file');
        requireThat(lstatSync(source).size <= 12288, 'Keep handover notes within 12 KiB.');
        const notes = readFileSync(source, 'utf8').trim();
        requireThat(notes.length, 'Handover notes must describe the next step.');
        if (inspectPath(handover, 'file', true)) {
          const previous = readFileSync(handover);
          const history = join(directory, 'handoffs');
          if (!inspectPath(history, 'directory', true)) mkdirSync(history);
          atomicWrite(join(history, `${hash(previous)}.md`), previous);
        }
        const rows = Object.entries(state.changes).filter(([, row]) => row.status !== 'merged');
        const body = `# HANDOVER\n\nPrepared by ${actor} at ${new Date().toISOString()}.\n\n${notes}\n\n## Open changes\n\n${table(rows)}\n`;
        state.handoff = { digest: hash(body), board: boardFingerprint(state), successor: null };
        atomicWrite(handover, body);
      } else {
        throw new Error(`Unknown board command ${command}.`);
      }
    }
    atomicWrite(board, `${JSON.stringify(state, null, 2)}\n`);
    if (command === 'prepare') console.log(state.handoff.digest);
  } finally {
    rmdirSync(lock);
  }
}

try {
  run();
} catch (error) {
  console.error(`board: ${error.message}`);
  process.exitCode = 1;
}
