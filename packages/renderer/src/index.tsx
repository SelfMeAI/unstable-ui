import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CoreBlock } from "@unstable-ui/core-blocks";
import type { HarnessAdapter } from "@unstable-ui/harness-sdk";
import type { ArtifactRef, CapabilityRequest } from "@unstable-ui/protocol";
import { AgentRuntimeProvider, useAgentRuntime } from "@unstable-ui/runtime";

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
  mockTranscripts?: string[];
}

export interface AgentRuntimeViewProps {
  harness: HarnessAdapter;
  voiceShell?: VoiceShellOptions;
}

function AgentRuntimeContent({ voiceShell }: { voiceShell?: VoiceShellOptions }) {
  const runtime = useAgentRuntime();
  const screen = runtime.screen;
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>();
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactRef | null>(null);
  const [artifactBridgeError, setArtifactBridgeError] = useState<string>();
  const [dismissedCapabilityIds, setDismissedCapabilityIds] = useState<string[]>([]);
  const shellEnabled = voiceShell?.enabled ?? true;
  const mockTranscripts = voiceShell?.mockTranscripts?.length ? voiceShell.mockTranscripts : defaultMockTranscripts;
  const statusLabel = isListening ? voiceShell?.listeningLabel ?? "Listening" : runtime.status;
  const promptLabel =
    voiceShell?.promptLabel ?? "Hold to talk. Voice input is mocked until the microphone bridge is implemented.";
  const idleLabel = voiceShell?.idleLabel ?? "Press and hold to talk";
  const activeCapabilityRequest = runtime.capabilityRequests.find(
    (request) => !dismissedCapabilityIds.includes(request.id)
  );

  function resolveArtifact(resource: ArtifactRef) {
    return runtime.artifacts.find((artifact) => artifact.id === resource.id) ?? resource;
  }

  function canOpenArtifact(resource: ArtifactRef) {
    return resource.openable !== false && Boolean(resource.uri);
  }

  async function openArtifact(resource: ArtifactRef) {
    if (!canOpenArtifact(resource)) {
      setArtifactBridgeError("This artifact cannot be opened yet.");
      return;
    }

    try {
      await Linking.openURL(resource.uri);
      setArtifactBridgeError(undefined);
    } catch (error) {
      setArtifactBridgeError(error instanceof Error ? error.message : "Failed to open the artifact.");
    }
  }

  async function handleArtifactRequest(resource: ArtifactRef, mode: "preview" | "open") {
    const artifact = resolveArtifact(resource);
    setArtifactBridgeError(undefined);

    if (mode === "preview") {
      setPreviewArtifact(artifact);
    } else {
      await openArtifact(artifact);
    }

    await runtime.sendClientEvent({
      type: "artifact.requested",
      artifactId: resource.id,
      mode
    });
  }

  async function resolveCapabilityRequest(request: CapabilityRequest, granted: boolean) {
    setDismissedCapabilityIds((value) => [...value, request.id]);

    await runtime.sendClientEvent({
      type: "capability.resolved",
      requestId: request.id,
      payload: {
        granted
      }
    });
  }

  async function handleVoiceCommit() {
    if (!shellEnabled || !isListening) {
      return;
    }

    setIsListening(false);

    const transcript = mockTranscripts[transcriptIndex % mockTranscripts.length];
    setTranscriptIndex((value) => value + 1);
    setLastTranscript(transcript);

    await runtime.sendClientEvent({
      type: "voice.input",
      transcript
    });
  }

  if (runtime.phase === "connecting") {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.statusText}>Connecting runtime...</Text>
        </View>
        <VoiceShell
          disabled
          isListening={false}
          statusLabel="connecting"
          promptLabel={promptLabel}
          actionLabel={idleLabel}
          lastTranscript={lastTranscript}
          onPressIn={() => undefined}
          onPressOut={() => undefined}
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
        <VoiceShell
          disabled
          isListening={false}
          statusLabel="error"
          promptLabel={promptLabel}
          actionLabel={idleLabel}
          lastTranscript={lastTranscript}
          onPressIn={() => undefined}
          onPressOut={() => undefined}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
          {screen?.title ? <Text style={styles.title}>{screen.title}</Text> : null}
          {screen?.subtitle ? <Text style={styles.subtitle}>{screen.subtitle}</Text> : null}
          {lastTranscript ? (
            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptLabel}>Last voice input</Text>
              <Text style={styles.transcriptText}>{lastTranscript}</Text>
            </View>
          ) : null}
          {artifactBridgeError ? (
            <View style={styles.inlineErrorCard}>
              <Text style={styles.inlineErrorTitle}>Artifact bridge</Text>
              <Text style={styles.inlineErrorText}>{artifactBridgeError}</Text>
            </View>
          ) : null}
        </View>
        {!screen ? (
          <View style={styles.emptyState}>
            <Text style={styles.statusText}>No screen available.</Text>
          </View>
        ) : (
          <View style={styles.blockStack}>
            {screen.blocks.map((block) => (
              <CoreBlock
                key={block.id}
                block={block}
                onAction={(action) =>
                  void runtime.sendClientEvent({
                    type: "action.triggered",
                    actionId: action.id,
                    payload: action.payload
                  })
                }
                onArtifact={(resource, mode) =>
                  void handleArtifactRequest(resource, mode)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
      <VoiceShell
        disabled={!shellEnabled}
        isListening={isListening}
        statusLabel={statusLabel}
        promptLabel={promptLabel}
        actionLabel={isListening ? voiceShell?.listeningLabel ?? "Release to send" : idleLabel}
        lastTranscript={lastTranscript}
        onPressIn={() => {
          if (!shellEnabled) {
            return;
          }

          setIsListening(true);
        }}
        onPressOut={() => {
          void handleVoiceCommit();
        }}
      />
      <ArtifactPreviewModal
        artifact={previewArtifact}
        onClose={() => setPreviewArtifact(null)}
        onOpen={(artifact) => {
          void openArtifact(artifact);
        }}
      />
      <CapabilityRequestModal
        request={activeCapabilityRequest ?? null}
        onApprove={(request) => {
          void resolveCapabilityRequest(request, true);
        }}
        onDeny={(request) => {
          void resolveCapabilityRequest(request, false);
        }}
      />
    </View>
  );
}

interface VoiceShellProps {
  disabled: boolean;
  isListening: boolean;
  statusLabel: string;
  promptLabel: string;
  actionLabel: string;
  lastTranscript?: string;
  onPressIn(): void;
  onPressOut(): void;
}

function VoiceShell({
  disabled,
  isListening,
  statusLabel,
  promptLabel,
  actionLabel,
  lastTranscript,
  onPressIn,
  onPressOut
}: VoiceShellProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.shellCopy}>
        <Text style={styles.shellStatus}>{statusLabel}</Text>
        <Text style={styles.shellPrompt}>{promptLabel}</Text>
        {lastTranscript ? <Text style={styles.shellTranscript}>Mock transcript: {lastTranscript}</Text> : null}
      </View>
      <Pressable
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.voiceButton, isListening ? styles.voiceButtonActive : null, disabled ? styles.voiceButtonDisabled : null]}
      >
        <Text style={styles.voiceButtonLabel}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

interface ArtifactPreviewModalProps {
  artifact: ArtifactRef | null;
  onClose(): void;
  onOpen(artifact: ArtifactRef): void;
}

function ArtifactPreviewModal({ artifact, onClose, onOpen }: ArtifactPreviewModalProps) {
  return (
    <Modal animationType="slide" transparent visible={Boolean(artifact)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>Artifact preview</Text>
          <Text style={styles.modalTitle}>{artifact?.title ?? artifact?.id ?? "Artifact"}</Text>
          <Text style={styles.modalMeta}>
            Kind: {artifact?.kind ?? "-"} · Source: {artifact?.source ?? "-"}
          </Text>
          {artifact?.mimeType ? <Text style={styles.modalMeta}>MIME: {artifact.mimeType}</Text> : null}
          {artifact?.uri ? (
            <View style={styles.modalPreviewSurface}>
              <Text style={styles.modalPreviewLabel}>URI</Text>
              <Text style={styles.modalPreviewText}>{artifact.uri}</Text>
            </View>
          ) : (
            <View style={styles.modalPreviewSurface}>
              <Text style={styles.modalPreviewLabel}>Preview</Text>
              <Text style={styles.modalPreviewText}>No inline preview data is available for this artifact yet.</Text>
            </View>
          )}
          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryActionButton} onPress={onClose}>
              <Text style={styles.secondaryActionText}>Close</Text>
            </Pressable>
            {artifact?.openable !== false && artifact?.uri ? (
              <Pressable style={styles.actionButton} onPress={() => onOpen(artifact)}>
                <Text style={styles.actionButtonText}>Open in system</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface CapabilityRequestModalProps {
  request: CapabilityRequest | null;
  onApprove(request: CapabilityRequest): void;
  onDeny(request: CapabilityRequest): void;
}

function CapabilityRequestModal({ request, onApprove, onDeny }: CapabilityRequestModalProps) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(request)} onRequestClose={() => request && onDeny(request)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.capabilityCard}>
          <Text style={styles.modalEyebrow}>Capability request</Text>
          <Text style={styles.modalTitle}>{request?.capability ?? "Device capability"}</Text>
          <Text style={styles.modalMeta}>
            The harness is asking the client runtime to resolve a device-level permission or system action.
          </Text>
          <View style={styles.modalPreviewSurface}>
            <Text style={styles.modalPreviewLabel}>Reason</Text>
            <Text style={styles.modalPreviewText}>{request?.reason ?? "No reason provided."}</Text>
          </View>
          <View style={styles.modalActions}>
            {request ? (
              <Pressable style={styles.secondaryActionButton} onPress={() => onDeny(request)}>
                <Text style={styles.secondaryActionText}>Not now</Text>
              </Pressable>
            ) : null}
            {request ? (
              <Pressable style={styles.actionButton} onPress={() => onApprove(request)}>
                <Text style={styles.actionButtonText}>Allow mock resolution</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AgentRuntimeView({ harness, voiceShell }: AgentRuntimeViewProps) {
  return (
    <AgentRuntimeProvider harness={harness}>
      <AgentRuntimeContent voiceShell={voiceShell} />
    </AgentRuntimeProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F4F6"
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 156
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6"
  },
  header: {
    gap: 4
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB"
  },
  statusBadgeText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15
  },
  blockStack: {
    gap: 16
  },
  emptyState: {
    paddingVertical: 32
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
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6
  },
  transcriptLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  transcriptText: {
    color: "#111827",
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
  shell: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 28,
    padding: 16,
    backgroundColor: "rgba(17, 24, 39, 0.96)",
    gap: 14
  },
  shellCopy: {
    gap: 6
  },
  shellStatus: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  shellPrompt: {
    color: "#F9FAFB",
    fontSize: 15,
    lineHeight: 22
  },
  shellTranscript: {
    color: "#D1D5DB",
    fontSize: 13,
    lineHeight: 20
  },
  voiceButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  voiceButtonActive: {
    backgroundColor: "#FB7185"
  },
  voiceButtonDisabled: {
    opacity: 0.45
  },
  voiceButtonLabel: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700"
  },
  actionButton: {
    backgroundColor: "#111827",
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
    backgroundColor: "rgba(17, 24, 39, 0.36)"
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFBF5",
    padding: 22,
    gap: 10
  },
  capabilityCard: {
    marginHorizontal: 16,
    borderRadius: 28,
    backgroundColor: "#FFFBF5",
    padding: 22,
    gap: 10
  },
  modalEyebrow: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modalTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700"
  },
  modalMeta: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20
  },
  modalPreviewSurface: {
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 8
  },
  modalPreviewLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modalPreviewText: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 21
  },
  modalActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12
  }
});
