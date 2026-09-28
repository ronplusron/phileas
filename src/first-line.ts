import net from 'node:net';

/**
 * Run a script in the application's main process before its own first line.
 *
 * Electron honors `--inspect-brk` on a packaged build, and it pauses the main
 * process on the first statement of the application's main script, before
 * any of its code has run: measured on `buggy` on 2026-09-28, where the pause
 * landed on the line that requires Electron. That is the one point where
 * something can be put in place ahead of everything the application does,
 * which `NODE_OPTIONS=--require` could not reach and Playwright's own loader
 * does not attempt for a packaged build, since it is only added when
 * Playwright launches the `electron` package.
 *
 * Playwright's launch passes `--inspect=0` and connects to the inspector that
 * prints. This adds `--inspect-brk=<port>` after it, on a port picked here,
 * so the same inspector pauses and answers on a port known in advance; Node
 * takes the last of the two. A second client on that port is accepted beside
 * Playwright's, measured the same day, and Playwright's says nothing until
 * Chromium has started, which cannot happen while the process is paused. So
 * this client is what lets the application go on, once the script has run,
 * and Playwright's launch returns after that as it always did.
 *
 * The pause is delivered by the same fuse as Playwright's own `--inspect`, so
 * a build that refuses one refuses both, and there is no build this reaches
 * that Playwright does not.
 */

/** How the pause is asked for, on the port this client will use. */
const PAUSE_FLAG = '--inspect-brk';

/**
 * A first-line install, prepared before the launch.
 *
 * `run()` is started before the launch and awaited after it, since the two
 * wait on each other: the launch does not return until the application goes
 * on, and the application does not go on until `run()` has let it.
 */
export type FirstLine = {
  /** The argument to launch the application with, last so nothing shadows it. */
  readonly launchArg: string;
  /** Runs the script once the application pauses, then lets it go on. */
  run(): Promise<void>;
};

/** What the inspector lists at `/json/list`. */
type InspectorTarget = { webSocketDebuggerUrl?: string };

/** One message on the inspector's wire, either direction. */
type Message = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message: string };
};

/** What `Runtime.evaluate` answers when the expression threw. */
type Evaluated = {
  exceptionDetails?: { text: string; exception?: { description?: string } };
};

/**
 * Prepare a first-line install of `script`, which is evaluated as an
 * expression with Node's command-line API in scope, so `require` reaches the
 * application's modules the way Playwright's own main-process handle does.
 *
 * Everything is bounded by `timeoutMs` from the moment `run()` starts. On any
 * failure the application is still let go on, so that the launch returns and
 * the failure is reported here rather than as a launch that timed out.
 */
export async function prepareFirstLine(script: string, timeoutMs: number): Promise<FirstLine> {
  const port = await freePort();
  return {
    launchArg: `${PAUSE_FLAG}=${port}`,
    async run() {
      const deadline = Date.now() + timeoutMs;
      const session = await InspectorSession.open(await inspectorUrl(port, deadline), deadline);
      try {
        const paused = session.once('Debugger.paused');
        await session.send('Debugger.enable');
        await session.send('Runtime.runIfWaitingForDebugger');
        await within(paused, deadline, 'the application, expected to pause on its first line,');
        const { exceptionDetails } = await within(
          session.send<Evaluated>('Runtime.evaluate', {
            expression: script,
            includeCommandLineAPI: true,
            returnByValue: true,
          }),
          deadline,
          'the first-line script'
        );
        if (exceptionDetails) {
          throw new Error(
            `The first-line script threw in the application's main process: ` +
              (exceptionDetails.exception?.description ?? exceptionDetails.text)
          );
        }
      } finally {
        // Whatever happened, and whether or not it paused: an application left
        // paused holds Playwright's launch until its timeout, and the failure
        // above would then be reported as that.
        await session.send('Runtime.runIfWaitingForDebugger').catch(() => undefined);
        await session.send('Debugger.resume').catch(() => undefined);
        session.close();
      }
    },
  };
}

/** A port nothing is listening on right now, from the operating system. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('The operating system handed back no port.'));
      });
    });
  });
}

/**
 * The inspector's socket address, polled for until the process has started
 * it: the inspector answers a few hundred milliseconds after the process is
 * spawned, and before that the connection is refused outright.
 */
async function inspectorUrl(port: number, deadline: number): Promise<string> {
  let lastError = 'it never answered';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1_000) });
      const targets = (await response.json()) as InspectorTarget[];
      const url = targets.find((target) => target.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
      if (url) return url;
      lastError = 'it listed no target';
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`The application's inspector on port ${port} did not answer in time: ${lastError}.`);
}

/** `promise`, or an error naming `what` once the deadline passes. */
function within<T>(promise: Promise<T>, deadline: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Waiting on ${what} did not finish in time.`)),
      Math.max(0, deadline - Date.now())
    );
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** One client on the main process's inspector, speaking its protocol. */
class InspectorSession {
  private nextId = 1;
  private readonly answers = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>();
  private readonly awaited = new Map<string, (params: unknown) => void>();

  private constructor(private readonly socket: WebSocket) {
    socket.onmessage = (event) => this.receive(JSON.parse(String(event.data)) as Message);
    socket.onclose = () => {
      for (const { reject } of this.answers.values()) reject(new Error('The inspector closed the connection.'));
      this.answers.clear();
    };
  }

  static async open(url: string, deadline: number): Promise<InspectorSession> {
    const socket = new WebSocket(url);
    await within(
      new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = (event) =>
          reject(new Error(`Connecting to the application's inspector failed: ${(event as { message?: string }).message ?? 'the socket failed'}`));
      }),
      deadline,
      "the application's inspector"
    );
    return new InspectorSession(socket);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.answers.set(id, { resolve: (result) => resolve(result as T), reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** The next event named `method`. Registered before whatever causes it. */
  once(method: string): Promise<unknown> {
    return new Promise((resolve) => this.awaited.set(method, resolve));
  }

  close(): void {
    this.socket.close();
  }

  private receive(message: Message): void {
    if (message.id !== undefined) {
      const answer = this.answers.get(message.id);
      this.answers.delete(message.id);
      if (!answer) return;
      if (message.error) answer.reject(new Error(`${message.error.message} (inspector)`));
      else answer.resolve(message.result);
      return;
    }
    if (message.method) {
      const waiting = this.awaited.get(message.method);
      if (waiting) {
        this.awaited.delete(message.method);
        waiting(message.params);
      }
    }
  }
}
