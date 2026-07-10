import {
  parseHarnessEvent,
  type ClientEvent,
  type HarnessEvent,
  type ScreenFlow,
  type ScreenInteraction,
  type ScreenMode,
  type ScreenSchema
} from "@selfme/unstable-ui-protocol";

export type HarnessListener = (event: HarnessEvent) => void;
export type Unsubscribe = () => void;

export interface HarnessAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(event: ClientEvent): Promise<void>;
  subscribe(listener: HarnessListener): Unsubscribe;
}

type EmitFn = (event: HarnessEvent) => void;

export interface LocalHarnessOptions {
  bootstrap?: (emit: EmitFn) => void;
  onConnect?: (emit: EmitFn) => void | Promise<void>;
  onDisconnect?: () => void | Promise<void>;
  handleClientEvent?: (event: ClientEvent, emit: EmitFn) => void | Promise<void>;
}

export interface RemoteHarnessOptions {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  send: (event: ClientEvent) => Promise<void>;
  subscribe: (listener: HarnessListener) => Unsubscribe;
}

export interface SessionStartResponse {
  sessionId: string;
  streamUrl?: string;
  eventUrl?: string;
}

export interface RemoteSessionSnapshot {
  sessionId: string;
  streamUrl: string;
  eventUrl: string;
}

export interface RemoteSessionStore {
  load(): Promise<RemoteSessionSnapshot | undefined> | RemoteSessionSnapshot | undefined;
  save(snapshot: RemoteSessionSnapshot): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface FetchRequestInitLike {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: unknown;
}

export interface HttpResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  body?: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel?(reason?: unknown): Promise<void>;
      releaseLock?(): void;
    };
  } | null;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: FetchRequestInitLike) => Promise<HttpResponseLike>;

export interface RemoteHttpSseHarnessOptions {
  baseUrl: string;
  fetch?: FetchLike;
  headers?: Record<string, string>;
  sessionStartPath?: string;
  sessionStore?: RemoteSessionStore;
  buildSessionStartBody?: () => Record<string, unknown> | undefined;
  resolveStreamUrl?: (response: SessionStartResponse) => string;
  resolveEventUrl?: (response: SessionStartResponse) => string;
}

export const defaultScreenInteraction: ScreenInteraction = {
  input: "enabled",
  actions: "enabled",
  forms: "enabled",
  artifacts: "enabled",
  history: "enabled"
};

export function resolveScreenInteraction(interaction?: Partial<ScreenInteraction>): ScreenInteraction {
  return {
    ...defaultScreenInteraction,
    ...interaction
  };
}

export function createRootScreenFlow(): ScreenFlow {
  return {
    transition: "root",
    state: "complete"
  };
}

export function createOngoingScreenFlow(requestId?: string, parentRequestId?: string): ScreenFlow {
  return {
    requestId,
    parentRequestId,
    transition: "replace",
    state: "ongoing"
  };
}

export function createCompletedScreenFlow(requestId?: string, parentRequestId?: string): ScreenFlow {
  return {
    requestId,
    parentRequestId,
    transition: "replace",
    state: "complete"
  };
}

export function createFailedScreenFlow(requestId?: string, parentRequestId?: string): ScreenFlow {
  return {
    requestId,
    parentRequestId,
    transition: "replace",
    state: "failed"
  };
}

export function applyScreenFlow(screen: ScreenSchema, flow: ScreenFlow): ScreenSchema {
  return {
    ...screen,
    flow
  };
}

export function withScreenState(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  mode: ScreenMode,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createRootScreenFlow()
): ScreenSchema {
  return {
    ...screen,
    mode,
    flow,
    interaction: resolveScreenInteraction(interaction)
  };
}

export function createStableScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createRootScreenFlow()
): ScreenSchema {
  return withScreenState(screen, "stable", interaction, flow);
}

export function createProcessingScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createOngoingScreenFlow()
): ScreenSchema {
  return withScreenState(screen, "processing", interaction, flow);
}

export function createTaskScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createOngoingScreenFlow()
): ScreenSchema {
  return withScreenState(screen, "task", interaction, flow);
}

export function createResultScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createCompletedScreenFlow()
): ScreenSchema {
  return withScreenState(screen, "result", interaction, flow);
}

export function createApprovalScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createOngoingScreenFlow()
): ScreenSchema {
  return withScreenState(screen, "approval", interaction, flow);
}

export function createErrorScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction" | "flow">,
  interaction: Partial<ScreenInteraction> = {},
  flow: ScreenFlow = createFailedScreenFlow()
): ScreenSchema {
  return withScreenState(screen, "error", interaction, flow);
}

function createEmitter() {
  const listeners = new Set<HarnessListener>();

  return {
    emit(event: HarnessEvent) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe(listener: HarnessListener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export function createLocalHarness(options: LocalHarnessOptions = {}): HarnessAdapter {
  const emitter = createEmitter();
  let connected = false;

  return {
    async connect() {
      if (connected) {
        return;
      }

      connected = true;
      options.bootstrap?.(emitter.emit);
      await options.onConnect?.(emitter.emit);
    },
    async disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
      await options.onDisconnect?.();
    },
    async send(event) {
      await options.handleClientEvent?.(event, emitter.emit);
    },
    subscribe(listener) {
      return emitter.subscribe(listener);
    }
  };
}

export function createRemoteHarness(options: RemoteHarnessOptions): HarnessAdapter {
  return {
    connect: async () => {
      await options.connect?.();
    },
    disconnect: async () => {
      await options.disconnect?.();
    },
    send: options.send,
    subscribe: options.subscribe
  };
}

interface RemoteSessionState {
  sessionId: string;
  streamUrl: string;
  eventUrl: string;
}

function getFetchImplementation(explicitFetch?: FetchLike) {
  if (explicitFetch) {
    return explicitFetch;
  }

  const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;

  if (!globalFetch) {
    throw new Error("No fetch implementation is available. Pass options.fetch to createRemoteHttpSseHarness.");
  }

  return globalFetch.bind(globalThis);
}

function joinUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getAbortController() {
  const AbortControllerCtor = (globalThis as {
    AbortController?: new () => { readonly signal: unknown; abort(reason?: unknown): void };
  }).AbortController;

  return AbortControllerCtor ? new AbortControllerCtor() : undefined;
}

function getTextDecoder() {
  const TextDecoderCtor = (globalThis as {
    TextDecoder?: new (label?: string) => { decode(input?: Uint8Array, options?: { stream?: boolean }): string };
  }).TextDecoder;

  if (!TextDecoderCtor) {
    throw new Error("TextDecoder is required for HTTP + SSE harness streaming in this runtime.");
  }

  return new TextDecoderCtor("utf-8");
}

async function readJsonResponse<T>(response: HttpResponseLike) {
  return (await response.json()) as T;
}

async function throwHttpError(response: HttpResponseLike) {
  const message = await response.text().catch(() => "");
  const details = message ? ` ${message}` : "";
  throw new Error(`HTTP ${response.status} ${response.statusText}.${details}`.trim());
}

function emitTransportError(emit: (event: HarnessEvent) => void, error: unknown) {
  emit({
    type: "error",
    message: error instanceof Error ? error.message : "Remote harness transport error."
  });
}

function parseSsePayload(payload: string) {
  return parseHarnessEvent(JSON.parse(payload));
}

async function consumeSseStream(
  response: HttpResponseLike,
  emit: (event: HarnessEvent) => void,
  signal?: { aborted?: boolean }
) {
  const body = response.body;

  if (!body) {
    throw new Error("The remote harness stream did not return a readable response body.");
  }

  const reader = body.getReader();
  const decoder = getTextDecoder();
  let buffer = "";
  let dataLines: string[] = [];

  const flush = () => {
    if (dataLines.length === 0) {
      return;
    }

    const payload = dataLines.join("\n").trim();
    dataLines = [];

    if (!payload) {
      return;
    }

    emit(parseSsePayload(payload));
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (signal?.aborted) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (!line) {
          flush();
          continue;
        }

        if (line.startsWith(":")) {
          continue;
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    flush();
  } finally {
    await reader.cancel?.().catch(() => undefined);
    reader.releaseLock?.();
  }
}

async function connectRemoteSessionStream(
  fetchImpl: FetchLike,
  session: RemoteSessionState,
  options: RemoteHttpSseHarnessOptions,
  emitter: ReturnType<typeof createEmitter>
) {
  const streamAbortController = getAbortController();
  const streamResponse = await fetchImpl(session.streamUrl, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...options.headers
    },
    signal: streamAbortController?.signal
  });

  if (!streamResponse.ok) {
    await throwHttpError(streamResponse);
  }

  const streamTask = consumeSseStream(
    streamResponse,
    emitter.emit,
    streamAbortController ? (streamAbortController.signal as { aborted?: boolean }) : undefined
  ).catch((error) => {
    if ((streamAbortController?.signal as { aborted?: boolean } | undefined)?.aborted) {
      return;
    }

    emitTransportError(emitter.emit, error);
  });

  return {
    streamAbortController,
    streamTask
  };
}

export function createRemoteHttpSseHarness(options: RemoteHttpSseHarnessOptions): HarnessAdapter {
  const emitter = createEmitter();
  const fetchImpl = getFetchImplementation(options.fetch);
  const sessionStartPath = options.sessionStartPath ?? "/session/start";
  let activeSession: RemoteSessionState | undefined;
  let streamAbortController: { readonly signal: unknown; abort(reason?: unknown): void } | undefined;
  let streamTask: Promise<void> | undefined;

  return {
    async connect() {
      if (activeSession) {
        return;
      }

      const connectWithSession = async (session: RemoteSessionState) => {
        const connection = await connectRemoteSessionStream(fetchImpl, session, options, emitter);
        activeSession = session;
        streamAbortController = connection.streamAbortController;
        streamTask = connection.streamTask;
      };

      const storedSession = await Promise.resolve(options.sessionStore?.load?.());

      if (storedSession) {
        try {
          await connectWithSession(storedSession);
          return;
        } catch {
          await Promise.resolve(options.sessionStore?.clear?.());
        }
      }

      const body = options.buildSessionStartBody?.();
      const startResponse = await fetchImpl(joinUrl(options.baseUrl, sessionStartPath), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        },
        body: body ? JSON.stringify(body) : JSON.stringify({})
      });

      if (!startResponse.ok) {
        await throwHttpError(startResponse);
      }

      const session = await readJsonResponse<SessionStartResponse>(startResponse);
      const streamUrl = joinUrl(
        options.baseUrl,
        options.resolveStreamUrl?.(session) ?? session.streamUrl ?? `/session/${session.sessionId}/stream`
      );
      const eventUrl = joinUrl(
        options.baseUrl,
        options.resolveEventUrl?.(session) ?? session.eventUrl ?? `/session/${session.sessionId}/event`
      );

      const nextSession = {
        sessionId: session.sessionId,
        streamUrl,
        eventUrl
      };

      await connectWithSession(nextSession);
      await Promise.resolve(options.sessionStore?.save(nextSession));
    },
    async disconnect() {
      streamAbortController?.abort();
      streamAbortController = undefined;
      activeSession = undefined;
      await streamTask?.catch(() => undefined);
      streamTask = undefined;
    },
    async send(event) {
      if (!activeSession) {
        throw new Error("Remote harness is not connected.");
      }

      const response = await fetchImpl(activeSession.eventUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          await Promise.resolve(options.sessionStore?.clear?.());
        }
        await throwHttpError(response);
      }
    },
    subscribe(listener) {
      return emitter.subscribe(listener);
    }
  };
}
