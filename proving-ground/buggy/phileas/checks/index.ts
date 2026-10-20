import type { AppCheck, AppRelation } from '@drugstoresushi/phileas';
import { countMatchesList } from './inventory/count-matches-list';
import { inventoryClearRestoresList } from './inventory/inventory-clear-restores-list';

/**
 * Buggy's own checks, run after the built-in ones on every Hop in this order.
 * Each is known by the `name` it declares, never by its file, so moving one
 * renames nothing. `count-matches-list` compares the inventory's heading with
 * the list beneath it.
 */
export const checks: readonly AppCheck[] = [countMatchesList];

/**
 * Buggy's own relations, each started by a Hop it names, with a Detour of its
 * own after it. `inventory-clear-restores-list` clears a search a Hop typed
 * and compares the list with the one before.
 */
export const relations: readonly AppRelation[] = [inventoryClearRestoresList];
