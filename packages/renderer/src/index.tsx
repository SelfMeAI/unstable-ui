import { forwardRef, type ReactNode, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type ViewStyle,
  View
} from "react-native";
import { CoreBlock } from "@selfme/unstable-ui-core-blocks";
import type { HarnessAdapter } from "@selfme/unstable-ui-harness-sdk";
import type {
  ActionItem,
  ArtifactRef,
  Block,
  CapabilityRequest,
  ClientEvent,
  DetailsBlock,
  DetailItem,
  LogBlock,
  LogItem,
  NavigationChange,
  RequestTarget,
  ScreenFlowTransition
} from "@selfme/unstable-ui-protocol";
import {
  AgentRuntimeProvider,
  getRuntimeCapabilityHistoryEntries,
  getRuntimeCurrentRequestEntries,
  getRuntimeLastCapabilityResolutionEntry,
  getRuntimeRequestCatalog,
  getRuntimeRequestResourceEntries,
  getRuntimeRequestTimelineStageSummaries,
  getRuntimeRequestTimelineItems,
  resolveRuntimeRequestChain,
  summarizeRuntimeRequestEntries,
  useAgentRuntime,
  type AgentRuntimeOptions,
  type RuntimeContextValue,
  type RuntimeEventLogEntry,
  type RuntimeRequestSummary,
  type RuntimeRequestTarget
} from "@selfme/unstable-ui-runtime";

const defaultMockTranscripts = [
  "Plan my day around two deep work blocks and one gym session.",
  "Summarize the last task and show me the next three actions.",
  "Create a quick follow-up draft for the latest conversation."
];

const defaultRecentInputPreviewDurationMs = 2400;

function getShellBottomReserve(inputMode: "voice" | "text", hasRecentInput: boolean) {
  if (inputMode === "text") {
    return hasRecentInput ? 306 : 196;
  }

  return hasRecentInput ? 296 : 186;
}

export interface VoiceShellOptions {
  enabled?: boolean;
  defaultInputMode?: "voice" | "text";
  promptLabel?: string;
  idleLabel?: string;
  listeningLabel?: string;
  textPlaceholder?: string;
  talkButtonLabel?: string;
  listeningButtonLabel?: string;
  textSubmitLabel?: string;
  mockTranscripts?: string[];
  recentInputEnabled?: boolean;
  recentInputDefaultVisible?: boolean;
  autoPreviewRecentInputOnSubmit?: boolean;
  collapseRecentInputOnModeSwitch?: boolean;
  recentInputPreviewDurationMs?: number;
  recentInputMaxLines?: number;
  recentInputHeadingLabel?: string;
  recentInputCollapsedLabel?: string;
  recentInputExpandedLabel?: string;
  voiceModeChipLabel?: string;
  textModeChipLabel?: string;
}

export interface VoiceShellRenderProps {
  disabled: boolean;
  inputMode: "voice" | "text";
  isListening: boolean;
  statusLabel: string;
  promptLabel: string;
  actionLabel: string;
  secondaryActionLabel: string;
  textValue: string;
  textPlaceholder: string;
  submitDisabled: boolean;
  talkButtonLabel: string;
  listeningButtonLabel: string;
  textSubmitLabel: string;
  lastTranscript?: string;
  lastInput?: string;
  lastInputMode?: "voice" | "text";
  recentInputHeadingLabel: string;
  recentInputMaxLines: number;
  recentInputCollapsedLabel: string;
  recentInputExpandedLabel: string;
  voiceModeChipLabel: string;
  textModeChipLabel: string;
  showRecentInput: boolean;
  onPressIn(): void;
  onPressOut(): void;
  onToggleInputMode(): void;
  onToggleRecentInput(): void;
  onChangeText(value: string): void;
  onSubmitText(): void;
}

interface ResolvedVoiceShellConfig {
  enabled: boolean;
  defaultInputMode: "voice" | "text";
  promptLabel: string;
  idleLabel: string;
  listeningLabel: string;
  textPlaceholder: string;
  talkButtonLabel: string;
  listeningButtonLabel: string;
  textSubmitLabel: string;
  mockTranscripts: string[];
  recentInputEnabled: boolean;
  recentInputDefaultVisible: boolean;
  autoPreviewRecentInputOnSubmit: boolean;
  collapseRecentInputOnModeSwitch: boolean;
  recentInputPreviewDurationMs: number;
  recentInputMaxLines: number;
  recentInputHeadingLabel: string;
  recentInputCollapsedLabel: string;
  recentInputExpandedLabel: string;
  voiceModeChipLabel: string;
  textModeChipLabel: string;
}

interface UseVoiceShellStateArgs {
  config: ResolvedVoiceShellConfig;
  runtimeStatus: string;
  shellLocked: boolean;
  onSubmit(mode: "voice" | "text", value?: string): Promise<void>;
}

interface UseVoiceShellStateResult {
  inputMode: "voice" | "text";
  isListening: boolean;
  lastInput?: string;
  lastInputMode?: "voice" | "text";
  lastTranscript?: string;
  promptLabel: string;
  idleLabel: string;
  textPlaceholder: string;
  talkButtonLabel: string;
  listeningButtonLabel: string;
  textSubmitLabel: string;
  recentInputHeadingLabel: string;
  recentInputMaxLines: number;
  recentInputCollapsedLabel: string;
  recentInputExpandedLabel: string;
  voiceModeChipLabel: string;
  textModeChipLabel: string;
  statusLabel: string;
  shellEnabled: boolean;
  showRecentInput: boolean;
  bottomReserve: number;
  shellProps: VoiceShellRenderProps;
}

function resolveVoiceShellConfig(voiceShell?: VoiceShellOptions): ResolvedVoiceShellConfig {
  return {
    enabled: voiceShell?.enabled ?? true,
    defaultInputMode: voiceShell?.defaultInputMode ?? "voice",
    promptLabel:
      voiceShell?.promptLabel ?? "Hold to talk. Voice input is mocked until the microphone bridge is implemented.",
    idleLabel: voiceShell?.idleLabel ?? "Press and hold to talk",
    listeningLabel: voiceShell?.listeningLabel ?? "Listening",
    textPlaceholder: voiceShell?.textPlaceholder ?? "Type a request for the harness",
    talkButtonLabel: voiceShell?.talkButtonLabel ?? "Talk",
    listeningButtonLabel: voiceShell?.listeningButtonLabel ?? "Send",
    textSubmitLabel: voiceShell?.textSubmitLabel ?? "Send",
    mockTranscripts: voiceShell?.mockTranscripts?.length ? voiceShell.mockTranscripts : defaultMockTranscripts,
    recentInputEnabled: voiceShell?.recentInputEnabled ?? true,
    recentInputDefaultVisible: voiceShell?.recentInputEnabled === false ? false : (voiceShell?.recentInputDefaultVisible ?? false),
    autoPreviewRecentInputOnSubmit: voiceShell?.autoPreviewRecentInputOnSubmit ?? true,
    collapseRecentInputOnModeSwitch: voiceShell?.collapseRecentInputOnModeSwitch ?? true,
    recentInputPreviewDurationMs:
      voiceShell?.recentInputPreviewDurationMs ?? defaultRecentInputPreviewDurationMs,
    recentInputMaxLines: voiceShell?.recentInputMaxLines ?? 2,
    recentInputHeadingLabel: voiceShell?.recentInputHeadingLabel ?? "Last",
    recentInputCollapsedLabel: voiceShell?.recentInputCollapsedLabel ?? "LAST",
    recentInputExpandedLabel: voiceShell?.recentInputExpandedLabel ?? "HIDE",
    voiceModeChipLabel: voiceShell?.voiceModeChipLabel ?? "MIC",
    textModeChipLabel: voiceShell?.textModeChipLabel ?? "TXT"
  };
}

function useVoiceShellState({
  config,
  runtimeStatus,
  shellLocked,
  onSubmit
}: UseVoiceShellStateArgs): UseVoiceShellStateResult {
  const [inputMode, setInputMode] = useState<"voice" | "text">(config.defaultInputMode);
  const [isListening, setIsListening] = useState(false);
  const [showRecentInput, setShowRecentInput] = useState(config.recentInputDefaultVisible);
  const [textValue, setTextValue] = useState("");
  const [lastInput, setLastInput] = useState<string>();
  const [lastInputMode, setLastInputMode] = useState<"voice" | "text">();
  const [lastTranscript, setLastTranscript] = useState<string>();
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  const recentInputHideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function clearRecentInputHideTimer() {
    if (recentInputHideTimerRef.current) {
      clearTimeout(recentInputHideTimerRef.current);
      recentInputHideTimerRef.current = undefined;
    }
  }

  function revealRecentInputTemporarily() {
    if (!config.recentInputEnabled || !config.autoPreviewRecentInputOnSubmit) {
      return;
    }

    clearRecentInputHideTimer();
    setShowRecentInput(true);
    recentInputHideTimerRef.current = setTimeout(() => {
      setShowRecentInput(false);
      recentInputHideTimerRef.current = undefined;
    }, config.recentInputPreviewDurationMs);
  }

  async function handleVoiceCommit() {
    if (!config.enabled || shellLocked || !isListening) {
      return;
    }

    setIsListening(false);

    const transcript = config.mockTranscripts[transcriptIndex % config.mockTranscripts.length];
    setTranscriptIndex((value) => value + 1);
    setLastTranscript(transcript);
    setLastInput(transcript);
    setLastInputMode("voice");
    revealRecentInputTemporarily();

    await onSubmit("voice", transcript);
  }

  async function handleTextSubmit() {
    if (!config.enabled || shellLocked) {
      return;
    }

    const nextText = textValue.trim();

    if (!nextText) {
      return;
    }

    setLastInput(nextText);
    setLastInputMode("text");
    setTextValue("");
    revealRecentInputTemporarily();

    await onSubmit("text", nextText);
  }

  useEffect(() => {
    return () => {
      clearRecentInputHideTimer();
    };
  }, []);

  useEffect(() => {
    if (!config.enabled && isListening) {
      setIsListening(false);
    }
  }, [config.enabled, isListening]);

  useEffect(() => {
    if (!config.recentInputEnabled) {
      clearRecentInputHideTimer();
      setShowRecentInput(false);
    }
  }, [config.recentInputEnabled]);

  useEffect(() => {
    if (isListening || textValue.trim()) {
      return;
    }

    setInputMode((value) => (value === config.defaultInputMode ? value : config.defaultInputMode));
  }, [config.defaultInputMode, isListening, textValue]);

  const visibleRecentInput = config.recentInputEnabled && showRecentInput;
  const bottomReserve = getShellBottomReserve(inputMode, Boolean((lastInput ?? lastTranscript) && visibleRecentInput));
  const statusLabel = isListening ? config.listeningLabel : runtimeStatus;
  const idleLabel = config.idleLabel;
  const promptLabel = config.promptLabel;
  const textPlaceholder = config.textPlaceholder;
  const talkButtonLabel = config.talkButtonLabel;
  const listeningButtonLabel = config.listeningButtonLabel;
  const textSubmitLabel = config.textSubmitLabel;
  const recentInputHeadingLabel = config.recentInputHeadingLabel;
  const recentInputMaxLines = config.recentInputMaxLines;
  const recentInputCollapsedLabel = config.recentInputCollapsedLabel;
  const recentInputExpandedLabel = config.recentInputExpandedLabel;
  const voiceModeChipLabel = config.voiceModeChipLabel;
  const textModeChipLabel = config.textModeChipLabel;

  const shellProps: VoiceShellRenderProps = {
    disabled: !config.enabled || shellLocked,
    inputMode,
    isListening,
    statusLabel,
    promptLabel,
    actionLabel: isListening ? config.listeningLabel : idleLabel,
    secondaryActionLabel: inputMode === "voice" ? "Type instead" : "Use voice",
    textValue,
    textPlaceholder,
    submitDisabled: !textValue.trim(),
    talkButtonLabel,
    listeningButtonLabel,
    textSubmitLabel,
    lastTranscript,
    lastInput,
    lastInputMode,
    recentInputHeadingLabel,
    recentInputMaxLines,
    recentInputCollapsedLabel,
    recentInputExpandedLabel,
    voiceModeChipLabel,
    textModeChipLabel,
    showRecentInput: visibleRecentInput,
    onPressIn: () => {
      if (!config.enabled || shellLocked || inputMode !== "voice") {
        return;
      }

      setIsListening(true);
    },
    onPressOut: () => {
      if (inputMode !== "voice") {
        return;
      }

      void handleVoiceCommit();
    },
    onToggleInputMode: () => {
      if (shellLocked) {
        return;
      }

      setIsListening(false);

      if (config.collapseRecentInputOnModeSwitch) {
        clearRecentInputHideTimer();
        if (config.recentInputEnabled) {
          setShowRecentInput(false);
        }
      }

      setInputMode((value) => (value === "voice" ? "text" : "voice"));
    },
    onToggleRecentInput: () => {
      if (!config.recentInputEnabled) {
        return;
      }

      clearRecentInputHideTimer();
      setShowRecentInput((value) => !value);
    },
    onChangeText: (value) => {
      setTextValue(value);
    },
    onSubmitText: () => {
      void handleTextSubmit();
    }
  };

  return {
    inputMode,
    isListening,
    lastInput,
    lastInputMode,
    lastTranscript,
    promptLabel,
    idleLabel,
    textPlaceholder,
    talkButtonLabel,
    listeningButtonLabel,
    textSubmitLabel,
    recentInputHeadingLabel,
    recentInputMaxLines,
    recentInputCollapsedLabel,
    recentInputExpandedLabel,
    voiceModeChipLabel,
    textModeChipLabel,
    statusLabel,
    shellEnabled: config.enabled,
    showRecentInput: visibleRecentInput,
    bottomReserve,
    shellProps
  };
}

export interface ArtifactPreviewField {
  label: string;
  value: string;
}

export interface ArtifactPreviewDescriptor {
  title?: string;
  description?: string;
  fields?: ArtifactPreviewField[];
  openLabel?: string;
  contentType?: "text" | "summary" | "image";
  content?: string;
  thumbnailUri?: string;
}

export interface ArtifactHandlerContext {
  openWithSystem(): Promise<void>;
  shareWithSystem(): Promise<void>;
  downloadWithSystem(): Promise<void>;
}

type MaybePromise<T> = T | Promise<T>;

export interface ArtifactHandler {
  preview?: (artifact: ArtifactRef) => ArtifactPreviewDescriptor | undefined | Promise<ArtifactPreviewDescriptor | undefined>;
  open?: (artifact: ArtifactRef, context: ArtifactHandlerContext) => void | Promise<void>;
  share?: (artifact: ArtifactRef, context: ArtifactHandlerContext) => void | Promise<void>;
  download?: (artifact: ArtifactRef, context: ArtifactHandlerContext) => void | Promise<void>;
}

export type ArtifactHandlers = Partial<Record<ArtifactRef["kind"], ArtifactHandler>>;

export type ArtifactPreviewRegistry = Partial<
  Record<
    ArtifactRef["kind"],
    ArtifactPreviewDescriptor | ((artifact: ArtifactRef) => MaybePromise<ArtifactPreviewDescriptor | undefined>)
  >
>;

export function createArtifactPreviewHandlers(previews: ArtifactPreviewRegistry): ArtifactHandlers {
  const handlers: ArtifactHandlers = {};

  for (const [kind, preview] of Object.entries(previews) as Array<[ArtifactRef["kind"], ArtifactPreviewRegistry[ArtifactRef["kind"]]]>) {
    if (!preview) {
      continue;
    }

    handlers[kind] = {
      preview:
        typeof preview === "function"
          ? (artifact) => preview(artifact)
          : () => preview
    };
  }

  return handlers;
}

export interface CapabilityPromptField {
  label: string;
  value: string;
}

export interface CapabilityPromptDescriptor {
  title?: string;
  description?: string;
  reasonLabel?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  fields?: CapabilityPromptField[];
}

export interface CapabilityResolution {
  payload?: Record<string, unknown>;
}

export interface CapabilityHandler {
  describe?: (
    request: CapabilityRequest
  ) => CapabilityPromptDescriptor | undefined | Promise<CapabilityPromptDescriptor | undefined>;
  resolve?: (
    request: CapabilityRequest,
    granted: boolean
  ) => CapabilityResolution | undefined | Promise<CapabilityResolution | undefined>;
}

export type CapabilityHandlers = Partial<Record<CapabilityRequest["capability"], CapabilityHandler>>;

export interface CapabilityHandlerPresetContext {
  defaultPayload: Record<string, unknown>;
}

export interface CapabilityHandlerPreset {
  describe?:
    | CapabilityPromptDescriptor
    | ((request: CapabilityRequest) => MaybePromise<CapabilityPromptDescriptor | undefined>);
  resolvePayload?:
    | Record<string, unknown>
    | ((
        request: CapabilityRequest,
        granted: boolean,
        context: CapabilityHandlerPresetContext
      ) => MaybePromise<Record<string, unknown> | undefined>);
  mergeDefaultPayload?: boolean;
}

export type CapabilityHandlerPresets = Partial<Record<CapabilityRequest["capability"], CapabilityHandlerPreset>>;

export function createCapabilityHandlers(presets: CapabilityHandlerPresets): CapabilityHandlers {
  const handlers: CapabilityHandlers = {};

  for (const [capability, preset] of Object.entries(presets) as Array<
    [CapabilityRequest["capability"], CapabilityHandlerPresets[CapabilityRequest["capability"]]]
  >) {
    if (!preset) {
      continue;
    }

    const describe = preset.describe;
    const resolvePayload = preset.resolvePayload;
    let describeHandler: CapabilityHandler["describe"];
    let resolveHandler: CapabilityHandler["resolve"];

    if (describe !== undefined) {
      if (typeof describe === "function") {
        const describeFactory = describe;
        describeHandler = (request) => describeFactory(request);
      } else {
        const describeDescriptor = describe;
        describeHandler = () => describeDescriptor;
      }
    }

    if (resolvePayload !== undefined) {
      if (typeof resolvePayload === "function") {
        const resolvePayloadFactory = resolvePayload;
        resolveHandler = async (request, granted) => {
          const defaultPayload = granted
            ? createDefaultMockCapabilityPayload(request)
            : createDefaultDeniedCapabilityPayload(request);
          const nextPayload = await resolvePayloadFactory(request, granted, {
            defaultPayload
          });

          if (nextPayload === undefined) {
            return {
              payload: defaultPayload
            };
          }

          return {
            payload:
              preset.mergeDefaultPayload === false
                ? nextPayload
                : {
                    ...defaultPayload,
                    ...nextPayload
                  }
          };
        };
      } else {
        const staticPayload = resolvePayload;
        resolveHandler = async (request, granted) => {
          const defaultPayload = granted
            ? createDefaultMockCapabilityPayload(request)
            : createDefaultDeniedCapabilityPayload(request);

          return {
            payload:
              preset.mergeDefaultPayload === false
                ? staticPayload
                : {
                    ...defaultPayload,
                    ...staticPayload
                  }
          };
        };
      }
    }

    handlers[capability] = {
      describe: describeHandler,
      resolve: resolveHandler
    };
  }

  return handlers;
}

export interface HostBridgeOpenUrlContext {
  reason: "artifact-open" | "artifact-download" | "capability-open-url";
  artifact?: ArtifactRef;
  capabilityRequest?: CapabilityRequest;
}

export interface HostBridgeShareContext {
  reason: "artifact-share" | "capability-share";
  artifact?: ArtifactRef;
  capabilityRequest?: CapabilityRequest;
}

export interface HostBridgeCapabilityContext {
  defaultPayload?: Record<string, unknown>;
}

export interface HostBridge {
  openUrl?: (url: string, context: HostBridgeOpenUrlContext) => void | Promise<void>;
  share?: (
    payload: { title?: string; message?: string; url?: string },
    context: HostBridgeShareContext
  ) => void | Promise<void>;
  resolveCapability?: (
    request: CapabilityRequest,
    granted: boolean,
    context: HostBridgeCapabilityContext
  ) => CapabilityResolution | undefined | Promise<CapabilityResolution | undefined>;
}

export interface HostBridgePreset {
  openUrl?: HostBridge["openUrl"];
  share?: HostBridge["share"];
  resolveCapabilityPayload?:
    | Record<string, unknown>
    | ((
        request: CapabilityRequest,
        granted: boolean,
        context: HostBridgeCapabilityContext
      ) => MaybePromise<Record<string, unknown> | undefined>);
  mergeDefaultPayload?: boolean;
}

export function createHostBridge(preset: HostBridgePreset): HostBridge {
  const bridge: HostBridge = {};

  if (preset.openUrl) {
    bridge.openUrl = preset.openUrl;
  }

  if (preset.share) {
    bridge.share = preset.share;
  }

  if (preset.resolveCapabilityPayload !== undefined) {
    const resolveCapabilityPayload = preset.resolveCapabilityPayload;

    bridge.resolveCapability = async (request, granted, context) => {
      const defaultPayload =
        context.defaultPayload ??
        (granted ? createDefaultMockCapabilityPayload(request) : createDefaultDeniedCapabilityPayload(request));
      const nextPayload =
        typeof resolveCapabilityPayload === "function"
          ? await resolveCapabilityPayload(request, granted, {
              defaultPayload
            })
          : resolveCapabilityPayload;

      if (nextPayload === undefined) {
        return {
          payload: defaultPayload
        };
      }

      return {
        payload:
          preset.mergeDefaultPayload === false
            ? nextPayload
            : {
                ...defaultPayload,
                ...nextPayload
              }
      };
    };
  }

  return bridge;
}

export interface HostIntegration {
  artifactHandlers?: ArtifactHandlers;
  capabilityHandlers?: CapabilityHandlers;
  hostBridge?: HostBridge;
}

export interface HostIntegrationPreset {
  artifactPreviews?: ArtifactPreviewRegistry;
  capabilityPresets?: CapabilityHandlerPresets;
  hostBridgePreset?: HostBridgePreset;
  artifactHandlers?: ArtifactHandlers;
  capabilityHandlers?: CapabilityHandlers;
  hostBridge?: HostBridge;
}

function mergeArtifactHandlers(
  generated?: ArtifactHandlers,
  explicit?: ArtifactHandlers
): ArtifactHandlers | undefined {
  if (!generated && !explicit) {
    return undefined;
  }

  return {
    ...(generated ?? {}),
    ...(explicit ?? {})
  };
}

function mergeCapabilityHandlers(
  generated?: CapabilityHandlers,
  explicit?: CapabilityHandlers
): CapabilityHandlers | undefined {
  if (!generated && !explicit) {
    return undefined;
  }

  return {
    ...(generated ?? {}),
    ...(explicit ?? {})
  };
}

function mergeHostBridge(generated?: HostBridge, explicit?: HostBridge): HostBridge | undefined {
  if (!generated && !explicit) {
    return undefined;
  }

  return {
    ...(generated ?? {}),
    ...(explicit ?? {})
  };
}

export function createHostIntegration(preset: HostIntegrationPreset): HostIntegration {
  const generatedArtifactHandlers = preset.artifactPreviews
    ? createArtifactPreviewHandlers(preset.artifactPreviews)
    : undefined;
  const generatedCapabilityHandlers = preset.capabilityPresets
    ? createCapabilityHandlers(preset.capabilityPresets)
    : undefined;
  const generatedHostBridge = preset.hostBridgePreset ? createHostBridge(preset.hostBridgePreset) : undefined;

  return {
    artifactHandlers: mergeArtifactHandlers(generatedArtifactHandlers, preset.artifactHandlers),
    capabilityHandlers: mergeCapabilityHandlers(generatedCapabilityHandlers, preset.capabilityHandlers),
    hostBridge: mergeHostBridge(generatedHostBridge, preset.hostBridge)
  };
}

export interface AgentRuntimeViewProps {
  harness: HarnessAdapter;
  voiceShell?: VoiceShellOptions;
  artifactHandlers?: ArtifactHandlers;
  capabilityHandlers?: CapabilityHandlers;
  hostBridge?: HostBridge;
  renderVoiceShell?: (props: VoiceShellRenderProps) => ReactNode;
  transitionHooks?: RendererTransitionHooks;
  navigationHooks?: RendererNavigationHooks;
  runtimeOptions?: AgentRuntimeOptions;
}

export interface AgentRuntimeViewHandle {
  openHistory(): void;
  closeHistory(): void;
  openRequestInspector(target?: RequestTarget): void;
  closeRequestInspector(): void;
  clearPersistence(): Promise<void>;
  reconnect(): Promise<void>;
  resetSession(options?: { clearPersistence?: boolean }): Promise<void>;
}

export interface RendererInteractionLockSnapshot {
  input: boolean;
  actions: boolean;
  forms: boolean;
  artifacts: boolean;
}

export interface RendererTransitionSnapshot {
  signature: string;
  screenId?: string;
  screenTitle?: string;
  mode: RuntimeContextValue["screenMode"];
  requestId?: string;
  flowPhase: RuntimeContextValue["flow"]["phase"];
  flowTransition?: ScreenFlowTransition;
  interactionReason?: string;
  interactionLocked: RendererInteractionLockSnapshot;
}

export type RendererTransitionChange = "screen" | "mode" | "flow" | "lock";

export interface RendererScreenTransitionEvent {
  changed: RendererTransitionChange[];
  previous: RendererTransitionSnapshot;
  current: RendererTransitionSnapshot;
}

export interface RendererFlowChangeEvent {
  previous: Pick<RendererTransitionSnapshot, "screenId" | "mode" | "requestId" | "flowPhase" | "flowTransition">;
  current: Pick<RendererTransitionSnapshot, "screenId" | "mode" | "requestId" | "flowPhase" | "flowTransition">;
}

export interface RendererInteractionLockChangeEvent {
  previous: RendererInteractionLockSnapshot;
  current: RendererInteractionLockSnapshot;
  screenId?: string;
  requestId?: string;
  flowPhase: RuntimeContextValue["flow"]["phase"];
  reason?: string;
}

export interface RendererTransitionHooks {
  onScreenTransition?: (event: RendererScreenTransitionEvent) => void;
  onFlowChange?: (event: RendererFlowChangeEvent) => void;
  onInteractionLockChange?: (event: RendererInteractionLockChangeEvent) => void;
}

export interface RendererRequestInspectorSnapshot {
  visible: boolean;
  target: RequestTarget;
  resolvedRequestId?: string;
  source?: RuntimeContextValue["history"][number]["requestSource"];
  entryCount: number;
  latestTitle?: string;
  hasResultScreen: boolean;
}

export interface RendererRequestInspectorChangeEvent {
  previous: RendererRequestInspectorSnapshot;
  current: RendererRequestInspectorSnapshot;
}

export interface RendererHistoryVisibilityChangeEvent {
  previous: boolean;
  current: boolean;
}

export interface RendererNavigationHooks {
  onRequestInspectorChange?: (event: RendererRequestInspectorChangeEvent) => void;
  onHistoryVisibilityChange?: (event: RendererHistoryVisibilityChangeEvent) => void;
}

interface ArtifactPreviewState {
  artifact: ArtifactRef;
  preview: ArtifactPreviewDescriptor;
}

interface CapabilityPromptState {
  request: CapabilityRequest;
  prompt: CapabilityPromptDescriptor;
}

interface HistoryModalProps {
  history: RuntimeContextValue["history"];
  historyEnabled: boolean;
  visible: boolean;
  onClose(): void;
  onInspectRequest(target: RequestTarget): void;
}

interface HistoryRequestGroup {
  id: string;
  requestId?: string;
  source?: RuntimeContextValue["history"][number]["requestSource"];
  entries: RuntimeContextValue["history"];
  latestTimestamp: string;
  kinds: RuntimeContextValue["history"][number]["kind"][];
  latestTitle: string;
}

type RequestChainSummary = RuntimeRequestSummary;

type RequestFlowProfile = "direct" | "staged" | "patched" | "approval" | "form" | "unknown";
type RequestVerdict = "pass" | "needs-review" | "idle";
type RecoveryVerdict = "pass" | "needs-review";
type BridgeVerdict = "pass" | "needs-review";
type RuntimeDerivedRequestSource =
  | DetailsBlock["source"]
  | LogBlock["source"]
  | "runtime.requestTimeline"
  | undefined;

interface RequestInspectorState {
  visible: boolean;
  target: RequestTarget;
}

interface RenderSnapshot {
  signature: string;
  screen: RuntimeContextValue["screen"];
  screenMode: RuntimeContextValue["screenMode"];
  interactionReason?: string;
  resolvedBlocks: Block[];
  archetype: ScreenArchetype;
  archetypeCopy: ReturnType<typeof getArchetypeCopy>;
  rootBlockCount: number;
  blockTypeCount: number;
}

interface RendererDiagnostics {
  artifactBridgeError?: string;
  capabilityBridgeError?: string;
  hostBridgeOpenUrlEnabled: boolean;
  hostBridgeShareEnabled: boolean;
  hostBridgeResolveCapabilityEnabled: boolean;
  artifactHandlerKinds: ArtifactRef["kind"][];
  capabilityHandlerKinds: CapabilityRequest["capability"][];
  artifactHandlerCoverage: Array<{
    kind: ArtifactRef["kind"];
    preview: boolean;
    open: boolean;
    share: boolean;
    download: boolean;
  }>;
  capabilityHandlerCoverage: Array<{
    capability: CapabilityRequest["capability"];
    describe: boolean;
    resolve: boolean;
  }>;
}

const artifactKindCatalog: ArtifactRef["kind"][] = ["text", "image", "audio", "video", "pdf", "html", "file", "link", "json"];
const capabilityCatalog: CapabilityRequest["capability"][] = [
  "microphone",
  "camera",
  "photo-library",
  "location",
  "file-picker",
  "share",
  "open-url"
];

type HistoryFilter = "all" | "input" | "workspace" | "resource" | "issue" | "patched";
type ScreenArchetype = "plan" | "timeline" | "brief" | "form" | "workspace" | "resource";
type LeafBlock = Exclude<Block, { type: "section" | "split" }>;
type NestableBlock = Exclude<Block, { type: "split" }>;

function formatRuntimeEventLogMeta(entry: RuntimeEventLogEntry) {
  const timestamp = entry.timestamp.slice(11, 19);
  return `${entry.direction} · ${timestamp}`;
}

function toPreviewValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function createCapabilityPayloadFields(payload?: Record<string, unknown>): CapabilityPromptField[] {
  const fields: CapabilityPromptField[] = [];

  if (!payload) {
    return fields;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      continue;
    }

    fields.push({
      label: key,
      value: toPreviewValue(value)
    });
  }

  return fields;
}

function getCapabilityDisplayName(capability: CapabilityRequest["capability"]) {
  switch (capability) {
    case "microphone":
      return "Microphone access";
    case "camera":
      return "Camera access";
    case "photo-library":
      return "Photo library access";
    case "location":
      return "Location access";
    case "file-picker":
      return "File picker";
    case "share":
      return "Share sheet";
    case "open-url":
      return "Open external link";
    default:
      return "Device capability";
  }
}

function getCapabilityBridgeModeLabel(capability: CapabilityRequest["capability"]) {
  switch (capability) {
    case "open-url":
    case "share":
      return "system bridge";
    case "microphone":
    case "camera":
    case "photo-library":
    case "location":
    case "file-picker":
    default:
      return "default mock bridge";
  }
}

function createCapabilityBridgeFields(request: CapabilityRequest) {
  const fields = createCapabilityPayloadFields(request.payload);

  fields.unshift(
    {
      label: "Capability",
      value: getCapabilityDisplayName(request.capability)
    },
    {
      label: "Bridge mode",
      value: getCapabilityBridgeModeLabel(request.capability)
    }
  );

  return fields;
}

function createDefaultMockCapabilityPayload(request: CapabilityRequest) {
  const basePayload: Record<string, unknown> = {
    bridge: "renderer-default-mock",
    capability: request.capability,
    granted: true,
    mock: true,
    resolvedAt: new Date().toISOString()
  };

  switch (request.capability) {
    case "microphone":
      return {
        ...basePayload,
        access: "granted",
        captureMode: "permission-only"
      };
    case "camera":
      return {
        ...basePayload,
        access: "granted",
        captureMode: "image"
      };
    case "photo-library":
      return {
        ...basePayload,
        access: "granted",
        selectionMode: "single"
      };
    case "location":
      return {
        ...basePayload,
        access: "granted",
        precision: "approximate",
        latitude: 31.2304,
        longitude: 121.4737
      };
    case "file-picker":
      return {
        ...basePayload,
        access: "granted",
        fileName: "demo-file.txt",
        mimeType: "text/plain",
        uri: "file:///mock/demo-file.txt"
      };
    default:
      return basePayload;
  }
}

function createDefaultDeniedCapabilityPayload(request: CapabilityRequest) {
  return {
    bridge: "renderer-default-mock",
    capability: request.capability,
    granted: false,
    mock: true,
    resolvedAt: new Date().toISOString()
  };
}

function getArtifactKindDescription(kind: ArtifactRef["kind"]) {
  switch (kind) {
    case "link":
      return "A remote link that can be previewed in-app and opened with the system browser.";
    case "html":
      return "An HTML surface that can be opened with the system browser.";
    case "image":
      return "An image resource returned by the harness.";
    case "audio":
      return "An audio resource returned by the harness.";
    case "video":
      return "A video resource returned by the harness.";
    case "pdf":
      return "A PDF resource returned by the harness.";
    case "json":
      return "A JSON resource returned by the harness.";
    case "text":
      return "A text resource returned by the harness.";
    case "file":
      return "A downloadable file returned by the harness.";
    default:
      return "Default artifact preview generated by the renderer.";
  }
}

function getArtifactOpenLabel(kind: ArtifactRef["kind"]) {
  switch (kind) {
    case "link":
      return "Open link";
    case "html":
      return "Open page";
    case "pdf":
      return "Open PDF";
    case "image":
      return "Open image";
    case "audio":
      return "Open audio";
    case "video":
      return "Open video";
    case "json":
      return "Open resource";
    case "text":
      return "Open text";
    case "file":
      return "Open file";
    default:
      return "Open in system";
  }
}

function canShareArtifact(resource: ArtifactRef) {
  return Boolean(resource.uri);
}

function canDownloadArtifact(resource: ArtifactRef) {
  return Boolean(resource.uri) && resource.kind !== "link" && resource.kind !== "html";
}

function createRuntimeLogItem(entry: RuntimeEventLogEntry): LogItem {
  let tone: LogItem["tone"] = "default";

  if (entry.type.includes("error")) {
    tone = "danger";
  } else if (entry.direction === "harness") {
    tone = "success";
  } else if (entry.direction === "runtime") {
    tone = "warning";
  }

  let body: string | undefined;

  if (typeof entry.payload === "string") {
    body = entry.payload;
  } else if (entry.payload !== undefined) {
    body = JSON.stringify(entry.payload, null, 2);
  }

  return {
    id: entry.id,
    title: entry.type,
    body,
    meta: formatRuntimeEventLogMeta(entry),
    tone
  };
}

function createHistoryLogItem(entry: RuntimeContextValue["history"][number]): LogItem {
  return {
    id: entry.id,
    title: `${getHistoryRoleLabel(entry.role)} · ${entry.title}`,
    body: entry.body,
    meta: `${getHistoryKindLabel(entry.kind)} · ${formatHistoryMeta(entry)}`,
    tone:
      entry.kind === "error"
        ? "danger"
        : entry.kind === "artifact" || entry.kind === "capability"
          ? "success"
          : entry.kind === "workspace"
            ? "warning"
            : "default"
  };
}

function createArtifactLogItem(artifact: ArtifactRef): LogItem {
  const metaParts: string[] = [artifact.kind, artifact.source];

  if (artifact.mimeType) {
    metaParts.push(artifact.mimeType);
  }

  if (artifact.expiresAt) {
    metaParts.push(`expires ${artifact.expiresAt.slice(0, 19)}`);
  }

  return {
    id: artifact.id,
    title: artifact.title ?? artifact.id,
    body: artifact.preview?.summary ?? artifact.preview?.text ?? artifact.uri,
    meta: metaParts.join(" · "),
    tone: artifact.previewable !== false || artifact.openable !== false ? "success" : "default"
  };
}

function createCapabilityRequestLogItem(request: CapabilityRequest): LogItem {
  const payloadFields = createCapabilityPayloadFields(request.payload);

  return {
    id: request.id,
    title: getCapabilityDisplayName(request.capability),
    body: request.reason,
    meta:
      payloadFields.length > 0
        ? `${request.capability} · ${payloadFields.length} payload field${payloadFields.length === 1 ? "" : "s"}`
        : request.capability,
    tone: "warning"
  };
}

function createRequestIndexActionItems(runtime: RuntimeContextValue, maxItems?: number): ActionItem[] {
  return getRuntimeRequestCatalog(runtime.history)
    .slice(0, maxItems ?? 8)
    .map((group) => {
      const summary = group.summary;
      const profile = inferRequestFlowProfile(summary);
      const labelBase = summary.latestTitle ?? group.requestId;

      return {
        id: `inspect-request-${group.requestId}`,
        label: `${labelBase} · ${getRequestFlowProfileLabel(profile)}`,
        payload: {
          requestTarget: group.requestId
        }
      } satisfies ActionItem;
    });
}

function createRuntimePersistenceActionItems(runtime: RuntimeContextValue): ActionItem[] {
  if (!runtime.persistence.enabled) {
    return [];
  }

  return [
    {
      id: "clear-runtime-persistence",
      label: runtime.persistence.canClear ? "Clear persistence" : "Persistence clear unavailable",
      payload: {
        enabled: runtime.persistence.enabled,
        canClear: runtime.persistence.canClear
      }
    }
  ];
}

function createRuntimeSessionActionItems(runtime: RuntimeContextValue): ActionItem[] {
  const items: ActionItem[] = [
    {
      id: "reconnect-runtime",
      label: "Reconnect runtime"
    },
    {
      id: "reset-runtime-session",
      label: "Reset session"
    }
  ];

  if (runtime.persistence.enabled && runtime.persistence.canClear) {
    items.push({
      id: "reset-runtime-session-and-clear-persistence",
      label: "Reset + clear persistence"
    });
  }

  return items;
}

function createRuntimeTransportLogItems(runtime: RuntimeContextValue, maxItems?: number) {
  return runtime.eventLog
    .filter((entry) =>
      entry.direction === "runtime" &&
      (entry.type === "runtime.connect" ||
        entry.type === "runtime.connected" ||
        entry.type === "runtime.disconnected" ||
        entry.type === "runtime.reset" ||
        entry.type === "runtime.error")
    )
    .slice()
    .reverse()
    .slice(0, maxItems ?? 20)
    .map(createRuntimeLogItem);
}

function createRuntimePersistenceLogItems(runtime: RuntimeContextValue, maxItems?: number): LogItem[] {
  const { persistence } = runtime;
  const items: Array<LogItem & { sortKey: string }> = [];

  if (persistence.loadState === "loading") {
    items.push({
      id: "persistence-loading",
      title: "Loading snapshot",
      body: "The runtime is loading a persisted snapshot.",
      meta: "persistence · loading",
      tone: "warning",
      sortKey: "9999-12-31T23:59:59.999Z"
    });
  }

  if (persistence.saveState === "saving") {
    items.push({
      id: "persistence-saving",
      title: "Saving snapshot",
      body: "The runtime is saving the current snapshot.",
      meta: "persistence · saving",
      tone: "warning",
      sortKey: "9999-12-31T23:59:59.998Z"
    });
  }

  if (persistence.clearState === "clearing") {
    items.push({
      id: "persistence-clearing",
      title: "Clearing snapshot",
      body: "The runtime is clearing the persisted snapshot.",
      meta: "persistence · clearing",
      tone: "warning",
      sortKey: "9999-12-31T23:59:59.997Z"
    });
  }

  if (persistence.lastHydratedAt) {
    items.push({
      id: "persistence-hydrated",
      title: persistence.hydratedFromSnapshot ? "Snapshot restored" : "Snapshot load completed",
      body: persistence.hydratedFromSnapshot
        ? "The runtime restored state from a persisted snapshot."
        : "The runtime finished loading persistence without restoring a snapshot.",
      meta: `persistence · ${formatHistoryTimestamp(persistence.lastHydratedAt)}`,
      tone: persistence.hydratedFromSnapshot ? "success" : "default",
      sortKey: persistence.lastHydratedAt
    });
  } else if (persistence.enabled && persistence.loadState === "ready" && persistence.loadCount > 0) {
    items.push({
      id: "persistence-no-snapshot",
      title: "No snapshot restored",
      body: "The runtime completed persistence loading without a saved snapshot.",
      meta: "persistence · ready",
      tone: "default",
      sortKey: "0000-00-00T00:00:00.000Z"
    });
  }

  if (persistence.lastSavedAt) {
    items.push({
      id: "persistence-saved",
      title: "Snapshot saved",
      body: `Saved snapshot ${persistence.saveCount} time(s).`,
      meta: `persistence · ${formatHistoryTimestamp(persistence.lastSavedAt)}`,
      tone: "success",
      sortKey: persistence.lastSavedAt
    });
  }

  if (persistence.lastClearedAt) {
    items.push({
      id: "persistence-cleared",
      title: "Snapshot cleared",
      body: `Cleared snapshot ${persistence.clearCount} time(s).`,
      meta: `persistence · ${formatHistoryTimestamp(persistence.lastClearedAt)}`,
      tone: "success",
      sortKey: persistence.lastClearedAt
    });
  }

  if (persistence.loadError) {
    items.push({
      id: "persistence-load-error",
      title: "Snapshot load error",
      body: persistence.loadError,
      meta: "persistence · load error",
      tone: "danger",
      sortKey: "9999-12-31T23:59:59.996Z"
    });
  }

  if (persistence.saveError) {
    items.push({
      id: "persistence-save-error",
      title: "Snapshot save error",
      body: persistence.saveError,
      meta: "persistence · save error",
      tone: "danger",
      sortKey: "9999-12-31T23:59:59.995Z"
    });
  }

  if (persistence.clearError) {
    items.push({
      id: "persistence-clear-error",
      title: "Snapshot clear error",
      body: persistence.clearError,
      meta: "persistence · clear error",
      tone: "danger",
      sortKey: "9999-12-31T23:59:59.994Z"
    });
  }

  return items
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .slice(0, maxItems ?? 20)
    .map(({ sortKey, ...item }) => item);
}

function createRuntimeSessionLogItems(runtime: RuntimeContextValue, maxItems?: number) {
  return runtime.eventLog
    .filter((entry) =>
      entry.type === "runtime.hydrated" ||
      entry.type === "runtime.connect" ||
      entry.type === "runtime.connected" ||
      entry.type === "runtime.disconnected" ||
      entry.type === "runtime.reset" ||
      entry.type === "runtime.error" ||
      entry.type === "session.started" ||
      entry.type === "session.completed"
    )
    .slice()
    .reverse()
    .slice(0, maxItems ?? 20)
    .map(createRuntimeLogItem);
}

function getRequestStageStatusTone(status: "pending" | "active" | "complete" | "error"): LogItem["tone"] {
  switch (status) {
    case "error":
      return "danger";
    case "active":
      return "warning";
    case "complete":
      return "success";
    case "pending":
    default:
      return "default";
  }
}

function createRequestStageLogItems(
  runtime: RuntimeContextValue,
  source: RuntimeDerivedRequestSource,
  requestTarget?: RequestTarget,
  maxItems?: number
) {
  const chain = getResolvedRequestChain(runtime, source, requestTarget);

  return getRuntimeRequestTimelineStageSummaries(chain.entries, chain.requestId, maxItems).map((stage, index) => ({
    id: `${stage.key}-${index}`,
    title: stage.title,
    body:
      stage.description ??
      `${stage.eventCount} event(s), ${stage.resourceCount} resource event(s), ${stage.patchCount} patch event(s)`,
    meta: [
      stage.meta,
      `${stage.resourceCount} resource${stage.resourceCount === 1 ? "" : "s"}`,
      `${stage.patchCount} patch${stage.patchCount === 1 ? "" : "es"}`,
      `${stage.issueCount} issue${stage.issueCount === 1 ? "" : "s"}`
    ]
      .filter(Boolean)
      .join(" · "),
    tone: getRequestStageStatusTone(stage.status)
  }));
}

function normalizeRequestTarget(target?: RequestTarget): RequestTarget {
  return typeof target === "string" && target.trim() ? target.trim() : "current";
}

function resolveNavigationChangeFromAction(action: ActionItem): NavigationChange | undefined {
  if (action.id === "show-history" || action.id === "open-history") {
    return {
      surface: "history",
      visibility: "open"
    };
  }

  if (action.id === "close-history") {
    return {
      surface: "history",
      visibility: "closed"
    };
  }

  if (action.id === "inspect-current-request") {
    return {
      surface: "request-inspector",
      visibility: "open",
      requestTarget: "current"
    };
  }

  if (action.id === "inspect-last-completed-request") {
    return {
      surface: "request-inspector",
      visibility: "open",
      requestTarget: "lastCompleted"
    };
  }

  if (action.id === "close-request-inspector") {
    return {
      surface: "request-inspector",
      visibility: "closed"
    };
  }

  if (action.id === "show-request-inspector" || action.id.startsWith("inspect-request-")) {
    return {
      surface: "request-inspector",
      visibility: "open",
      requestTarget:
        typeof action.payload?.requestTarget === "string"
          ? action.payload.requestTarget
          : typeof action.payload?.requestId === "string"
            ? action.payload.requestId
            : "current"
    };
  }

  return undefined;
}

function buildRequestInspectorBlocks(requestTarget: RequestTarget): Block[] {
  return [
    {
      id: "request-inspector-summary",
      type: "details",
      title: "Request summary",
      source: "runtime.request",
      requestTarget
    },
    {
      id: "request-inspector-verdict",
      type: "details",
      title: "Request verdict",
      source: "runtime.requestVerdict",
      requestTarget
    },
    {
      id: "request-inspector-actions",
      type: "actions",
      items: [
        { id: "inspect-current-request", label: "Inspect current" },
        { id: "inspect-last-completed-request", label: "Inspect last completed" },
        { id: "close-request-inspector", label: "Close" }
      ]
    },
    {
      id: "request-inspector-index",
      type: "section",
      title: "Request catalog",
      description: "Open any indexed request chain directly from the runtime-derived request catalog.",
      blocks: [
        {
          id: "request-inspector-request-index-actions",
          type: "actions",
          source: "runtime.requestIndexActions",
          maxItems: 8
        }
      ]
    },
    {
      id: "request-inspector-analysis",
      type: "section",
      title: "Analysis",
      blocks: [
        {
          id: "request-inspector-timeline",
          type: "timeline",
          title: "Stage replay",
          description: "Runtime-derived stage timeline for the selected request chain.",
          source: "runtime.requestTimeline",
          requestTarget,
          maxItems: 12
        },
        {
          id: "request-inspector-stage-summary",
          type: "details",
          title: "Stage summary",
          source: "runtime.requestStageSummary",
          requestTarget
        },
        {
          id: "request-inspector-stage-log",
          type: "log",
          title: "Stage metrics",
          source: "runtime.requestStageLog",
          requestTarget,
          maxItems: 8,
          emptyLabel: "No stage replay is available for this request chain."
        },
        {
          id: "request-inspector-assertions",
          type: "details",
          title: "Assertions",
          source: "runtime.requestAssertions",
          requestTarget
        },
        {
          id: "request-inspector-matrix",
          type: "details",
          title: "Profile matrix",
          source: "runtime.requestMatrix",
          requestTarget
        },
        {
          id: "request-inspector-resources",
          type: "details",
          title: "Resource summary",
          source: "runtime.requestResources",
          requestTarget
        }
      ]
    },
    {
      id: "request-inspector-history",
      type: "section",
      title: "Request history",
      blocks: [
        {
          id: "request-inspector-history-log",
          type: "log",
          title: "History",
          source: "runtime.requestHistory",
          requestTarget,
          maxItems: 12,
          emptyLabel: "No request chain matched this target."
        },
        {
          id: "request-inspector-resource-log",
          type: "log",
          title: "Resource history",
          source: "runtime.requestResourceHistory",
          requestTarget,
          maxItems: 8,
          emptyLabel: "No resource activity is attached to this request chain."
        }
      ]
    }
  ];
}

function createRequestInspectorSnapshot(
  runtime: RuntimeContextValue,
  state: RequestInspectorState
): RendererRequestInspectorSnapshot {
  const normalizedTarget = normalizeRequestTarget(state.target);
  const chain = resolveRuntimeRequestChain(runtime, normalizedTarget);

  return {
    visible: state.visible,
    target: normalizedTarget,
    resolvedRequestId: chain.requestId,
    source: chain.summary.source,
    entryCount: chain.summary.entryCount,
    latestTitle: chain.summary.latestTitle,
    hasResultScreen: chain.summary.hasResultScreen
  };
}

function resolveRequestTarget(
  source: RuntimeDerivedRequestSource,
  requestTarget?: RequestTarget
): RuntimeRequestTarget {
  if (
    source === "runtime.lastCompletedRequest" ||
    source === "runtime.lastCompletedRequestResources" ||
    source === "runtime.lastCompletedRequestAssertions" ||
    source === "runtime.lastCompletedRequestMatrix" ||
    source === "runtime.lastCompletedRequestVerdict" ||
    source === "runtime.lastCompletedRequestHistory" ||
    source === "runtime.lastCompletedRequestResourceHistory"
  ) {
    return "lastCompleted";
  }

  if (
    source === "runtime.currentRequest" ||
    source === "runtime.currentRequestResources" ||
    source === "runtime.currentRequestAssertions" ||
    source === "runtime.currentRequestMatrix" ||
    source === "runtime.currentRequestVerdict" ||
    source === "runtime.currentRequestHistory" ||
    source === "runtime.currentRequestResourceHistory"
  ) {
    return "current";
  }

  return requestTarget ?? "current";
}

function getResolvedRequestChain(
  runtime: RuntimeContextValue,
  source: RuntimeDerivedRequestSource,
  requestTarget?: RequestTarget
) {
  return resolveRuntimeRequestChain(runtime, resolveRequestTarget(source, requestTarget));
}

function resolveRequestEvaluationMode(
  runtime: RuntimeContextValue,
  source: RuntimeDerivedRequestSource,
  requestTarget: RequestTarget | undefined,
  summary: RequestChainSummary
): "current" | "completed" {
  const resolvedTarget = resolveRequestTarget(source, requestTarget);

  if (
    source === "runtime.lastCompletedRequestAssertions" ||
    source === "runtime.lastCompletedRequestMatrix" ||
    source === "runtime.lastCompletedRequestVerdict" ||
    source === "runtime.lastCompletedRequest" ||
    source === "runtime.lastCompletedRequestResources" ||
    source === "runtime.lastCompletedRequestHistory" ||
    source === "runtime.lastCompletedRequestResourceHistory" ||
    resolvedTarget === "lastCompleted"
  ) {
    return "completed";
  }

  if (resolvedTarget === "current") {
    return "current";
  }

  if (summary.requestId && summary.requestId === runtime.flow.lastCompletedRequestId) {
    return "completed";
  }

  return summary.hasResultScreen && summary.requestId !== runtime.flow.requestId ? "completed" : "current";
}

function createRequestResourceDetailItems(
  entries: RuntimeContextValue["history"],
  requestId?: string
): DetailItem[] {
  const resourceEntries = getRuntimeRequestResourceEntries(entries);
  const artifactEntries = resourceEntries.filter((entry) => entry.kind === "artifact");
  const capabilityEntries = resourceEntries.filter((entry) => entry.kind === "capability");
  const latestResourceEntry = resourceEntries[resourceEntries.length - 1];
  const latestArtifactEntry = artifactEntries[artifactEntries.length - 1];
  const latestCapabilityEntry = capabilityEntries[capabilityEntries.length - 1];

  return [
    {
      id: `${requestId ?? "request"}-resource-request-id`,
      label: "Request ID",
      value: requestId ?? "None"
    },
    {
      id: `${requestId ?? "request"}-resource-events`,
      label: "Resource events",
      value: String(resourceEntries.length),
      tone: resourceEntries.length > 0 ? "success" : "default"
    },
    {
      id: `${requestId ?? "request"}-artifact-events`,
      label: "Artifact events",
      value: String(artifactEntries.length),
      tone: artifactEntries.length > 0 ? "success" : "default"
    },
    {
      id: `${requestId ?? "request"}-capability-events`,
      label: "Capability events",
      value: String(capabilityEntries.length),
      tone: capabilityEntries.length > 0 ? "warning" : "default"
    },
    {
      id: `${requestId ?? "request"}-latest-resource`,
      label: "Latest resource event",
      value: latestResourceEntry?.title ?? "None"
    },
    {
      id: `${requestId ?? "request"}-latest-artifact`,
      label: "Latest artifact",
      value: latestArtifactEntry?.title ?? "None"
    },
    {
      id: `${requestId ?? "request"}-latest-capability`,
      label: "Latest capability",
      value: latestCapabilityEntry?.title ?? "None"
    }
  ];
}

function createRequestIndexSummaryItems(runtime: RuntimeContextValue): DetailItem[] {
  const groups = getRuntimeRequestCatalog(runtime.history);
  const summaries = groups.map((group) => group.summary);
  const completedCount = summaries.filter((summary) => summary.hasResultScreen).length;
  const approvalCount = summaries.filter((summary) => inferRequestFlowProfile(summary) === "approval").length;
  const patchedCount = summaries.filter((summary) => inferRequestFlowProfile(summary) === "patched").length;
  const stagedCount = summaries.filter((summary) => inferRequestFlowProfile(summary) === "staged").length;
  const latestSummary = summaries[0];

  return [
    {
      id: "request-index-total",
      label: "Indexed requests",
      value: String(summaries.length),
      tone: summaries.length > 0 ? "success" : "default"
    },
    {
      id: "request-index-completed",
      label: "Completed",
      value: String(completedCount),
      tone: completedCount > 0 ? "success" : "default"
    },
    {
      id: "request-index-active",
      label: "Active request",
      value: runtime.flow.requestId ?? "None"
    },
    {
      id: "request-index-last-completed",
      label: "Last completed",
      value: runtime.flow.lastCompletedRequestId ?? "None"
    },
    {
      id: "request-index-approval",
      label: "Approval flows",
      value: String(approvalCount)
    },
    {
      id: "request-index-patched",
      label: "Patched flows",
      value: String(patchedCount)
    },
    {
      id: "request-index-staged",
      label: "Staged flows",
      value: String(stagedCount)
    },
    {
      id: "request-index-latest",
      label: "Latest chain",
      value: latestSummary?.latestTitle ?? "None"
    }
  ];
}

function createRuntimeNavigationDetailItems(runtime: RuntimeContextValue, blockId: string): DetailItem[] {
  const historyVisible = runtime.navigation.historyVisible;
  const inspectorState = runtime.navigation.requestInspector;
  const inspectorChain = resolveRuntimeRequestChain(runtime, inspectorState.target);

  return [
    {
      id: `${blockId}-history-visible`,
      label: "History overlay",
      value: historyVisible ? "open" : "closed",
      tone: historyVisible ? "warning" : "default"
    },
    {
      id: `${blockId}-history-lock`,
      label: "History access",
      value: runtime.interaction.history,
      tone: getInteractionTone(runtime.interaction.history)
    },
    {
      id: `${blockId}-inspector-visible`,
      label: "Inspector overlay",
      value: inspectorState.visible ? "open" : "closed",
      tone: inspectorState.visible ? "warning" : "default"
    },
    {
      id: `${blockId}-inspector-target`,
      label: "Inspector target",
      value: inspectorState.target
    },
    {
      id: `${blockId}-inspector-request-id`,
      label: "Resolved request",
      value: inspectorChain.requestId ?? "None"
    },
    {
      id: `${blockId}-inspector-entries`,
      label: "Resolved entries",
      value: String(inspectorChain.summary.entryCount)
    }
  ];
}

function createRuntimePersistenceDetailItems(runtime: RuntimeContextValue, blockId: string): DetailItem[] {
  const persistence = runtime.persistence;

  return [
    {
      id: `${blockId}-enabled`,
      label: "Persistence",
      value: persistence.enabled ? "enabled" : "disabled",
      tone: persistence.enabled ? "success" : "default"
    },
    {
      id: `${blockId}-can-clear`,
      label: "Clear support",
      value: persistence.canClear ? "yes" : "no",
      tone: persistence.canClear ? "success" : "default"
    },
    {
      id: `${blockId}-load-state`,
      label: "Load state",
      value: persistence.loadState,
      tone:
        persistence.loadState === "ready"
          ? "success"
          : persistence.loadState === "error"
            ? "danger"
            : persistence.loadState === "loading"
              ? "warning"
              : "default"
    },
    {
      id: `${blockId}-save-state`,
      label: "Save state",
      value: persistence.saveState,
      tone:
        persistence.saveState === "ready"
          ? "success"
          : persistence.saveState === "error"
            ? "danger"
            : persistence.saveState === "saving"
              ? "warning"
              : "default"
    },
    {
      id: `${blockId}-clear-state`,
      label: "Clear state",
      value: persistence.clearState,
      tone:
        persistence.clearState === "ready"
          ? "success"
          : persistence.clearState === "error"
            ? "danger"
            : persistence.clearState === "clearing"
              ? "warning"
              : "default"
    },
    {
      id: `${blockId}-hydrated`,
      label: "Hydrated snapshot",
      value: persistence.hydratedFromSnapshot ? "yes" : "no",
      tone: persistence.hydratedFromSnapshot ? "success" : "default"
    },
    {
      id: `${blockId}-load-count`,
      label: "Load count",
      value: String(persistence.loadCount)
    },
    {
      id: `${blockId}-save-count`,
      label: "Save count",
      value: String(persistence.saveCount)
    },
    {
      id: `${blockId}-clear-count`,
      label: "Clear count",
      value: String(persistence.clearCount)
    },
    {
      id: `${blockId}-last-hydrated-at`,
      label: "Last hydrated",
      value: persistence.lastHydratedAt ? formatHistoryTimestamp(persistence.lastHydratedAt) : "None"
    },
    {
      id: `${blockId}-last-saved-at`,
      label: "Last saved",
      value: persistence.lastSavedAt ? formatHistoryTimestamp(persistence.lastSavedAt) : "None"
    },
    {
      id: `${blockId}-last-cleared-at`,
      label: "Last cleared",
      value: persistence.lastClearedAt ? formatHistoryTimestamp(persistence.lastClearedAt) : "None"
    },
    {
      id: `${blockId}-load-error`,
      label: "Load error",
      value: persistence.loadError ?? "None"
    },
    {
      id: `${blockId}-save-error`,
      label: "Save error",
      value: persistence.saveError ?? "None"
    },
    {
      id: `${blockId}-clear-error`,
      label: "Clear error",
      value: persistence.clearError ?? "None"
    }
  ];
}

function createRequestIndexLogItems(runtime: RuntimeContextValue, maxItems?: number) {
  return getRuntimeRequestCatalog(runtime.history)
    .map((group) => {
      const summary = group.summary;
      const profile = inferRequestFlowProfile(summary);

      return {
        id: group.requestId,
        title: summary.latestTitle ?? group.entries[group.entries.length - 1]?.title ?? group.requestId,
        body: `${summary.modePath} · ${summary.entryCount} event(s) · ${summary.resourceCount} resource event(s)`,
        meta: [
          formatHistoryRequestId(summary.requestId),
          formatHistoryRequestSource(summary.source),
          getRequestFlowProfileLabel(profile)
        ]
          .filter(Boolean)
          .join(" · "),
        tone:
          summary.issueCount > 0
            ? "danger"
            : summary.hasResultScreen
              ? "success"
              : profile === "approval" || profile === "patched"
                ? "warning"
                : "default"
      } satisfies LogItem;
    })
    .slice(0, maxItems ?? 20);
}

function getRequestSummarySignal(summary: RequestChainSummary) {
  if (summary.hasError || summary.issueCount > 0) {
    return "warning" as const;
  }

  if (summary.hasResultScreen) {
    return "success" as const;
  }

  if (summary.entryCount > 0) {
    return "warning" as const;
  }

  return "default" as const;
}

function inferRequestFlowProfile(summary: RequestChainSummary): RequestFlowProfile {
  if (!summary.requestId) {
    return "unknown";
  }

  if (summary.source === "form" || summary.hasForm || summary.formCount > 0) {
    return "form";
  }

  if (summary.hasCapability) {
    return "approval";
  }

  if (summary.patchCount > 0) {
    return "patched";
  }

  if (summary.hasTaskScreen || summary.workspaceCount > 2) {
    return "staged";
  }

  if (summary.hasProcessingScreen && summary.hasResultScreen) {
    return "direct";
  }

  return "unknown";
}

function getRequestFlowProfileLabel(profile: RequestFlowProfile) {
  switch (profile) {
    case "direct":
      return "Direct flow";
    case "staged":
      return "Staged flow";
    case "patched":
      return "Patched flow";
    case "approval":
      return "Approval flow";
    case "form":
      return "Form flow";
    case "unknown":
    default:
      return "Unknown flow";
  }
}

function createProfileAssertionItem(summary: RequestChainSummary): DetailItem {
  const profile = inferRequestFlowProfile(summary);

  switch (profile) {
    case "direct":
      return {
        id: "request-profile-assertion",
        label: "Profile assertion",
        value: summary.patchCount === 0 ? "Direct flow detected with no patch events" : "Direct flow should not record patch events",
        tone: summary.patchCount === 0 ? "success" : "warning"
      };
    case "staged":
      return {
        id: "request-profile-assertion",
        label: "Profile assertion",
        value:
          summary.workspaceCount > 1
            ? "Staged flow detected with multiple workspace events"
            : "Staged flow should produce multiple workspace events",
        tone: summary.workspaceCount > 1 ? "success" : "warning"
      };
    case "patched":
      return {
        id: "request-profile-assertion",
        label: "Profile assertion",
        value:
          summary.patchCount > 0
            ? "Patched flow detected with incremental screen updates"
            : "Patched flow should record one or more patch events",
        tone: summary.patchCount > 0 ? "success" : "danger"
      };
    case "approval":
      return {
        id: "request-profile-assertion",
        label: "Profile assertion",
        value:
          summary.hasCapability && summary.resourceCount > 0
            ? "Approval flow detected with capability activity"
            : "Approval flow should include capability activity",
        tone: summary.hasCapability && summary.resourceCount > 0 ? "success" : "danger"
      };
    case "form":
      return {
        id: "request-profile-assertion",
        label: "Profile assertion",
        value:
          (summary.source === "form" || summary.formCount > 0)
            ? "Form flow detected with structured submission history"
            : "Form flow should preserve form-origin request history",
        tone: summary.source === "form" || summary.formCount > 0 ? "success" : "danger"
      };
    case "unknown":
    default:
      return {
        id: "request-profile-assertion",
        label: "Profile assertion",
        value: "Flow profile is not specific enough to evaluate yet",
        tone: "default"
      };
  }
}

function createCurrentRequestAssertionItems(
  runtime: RuntimeContextValue,
  summary: RequestChainSummary
): DetailItem[] {
  const hasActiveRequest = Boolean(runtime.flow.requestId);
  const shouldBeLocked =
    runtime.flow.phase === "active" &&
    (runtime.flow.screenMode === "processing" ||
      runtime.flow.screenMode === "task" ||
      runtime.flow.screenMode === "approval");
  const inputLocked = runtime.interaction.input === "locked";
  const profile = inferRequestFlowProfile(summary);

  return [
    {
      id: "current-request-assert-profile",
      label: "Inferred profile",
      value: getRequestFlowProfileLabel(profile),
      tone: profile === "unknown" ? "default" : "success"
    },
    {
      id: "current-request-assert-request-id",
      label: "Request identity",
      value: hasActiveRequest ? "Active requestId is attached" : "No active request chain",
      tone: hasActiveRequest ? "success" : "default"
    },
    {
      id: "current-request-assert-lock",
      label: "Lock behavior",
      value: shouldBeLocked
        ? inputLocked
          ? "Input is locked while the request is in progress"
          : "Expected input to stay locked during the active request"
        : inputLocked
          ? "Input remains locked outside the expected processing window"
          : "No lock required for the current state",
      tone: shouldBeLocked ? (inputLocked ? "success" : "danger") : inputLocked ? "warning" : "default"
    },
    {
      id: "current-request-assert-grouping",
      label: "Grouped history",
      value:
        summary.entryCount > 0
          ? `${summary.entryCount} request-linked history event(s) found`
          : "No request-linked history entries yet",
      tone: summary.entryCount > 0 ? "success" : "default"
    },
    createProfileAssertionItem(summary),
    {
      id: "current-request-assert-patches",
      label: "Incremental updates",
      value:
        summary.patchCount > 0
          ? `${summary.patchCount} patch event(s) observed on this chain`
          : "No patch events observed on this chain",
      tone: summary.patchCount > 0 ? "success" : "default"
    },
    {
      id: "current-request-assert-issues",
      label: "Issues",
      value:
        summary.issueCount > 0
          ? `${summary.issueCount} issue event(s) need review`
          : "No issue events recorded on this chain",
      tone: summary.issueCount > 0 ? "danger" : "success"
    }
  ];
}

function createCompletedRequestAssertionItems(summary: RequestChainSummary): DetailItem[] {
  const hasCompletedRequest = Boolean(summary.requestId);
  const profile = inferRequestFlowProfile(summary);

  return [
    {
      id: "completed-request-assert-profile",
      label: "Inferred profile",
      value: getRequestFlowProfileLabel(profile),
      tone: profile === "unknown" ? "default" : "success"
    },
    {
      id: "completed-request-assert-request-id",
      label: "Completed chain",
      value: hasCompletedRequest ? "A completed request chain is available" : "No completed request chain recorded yet",
      tone: hasCompletedRequest ? "success" : "default"
    },
    {
      id: "completed-request-assert-result",
      label: "Result release",
      value: summary.hasResultScreen
        ? "A result surface was recorded for this chain"
        : hasCompletedRequest
          ? "No result surface was recorded for this completed chain"
          : "No completed result to inspect",
      tone: summary.hasResultScreen ? "success" : hasCompletedRequest ? "warning" : "default"
    },
    {
      id: "completed-request-assert-grouping",
      label: "Grouped history",
      value:
        summary.entryCount > 1
          ? `${summary.entryCount} grouped history event(s) stayed attached to the chain`
          : hasCompletedRequest
            ? "Only one history event was attached to the chain"
            : "No grouped history to inspect",
      tone: summary.entryCount > 1 ? "success" : hasCompletedRequest ? "warning" : "default"
    },
    createProfileAssertionItem(summary),
    {
      id: "completed-request-assert-patches",
      label: "Incremental updates",
      value:
        summary.patchCount > 0
          ? `${summary.patchCount} patch event(s) were recorded for this completed chain`
          : "This completed chain did not use screen patches",
      tone: summary.patchCount > 0 ? "success" : "default"
    },
    {
      id: "completed-request-assert-issues",
      label: "Issues",
      value:
        summary.issueCount > 0
          ? `${summary.issueCount} issue event(s) were recorded on this chain`
          : "No issue events were recorded on this chain",
      tone: summary.issueCount > 0 ? "danger" : "success"
    }
  ];
}

function createRequestMatrixItems(
  summary: RequestChainSummary,
  mode: "current" | "completed"
): DetailItem[] {
  const profile = inferRequestFlowProfile(summary);
  const expectsCompletion = mode === "completed";
  const resultOkay = !expectsCompletion || summary.hasResultScreen;

  const baseItems: DetailItem[] = [
    {
      id: `${mode}-request-matrix-profile`,
      label: "Matrix profile",
      value: getRequestFlowProfileLabel(profile),
      tone: profile === "unknown" ? "default" : "success"
    },
    {
      id: `${mode}-request-matrix-grouping`,
      label: "Grouping check",
      value:
        summary.entryCount > 1
          ? `${summary.entryCount} grouped event(s) detected`
          : summary.entryCount === 1
            ? "Only one grouped event detected"
            : "No grouped request history detected",
      tone: summary.entryCount > 1 ? "success" : summary.entryCount === 1 ? "warning" : "default"
    },
    {
      id: `${mode}-request-matrix-completion`,
      label: "Completion check",
      value: expectsCompletion
        ? resultOkay
          ? "Result surface recorded for this chain"
          : "Completed chain is missing a result surface"
        : "Completion is optional while the request is still active",
      tone: expectsCompletion ? (resultOkay ? "success" : "danger") : "default"
    }
  ];

  switch (profile) {
    case "direct":
      return [
        ...baseItems,
        {
          id: `${mode}-request-matrix-direct-patches`,
          label: "Patch expectation",
          value: summary.patchCount === 0 ? "Direct flow has no patch events" : "Direct flow should not record patch events",
          tone: summary.patchCount === 0 ? "success" : "warning"
        },
        {
          id: `${mode}-request-matrix-direct-workspace`,
          label: "Workspace expectation",
          value:
            summary.workspaceCount >= 1 && summary.workspaceCount <= 2
              ? "Workspace count matches a short direct lifecycle"
              : "Direct flow should stay close to one processing handoff and one result handoff",
          tone: summary.workspaceCount >= 1 && summary.workspaceCount <= 2 ? "success" : "warning"
        }
      ];
    case "staged":
      return [
        ...baseItems,
        {
          id: `${mode}-request-matrix-staged-task`,
          label: "Task-stage expectation",
          value: summary.hasTaskScreen ? "Task screen detected in the chain" : "Staged flow should pass through a task screen",
          tone: summary.hasTaskScreen ? "success" : "danger"
        },
        {
          id: `${mode}-request-matrix-staged-workspace`,
          label: "Workspace expectation",
          value:
            summary.workspaceCount > 1
              ? "Multiple workspace events detected for the staged chain"
              : "Staged flow should record multiple workspace events",
          tone: summary.workspaceCount > 1 ? "success" : "warning"
        }
      ];
    case "patched":
      return [
        ...baseItems,
        {
          id: `${mode}-request-matrix-patched-patches`,
          label: "Patch expectation",
          value:
            summary.patchCount > 0
              ? `${summary.patchCount} patch event(s) recorded for this chain`
              : "Patched flow should record one or more patch events",
          tone: summary.patchCount > 0 ? "success" : "danger"
        },
        {
          id: `${mode}-request-matrix-patched-task`,
          label: "Task-stage expectation",
          value:
            summary.hasTaskScreen
              ? "Task screen stayed active while incremental updates were applied"
              : "Patched flow should keep a task screen alive while patches arrive",
          tone: summary.hasTaskScreen ? "success" : "warning"
        }
      ];
    case "approval":
      return [
        ...baseItems,
        {
          id: `${mode}-request-matrix-approval-capability`,
          label: "Capability expectation",
          value:
            summary.hasCapability && summary.resourceCount > 0
              ? "Capability activity is attached to the chain"
              : "Approval flow should include capability activity",
          tone: summary.hasCapability && summary.resourceCount > 0 ? "success" : "danger"
        },
        {
          id: `${mode}-request-matrix-approval-issues`,
          label: "Issue expectation",
          value:
            summary.issueCount === 0
              ? "No approval-time issue was recorded"
              : `${summary.issueCount} issue event(s) were recorded during approval`,
          tone: summary.issueCount === 0 ? "success" : "danger"
        }
      ];
    case "form":
      return [
        ...baseItems,
        {
          id: `${mode}-request-matrix-form-source`,
          label: "Form-source expectation",
          value:
            summary.source === "form" || summary.formCount > 0
              ? "Structured form origin is preserved"
              : "Form flow should preserve form-origin request history",
          tone: summary.source === "form" || summary.formCount > 0 ? "success" : "danger"
        },
        {
          id: `${mode}-request-matrix-form-workspace`,
          label: "Workspace expectation",
          value:
            summary.workspaceCount > 1
              ? "Form chain progressed through follow-up workspace stages"
              : "Form flow should continue into follow-up workspace stages",
          tone: summary.workspaceCount > 1 ? "success" : "warning"
        }
      ];
    case "unknown":
    default:
      return [
        ...baseItems,
        {
          id: `${mode}-request-matrix-unknown`,
          label: "Profile fit",
          value: "The chain does not match a strict profile yet",
          tone: "default"
        }
      ];
  }
}

function inferRequestVerdict(
  summary: RequestChainSummary,
  mode: "current" | "completed"
): RequestVerdict {
  if (!summary.requestId) {
    return "idle";
  }

  if (summary.issueCount > 0) {
    return "needs-review";
  }

  const profile = inferRequestFlowProfile(summary);

  switch (profile) {
    case "direct":
      return summary.patchCount === 0 ? "pass" : "needs-review";
    case "staged":
      return summary.hasTaskScreen && summary.workspaceCount > 1 ? "pass" : "needs-review";
    case "patched":
      return summary.patchCount > 0 && summary.hasTaskScreen ? "pass" : "needs-review";
    case "approval":
      return summary.hasCapability && summary.resourceCount > 0 ? "pass" : "needs-review";
    case "form":
      return summary.formCount > 0 || summary.source === "form" ? "pass" : "needs-review";
    case "unknown":
    default:
      if (mode === "current") {
        return summary.entryCount > 0 ? "needs-review" : "idle";
      }

      return summary.hasResultScreen ? "pass" : "needs-review";
  }
}

function getRequestVerdictLabel(verdict: RequestVerdict) {
  switch (verdict) {
    case "pass":
      return "Pass";
    case "needs-review":
      return "Needs review";
    case "idle":
    default:
      return "Idle";
  }
}

function createRequestVerdictItems(
  summary: RequestChainSummary,
  mode: "current" | "completed"
): DetailItem[] {
  const profile = inferRequestFlowProfile(summary);
  const verdict = inferRequestVerdict(summary, mode);

  return [
    {
      id: `${mode}-request-verdict`,
      label: "Verdict",
      value: getRequestVerdictLabel(verdict),
      tone: verdict === "pass" ? "success" : verdict === "needs-review" ? "danger" : "default"
    },
    {
      id: `${mode}-request-verdict-profile`,
      label: "Profile",
      value: getRequestFlowProfileLabel(profile),
      tone: profile === "unknown" ? "default" : "success"
    },
    {
      id: `${mode}-request-verdict-summary`,
      label: "Reason",
      value:
        verdict === "pass"
          ? "Observed request metrics match the inferred flow profile."
          : verdict === "needs-review"
            ? "One or more request metrics do not match the inferred flow profile."
            : "No request chain is available for evaluation.",
      tone: verdict === "pass" ? "success" : verdict === "needs-review" ? "warning" : "default"
    }
  ];
}

function hasRuntimePersistenceError(runtime: RuntimeContextValue) {
  const persistence = runtime.persistence;

  return Boolean(
    persistence.loadError ||
      persistence.saveError ||
      persistence.clearError ||
      persistence.loadState === "error" ||
      persistence.saveState === "error" ||
      persistence.clearState === "error"
  );
}

function hasRuntimePersistencePending(runtime: RuntimeContextValue) {
  const persistence = runtime.persistence;

  return (
    persistence.loadState === "loading" ||
    persistence.saveState === "saving" ||
    persistence.clearState === "clearing"
  );
}

function inferRecoveryVerdict(runtime: RuntimeContextValue): RecoveryVerdict {
  const transportState = runtime.transport.connectState;
  const reconnectCountsMatch = runtime.recovery.reconnectCount === runtime.transport.reconnectCount;
  const restoredModeMismatch = runtime.recovery.mode === "restored" && !runtime.persistence.hydratedFromSnapshot;
  const reconnectedModeMismatch =
    runtime.recovery.mode === "reconnected" &&
    (runtime.recovery.reconnectCount < 1 || runtime.transport.reconnectCount < 1);
  const resetModeMismatch = runtime.recovery.mode === "reset" && runtime.recovery.resetCount < 1;

  if (
    transportState === "error" ||
    transportState === "disconnected" ||
    hasRuntimePersistenceError(runtime) ||
    !reconnectCountsMatch ||
    restoredModeMismatch ||
    reconnectedModeMismatch ||
    resetModeMismatch
  ) {
    return "needs-review";
  }

  if (transportState === "connecting" || hasRuntimePersistencePending(runtime)) {
    return "needs-review";
  }

  return "pass";
}

function getRecoveryVerdictLabel(verdict: RecoveryVerdict) {
  return verdict === "pass" ? "Pass" : "Needs review";
}

function createRecoveryAssertionItems(runtime: RuntimeContextValue): DetailItem[] {
  const { persistence, recovery, transport } = runtime;
  const reconnectCountsMatch = recovery.reconnectCount === transport.reconnectCount;
  const restoreAligned = recovery.mode !== "restored" || persistence.hydratedFromSnapshot;
  const reconnectReady =
    recovery.mode !== "reconnected" ||
    (recovery.reconnectCount > 0 && transport.reconnectCount > 0 && transport.connectState === "connected");
  const resetReady = recovery.mode !== "reset" || recovery.resetCount > 0;

  const modeValue =
    recovery.mode === "restored"
      ? restoreAligned
        ? "Restored mode matches snapshot hydration."
        : "Restored mode requires a hydrated snapshot."
      : recovery.mode === "reconnected"
        ? reconnectReady
          ? "Reconnected mode matches runtime and transport counters."
          : "Reconnected mode is missing a confirmed reconnect cycle."
        : recovery.mode === "reset"
          ? resetReady
            ? "Reset mode is backed by a recorded reset event."
            : "Reset mode is missing a recorded reset event."
          : "Fresh mode is active with no recovery override in effect.";
  const modeTone: DetailItem["tone"] =
    recovery.mode === "restored"
      ? restoreAligned
        ? "success"
        : "danger"
      : recovery.mode === "reconnected"
        ? reconnectReady
          ? "success"
          : "danger"
        : recovery.mode === "reset"
          ? resetReady
            ? "success"
            : "danger"
          : "success";

  const transportValue =
    transport.connectState === "connected"
      ? transport.lastConnectError
        ? "Runtime is connected, but a previous connect error is still recorded."
        : "Runtime is connected."
      : transport.connectState === "connecting"
        ? "Runtime is reconnecting or establishing transport."
        : transport.connectState === "disconnected"
          ? "Runtime transport is disconnected."
          : "Runtime transport reported a connect error.";
  const transportTone: DetailItem["tone"] =
    transport.connectState === "connected"
      ? transport.lastConnectError
        ? "warning"
        : "success"
      : transport.connectState === "connecting"
        ? "warning"
        : "danger";

  const persistenceValue = !persistence.enabled
    ? "Persistence is disabled for this runtime."
    : hasRuntimePersistenceError(runtime)
      ? "Persistence reported a load, save, or clear error."
      : hasRuntimePersistencePending(runtime)
        ? "Persistence is actively loading, saving, or clearing."
        : persistence.hydratedFromSnapshot
          ? "Persistence is healthy and a snapshot was restored."
          : "Persistence is healthy and no snapshot restore was needed.";
  const persistenceTone: DetailItem["tone"] = !persistence.enabled
    ? "default"
    : hasRuntimePersistenceError(runtime)
      ? "danger"
      : hasRuntimePersistencePending(runtime)
        ? "warning"
        : "success";

  const reconnectValue = reconnectCountsMatch
    ? `Recovery and transport both report ${recovery.reconnectCount} reconnect cycle(s).`
    : `Recovery reports ${recovery.reconnectCount}, transport reports ${transport.reconnectCount}.`;

  const resetValue =
    recovery.resetCount === 0
      ? "No session reset has been exercised yet."
      : recovery.clearedPersistenceOnLastReset
        ? "The latest reset cleared persisted state before reconnecting."
        : "The latest reset preserved persisted state.";

  return [
    {
      id: "recovery-assert-mode",
      label: "Mode alignment",
      value: modeValue,
      tone: modeTone
    },
    {
      id: "recovery-assert-transport",
      label: "Transport continuity",
      value: transportValue,
      tone: transportTone
    },
    {
      id: "recovery-assert-persistence",
      label: "Persistence integrity",
      value: persistenceValue,
      tone: persistenceTone
    },
    {
      id: "recovery-assert-reconnect",
      label: "Reconnect accounting",
      value: reconnectValue,
      tone: reconnectCountsMatch ? "success" : "warning"
    },
    {
      id: "recovery-assert-reset",
      label: "Reset path",
      value: resetValue,
      tone:
        recovery.resetCount === 0
          ? "default"
          : recovery.clearedPersistenceOnLastReset
            ? "success"
            : "warning"
    },
    {
      id: "recovery-assert-hydration",
      label: "Snapshot hydration",
      value: persistence.hydratedFromSnapshot
        ? "A persisted snapshot has been restored into the current runtime."
        : "No persisted snapshot has been restored into the current runtime.",
      tone: persistence.hydratedFromSnapshot ? "success" : "default"
    }
  ];
}

function createRecoveryVerdictItems(runtime: RuntimeContextValue): DetailItem[] {
  const verdict = inferRecoveryVerdict(runtime);

  return [
    {
      id: "recovery-verdict",
      label: "Verdict",
      value: getRecoveryVerdictLabel(verdict),
      tone: verdict === "pass" ? "success" : "danger"
    },
    {
      id: "recovery-verdict-mode",
      label: "Mode",
      value: runtime.recovery.mode,
      tone:
        runtime.recovery.mode === "restored"
          ? "success"
          : runtime.recovery.mode === "fresh"
            ? "default"
            : "warning"
    },
    {
      id: "recovery-verdict-reason",
      label: "Reason",
      value:
        verdict === "pass"
          ? "Recovery, persistence, and transport signals are internally consistent."
          : "One or more recovery, persistence, or transport signals need review.",
      tone: verdict === "pass" ? "success" : "warning"
    }
  ];
}

function getBridgeCapabilityCounts(runtime: RuntimeContextValue) {
  const capabilityEntries = getRuntimeCapabilityHistoryEntries(runtime.history);
  const requestedCount = capabilityEntries.filter((entry) => entry.eventType === "capability.requested").length;
  const resolvedCount = capabilityEntries.filter((entry) => entry.eventType === "capability.resolved").length;

  return {
    requestedCount,
    resolvedCount,
    pendingCount: runtime.capabilityRequests.length
  };
}

function inferBridgeVerdict(runtime: RuntimeContextValue): BridgeVerdict {
  const previewableArtifacts = runtime.artifacts.filter((artifact) => artifact.previewable !== false).length;
  const openableArtifacts = runtime.artifacts.filter((artifact) => artifact.openable !== false).length;
  const shareableArtifacts = runtime.artifacts.filter(canShareArtifact).length;
  const downloadableArtifacts = runtime.artifacts.filter(canDownloadArtifact).length;
  const { requestedCount, resolvedCount, pendingCount } = getBridgeCapabilityCounts(runtime);
  const capabilityAccountingMismatch =
    resolvedCount > requestedCount || requestedCount > resolvedCount + pendingCount;
  const pendingCapabilityUnlocked =
    pendingCount > 0 &&
    runtime.interaction.input !== "locked" &&
    runtime.interaction.actions !== "locked" &&
    runtime.interaction.forms !== "locked";
  const artifactInventoryBlocked =
    runtime.artifacts.length > 0 &&
    previewableArtifacts === 0 &&
    openableArtifacts === 0 &&
    shareableArtifacts === 0 &&
    downloadableArtifacts === 0;

  if (capabilityAccountingMismatch || pendingCapabilityUnlocked || artifactInventoryBlocked) {
    return "needs-review";
  }

  return "pass";
}

function getBridgeVerdictLabel(verdict: BridgeVerdict) {
  return verdict === "pass" ? "Pass" : "Needs review";
}

function createBridgeAssertionItems(runtime: RuntimeContextValue): DetailItem[] {
  const previewableArtifacts = runtime.artifacts.filter((artifact) => artifact.previewable !== false);
  const openableArtifacts = runtime.artifacts.filter((artifact) => artifact.openable !== false);
  const shareableArtifacts = runtime.artifacts.filter(canShareArtifact);
  const downloadableArtifacts = runtime.artifacts.filter(canDownloadArtifact);
  const latestArtifact = runtime.artifacts[runtime.artifacts.length - 1];
  const latestCapabilityResolution = getRuntimeLastCapabilityResolutionEntry(runtime.history);
  const activeCapability = runtime.capabilityRequests[0];
  const { requestedCount, resolvedCount, pendingCount } = getBridgeCapabilityCounts(runtime);
  const capabilityAccountingMismatch =
    resolvedCount > requestedCount || requestedCount > resolvedCount + pendingCount;
  const pendingCapabilityLocked =
    pendingCount === 0 ||
    runtime.interaction.input === "locked" ||
    runtime.interaction.actions === "locked" ||
    runtime.interaction.forms === "locked";
  const actionableArtifactCount =
    previewableArtifacts.length + openableArtifacts.length + shareableArtifacts.length + downloadableArtifacts.length;

  return [
    {
      id: "bridge-assert-artifacts",
      label: "Artifact release",
      value:
        runtime.artifacts.length === 0
          ? "No artifacts are registered in the runtime yet."
          : actionableArtifactCount > 0
            ? `${runtime.artifacts.length} artifact(s) are registered with ${actionableArtifactCount} actionable bridge path(s).`
            : `${runtime.artifacts.length} artifact(s) are registered, but none are previewable, openable, shareable, or downloadable.`,
      tone:
        runtime.artifacts.length === 0
          ? "default"
          : actionableArtifactCount > 0
            ? "success"
            : "danger"
    },
    {
      id: "bridge-assert-capability-lock",
      label: "Capability lock",
      value:
        pendingCount === 0
          ? "No capability request is waiting in the runtime."
          : pendingCapabilityLocked
            ? `${pendingCount} capability request(s) are pending and the runtime is holding interaction locks.`
            : `${pendingCount} capability request(s) are pending, but the runtime is not holding an input, action, or form lock.`,
      tone:
        pendingCount === 0
          ? "default"
          : pendingCapabilityLocked
            ? "success"
            : "danger"
    },
    {
      id: "bridge-assert-capability-accounting",
      label: "Capability accounting",
      value: capabilityAccountingMismatch
        ? `Requested ${requestedCount}, resolved ${resolvedCount}, pending ${pendingCount}.`
        : `Requested ${requestedCount}, resolved ${resolvedCount}, pending ${pendingCount} stay internally consistent.`,
      tone: capabilityAccountingMismatch ? "danger" : "success"
    },
    {
      id: "bridge-assert-active-capability",
      label: "Active capability",
      value: activeCapability ? getCapabilityDisplayName(activeCapability.capability) : "None",
      tone: activeCapability ? "warning" : "default"
    },
    {
      id: "bridge-assert-latest-artifact",
      label: "Latest artifact",
      value: latestArtifact?.title ?? latestArtifact?.id ?? "None",
      tone: latestArtifact ? "success" : "default"
    },
    {
      id: "bridge-assert-last-resolution",
      label: "Last capability resolution",
      value: latestCapabilityResolution?.title ?? "No capability resolution recorded yet.",
      tone: latestCapabilityResolution ? "success" : "default"
    }
  ];
}

function createBridgeVerdictItems(runtime: RuntimeContextValue): DetailItem[] {
  const verdict = inferBridgeVerdict(runtime);
  const { requestedCount, resolvedCount, pendingCount } = getBridgeCapabilityCounts(runtime);
  const actionableArtifacts =
    runtime.artifacts.filter((artifact) => artifact.previewable !== false).length +
    runtime.artifacts.filter((artifact) => artifact.openable !== false).length +
    runtime.artifacts.filter(canShareArtifact).length +
    runtime.artifacts.filter(canDownloadArtifact).length;

  return [
    {
      id: "bridge-verdict",
      label: "Verdict",
      value: getBridgeVerdictLabel(verdict),
      tone: verdict === "pass" ? "success" : "danger"
    },
    {
      id: "bridge-verdict-summary",
      label: "Reason",
      value:
        verdict === "pass"
          ? "Artifact inventory and capability accounting are internally consistent."
          : "One or more bridge-level artifact or capability checks need review.",
      tone: verdict === "pass" ? "success" : "warning"
    },
    {
      id: "bridge-verdict-balance",
      label: "Bridge balance",
      value: `${runtime.artifacts.length} artifact(s) · ${actionableArtifacts} actionable path(s) · ${requestedCount}/${resolvedCount}/${pendingCount} capability requested-resolved-pending`,
      tone: verdict === "pass" ? "success" : "warning"
    }
  ];
}

function createBridgeIntegrationItems(diagnostics?: RendererDiagnostics): DetailItem[] {
  const artifactKinds = diagnostics?.artifactHandlerKinds ?? [];
  const capabilityKinds = diagnostics?.capabilityHandlerKinds ?? [];
  const hostOpenUrl = diagnostics?.hostBridgeOpenUrlEnabled ?? false;
  const hostShare = diagnostics?.hostBridgeShareEnabled ?? false;
  const hostResolveCapability = diagnostics?.hostBridgeResolveCapabilityEnabled ?? false;
  const hostMethodCount = [hostOpenUrl, hostShare, hostResolveCapability].filter(Boolean).length;

  let integrationMode = "Default renderer bridge only";
  let integrationTone: DetailItem["tone"] = "default";

  if (hostMethodCount > 0 || artifactKinds.length > 0 || capabilityKinds.length > 0) {
    integrationMode =
      hostMethodCount === 3
        ? "Host bridge + custom handlers"
        : hostMethodCount > 0
          ? "Mixed host bridge integration"
          : "Custom handlers without host bridge";
    integrationTone = "success";
  }

  return [
    {
      id: "bridge-integration-mode",
      label: "Integration mode",
      value: integrationMode,
      tone: integrationTone
    },
    {
      id: "bridge-integration-host-open-url",
      label: "Host openUrl",
      value: hostOpenUrl ? "enabled" : "renderer default",
      tone: hostOpenUrl ? "success" : "default"
    },
    {
      id: "bridge-integration-host-share",
      label: "Host share",
      value: hostShare ? "enabled" : "renderer default",
      tone: hostShare ? "success" : "default"
    },
    {
      id: "bridge-integration-host-capability",
      label: "Host resolveCapability",
      value: hostResolveCapability ? "enabled" : "renderer default or mock",
      tone: hostResolveCapability ? "success" : "warning"
    },
    {
      id: "bridge-integration-artifact-handlers",
      label: "Artifact handlers",
      value: artifactKinds.length > 0 ? artifactKinds.join(", ") : "None",
      tone: artifactKinds.length > 0 ? "success" : "default"
    },
    {
      id: "bridge-integration-capability-handlers",
      label: "Capability handlers",
      value: capabilityKinds.length > 0 ? capabilityKinds.join(", ") : "None",
      tone: capabilityKinds.length > 0 ? "success" : "default"
    },
    {
      id: "bridge-integration-mock-risk",
      label: "Mock fallback risk",
      value:
        hostResolveCapability || capabilityKinds.length > 0
          ? "Capability flows have an app-level integration path."
          : "Unmapped capability flows may fall back to renderer default mock payloads.",
      tone: hostResolveCapability || capabilityKinds.length > 0 ? "success" : "warning"
    }
  ];
}

function describeArtifactRoute(
  kind: ArtifactRef["kind"],
  mode: "preview" | "open" | "share" | "download",
  diagnostics?: RendererDiagnostics
) {
  const coverage = diagnostics?.artifactHandlerCoverage.find((item) => item.kind === kind);

  if (mode === "preview") {
    return coverage?.preview ? "artifact handler" : "renderer default preview";
  }

  if (mode === "open") {
    if (coverage?.open) {
      return "artifact handler";
    }

    return diagnostics?.hostBridgeOpenUrlEnabled ? "hostBridge.openUrl" : "renderer default openURL";
  }

  if (mode === "share") {
    if (coverage?.share) {
      return "artifact handler";
    }

    return diagnostics?.hostBridgeShareEnabled ? "hostBridge.share" : "renderer default share sheet";
  }

  if (coverage?.download) {
    return "artifact handler";
  }

  return diagnostics?.hostBridgeOpenUrlEnabled ? "hostBridge.openUrl" : "renderer default openURL";
}

function describeCapabilityGrantRoute(capability: CapabilityRequest["capability"], diagnostics?: RendererDiagnostics) {
  const coverage = diagnostics?.capabilityHandlerCoverage.find((item) => item.capability === capability);

  if (coverage?.resolve) {
    return "capability handler";
  }

  if (capability === "open-url") {
    return diagnostics?.hostBridgeOpenUrlEnabled ? "hostBridge.openUrl" : "renderer default openURL";
  }

  if (capability === "share") {
    return diagnostics?.hostBridgeShareEnabled ? "hostBridge.share" : "renderer default share sheet";
  }

  return diagnostics?.hostBridgeResolveCapabilityEnabled ? "hostBridge.resolveCapability" : "renderer default mock payload";
}

function describeCapabilityDenyRoute(capability: CapabilityRequest["capability"], diagnostics?: RendererDiagnostics) {
  const coverage = diagnostics?.capabilityHandlerCoverage.find((item) => item.capability === capability);

  if (coverage?.resolve) {
    return "capability handler";
  }

  return diagnostics?.hostBridgeResolveCapabilityEnabled ? "hostBridge.resolveCapability" : "no explicit deny resolver";
}

function createBridgeRoutingItems(diagnostics?: RendererDiagnostics): DetailItem[] {
  return [
    {
      id: "bridge-routing-artifact-link",
      label: "Artifact link",
      value: `preview ${describeArtifactRoute("link", "preview", diagnostics)} · open ${describeArtifactRoute("link", "open", diagnostics)} · share ${describeArtifactRoute("link", "share", diagnostics)}`,
      tone: "default"
    },
    {
      id: "bridge-routing-artifact-pdf",
      label: "Artifact pdf",
      value: `preview ${describeArtifactRoute("pdf", "preview", diagnostics)} · open ${describeArtifactRoute("pdf", "open", diagnostics)} · download ${describeArtifactRoute("pdf", "download", diagnostics)}`,
      tone: "default"
    },
    {
      id: "bridge-routing-artifact-image",
      label: "Artifact image",
      value: `preview ${describeArtifactRoute("image", "preview", diagnostics)} · open ${describeArtifactRoute("image", "open", diagnostics)} · share ${describeArtifactRoute("image", "share", diagnostics)}`,
      tone: "default"
    },
    {
      id: "bridge-routing-cap-open-url",
      label: "Capability open-url",
      value: `grant ${describeCapabilityGrantRoute("open-url", diagnostics)} · deny ${describeCapabilityDenyRoute("open-url", diagnostics)}`,
      tone: "default"
    },
    {
      id: "bridge-routing-cap-share",
      label: "Capability share",
      value: `grant ${describeCapabilityGrantRoute("share", diagnostics)} · deny ${describeCapabilityDenyRoute("share", diagnostics)}`,
      tone: "default"
    },
    {
      id: "bridge-routing-cap-device",
      label: "Capability device",
      value: `microphone ${describeCapabilityGrantRoute("microphone", diagnostics)} · camera ${describeCapabilityGrantRoute("camera", diagnostics)} · file-picker ${describeCapabilityGrantRoute("file-picker", diagnostics)}`,
      tone:
        diagnostics?.hostBridgeResolveCapabilityEnabled || (diagnostics?.capabilityHandlerKinds.length ?? 0) > 0
          ? "success"
          : "warning"
    }
  ];
}

function getInteractionTone(value: "enabled" | "locked"): DetailItem["tone"] {
  return value === "locked" ? "warning" : "success";
}

function createRuntimeDetailsBlock(
  block: DetailsBlock,
  runtime: RuntimeContextValue,
  diagnostics?: RendererDiagnostics
): DetailsBlock {
  if (!block.source) {
    return block;
  }

  let items: DetailItem[] = [];

  if (block.source === "runtime.flow") {
    items = [
      {
        id: `${block.id}-request-id`,
        label: "Request ID",
        value: runtime.flow.requestId ?? "None"
      },
      {
        id: `${block.id}-source`,
        label: "Source",
        value: runtime.flow.source ?? "None"
      },
      {
        id: `${block.id}-profile`,
        label: "Flow profile",
        value: getRequestFlowProfileLabel(
          inferRequestFlowProfile(
            summarizeRuntimeRequestEntries(getRuntimeCurrentRequestEntries(runtime), runtime.flow.requestId)
          )
        )
      },
      {
        id: `${block.id}-phase`,
        label: "Flow phase",
        value: runtime.flow.phase,
        tone: runtime.flow.phase === "complete" ? "success" : runtime.flow.phase === "active" ? "warning" : "default"
      },
      {
        id: `${block.id}-mode`,
        label: "Screen mode",
        value: runtime.screenMode
      },
      {
        id: `${block.id}-transition`,
        label: "Transition",
        value: runtime.flow.transition ?? "None"
      },
      {
        id: `${block.id}-screen-id`,
        label: "Screen ID",
        value: runtime.flow.screenId ?? "None"
      },
      {
        id: `${block.id}-last-completed-request-id`,
        label: "Last completed",
        value: runtime.flow.lastCompletedRequestId ?? "None"
      },
      {
        id: `${block.id}-history-entry-count`,
        label: "Request events",
        value: String(runtime.flow.historyEntryCount)
      },
      {
        id: `${block.id}-workspace-event-count`,
        label: "Workspace events",
        value: String(runtime.flow.workspaceEventCount)
      },
      {
        id: `${block.id}-patch-event-count`,
        label: "Patch events",
        value: String(runtime.flow.patchEventCount)
      },
      {
        id: `${block.id}-resource-event-count`,
        label: "Resource events",
        value: String(runtime.flow.resourceEventCount)
      },
      {
        id: `${block.id}-issue-count`,
        label: "Issues",
        value: String(runtime.flow.issueCount)
      }
    ];
  } else if (block.source === "runtime.requestIndexSummary") {
    items = createRequestIndexSummaryItems(runtime);
  } else if (block.source === "runtime.bridge") {
    const previewableArtifacts = runtime.artifacts.filter((artifact) => artifact.previewable !== false);
    const openableArtifacts = runtime.artifacts.filter((artifact) => artifact.openable !== false);
    const downloadableArtifacts = runtime.artifacts.filter(canDownloadArtifact);
    const shareableArtifacts = runtime.artifacts.filter(canShareArtifact);
    const latestArtifact = runtime.artifacts[runtime.artifacts.length - 1];
    const activeCapability = runtime.capabilityRequests[0];

    items = [
      {
        id: `${block.id}-artifact-count`,
        label: "Artifacts",
        value: String(runtime.artifacts.length),
        tone: runtime.artifacts.length > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-previewable-count`,
        label: "Previewable",
        value: String(previewableArtifacts.length),
        tone: previewableArtifacts.length > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-openable-count`,
        label: "Openable",
        value: String(openableArtifacts.length),
        tone: openableArtifacts.length > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-shareable-count`,
        label: "Shareable",
        value: String(shareableArtifacts.length),
        tone: shareableArtifacts.length > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-downloadable-count`,
        label: "Downloadable",
        value: String(downloadableArtifacts.length),
        tone: downloadableArtifacts.length > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-pending-capabilities`,
        label: "Pending capabilities",
        value: String(runtime.capabilityRequests.length),
        tone: runtime.capabilityRequests.length > 0 ? "warning" : "success"
      },
      {
        id: `${block.id}-active-capability`,
        label: "Active capability",
        value: activeCapability ? getCapabilityDisplayName(activeCapability.capability) : "None",
        tone: activeCapability ? "warning" : "default"
      },
      {
        id: `${block.id}-latest-artifact`,
        label: "Latest artifact",
        value: latestArtifact?.title ?? latestArtifact?.id ?? "None"
      },
      {
        id: `${block.id}-artifact-lock`,
        label: "Artifact access",
        value: runtime.interaction.artifacts,
        tone: getInteractionTone(runtime.interaction.artifacts)
      }
    ];
  } else if (block.source === "runtime.bridgeAssertions") {
    items = createBridgeAssertionItems(runtime);
  } else if (block.source === "runtime.bridgeVerdict") {
    items = createBridgeVerdictItems(runtime);
  } else if (block.source === "runtime.bridgeIntegration") {
    items = createBridgeIntegrationItems(diagnostics);
  } else if (block.source === "runtime.bridgeRouting") {
    items = createBridgeRoutingItems(diagnostics);
  } else if (block.source === "runtime.bridgeErrors") {
    items = [
      {
        id: `${block.id}-artifact-bridge-error`,
        label: "Artifact bridge error",
        value: diagnostics?.artifactBridgeError ?? "None",
        tone: diagnostics?.artifactBridgeError ? "danger" : "default"
      },
      {
        id: `${block.id}-capability-bridge-error`,
        label: "Capability bridge error",
        value: diagnostics?.capabilityBridgeError ?? "None",
        tone: diagnostics?.capabilityBridgeError ? "danger" : "default"
      },
      {
        id: `${block.id}-active-capability`,
        label: "Pending capability",
        value: runtime.capabilityRequests[0] ? getCapabilityDisplayName(runtime.capabilityRequests[0].capability) : "None",
        tone: runtime.capabilityRequests[0] ? "warning" : "default"
      }
    ];
  } else if (block.source === "runtime.navigation") {
    items = createRuntimeNavigationDetailItems(runtime, block.id);
  } else if (block.source === "runtime.persistence") {
    items = createRuntimePersistenceDetailItems(runtime, block.id);
  } else if (block.source === "runtime.transport") {
    items = [
      {
        id: `${block.id}-connect-state`,
        label: "Connect state",
        value: runtime.transport.connectState,
        tone:
          runtime.transport.connectState === "connected"
            ? "success"
            : runtime.transport.connectState === "error"
              ? "danger"
              : runtime.transport.connectState === "connecting"
                ? "warning"
                : "default"
      },
      {
        id: `${block.id}-connect-count`,
        label: "Connect count",
        value: String(runtime.transport.connectCount)
      },
      {
        id: `${block.id}-disconnect-count`,
        label: "Disconnect count",
        value: String(runtime.transport.disconnectCount)
      },
      {
        id: `${block.id}-reconnect-count`,
        label: "Reconnect count",
        value: String(runtime.transport.reconnectCount)
      },
      {
        id: `${block.id}-last-connected-at`,
        label: "Last connected",
        value: runtime.transport.lastConnectedAt ? formatHistoryTimestamp(runtime.transport.lastConnectedAt) : "None"
      },
      {
        id: `${block.id}-last-disconnected-at`,
        label: "Last disconnected",
        value: runtime.transport.lastDisconnectedAt ? formatHistoryTimestamp(runtime.transport.lastDisconnectedAt) : "None"
      },
      {
        id: `${block.id}-last-connect-error`,
        label: "Connect error",
        value: runtime.transport.lastConnectError ?? "None"
      }
    ];
  } else if (block.source === "runtime.recovery") {
    items = [
      {
        id: `${block.id}-mode`,
        label: "Recovery mode",
        value: runtime.recovery.mode,
        tone:
          runtime.recovery.mode === "restored"
            ? "success"
            : runtime.recovery.mode === "reset"
              ? "warning"
              : runtime.recovery.mode === "reconnected"
                ? "warning"
                : "default"
      },
      {
        id: `${block.id}-reset-count`,
        label: "Reset count",
        value: String(runtime.recovery.resetCount)
      },
      {
        id: `${block.id}-reconnect-count`,
        label: "Reconnect count",
        value: String(runtime.recovery.reconnectCount)
      },
      {
        id: `${block.id}-last-reset-at`,
        label: "Last reset",
        value: runtime.recovery.lastResetAt ? formatHistoryTimestamp(runtime.recovery.lastResetAt) : "None"
      },
      {
        id: `${block.id}-last-reconnect-at`,
        label: "Last reconnect",
        value: runtime.recovery.lastReconnectAt ? formatHistoryTimestamp(runtime.recovery.lastReconnectAt) : "None"
      },
      {
        id: `${block.id}-last-recovery-at`,
        label: "Last recovery event",
        value: runtime.recovery.lastRecoveryAt ? formatHistoryTimestamp(runtime.recovery.lastRecoveryAt) : "None"
      },
      {
        id: `${block.id}-cleared-on-reset`,
        label: "Cleared persistence on last reset",
        value: runtime.recovery.clearedPersistenceOnLastReset ? "yes" : "no",
        tone: runtime.recovery.clearedPersistenceOnLastReset ? "success" : "default"
      }
    ];
  } else if (block.source === "runtime.recoveryAssertions") {
    items = createRecoveryAssertionItems(runtime);
  } else if (block.source === "runtime.recoveryVerdict") {
    items = createRecoveryVerdictItems(runtime);
  } else if (block.source === "runtime.interaction") {
    items = [
      {
        id: `${block.id}-input`,
        label: "Input",
        value: runtime.interaction.input,
        tone: getInteractionTone(runtime.interaction.input)
      },
      {
        id: `${block.id}-actions`,
        label: "Actions",
        value: runtime.interaction.actions,
        tone: getInteractionTone(runtime.interaction.actions)
      },
      {
        id: `${block.id}-forms`,
        label: "Forms",
        value: runtime.interaction.forms,
        tone: getInteractionTone(runtime.interaction.forms)
      },
      {
        id: `${block.id}-artifacts`,
        label: "Artifacts",
        value: runtime.interaction.artifacts,
        tone: getInteractionTone(runtime.interaction.artifacts)
      },
      {
        id: `${block.id}-history`,
        label: "History",
        value: runtime.interaction.history,
        tone: getInteractionTone(runtime.interaction.history)
      },
      {
        id: `${block.id}-reason`,
        label: "Lock reason",
        value: runtime.interaction.reason ?? "None"
      }
    ];
  } else if (block.source === "runtime.lastCapabilityResolution") {
    const resolutionEntry = getRuntimeLastCapabilityResolutionEntry(runtime.history);

    items = [
      {
        id: `${block.id}-title`,
        label: "State",
        value: resolutionEntry ? resolutionEntry.title : "No capability resolution recorded yet.",
        tone: resolutionEntry ? "success" : "default"
      },
      {
        id: `${block.id}-request-id`,
        label: "Request ID",
        value: resolutionEntry?.meta ?? "None"
      },
      {
        id: `${block.id}-request-source`,
        label: "Source",
        value: formatHistoryRequestSource(resolutionEntry?.requestSource) ?? "None"
      },
      {
        id: `${block.id}-timestamp`,
        label: "Timestamp",
        value: resolutionEntry ? formatHistoryTimestamp(resolutionEntry.timestamp) : "None"
      },
      {
        id: `${block.id}-payload`,
        label: "Payload",
        value: resolutionEntry?.body ?? "No payload recorded."
      }
    ];
  } else if (
    block.source === "runtime.request" ||
    block.source === "runtime.currentRequest" ||
    block.source === "runtime.lastCompletedRequest"
  ) {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    const profile = inferRequestFlowProfile(summary);

    items = [
      {
        id: `${block.id}-request-id`,
        label: "Request ID",
        value: chain.requestId ?? "None"
      },
      {
        id: `${block.id}-source`,
        label: "Source",
        value: formatHistoryRequestSource(summary.source) ?? "None"
      },
      {
        id: `${block.id}-profile`,
        label: "Flow profile",
        value: getRequestFlowProfileLabel(profile)
      },
      {
        id: `${block.id}-entry-count`,
        label: "History entries",
        value: String(summary.entryCount)
      },
      {
        id: `${block.id}-first-entry`,
        label: "First entry",
        value: summary.firstTitle ?? "None"
      },
      {
        id: `${block.id}-latest-entry`,
        label: "Latest entry",
        value: summary.latestTitle ?? "None"
      },
      {
        id: `${block.id}-mode-path`,
        label: "Mode path",
        value: summary.modePath
      },
      {
        id: `${block.id}-workspace-count`,
        label: "Workspace events",
        value: String(summary.workspaceCount)
      },
      {
        id: `${block.id}-patch-count`,
        label: "Patch events",
        value: String(summary.patchCount)
      },
      {
        id: `${block.id}-resource-count`,
        label: "Resource events",
        value: String(summary.resourceCount)
      },
      {
        id: `${block.id}-screen-id`,
        label: "Last screen ID",
        value: summary.latestScreenId ?? "None"
      },
      {
        id: `${block.id}-screen-mode`,
        label: "Last screen mode",
        value: summary.latestScreenMode ?? "None"
      },
      {
        id: `${block.id}-request-signal`,
        label: "Chain signal",
        value: summary.hasResultScreen ? "Completed with result" : summary.entryCount > 0 ? "Still evolving" : "No request chain",
        tone: getRequestSummarySignal(summary)
      }
    ];
  } else if (block.source === "runtime.currentRequestResources") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    items = createRequestResourceDetailItems(chain.entries, chain.requestId);
  } else if (block.source === "runtime.lastCompletedRequestResources" || block.source === "runtime.requestResources") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    items = createRequestResourceDetailItems(chain.entries, chain.requestId);
  } else if (block.source === "runtime.requestStageSummary") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const stages = getRuntimeRequestTimelineStageSummaries(chain.entries, chain.requestId);
    const latestStage = stages[stages.length - 1];
    const patchStages = stages.filter((stage) => stage.patchCount > 0).length;
    const resourceStages = stages.filter((stage) => stage.resourceCount > 0).length;
    const issueStages = stages.filter((stage) => stage.issueCount > 0).length;

    items = [
      {
        id: `${block.id}-stage-count`,
        label: "Stages",
        value: String(stages.length),
        tone: stages.length > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-latest-stage`,
        label: "Latest stage",
        value: latestStage?.title ?? "None"
      },
      {
        id: `${block.id}-latest-stage-status`,
        label: "Latest status",
        value: latestStage?.status ?? "None",
        tone:
          latestStage?.status === "complete"
            ? "success"
            : latestStage?.status === "active"
              ? "warning"
              : latestStage?.status === "error"
                ? "danger"
                : "default"
      },
      {
        id: `${block.id}-patch-stages`,
        label: "Patch stages",
        value: String(patchStages),
        tone: patchStages > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-resource-stages`,
        label: "Resource stages",
        value: String(resourceStages),
        tone: resourceStages > 0 ? "success" : "default"
      },
      {
        id: `${block.id}-issue-stages`,
        label: "Issue stages",
        value: String(issueStages),
        tone: issueStages > 0 ? "danger" : "success"
      }
    ];
  } else if (block.source === "runtime.session") {
    items = [
      {
        id: `${block.id}-session-id`,
        label: "Session ID",
        value: runtime.sessionId ?? "None"
      },
      {
        id: `${block.id}-runtime-phase`,
        label: "Runtime phase",
        value: runtime.phase
      },
      {
        id: `${block.id}-status`,
        label: "Status",
        value: runtime.status
      },
      {
        id: `${block.id}-screen-title`,
        label: "Screen title",
        value: runtime.screen?.title ?? "None"
      },
      {
        id: `${block.id}-history-count`,
        label: "History entries",
        value: String(runtime.history.length)
      },
      {
        id: `${block.id}-event-count`,
        label: "Event entries",
        value: String(runtime.eventLog.length)
      },
      {
        id: `${block.id}-persistence`,
        label: "Persistence",
        value: runtime.persistence.enabled ? "enabled" : "disabled",
        tone: runtime.persistence.enabled ? "success" : "default"
      },
      {
        id: `${block.id}-hydrated`,
        label: "Hydrated snapshot",
        value: runtime.persistence.hydratedFromSnapshot ? "yes" : "no",
        tone: runtime.persistence.hydratedFromSnapshot ? "success" : "default"
      },
      {
        id: `${block.id}-save-state`,
        label: "Save state",
        value: runtime.persistence.saveState,
        tone:
          runtime.persistence.saveState === "ready"
            ? "success"
            : runtime.persistence.saveState === "error"
              ? "danger"
              : runtime.persistence.saveState === "saving"
                ? "warning"
                : "default"
      },
      {
        id: `${block.id}-connect-state`,
        label: "Connect state",
        value: runtime.transport.connectState,
        tone:
          runtime.transport.connectState === "connected"
            ? "success"
            : runtime.transport.connectState === "error"
              ? "danger"
              : runtime.transport.connectState === "connecting"
                ? "warning"
                : "default"
      }
    ];
  } else if (block.source === "runtime.currentRequestAssertions" || block.source === "runtime.requestAssertions") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    items =
      resolveRequestEvaluationMode(runtime, block.source, block.requestTarget, summary) === "completed"
        ? createCompletedRequestAssertionItems(summary)
        : createCurrentRequestAssertionItems(runtime, summary);
  } else if (block.source === "runtime.lastCompletedRequestAssertions") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    items = createCompletedRequestAssertionItems(summary);
  } else if (block.source === "runtime.currentRequestMatrix" || block.source === "runtime.requestMatrix") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    items = createRequestMatrixItems(
      summary,
      resolveRequestEvaluationMode(runtime, block.source, block.requestTarget, summary)
    );
  } else if (block.source === "runtime.lastCompletedRequestMatrix") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    items = createRequestMatrixItems(summary, "completed");
  } else if (block.source === "runtime.currentRequestVerdict" || block.source === "runtime.requestVerdict") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    items = createRequestVerdictItems(
      summary,
      resolveRequestEvaluationMode(runtime, block.source, block.requestTarget, summary)
    );
  } else if (block.source === "runtime.lastCompletedRequestVerdict") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const summary = chain.summary;
    items = createRequestVerdictItems(summary, "completed");
  }

  return {
    ...block,
    items
  };
}

function resolveRuntimeLeafBlock(
  block: LeafBlock,
  runtime: RuntimeContextValue,
  diagnostics?: RendererDiagnostics
): LeafBlock {
  if (block.type === "actions" && block.source) {
    if (block.source === "runtime.requestIndexActions") {
      return {
        ...block,
        items: createRequestIndexActionItems(runtime, block.maxItems)
      };
    }

    if (block.source === "runtime.persistenceActions") {
      return {
        ...block,
        items: createRuntimePersistenceActionItems(runtime).slice(0, block.maxItems ?? 8)
      };
    }

    if (block.source === "runtime.sessionActions") {
      return {
        ...block,
        items: createRuntimeSessionActionItems(runtime).slice(0, block.maxItems ?? 8)
      };
    }
  }

  if (block.type === "timeline" && block.source === "runtime.requestTimeline") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);

    return {
      ...block,
      items: getRuntimeRequestTimelineItems(chain.entries, chain.requestId, block.maxItems)
    };
  }

  if (block.type === "details" && block.source) {
    return createRuntimeDetailsBlock(block, runtime, diagnostics);
  }

  if (block.type !== "log" || !block.source) {
    return block;
  }

  if (block.source === "runtime.history") {
    const historyLogBlock: LogBlock = {
      ...block,
      items: [...runtime.history]
        .reverse()
        .slice(0, block.maxItems ?? 20)
        .map(createHistoryLogItem)
    };

    return historyLogBlock;
  }

  if (block.source === "runtime.requestIndex") {
    const requestIndexLogBlock: LogBlock = {
      ...block,
      items: createRequestIndexLogItems(runtime, block.maxItems)
    };

    return requestIndexLogBlock;
  }

  if (block.source === "runtime.requestStageLog") {
    const requestStageLogBlock: LogBlock = {
      ...block,
      items: createRequestStageLogItems(runtime, block.source, block.requestTarget, block.maxItems)
    };

    return requestStageLogBlock;
  }

  if (block.source === "runtime.transportLog") {
    const transportLogBlock: LogBlock = {
      ...block,
      items: createRuntimeTransportLogItems(runtime, block.maxItems)
    };

    return transportLogBlock;
  }

  if (block.source === "runtime.persistenceLog") {
    const persistenceLogBlock: LogBlock = {
      ...block,
      items: createRuntimePersistenceLogItems(runtime, block.maxItems)
    };

    return persistenceLogBlock;
  }

  if (block.source === "runtime.sessionLog") {
    const sessionLogBlock: LogBlock = {
      ...block,
      items: createRuntimeSessionLogItems(runtime, block.maxItems)
    };

    return sessionLogBlock;
  }

  if (block.source === "runtime.capabilityHistory") {
    const capabilityHistoryLogBlock: LogBlock = {
      ...block,
      items: getRuntimeCapabilityHistoryEntries(runtime.history)
        .slice()
        .reverse()
        .slice(0, block.maxItems ?? 20)
        .map(createHistoryLogItem)
    };

    return capabilityHistoryLogBlock;
  }

  if (block.source === "runtime.artifacts") {
    const artifactLogBlock: LogBlock = {
      ...block,
      items: [...runtime.artifacts]
        .reverse()
        .slice(0, block.maxItems ?? 20)
        .map(createArtifactLogItem)
    };

    return artifactLogBlock;
  }

  if (block.source === "runtime.capabilityRequests") {
    const capabilityLogBlock: LogBlock = {
      ...block,
      items: [...runtime.capabilityRequests]
        .reverse()
        .slice(0, block.maxItems ?? 20)
        .map(createCapabilityRequestLogItem)
    };

    return capabilityLogBlock;
  }

  if (block.source === "runtime.currentRequestHistory" || block.source === "runtime.requestHistory") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const currentRequestHistoryLogBlock: LogBlock = {
      ...block,
      items: chain.entries
        .slice(-(block.maxItems ?? 20))
        .reverse()
        .map(createHistoryLogItem)
    };

    return currentRequestHistoryLogBlock;
  }

  if (block.source === "runtime.currentRequestResourceHistory" || block.source === "runtime.requestResourceHistory") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const currentRequestResourceHistoryLogBlock: LogBlock = {
      ...block,
      items: getRuntimeRequestResourceEntries(chain.entries)
        .slice(-(block.maxItems ?? 20))
        .reverse()
        .map(createHistoryLogItem)
    };

    return currentRequestResourceHistoryLogBlock;
  }

  if (block.source === "runtime.lastCompletedRequestHistory") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const lastCompletedRequestHistoryLogBlock: LogBlock = {
      ...block,
      items: chain.entries
        .slice(-(block.maxItems ?? 20))
        .reverse()
        .map(createHistoryLogItem)
    };

    return lastCompletedRequestHistoryLogBlock;
  }

  if (block.source === "runtime.lastCompletedRequestResourceHistory") {
    const chain = getResolvedRequestChain(runtime, block.source, block.requestTarget);
    const lastCompletedRequestResourceHistoryLogBlock: LogBlock = {
      ...block,
      items: getRuntimeRequestResourceEntries(chain.entries)
        .slice(-(block.maxItems ?? 20))
        .reverse()
        .map(createHistoryLogItem)
    };

    return lastCompletedRequestResourceHistoryLogBlock;
  }

  const runtimeLogBlock: LogBlock = {
    ...block,
    items: [...runtime.eventLog]
      .reverse()
      .slice(0, block.maxItems ?? 20)
      .map(createRuntimeLogItem)
  };

  return runtimeLogBlock;
}

function resolveRuntimeNestableBlock(
  block: NestableBlock,
  runtime: RuntimeContextValue,
  diagnostics?: RendererDiagnostics
): NestableBlock {
  if (block.type === "section") {
    return {
      ...block,
      blocks: block.blocks.map((childBlock): LeafBlock => resolveRuntimeLeafBlock(childBlock, runtime, diagnostics))
    };
  }

  return resolveRuntimeLeafBlock(block, runtime, diagnostics);
}

function resolveRuntimeBlock(block: Block, runtime: RuntimeContextValue, diagnostics?: RendererDiagnostics): Block {
  if (block.type === "split") {
    return {
      ...block,
      panes: block.panes.map((pane) => ({
        ...pane,
        blocks: pane.blocks.map((childBlock): NestableBlock =>
          resolveRuntimeNestableBlock(childBlock, runtime, diagnostics)
        )
      }))
    };
  }

  return resolveRuntimeNestableBlock(block, runtime, diagnostics);
}

function resolveRuntimeBlocks(blocks: Block[], runtime: RuntimeContextValue, diagnostics?: RendererDiagnostics) {
  return blocks.map((block) => resolveRuntimeBlock(block, runtime, diagnostics));
}

function collectBlockTypes(blocks: Block[]) {
  const types: Block["type"][] = [];

  for (const block of blocks) {
    types.push(block.type);

    if (block.type === "section") {
      types.push(...block.blocks.map((child) => child.type));
      continue;
    }

    if (block.type === "split") {
      for (const pane of block.panes) {
        types.push(...pane.blocks.map((child) => child.type));
      }
    }
  }

  return types;
}

function detectScreenArchetype(screen?: RuntimeContextValue["screen"]): ScreenArchetype {
  if (!screen) {
    return "workspace";
  }

  const hint = `${screen.id} ${screen.title ?? ""} ${screen.subtitle ?? ""}`.toLowerCase();
  const blockTypes = collectBlockTypes(screen.blocks);
  const hasType = (type: Block["type"]) => blockTypes.includes(type);

  if (hasType("form")) {
    return "form";
  }

  if (hint.includes("plan")) {
    return "plan";
  }

  if (hasType("timeline") || hint.includes("timeline")) {
    return "timeline";
  }

  if ((hasType("details") && screen.blocks.length <= 3) || hint.includes("brief") || hint.includes("summary")) {
    return "brief";
  }

  if (hasType("split") || hasType("section")) {
    return "workspace";
  }

  if (hasType("resource") || hasType("log")) {
    return "resource";
  }

  return "workspace";
}

function getArchetypeCopy(archetype: ScreenArchetype) {
  switch (archetype) {
    case "plan":
      return {
        label: "Plan",
        note: "Sequenced task layout",
        metric: "Step orchestration"
      };
    case "timeline":
      return {
        label: "Timeline",
        note: "Execution progression view",
        metric: "Stage progression"
      };
    case "brief":
      return {
        label: "Brief",
        note: "Compact decision surface",
        metric: "Summary density"
      };
    case "form":
      return {
        label: "Form",
        note: "Structured input surface",
        metric: "Input capture"
      };
    case "resource":
      return {
        label: "Resource",
        note: "Artifacts and logs surface",
        metric: "Reference access"
      };
    case "workspace":
    default:
      return {
        label: "Workspace",
        note: "Multi-block task surface",
        metric: "Mixed execution context"
      };
  }
}

function getScreenModeCopy(mode: RuntimeContextValue["screenMode"]) {
  switch (mode) {
    case "processing":
      return {
        label: "Processing",
        note: "Request is being assembled"
      };
    case "task":
      return {
        label: "Task",
        note: "Live task surface"
      };
    case "result":
      return {
        label: "Result",
        note: "Resolved output surface"
      };
    case "approval":
      return {
        label: "Approval",
        note: "Decision required"
      };
    case "error":
      return {
        label: "Error",
        note: "Recovery surface"
      };
    case "stable":
    default:
      return {
        label: "Stable",
        note: "Ready for input"
      };
  }
}

function getNavStatusLabel(runtime: RuntimeContextValue, isListening: boolean) {
  if (runtime.error || runtime.screenMode === "error") {
    return "Error";
  }

  if (isListening) {
    return "Listening";
  }

  switch (runtime.screenMode) {
    case "processing":
      return "Processing";
    case "task":
      return "In progress";
    case "approval":
      return "Needs decision";
    case "stable":
    case "result":
    default:
      return "Ready";
  }
}

function getFallbackScreenTitle(runtime: RuntimeContextValue) {
  if (runtime.screen?.title) {
    return runtime.screen.title;
  }

  if (runtime.screenMode === "processing" || runtime.status === "thinking" || runtime.status === "running") {
    return "Processing";
  }

  if (runtime.screenMode === "approval") {
    return "Approval";
  }

  if (runtime.screenMode === "task") {
    return "Task";
  }

  if (runtime.screenMode === "result") {
    return "Result";
  }

  return "Workspace";
}

function getFallbackWorkspaceMessage(runtime: RuntimeContextValue) {
  if (runtime.error) {
    return runtime.error;
  }

  if (runtime.screenMode === "processing" || runtime.status === "thinking" || runtime.status === "running") {
    return runtime.flow.requestId
      ? `Waiting for the harness to publish the next workspace surface for ${formatHistoryRequestId(runtime.flow.requestId)}.`
      : "Waiting for the harness to publish the next workspace surface.";
  }

  if (runtime.screenMode === "approval") {
    return "The runtime is waiting for a capability or approval surface from the harness.";
  }

  if (runtime.screenMode === "result") {
    return "The previous request completed without a result surface. Publish a result screen or reset to a stable workspace.";
  }

  if (runtime.screenMode === "task") {
    return "The runtime is inside a task flow, but no task workspace has been published yet.";
  }

  return "The runtime is ready. Submit voice or text input to start the next request flow.";
}

function formatRuntimeLockSummary(runtime: RuntimeContextValue) {
  const locked: string[] = [];

  if (runtime.interaction.input === "locked") {
    locked.push("input");
  }

  if (runtime.interaction.actions === "locked") {
    locked.push("actions");
  }

  if (runtime.interaction.forms === "locked") {
    locked.push("forms");
  }

  if (runtime.interaction.artifacts === "locked") {
    locked.push("artifacts");
  }

  return locked.length > 0 ? locked.join(", ") : "none";
}

function getRuntimeStageBanner(runtime: RuntimeContextValue) {
  const activeCapability = runtime.capabilityRequests[0];

  if (runtime.error || runtime.screenMode === "error") {
    return {
      tone: "danger" as const,
      label: "Runtime issue",
      message: runtime.error ?? "The runtime is in an error state and requires recovery."
    };
  }

  if (runtime.screenMode === "approval" || activeCapability) {
    return {
      tone: "warning" as const,
      label: "Approval pending",
      message: activeCapability
        ? `Waiting for ${getCapabilityDisplayName(activeCapability.capability)} to be resolved before the request can continue.`
        : "The runtime is waiting for an approval or capability decision."
    };
  }

  if (runtime.screenMode === "processing" || runtime.status === "thinking" || runtime.status === "running") {
    return {
      tone: "info" as const,
      label: "Processing",
      message: runtime.interaction.reason ?? "The runtime is waiting for the harness to advance the active request."
    };
  }

  if (runtime.screenMode === "task") {
    return {
      tone: "info" as const,
      label: "Task in progress",
      message: runtime.interaction.reason ?? "The runtime is holding on an in-flight task workspace."
    };
  }

  if (runtime.screenMode === "result" && runtime.flow.lastCompletedRequestId) {
    return {
      tone: "success" as const,
      label: "Result ready",
      message: "The latest request has completed and the result surface is ready for review."
    };
  }

  return undefined;
}

function createRuntimeStageFacts(runtime: RuntimeContextValue) {
  const facts: Array<{ label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }> = [];
  const activeCapability = runtime.capabilityRequests[0];

  if (runtime.flow.requestId) {
    facts.push({
      label: "Request",
      value: formatHistoryRequestId(runtime.flow.requestId) ?? runtime.flow.requestId
    });
  }

  if (runtime.flow.source) {
    facts.push({
      label: "Source",
      value: formatHistoryRequestSource(runtime.flow.source) ?? runtime.flow.source,
      tone: "success"
    });
  }

  if (runtime.flow.phase !== "idle") {
    facts.push({
      label: "Flow",
      value: runtime.flow.phase,
      tone:
        runtime.flow.phase === "complete"
          ? "success"
          : runtime.flow.phase === "active" || runtime.flow.phase === "pending"
            ? "warning"
            : "default"
    });
  }

  const lockSummary = formatRuntimeLockSummary(runtime);
  if (lockSummary !== "none") {
    facts.push({
      label: "Locked",
      value: lockSummary,
      tone: "warning"
    });
  }

  if (activeCapability) {
    facts.push({
      label: "Capability",
      value: getCapabilityDisplayName(activeCapability.capability),
      tone: "warning"
    });
  }

  if (runtime.recovery.mode !== "fresh") {
    facts.push({
      label: "Recovery",
      value: runtime.recovery.mode,
      tone:
        runtime.recovery.mode === "restored"
          ? "success"
          : runtime.recovery.mode === "reset" || runtime.recovery.mode === "reconnected"
            ? "warning"
            : "default"
    });
  }

  return facts;
}

function formatHistoryTimestamp(timestamp: string) {
  return timestamp.slice(11, 19);
}

function formatHistoryRequestSource(source?: RuntimeContextValue["history"][number]["requestSource"]) {
  switch (source) {
    case "voice":
      return "Voice";
    case "input":
      return "Text";
    case "action":
      return "Action";
    case "form":
      return "Form";
    default:
      return undefined;
  }
}

function formatHistoryRequestId(requestId?: string) {
  if (!requestId) {
    return undefined;
  }

  return requestId.length > 16 ? `${requestId.slice(0, 16)}...` : requestId;
}

function formatHistoryMeta(entry: RuntimeContextValue["history"][number]) {
  const parts = [formatHistoryTimestamp(entry.timestamp)];
  const requestSource = formatHistoryRequestSource(entry.requestSource);
  const requestId = formatHistoryRequestId(entry.requestId);

  if (requestSource) {
    parts.push(requestSource);
  }

  if (requestId) {
    parts.push(requestId);
  }

  if (entry.screenMode) {
    parts.push(entry.screenMode);
  }

  if (entry.meta) {
    parts.push(entry.meta);
  }

  return parts.join(" · ");
}

function getHistoryRoleLabel(role: RuntimeContextValue["history"][number]["role"]) {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Agent";
    case "system":
      return "System";
  }
}

function getHistoryKindLabel(kind: RuntimeContextValue["history"][number]["kind"]) {
  switch (kind) {
    case "input":
      return "Input";
    case "workspace":
      return "Workspace";
    case "artifact":
      return "Artifact";
    case "capability":
      return "Capability";
    case "error":
      return "Issue";
    case "action":
      return "Action";
    case "form":
      return "Form";
    case "session":
      return "Session";
  }
}

function getHistoryTone(kind: RuntimeContextValue["history"][number]["kind"]) {
  switch (kind) {
    case "input":
    case "form":
      return "input";
    case "workspace":
    case "session":
      return "workspace";
    case "artifact":
    case "capability":
      return "resource";
    case "error":
      return "issue";
    case "action":
      return "action";
  }
}

function matchesHistoryFilter(entry: RuntimeContextValue["history"][number], filter: HistoryFilter) {
  switch (filter) {
    case "all":
      return true;
    case "input":
      return entry.kind === "input" || entry.kind === "form" || entry.kind === "action";
    case "workspace":
      return entry.kind === "workspace" || entry.kind === "session";
    case "patched":
      return entry.eventType === "screen.patched";
    case "resource":
      return entry.kind === "artifact" || entry.kind === "capability";
    case "issue":
      return entry.kind === "error";
  }
}

function findLatestHistoryEntry(
  history: RuntimeContextValue["history"],
  filter: HistoryFilter
) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];

    if (matchesHistoryFilter(entry, filter)) {
      return entry;
    }
  }

  return undefined;
}

function countHistoryEntries(history: RuntimeContextValue["history"], filter: HistoryFilter) {
  return history.filter((entry) => matchesHistoryFilter(entry, filter)).length;
}

function createHistoryRequestGroups(
  history: RuntimeContextValue["history"],
  filter: HistoryFilter
): HistoryRequestGroup[] {
  const groups = new Map<string, HistoryRequestGroup>();
  let ungroupedIndex = 0;

  for (const entry of history) {
    if (!matchesHistoryFilter(entry, filter)) {
      continue;
    }

    const groupKey = entry.requestId ? `request:${entry.requestId}` : `entry:${entry.id}:${ungroupedIndex++}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.entries.push(entry);
      existing.latestTimestamp = entry.timestamp;
      existing.latestTitle = entry.title;
      if (!existing.kinds.includes(entry.kind)) {
        existing.kinds.push(entry.kind);
      }
      continue;
    }

    groups.set(groupKey, {
      id: groupKey,
      requestId: entry.requestId,
      source: entry.requestSource,
      entries: [entry],
      latestTimestamp: entry.timestamp,
      kinds: [entry.kind],
      latestTitle: entry.title
    });
  }

  return [...groups.values()].sort((left, right) => right.latestTimestamp.localeCompare(left.latestTimestamp));
}

function getHistoryGroupTitle(group: HistoryRequestGroup) {
  const firstEntry = group.entries[0];

  if (group.requestId) {
    return group.latestTitle;
  }

  return firstEntry?.title ?? "History entry";
}

function getHistoryGroupNote(group: HistoryRequestGroup) {
  const requestSource = formatHistoryRequestSource(group.source);
  const requestId = formatHistoryRequestId(group.requestId);
  const parts = [formatHistoryTimestamp(group.latestTimestamp)];

  if (requestSource) {
    parts.push(requestSource);
  }

  if (requestId) {
    parts.push(requestId);
  }

  parts.push(`${group.entries.length} event${group.entries.length === 1 ? "" : "s"}`);

  return parts.join(" · ");
}

function getHistoryGroupKinds(group: HistoryRequestGroup) {
  return group.kinds.map((kind) => getHistoryKindLabel(kind)).join(" · ");
}

function getHistoryGroupSummary(group: HistoryRequestGroup) {
  const summary = summarizeRuntimeRequestEntries(group.entries, group.requestId);
  const parts = [
    `${summary.workspaceCount} workspace`,
    `${summary.patchCount} patch`,
    `${summary.resourceCount} resource`,
    `${summary.issueCount} issue`
  ];

  if (summary.modePath !== "None") {
    parts.push(summary.modePath);
  }

  return parts.join(" · ");
}

function createInteractionLockSnapshot(runtime: RuntimeContextValue): RendererInteractionLockSnapshot {
  return {
    input: runtime.interaction.input === "locked",
    actions: runtime.interaction.actions === "locked",
    forms: runtime.interaction.forms === "locked",
    artifacts: runtime.interaction.artifacts === "locked"
  };
}

function hasInteractionLockChanged(
  previous: RendererInteractionLockSnapshot,
  current: RendererInteractionLockSnapshot
) {
  return (
    previous.input !== current.input ||
    previous.actions !== current.actions ||
    previous.forms !== current.forms ||
    previous.artifacts !== current.artifacts
  );
}

function createRendererTransitionSnapshot(
  runtime: RuntimeContextValue,
  snapshot: RenderSnapshot
): RendererTransitionSnapshot {
  return {
    signature: snapshot.signature,
    screenId: snapshot.screen?.id,
    screenTitle: snapshot.screen?.title,
    mode: runtime.screenMode,
    requestId: runtime.flow.requestId,
    flowPhase: runtime.flow.phase,
    flowTransition: snapshot.screen?.flow?.transition,
    interactionReason: runtime.interaction.reason,
    interactionLocked: createInteractionLockSnapshot(runtime)
  };
}

function SessionHistoryModal({ history, historyEnabled, visible, onClose, onInspectRequest }: HistoryModalProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  useEffect(() => {
    if (!visible) {
      setFilter("all");
    }
  }, [visible]);

  const filteredHistory = history.filter((entry) => matchesHistoryFilter(entry, filter));
  const groupedHistory = createHistoryRequestGroups(history, filter);
  const latestInput = findLatestHistoryEntry(history, "input");
  const latestWorkspace = findLatestHistoryEntry(history, "workspace");
  const latestPatch = findLatestHistoryEntry(history, "patched");
  const historyStats = [
    {
      id: "inputs",
      label: "Inputs",
      value: String(countHistoryEntries(history, "input")),
      note: latestInput?.title ?? "No input yet"
    },
    {
      id: "workspace",
      label: "Workspace",
      value: String(countHistoryEntries(history, "workspace")),
      note: latestWorkspace?.title ?? "No workspace update yet"
    },
    {
      id: "patched",
      label: "Patches",
      value: String(countHistoryEntries(history, "patched")),
      note: latestPatch?.title ?? "No incremental patch yet"
    },
    {
      id: "resources",
      label: "Resources",
      value: String(countHistoryEntries(history, "resource")),
      note: "Artifacts and capability flows"
    },
    {
      id: "issues",
      label: "Issues",
      value: String(countHistoryEntries(history, "issue")),
      note: countHistoryEntries(history, "issue") ? "Review failures and runtime errors" : "No recorded issues"
    },
    {
      id: "requests",
      label: "Requests",
      value: String(createHistoryRequestGroups(history, "all").filter((group) => group.requestId).length),
      note: historyEnabled ? "Grouped by request flow when requestId is available" : "History browsing is currently locked"
    }
  ];
  const filters: Array<{ id: HistoryFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "input", label: "Inputs" },
    { id: "workspace", label: "Workspace" },
    { id: "patched", label: "Patched" },
    { id: "resource", label: "Resources" },
    { id: "issue", label: "Issues" }
  ];

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.historyScreen}>
        <SafeAreaView style={styles.historyNavChrome}>
          <View style={styles.navBar}>
            <View style={[styles.navBarSide, styles.navBarSideStart]}>
              <View style={styles.historyNavSpacer} />
            </View>
            <View style={styles.navBarCenter}>
              <Text numberOfLines={1} style={styles.navBarTitle}>
                Session history
              </Text>
            </View>
            <View style={[styles.navBarSide, styles.navBarSideEnd]}>
              <Pressable style={styles.historyButton} onPress={onClose}>
                <Text style={styles.historyButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.historyContent}>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.statusText}>No history available yet.</Text>
            </View>
          ) : (
            <>
              <View style={styles.historySummaryGrid}>
                {historyStats.map((item) => (
                  <View key={item.id} style={styles.historySummaryCard}>
                    <Text style={styles.historySummaryLabel}>{item.label}</Text>
                    <Text style={styles.historySummaryValue}>{item.value}</Text>
                    <Text style={styles.historySummaryNote}>{item.note}</Text>
                  </View>
                ))}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.historyFilterRow}
              >
                {filters.map((item) => {
                  const active = item.id === filter;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.historyFilterChip, active ? styles.historyFilterChipActive : null]}
                      onPress={() => setFilter(item.id)}
                    >
                      <Text style={[styles.historyFilterText, active ? styles.historyFilterTextActive : null]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {filteredHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.statusText}>No entries for this filter yet.</Text>
                </View>
              ) : (
                <>
                  {groupedHistory.length > 0 ? (
                    <View style={styles.historyRequestGroupList}>
                      {groupedHistory.map((group) => (
                        <Pressable
                          key={group.id}
                          disabled={!group.requestId}
                          onPress={() => {
                            if (group.requestId) {
                              onInspectRequest(group.requestId);
                            }
                          }}
                          style={[
                            styles.historyRequestGroupCard,
                            group.requestId ? styles.historyRequestGroupCardPressable : null
                          ]}
                        >
                          <View style={styles.historyRequestGroupHeader}>
                            <Text style={styles.historyRequestGroupTitle}>{getHistoryGroupTitle(group)}</Text>
                            {group.requestId ? (
                              <View style={styles.historyMetaBadgeMuted}>
                                <Text style={styles.historyMetaBadgeMutedText}>Request</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.historyRequestGroupMeta}>{getHistoryGroupNote(group)}</Text>
                          <Text style={styles.historyRequestGroupMeta}>{getHistoryGroupSummary(group)}</Text>
                          <Text style={styles.historyRequestGroupKinds}>{getHistoryGroupKinds(group)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {filteredHistory.map((entry, index) => {
                    const tone = getHistoryTone(entry.kind);

                    return (
                      <View key={entry.id} style={styles.historyTimelineRow}>
                        <View style={styles.historyTimelineRail}>
                          <View
                            style={[
                              styles.historyTimelineDot,
                              tone === "input" ? styles.historyTimelineDotInput : null,
                              tone === "workspace" ? styles.historyTimelineDotWorkspace : null,
                              tone === "resource" ? styles.historyTimelineDotResource : null,
                              tone === "issue" ? styles.historyTimelineDotIssue : null,
                              tone === "action" ? styles.historyTimelineDotAction : null
                            ]}
                          />
                          {index < filteredHistory.length - 1 ? <View style={styles.historyTimelineLine} /> : null}
                        </View>
                        <View style={styles.historyCard}>
                          <View style={styles.historyCardMetaRow}>
                            <View style={styles.historyMetaBadge}>
                              <Text style={styles.historyMetaBadgeText}>{getHistoryRoleLabel(entry.role)}</Text>
                            </View>
                            <View style={styles.historyMetaBadgeMuted}>
                              <Text style={styles.historyMetaBadgeMutedText}>{getHistoryKindLabel(entry.kind)}</Text>
                            </View>
                            {entry.requestSource ? (
                              <View style={styles.historyMetaBadgeMuted}>
                                <Text style={styles.historyMetaBadgeMutedText}>
                                  {formatHistoryRequestSource(entry.requestSource)}
                                </Text>
                              </View>
                            ) : null}
                            <Text style={styles.historyCardTime}>{formatHistoryTimestamp(entry.timestamp)}</Text>
                          </View>
                          <View style={styles.historyCardHeader}>
                            <Text style={styles.historyCardTitle}>{entry.title}</Text>
                          </View>
                          {entry.body ? <Text style={styles.historyCardBody}>{entry.body}</Text> : null}
                          <Text style={styles.historyCardMetaDetail}>{formatHistoryMeta(entry)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function RequestInspectorModal({
  runtime,
  visible,
  target,
  onClose,
  onAction
}: {
  runtime: RuntimeContextValue;
  visible: boolean;
  target: RequestTarget;
  onClose(): void;
  onAction(action: ActionItem): void;
}) {
  const normalizedTarget = normalizeRequestTarget(target);
  const resolvedBlocks = resolveRuntimeBlocks(buildRequestInspectorBlocks(normalizedTarget), runtime);
  const chain = getResolvedRequestChain(runtime, "runtime.request", normalizedTarget);
  const [targetInput, setTargetInput] = useState(
    normalizedTarget === "current" || normalizedTarget === "lastCompleted" ? "" : normalizedTarget
  );
  const title =
    normalizedTarget === "current"
      ? "Current request inspector"
      : normalizedTarget === "lastCompleted"
        ? "Last completed request inspector"
        : `Request ${chain.requestId ?? normalizedTarget}`;
  const subtitle =
    normalizedTarget === "current"
      ? "Renderer-level inspector driven by the active runtime request chain."
      : normalizedTarget === "lastCompleted"
        ? "Renderer-level inspector driven by the most recent completed request chain."
        : "Renderer-level inspector driven by an explicit request target.";
  const explicitTarget = targetInput.trim();

  useEffect(() => {
    setTargetInput(normalizedTarget === "current" || normalizedTarget === "lastCompleted" ? "" : normalizedTarget);
  }, [normalizedTarget, visible]);

  function openExplicitTarget() {
    if (!explicitTarget) {
      return;
    }

    onAction({
      id: "show-request-inspector",
      label: "Open request",
      payload: {
        requestTarget: explicitTarget
      }
    });
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" transparent={false} visible={visible} onRequestClose={onClose}>
      <View style={styles.inspectorScreen}>
        <SafeAreaView style={styles.inspectorNavChrome}>
          <View style={styles.inspectorNavBar}>
            <View style={styles.inspectorNavSpacer} />
            <View style={styles.inspectorNavCenter}>
              <Text numberOfLines={1} style={styles.inspectorNavTitle}>
                {title}
              </Text>
              <Text numberOfLines={1} style={styles.inspectorNavSubtitle}>
                {subtitle}
              </Text>
            </View>
            <Pressable style={styles.inspectorCloseButton} onPress={onClose}>
              <Text style={styles.inspectorCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.inspectorContent} showsVerticalScrollIndicator={false}>
          <View style={styles.inspectorTargetDock}>
            <Text style={styles.inspectorTargetLabel}>Open explicit requestId</Text>
            <View style={styles.inspectorTargetRow}>
              <TextInput
                value={targetInput}
                onChangeText={setTargetInput}
                placeholder="voice-... / input-... / action-... / form-..."
                placeholderTextColor="#9CA3AF"
                style={styles.inspectorTargetInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={openExplicitTarget}
              />
              <Pressable
                disabled={!explicitTarget}
                onPress={openExplicitTarget}
                style={[
                  styles.inspectorTargetButton,
                  !explicitTarget ? styles.inspectorTargetButtonDisabled : null
                ]}
              >
                <Text
                  style={[
                    styles.inspectorTargetButtonText,
                    !explicitTarget ? styles.inspectorTargetButtonTextDisabled : null
                  ]}
                >
                  Open
                </Text>
              </Pressable>
            </View>
          </View>
          {resolvedBlocks.map((block) => (
            <View key={block.id} style={styles.blockRevealWrap}>
              <CoreBlock
                block={block}
                onAction={onAction}
                onFormSubmit={() => undefined}
                onArtifact={() => undefined}
                interaction={{
                  actionsDisabled: false,
                  formsDisabled: true,
                  artifactsDisabled: true
                }}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface AgentRuntimeContentProps {
  voiceShell?: VoiceShellOptions;
  artifactHandlers?: ArtifactHandlers;
  capabilityHandlers?: CapabilityHandlers;
  hostBridge?: HostBridge;
  renderVoiceShell?: (props: VoiceShellRenderProps) => ReactNode;
  transitionHooks?: RendererTransitionHooks;
  navigationHooks?: RendererNavigationHooks;
}

const AgentRuntimeContent = forwardRef<AgentRuntimeViewHandle, AgentRuntimeContentProps>(function AgentRuntimeContent({
  voiceShell,
  artifactHandlers,
  capabilityHandlers,
  hostBridge,
  renderVoiceShell,
  transitionHooks,
  navigationHooks
}, ref) {
  const runtime = useAgentRuntime();
  const screen = runtime.screen;
  const clientEventLockRef = useRef(false);
  const transitionHooksRef = useRef(transitionHooks);
  const navigationHooksRef = useRef(navigationHooks);
  const previousTransitionSnapshotRef = useRef<RendererTransitionSnapshot | undefined>(undefined);
  const previousRequestInspectorSnapshotRef = useRef<RendererRequestInspectorSnapshot | undefined>(undefined);
  const previousHistoryVisibleRef = useRef<boolean | undefined>(undefined);
  const voiceShellConfig = resolveVoiceShellConfig(voiceShell);
  const [navHeight, setNavHeight] = useState(108);
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactPreviewState | null>(null);
  const [artifactBridgeError, setArtifactBridgeError] = useState<string>();
  const [capabilityBridgeError, setCapabilityBridgeError] = useState<string>();
  const [dismissedCapabilityIds, setDismissedCapabilityIds] = useState<string[]>([]);
  const artifactHandlerKinds = Object.keys(artifactHandlers ?? {}) as ArtifactRef["kind"][];
  const capabilityHandlerKinds = Object.keys(capabilityHandlers ?? {}) as CapabilityRequest["capability"][];
  const artifactHandlerCoverage = artifactKindCatalog.map((kind) => {
    const handler = artifactHandlers?.[kind];

    return {
      kind,
      preview: Boolean(handler?.preview),
      open: Boolean(handler?.open),
      share: Boolean(handler?.share),
      download: Boolean(handler?.download)
    };
  });
  const capabilityHandlerCoverage = capabilityCatalog.map((capability) => {
    const handler = capabilityHandlers?.[capability];

    return {
      capability,
      describe: Boolean(handler?.describe),
      resolve: Boolean(handler?.resolve)
    };
  });
  const diagnostics: RendererDiagnostics = {
    artifactBridgeError,
    capabilityBridgeError,
    hostBridgeOpenUrlEnabled: Boolean(hostBridge?.openUrl),
    hostBridgeShareEnabled: Boolean(hostBridge?.share),
    hostBridgeResolveCapabilityEnabled: Boolean(hostBridge?.resolveCapability),
    artifactHandlerKinds,
    capabilityHandlerKinds,
    artifactHandlerCoverage,
    capabilityHandlerCoverage
  };
  const resolvedBlocks = screen ? resolveRuntimeBlocks(screen.blocks, runtime, diagnostics) : [];
  const activeCapabilityRequest =
    runtime.capabilityRequests.find((request) => !dismissedCapabilityIds.includes(request.id)) ?? null;
  const historyVisible = runtime.navigation.historyVisible;
  const requestInspectorState = runtime.navigation.requestInspector;

  async function sendNavigationChange(change: NavigationChange) {
    await runtime.sendClientEvent({
      type: "navigation.changed",
      navigation: change
    });
  }

  function setHistoryVisibility(visible: boolean) {
    void sendNavigationChange({
      surface: "history",
      visibility: visible ? "open" : "closed"
    });
  }

  function openRequestInspector(target?: RequestTarget) {
    void sendNavigationChange({
      surface: "request-inspector",
      visibility: "open",
      requestTarget: normalizeRequestTarget(target)
    });
  }

  function closeRequestInspector() {
    void sendNavigationChange({
      surface: "request-inspector",
      visibility: "closed",
      requestTarget: requestInspectorState.target
    });
  }

  async function handleRendererAction(action: ActionItem) {
    const navigationChange = resolveNavigationChangeFromAction(action);

    if (navigationChange) {
      await sendNavigationChange(navigationChange);
      return;
    }

    if (action.id === "clear-runtime-persistence") {
      await runtime.clearPersistence();
      return;
    }

    if (action.id === "reconnect-runtime") {
      await runtime.reconnect();
      return;
    }

    if (action.id === "reset-runtime-session") {
      await runtime.resetSession();
      return;
    }

    if (action.id === "reset-runtime-session-and-clear-persistence") {
      await runtime.resetSession({
        clearPersistence: true
      });
      return;
    }

    await sendLockedClientEvent({
      type: "action.triggered",
      actionId: action.id,
      payload: action.payload
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      openHistory: () => {
        setHistoryVisibility(true);
      },
      closeHistory: () => setHistoryVisibility(false),
      openRequestInspector: (target) => openRequestInspector(target),
      closeRequestInspector,
      clearPersistence: () => runtime.clearPersistence(),
      reconnect: () => runtime.reconnect(),
      resetSession: (options) => runtime.resetSession(options)
    }),
    [requestInspectorState.target, runtime]
  );
  const shellLocked = runtime.interaction.input === "locked";
  const {
    inputMode,
    isListening,
    lastInput,
    lastInputMode,
    lastTranscript,
    promptLabel,
    idleLabel,
    textPlaceholder,
    talkButtonLabel,
    listeningButtonLabel,
    textSubmitLabel,
    recentInputHeadingLabel,
    recentInputMaxLines,
    recentInputCollapsedLabel,
    recentInputExpandedLabel,
    voiceModeChipLabel,
    textModeChipLabel,
    shellEnabled,
    showRecentInput,
    bottomReserve,
    shellProps
  } = useVoiceShellState({
    config: voiceShellConfig,
    runtimeStatus: runtime.status,
    shellLocked,
    onSubmit: submitInput
  });
  const processingVisible = runtime.status === "thinking" || runtime.status === "running";
  const historyLocked = runtime.interaction.history === "locked";
  const actionsLocked = runtime.interaction.actions === "locked";
  const formsLocked = runtime.interaction.forms === "locked";
  const artifactsLocked = runtime.interaction.artifacts === "locked";
  const interactionUnlockReady =
    !processingVisible &&
    (runtime.interaction.input === "enabled" ||
      runtime.interaction.actions === "enabled" ||
      runtime.interaction.forms === "enabled");
  const screenModeCopy = getScreenModeCopy(runtime.screenMode);
  const navStatusLabel = getNavStatusLabel(runtime, isListening);
  const archetype = detectScreenArchetype(screen);
  const archetypeCopy = getArchetypeCopy(archetype);
  const rootBlockCount = screen?.blocks.length ?? 0;
  const blockTypeCount = screen ? new Set(collectBlockTypes(screen.blocks)).size : 0;
  const screenSignature = screen
    ? `${screen.id}:${screen.mode}:${screen.title ?? ""}:${screen.subtitle ?? ""}:${screen.blocks
        .map((block) => `${block.id}:${block.type}`)
        .join("|")}`
    : runtime.phase;
  const currentSnapshot: RenderSnapshot = {
    signature: screenSignature,
    screen,
    screenMode: runtime.screenMode,
    interactionReason: runtime.interaction.reason,
    resolvedBlocks,
    archetype,
    archetypeCopy,
    rootBlockCount,
    blockTypeCount
  };
  const transitionSnapshot = createRendererTransitionSnapshot(runtime, currentSnapshot);

  useEffect(() => {
    transitionHooksRef.current = transitionHooks;
  }, [transitionHooks]);

  useEffect(() => {
    navigationHooksRef.current = navigationHooks;
  }, [navigationHooks]);

  useEffect(() => {
    if (runtime.phase === "error") {
      clientEventLockRef.current = false;
      return;
    }

    if (clientEventLockRef.current && interactionUnlockReady) {
      clientEventLockRef.current = false;
    }
  }, [
    interactionUnlockReady,
    runtime.phase,
    runtime.status,
    runtime.screen,
    runtime.error,
    runtime.capabilityRequests.length,
    runtime.interaction.input,
    runtime.interaction.actions,
    runtime.interaction.forms
  ]);

  useEffect(() => {
    const previousSnapshot = previousTransitionSnapshotRef.current;

    if (!previousSnapshot) {
      previousTransitionSnapshotRef.current = transitionSnapshot;
      return;
    }

    const changed: RendererTransitionChange[] = [];
    const flowChanged =
      previousSnapshot.requestId !== transitionSnapshot.requestId ||
      previousSnapshot.flowPhase !== transitionSnapshot.flowPhase ||
      previousSnapshot.flowTransition !== transitionSnapshot.flowTransition;
    const interactionLockChanged = hasInteractionLockChanged(
      previousSnapshot.interactionLocked,
      transitionSnapshot.interactionLocked
    );

    if (previousSnapshot.signature !== transitionSnapshot.signature) {
      changed.push("screen");
    }

    if (previousSnapshot.mode !== transitionSnapshot.mode) {
      changed.push("mode");
    }

    if (flowChanged) {
      changed.push("flow");
    }

    if (interactionLockChanged) {
      changed.push("lock");
    }

    if (changed.length > 0) {
      transitionHooksRef.current?.onScreenTransition?.({
        changed,
        previous: previousSnapshot,
        current: transitionSnapshot
      });
    }

    if (flowChanged) {
      transitionHooksRef.current?.onFlowChange?.({
        previous: {
          screenId: previousSnapshot.screenId,
          mode: previousSnapshot.mode,
          requestId: previousSnapshot.requestId,
          flowPhase: previousSnapshot.flowPhase,
          flowTransition: previousSnapshot.flowTransition
        },
        current: {
          screenId: transitionSnapshot.screenId,
          mode: transitionSnapshot.mode,
          requestId: transitionSnapshot.requestId,
          flowPhase: transitionSnapshot.flowPhase,
          flowTransition: transitionSnapshot.flowTransition
        }
      });
    }

    if (interactionLockChanged) {
      transitionHooksRef.current?.onInteractionLockChange?.({
        previous: previousSnapshot.interactionLocked,
        current: transitionSnapshot.interactionLocked,
        screenId: transitionSnapshot.screenId,
        requestId: transitionSnapshot.requestId,
        flowPhase: transitionSnapshot.flowPhase,
        reason: transitionSnapshot.interactionReason
      });
    }

    previousTransitionSnapshotRef.current = transitionSnapshot;
  }, [transitionSnapshot]);

  useEffect(() => {
    const currentSnapshot = createRequestInspectorSnapshot(runtime, requestInspectorState);
    const previousSnapshot = previousRequestInspectorSnapshotRef.current;

    if (!previousSnapshot) {
      previousRequestInspectorSnapshotRef.current = currentSnapshot;
      return;
    }

    if (
      previousSnapshot.visible !== currentSnapshot.visible ||
      previousSnapshot.target !== currentSnapshot.target ||
      previousSnapshot.resolvedRequestId !== currentSnapshot.resolvedRequestId ||
      previousSnapshot.source !== currentSnapshot.source ||
      previousSnapshot.entryCount !== currentSnapshot.entryCount ||
      previousSnapshot.latestTitle !== currentSnapshot.latestTitle ||
      previousSnapshot.hasResultScreen !== currentSnapshot.hasResultScreen
    ) {
      navigationHooksRef.current?.onRequestInspectorChange?.({
        previous: previousSnapshot,
        current: currentSnapshot
      });
    }

    previousRequestInspectorSnapshotRef.current = currentSnapshot;
  }, [runtime, requestInspectorState]);

  useEffect(() => {
    const previousVisible = previousHistoryVisibleRef.current;

    if (previousVisible === undefined) {
      previousHistoryVisibleRef.current = historyVisible;
      return;
    }

    if (previousVisible !== historyVisible) {
      navigationHooksRef.current?.onHistoryVisibilityChange?.({
        previous: previousVisible,
        current: historyVisible
      });
    }

    previousHistoryVisibleRef.current = historyVisible;
  }, [historyVisible]);

  const contentContainerStyle: StyleProp<ViewStyle> = [
    styles.container,
    {
      paddingTop: navHeight + 18,
      paddingBottom: bottomReserve
    }
  ];
  const renderShell = (overrides?: Partial<VoiceShellRenderProps>) => {
    const nextShellProps: VoiceShellRenderProps = {
      ...shellProps,
      ...overrides
    };

    return renderVoiceShell ? renderVoiceShell(nextShellProps) : <DefaultVoiceShell {...nextShellProps} />;
  };

  function resolveArtifact(resource: ArtifactRef) {
    return runtime.artifacts.find((artifact) => artifact.id === resource.id) ?? resource;
  }

  function getArtifactHandler(resource: ArtifactRef) {
    return artifactHandlers?.[resource.kind];
  }

  function getCapabilityHandler(request: CapabilityRequest) {
    return capabilityHandlers?.[request.capability];
  }

  function canOpenArtifact(resource: ArtifactRef) {
    return resource.openable !== false && Boolean(resource.uri);
  }

  function createDefaultArtifactPreview(resource: ArtifactRef): ArtifactPreviewDescriptor {
    const fields: ArtifactPreviewField[] = [];
    const uri = resource.uri;
    const preview = resource.preview;

    if (preview?.fields?.length) {
      fields.push(...preview.fields);
    }

    if ((resource.kind === "link" || resource.kind === "html") && uri) {
      try {
        const parsed = new URL(uri);
        fields.push({
          label: "Host",
          value: parsed.host
        });
      } catch {
        // Ignore URL parsing failures and fall back to the raw URI field below.
      }
    }

    if (uri) {
      fields.push({
        label: "URI",
        value: uri
      });
    }

    if (resource.mimeType) {
      fields.push({
        label: "MIME",
        value: resource.mimeType
      });
    }

    if (preview?.summary) {
      fields.push({
        label: "Summary",
        value: preview.summary
      });
    }

    if (fields.length === 0) {
      fields.push({
        label: "Preview",
        value: "No inline preview data is available for this artifact yet."
      });
    }

    return {
      title: resource.title,
      description: preview?.summary ?? getArtifactKindDescription(resource.kind),
      fields,
      openLabel: getArtifactOpenLabel(resource.kind),
      contentType: preview?.thumbnailUri ? "image" : preview?.text ? "text" : preview?.summary ? "summary" : undefined,
      content: preview?.text ?? preview?.summary,
      thumbnailUri: preview?.thumbnailUri
    };
  }

  function createDefaultCapabilityPrompt(request: CapabilityRequest): CapabilityPromptDescriptor {
    const fields = createCapabilityBridgeFields(request);

    switch (request.capability) {
      case "open-url":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "The runtime can open an external link directly through the system browser.",
          reasonLabel: "Why this link is needed",
          primaryLabel: "Open link",
          secondaryLabel: "Cancel",
          fields
        };
      case "share":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "The runtime can forward text or URLs into the native share sheet.",
          reasonLabel: "Why sharing is needed",
          primaryLabel: "Open share sheet",
          secondaryLabel: "Cancel",
          fields
        };
      case "file-picker":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "No host-specific picker is registered, so the default bridge will return a mock file selection payload.",
          reasonLabel: "Reason",
          primaryLabel: "Resolve with mock file",
          secondaryLabel: "Not now",
          fields
        };
      case "location":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "No host-specific location bridge is registered, so the default bridge will return an approximate mock location payload.",
          reasonLabel: "Reason",
          primaryLabel: "Resolve with mock location",
          secondaryLabel: "Not now",
          fields
        };
      case "camera":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "No host-specific camera bridge is registered, so the default bridge will return a mock capture resolution payload.",
          reasonLabel: "Reason",
          primaryLabel: "Resolve with mock capture",
          secondaryLabel: "Not now",
          fields
        };
      case "photo-library":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "No host-specific photo-library bridge is registered, so the default bridge will return a mock media selection payload.",
          reasonLabel: "Reason",
          primaryLabel: "Resolve with mock media",
          secondaryLabel: "Not now",
          fields
        };
      case "microphone":
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "No host-specific microphone bridge is registered, so the default bridge will return a mock permission resolution payload.",
          reasonLabel: "Reason",
          primaryLabel: "Resolve with mock access",
          secondaryLabel: "Not now",
          fields
        };
      default:
        return {
          title: getCapabilityDisplayName(request.capability),
          description: "The harness is asking the client runtime to resolve a device-level permission or system action.",
          reasonLabel: "Reason",
          primaryLabel: "Allow mock resolution",
          secondaryLabel: "Not now",
          fields
        };
    }
  }

  async function openArtifactWithSystem(resource: ArtifactRef) {
    if (!canOpenArtifact(resource)) {
      throw new Error("This artifact cannot be opened yet.");
    }

    if (hostBridge?.openUrl) {
      await hostBridge.openUrl(resource.uri, {
        reason: "artifact-open",
        artifact: resource
      });
      return;
    }

    await Linking.openURL(resource.uri);
  }

  async function shareArtifactWithSystem(resource: ArtifactRef) {
    if (!canShareArtifact(resource) || !resource.uri) {
      throw new Error("This artifact cannot be shared yet.");
    }

    if (hostBridge?.share) {
      await hostBridge.share(
        {
          title: resource.title,
          message: resource.uri,
          url: resource.uri
        },
        {
          reason: "artifact-share",
          artifact: resource
        }
      );
      return;
    }

    await Share.share({
      title: resource.title,
      message: resource.uri
    });
  }

  async function downloadArtifactWithSystem(resource: ArtifactRef) {
    if (!canDownloadArtifact(resource) || !resource.uri) {
      throw new Error("This artifact cannot be downloaded yet.");
    }

    if (hostBridge?.openUrl) {
      await hostBridge.openUrl(resource.uri, {
        reason: "artifact-download",
        artifact: resource
      });
      return;
    }

    await Linking.openURL(resource.uri);
  }

  async function openArtifact(resource: ArtifactRef) {
    const handler = getArtifactHandler(resource);

    if (handler?.open) {
      await handler.open(resource, {
        openWithSystem: () => openArtifactWithSystem(resource),
        shareWithSystem: () => shareArtifactWithSystem(resource),
        downloadWithSystem: () => downloadArtifactWithSystem(resource)
      });
      return;
    }

    await openArtifactWithSystem(resource);
  }

  async function shareArtifact(resource: ArtifactRef) {
    const handler = getArtifactHandler(resource);

    if (handler?.share) {
      await handler.share(resource, {
        openWithSystem: () => openArtifactWithSystem(resource),
        shareWithSystem: () => shareArtifactWithSystem(resource),
        downloadWithSystem: () => downloadArtifactWithSystem(resource)
      });
      return;
    }

    await shareArtifactWithSystem(resource);
  }

  async function downloadArtifact(resource: ArtifactRef) {
    const handler = getArtifactHandler(resource);

    if (handler?.download) {
      await handler.download(resource, {
        openWithSystem: () => openArtifactWithSystem(resource),
        shareWithSystem: () => shareArtifactWithSystem(resource),
        downloadWithSystem: () => downloadArtifactWithSystem(resource)
      });
      return;
    }

    await downloadArtifactWithSystem(resource);
  }

  async function previewArtifactResource(resource: ArtifactRef) {
    const handler = getArtifactHandler(resource);
    const preview = (await handler?.preview?.(resource)) ?? createDefaultArtifactPreview(resource);
    setPreviewArtifact({
      artifact: resource,
      preview
    });
  }

  async function resolveCapabilityWithDefaultBridge(request: CapabilityRequest) {
    if (request.capability === "open-url") {
      const url =
        typeof request.payload?.url === "string"
          ? request.payload.url
          : typeof request.payload?.uri === "string"
            ? request.payload.uri
            : undefined;

      if (!url) {
        throw new Error("The capability payload must include a url or uri for open-url.");
      }

      if (hostBridge?.openUrl) {
        await hostBridge.openUrl(url, {
          reason: "capability-open-url",
          capabilityRequest: request
        });
      } else {
        await Linking.openURL(url);
      }

      return {
        payload: {
          bridge: hostBridge?.openUrl ? "host-bridge" : "renderer-default",
          opened: true,
          url
        }
      };
    }

    if (request.capability === "share") {
      const title = typeof request.payload?.title === "string" ? request.payload.title : undefined;
      const message = typeof request.payload?.message === "string" ? request.payload.message : undefined;
      const url = typeof request.payload?.url === "string" ? request.payload.url : undefined;
      const composedMessage = [message, url].filter(Boolean).join("\n");

      if (!title && !message && !url) {
        throw new Error("The capability payload must include title, message, or url for share.");
      }

      if (hostBridge?.share) {
        await hostBridge.share(
          {
            title,
            message: composedMessage || title || url || "",
            url
          },
          {
            reason: "capability-share",
            capabilityRequest: request
          }
        );
      } else {
        await Share.share({
          title,
          message: composedMessage || title || url || ""
        });
      }

      return {
        payload: {
          bridge: hostBridge?.share ? "host-bridge" : "renderer-default",
          shared: true,
          title,
          url
        }
      };
    }

    const defaultPayload = createDefaultMockCapabilityPayload(request);

    if (hostBridge?.resolveCapability) {
      const resolution = await hostBridge.resolveCapability(request, true, {
        defaultPayload
      });

      if (resolution) {
        return resolution;
      }
    }

    return {
      payload: defaultPayload
    };
  }

  async function handleArtifactRequest(resource: ArtifactRef, mode: "preview" | "open" | "share" | "download") {
    if (artifactsLocked) {
      return;
    }

    const artifact = resolveArtifact(resource);
    setArtifactBridgeError(undefined);

    try {
      if (mode === "preview") {
        await previewArtifactResource(artifact);
      } else if (mode === "open") {
        await openArtifact(artifact);
      } else if (mode === "share") {
        await shareArtifact(artifact);
      } else {
        await downloadArtifact(artifact);
      }
    } catch (error) {
      setArtifactBridgeError(error instanceof Error ? error.message : "Failed to resolve the artifact bridge.");
    }

    await runtime.sendClientEvent({
      type: "artifact.requested",
      artifactId: resource.id,
      mode
    });
  }

  async function resolveCapabilityRequest(request: CapabilityRequest, granted: boolean) {
    setDismissedCapabilityIds((value) => [...value, request.id]);
    setCapabilityBridgeError(undefined);

    try {
      let handlerResult: CapabilityResolution | undefined;

      if (granted) {
        handlerResult = await (
          getCapabilityHandler(request)?.resolve?.(request, granted) ?? resolveCapabilityWithDefaultBridge(request)
        );
      } else {
        handlerResult =
          (await getCapabilityHandler(request)?.resolve?.(request, granted)) ??
          (await hostBridge?.resolveCapability?.(request, granted, {
            defaultPayload: createDefaultDeniedCapabilityPayload(request)
          }));
      }

      await runtime.sendClientEvent({
        type: "capability.resolved",
        requestId: request.id,
        payload: {
          granted,
          ...handlerResult?.payload
        }
      });
    } catch (error) {
      setCapabilityBridgeError(error instanceof Error ? error.message : "Failed to resolve the capability bridge.");
    }
  }

  async function sendLockedClientEvent(event: ClientEvent) {
    if (clientEventLockRef.current) {
      return;
    }

    clientEventLockRef.current = true;

    try {
      await runtime.sendClientEvent(event);
    } catch (error) {
      clientEventLockRef.current = false;
      throw error;
    }
  }

  async function submitInput(mode: "voice" | "text", value?: string) {
    if (shellLocked) {
      return;
    }

    await sendLockedClientEvent({
      type: "input.submitted",
      mode,
      text: value
    });
  }

  function renderPhaseFallbackSurface(title: string, message: string, tone: "default" | "danger" = "default") {
    return (
      <View style={styles.phaseFallbackWrap}>
        <View style={[styles.phaseFallbackCard, tone === "danger" ? styles.phaseFallbackCardDanger : null]}>
          <View style={[styles.phaseFallbackBadge, tone === "danger" ? styles.phaseFallbackBadgeDanger : null]}>
            <Text style={[styles.phaseFallbackBadgeText, tone === "danger" ? styles.phaseFallbackBadgeTextDanger : null]}>
              {title}
            </Text>
          </View>
          <Text style={styles.phaseFallbackMessage}>{message}</Text>
        </View>
      </View>
    );
  }

  function renderScreenSurface(snapshot: RenderSnapshot) {
    const screenModeCopy = getScreenModeCopy(snapshot.screenMode);
    const stageBanner = getRuntimeStageBanner(runtime);
    const stageFacts = createRuntimeStageFacts(runtime);

    return (
      <View style={styles.screenFrame}>
        <View style={styles.transitionHeroWrap}>
          <View
            style={[
              styles.heroPanel,
              snapshot.archetype === "plan" ? styles.heroPanelPlan : null,
              snapshot.archetype === "timeline" ? styles.heroPanelTimeline : null,
              snapshot.archetype === "brief" ? styles.heroPanelBrief : null,
              snapshot.archetype === "form" ? styles.heroPanelForm : null,
              snapshot.archetype === "resource" ? styles.heroPanelResource : null
            ]}
          >
            <View style={styles.header}>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroTypeChip}>
                  <Text style={styles.heroTypeChipText}>{snapshot.archetypeCopy.label}</Text>
                </View>
                <View style={styles.heroModeChip}>
                  <Text style={styles.heroModeChipText}>{screenModeCopy.label}</Text>
                </View>
                <View style={styles.heroMetricChip}>
                  <Text style={styles.heroMetricChipText}>{snapshot.archetypeCopy.note}</Text>
                </View>
              </View>
              <Text style={styles.title}>{snapshot.screen?.subtitle ?? snapshot.archetypeCopy.note}</Text>
              {stageBanner ? (
                <View
                  style={[
                    styles.stageBannerCard,
                    stageBanner.tone === "success" ? styles.stageBannerCardSuccess : null,
                    stageBanner.tone === "warning" ? styles.stageBannerCardWarning : null,
                    stageBanner.tone === "danger" ? styles.stageBannerCardDanger : null
                  ]}
                >
                  <Text
                    style={[
                      styles.stageBannerLabel,
                      stageBanner.tone === "success" ? styles.stageBannerLabelSuccess : null,
                      stageBanner.tone === "warning" ? styles.stageBannerLabelWarning : null,
                      stageBanner.tone === "danger" ? styles.stageBannerLabelDanger : null
                    ]}
                  >
                    {stageBanner.label}
                  </Text>
                  <Text style={styles.stageBannerText}>{stageBanner.message}</Text>
                  {stageFacts.length > 0 ? (
                    <View style={styles.stageFactRow}>
                      {stageFacts.map((fact) => (
                        <View
                          key={`${fact.label}-${fact.value}`}
                          style={[
                            styles.stageFactChip,
                            fact.tone === "success" ? styles.stageFactChipSuccess : null,
                            fact.tone === "warning" ? styles.stageFactChipWarning : null,
                            fact.tone === "danger" ? styles.stageFactChipDanger : null
                          ]}
                        >
                          <Text style={styles.stageFactLabel}>{fact.label}</Text>
                          <Text style={styles.stageFactValue}>{fact.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
              {snapshot.interactionReason && snapshot.screenMode !== "stable" ? (
                <View style={styles.modeReasonCard}>
                  <Text style={styles.modeReasonLabel}>{screenModeCopy.note}</Text>
                  <Text style={styles.modeReasonText}>{snapshot.interactionReason}</Text>
                </View>
              ) : null}
              <Text style={styles.heroMetricLine}>
                {snapshot.archetypeCopy.metric} · {snapshot.rootBlockCount} blocks · {snapshot.blockTypeCount} modes
              </Text>
              {lastInput ? (
                <View style={styles.transcriptCard}>
                  <Text style={styles.transcriptLabel}>Last {lastInputMode ?? "input"}</Text>
                  <Text style={styles.transcriptText}>{lastInput}</Text>
                </View>
              ) : null}
              {runtime.error ? (
                <View style={styles.inlineErrorCard}>
                  <Text style={styles.inlineErrorTitle}>Harness error</Text>
                  <Text style={styles.inlineErrorText}>{runtime.error}</Text>
                </View>
              ) : null}
              {artifactBridgeError ? (
                <View style={styles.inlineErrorCard}>
                  <Text style={styles.inlineErrorTitle}>Artifact bridge</Text>
                  <Text style={styles.inlineErrorText}>{artifactBridgeError}</Text>
                </View>
              ) : null}
              {capabilityBridgeError ? (
                <View style={styles.inlineErrorCard}>
                  <Text style={styles.inlineErrorTitle}>Capability bridge</Text>
                  <Text style={styles.inlineErrorText}>{capabilityBridgeError}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {!snapshot.screen ? (
          <View style={styles.emptyState}>
            <Text style={styles.statusText}>{getFallbackScreenTitle(runtime)}</Text>
            <Text style={styles.emptyStateCaption}>{getFallbackWorkspaceMessage(runtime)}</Text>
          </View>
        ) : (
          <View
            style={[
              styles.workspacePanel,
              snapshot.archetype === "plan" ? styles.workspacePanelPlan : null,
              snapshot.archetype === "timeline" ? styles.workspacePanelTimeline : null,
              snapshot.archetype === "brief" ? styles.workspacePanelBrief : null,
              snapshot.archetype === "form" ? styles.workspacePanelForm : null,
              snapshot.archetype === "resource" ? styles.workspacePanelResource : null
            ]}
          >
            <View style={styles.workspacePanelAccentWrap}>
              <View
                style={[
                  styles.workspacePanelAccent,
                  snapshot.archetype === "plan" ? styles.workspacePanelAccentPlan : null,
                  snapshot.archetype === "timeline" ? styles.workspacePanelAccentTimeline : null,
                  snapshot.archetype === "brief" ? styles.workspacePanelAccentBrief : null,
                  snapshot.archetype === "form" ? styles.workspacePanelAccentForm : null,
                  snapshot.archetype === "resource" ? styles.workspacePanelAccentResource : null
                ]}
              />
            </View>
            <View
              style={[
                styles.workspaceBody,
                snapshot.archetype === "timeline" ? styles.workspaceBodyTimeline : null,
                snapshot.archetype === "brief" ? styles.workspaceBodyBrief : null,
                snapshot.archetype === "form" ? styles.workspaceBodyForm : null
              ]}
            >
              <View style={styles.blockStack}>
                {snapshot.resolvedBlocks.map((block) => (
                  <View key={block.id} style={styles.blockRevealWrap}>
                    <CoreBlock
                      block={block}
                      onAction={(action) => void handleRendererAction(action)}
                      onFormSubmit={(formId, values) =>
                        formsLocked
                          ? undefined
                          : void sendLockedClientEvent({
                              type: "form.submitted",
                              formId,
                              values
                            })
                      }
                      onArtifact={(resource, interactionMode) =>
                        void handleArtifactRequest(resource, interactionMode)
                      }
                      interaction={{
                        actionsDisabled: actionsLocked,
                        formsDisabled: formsLocked,
                        artifactsDisabled: artifactsLocked
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (runtime.phase === "connecting") {
    return (
      <View style={styles.screen}>
        {renderPhaseFallbackSurface(
          "Connecting",
          "Establishing the runtime session and waiting for the first workspace surface."
        )}
        {renderShell({
          disabled: true,
          inputMode: "voice",
          isListening: false,
          statusLabel: "connecting",
          actionLabel: idleLabel,
          secondaryActionLabel: "Type instead",
          textValue: "",
          submitDisabled: true,
          onPressIn: () => undefined,
          onPressOut: () => undefined,
          onToggleInputMode: () => undefined,
          onToggleRecentInput: () => undefined,
          onChangeText: () => undefined,
          onSubmitText: () => undefined
        })}
      </View>
    );
  }

  if (runtime.phase === "error") {
    return (
      <View style={styles.screen}>
        {renderPhaseFallbackSurface(
          "Runtime error",
          runtime.error ?? "The runtime reported an unrecoverable error.",
          "danger"
        )}
        {renderShell({
          disabled: true,
          inputMode: "voice",
          isListening: false,
          statusLabel: "error",
          actionLabel: idleLabel,
          secondaryActionLabel: "Type instead",
          textValue: "",
          submitDisabled: true,
          onPressIn: () => undefined,
          onPressOut: () => undefined,
          onToggleInputMode: () => undefined,
          onToggleRecentInput: () => undefined,
          onChangeText: () => undefined,
          onSubmitText: () => undefined
        })}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView
        style={styles.navChrome}
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight > 0 && nextHeight !== navHeight) {
            setNavHeight(nextHeight);
          }
        }}
      >
        <View style={styles.navBar}>
            <View style={[styles.navBarSide, styles.navBarSideStart]}>
              <View style={[styles.statusBadge, processingVisible ? styles.statusBadgeActive : null]}>
                <Text style={[styles.statusBadgeText, processingVisible ? styles.statusBadgeTextActive : null]}>
                  {navStatusLabel}
                </Text>
              </View>
            </View>
          <View style={styles.navBarCenter}>
            <Text numberOfLines={1} style={styles.navBarTitle}>
              {getFallbackScreenTitle(runtime)}
            </Text>
          </View>
          <View style={[styles.navBarSide, styles.navBarSideEnd]}>
            {processingVisible ? <View style={styles.navProcessingPill}><View style={styles.navProcessingDot} /></View> : null}
            <Pressable
              disabled={historyLocked}
              style={[styles.historyButton, historyLocked ? styles.historyButtonDisabled : null]}
              onPress={() => setHistoryVisibility(true)}
            >
              <Text style={[styles.historyButtonText, historyLocked ? styles.historyButtonTextDisabled : null]}>
                History
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.screenCanvas}>
        <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
          {renderScreenSurface(currentSnapshot)}
        </ScrollView>
      </View>
      {renderShell()}
      <ArtifactPreviewModal
        preview={previewArtifact}
        onClose={() => setPreviewArtifact(null)}
        onOpen={(artifact) => {
          void openArtifact(artifact).catch((error) => {
            setArtifactBridgeError(error instanceof Error ? error.message : "Failed to open the artifact.");
          });
        }}
        onShare={(artifact) => {
          void shareArtifact(artifact).catch((error) => {
            setArtifactBridgeError(error instanceof Error ? error.message : "Failed to share the artifact.");
          });
        }}
        onDownload={(artifact) => {
          void downloadArtifact(artifact).catch((error) => {
            setArtifactBridgeError(error instanceof Error ? error.message : "Failed to download the artifact.");
          });
        }}
      />
      <CapabilityRequestModal
        prompt={activeCapabilityRequest ? {
          request: activeCapabilityRequest,
          prompt: createDefaultCapabilityPrompt(activeCapabilityRequest)
        } : null}
        overridePrompt={capabilityHandlers && activeCapabilityRequest ? capabilityHandlers[activeCapabilityRequest.capability]?.describe : undefined}
        onApprove={(request) => {
          void resolveCapabilityRequest(request, true);
        }}
        onDeny={(request) => {
          void resolveCapabilityRequest(request, false);
        }}
      />
      <SessionHistoryModal
        history={runtime.history}
        historyEnabled={!historyLocked}
        visible={historyVisible}
        onClose={() => setHistoryVisibility(false)}
        onInspectRequest={(target) => openRequestInspector(target)}
      />
      <RequestInspectorModal
        runtime={runtime}
        visible={requestInspectorState.visible}
        target={requestInspectorState.target}
        onClose={closeRequestInspector}
        onAction={(action) => void handleRendererAction(action)}
      />
    </View>
  );
});

function DefaultVoiceShell({
  disabled,
  inputMode,
  isListening,
  statusLabel,
  promptLabel,
  actionLabel,
  secondaryActionLabel,
  textValue,
  textPlaceholder,
  submitDisabled,
  talkButtonLabel,
  listeningButtonLabel,
  textSubmitLabel,
  lastTranscript,
  lastInput,
  lastInputMode,
  recentInputHeadingLabel,
  recentInputMaxLines,
  recentInputCollapsedLabel,
  recentInputExpandedLabel,
  voiceModeChipLabel,
  textModeChipLabel,
  showRecentInput,
  onPressIn,
  onPressOut,
  onToggleInputMode,
  onToggleRecentInput,
  onChangeText,
  onSubmitText
}: VoiceShellRenderProps) {
  void statusLabel;
  void promptLabel;
  const recentInput = lastInput ?? lastTranscript;
  const recentInputMode = lastInput ? lastInputMode : lastTranscript ? "voice" : undefined;
  const fabLabel = isListening ? listeningButtonLabel : talkButtonLabel;
  const toggleLabel = inputMode === "voice" ? textModeChipLabel : voiceModeChipLabel;
  const recentToggleLabel = showRecentInput ? recentInputExpandedLabel : recentInput ? recentInputCollapsedLabel : "OPEN";
  const [recentMounted, setRecentMounted] = useState(Boolean(recentInput && showRecentInput));
  const recentOpacity = useRef(new Animated.Value(recentInput && showRecentInput ? 1 : 0)).current;
  const recentTranslateY = useRef(new Animated.Value(recentInput && showRecentInput ? 0 : 10)).current;

  useEffect(() => {
    if (recentInput && showRecentInput) {
      setRecentMounted(true);
      recentOpacity.stopAnimation();
      recentTranslateY.stopAnimation();
      recentOpacity.setValue(0);
      recentTranslateY.setValue(10);

      Animated.parallel([
        Animated.timing(recentOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(recentTranslateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
      return;
    }

    if (!recentMounted) {
      return;
    }

    recentOpacity.stopAnimation();
    recentTranslateY.stopAnimation();

    Animated.parallel([
      Animated.timing(recentOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(recentTranslateY, {
        toValue: 8,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        setRecentMounted(false);
      }
    });
  }, [
    recentInput,
    recentMounted,
    recentOpacity,
    recentTranslateY,
    showRecentInput
  ]);

  return (
    <View pointerEvents="box-none" style={styles.shellLayer}>
      {recentInput && recentMounted ? (
        <Animated.View
          style={[
            styles.shellStatusCluster,
            {
              opacity: recentOpacity,
              transform: [{ translateY: recentTranslateY }]
            }
          ]}
        >
          <View style={styles.shellEchoCard}>
            <Text style={styles.shellEchoLabel}>
              {recentInputHeadingLabel} {recentInputMode ?? "input"}
            </Text>
            <Text numberOfLines={recentInputMaxLines} style={styles.shellEchoText}>{recentInput}</Text>
          </View>
        </Animated.View>
      ) : null}
      {inputMode === "text" ? (
        <View style={styles.textComposerDock}>
          <View style={styles.textComposer}>
            <View style={styles.textComposerRow}>
              {recentInput ? (
                <Pressable style={[styles.modeFabSecondary, styles.recentToggleButton]} onPress={onToggleRecentInput}>
                  <Text style={styles.modeFabSecondaryLabel}>{recentToggleLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.modeFabSecondary, styles.modeFabComposer]} onPress={onToggleInputMode}>
                <Text style={styles.modeFabSecondaryLabel}>{toggleLabel}</Text>
              </Pressable>
              <TextInput
                value={textValue}
                onChangeText={onChangeText}
                placeholder={textPlaceholder}
                placeholderTextColor="#9CA3AF"
                editable={!disabled}
                style={[styles.textShellInput, disabled ? styles.textShellInputDisabled : null]}
                onSubmitEditing={onSubmitText}
                returnKeyType="send"
              />
              <Pressable
                disabled={disabled || submitDisabled}
                onPress={onSubmitText}
                style={[
                  styles.sendFab,
                  (disabled || submitDisabled) ? styles.voiceButtonDisabled : null
                ]}
              >
                <Text style={styles.sendFabLabel}>{textSubmitLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.fabDock}>
          {recentInput ? (
            <Pressable style={[styles.modeFabSecondary, styles.recentToggleFloating]} onPress={onToggleRecentInput}>
              <Text style={styles.modeFabSecondaryLabel}>{recentToggleLabel}</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.modeFabSecondary, styles.modeFabSecondaryFloating]} onPress={onToggleInputMode}>
            <Text style={styles.modeFabSecondaryLabel}>{toggleLabel}</Text>
          </Pressable>
          <Pressable
            disabled={disabled}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={[styles.voiceFab, isListening ? styles.voiceButtonActive : null, disabled ? styles.voiceButtonDisabled : null]}
          >
            <Text style={[styles.voiceFabLabel, isListening ? styles.voiceFabLabelActive : null]}>{fabLabel}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

interface ArtifactPreviewModalProps {
  preview: ArtifactPreviewState | null;
  onClose(): void;
  onOpen(artifact: ArtifactRef): void;
  onShare(artifact: ArtifactRef): void;
  onDownload(artifact: ArtifactRef): void;
}

function BottomSheetModal({
  visible,
  onRequestClose,
  children
}: {
  visible: boolean;
  onRequestClose(): void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const sheetTranslateY = useRef(new Animated.Value(visible ? 0 : 42)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }

    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 140,
        easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(sheetTranslateY, {
        toValue: visible ? 0 : 42,
        duration: visible ? 240 : 180,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]);

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => {
      animation.stop();
    };
  }, [backdropOpacity, sheetTranslateY, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal animationType="none" transparent visible={mounted} onRequestClose={onRequestClose}>
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents={visible ? "auto" : "none"}
          style={[styles.modalBackdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={styles.modalBackdropDismissArea} onPress={onRequestClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalSheetWrap,
            {
              transform: [{ translateY: sheetTranslateY }]
            }
          ]}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ArtifactPreviewModal({ preview, onClose, onOpen, onShare, onDownload }: ArtifactPreviewModalProps) {
  const artifact = preview?.artifact ?? null;
  const fields = preview?.preview.fields?.length
    ? preview.preview.fields
    : artifact
      ? createFallbackPreviewFields(artifact)
      : [];

  return (
    <BottomSheetModal visible={Boolean(preview)} onRequestClose={onClose}>
      <View style={styles.modalCard}>
        <Text style={styles.modalEyebrow}>Artifact preview</Text>
        <Text style={styles.modalTitle}>{preview?.preview.title ?? artifact?.title ?? artifact?.id ?? "Artifact"}</Text>
        <Text style={styles.modalMeta}>
          Kind: {artifact?.kind ?? "-"} · Source: {artifact?.source ?? "-"}
        </Text>
        {preview?.preview.description ? <Text style={styles.modalMeta}>{preview.preview.description}</Text> : null}
        {preview?.preview.thumbnailUri ? (
          <View style={styles.modalPreviewSurface}>
            <Text style={styles.modalPreviewLabel}>Thumbnail</Text>
            <Text style={styles.modalPreviewText}>{preview.preview.thumbnailUri}</Text>
          </View>
        ) : null}
        {preview?.preview.content ? (
          <View style={styles.modalPreviewSurface}>
            <Text style={styles.modalPreviewLabel}>
              {preview.preview.contentType === "text"
                ? "Content"
                : preview.preview.contentType === "image"
                  ? "Image"
                  : "Preview"}
            </Text>
            <Text style={styles.modalPreviewText}>{preview.preview.content}</Text>
          </View>
        ) : null}
        {fields.map((field) => (
          <View key={`${field.label}-${field.value}`} style={styles.modalPreviewSurface}>
            <Text style={styles.modalPreviewLabel}>{field.label}</Text>
            <Text style={styles.modalPreviewText}>{field.value}</Text>
          </View>
        ))}
        <View style={styles.modalActions}>
          <Pressable style={styles.secondaryActionButton} onPress={onClose}>
            <Text style={styles.secondaryActionText}>Close</Text>
          </Pressable>
          {artifact?.uri ? (
            <Pressable style={styles.secondaryActionButton} onPress={() => onShare(artifact)}>
              <Text style={styles.secondaryActionText}>Share</Text>
            </Pressable>
          ) : null}
          {artifact && canDownloadArtifact(artifact) ? (
            <Pressable style={styles.secondaryActionButton} onPress={() => onDownload(artifact)}>
              <Text style={styles.secondaryActionText}>Download</Text>
            </Pressable>
          ) : null}
          {artifact?.openable !== false && artifact?.uri ? (
            <Pressable style={styles.actionButton} onPress={() => onOpen(artifact)}>
              <Text style={styles.actionButtonText}>{preview?.preview.openLabel ?? "Open in system"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </BottomSheetModal>
  );
}

function createFallbackPreviewFields(artifact: ArtifactRef): ArtifactPreviewField[] {
  const fields: ArtifactPreviewField[] = [];

  if (artifact.uri) {
    fields.push({
      label: "URI",
      value: artifact.uri
    });
  }

  if (artifact.mimeType) {
    fields.push({
      label: "MIME",
      value: artifact.mimeType
    });
  }

  if (fields.length === 0) {
    fields.push({
      label: "Preview",
      value: "No inline preview data is available for this artifact yet."
    });
  }

  return fields;
}

interface CapabilityRequestModalProps {
  prompt: CapabilityPromptState | null;
  overridePrompt?: (
    request: CapabilityRequest
  ) => CapabilityPromptDescriptor | undefined | Promise<CapabilityPromptDescriptor | undefined>;
  onApprove(request: CapabilityRequest): void;
  onDeny(request: CapabilityRequest): void;
}

function CapabilityRequestModal({ prompt, overridePrompt, onApprove, onDeny }: CapabilityRequestModalProps) {
  const request = prompt?.request ?? null;
  const [resolvedPrompt, setResolvedPrompt] = useState<CapabilityPromptState | null>(prompt);

  useEffect(() => {
    let active = true;
    setResolvedPrompt(prompt);

    if (!prompt || !overridePrompt) {
      return () => {
        active = false;
      };
    }

    void Promise.resolve(overridePrompt(prompt.request)).then((result) => {
      if (!active || !result) {
        return;
      }

      setResolvedPrompt({
        request: prompt.request,
        prompt: {
          ...prompt.prompt,
          ...result,
          fields: result.fields ?? prompt.prompt.fields
        }
      });
    });

    return () => {
      active = false;
    };
  }, [overridePrompt, prompt]);

  const activePrompt = resolvedPrompt?.prompt;

  return (
    <BottomSheetModal visible={Boolean(request)} onRequestClose={() => request && onDeny(request)}>
      <View style={styles.capabilityCard}>
        <Text style={styles.modalEyebrow}>Capability request</Text>
        <Text style={styles.modalTitle}>{request?.capability ?? "Device capability"}</Text>
        {activePrompt?.title ? <Text style={styles.modalMetaStrong}>{activePrompt.title}</Text> : null}
        <Text style={styles.modalMeta}>
          {activePrompt?.description ?? "The harness is asking the client runtime to resolve a device-level permission or system action."}
        </Text>
        <View style={styles.modalPreviewSurface}>
          <Text style={styles.modalPreviewLabel}>{activePrompt?.reasonLabel ?? "Reason"}</Text>
          <Text style={styles.modalPreviewText}>{request?.reason ?? "No reason provided."}</Text>
        </View>
        {activePrompt?.fields?.map((field) => (
          <View key={`${field.label}-${field.value}`} style={styles.modalPreviewSurface}>
            <Text style={styles.modalPreviewLabel}>{field.label}</Text>
            <Text style={styles.modalPreviewText}>{field.value}</Text>
          </View>
        ))}
        <View style={styles.modalActions}>
          {request ? (
            <Pressable style={styles.secondaryActionButton} onPress={() => onDeny(request)}>
              <Text style={styles.secondaryActionText}>{activePrompt?.secondaryLabel ?? "Not now"}</Text>
            </Pressable>
          ) : null}
          {request ? (
            <Pressable style={styles.actionButton} onPress={() => onApprove(request)}>
              <Text style={styles.actionButtonText}>{activePrompt?.primaryLabel ?? "Allow mock resolution"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </BottomSheetModal>
  );
}

export const AgentRuntimeView = forwardRef<AgentRuntimeViewHandle, AgentRuntimeViewProps>(function AgentRuntimeView({
  harness,
  voiceShell,
  artifactHandlers,
  capabilityHandlers,
  hostBridge,
  renderVoiceShell,
  transitionHooks,
  navigationHooks,
  runtimeOptions
}, ref) {
  return (
    <AgentRuntimeProvider harness={harness} options={runtimeOptions}>
      <AgentRuntimeContent
        ref={ref}
        voiceShell={voiceShell}
        artifactHandlers={artifactHandlers}
        capabilityHandlers={capabilityHandlers}
        hostBridge={hostBridge}
        renderVoiceShell={renderVoiceShell}
        transitionHooks={transitionHooks}
        navigationHooks={navigationHooks}
      />
    </AgentRuntimeProvider>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F6FB"
  },
  screenCanvas: {
    flex: 1
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 168
  },
  screenFrame: {
    width: "100%",
    gap: 22
  },
  transitionHeroWrap: {
    width: "100%"
  },
  navChrome: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(243, 246, 251, 0.96)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.28)"
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: 4
  },
  navBarSide: {
    minWidth: 84,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  navBarSideStart: {
    justifyContent: "flex-start"
  },
  navBarSideEnd: {
    marginLeft: "auto",
    justifyContent: "flex-end"
  },
  navBarCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    gap: 2
  },
  navBarTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F8FB"
  },
  phaseFallbackWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 84,
    backgroundColor: "#F6F8FB"
  },
  phaseFallbackCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7DEE9",
    gap: 12
  },
  phaseFallbackCardDanger: {
    borderColor: "#F1C4C4",
    backgroundColor: "#FFF7F7"
  },
  phaseFallbackBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#E6EEF9"
  },
  phaseFallbackBadgeDanger: {
    backgroundColor: "#FDE2E2"
  },
  phaseFallbackBadgeText: {
    color: "#30517A",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  phaseFallbackBadgeTextDanger: {
    color: "#A63B3B"
  },
  phaseFallbackMessage: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 24
  },
  header: {
    gap: 12
  },
  heroPanel: {
    overflow: "visible",
    borderRadius: 0,
    paddingHorizontal: 2,
    paddingVertical: 6,
    backgroundColor: "transparent",
    borderWidth: 0
  },
  heroPanelPlan: {
    backgroundColor: "rgba(255, 255, 255, 0.62)"
  },
  heroPanelTimeline: {
    backgroundColor: "rgba(248, 251, 255, 0.64)"
  },
  heroPanelBrief: {
    backgroundColor: "rgba(255, 255, 255, 0.54)"
  },
  heroPanelForm: {
    width: "100%",
    maxWidth: 760,
    backgroundColor: "transparent"
  },
  heroPanelResource: {
    backgroundColor: "transparent"
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  heroTypeChip: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 999,
    backgroundColor: "transparent"
  },
  heroTypeChipText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  heroModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(10, 132, 255, 0.08)"
  },
  heroModeChipText: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  heroMetricChip: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 999,
    backgroundColor: "transparent"
  },
  heroMetricChipText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600"
  },
  stageBannerCard: {
    marginTop: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(236, 244, 255, 0.84)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.16)",
    gap: 8
  },
  stageBannerCardSuccess: {
    backgroundColor: "rgba(237, 252, 242, 0.84)",
    borderColor: "rgba(34, 197, 94, 0.16)"
  },
  stageBannerCardWarning: {
    backgroundColor: "rgba(255, 248, 233, 0.88)",
    borderColor: "rgba(245, 158, 11, 0.18)"
  },
  stageBannerCardDanger: {
    backgroundColor: "rgba(255, 241, 242, 0.88)",
    borderColor: "rgba(239, 68, 68, 0.18)"
  },
  stageBannerLabel: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  stageBannerLabelSuccess: {
    color: "#15803D"
  },
  stageBannerLabelWarning: {
    color: "#B45309"
  },
  stageBannerLabelDanger: {
    color: "#B91C1C"
  },
  stageBannerText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 19
  },
  stageFactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  stageFactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.78)"
  },
  stageFactChipSuccess: {
    backgroundColor: "rgba(240, 253, 244, 0.92)"
  },
  stageFactChipWarning: {
    backgroundColor: "rgba(255, 251, 235, 0.92)"
  },
  stageFactChipDanger: {
    backgroundColor: "rgba(254, 242, 242, 0.92)"
  },
  stageFactLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  stageFactValue: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "700"
  },
  modeReasonCard: {
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.12)",
    gap: 4
  },
  modeReasonLabel: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modeReasonText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 19
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0"
  },
  statusBadgeActive: {
    backgroundColor: "rgba(10, 132, 255, 0.10)",
    borderColor: "rgba(10, 132, 255, 0.22)"
  },
  statusBadgeText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  statusBadgeTextActive: {
    color: "#0A84FF"
  },
  navProcessingPill: {
    width: 28,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(10, 132, 255, 0.20)",
    justifyContent: "center",
    paddingHorizontal: 2
  },
  navProcessingDot: {
    width: 10,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#0A84FF"
  },
  historyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0"
  },
  historyButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(216, 227, 240, 0.7)"
  },
  historyButtonText: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700"
  },
  historyButtonTextDisabled: {
    color: "#94A3B8"
  },
  historyNavChrome: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#F3F6FB"
  },
  historyNavSpacer: {
    width: 48,
    height: 1
  },
  title: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26
  },
  heroMetricLine: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600"
  },
  blockStack: {
    width: "100%",
    gap: 16
  },
  blockRevealWrap: {
    width: "100%"
  },
  workspacePanel: {
    overflow: "hidden",
    width: "100%",
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    gap: 18
  },
  workspacePanelPlan: {
    backgroundColor: "transparent"
  },
  workspacePanelTimeline: {
    backgroundColor: "transparent"
  },
  workspacePanelBrief: {
    width: "100%"
  },
  workspacePanelForm: {
    width: "100%",
    backgroundColor: "transparent"
  },
  workspacePanelResource: {
    backgroundColor: "transparent"
  },
  workspacePanelAccent: {
    height: 2,
    width: 72,
    borderRadius: 999,
    backgroundColor: "rgba(100, 116, 139, 0.16)"
  },
  workspacePanelAccentWrap: {
    width: "100%"
  },
  workspacePanelAccentPlan: {
    width: 132,
    backgroundColor: "rgba(59, 130, 246, 0.26)"
  },
  workspacePanelAccentTimeline: {
    width: 100,
    backgroundColor: "rgba(34, 197, 94, 0.24)"
  },
  workspacePanelAccentBrief: {
    width: 72,
    backgroundColor: "rgba(100, 116, 139, 0.24)"
  },
  workspacePanelAccentForm: {
    width: 84,
    backgroundColor: "rgba(99, 102, 241, 0.22)"
  },
  workspacePanelAccentResource: {
    width: 116,
    backgroundColor: "rgba(14, 165, 233, 0.22)"
  },
  workspaceBody: {
    position: "relative",
    width: "100%",
    overflow: "hidden"
  },
  workspaceBodyTimeline: {
    paddingLeft: 12
  },
  workspaceBodyBrief: {
    alignItems: "stretch"
  },
  workspaceBodyForm: {
    alignItems: "stretch"
  },
  emptyState: {
    paddingVertical: 32
  },
  emptyStateCaption: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20
  },
  historyScreen: {
    flex: 1,
    backgroundColor: "#F3F6FB"
  },
  inspectorScreen: {
    flex: 1,
    backgroundColor: "#F3F6FB"
  },
  inspectorNavChrome: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#F3F6FB"
  },
  inspectorNavBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  inspectorNavSpacer: {
    width: 56,
    height: 1
  },
  inspectorNavCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  inspectorNavTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700"
  },
  inspectorNavSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500"
  },
  inspectorCloseButton: {
    minWidth: 56,
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0"
  },
  inspectorCloseButtonText: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700"
  },
  inspectorContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 48
  },
  inspectorTargetDock: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D8E3F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 10
  },
  inspectorTargetLabel: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700"
  },
  inspectorTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  inspectorTargetInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8E3F0",
    paddingHorizontal: 14,
    color: "#0F172A",
    backgroundColor: "#F8FBFF",
    fontSize: 13,
    fontWeight: "500"
  },
  inspectorTargetButton: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84FF"
  },
  inspectorTargetButtonDisabled: {
    backgroundColor: "#D8E3F0"
  },
  inspectorTargetButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  inspectorTargetButtonTextDisabled: {
    color: "#6B7280"
  },
  historyContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 40
  },
  historySummaryGrid: {
    gap: 10
  },
  historySummaryCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0",
    gap: 6
  },
  historySummaryLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  historySummaryValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "700"
  },
  historySummaryNote: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18
  },
  historyRequestGroupList: {
    gap: 10
  },
  historyRequestGroupCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(216, 227, 240, 0.88)",
    gap: 6
  },
  historyRequestGroupCardPressable: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  },
  historyRequestGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  historyRequestGroupTitle: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700"
  },
  historyRequestGroupMeta: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18
  },
  historyRequestGroupKinds: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    textTransform: "uppercase"
  },
  historyFilterRow: {
    gap: 8,
    paddingRight: 20
  },
  historyFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0"
  },
  historyFilterChipActive: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF"
  },
  historyFilterText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700"
  },
  historyFilterTextActive: {
    color: "#F8FAFC"
  },
  historyTimelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12
  },
  historyTimelineRail: {
    alignItems: "center",
    width: 20
  },
  historyTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 18,
    backgroundColor: "#94A3B8"
  },
  historyTimelineDotInput: {
    backgroundColor: "#F59E0B"
  },
  historyTimelineDotWorkspace: {
    backgroundColor: "#2563EB"
  },
  historyTimelineDotResource: {
    backgroundColor: "#059669"
  },
  historyTimelineDotIssue: {
    backgroundColor: "#DC2626"
  },
  historyTimelineDotAction: {
    backgroundColor: "#7C3AED"
  },
  historyTimelineLine: {
    flex: 1,
    width: 2,
    marginTop: 8,
    marginBottom: -8,
    backgroundColor: "#D8E3F0"
  },
  historyCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0",
    gap: 8
  },
  historyCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  historyMetaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(10, 132, 255, 0.10)"
  },
  historyMetaBadgeText: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  historyMetaBadgeMuted: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF4FA"
  },
  historyMetaBadgeMutedText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  historyCardTime: {
    marginLeft: "auto",
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600"
  },
  historyCardHeader: {
    gap: 4
  },
  historyCardTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700"
  },
  historyCardBody: {
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 21
  },
  historyCardMetaDetail: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20
  },
  statusText: {
    color: "#374151",
    fontSize: 16
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 16
  },
  transcriptCard: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(37, 99, 235, 0.22)",
    gap: 6
  },
  transcriptLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  transcriptText: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 22
  },
  inlineErrorCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 4
  },
  inlineErrorTitle: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  inlineErrorText: {
    color: "#B91C1C",
    fontSize: 14,
    lineHeight: 20
  },
  shellLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12
  },
  shellStatusCluster: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    maxWidth: 320
  },
  shellEchoCard: {
    width: "100%",
    maxWidth: 304,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(214, 224, 236, 0.92)",
    gap: 5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 8
  },
  shellEchoLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  shellEchoText: {
    color: "#0F172A",
    fontSize: 13,
    lineHeight: 18
  },
  fabDock: {
    position: "relative",
    minWidth: 176,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center"
  },
  textComposerDock: {
    width: "100%",
    alignItems: "center"
  },
  textComposer: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(214, 224, 236, 0.94)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10
    },
    elevation: 10
  },
  textComposerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  textShellInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 18,
    color: "#0F172A",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#DBE7F5"
  },
  textShellInputDisabled: {
    opacity: 0.45
  },
  voiceFab: {
    alignItems: "center",
    justifyContent: "center",
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12
    },
    elevation: 12
  },
  voiceButtonActive: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF"
  },
  voiceButtonDisabled: {
    opacity: 0.45
  },
  voiceFabLabel: {
    color: "#0A84FF",
    fontSize: 14,
    fontWeight: "700"
  },
  voiceFabLabelActive: {
    color: "#F8FAFC"
  },
  modeFabSecondary: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E3F0"
  },
  modeFabSecondaryFloating: {
    position: "absolute",
    right: 0,
    bottom: 14
  },
  recentToggleFloating: {
    position: "absolute",
    left: 0,
    bottom: 14
  },
  recentToggleButton: {
    flexShrink: 0
  },
  modeFabComposer: {
    flexShrink: 0
  },
  modeFabSecondaryLabel: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "700"
  },
  sendFab: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#0A84FF"
  },
  sendFabLabel: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700"
  },
  actionButton: {
    backgroundColor: "#0A84FF",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  actionButtonText: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "600"
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  secondaryActionText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600"
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.28)"
  },
  modalBackdropDismissArea: {
    flex: 1
  },
  modalSheetWrap: {
    justifyContent: "flex-end"
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F8FBFF",
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 18,
    gap: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(214, 224, 236, 0.94)"
  },
  modalHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#CBD5E1"
  },
  modalCard: {
    gap: 10
  },
  capabilityCard: {
    gap: 10
  },
  modalEyebrow: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "700"
  },
  modalMeta: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20
  },
  modalMetaStrong: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  modalPreviewSurface: {
    marginTop: 4,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1,
    borderColor: "#D8E3F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6
  },
  modalPreviewLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modalPreviewText: {
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 21
  },
  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 12
  }
});
