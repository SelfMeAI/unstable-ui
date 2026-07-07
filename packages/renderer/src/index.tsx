import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
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
  ArtifactRef,
  Block,
  CapabilityRequest,
  ClientEvent,
  LogBlock,
  LogItem
} from "@selfme/unstable-ui-protocol";
import {
  AgentRuntimeProvider,
  useAgentRuntime,
  type AgentRuntimeOptions,
  type RuntimeContextValue,
  type RuntimeEventLogEntry
} from "@selfme/unstable-ui-runtime";

const defaultMockTranscripts = [
  "Plan my day around two deep work blocks and one gym session.",
  "Summarize the last task and show me the next three actions.",
  "Create a quick follow-up draft for the latest conversation."
];

export interface VoiceShellOptions {
  enabled?: boolean;
  promptLabel?: string;
  idleLabel?: string;
  listeningLabel?: string;
  textPlaceholder?: string;
  mockTranscripts?: string[];
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
  lastTranscript?: string;
  lastInput?: string;
  lastInputMode?: "voice" | "text";
  showRecentInput: boolean;
  onPressIn(): void;
  onPressOut(): void;
  onToggleInputMode(): void;
  onToggleRecentInput(): void;
  onChangeText(value: string): void;
  onSubmitText(): void;
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
}

export interface ArtifactHandlerContext {
  openWithSystem(): Promise<void>;
}

export interface ArtifactHandler {
  preview?: (artifact: ArtifactRef) => ArtifactPreviewDescriptor | undefined | Promise<ArtifactPreviewDescriptor | undefined>;
  open?: (artifact: ArtifactRef, context: ArtifactHandlerContext) => void | Promise<void>;
}

export type ArtifactHandlers = Partial<Record<ArtifactRef["kind"], ArtifactHandler>>;

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

export interface AgentRuntimeViewProps {
  harness: HarnessAdapter;
  voiceShell?: VoiceShellOptions;
  artifactHandlers?: ArtifactHandlers;
  capabilityHandlers?: CapabilityHandlers;
  renderVoiceShell?: (props: VoiceShellRenderProps) => ReactNode;
  runtimeOptions?: AgentRuntimeOptions;
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
  visible: boolean;
  onClose(): void;
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

type HistoryFilter = "all" | "input" | "workspace" | "resource" | "issue";
type ScreenArchetype = "plan" | "timeline" | "brief" | "form" | "workspace" | "resource";
type LeafBlock = Exclude<Block, { type: "section" | "split" }>;
type NestableBlock = Exclude<Block, { type: "split" }>;

function formatRuntimeEventLogMeta(entry: RuntimeEventLogEntry) {
  const timestamp = entry.timestamp.slice(11, 19);
  return `${entry.direction} · ${timestamp}`;
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

function resolveRuntimeLeafBlock(block: LeafBlock, runtime: RuntimeContextValue): LeafBlock {
  if (block.type !== "log" || block.source !== "runtime.eventLog") {
    return block;
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

function resolveRuntimeNestableBlock(block: NestableBlock, runtime: RuntimeContextValue): NestableBlock {
  if (block.type === "section") {
    return {
      ...block,
      blocks: block.blocks.map((childBlock): LeafBlock => resolveRuntimeLeafBlock(childBlock, runtime))
    };
  }

  return resolveRuntimeLeafBlock(block, runtime);
}

function resolveRuntimeBlock(block: Block, runtime: RuntimeContextValue): Block {
  if (block.type === "split") {
    return {
      ...block,
      panes: block.panes.map((pane) => ({
        ...pane,
        blocks: pane.blocks.map((childBlock): NestableBlock => resolveRuntimeNestableBlock(childBlock, runtime))
      }))
    };
  }

  return resolveRuntimeNestableBlock(block, runtime);
}

function resolveRuntimeBlocks(blocks: Block[], runtime: RuntimeContextValue) {
  return blocks.map((block) => resolveRuntimeBlock(block, runtime));
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

function formatHistoryTimestamp(timestamp: string) {
  return timestamp.slice(11, 19);
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

function SessionHistoryModal({ history, visible, onClose }: HistoryModalProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  useEffect(() => {
    if (!visible) {
      setFilter("all");
    }
  }, [visible]);

  const filteredHistory = history.filter((entry) => matchesHistoryFilter(entry, filter));
  const latestInput = findLatestHistoryEntry(history, "input");
  const latestWorkspace = findLatestHistoryEntry(history, "workspace");
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
    }
  ];
  const filters: Array<{ id: HistoryFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "input", label: "Inputs" },
    { id: "workspace", label: "Workspace" },
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
              <Text numberOfLines={1} style={styles.navBarSubtitle}>
                Inputs, workspace changes, resources, and failures
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
                filteredHistory.map((entry, index) => {
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
                          <Text style={styles.historyCardTime}>{formatHistoryTimestamp(entry.timestamp)}</Text>
                        </View>
                        <View style={styles.historyCardHeader}>
                          <Text style={styles.historyCardTitle}>{entry.title}</Text>
                        </View>
                        {entry.body ? <Text style={styles.historyCardBody}>{entry.body}</Text> : null}
                        {entry.meta ? <Text style={styles.historyCardMetaDetail}>{entry.meta}</Text> : null}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AgentRuntimeContent({
  voiceShell,
  artifactHandlers,
  capabilityHandlers,
  renderVoiceShell
}: {
  voiceShell?: VoiceShellOptions;
  artifactHandlers?: ArtifactHandlers;
  capabilityHandlers?: CapabilityHandlers;
  renderVoiceShell?: (props: VoiceShellRenderProps) => ReactNode;
}) {
  const runtime = useAgentRuntime();
  const screen = runtime.screen;
  const resolvedBlocks = screen ? resolveRuntimeBlocks(screen.blocks, runtime) : [];
  const clientEventLockRef = useRef(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [isListening, setIsListening] = useState(false);
  const [navHeight, setNavHeight] = useState(108);
  const [showRecentInput, setShowRecentInput] = useState(true);
  const [textValue, setTextValue] = useState("");
  const [lastInput, setLastInput] = useState<string>();
  const [lastInputMode, setLastInputMode] = useState<"voice" | "text">();
  const [lastTranscript, setLastTranscript] = useState<string>();
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactPreviewState | null>(null);
  const [artifactBridgeError, setArtifactBridgeError] = useState<string>();
  const [capabilityBridgeError, setCapabilityBridgeError] = useState<string>();
  const [dismissedCapabilityIds, setDismissedCapabilityIds] = useState<string[]>([]);
  const shellEnabled = voiceShell?.enabled ?? true;
  const mockTranscripts = voiceShell?.mockTranscripts?.length ? voiceShell.mockTranscripts : defaultMockTranscripts;
  const statusLabel = isListening ? voiceShell?.listeningLabel ?? "Listening" : runtime.status;
  const promptLabel =
    voiceShell?.promptLabel ?? "Hold to talk. Voice input is mocked until the microphone bridge is implemented.";
  const idleLabel = voiceShell?.idleLabel ?? "Press and hold to talk";
  const textPlaceholder = voiceShell?.textPlaceholder ?? "Type a request for the harness";
  const activeCapabilityRequest =
    runtime.capabilityRequests.find((request) => !dismissedCapabilityIds.includes(request.id)) ?? null;
  const processingVisible = runtime.status === "thinking" || runtime.status === "running";
  const shellLocked = runtime.interaction.input === "locked";
  const actionsLocked = runtime.interaction.actions === "locked";
  const formsLocked = runtime.interaction.forms === "locked";
  const artifactsLocked = runtime.interaction.artifacts === "locked";
  const interactionUnlockReady =
    !processingVisible &&
    (runtime.interaction.input === "enabled" ||
      runtime.interaction.actions === "enabled" ||
      runtime.interaction.forms === "enabled");
  const screenModeCopy = getScreenModeCopy(runtime.screenMode);
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

  const contentContainerStyle: StyleProp<ViewStyle> = [
    styles.container,
    {
      paddingTop: navHeight + 18
    }
  ];

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

    if (resource.uri) {
      fields.push({
        label: "URI",
        value: resource.uri
      });
    }

    if (resource.mimeType) {
      fields.push({
        label: "MIME",
        value: resource.mimeType
      });
    }

    if (fields.length === 0) {
      fields.push({
        label: "Preview",
        value: "No inline preview data is available for this artifact yet."
      });
    }

    return {
      description: "Default artifact preview generated by the renderer.",
      fields
    };
  }

  function createDefaultCapabilityPrompt(request: CapabilityRequest): CapabilityPromptDescriptor {
    const fields: CapabilityPromptField[] = [];

    if (request.payload) {
      for (const [key, value] of Object.entries(request.payload)) {
        if (value === undefined) {
          continue;
        }

        fields.push({
          label: key,
          value: typeof value === "string" ? value : JSON.stringify(value)
        });
      }
    }

    return {
      description: "The harness is asking the client runtime to resolve a device-level permission or system action.",
      reasonLabel: "Reason",
      primaryLabel: "Allow mock resolution",
      secondaryLabel: "Not now",
      fields
    };
  }

  async function openArtifactWithSystem(resource: ArtifactRef) {
    if (!canOpenArtifact(resource)) {
      throw new Error("This artifact cannot be opened yet.");
    }

    await Linking.openURL(resource.uri);
  }

  async function openArtifact(resource: ArtifactRef) {
    const handler = getArtifactHandler(resource);

    if (handler?.open) {
      await handler.open(resource, {
        openWithSystem: () => openArtifactWithSystem(resource)
      });
      return;
    }

    await openArtifactWithSystem(resource);
  }

  async function previewArtifactResource(resource: ArtifactRef) {
    const handler = getArtifactHandler(resource);
    const preview = (await handler?.preview?.(resource)) ?? createDefaultArtifactPreview(resource);
    setPreviewArtifact({
      artifact: resource,
      preview
    });
  }

  async function handleArtifactRequest(resource: ArtifactRef, mode: "preview" | "open") {
    if (artifactsLocked) {
      return;
    }

    const artifact = resolveArtifact(resource);
    setArtifactBridgeError(undefined);

    try {
      if (mode === "preview") {
        await previewArtifactResource(artifact);
      } else {
        await openArtifact(artifact);
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
      const handlerResult = await getCapabilityHandler(request)?.resolve?.(request, granted);

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

  async function handleVoiceCommit() {
    if (!shellEnabled || shellLocked || !isListening) {
      return;
    }

    setIsListening(false);

    const transcript = mockTranscripts[transcriptIndex % mockTranscripts.length];
    setTranscriptIndex((value) => value + 1);
    setLastTranscript(transcript);
    setLastInput(transcript);
    setLastInputMode("voice");

    await submitInput("voice", transcript);
  }

  async function handleTextSubmit() {
    if (!shellEnabled || shellLocked) {
      return;
    }

    const nextText = textValue.trim();

    if (!nextText) {
      return;
    }

    setLastInput(nextText);
    setLastInputMode("text");
    setTextValue("");
    await submitInput("text", nextText);
  }

  const shellProps: VoiceShellRenderProps = {
    disabled: !shellEnabled || shellLocked,
    inputMode,
    isListening,
    statusLabel,
    promptLabel,
    actionLabel: isListening ? voiceShell?.listeningLabel ?? "Release to send" : idleLabel,
    secondaryActionLabel: inputMode === "voice" ? "Type instead" : "Use voice",
    textValue,
    textPlaceholder,
    submitDisabled: !textValue.trim(),
    lastTranscript,
    lastInput,
    lastInputMode,
    showRecentInput,
    onPressIn: () => {
      if (!shellEnabled || shellLocked || inputMode !== "voice") {
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
      setInputMode((value) => (value === "voice" ? "text" : "voice"));
    },
    onToggleRecentInput: () => {
      setShowRecentInput((value) => !value);
    },
    onChangeText: (value) => {
      setTextValue(value);
    },
    onSubmitText: () => {
      void handleTextSubmit();
    }
  };

  function renderScreenSurface(snapshot: RenderSnapshot) {
    const screenModeCopy = getScreenModeCopy(snapshot.screenMode);

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
            <Text style={styles.statusText}>No screen available.</Text>
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
                        onAction={(action) =>
                          void sendLockedClientEvent({
                            type: "action.triggered",
                            actionId: action.id,
                            payload: action.payload
                          })
                        }
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
        <View style={styles.centered}>
          <Text style={styles.statusText}>Connecting runtime...</Text>
        </View>
        <DefaultVoiceShell
          disabled
          inputMode="voice"
          isListening={false}
          statusLabel="connecting"
          promptLabel={promptLabel}
          actionLabel={idleLabel}
          secondaryActionLabel="Type instead"
          textValue=""
          textPlaceholder={textPlaceholder}
          submitDisabled
          lastTranscript={lastTranscript}
          lastInput={lastInput}
          lastInputMode={lastInputMode}
          showRecentInput={showRecentInput}
          onPressIn={() => undefined}
          onPressOut={() => undefined}
          onToggleInputMode={() => undefined}
          onToggleRecentInput={() => undefined}
          onChangeText={() => undefined}
          onSubmitText={() => undefined}
        />
      </View>
    );
  }

  if (runtime.phase === "error") {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{runtime.error ?? "Runtime error"}</Text>
        </View>
        <DefaultVoiceShell
          disabled
          inputMode="voice"
          isListening={false}
          statusLabel="error"
          promptLabel={promptLabel}
          actionLabel={idleLabel}
          secondaryActionLabel="Type instead"
          textValue=""
          textPlaceholder={textPlaceholder}
          submitDisabled
          lastTranscript={lastTranscript}
          lastInput={lastInput}
          lastInputMode={lastInputMode}
          showRecentInput={showRecentInput}
          onPressIn={() => undefined}
          onPressOut={() => undefined}
          onToggleInputMode={() => undefined}
          onToggleRecentInput={() => undefined}
          onChangeText={() => undefined}
          onSubmitText={() => undefined}
        />
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
                {screenModeCopy.label} · {statusLabel}
              </Text>
            </View>
          </View>
          <View style={styles.navBarCenter}>
            <Text numberOfLines={1} style={styles.navBarTitle}>
              {screen?.title ?? "Workspace"}
            </Text>
            <Text numberOfLines={1} style={styles.navBarSubtitle}>
              {screen?.subtitle ?? archetypeCopy.metric}
            </Text>
          </View>
          <View style={[styles.navBarSide, styles.navBarSideEnd]}>
            {processingVisible ? <View style={styles.navProcessingPill}><View style={styles.navProcessingDot} /></View> : null}
            <Pressable style={styles.historyButton} onPress={() => setHistoryVisible(true)}>
              <Text style={styles.historyButtonText}>History</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.screenCanvas}>
        <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
          {renderScreenSurface(currentSnapshot)}
        </ScrollView>
      </View>
      {renderVoiceShell ? renderVoiceShell(shellProps) : <DefaultVoiceShell {...shellProps} />}
      <ArtifactPreviewModal
        preview={previewArtifact}
        onClose={() => setPreviewArtifact(null)}
        onOpen={(artifact) => {
          void openArtifact(artifact).catch((error) => {
            setArtifactBridgeError(error instanceof Error ? error.message : "Failed to open the artifact.");
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
      <SessionHistoryModal history={runtime.history} visible={historyVisible} onClose={() => setHistoryVisible(false)} />
    </View>
  );
}

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
  lastTranscript,
  lastInput,
  lastInputMode,
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
  const fabLabel = isListening ? "Send" : actionLabel.includes("talk") ? "Talk" : actionLabel;
  const toggleLabel = secondaryActionLabel.includes("voice") ? "MIC" : "TXT";
  const recentToggleLabel = recentInput ? "LAST" : "OPEN";

  return (
    <View pointerEvents="box-none" style={styles.shellLayer}>
      {recentInput && showRecentInput ? (
        <View style={styles.shellStatusCluster}>
          <View style={styles.shellEchoCard}>
            <Text style={styles.shellEchoLabel}>Last {recentInputMode ?? "input"}</Text>
            <Text numberOfLines={2} style={styles.shellEchoText}>{recentInput}</Text>
          </View>
        </View>
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
                <Text style={styles.sendFabLabel}>Send</Text>
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
}

function ArtifactPreviewModal({ preview, onClose, onOpen }: ArtifactPreviewModalProps) {
  const artifact = preview?.artifact ?? null;
  const fields = preview?.preview.fields?.length
    ? preview.preview.fields
    : artifact
      ? createFallbackPreviewFields(artifact)
      : [];

  return (
    <Modal animationType="slide" transparent visible={Boolean(preview)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>Artifact preview</Text>
          <Text style={styles.modalTitle}>{preview?.preview.title ?? artifact?.title ?? artifact?.id ?? "Artifact"}</Text>
          <Text style={styles.modalMeta}>
            Kind: {artifact?.kind ?? "-"} · Source: {artifact?.source ?? "-"}
          </Text>
          {preview?.preview.description ? <Text style={styles.modalMeta}>{preview.preview.description}</Text> : null}
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
            {artifact?.openable !== false && artifact?.uri ? (
              <Pressable style={styles.actionButton} onPress={() => onOpen(artifact)}>
                <Text style={styles.actionButtonText}>{preview?.preview.openLabel ?? "Open in system"}</Text>
              </Pressable>
            ) : null}
          </View>
          </View>
        </View>
      </View>
    </Modal>
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
    <Modal animationType="slide" transparent visible={Boolean(request)} onRequestClose={() => request && onDeny(request)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
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
        </View>
      </View>
    </Modal>
  );
}

export function AgentRuntimeView({
  harness,
  voiceShell,
  artifactHandlers,
  capabilityHandlers,
  renderVoiceShell,
  runtimeOptions
}: AgentRuntimeViewProps) {
  return (
    <AgentRuntimeProvider harness={harness} options={runtimeOptions}>
      <AgentRuntimeContent
        voiceShell={voiceShell}
        artifactHandlers={artifactHandlers}
        capabilityHandlers={capabilityHandlers}
        renderVoiceShell={renderVoiceShell}
      />
    </AgentRuntimeProvider>
  );
}

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
  navBarSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F8FB"
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
  historyButtonText: {
    color: "#0A84FF",
    fontSize: 11,
    fontWeight: "700"
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
  historyScreen: {
    flex: 1,
    backgroundColor: "#F3F6FB"
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
    bottom: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10
  },
  shellStatusCluster: {
    alignItems: "center",
    gap: 6,
    maxWidth: 320
  },
  shellEchoCard: {
    maxWidth: 320,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(214, 224, 236, 0.84)",
    gap: 4
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
    lineHeight: 19
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.28)"
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
