import { execFileSync } from 'node:child_process';
import os from 'node:os';

/**
 * Which operating system and architecture a Route ran on, as the journal
 * records it on the opening line, beside the build.
 *
 * Beside the build rather than inside it, because the build names the
 * application and this names the machine: the same build runs on many, and a
 * run whose Routes all ran one build should not read as several because of
 * where it ran. The one part that belongs to the application, which
 * architecture it ran as, is here as well, since what a bug report needs is
 * that beside the machine's.
 *
 * Before this a triage had to call both "not recorded", and nothing else in a
 * run says them: a folder path or an application's name is not evidence of
 * either.
 */
export interface JournaledPlatform {
  /** `macOS`, `Windows` or `Linux`, else Node's own name for the platform. */
  readonly os: string;
  /**
   * The operating system's own version, read only on macOS, from
   * `sw_vers -productVersion`. Not `os.release()`, which there is the Darwin
   * kernel's: measured on 2026-10-12, macOS 26.6.2 runs Darwin 25.6.0, and
   * the two do not map one to the other past the major version.
   */
  readonly version?: string;
  /** The operating system's build, where it has one: on macOS `sw_vers -buildVersion`. */
  readonly osBuild?: string;
  /** The kernel's release, from `os.release()`, which every platform gives. */
  readonly kernel?: string;
  /**
   * The machine's architecture, in Node's names (`arm64`, `x64`). On macOS
   * read from `sysctl hw.optional.arm64` rather than `os.machine()`, because
   * measured on 2026-10-12, a process under Rosetta is told `x86_64` by
   * `uname`, which `os.machine()` asks, on a machine that is arm64.
   */
  readonly arch?: string;
  /**
   * The architecture the application's main process ran as, from its own
   * `process.arch`. Differs from `arch` where the application ran translated,
   * which a universal or Intel-only build can.
   */
  readonly appArch?: string;
  /** Why any of the above could not be read, where any could not. */
  readonly unread?: string;
}

/** The names a person uses for the platforms the engine runs on. */
const OS_NAMES: Partial<Record<NodeJS.Platform, string>> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

/** `uname`'s names for an architecture, in Node's, so the machine's and the application's compare. */
const ARCH_NAMES: Record<string, string> = { x86_64: 'x64', amd64: 'x64', aarch64: 'arm64' };

/** One command's output, trimmed, or why it could not be had, with what it printed to stderr. */
export type Read = { value: string } | { error: string; stderr?: string };

/** Runs one command, and never throws. */
export type Exec = (command: string, args: string[]) => Read;

const run: Exec = (command, args) => {
  try {
    const value = execFileSync(command, args, { encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return value ? { value } : { error: `${command} ${args.join(' ')} printed nothing` };
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    return {
      error: `${command} ${args.join(' ')} failed: ${firstLine(error)}`,
      ...(typeof stderr === 'string' && stderr ? { stderr: stderr.trim() } : {}),
    };
  }
};

/**
 * The machine's part of the platform: everything but `appArch`.
 *
 * Never throws: whatever cannot be read is named in `unread`, and the Route
 * goes on, since where it ran is a fact about the run and not a precondition
 * for it. `exec` is a parameter only so the macOS reads can be tested anywhere.
 */
export function readMachine(platform: NodeJS.Platform = process.platform, exec: Exec = run): JournaledPlatform {
  const unread: string[] = [];
  const kernel = os.release() || undefined;
  const machine = os.machine();
  let arch: string | undefined = ARCH_NAMES[machine] ?? (machine || undefined);
  let version: string | undefined;
  let osBuild: string | undefined;

  if (platform === 'darwin') {
    const product = exec('sw_vers', ['-productVersion']);
    if ('value' in product) version = product.value;
    else unread.push(product.error);
    const build = exec('sw_vers', ['-buildVersion']);
    if ('value' in build) osBuild = build.value;
    else unread.push(build.error);
    // `1` on Apple silicon, translated or not. Absent on an Intel Mac, where
    // sysctl says "unknown oid" and `os.machine()` is right. Any other failure
    // leaves `os.machine()`'s answer, which is wrong under Rosetta, so it says
    // so rather than passing for a read.
    const arm64 = exec('sysctl', ['-n', 'hw.optional.arm64']);
    if ('value' in arm64) {
      if (arm64.value === '1') arch = 'arm64';
    } else if (!/unknown oid/.test(arm64.stderr ?? '')) {
      unread.push(`${arm64.error}, so the architecture is os.machine()'s, which names the translated one under Rosetta`);
    }
  } else {
    unread.push(`the operating system's own version is read only on macOS, where how to read it was measured`);
  }
  if (!arch) unread.push('os.machine() named no architecture');

  return {
    os: OS_NAMES[platform] ?? platform,
    ...(version ? { version } : {}),
    ...(osBuild ? { osBuild } : {}),
    ...(kernel ? { kernel } : {}),
    ...(arch ? { arch } : {}),
    ...(unread.length ? { unread: unread.join('; ') } : {}),
  };
}

let machine: JournaledPlatform | undefined;

/** The machine's part, read once per engine process, since it cannot change under one. */
export function machineOnce(): JournaledPlatform {
  machine ??= readMachine();
  return machine;
}

/**
 * The machine's part with the application's architecture added, or why that
 * could not be read. `read` asks the application's main process for its own
 * `process.arch`; a failure is recorded, never thrown.
 */
export async function withAppArch(base: JournaledPlatform, read: () => Promise<unknown>): Promise<JournaledPlatform> {
  let appArch: string | undefined;
  let why: string | undefined;
  try {
    const value = await read();
    if (typeof value === 'string' && value) appArch = value;
    else why = `the application's process.arch was not text: ${JSON.stringify(value)}`;
  } catch (error) {
    why = `the application's process.arch could not be read: ${firstLine(error)}`;
  }
  const unread = [base.unread, why].filter(Boolean).join('; ');
  return { ...base, ...(appArch ? { appArch } : {}), ...(unread ? { unread } : {}) };
}

/** The first line of an error's message, which is the part that says what went wrong. */
function firstLine(error: unknown): string {
  return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
}
