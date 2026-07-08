import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { assign, setup } from "xstate";
import type { HarnessAdapter } from "@selfme/unstable-ui-harness-sdk";
import {
  applyScreenPatch,
  type ArtifactRef,
  type CapabilityRequest,
  type ClientEvent,
  type HarnessEvent,
  type ScreenFlow,
  type ScreenInteraction,
  type ScreenMode,
  type ScreenSchema
} from "@selfme/unstable-ui-protocol";

export interface RuntimeContextValue {
  phase: "idle" | "connecting" | "active" | "completed" | "error";
  status: "idle" | "listening" | "thinking" | "waiting" | "running" | "complete";
  sessionId?: string;
  screen?: ScreenSchema;
  screenMode: ScreenMode;
  flow: RuntimeRequestFlowState;
  interaction: ScreenInteraction;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  error?: string;
  eventLog: RuntimeEventLogEntry[];
  history: RuntimeHistoryEntry[];
  sendClientEvent(event: ClientEvent): Promise<void>;
}

export interface RuntimeEventLogEntry {
  id: string;
  direction: "harness" | "client" | "runtime";
  type: string;
  timestamp: string;
  payload: unknown;
}

export interface RuntimeHistoryEntry {
  id: string;
  timestamp: string;
  role: "user" | "assistant" | "system";
  kind: "input" | "workspace" | "artifact" | "capability" | "error" | "action" | "form" | "session";
  title: string;
  body?: string;
  meta?: string;
  requestId?: string;
  requestSource?: RuntimeRequestSource;
  screenId?: string;
  screenMode?: ScreenMode;
  flowTransition?: ScreenFlow["transition"];
  eventType?: ClientEvent["type"] | HarnessEvent["type"] | "runtime.error";
}

export interface RuntimeSnapshot {
  sessionId?: string;
  status: RuntimeContextValue["status"];
  screen?: ScreenSchema;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  error?: string;
  eventLog: RuntimeEventLogEntry[];
  history: RuntimeHistoryEntry[];
}

export interface RuntimePersistenceAdapter {
  load(): Promise<RuntimeSnapshot | undefined> | RuntimeSnapshot | undefined;
  save(snapshot: RuntimeSnapshot): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface AgentRuntimeOptions {
  persistence?: RuntimePersistenceAdapter;
}

export interface RuntimeRequestFlowState {
  requestId?: string;
  source?: RuntimeRequestSource;
  phase: "idle" | "pending" | "active" | "complete";
  screenMode: ScreenMode;
  transition?: ScreenFlow["transition"];
  screenId?: string;
  lastCompletedRequestId?: string;
  historyEntryCount: number;
  workspaceEventCount: number;
  patchEventCount: number;
  resourceEventCount: number;
  issueCount: number;
}

type RuntimeRequestSource = "voice" | "input" | "action" | "form";

interface RuntimeMachineContext {
  sessionId?: string;
  status: RuntimeContextValue["status"];
  screen?: ScreenSchema;
  pendingRequestId?: string;
  activeRequestId?: string;
  activeRequestSource?: RuntimeRequestSource;
  lastCompletedRequestId?: string;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  error?: string;
  eventLog: RuntimeEventLogEntry[];
  history: RuntimeHistoryEntry[];
}

type RuntimeMachineEvent =
  | { type: "runtime.connect" }
  | { type: "runtime.connected" }
  | { type: "runtime.hydrated"; snapshot: RuntimeSnapshot }
  | { type: "runtime.error"; message: string }
  | { type: "runtime.disconnected" }
  | { type: "runtime.client"; event: ClientEvent }
  | { type: "runtime.harness"; event: HarnessEvent };

const defaultEventLogLimit = 100;
const defaultHistoryLimit = 200;
const defaultScreenInteraction: ScreenInteraction = {
  input: "enabled",
  actions: "enabled",
  forms: "enabled",
  artifacts: "enabled",
  history: "enabled"
};

function resolveScreenInteraction(interaction?: ScreenSchema["interaction"]): ScreenInteraction {
  return {
    ...defaultScreenInteraction,
    ...interaction
  };
}

function getClientEventRequestSource(event: ClientEvent): RuntimeRequestSource | undefined {
  switch (event.type) {
    case "voice.input":
      return "voice";
    case "input.submitted":
      return event.mode === "voice" ? "voice" : "input";
    case "action.triggered":
      return "action";
    case "form.submitted":
      return "form";
    default:
      return undefined;
  }
}

function getClientEventRequestId(event: ClientEvent) {
  switch (event.type) {
    case "voice.input":
    case "input.submitted":
    case "action.triggered":
    case "form.submitted":
      return event.clientRequestId;
    default:
      return undefined;
  }
}

function createClientRequestId(source: RuntimeRequestSource) {
  return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureClientEventRequestId(event: ClientEvent): ClientEvent {
  const source = getClientEventRequestSource(event);

  if (!source || getClientEventRequestId(event)) {
    return event;
  }

  const clientRequestId = createClientRequestId(source);

  switch (event.type) {
    case "voice.input":
      return {
        ...event,
        clientRequestId
      };
    case "input.submitted":
      return {
        ...event,
        clientRequestId
      };
    case "action.triggered":
      return {
        ...event,
        clientRequestId
      };
    case "form.submitted":
      return {
        ...event,
        clientRequestId
      };
    default:
      return event;
  }
}

function inferScreenFlow(screen: ScreenSchema | undefined, context: RuntimeMachineContext): ScreenFlow | undefined {
  if (!screen) {
    return undefined;
  }

  if (screen.flow) {
    return screen.flow;
  }

  const requestId = context.pendingRequestId ?? context.activeRequestId;

  switch (screen.mode) {
    case "processing":
    case "task":
    case "approval":
      return requestId
        ? {
            requestId,
            state: "ongoing",
            transition: "replace"
          }
        : undefined;
    case "result":
      return requestId
        ? {
            requestId,
            state: "complete",
            transition: "replace"
          }
        : undefined;
    default:
      return undefined;
  }
}

function deriveScreenMode(screen?: ScreenSchema, error?: string, capabilityRequests: CapabilityRequest[] = []): ScreenMode {
  if (error) {
    return "error";
  }

  if (capabilityRequests.length > 0) {
    return "approval";
  }

  return screen?.mode ?? "stable";
}

function deriveRuntimeFlowState(
  context: Pick<
    RuntimeMachineContext,
    | "status"
    | "screen"
    | "pendingRequestId"
    | "activeRequestId"
    | "activeRequestSource"
    | "lastCompletedRequestId"
    | "error"
    | "history"
  >,
  capabilityRequests: CapabilityRequest[] = []
): RuntimeRequestFlowState {
  const screenMode = deriveScreenMode(context.screen, context.error, capabilityRequests);
  const screenFlow = inferScreenFlow(context.screen, context as RuntimeMachineContext);
  const currentRequestId = screenFlow?.requestId ?? context.pendingRequestId ?? context.activeRequestId;
  const requestSummary = summarizeRuntimeRequestHistory(context.history, currentRequestId);

  if (screenFlow?.requestId) {
    return {
      requestId: screenFlow.requestId,
      source: context.activeRequestSource,
      phase: screenFlow.state === "complete" ? "complete" : "active",
      screenMode,
      transition: screenFlow.transition,
      screenId: context.screen?.id,
      lastCompletedRequestId: context.lastCompletedRequestId,
      historyEntryCount: requestSummary.historyEntryCount,
      workspaceEventCount: requestSummary.workspaceEventCount,
      patchEventCount: requestSummary.patchEventCount,
      resourceEventCount: requestSummary.resourceEventCount,
      issueCount: requestSummary.issueCount
    };
  }

  if (context.pendingRequestId || context.activeRequestId) {
    return {
      requestId: context.pendingRequestId ?? context.activeRequestId,
      source: context.activeRequestSource,
      phase:
        context.status === "thinking" || context.status === "running" || capabilityRequests.length > 0
          ? "active"
          : "pending",
      screenMode,
      transition: context.screen?.flow?.transition,
      screenId: context.screen?.id,
      lastCompletedRequestId: context.lastCompletedRequestId,
      historyEntryCount: requestSummary.historyEntryCount,
      workspaceEventCount: requestSummary.workspaceEventCount,
      patchEventCount: requestSummary.patchEventCount,
      resourceEventCount: requestSummary.resourceEventCount,
      issueCount: requestSummary.issueCount
    };
  }

  return {
    phase: "idle",
    screenMode,
    transition: context.screen?.flow?.transition,
    screenId: context.screen?.id,
    lastCompletedRequestId: context.lastCompletedRequestId,
    historyEntryCount: 0,
    workspaceEventCount: 0,
    patchEventCount: 0,
    resourceEventCount: 0,
    issueCount: 0
  };
}

function deriveRuntimeInteraction(
  status: RuntimeContextValue["status"],
  screen?: ScreenSchema,
  flow?: RuntimeRequestFlowState,
  capabilityRequests: CapabilityRequest[] = [],
  error?: string
): ScreenInteraction {
  const nextInteraction = resolveScreenInteraction(screen?.interaction);

  if (error) {
    return {
      ...nextInteraction,
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The runtime is in an error state."
    };
  }

  if (capabilityRequests.length > 0) {
    return {
      ...nextInteraction,
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: nextInteraction.reason ?? "Waiting for a device capability decision."
    };
  }

  if (screen?.mode === "processing" || status === "thinking" || status === "running") {
    return {
      ...nextInteraction,
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: nextInteraction.reason ?? "Harness is processing the current request."
    };
  }

  if (screen?.mode === "task" && flow?.phase === "active") {
    return {
      ...nextInteraction,
      input: "locked",
      reason: nextInteraction.reason ?? "The current task flow is still in progress."
    };
  }

  return nextInteraction;
}

function createRuntimeLogEntry(
  direction: RuntimeEventLogEntry["direction"],
  type: string,
  payload: unknown
): RuntimeEventLogEntry {
  return {
    id: `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    direction,
    type,
    timestamp: new Date().toISOString(),
    payload
  };
}

function appendRuntimeLog(
  eventLog: RuntimeEventLogEntry[],
  entry: RuntimeEventLogEntry,
  limit: number
) {
  const next = [...eventLog, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function buildRuntimeSnapshot(context: RuntimeMachineContext): RuntimeSnapshot {
  return {
    sessionId: context.sessionId,
    status: context.status,
    screen: context.screen,
    artifacts: context.artifacts,
    capabilityRequests: context.capabilityRequests,
    error: context.error,
    eventLog: context.eventLog,
    history: context.history
  };
}

function createRuntimeHistoryEntry(
  role: RuntimeHistoryEntry["role"],
  kind: RuntimeHistoryEntry["kind"],
  title: string,
  options: Pick<
    RuntimeHistoryEntry,
    "body" | "meta" | "requestId" | "requestSource" | "screenId" | "screenMode" | "flowTransition" | "eventType"
  > = {}
): RuntimeHistoryEntry {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    role,
    kind,
    title,
    body: options.body,
    meta: options.meta,
    requestId: options.requestId,
    requestSource: options.requestSource,
    screenId: options.screenId,
    screenMode: options.screenMode,
    flowTransition: options.flowTransition,
    eventType: options.eventType
  };
}

function summarizeRuntimeRequestHistory(history: RuntimeHistoryEntry[], requestId?: string) {
  const entries = requestId ? history.filter((entry) => entry.requestId === requestId) : [];

  return {
    historyEntryCount: entries.length,
    workspaceEventCount: entries.filter((entry) => entry.kind === "workspace").length,
    patchEventCount: entries.filter((entry) => entry.eventType === "screen.patched").length,
    resourceEventCount: entries.filter((entry) => entry.kind === "artifact" || entry.kind === "capability").length,
    issueCount: entries.filter((entry) => entry.kind === "error").length
  };
}

function appendRuntimeHistory(
  history: RuntimeHistoryEntry[],
  entry: RuntimeHistoryEntry | null,
  limit: number
) {
  if (!entry) {
    return history;
  }

  const next = [...history, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function stringifyUnknown(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function summarizeRecord(record: Record<string, unknown> | Record<string, string>) {
  const entries = Object.entries(record).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
}

function createHistoryEntryFromClientEvent(
  event: ClientEvent,
  context?: Pick<RuntimeMachineContext, "activeRequestSource">
): RuntimeHistoryEntry | null {
  const requestId = getClientEventRequestId(event);
  const requestSource = getClientEventRequestSource(event) ?? context?.activeRequestSource;

  switch (event.type) {
    case "session.start":
      return createRuntimeHistoryEntry("user", "session", "Session started", {
        body: event.input,
        requestId,
        requestSource,
        eventType: event.type
      });
    case "voice.input":
      return createRuntimeHistoryEntry("user", "input", "Voice input", {
        body: event.transcript,
        meta: "voice",
        requestId,
        requestSource,
        eventType: event.type
      });
    case "input.submitted":
      return createRuntimeHistoryEntry("user", "input", event.mode === "voice" ? "Voice input" : "Text input", {
        body: event.text ?? (event.audioUri ? "Audio input submitted." : undefined),
        meta: event.mode,
        requestId,
        requestSource,
        eventType: event.type
      });
    case "action.triggered":
      return createRuntimeHistoryEntry("user", "action", `Action: ${event.actionId}`, {
        body: event.payload ? stringifyUnknown(event.payload) : undefined,
        requestId,
        requestSource,
        eventType: event.type
      });
    case "form.submitted":
      return createRuntimeHistoryEntry("user", "form", "Form submitted", {
        body: summarizeRecord(event.values),
        requestId,
        requestSource,
        eventType: event.type
      });
    case "artifact.requested":
      return createRuntimeHistoryEntry("system", "artifact", "Artifact requested", {
        body: event.artifactId,
        meta: event.mode,
        requestId,
        requestSource,
        eventType: event.type
      });
    case "capability.resolved":
      return createRuntimeHistoryEntry("system", "capability", "Capability resolved", {
        body: stringifyUnknown(event.payload),
        meta: event.requestId,
        requestId,
        requestSource,
        eventType: event.type
      });
  }
}

function createHistoryEntryFromHarnessEvent(
  event: HarnessEvent,
  context?: Pick<RuntimeMachineContext, "pendingRequestId" | "activeRequestId" | "activeRequestSource" | "screen">
): RuntimeHistoryEntry | null {
  const currentRequestId = context?.pendingRequestId ?? context?.activeRequestId;

  switch (event.type) {
    case "session.started":
      return createRuntimeHistoryEntry("system", "session", "Session ready", {
        meta: event.sessionId,
        eventType: event.type
      });
    case "screen.updated": {
      const screenFlow = inferScreenFlow(event.screen, {
        pendingRequestId: context?.pendingRequestId,
        activeRequestId: context?.activeRequestId
      } as RuntimeMachineContext);

      return createRuntimeHistoryEntry("assistant", "workspace", event.screen.title ?? "Workspace updated", {
        body: event.screen.subtitle,
        requestId: screenFlow?.requestId ?? currentRequestId,
        requestSource: context?.activeRequestSource,
        screenId: event.screen.id,
        screenMode: event.screen.mode,
        flowTransition: screenFlow?.transition ?? event.screen.flow?.transition,
        eventType: event.type
      });
    }
    case "screen.patched": {
      const nextScreen =
        context?.screen && context.screen.id === event.screenId
          ? applyScreenPatch(context.screen, event.operations)
          : undefined;

      if (!nextScreen) {
        return null;
      }

      const screenFlow = inferScreenFlow(nextScreen, {
        pendingRequestId: context?.pendingRequestId,
        activeRequestId: context?.activeRequestId
      } as RuntimeMachineContext);

      return createRuntimeHistoryEntry("assistant", "workspace", "Workspace updated", {
        body: `${event.operations.length} incremental change(s) applied`,
        requestId: screenFlow?.requestId ?? currentRequestId,
        requestSource: context?.activeRequestSource,
        screenId: nextScreen.id,
        screenMode: nextScreen.mode,
        flowTransition: screenFlow?.transition ?? nextScreen.flow?.transition,
        eventType: event.type
      });
    }
    case "artifact.available":
      return createRuntimeHistoryEntry("assistant", "artifact", event.artifact.title ?? "Artifact available", {
        body: event.artifact.kind,
        meta: event.artifact.source,
        requestId: currentRequestId,
        requestSource: context?.activeRequestSource,
        eventType: event.type
      });
    case "capability.requested":
      return createRuntimeHistoryEntry("assistant", "capability", "Capability requested", {
        body: event.request.reason,
        meta: event.request.capability,
        requestId: currentRequestId,
        requestSource: context?.activeRequestSource,
        eventType: event.type
      });
    case "error":
      return createRuntimeHistoryEntry("assistant", "error", "Harness error", {
        body: event.message,
        requestId: currentRequestId,
        requestSource: context?.activeRequestSource,
        eventType: event.type
      });
    case "session.completed":
      return createRuntimeHistoryEntry("assistant", "session", "Task completed", {
        requestId: currentRequestId,
        requestSource: context?.activeRequestSource,
        eventType: event.type
      });
    case "status":
      return null;
  }
}

function createHydratedEventLog(snapshot: RuntimeSnapshot, limit: number) {
  return appendRuntimeLog(
    snapshot.eventLog ?? [],
    createRuntimeLogEntry("runtime", "runtime.hydrated", {
      sessionId: snapshot.sessionId,
      status: snapshot.status
    }),
    limit
  );
}

function reduceRequestTrackingFromScreen(context: RuntimeMachineContext, screen?: ScreenSchema) {
  const flow = inferScreenFlow(screen, context);

  if (!flow) {
    return {
      pendingRequestId: context.pendingRequestId,
      activeRequestId: context.activeRequestId,
      activeRequestSource: context.activeRequestSource,
      lastCompletedRequestId: context.lastCompletedRequestId
    };
  }

  if (flow.state === "complete") {
    return {
      pendingRequestId: undefined,
      activeRequestId: undefined,
      activeRequestSource: undefined,
      lastCompletedRequestId: flow.requestId ?? context.activeRequestId ?? context.pendingRequestId ?? context.lastCompletedRequestId
    };
  }

  return {
    pendingRequestId: undefined,
    activeRequestId: flow.requestId ?? context.pendingRequestId ?? context.activeRequestId,
    activeRequestSource: context.activeRequestSource,
    lastCompletedRequestId: context.lastCompletedRequestId
  };
}

const runtimeMachine = setup({
  types: {
    context: {} as RuntimeMachineContext,
    events: {} as RuntimeMachineEvent
  },
  actions: {
    prepareConnect: assign({
      error: () => undefined
    }),
    hydrateSnapshot: assign(({ context, event }) => {
      if (event.type !== "runtime.hydrated") {
        return context;
      }

      return {
        ...context,
        ...event.snapshot,
        artifacts: event.snapshot.artifacts ?? context.artifacts,
        capabilityRequests: event.snapshot.capabilityRequests ?? context.capabilityRequests,
        history: event.snapshot.history ?? context.history,
        eventLog: createHydratedEventLog(
          {
            ...event.snapshot,
            eventLog: event.snapshot.eventLog ?? context.eventLog
          },
          defaultEventLogLimit
        )
      };
    }),
    recordRuntimeLifecycle: assign(({ context, event }) => {
      if (event.type !== "runtime.connected" && event.type !== "runtime.disconnected") {
        return context;
      }

      return {
        ...context,
        eventLog: appendRuntimeLog(
          context.eventLog,
          createRuntimeLogEntry("runtime", event.type, {}),
          defaultEventLogLimit
        )
      };
    }),
    recordRuntimeError: assign({
      error: ({ context, event }) => (event.type === "runtime.error" ? event.message : context.error),
      pendingRequestId: ({ context, event }) => (event.type === "runtime.error" ? undefined : context.pendingRequestId),
      activeRequestId: ({ context, event }) => (event.type === "runtime.error" ? undefined : context.activeRequestId),
      activeRequestSource: ({ context, event }) =>
        event.type === "runtime.error" ? undefined : context.activeRequestSource,
      history: ({ context, event }) =>
        event.type === "runtime.error"
          ? appendRuntimeHistory(
              context.history,
              createRuntimeHistoryEntry("system", "error", "Runtime error", {
                body: event.message,
                requestId: context.pendingRequestId ?? context.activeRequestId,
                requestSource: context.activeRequestSource,
                eventType: "runtime.error"
              }),
              defaultHistoryLimit
            )
          : context.history,
      eventLog: ({ context, event }) =>
        event.type === "runtime.error"
          ? appendRuntimeLog(
              context.eventLog,
              createRuntimeLogEntry("runtime", "runtime.error", { message: event.message }),
              defaultEventLogLimit
            )
          : context.eventLog
    }),
    recordClientEvent: assign(({ context, event }) => {
      if (event.type !== "runtime.client") {
        return context;
      }

      const clientEvent = event.event;
      const requestId = getClientEventRequestId(clientEvent);
      const requestSource = getClientEventRequestSource(clientEvent);
      let nextCapabilityRequests = context.capabilityRequests;

      if (clientEvent.type === "capability.resolved") {
        nextCapabilityRequests = context.capabilityRequests.filter(
          (request) => request.id !== clientEvent.requestId
        );
      }

      return {
        ...context,
        pendingRequestId: requestId ?? context.pendingRequestId,
        activeRequestId: requestId ?? context.activeRequestId,
        activeRequestSource: requestSource ?? context.activeRequestSource,
        capabilityRequests: nextCapabilityRequests,
        history: appendRuntimeHistory(
          context.history,
          createHistoryEntryFromClientEvent(clientEvent, context),
          defaultHistoryLimit
        ),
        eventLog: appendRuntimeLog(
          context.eventLog,
          createRuntimeLogEntry("client", clientEvent.type, clientEvent),
          defaultEventLogLimit
        )
      };
    }),
    reduceHarnessEvent: assign(({ context, event }) => {
      if (event.type !== "runtime.harness") {
        return context;
      }

      const harnessEvent = event.event;
      const nextEventLog = appendRuntimeLog(
        context.eventLog,
        createRuntimeLogEntry("harness", harnessEvent.type, harnessEvent),
        defaultEventLogLimit
      );
      const nextHistory = appendRuntimeHistory(
        context.history,
        createHistoryEntryFromHarnessEvent(harnessEvent, context),
        defaultHistoryLimit
      );

      switch (harnessEvent.type) {
        case "session.started":
          return {
            ...context,
            sessionId: harnessEvent.sessionId,
            error: undefined,
            pendingRequestId: undefined,
            activeRequestId: undefined,
            activeRequestSource: undefined,
            history: nextHistory,
            eventLog: nextEventLog
          };
        case "status":
          return {
            ...context,
            status: harnessEvent.phase,
            error: undefined,
            history: nextHistory,
            eventLog: nextEventLog
          };
        case "screen.updated":
          return {
            ...context,
            screen: harnessEvent.screen,
            error: undefined,
            ...reduceRequestTrackingFromScreen(context, harnessEvent.screen),
            history: nextHistory,
            eventLog: nextEventLog
          };
        case "screen.patched": {
          const nextScreen =
            context.screen && context.screen.id === harnessEvent.screenId
              ? applyScreenPatch(context.screen, harnessEvent.operations)
              : context.screen;

          return {
            ...context,
            screen: nextScreen,
            error: undefined,
            ...reduceRequestTrackingFromScreen(context, nextScreen),
            history: nextHistory,
            eventLog: nextEventLog
          };
        }
        case "artifact.available":
          return {
            ...context,
            artifacts: context.artifacts.some((artifact) => artifact.id === harnessEvent.artifact.id)
              ? context.artifacts
              : [...context.artifacts, harnessEvent.artifact],
            error: undefined,
            history: nextHistory,
            eventLog: nextEventLog
          };
        case "error":
          return {
            ...context,
            error: harnessEvent.message,
            pendingRequestId: undefined,
            activeRequestId: undefined,
            activeRequestSource: undefined,
            history: nextHistory,
            eventLog: nextEventLog
          };
        case "session.completed":
          return {
            ...context,
            status: "complete",
            error: undefined,
            pendingRequestId: undefined,
            activeRequestId: undefined,
            activeRequestSource: undefined,
            lastCompletedRequestId: context.activeRequestId ?? context.pendingRequestId ?? context.lastCompletedRequestId,
            history: nextHistory,
            eventLog: nextEventLog
          };
        case "capability.requested":
          return {
            ...context,
            capabilityRequests: context.capabilityRequests.some((request) => request.id === harnessEvent.request.id)
              ? context.capabilityRequests.map((request) =>
                  request.id === harnessEvent.request.id ? harnessEvent.request : request
                )
              : [...context.capabilityRequests, harnessEvent.request],
            error: undefined,
            history: nextHistory,
            eventLog: nextEventLog
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
    capabilityRequests: [],
    history: [],
    eventLog: []
  },
  states: {
    idle: {
      on: {
        "runtime.hydrated": {
          actions: "hydrateSnapshot"
        },
        "runtime.error": {
          target: "error",
          actions: "recordRuntimeError"
        },
        "runtime.connect": {
          target: "connecting",
          actions: "prepareConnect"
        }
      }
    },
    connecting: {
      on: {
        "runtime.connected": {
          target: "active",
          actions: "recordRuntimeLifecycle"
        },
        "runtime.harness": {
          target: "active",
          actions: "reduceHarnessEvent"
        },
        "runtime.error": {
          target: "error",
          actions: "recordRuntimeError"
        }
      }
    },
    active: {
      on: {
        "runtime.client": {
          actions: "recordClientEvent",
          target: "active"
        },
        "runtime.harness": {
          actions: "reduceHarnessEvent",
          target: "active"
        },
        "runtime.connected": {
          actions: "recordRuntimeLifecycle",
          target: "active"
        },
        "runtime.disconnected": {
          target: "idle",
          actions: "recordRuntimeLifecycle"
        },
        "runtime.error": {
          target: "error",
          actions: "recordRuntimeError"
        }
      }
    },
    completed: {
      on: {
        "runtime.connect": {
          target: "connecting",
          actions: "prepareConnect"
        },
        "runtime.disconnected": {
          target: "idle",
          actions: "recordRuntimeLifecycle"
        }
      }
    },
    error: {
      on: {
        "runtime.connect": {
          target: "connecting",
          actions: "prepareConnect"
        },
        "runtime.disconnected": {
          target: "idle",
          actions: "recordRuntimeLifecycle"
        }
      }
    }
  }
});

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export interface AgentRuntimeProviderProps {
  harness: HarnessAdapter;
  children: ReactNode;
  options?: AgentRuntimeOptions;
}

export function AgentRuntimeProvider({ harness, children, options }: AgentRuntimeProviderProps) {
  const [state, send] = useMachine(runtimeMachine);
  const persistenceLoadedRef = useRef(false);
  const persistence = options?.persistence;

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    void (async () => {
      try {
        const snapshot = await Promise.resolve(persistence?.load?.());

        if (!active) {
          return;
        }

        if (snapshot) {
          send({ type: "runtime.hydrated", snapshot });
        }
      } catch (error) {
        if (active) {
          send({
            type: "runtime.error",
            message: error instanceof Error ? error.message : "Failed to load runtime snapshot"
          });
        }
      } finally {
        if (!active) {
          return;
        }

        persistenceLoadedRef.current = true;
      }

      if (!active) {
        return;
      }

      send({ type: "runtime.connect" });
      unsubscribe = harness.subscribe((event) => {
        if (!active) {
          return;
        }

        send({ type: "runtime.harness", event });
      });

      try {
        await harness.connect();

        if (!active) {
          return;
        }

        send({ type: "runtime.connected" });
      } catch (error) {
        if (!active) {
          return;
        }

        send({
          type: "runtime.error",
          message: error instanceof Error ? error.message : "Failed to connect harness"
        });
      }
    })();

    return () => {
      active = false;
      unsubscribe();
      void harness.disconnect();
      send({ type: "runtime.disconnected" });
    };
  }, [harness, persistence, send]);

  useEffect(() => {
    if (!persistence || !persistenceLoadedRef.current) {
      return;
    }

    void persistence.save(buildRuntimeSnapshot(state.context));
  }, [persistence, state.context]);

  const flow = deriveRuntimeFlowState(state.context, state.context.capabilityRequests);

  const value: RuntimeContextValue = {
    phase: state.value,
    status: state.context.status,
    sessionId: state.context.sessionId,
    screen: state.context.screen,
    screenMode: deriveScreenMode(
      state.context.screen,
      state.context.error,
      state.context.capabilityRequests
    ),
    flow,
    interaction: deriveRuntimeInteraction(
      state.context.status,
      state.context.screen,
      flow,
      state.context.capabilityRequests,
      state.context.error
    ),
    artifacts: state.context.artifacts,
    capabilityRequests: state.context.capabilityRequests,
    error: state.context.error,
    history: state.context.history,
    eventLog: state.context.eventLog,
    sendClientEvent: async (event) => {
      const correlatedEvent = ensureClientEventRequestId(event);

      send({ type: "runtime.client", event: correlatedEvent });

      try {
        await harness.send(correlatedEvent);
      } catch (error) {
        send({
          type: "runtime.error",
          message: error instanceof Error ? error.message : "Failed to send client event"
        });
        throw error;
      }
    }
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
