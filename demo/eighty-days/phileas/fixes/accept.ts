import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix of one step, copied from `phileas survey`: every Route starts on the
 * road rather than in the Reform Club.
 */
export const accept: Fix = ({ hop }) => hop('button "Accept the wager"');
