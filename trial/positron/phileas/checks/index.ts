import type { AppCheck } from '@drugstoresushi/phileas';
import { noErrorNotification } from './notifications/no-error-notification';

/**
 * The trial's own checks, run after the built-in ones on every Hop in this
 * order. Each is known by the `name` it declares, never by its file, so moving
 * one renames nothing. `no-error-notification` fails on a notification
 * Positron marks as an error.
 */
export const checks: readonly AppCheck[] = [noErrorNotification];
