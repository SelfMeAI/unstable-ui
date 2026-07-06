import type { ClientEvent, HarnessEvent } from "@unstable-ui/protocol";

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
