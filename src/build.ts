import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { AppUnderTest } from './app-under-test.js';
import type { GuardVerdict } from './bundle.js';

/**
 * Which build of the application a Route ran against, as the journal records
 * it on the opening line.
 *
 * C1 asks a finding to say which build was tested, and before this the journal
 * said nothing about the application at all. On 2026-10-12 a triage of an
 * RStudio run, with nothing recorded, wrote that RStudio was built from a
 * source checkout, when the trial runs a copy of the installed release.
 *
 * Read from the bundle's own `Info.plist` at launch, so it names what was
 * launched rather than what the adapter believes it launched. **The bundle's
 * version is not always the one its makers use**, which is why `release`
 * exists: measured on 2026-10-12, Positron 2026.09.1's bundle calls itself
 * 1.130.0, the version of the editor it is built on, and only its own
 * `product.json` names the release.
 */
export interface JournaledBuild {
  /** `CFBundleDisplayName`, else `CFBundleName`. */
  readonly name?: string;
  /** `CFBundleShortVersionString`. */
  readonly version?: string;
  /** `CFBundleVersion`, where it differs from `version`. */
  readonly build?: string;
  /** `CFBundleIdentifier`. */
  readonly identifier?: string;
  /** The adapter's own name for the release, where it gives one. See `AppUnderTest.release`. */
  readonly release?: string;
  /**
   * The adapter's account of what the application runs with, such as which R,
   * by names it chose. See `AppUnderTest.runsWith`. Absent where the adapter
   * gives none, and in every journal written before 2026-10-12.
   */
  readonly runsWith?: Readonly<Record<string, string>>;
  /** Why the adapter's account could not be had, where its `runsWith` threw. */
  readonly runsWithUnread?: string;
  /**
   * Why the bundle's own name or version could not be read, where either
   * could not. Written rather than left out, since a build with no version
   * recorded would otherwise read like a journal from before versions were.
   */
  readonly unread?: string;
  /**
   * What the staleness guard did: compared this build with the sources it was
   * made from, or did not, and why. `no-sources` is the shape where the
   * engine is pointed at an installed binary (C1a). Absent only where the
   * application was not launched by the engine.
   */
  readonly sources?: { readonly compared: number } | { readonly notCompared: 'no-sources' | 'skipped-by-switch' };
}

/** The guard's verdict as the journal keeps it, without the prose. */
export function sourcesOf(guard: GuardVerdict): NonNullable<JournaledBuild['sources']> {
  return guard.ran ? { compared: guard.filesCompared } : { notCompared: guard.reason };
}

/**
 * The adapter's account of what the application runs with, as the build
 * records it: its values, or why there are none. Nothing where it gives none.
 * Values that are not strings are refused by name rather than written, since
 * a journal line has to read the same to whoever opens it later.
 */
export async function readRunsWith(
  cfg: Pick<AppUnderTest, 'runsWith'>,
  launch: Parameters<NonNullable<AppUnderTest['runsWith']>>[0]
): Promise<Pick<JournaledBuild, 'runsWith' | 'runsWithUnread'>> {
  if (!cfg.runsWith) return {};
  try {
    const values = await cfg.runsWith(launch);
    const notText = Object.entries(values).filter(([, value]) => typeof value !== 'string').map(([name]) => name);
    if (notText.length) return { runsWithUnread: `the adapter's runsWith gave values that are not text for ${notText.join(', ')}` };
    return { runsWith: { ...values } };
  } catch (error) {
    return { runsWithUnread: `the adapter's runsWith failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` };
  }
}

/** XML's five named entities and numeric references, which a plist's strings may hold. */
function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[lower] ?? whole;
  });
}

/**
 * The string values of a property list's outermost dictionary, by key.
 *
 * Only the outermost, because nested dictionaries reuse key names: a document
 * type or URL scheme carries a name of its own, and a key matched at any depth
 * could hand back one of those as the application's.
 */
export function topLevelStrings(xml: string): Map<string, string> {
  const strings = new Map<string, string>();
  let depth = 0;
  let key: string | undefined;
  // A dictionary's tags only move the depth, and an empty one, `<dict/>`, not
  // even that. Any other value after a key, such as an array, a number or
  // `<true/>`, leaves that key unpaired, so the next string is not taken for it.
  const tags = /<(\/?)dict\b[^>]*?(\/?)>|<(key|string)\b[^>]*>([\s\S]*?)<\/\3>|<(?!\/?(?:dict|key|string)\b)[a-z][^>]*>/gi;
  for (const [, closing, empty, tag, body] of xml.matchAll(tags)) {
    if (tag === 'key') {
      key = depth === 1 ? unescapeXml(body ?? '') : undefined;
      continue;
    }
    if (tag === 'string') {
      if (key !== undefined && depth === 1) strings.set(key, unescapeXml(body ?? ''));
    } else if (closing !== undefined && !empty) {
      depth += closing ? -1 : 1;
    }
    key = undefined;
  }
  return strings;
}

/**
 * Read which build a bundle is, from its `Contents/Info.plist`.
 *
 * Never throws: a build that cannot be read is recorded as unread, with why,
 * and the Route goes on, since which build ran is a fact about the run and
 * not a precondition for it. A binary property list is converted with
 * `plutil`, which is on every Mac; the applications measured so far ship XML.
 */
export function readBuild(bundleDir: string): JournaledBuild {
  const plist = path.join(bundleDir, 'Contents', 'Info.plist');
  let xml: string;
  try {
    const raw = fs.readFileSync(plist);
    xml = raw.subarray(0, 6).toString('latin1') === 'bplist'
      ? execFileSync('plutil', ['-convert', 'xml1', '-o', '-', plist], { encoding: 'utf8', timeout: 5_000 })
      : raw.toString('utf8');
  } catch (error) {
    return { unread: `Contents/Info.plist could not be read: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` };
  }

  const strings = topLevelStrings(xml);
  const name = strings.get('CFBundleDisplayName') || strings.get('CFBundleName') || undefined;
  const version = strings.get('CFBundleShortVersionString') || undefined;
  const build = strings.get('CFBundleVersion') || undefined;
  const identifier = strings.get('CFBundleIdentifier') || undefined;
  const missing = [
    ...(name ? [] : ['CFBundleDisplayName or CFBundleName']),
    ...(version ? [] : ['CFBundleShortVersionString']),
  ];
  return {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    ...(build && build !== version ? { build } : {}),
    ...(identifier ? { identifier } : {}),
    ...(missing.length ? { unread: `Contents/Info.plist names no ${missing.join(' and no ')}` } : {}),
  };
}
