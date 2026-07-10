import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { assign, setup } from "xstate";
import type { HarnessAdapter } from "@selfme/unstable-ui-harness-sdk";
import {
  applyScreenPatch,
  type ArtifactRef,
  type CapabilityRequest,
  type ClientEvent,
  type HarnessEvent,
  type NavigationChange,
  resolveScreenLifecycle,
  type ScreenFlow,
  type ScreenInteraction,
  type ScreenLifecycle,
  type ScreenMode,
  type ScreenSchema,
  type TimelineItem
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
  navigation: RuntimeNavigationState;
  persistence: RuntimePersistenceState;
  transport: RuntimeTransportState;
  recovery: RuntimeRecoveryState;
  error?: string;
  eventLog: RuntimeEventLogEntry[];
  history: RuntimeHistoryEntry[];
  sendClientEvent(event: ClientEvent): Promise<void>;
  clearPersistence(): Promise<void>;
  reconnect(): Promise<void>;
  resetSession(options?: RuntimeSessionResetOptions): Promise<void>;
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
  lastCompletedRequestId?: string;
  lastFailedRequestId?: string;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  navigation?: RuntimeNavigationState;
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
  phase: "idle" | "pending" | "active" | "complete" | "failed";
  screenMode: ScreenMode;
  lifecycle: ScreenLifecycle;
  transition?: ScreenFlow["transition"];
  screenId?: string;
  lastCompletedRequestId?: string;
  lastFailedRequestId?: string;
  historyEntryCount: number;
  workspaceEventCount: number;
  patchEventCount: number;
  resourceEventCount: number;
  issueCount: number;
}

export interface RuntimeNavigationState {
  historyVisible: boolean;
  requestInspector: {
    visible: boolean;
    target: RuntimeRequestTarget;
  };
}

export interface RuntimePersistenceState {
  enabled: boolean;
  canClear: boolean;
  hydratedFromSnapshot: boolean;
  loadState: "idle" | "loading" | "ready" | "error";
  saveState: "idle" | "saving" | "ready" | "error";
  clearState: "idle" | "clearing" | "ready" | "error";
  loadCount: number;
  saveCount: number;
  clearCount: number;
  lastHydratedAt?: string;
  lastSavedAt?: string;
  lastClearedAt?: string;
  loadError?: string;
  saveError?: string;
  clearError?: string;
}

export interface RuntimeTransportState {
  connectState: "idle" | "connecting" | "connected" | "disconnected" | "error";
  connectCount: number;
  disconnectCount: number;
  reconnectCount: number;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastConnectError?: string;
}

export interface RuntimeSessionResetOptions {
  clearPersistence?: boolean;
}

export interface RuntimeRecoveryState {
  mode: "fresh" | "restored" | "reconnected" | "reset";
  resetCount: number;
  reconnectCount: number;
  lastResetAt?: string;
  lastReconnectAt?: string;
  lastRecoveryAt?: string;
  clearedPersistenceOnLastReset: boolean;
}

export interface RuntimeRequestSummary {
  requestId?: string;
  source?: RuntimeRequestSource;
  entryCount: number;
  workspaceCount: number;
  patchCount: number;
  resourceCount: number;
  issueCount: number;
  actionCount: number;
  inputCount: number;
  formCount: number;
  firstTitle?: string;
  latestTitle?: string;
  latestScreenId?: string;
  latestScreenMode?: ScreenMode;
  modePath: string;
  hasResultScreen: boolean;
  hasTaskScreen: boolean;
  hasProcessingScreen: boolean;
  hasCapability: boolean;
  hasArtifact: boolean;
  hasForm: boolean;
  hasError: boolean;
}

export interface RuntimeRequestGroup {
  requestId: string;
  source?: RuntimeRequestSource;
  entries: RuntimeHistoryEntry[];
  summary: RuntimeRequestSummary;
}

type RuntimeRequestSource = "voice" | "input" | "action" | "form";

export type RuntimeRequestTarget = "current" | "lastCompleted" | "lastFailed" | string;

export interface RuntimeResolvedRequestChain {
  target: RuntimeRequestTarget;
  requestId?: string;
  source?: RuntimeRequestSource;
  entries: RuntimeHistoryEntry[];
  resources: RuntimeHistoryEntry[];
  summary: RuntimeRequestSummary;
}

export type RuntimeRequestTimelineItem = TimelineItem;
export interface RuntimeRequestTimelineStageSummary {
  key: string;
  title: string;
  status: RuntimeRequestTimelineItem["status"];
  eventCount: number;
  resourceCount: number;
  patchCount: number;
  issueCount: number;
  startedAt?: string;
  endedAt?: string;
  latestScreenMode?: ScreenMode;
  latestTitle?: string;
  description?: string;
  meta?: string;
}
type RuntimeRequestTimelineStageKey =
  | "input"
  | "action"
  | "form"
  | "processing"
  | "task"
  | "approval"
  | "artifact"
  | "result"
  | "issue"
  | "completion"
  | "workspace";

interface RuntimeRequestTimelineStage {
  key: RuntimeRequestTimelineStageKey;
  entries: RuntimeHistoryEntry[];
}

interface RuntimeMachineContext {
  sessionId?: string;
  status: RuntimeContextValue["status"];
  screen?: ScreenSchema;
  pendingRequestId?: string;
  activeRequestId?: string;
  activeRequestSource?: RuntimeRequestSource;
  lastCompletedRequestId?: string;
  lastFailedRequestId?: string;
  artifacts: ArtifactRef[];
  capabilityRequests: CapabilityRequest[];
  navigation: RuntimeNavigationState;
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
  | { type: "runtime.reset" }
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

function createDefaultRuntimeNavigationState(): RuntimeNavigationState {
  return {
    historyVisible: false,
    requestInspector: {
      visible: false,
      target: "current"
    }
  };
}

function createDefaultRuntimePersistenceState(enabled: boolean): RuntimePersistenceState {
  return {
    enabled,
    canClear: false,
    hydratedFromSnapshot: false,
    loadState: enabled ? "loading" : "idle",
    saveState: enabled ? "idle" : "idle",
    clearState: "idle",
    loadCount: 0,
    saveCount: 0,
    clearCount: 0
  };
}

function createDefaultRuntimeTransportState(): RuntimeTransportState {
  return {
    connectState: "idle",
    connectCount: 0,
    disconnectCount: 0,
    reconnectCount: 0
  };
}

function createDefaultRuntimeRecoveryState(): RuntimeRecoveryState {
  return {
    mode: "fresh",
    resetCount: 0,
    reconnectCount: 0,
    clearedPersistenceOnLastReset: false
  };
}

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

function normalizeRuntimeRequestTarget(target?: string): RuntimeRequestTarget {
  return target || "current";
}

function reduceRuntimeNavigation(
  navigation: RuntimeNavigationState,
  change: NavigationChange
): RuntimeNavigationState {
  if (change.surface === "history") {
    const historyVisible = change.visibility === "open";

    return {
      historyVisible,
      requestInspector: historyVisible
        ? {
            ...navigation.requestInspector,
            visible: false
          }
        : navigation.requestInspector
    };
  }

  return {
    historyVisible: change.visibility === "open" ? false : navigation.historyVisible,
    requestInspector: {
      visible: change.visibility === "open",
      target:
        change.requestTarget === undefined
          ? navigation.requestInspector.target
          : normalizeRuntimeRequestTarget(change.requestTarget)
    }
  };
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
    case "error":
      return requestId
        ? {
            requestId,
            state: "failed",
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
    | "lastFailedRequestId"
    | "error"
    | "history"
  >,
  capabilityRequests: CapabilityRequest[] = []
): RuntimeRequestFlowState {
  const screenMode = deriveScreenMode(context.screen, context.error, capabilityRequests);
  const screenFlow =
    inferScreenFlow(context.screen, context as RuntimeMachineContext) ??
    (screenMode === "error" && context.lastFailedRequestId
      ? {
          requestId: context.lastFailedRequestId,
          state: "failed" as const,
          transition: "replace" as const
        }
      : undefined);
  const lifecycle = resolveScreenLifecycle({
    mode: screenMode,
    flow: screenFlow ?? context.screen?.flow
  });
  const currentRequestId = screenFlow?.requestId ?? context.pendingRequestId ?? context.activeRequestId;
  const requestSummary = summarizeRuntimeRequestHistory(context.history, currentRequestId);

  if (screenFlow?.requestId) {
    return {
      requestId: screenFlow.requestId,
      source: context.activeRequestSource,
      phase:
        screenFlow.state === "failed" ? "failed" : screenFlow.state === "complete" ? "complete" : "active",
      screenMode,
      lifecycle,
      transition: screenFlow.transition,
      screenId: context.screen?.id,
      lastCompletedRequestId: context.lastCompletedRequestId,
      lastFailedRequestId: context.lastFailedRequestId,
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
      lifecycle,
      transition: context.screen?.flow?.transition,
      screenId: context.screen?.id,
      lastCompletedRequestId: context.lastCompletedRequestId,
      lastFailedRequestId: context.lastFailedRequestId,
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
    lifecycle,
    transition: context.screen?.flow?.transition,
    screenId: context.screen?.id,
    lastCompletedRequestId: context.lastCompletedRequestId,
    lastFailedRequestId: context.lastFailedRequestId,
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

  if (flow?.phase === "pending") {
    return {
      ...nextInteraction,
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: nextInteraction.reason ?? "Waiting for the harness to begin the current request."
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
    lastCompletedRequestId: context.lastCompletedRequestId,
    lastFailedRequestId: context.lastFailedRequestId,
    artifacts: context.artifacts,
    capabilityRequests: context.capabilityRequests,
    navigation: context.navigation,
    error: context.error,
    eventLog: context.eventLog,
    history: context.history
  };
}

function createEmptyRuntimeMachineContext(): RuntimeMachineContext {
  return {
    status: "idle",
    artifacts: [],
    capabilityRequests: [],
    navigation: createDefaultRuntimeNavigationState(),
    history: [],
    eventLog: []
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

export function getRuntimeRequestEntries(
  history: RuntimeHistoryEntry[],
  requestId?: string
) {
  return requestId ? history.filter((entry) => entry.requestId === requestId) : [];
}

export function getRuntimeRequestResourceEntries(entries: RuntimeHistoryEntry[]) {
  return entries.filter((entry) => entry.kind === "artifact" || entry.kind === "capability");
}

export function summarizeRuntimeRequestEntries(
  entries: RuntimeHistoryEntry[],
  fallbackRequestId?: string
): RuntimeRequestSummary {
  const firstEntry = entries[0];
  const latestEntry = entries[entries.length - 1];
  const screenModes = entries
    .map((entry) => entry.screenMode)
    .filter((mode): mode is NonNullable<typeof mode> => Boolean(mode));
  const uniqueScreenModes = [...new Set(screenModes)];
  const workspaceCount = entries.filter((entry) => entry.kind === "workspace").length;
  const patchCount = entries.filter((entry) => entry.eventType === "screen.patched").length;
  const resourceCount = entries.filter((entry) => entry.kind === "artifact" || entry.kind === "capability").length;
  const issueCount = entries.filter((entry) => entry.kind === "error").length;
  const actionCount = entries.filter((entry) => entry.kind === "action").length;
  const inputCount = entries.filter((entry) => entry.kind === "input").length;
  const formCount = entries.filter((entry) => entry.kind === "form").length;

  return {
    requestId: latestEntry?.requestId ?? firstEntry?.requestId ?? fallbackRequestId,
    source: latestEntry?.requestSource ?? firstEntry?.requestSource,
    entryCount: entries.length,
    workspaceCount,
    patchCount,
    resourceCount,
    issueCount,
    actionCount,
    inputCount,
    formCount,
    firstTitle: firstEntry?.title,
    latestTitle: latestEntry?.title,
    latestScreenId: latestEntry?.screenId,
    latestScreenMode: latestEntry?.screenMode,
    modePath: uniqueScreenModes.length > 0 ? uniqueScreenModes.join(" -> ") : "None",
    hasResultScreen: screenModes.includes("result"),
    hasTaskScreen: screenModes.includes("task"),
    hasProcessingScreen: screenModes.includes("processing"),
    hasCapability: entries.some((entry) => entry.kind === "capability"),
    hasArtifact: entries.some((entry) => entry.kind === "artifact"),
    hasForm: entries.some((entry) => entry.kind === "form"),
    hasError: entries.some((entry) => entry.kind === "error") || screenModes.includes("error")
  };
}

export function getRuntimeCurrentRequestEntries(runtime: Pick<RuntimeContextValue, "flow" | "history">) {
  return getRuntimeRequestEntries(runtime.history, runtime.flow.requestId);
}

export function getRuntimeLastCompletedRequestEntries(runtime: Pick<RuntimeContextValue, "flow" | "history">) {
  return getRuntimeRequestEntries(runtime.history, runtime.flow.lastCompletedRequestId);
}

export function getRuntimeLastFailedRequestEntries(runtime: Pick<RuntimeContextValue, "flow" | "history">) {
  return getRuntimeRequestEntries(runtime.history, runtime.flow.lastFailedRequestId);
}

export function resolveRuntimeRequestId(
  runtime: Pick<RuntimeContextValue, "flow">,
  target: RuntimeRequestTarget = "current"
) {
  if (target === "current") {
    return runtime.flow.requestId;
  }

  if (target === "lastCompleted") {
    return runtime.flow.lastCompletedRequestId;
  }

  if (target === "lastFailed") {
    return runtime.flow.lastFailedRequestId;
  }

  return target;
}

export function getRuntimeRequestCatalog(
  history: RuntimeHistoryEntry[]
): RuntimeRequestGroup[] {
  const groups = new Map<string, RuntimeHistoryEntry[]>();

  for (const entry of history) {
    if (!entry.requestId) {
      continue;
    }

    const existing = groups.get(entry.requestId);

    if (existing) {
      existing.push(entry);
      continue;
    }

    groups.set(entry.requestId, [entry]);
  }

  return [...groups.entries()]
    .map(([requestId, entries]) => ({
      requestId,
      source: entries[entries.length - 1]?.requestSource ?? entries[0]?.requestSource,
      entries,
      summary: summarizeRuntimeRequestEntries(entries, requestId)
    }))
    .sort((left, right) =>
      (right.entries[right.entries.length - 1]?.timestamp ?? "").localeCompare(
        left.entries[left.entries.length - 1]?.timestamp ?? ""
      )
    );
}

export function getRuntimeCapabilityHistoryEntries(history: RuntimeHistoryEntry[]) {
  return history.filter((entry) => entry.kind === "capability");
}

export function getRuntimeLastCapabilityResolutionEntry(history: RuntimeHistoryEntry[]) {
  const capabilityEntries = getRuntimeCapabilityHistoryEntries(history);

  for (let index = capabilityEntries.length - 1; index >= 0; index -= 1) {
    if (capabilityEntries[index]?.eventType === "capability.resolved") {
      return capabilityEntries[index];
    }
  }

  return undefined;
}

export function getRuntimeRequestGroup(
  history: RuntimeHistoryEntry[],
  requestId?: string
) {
  if (!requestId) {
    return undefined;
  }

  const entries = getRuntimeRequestEntries(history, requestId);

  if (entries.length === 0) {
    return undefined;
  }

  return {
    requestId,
    source: entries[entries.length - 1]?.requestSource ?? entries[0]?.requestSource,
    entries,
    summary: summarizeRuntimeRequestEntries(entries, requestId)
  } satisfies RuntimeRequestGroup;
}

export function resolveRuntimeRequestChain(
  runtime: Pick<RuntimeContextValue, "flow" | "history">,
  target: RuntimeRequestTarget = "current"
): RuntimeResolvedRequestChain {
  const requestId = resolveRuntimeRequestId(runtime, target);
  const group = getRuntimeRequestGroup(runtime.history, requestId);
  const entries = group?.entries ?? [];

  return {
    target,
    requestId,
    source: group?.source,
    entries,
    resources: getRuntimeRequestResourceEntries(entries),
    summary: group?.summary ?? summarizeRuntimeRequestEntries(entries, requestId)
  };
}

function getRuntimeTimelineStageKey(entry: RuntimeHistoryEntry): RuntimeRequestTimelineStageKey {
  if (entry.kind === "error" || entry.screenMode === "error") {
    return "issue";
  }

  if (entry.kind === "artifact") {
    return "artifact";
  }

  if (entry.kind === "capability" || entry.screenMode === "approval") {
    return "approval";
  }

  if (entry.kind === "form") {
    return "form";
  }

  if (entry.kind === "action") {
    return "action";
  }

  if (entry.kind === "input") {
    return "input";
  }

  if (entry.kind === "session") {
    return "completion";
  }

  switch (entry.screenMode) {
    case "processing":
      return "processing";
    case "task":
      return "task";
    case "result":
      return "result";
    default:
      return "workspace";
  }
}

function getRuntimeTimelineStatus(
  stage: RuntimeRequestTimelineStage,
  index: number,
  stages: RuntimeRequestTimelineStage[],
  summary: RuntimeRequestSummary
): RuntimeRequestTimelineItem["status"] {
  if (stage.key === "issue") {
    return "error";
  }

  const isLastEntry = index === stages.length - 1;

  if (isLastEntry && !summary.hasResultScreen && !summary.hasError) {
    return "active";
  }

  return "complete";
}

function getRuntimeTimelineTitle(stage: RuntimeRequestTimelineStage) {
  switch (stage.key) {
    case "input":
      return "Input received";
    case "action":
      return "Action dispatched";
    case "form":
      return "Form submitted";
    case "processing":
      return "Processing";
    case "task":
      return "Task workspace";
    case "approval":
      return "Capability approval";
    case "artifact":
      return "Artifact handoff";
    case "result":
      return "Result released";
    case "issue":
      return "Issue raised";
    case "completion":
      return "Completion";
    case "workspace":
    default:
      return "Workspace update";
  }
}

function getRuntimeTimelineDescription(stage: RuntimeRequestTimelineStage) {
  const latestEntry = stage.entries[stage.entries.length - 1];

  if (!latestEntry) {
    return undefined;
  }

  if (stage.key === "artifact") {
    const titles = stage.entries.map((entry) => entry.title).filter(Boolean);
    return titles.length > 1 ? `${titles[0]} and ${titles.length - 1} more artifact event(s)` : titles[0];
  }

  if (stage.key === "approval") {
    const reasons = stage.entries.map((entry) => entry.body).filter(Boolean);
    return reasons[reasons.length - 1] ?? latestEntry.title;
  }

  if (stage.key === "issue") {
    return latestEntry.body ?? latestEntry.title;
  }

  const bodies = stage.entries.map((entry) => entry.body).filter(Boolean);

  if (bodies.length > 0) {
    return bodies[bodies.length - 1];
  }

  const titles = [...new Set(stage.entries.map((entry) => entry.title).filter(Boolean))];

  if (titles.length > 1) {
    return titles.slice(0, 3).join(" -> ");
  }

  if (latestEntry.screenMode) {
    return `Screen mode: ${latestEntry.screenMode}`;
  }

  return latestEntry.meta;
}

function getRuntimeTimelineMeta(stage: RuntimeRequestTimelineStage) {
  const firstEntry = stage.entries[0];
  const latestEntry = stage.entries[stage.entries.length - 1];

  if (!firstEntry || !latestEntry) {
    return undefined;
  }

  const firstTime = firstEntry.timestamp.slice(11, 19);
  const latestTime = latestEntry.timestamp.slice(11, 19);
  const parts = [firstTime === latestTime ? firstTime : `${firstTime} -> ${latestTime}`];

  if (latestEntry.screenMode) {
    parts.push(latestEntry.screenMode);
  }

  if (latestEntry.requestSource) {
    parts.push(latestEntry.requestSource);
  }

  parts.push(`${stage.entries.length} event${stage.entries.length === 1 ? "" : "s"}`);

  return parts.join(" · ");
}

function getRuntimeRequestTimelineStages(entries: RuntimeHistoryEntry[]) {
  const stages: RuntimeRequestTimelineStage[] = [];

  for (const entry of entries) {
    const key = getRuntimeTimelineStageKey(entry);
    const previous = stages[stages.length - 1];

    if (previous && previous.key === key) {
      previous.entries.push(entry);
      continue;
    }

    stages.push({
      key,
      entries: [entry]
    });
  }

  return stages;
}

export function getRuntimeRequestTimelineItems(
  entries: RuntimeHistoryEntry[],
  fallbackRequestId?: string,
  maxItems?: number
): RuntimeRequestTimelineItem[] {
  const stages = getRuntimeRequestTimelineStages(entries);
  const visibleStages =
    typeof maxItems === "number" && maxItems > 0 ? stages.slice(-maxItems) : stages;
  const flattenedEntries = visibleStages.flatMap((stage) => stage.entries);
  const summary = summarizeRuntimeRequestEntries(flattenedEntries, fallbackRequestId);

  return visibleStages.map((stage, index) => ({
    id: `${stage.key}-${stage.entries[0]?.id ?? index}`,
    title: getRuntimeTimelineTitle(stage),
    description: getRuntimeTimelineDescription(stage),
    status: getRuntimeTimelineStatus(stage, index, visibleStages, summary),
    meta: getRuntimeTimelineMeta(stage)
  }));
}

export function getRuntimeRequestTimelineStageSummaries(
  entries: RuntimeHistoryEntry[],
  fallbackRequestId?: string,
  maxItems?: number
): RuntimeRequestTimelineStageSummary[] {
  const stages = getRuntimeRequestTimelineStages(entries);
  const visibleStages =
    typeof maxItems === "number" && maxItems > 0 ? stages.slice(-maxItems) : stages;
  const flattenedEntries = visibleStages.flatMap((stage) => stage.entries);
  const summary = summarizeRuntimeRequestEntries(flattenedEntries, fallbackRequestId);

  return visibleStages.map((stage, index) => {
    const latestEntry = stage.entries[stage.entries.length - 1];
    const firstEntry = stage.entries[0];

    return {
      key: stage.key,
      title: getRuntimeTimelineTitle(stage),
      status: getRuntimeTimelineStatus(stage, index, visibleStages, summary),
      eventCount: stage.entries.length,
      resourceCount: stage.entries.filter((entry) => entry.kind === "artifact" || entry.kind === "capability").length,
      patchCount: stage.entries.filter((entry) => entry.eventType === "screen.patched").length,
      issueCount: stage.entries.filter((entry) => entry.kind === "error").length,
      startedAt: firstEntry?.timestamp,
      endedAt: latestEntry?.timestamp,
      latestScreenMode: latestEntry?.screenMode,
      latestTitle: latestEntry?.title,
      description: getRuntimeTimelineDescription(stage),
      meta: getRuntimeTimelineMeta(stage)
    };
  });
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
    case "navigation.changed":
      return createRuntimeHistoryEntry("system", "session", "Navigation changed", {
        body:
          event.navigation.surface === "request-inspector"
            ? normalizeRuntimeRequestTarget(event.navigation.requestTarget)
            : undefined,
        meta: `${event.navigation.surface}:${event.navigation.visibility}`,
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
    case "navigation.updated":
      return createRuntimeHistoryEntry("system", "session", "Navigation synced", {
        body:
          event.navigation.surface === "request-inspector"
            ? normalizeRuntimeRequestTarget(event.navigation.requestTarget)
            : undefined,
        meta: `${event.navigation.surface}:${event.navigation.visibility}`,
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
    const lifecycle = resolveScreenLifecycle(screen);

    if (lifecycle.role === "root") {
      return {
        pendingRequestId: undefined,
        activeRequestId: undefined,
        activeRequestSource: undefined,
        lastCompletedRequestId: context.lastCompletedRequestId,
        lastFailedRequestId: context.lastFailedRequestId
      };
    }

    return {
      pendingRequestId: context.pendingRequestId,
      activeRequestId: context.activeRequestId,
      activeRequestSource: context.activeRequestSource,
      lastCompletedRequestId: context.lastCompletedRequestId,
      lastFailedRequestId: context.lastFailedRequestId
    };
  }

  if (flow.state === "complete") {
    return {
      pendingRequestId: undefined,
      activeRequestId: undefined,
      activeRequestSource: undefined,
      lastCompletedRequestId: flow.requestId ?? context.activeRequestId ?? context.pendingRequestId ?? context.lastCompletedRequestId,
      lastFailedRequestId: context.lastFailedRequestId
    };
  }

  if (flow.state === "failed") {
    return {
      pendingRequestId: undefined,
      activeRequestId: undefined,
      activeRequestSource: undefined,
      lastCompletedRequestId: context.lastCompletedRequestId,
      lastFailedRequestId: flow.requestId ?? context.activeRequestId ?? context.pendingRequestId ?? context.lastFailedRequestId
    };
  }

  return {
    pendingRequestId: undefined,
    activeRequestId: flow.requestId ?? context.pendingRequestId ?? context.activeRequestId,
    activeRequestSource: context.activeRequestSource,
    lastCompletedRequestId: context.lastCompletedRequestId,
    lastFailedRequestId: context.lastFailedRequestId
  };
}

const runtimeMachine = setup({
  types: {
    context: {} as RuntimeMachineContext,
    events: {} as RuntimeMachineEvent
  },
  actions: {
    prepareConnect: assign({
      error: () => undefined,
      eventLog: ({ context }) =>
        appendRuntimeLog(
          context.eventLog,
          createRuntimeLogEntry("runtime", "runtime.connect", {}),
          defaultEventLogLimit
        )
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
        navigation: event.snapshot.navigation ?? context.navigation,
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
    resetRuntimeState: assign(({ context, event }) => {
      if (event.type !== "runtime.reset") {
        return context;
      }

      return {
        ...createEmptyRuntimeMachineContext(),
        eventLog: appendRuntimeLog(
          [],
          createRuntimeLogEntry("runtime", "runtime.reset", {}),
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
      lastFailedRequestId: ({ context, event }) =>
        event.type === "runtime.error"
          ? context.pendingRequestId ?? context.activeRequestId ?? context.lastFailedRequestId
          : context.lastFailedRequestId,
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
        navigation:
          clientEvent.type === "navigation.changed"
            ? reduceRuntimeNavigation(context.navigation, clientEvent.navigation)
            : context.navigation,
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
            lastFailedRequestId: undefined,
            navigation: createDefaultRuntimeNavigationState(),
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
        case "navigation.updated":
          return {
            ...context,
            navigation: reduceRuntimeNavigation(context.navigation, harnessEvent.navigation),
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
            lastFailedRequestId:
              context.pendingRequestId ?? context.activeRequestId ?? context.lastFailedRequestId,
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
    navigation: createDefaultRuntimeNavigationState(),
    history: [],
    eventLog: []
  },
  states: {
    idle: {
      on: {
        "runtime.hydrated": {
          actions: "hydrateSnapshot"
        },
        "runtime.reset": {
          actions: "resetRuntimeState"
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
        "runtime.reset": {
          target: "idle",
          actions: "resetRuntimeState"
        },
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
        "runtime.reset": {
          target: "idle",
          actions: "resetRuntimeState"
        },
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
        "runtime.reset": {
          target: "idle",
          actions: "resetRuntimeState"
        },
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
        "runtime.reset": {
          target: "idle",
          actions: "resetRuntimeState"
        },
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
  const saveOperationRef = useRef(0);
  const clearOperationRef = useRef(0);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const persistence = options?.persistence;
  const [persistenceState, setPersistenceState] = useState<RuntimePersistenceState>(
    createDefaultRuntimePersistenceState(Boolean(persistence))
  );
  const [transportState, setTransportState] = useState<RuntimeTransportState>(
    createDefaultRuntimeTransportState()
  );
  const [recoveryState, setRecoveryState] = useState<RuntimeRecoveryState>(
    createDefaultRuntimeRecoveryState()
  );

  useEffect(() => {
    persistenceLoadedRef.current = false;
    setPersistenceState(createDefaultRuntimePersistenceState(Boolean(persistence)));
    setTransportState(createDefaultRuntimeTransportState());
    setRecoveryState(createDefaultRuntimeRecoveryState());
  }, [persistence]);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    void (async () => {
      try {
        if (persistence) {
          setPersistenceState((current) => ({
            ...current,
            enabled: true,
            canClear: typeof persistence.clear === "function",
            loadState: "loading",
            loadError: undefined,
            clearError: undefined
          }));
        }

        const snapshot = await Promise.resolve(persistence?.load?.());

        if (!active) {
          return;
        }

        if (snapshot) {
          send({ type: "runtime.hydrated", snapshot });
        }

        if (snapshot) {
          const recoveredAt = new Date().toISOString();
          setRecoveryState((current) => ({
            ...current,
            mode: "restored",
            lastRecoveryAt: recoveredAt
          }));
        }

        setPersistenceState((current) => ({
          ...current,
          enabled: Boolean(persistence),
          canClear: typeof persistence?.clear === "function",
          hydratedFromSnapshot: Boolean(snapshot),
          loadState: persistence ? "ready" : current.loadState,
          loadCount: persistence ? current.loadCount + 1 : current.loadCount,
          lastHydratedAt: snapshot ? new Date().toISOString() : current.lastHydratedAt,
          loadError: undefined
        }));
      } catch (error) {
        if (active) {
          setPersistenceState((current) => ({
            ...current,
            enabled: Boolean(persistence),
            canClear: typeof persistence?.clear === "function",
            loadState: "error",
            loadCount: persistence ? current.loadCount + 1 : current.loadCount,
            loadError: error instanceof Error ? error.message : "Failed to load runtime snapshot"
          }));
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

      setTransportState((current) => ({
        ...current,
        connectState: "connecting",
        connectCount: current.connectCount + 1,
        lastConnectError: undefined
      }));

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

        setTransportState((current) => ({
          ...current,
          connectState: "connected",
          lastConnectedAt: new Date().toISOString(),
          lastConnectError: undefined
        }));
        send({ type: "runtime.connected" });
      } catch (error) {
        if (!active) {
          return;
        }

        setTransportState((current) => ({
          ...current,
          connectState: "error",
          lastConnectError: error instanceof Error ? error.message : "Failed to connect harness"
        }));
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
  }, [connectionEpoch, harness, persistence, send]);

  useEffect(() => {
    if (!persistence || !persistenceLoadedRef.current) {
      return;
    }

    const operationId = saveOperationRef.current + 1;
    saveOperationRef.current = operationId;

    setPersistenceState((current) => ({
      ...current,
      enabled: true,
      saveState: "saving",
      saveError: undefined
    }));

    void Promise.resolve(persistence.save(buildRuntimeSnapshot(state.context)))
      .then(() => {
        if (saveOperationRef.current !== operationId) {
          return;
        }

        setPersistenceState((current) => ({
          ...current,
          saveState: "ready",
          saveCount: current.saveCount + 1,
          lastSavedAt: new Date().toISOString(),
          saveError: undefined
        }));
      })
      .catch((error) => {
        if (saveOperationRef.current !== operationId) {
          return;
        }

        setPersistenceState((current) => ({
          ...current,
          saveState: "error",
          saveError: error instanceof Error ? error.message : "Failed to save runtime snapshot"
        }));
      });
  }, [persistence, state.context]);

  async function clearPersistence() {
    if (!persistence) {
      return;
    }

    if (typeof persistence.clear !== "function") {
      setPersistenceState((current) => ({
        ...current,
        enabled: true,
        canClear: false,
        clearState: "error",
        clearError: "Persistence adapter does not implement clear()."
      }));
      return;
    }

    const operationId = clearOperationRef.current + 1;
    clearOperationRef.current = operationId;

    setPersistenceState((current) => ({
      ...current,
      enabled: true,
      canClear: true,
      clearState: "clearing",
      clearError: undefined
    }));

    try {
      await Promise.resolve(persistence.clear());

      if (clearOperationRef.current !== operationId) {
        return;
      }

      setPersistenceState((current) => ({
        ...current,
        hydratedFromSnapshot: false,
        clearState: "ready",
        clearCount: current.clearCount + 1,
        lastClearedAt: new Date().toISOString(),
        clearError: undefined
      }));
    } catch (error) {
      if (clearOperationRef.current !== operationId) {
        return;
      }

      setPersistenceState((current) => ({
        ...current,
        clearState: "error",
        clearError: error instanceof Error ? error.message : "Failed to clear runtime snapshot"
      }));
    }
  }

  async function reconnect() {
    const reconnectedAt = new Date().toISOString();
    setTransportState((current) => ({
      ...current,
      connectState: "disconnected",
      disconnectCount: current.disconnectCount + 1,
      lastDisconnectedAt: new Date().toISOString(),
      reconnectCount: current.reconnectCount + 1
    }));
    setRecoveryState((current) => ({
      ...current,
      mode: current.mode === "reset" ? "reset" : "reconnected",
      reconnectCount: current.reconnectCount + 1,
      lastReconnectAt: reconnectedAt,
      lastRecoveryAt: reconnectedAt
    }));
    setConnectionEpoch((current) => current + 1);
  }

  async function resetSession(options?: RuntimeSessionResetOptions) {
    const resetAt = new Date().toISOString();

    if (options?.clearPersistence) {
      await clearPersistence();
    }

    setRecoveryState((current) => ({
      ...current,
      mode: "reset",
      resetCount: current.resetCount + 1,
      lastResetAt: resetAt,
      lastRecoveryAt: resetAt,
      clearedPersistenceOnLastReset: Boolean(options?.clearPersistence)
    }));
    send({ type: "runtime.reset" });
    await reconnect();
  }

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
    navigation: state.context.navigation,
    persistence: persistenceState,
    transport: transportState,
    recovery: recoveryState,
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
    },
    clearPersistence,
    reconnect,
    resetSession
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
