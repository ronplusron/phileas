import { defineFixes } from '@drugstoresushi/phileas';
import { accept } from './accept';
import { toHongKong } from './hong-kong';
import { toFortKearney, toKholby, toLondon, toNewYork, toReformClub } from './stage-two';

/**
 * The demo's Fixes, by the name the Journey or `phileas run --fix` chooses
 * them by. `hong-kong`, the Journey's own, starts every Route's Trip on the
 * quay at Hong Kong after the book's own opening; `accept` starts it on the
 * road in London; `--fix none` has no Fix, and starts it in the Reform Club
 * with the wager not yet taken. The rest start stage two's sections near
 * their planted bugs, and `stage-two.ts` says which.
 *
 * The stage-two Fixes share one file rather than one each, since each builds
 * on the one before it and keeping them together shows that.
 */
export const fixes = defineFixes({
  'hong-kong': toHongKong,
  accept,
  kholby: toKholby,
  'fort-kearney': toFortKearney,
  'new-york': toNewYork,
  london: toLondon,
  'reform-club': toReformClub,
});
