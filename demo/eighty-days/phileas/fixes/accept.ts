import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix of one step, copied from `phileas survey`: every Route starts on the
 * road rather than in the Reform Club.
 */
export const accept: Fix = ({ step }) => step({ kind: 'act', target: 'button "Accept the wager"' });
