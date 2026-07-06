import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { assign, setup } from "xstate";
import type { HarnessAdapter } from "@selfme/unstable-ui-harness-sdk";
import type {
  ArtifactRef,
  CapabilityRequest,
  ClientEvent,
  HarnessEvent,
  ScreenSchema
} from "@selfme/unstable-ui-protocol";

export interface RuntimeContextValue {
  phase: "idle" | "connecting" | "active" | "completed" | "error";
  status: "idle" | "listening" | "thinking" | "waiting" | "running" | "complete";
  sessionId?: string;
  screen?: ScreenSchema;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  error?: string;
  sendClientEvent(event: ClientEvent): Promise<void>;
}

interface RuntimeMachineContext {
  sessionId?: string;
  status: RuntimeContextValue["status"];
  screen?: ScreenSchema;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  error?: string;
}

type RuntimeMachineEvent =
  | { type: "runtime.connect" }
  | { type: "runtime.connected" }
  | { type: "runtime.error"; message: string }
  | { type: "runtime.disconnected" }
  | { type: "runtime.harness"; event: HarnessEvent };

const runtimeMachine = setup({
  types: {
    context: {} as RuntimeMachineContext,
    events: {} as RuntimeMachineEvent
  },
  actions: {
    recordRuntimeError: assign({
      error: ({ event }) => (event.type === "runtime.error" ? event.message : "Unknown runtime error")
    }),
    reduceHarnessEvent: assign(({ context, event }) => {
      if (event.type !== "runtime.harness") {
        return context;
      }

      const harnessEvent = event.event;

      switch (harnessEvent.type) {
        case "session.started":
          return {
            ...context,
            sessionId: harnessEvent.sessionId
          };
        case "status":
          return {
            ...context,
            status: harnessEvent.phase
          };
        case "screen.updated":
          return {
            ...context,
            screen: harnessEvent.screen
          };
        case "artifact.available":
          return {
            ...context,
            artifacts: context.artifacts.some((artifact) => artifact.id === harnessEvent.artifact.id)
              ? context.artifacts
              : [...context.artifacts, harnessEvent.artifact]
          };
        case "error":
          return {
            ...context,
            error: harnessEvent.message
          };
        case "session.completed":
          return {
            ...context,
            status: "complete"
          };
        case "capability.requested":
          return {
            ...context,
            capabilityRequests: context.capabilityRequests.some((request) => request.id === harnessEvent.request.id)
              ? context.capabilityRequests.map((request) =>
                  request.id === harnessEvent.request.id ? harnessEvent.request : request
                )
              : [...context.capabilityRequests, harnessEvent.request]
          };
      }
    })
  }
}).createMachine({
  id: "agent-runtime",
  initial: "idle",
  context: {
    status: "idle",
    artifacts: [],
    capabilityRequests: []
  },
  states: {
    idle: {
      on: {
        "runtime.connect": "connecting"
      }
    },
    connecting: {
      on: {
        "runtime.connected": "active",
        "runtime.error": {
          target: "error",
          actions: "recordRuntimeError"
        }
      }
    },
    active: {
      on: {
        "runtime.harness": {
          actions: "reduceHarnessEvent",
          target: "active"
        },
        "runtime.disconnected": "idle",
        "runtime.error": {
          target: "error",
          actions: "recordRuntimeError"
        }
      },
      always: {
        guard: ({ context }) => context.status === "complete",
        target: "completed"
      }
    },
    completed: {
      on: {
        "runtime.connect": "connecting"
      }
    },
    error: {
      on: {
        "runtime.connect": "connecting"
      }
    }
  }
});

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export interface AgentRuntimeProviderProps {
  harness: HarnessAdapter;
  children: ReactNode;
}

export function AgentRuntimeProvider({ harness, children }: AgentRuntimeProviderProps) {
  const [state, send] = useMachine(runtimeMachine);

  useEffect(() => {
    let active = true;
    send({ type: "runtime.connect" });

    const unsubscribe = harness.subscribe((event) => {
      if (!active) {
        return;
      }

      send({ type: "runtime.harness", event });
    });

    void harness
      .connect()
      .then(() => {
        if (!active) {
          return;
        }

        send({ type: "runtime.connected" });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        send({
          type: "runtime.error",
          message: error instanceof Error ? error.message : "Failed to connect harness"
        });
      });

    return () => {
      active = false;
      unsubscribe();
      void harness.disconnect();
      send({ type: "runtime.disconnected" });
    };
  }, [harness, send]);

  const value: RuntimeContextValue = {
    phase: state.value,
    status: state.context.status,
    sessionId: state.context.sessionId,
    screen: state.context.screen,
    artifacts: state.context.artifacts,
    capabilityRequests: state.context.capabilityRequests,
    error: state.context.error,
    sendClientEvent: (event) => harness.send(event)
  };

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useAgentRuntime() {
  const value = useContext(RuntimeContext);

  if (!value) {
    throw new Error("useAgentRuntime must be used within AgentRuntimeProvider");
  }

  return value;
}
