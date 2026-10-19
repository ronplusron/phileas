import type { AppCheck } from '@drugstoresushi/phileas';
import { countMatchesList } from './inventory/count-matches-list';

/**
 * Buggy's own checks, run after the built-in ones on every Hop in this order.
 * Each is known by the `name` it declares, never by its file, so moving one
 * renames nothing. `count-matches-list` compares the inventory's heading with
 * the list beneath it.
 */
export const checks: readonly AppCheck[] = [countMatchesList];
