import type { ElectronApplication } from '@playwright/test';

const RECORDER = '__phileasNativeDialogs';

/** One native dialog the application asked for, and how it was answered. */
export interface NativeDialogCall {
  /** Which of Electron's dialog functions was called, such as `showOpenDialog`. */
  readonly kind: string;
  /** Its title or message, where it gave one. */
  readonly text?: string;
}

/**
 * Replace Electron's native dialogs in the main process with a recorder that
 * answers each one as cancelled.
 *
 * A native dialog is drawn by the operating system, not in the page. With
 * windows hidden it still appears on the screen of whoever is running the
 * Journey, which breaks C5, and a Route can neither see it nor record what it
 * did: measured on Positron on 2026-09-27, where the native menu's File >
 * Open entries reached one although the application was set to draw its file
 * dialogs in the page. So every one is answered as Escape would answer it,
 * and recorded.
 *
 * **It reaches an application only if that application looks the functions up
 * on the module object at call time,** the same limit `external.ts` states for
 * `shell.openExternal`. One that captured a function at startup keeps
 * Electron's own, and the recorder stays empty.
 *
 * Installed on every launch, beside the outbound-link stub.
 */
export async function stubNativeDialogs(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ dialog }, key) => {
    const calls: { kind: string; text?: string }[] = [];
    (globalThis as Record<string, unknown>)[key] = calls;

    // The options are the last argument: a window may come first.
    type Options = { title?: string; message?: string; buttons?: string[]; cancelId?: number };
    const options = (args: unknown[]): Options => {
      const last = args[args.length - 1];
      return last && typeof last === 'object' ? (last as Options) : {};
    };
    const record = (kind: string, args: unknown[]) => {
      const { title, message } = options(args);
      const text = title ?? message;
      calls.push(text ? { kind, text } : { kind });
    };
    // Electron's own rule for a message box's cancel: `cancelId` if given,
    // else the first button labeled Cancel or No, else 0.
    const cancelOf = (args: unknown[]) => {
      const { buttons = [], cancelId } = options(args);
      if (typeof cancelId === 'number') return cancelId;
      const index = buttons.findIndex((label) => /^(cancel|no)$/i.test(label.replace(/&/g, '')));
      return index >= 0 ? index : 0;
    };

    const stub = dialog as unknown as Record<string, (...args: unknown[]) => unknown>;
    stub.showOpenDialog = async (...args) => (record('showOpenDialog', args), { canceled: true, filePaths: [] });
    stub.showOpenDialogSync = (...args) => (record('showOpenDialogSync', args), undefined);
    stub.showSaveDialog = async (...args) => (record('showSaveDialog', args), { canceled: true, filePath: '' });
    stub.showSaveDialogSync = (...args) => (record('showSaveDialogSync', args), '');
    stub.showMessageBox = async (...args) => (
      record('showMessageBox', args), { response: cancelOf(args), checkboxChecked: false }
    );
    stub.showMessageBoxSync = (...args) => (record('showMessageBoxSync', args), cancelOf(args));
    stub.showErrorBox = (...args) => {
      const [title, content] = args as [string?, string?];
      calls.push({ kind: 'showErrorBox', text: [title, content].filter(Boolean).join(': ') });
    };
    stub.showCertificateTrustDialog = async (...args) => {
      record('showCertificateTrustDialog', args);
    };
  }, RECORDER);
}

/**
 * The native dialogs the application asked for since the last reset.
 *
 * Throws when the recorder is absent rather than answering with an empty
 * list, for the reason `openedExternally` gives: a stub never installed and
 * a dialog never asked for must not look alike.
 */
export async function nativeDialogs(app: ElectronApplication): Promise<NativeDialogCall[]> {
  const calls = await app.evaluate(
    (_electron, key) => (globalThis as Record<string, unknown>)[key] as NativeDialogCall[] | undefined,
    RECORDER
  );
  if (calls === undefined) {
    throw new Error(
      'The native dialog recorder is not installed in this application, so nothing can be ' +
        'said about the dialogs it asked for.'
    );
  }
  return calls;
}
