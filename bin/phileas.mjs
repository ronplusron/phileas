#!/usr/bin/env node
// The phileas command: run a Journey with its settings changed for one run.
//
//   phileas run [config] [flags] [-- extra Playwright arguments]
//
// Real flags need a command of their own, because Playwright refuses any it
// does not know (`playwright test --routes 5`: unknown option). So this checks
// the flags, hands each value to the run as an environment variable, which is
// the only channel that reaches Playwright's workers, and starts Playwright
// itself. docs/HISTORY.md has the reasoning.
//
// Plain JavaScript on purpose. The engine is TypeScript imported without file
// extensions, which Node cannot load on its own, so this imports none of it.
// It checks only that each flag is known and has a value. Whether the value is
// good is checked by the engine, in defineJourney and startJourney, before
// anything launches, so the rules live in one place.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FLAGS = {
  '--seed': 'PHILEAS_SEED',
  '--routes': 'PHILEAS_ROUTES',
  '--trip-length': 'PHILEAS_TRIP_LENGTH',
  '--route-deadline-ms': 'PHILEAS_ROUTE_DEADLINE_MS',
  '--journey-deadline-ms': 'PHILEAS_JOURNEY_DEADLINE_MS',
  '--show': 'PHILEAS_SHOW',
  '--hop-delay-ms': 'PHILEAS_HOP_DELAY_MS',
};

// The folder every consuming repository keeps its Journey in, so that
// `phileas run --routes 3` needs no path there.
const DEFAULT_CONFIG = 'phileas';

const USAGE = `Usage: phileas run [config] [flags] [-- extra Playwright arguments]

  config    A Playwright config file, or a folder holding playwright.config.ts.
            Defaults to ${DEFAULT_CONFIG}/.

Each flag overrides the Journey for this run only; the Journey file is not edited.
A bad value is refused by the name of the variable it travels in, shown here.
${Object.entries(FLAGS)
  .map(([flag, variable]) => `  ${`${flag} <value>`.padEnd(32)}${variable}`)
  .join('\n')}

Anything after -- is handed to Playwright, such as -- --grep "route 0$".`;

function refuse(message) {
  console.error(`phileas: ${message}\n\n${USAGE}`);
  process.exit(2);
}

/** The command line, read into a config path, the settings and Playwright's own arguments. */
export function parse(args) {
  const [command, ...rest] = args;
  if (command === '--help' || command === '-h') return { help: true };
  if (command !== 'run') {
    throw new Error(command ? `unknown command ${command}; the only one is run` : 'no command given');
  }

  const separator = rest.indexOf('--');
  const own = separator === -1 ? rest : rest.slice(0, separator);
  const passThrough = separator === -1 ? [] : rest.slice(separator + 1);

  let config;
  const settings = {};
  for (let i = 0; i < own.length; i += 1) {
    const arg = own[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (!arg.startsWith('-')) {
      if (config !== undefined) throw new Error(`a second config was given, ${arg}; give one`);
      config = arg;
      continue;
    }
    const [flag, inline] = arg.split(/=(.*)/s);
    const variable = FLAGS[flag];
    if (!variable) throw new Error(`unknown flag ${flag}`);
    if (variable in settings) throw new Error(`${flag} was given twice`);
    const value = inline ?? own[i + 1];
    if (inline === undefined) i += 1;
    if (value === undefined || value === '' || value.startsWith('--')) {
      throw new Error(`${flag} needs a value`);
    }
    settings[variable] = value;
  }

  return { config: config ?? DEFAULT_CONFIG, settings, passThrough };
}

/** Playwright's command-line entry, found from where the config lives, as the consumer installed it. */
function playwrightCli(configPath) {
  const from = fs.statSync(configPath).isDirectory() ? configPath : path.dirname(configPath);
  const require = createRequire(path.join(path.resolve(from), 'resolve-from-here.js'));
  return path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
}

function main() {
  let parsed;
  try {
    parsed = parse(process.argv.slice(2));
  } catch (error) {
    refuse(error.message);
  }
  if (parsed.help) {
    console.log(USAGE);
    return;
  }

  const { config, settings, passThrough } = parsed;
  if (!fs.existsSync(config)) {
    refuse(
      config === DEFAULT_CONFIG
        ? `there is no ${DEFAULT_CONFIG}/ folder here; give the Playwright config to run`
        : `${config} does not exist`
    );
  }

  let cli;
  try {
    cli = playwrightCli(config);
  } catch {
    refuse(`@playwright/test is not installed where ${config} can reach it`);
  }

  const child = spawn(process.execPath, [cli, 'test', '-c', config, ...passThrough], {
    stdio: 'inherit',
    env: { ...process.env, ...settings },
  });
  // Ctrl-C reaches the whole process group, so Playwright stops on its own;
  // this only has to report how it ended.
  const waitForPlaywright = () => {};
  process.on('SIGINT', waitForPlaywright);
  child.on('close', (code, signal) => {
    process.off('SIGINT', waitForPlaywright);
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

// Run only when invoked, not when a test imports parse. Compared as file
// paths rather than URLs, since a URL percent-encodes the spaces this
// repository's own path contains, and through realpath, since npm installs the
// command as a link.
const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
if (invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main();
