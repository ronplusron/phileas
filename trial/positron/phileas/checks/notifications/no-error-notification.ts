import type { AppCheck } from '@drugstoresushi/phileas';
import { notStudiedHere } from '../../release';

/**
 * The message of a notification Positron marks as an error, by the error icon
 * it draws on it. Measured on the current release on 2026-09-27 with a
 * settings file that is not valid JSON; on 2024.11 the same file raised no
 * notification, so how that release draws one is not yet measured. The
 * adapter's readiness watches for it too.
 */
export const ERROR_NOTIFICATION = '.notification-list-item:has(.codicon-error) .notification-list-item-message';

/**
 * From Positron's own marking of a notification's severity, not from a bug
 * report: docs/PLAN.md has why the trial's checks are written that way, and
 * why this is not a built-in check. Only notifications on screen count; the
 * notification list keeps old ones hidden.
 */
export const noErrorNotification: AppCheck = {
  name: 'no-error-notification',
  why:
    'Positron shows a notification marked as an error only when something it tried failed, ' +
    'so one appearing after a Hop is a failure the Hop reached.',
  async run({ page }) {
    if (notStudiedHere) return notStudiedHere;
    const said = await page.locator(ERROR_NOTIFICATION).visible().allTextContents();
    return said.map((text) => `error notification: ${text.trim()}`);
  },
};
