import {
  Animated,
  StyleSheet,
  View
} from "react-native";
import {
  AgentRuntimeView,
  type ArtifactHandlers,
  type CapabilityHandlers,
  type VoiceShellOptions
} from "@selfme/unstable-ui-renderer";
import {
  applyScreenFlow as applyFlow,
  createCompletedScreenFlow as createCompletedFlow,
  createLocalHarness,
  createOngoingScreenFlow as createOngoingFlow,
  createProcessingScreen,
  createRemoteHttpSseHarness,
  createResultScreen,
  createRootScreenFlow as createRootFlow,
  createStableScreen,
  createTaskScreen,
  type LocalHarnessOptions,
  type RemoteSessionSnapshot,
  type RemoteSessionStore
} from "@selfme/unstable-ui-harness-sdk";
import {
  type ArtifactRef,
  type ScreenPatchOperation,
  type ScreenSchema
} from "@selfme/unstable-ui-protocol";
import type { RuntimePersistenceAdapter, RuntimeSnapshot } from "@selfme/unstable-ui-runtime";
import {
  DemoTransitionOverlay,
  useDemoScreenTransition
} from "./demo-transition";

const linkedArtifact: ArtifactRef = {
  id: "artifact-1",
  kind: "link",
  uri: "https://github.com/SelfMeAI/unstable-ui",
  source: "remote",
  title: "unstable-ui on GitHub",
  previewable: true,
  openable: true
};

const reportArtifact: ArtifactRef = {
  id: "report-1",
  kind: "html",
  uri: "https://selfme.ai/unstable-ui/",
  source: "remote",
  title: "Unstable UI report surface",
  mimeType: "text/html",
  previewable: true,
  openable: true
};

const pdfArtifact: ArtifactRef = {
  id: "pdf-1",
  kind: "pdf",
  uri: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  source: "remote",
  title: "Sample PDF artifact",
  mimeType: "application/pdf",
  previewable: true,
  openable: true
};

const demoArtifactHandlers: ArtifactHandlers = {
  link: {
    preview: (artifact) => ({
      title: artifact.title ?? "Linked artifact",
      description: "Custom preview handler registered by the host app for link artifacts.",
      fields: [
        { label: "Destination", value: artifact.uri },
        { label: "Source", value: artifact.source }
      ],
      openLabel: "Open link"
    })
  },
  html: {
    preview: (artifact) => ({
      title: artifact.title ?? "HTML artifact",
      description: "Custom preview handler registered by the host app for HTML surfaces.",
      fields: [
        { label: "Surface", value: artifact.uri },
        { label: "MIME", value: artifact.mimeType ?? "text/html" }
      ],
      openLabel: "Open report"
    })
  },
  pdf: {
    preview: (artifact) => ({
      title: artifact.title ?? "PDF artifact",
      description: "Custom preview handler registered by the host app for PDF artifacts.",
      fields: [
        { label: "Document", value: artifact.uri },
        { label: "MIME", value: artifact.mimeType ?? "application/pdf" }
      ],
      openLabel: "Open PDF"
    })
  }
};

const demoCapabilityHandlers: CapabilityHandlers = {
  microphone: {
    describe: () => ({
      title: "Microphone bridge",
      description: "Custom capability handler registered by the host app for microphone access.",
      reasonLabel: "Why the harness asked",
      primaryLabel: "Grant demo access",
      secondaryLabel: "Deny demo access",
      fields: [
        { label: "Bridge", value: "host-app mock capability handler" },
        { label: "Mode", value: "manual resolution with custom payload" }
      ]
    }),
    resolve: async (_request, granted) => ({
      payload: {
        bridge: "demo-capability-handler",
        capability: "microphone",
        resolvedBy: "host-app",
        resolutionMode: granted ? "granted" : "denied"
      }
    })
  }
};

const demoVoiceShell: VoiceShellOptions = {
  promptLabel: "Voice-first shell. Hold to simulate speech, or switch to text for direct harness requests.",
  idleLabel: "Hold to talk",
  listeningLabel: "Listening",
  textPlaceholder: "Type a request for the runtime",
  talkButtonLabel: "Speak",
  listeningButtonLabel: "Release",
  textSubmitLabel: "Send",
  recentInputHeadingLabel: "Recent",
  recentInputCollapsedLabel: "LAST",
  recentInputExpandedLabel: "HIDE",
  voiceModeChipLabel: "MIC",
  textModeChipLabel: "TYPE",
  recentInputMaxLines: 3
};

const demoRuntimeStore = globalThis as typeof globalThis & {
  __unstableUiDemoRuntimeSnapshot?: RuntimeSnapshot;
  __unstableUiDemoRemoteSession?: RemoteSessionSnapshot;
};

const demoRuntimePersistence: RuntimePersistenceAdapter = {
  load() {
    return demoRuntimeStore.__unstableUiDemoRuntimeSnapshot;
  },
  save(snapshot) {
    demoRuntimeStore.__unstableUiDemoRuntimeSnapshot = snapshot;
  },
  clear() {
    delete demoRuntimeStore.__unstableUiDemoRuntimeSnapshot;
  }
};

const demoRemoteSessionStore: RemoteSessionStore = {
  load() {
    return demoRuntimeStore.__unstableUiDemoRemoteSession;
  },
  save(snapshot) {
    demoRuntimeStore.__unstableUiDemoRemoteSession = snapshot;
  },
  clear() {
    delete demoRuntimeStore.__unstableUiDemoRemoteSession;
  }
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getDemoArtifact(artifactId: string) {
  switch (artifactId) {
    case pdfArtifact.id:
      return pdfArtifact;
    case reportArtifact.id:
      return reportArtifact;
    case linkedArtifact.id:
    default:
      return linkedArtifact;
  }
}

type InputFlowMode = "sequence" | "random";
type DemoEmit = Parameters<NonNullable<LocalHarnessOptions["bootstrap"]>>[0];

const inputFlowActions = [
  { id: "set-input-flow-sequence", label: "Sequential routing" },
  { id: "set-input-flow-random", label: "Random routing" }
] as const;

const everydayScenarioActions = [
  { id: "show-day-planner", label: "Daily planner" },
  { id: "show-grocery", label: "Grocery run" },
  { id: "show-trip", label: "Travel companion" },
  { id: "show-wellness", label: "Wellness check-in" }
] as const;

const workspaceScenarioActions = [
  { id: "show-flow-lab", label: "Flow lab" },
  { id: "show-verification", label: "Verification board" },
  { id: "show-playground", label: "Playground" },
  { id: "show-direct", label: "Direct result" },
  { id: "show-plan", label: "Staged plan" },
  { id: "show-timeline", label: "Task timeline" },
  { id: "show-brief", label: "Task brief" },
  { id: "show-workspace", label: "Grouped workspace" },
  { id: "show-split", label: "Split workspace" },
  { id: "show-form", label: "Intake form" },
  { id: "show-log", label: "Event log" },
  { id: "show-ops-board", label: "Ops board" }
] as const;

const systemScenarioActions = [
  { id: "preview-asset", label: "Link artifact" },
  { id: "show-report", label: "HTML report" },
  { id: "show-pdf", label: "PDF artifact" },
  { id: "request-microphone", label: "Microphone bridge" },
  { id: "request-open-url", label: "Open URL bridge" },
  { id: "request-share", label: "Share bridge" },
  { id: "simulate-error", label: "Harness error" }
] as const;

const quickTestActions = [
  { id: "show-flow-lab", label: "Open flow lab" },
  { id: "show-verification", label: "Open verification" },
  { id: "show-playground", label: "Open playground" },
  { id: "show-direct", label: "Test direct result" },
  { id: "show-plan", label: "Test staged plan" },
  { id: "show-timeline", label: "Test timeline" },
  { id: "show-workspace", label: "Test workspace" },
  { id: "show-form", label: "Test form" }
] as const;

const autoInputScenarioActions = [
  ...everydayScenarioActions,
  ...workspaceScenarioActions,
  { id: "preview-asset", label: "Link artifact" },
  { id: "show-report", label: "HTML report" },
  { id: "show-pdf", label: "PDF artifact" }
] as const;

const runtimeInspectActions = [
  { id: "show-verification", label: "Verify request flow" },
  { id: "show-playground", label: "Inspect runtime" },
  { id: "show-log", label: "Open event log" },
  { id: "back-home", label: "Back home" }
] as const;

const flowLabResultFollowUpActions = [
  { id: "show-playground", label: "Inspect runtime" },
  { id: "show-log", label: "Open event log" },
  { id: "show-flow-lab", label: "Back to flow lab" },
  { id: "back-home", label: "Back home" }
] as const;

type FlowLabVerificationStep = {
  id: string;
  title: string;
  description: string;
};

type FlowLabCaseDefinition = {
  id: string;
  title: string;
  summary: string;
  path: string;
  requestSource: string;
  lockExpectation: string;
  historyExpectation: string;
  inspectNote: string;
  verification: readonly FlowLabVerificationStep[];
  actions: readonly { id: string; label: string }[];
};

const flowLabRecommendedPass = [
  {
    id: "flow-lab-pass-direct",
    title: "Pass 1: direct flow",
    description: "Run the shortest lifecycle first and confirm one requestId survives processing -> result."
  },
  {
    id: "flow-lab-pass-task",
    title: "Pass 2: task flow",
    description: "Run a staged workspace flow and confirm input stays locked through processing and task screens."
  },
  {
    id: "flow-lab-pass-form",
    title: "Pass 3: form flow",
    description: "Submit structured fields and confirm the form row is attached to the same request chain."
  },
  {
    id: "flow-lab-pass-approval",
    title: "Pass 4: approval flow",
    description: "Trigger capability approval and confirm the result payload lands on the final result surface."
  },
  {
    id: "flow-lab-pass-shell",
    title: "Pass 5: shell routing",
    description: "Submit one voice request and one text request from the floating shell, then confirm request source changes accordingly."
  }
] as const;

const flowLabCaseDefinitions: readonly FlowLabCaseDefinition[] = [
  {
    id: "direct",
    title: "Direct flow",
    summary: "Shortest request lifecycle. Good first pass for request identity and completion cleanup.",
    path: "processing -> result",
    requestSource: "action or routed voice/text input",
    lockExpectation: "Input locked only during processing",
    historyExpectation: "One grouped request chain with one workspace handoff",
    inspectNote: "Current request summary should end at result",
    verification: [
      {
        id: "direct-check-request",
        title: "Confirm one request chain",
        description: "The same requestId should appear from input through the final result screen."
      },
      {
        id: "direct-check-lock",
        title: "Confirm short lock window",
        description: "Input should unlock as soon as the direct result is released."
      },
      {
        id: "direct-check-complete",
        title: "Confirm clean completion",
        description: "Runtime flow should settle to complete, then waiting, without intermediate task state."
      }
    ],
    actions: [{ id: "show-direct", label: "Run direct flow" }]
  },
  {
    id: "task",
    title: "Task flow",
    summary: "Baseline staged lifecycle with explicit task workspace before the final result surface.",
    path: "processing -> task -> finalizing -> result",
    requestSource: "action or routed voice/text input",
    lockExpectation: "Input locked during processing and task stages",
    historyExpectation: "One grouped request chain across all staged workspace screens",
    inspectNote: "Timeline variant should also show patched workspace updates inside the same request chain",
    verification: [
      {
        id: "task-check-stage",
        title: "Confirm staged screen progression",
        description: "You should see processing, task workspace, finalizing, then result in one uninterrupted chain."
      },
      {
        id: "task-check-lock",
        title: "Confirm long-running lock",
        description: "Input should stay locked through both task scaffolding and finalization."
      },
      {
        id: "task-check-history",
        title: "Confirm grouped history",
        description: "History and current request history should keep every staged workspace event under one request."
      }
    ],
    actions: [
      { id: "show-plan", label: "Run task flow" },
      { id: "show-timeline", label: "Run timeline flow" }
    ]
  },
  {
    id: "form",
    title: "Structured submission flow",
    summary: "Verifies that protocol-native form submission participates in the same request lifecycle model.",
    path: "form -> processing -> finalizing -> result",
    requestSource: "form submission",
    lockExpectation: "Form submit should attach one requestId to all follow-up stages",
    historyExpectation: "The form row and every follow-up workspace row should stay grouped",
    inspectNote: "Current request history should include the form submission row",
    verification: [
      {
        id: "form-check-submit",
        title: "Confirm form-origin request",
        description: "The active request should be sourced from form submission rather than generic action input."
      },
      {
        id: "form-check-history",
        title: "Confirm form row retention",
        description: "Current request history should keep the submitted values attached to the same request chain."
      },
      {
        id: "form-check-result",
        title: "Confirm structured echo",
        description: "The final result should reflect the submitted fields without losing request continuity."
      }
    ],
    actions: [{ id: "show-form", label: "Run form flow" }]
  },
  {
    id: "approval",
    title: "Approval flow",
    summary: "Capability requests pause the request chain until the host or user resolves the bridge decision.",
    path: "approval -> result",
    requestSource: "action-triggered capability request",
    lockExpectation: "Input should lock while capability choice is unresolved",
    historyExpectation: "Capability request and resolution should remain attached to one request chain",
    inspectNote: "Result should show payload returned by capability resolution",
    verification: [
      {
        id: "approval-check-lock",
        title: "Confirm approval lock",
        description: "The input shell should stay locked until the capability request is granted or denied."
      },
      {
        id: "approval-check-history",
        title: "Confirm capability grouping",
        description: "History should show the request, approval state, and result payload under the same requestId."
      },
      {
        id: "approval-check-payload",
        title: "Confirm payload landing",
        description: "The final result surface should show the capability payload returned by the host bridge."
      }
    ],
    actions: [{ id: "request-microphone", label: "Run approval flow" }]
  }
] as const;

const flowLabBridgeActions = [
  { id: "request-open-url", label: "Test open URL" },
  { id: "request-share", label: "Test share" },
  { id: "preview-asset", label: "Test artifact" },
  { id: "show-pdf", label: "Test download" },
  { id: "simulate-error", label: "Test error" },
  { id: "back-home", label: "Back home" }
] as const;

function getInputFlowModeLabel(mode: InputFlowMode) {
  return mode === "random" ? "Random" : "Sequential";
}

function getNextAutoScenarioPreviewLabel(mode: InputFlowMode, cursor: number) {
  if (mode === "random") {
    return `Random from ${autoInputScenarioActions.length} scenes`;
  }

  return autoInputScenarioActions[cursor % autoInputScenarioActions.length]?.label ?? "Scenario pool unavailable";
}

function createHomeScreen(
  modeDescription: string,
  inputFlowMode: InputFlowMode,
  nextSceneLabel: string
): ScreenSchema {
  return createStableScreen({
    id: "home",
    title: "unstable-ui",
    subtitle: "Use the bottom input shell to drive the workspace",
    blocks: [
      {
        id: "intro",
        type: "text",
        value: "The runtime is ready. Use the bottom voice shell or trigger one of the sample actions."
      },
      {
        id: "card-1",
        type: "card",
        title: "Current mode",
        body: modeDescription
      },
      {
        id: "quick-test-section",
        type: "section",
        title: "Quick test",
        description: "Use these first. They cover the main page flows directly from the home screen.",
        blocks: [
          {
            id: "quick-test-actions",
            type: "actions",
            items: [...quickTestActions]
          }
        ]
      },
      {
        id: "input-routing-section",
        type: "section",
        title: "Input routing",
        description: "Voice or text input can rotate through the existing scenario pool automatically.",
        blocks: [
          {
            id: "input-routing-details",
            type: "details",
            title: "Auto route status",
            items: [
              {
                id: "input-routing-mode",
                label: "Mode",
                value: getInputFlowModeLabel(inputFlowMode)
              },
              {
                id: "input-routing-next",
                label: "Next scene",
                value: nextSceneLabel,
                tone: "success"
              },
              {
                id: "input-routing-pool",
                label: "Pool",
                value: `${autoInputScenarioActions.length} routed scenes`
              }
            ]
          },
          {
            id: "input-routing-actions",
            type: "actions",
            items: [...inputFlowActions]
          }
        ]
      },
      {
        id: "everyday-scenarios-section",
        type: "section",
        title: "Everyday apps",
        description: "Lifestyle-style surfaces that should still feel like real mobile pages.",
        blocks: [
          {
            id: "everyday-scenarios-actions",
            type: "actions",
            items: [...everydayScenarioActions]
          }
        ]
      },
      {
        id: "workspace-scenarios-section",
        type: "section",
        title: "Work surfaces",
        description: "Common structured agent screens, workspace layouts, and runtime views.",
        blocks: [
          {
            id: "workspace-scenarios-actions",
            type: "actions",
            items: [...workspaceScenarioActions]
          }
        ]
      },
      {
        id: "system-scenarios-section",
        type: "section",
        title: "System flows",
        description: "Artifacts, bridge requests, and failure states for runtime validation.",
        blocks: [
          {
            id: "system-scenarios-actions",
            type: "actions",
            items: [...systemScenarioActions]
          }
        ]
      }
    ]
  });
}

function buildProcessingStageScreen(
  id: string,
  title: string,
  subtitle: string,
  message: string,
  requestId?: string
): ScreenSchema {
  return createProcessingScreen(
    {
      id,
      title,
      subtitle,
      blocks: [
        {
          id: `${id}-processing-text`,
          type: "text",
          value: message
        },
        {
          id: `${id}-processing-card`,
          type: "card",
          title: "Processing",
          body: "The harness is assembling the next workspace state."
        }
      ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is processing the current request."
    },
    createOngoingFlow(requestId)
  );
}

function buildFlowLabScreen(): ScreenSchema {
  const standardFlowBlocks = flowLabCaseDefinitions.flatMap((flowCase) => [
    {
      id: `flow-lab-${flowCase.id}-details`,
      type: "details" as const,
      title: flowCase.title,
      description: flowCase.summary,
      items: [
        { id: `flow-lab-${flowCase.id}-path`, label: "Path", value: flowCase.path },
        { id: `flow-lab-${flowCase.id}-source`, label: "Request source", value: flowCase.requestSource },
        { id: `flow-lab-${flowCase.id}-lock`, label: "Lock expectation", value: flowCase.lockExpectation },
        { id: `flow-lab-${flowCase.id}-history`, label: "History expectation", value: flowCase.historyExpectation },
        { id: `flow-lab-${flowCase.id}-inspect`, label: "Inspect", value: flowCase.inspectNote }
      ]
    },
    {
      id: `flow-lab-${flowCase.id}-checklist`,
      type: "list" as const,
      items: [...flowCase.verification]
    },
    {
      id: `flow-lab-${flowCase.id}-actions`,
      type: "actions" as const,
      items: [...flowCase.actions]
    }
  ]);

  return createStableScreen({
    id: "flow-lab",
    title: "Flow lab",
    subtitle: "Manual test entry for standard runtime flows",
    blocks: [
      {
        id: "flow-lab-intro",
        type: "text",
        value: "Use this page to trigger the framework's baseline request flows without hunting through the home screen."
      },
      {
        id: "flow-lab-rules",
        type: "section",
        title: "Verification rules",
        description: "These checks should hold across every baseline flow.",
        blocks: [
          {
            id: "flow-lab-rules-details",
            type: "details",
            items: [
              { id: "flow-lab-rule-request", label: "Request identity", value: "One requestId should carry the whole flow" },
              { id: "flow-lab-rule-locks", label: "Input locks", value: "Processing and task stages should lock input" },
              { id: "flow-lab-rule-history", label: "History grouping", value: "History should group the chain by request" },
              { id: "flow-lab-rule-debug", label: "Debug surface", value: "Inspect Verification board or Runtime playground after each result" }
            ]
          },
          {
            id: "flow-lab-rules-list",
            type: "list",
            items: [
              { id: "flow-lab-step-1", title: "Run one baseline flow", description: "Use the sections below instead of hopping between unrelated demo pages." },
              { id: "flow-lab-step-2", title: "Open verification board", description: "Check current or last completed request summary before falling back to raw logs." },
              { id: "flow-lab-step-3", title: "Open event log if needed", description: "Use it only when you need transport order and low-level status transitions." }
            ]
          }
        ]
      },
      {
        id: "flow-lab-recommended-pass",
        type: "section",
        title: "Recommended pass",
        description: "Use this order when validating the baseline runtime behavior end to end.",
        blocks: [
          {
            id: "flow-lab-recommended-pass-list",
            type: "list",
            items: [...flowLabRecommendedPass]
          }
        ]
      },
      {
        id: "flow-lab-standard-flows",
        type: "section",
        title: "Standard flows",
        description: "These are the main runtime lifecycle baselines.",
        blocks: standardFlowBlocks
      },
      {
        id: "flow-lab-metrics-section",
        type: "section",
        title: "Metric hints",
        description: "Use the runtime counters to quickly judge whether a request behaved as expected.",
        blocks: [
          {
            id: "flow-lab-metrics-details",
            type: "details",
            items: [
              { id: "flow-lab-metric-direct", label: "Direct flow", value: "Patch events should stay at 0" },
              { id: "flow-lab-metric-timeline", label: "Timeline flow", value: "Patch events should be greater than 0" },
              { id: "flow-lab-metric-task", label: "Task flows", value: "Workspace events should be greater than 1" },
              { id: "flow-lab-metric-approval", label: "Approval flow", value: "Resource events should include at least one capability event" },
              { id: "flow-lab-metric-form", label: "Form flow", value: "Source should resolve to form and history should keep one grouped chain" }
            ]
          }
        ]
      },
      {
        id: "flow-lab-shell-section",
        type: "section",
        title: "Shell route checks",
        description: "Baseline flow buttons validate screen lifecycles. The floating shell validates the voice-first request path.",
        blocks: [
          {
            id: "flow-lab-shell-details",
            type: "details",
            items: [
              {
                id: "flow-lab-shell-source",
                label: "Expected source",
                value: "voice for hold-to-talk, input for typed submit"
              },
              {
                id: "flow-lab-shell-routing",
                label: "Routing",
                value: "Shell submissions should open one routed scene from the existing scenario pool"
              },
              {
                id: "flow-lab-shell-inspect",
                label: "Inspect",
                value: "Check runtime.currentRequest and runtime.currentRequestHistory immediately after each submit"
              }
            ]
          },
          {
            id: "flow-lab-shell-list",
            type: "list",
            items: [
              {
                id: "flow-lab-shell-step-1",
                title: "Run one voice request",
                description: "Hold the floating voice button, release, and inspect that the runtime source resolves to voice."
              },
              {
                id: "flow-lab-shell-step-2",
                title: "Run one text request",
                description: "Switch to text mode, submit a short request, and confirm the runtime source resolves to input."
              },
              {
                id: "flow-lab-shell-step-3",
                title: "Confirm request continuity",
                description: "Each shell submission should still produce one grouped request chain in history and the current request log."
              }
            ]
          }
        ]
      },
      {
        id: "flow-lab-debug-section",
        type: "section",
        title: "Debug surfaces",
        description: "Use these after running any baseline flow.",
        blocks: [
          {
            id: "flow-lab-debug-actions",
            type: "actions",
            items: [
              { id: "show-verification", label: "Open verification" },
              { id: "show-playground", label: "Open playground" },
              { id: "show-log", label: "Open event log" },
              { id: "show-workspace", label: "Open workspace" }
            ]
          }
        ]
      },
      {
        id: "flow-lab-bridge-section",
        type: "section",
        title: "Bridge checks",
        description: "Use these to validate bridge behavior outside the baseline flow set.",
        blocks: [
          {
            id: "flow-lab-bridge-actions",
            type: "actions",
            items: [...flowLabBridgeActions]
          }
        ]
      }
    ]
  });
}

function buildRuntimePlaygroundScreen(): ScreenSchema {
  return createStableScreen({
    id: "runtime-playground",
    title: "Runtime playground",
    subtitle: "Debug surface for flow, history, events, and bridge behavior",
    blocks: [
      {
        id: "playground-session-details",
        type: "details",
        title: "Runtime session",
        description: "Resolved directly from runtime.session.",
        source: "runtime.session"
      },
      {
        id: "playground-flow-details",
        type: "details",
        title: "Request flow",
        description: "Resolved directly from runtime.flow.",
        source: "runtime.flow"
      },
      {
        id: "playground-current-request-details",
        type: "details",
        title: "Current request summary",
        description: "Resolved from the active request-aware runtime state.",
        source: "runtime.currentRequest"
      },
      {
        id: "playground-last-completed-request-details",
        type: "details",
        title: "Last completed request",
        description: "Resolved from runtime.flow.lastCompletedRequestId and the persisted history chain.",
        source: "runtime.lastCompletedRequest"
      },
      {
        id: "playground-interaction-details",
        type: "details",
        title: "Interaction locks",
        description: "Resolved directly from runtime.interaction.",
        source: "runtime.interaction"
      },
      {
        id: "playground-actions",
        type: "actions",
        items: [
          { id: "show-flow-lab", label: "Open flow lab" },
          { id: "show-log", label: "Open event log" },
          { id: "show-workspace", label: "Open workspace" },
          { id: "back-home", label: "Back home" }
        ]
      },
      {
        id: "playground-history-section",
        type: "section",
        title: "Session history",
        description: "Rendered directly from runtime.history inside the dynamic screen.",
        blocks: [
          {
            id: "playground-history-log",
            type: "log",
            title: "History stream",
            source: "runtime.history",
            maxItems: 10,
            emptyLabel: "No history entries recorded yet."
          }
        ]
      },
      {
        id: "playground-current-request-section",
        type: "section",
        title: "Current request chain",
        description: "Shows only the history entries attached to the active runtime.flow.requestId.",
        blocks: [
          {
            id: "playground-current-request-log",
            type: "log",
            title: "Current request history",
            source: "runtime.currentRequestHistory",
            maxItems: 8,
            emptyLabel: "No active request chain is attached right now."
          }
        ]
      },
      {
        id: "playground-events-section",
        type: "section",
        title: "Runtime events",
        description: "Rendered directly from runtime.eventLog for transport-level inspection.",
        blocks: [
          {
            id: "playground-event-log",
            type: "log",
            title: "Event stream",
            source: "runtime.eventLog",
            maxItems: 10,
            emptyLabel: "No event log entries recorded yet."
          }
        ]
      },
      {
        id: "playground-last-completed-request-section",
        type: "section",
        title: "Last completed request chain",
        description: "Shows the latest fully completed request chain even after the runtime has returned to waiting.",
        blocks: [
          {
            id: "playground-last-completed-request-log",
            type: "log",
            title: "Last completed request history",
            source: "runtime.lastCompletedRequestHistory",
            maxItems: 8,
            emptyLabel: "No completed request chain has been recorded yet."
          }
        ]
      },
      {
        id: "playground-resources-section",
        type: "section",
        title: "Bridge resources",
        description: "Use these blocks to validate preview, open, share, and download behavior.",
        blocks: [
          { id: "playground-resource-link", type: "resource", resource: linkedArtifact },
          { id: "playground-resource-report", type: "resource", resource: reportArtifact },
          { id: "playground-resource-pdf", type: "resource", resource: pdfArtifact }
        ]
      }
    ]
  });
}

function buildVerificationBoardScreen(): ScreenSchema {
  return createStableScreen({
    id: "verification-board",
    title: "Verification board",
    subtitle: "Fast request-flow validation surface",
    blocks: [
      {
        id: "verification-intro",
        type: "text",
        value:
          "Use this surface after any voice, text, action, form, or approval flow. It is meant to answer whether the request chain behaved correctly without reading the entire event stream."
      },
      {
        id: "verification-rules-section",
        type: "section",
        title: "What to verify",
        blocks: [
          {
            id: "verification-rules-details",
            type: "details",
            items: [
              { id: "verification-rule-1", label: "Identity", value: "One requestId should represent one full flow" },
              { id: "verification-rule-2", label: "Locking", value: "Processing and task phases should temporarily lock input" },
              { id: "verification-rule-3", label: "Completion", value: "Completed flows should remain inspectable through last completed request" }
            ]
          }
        ]
      },
      {
        id: "verification-flow-details",
        type: "details",
        title: "Runtime flow",
        description: "Current request pointer and last completed request pointer.",
        source: "runtime.flow"
      },
      {
        id: "verification-current-request-verdict",
        type: "details",
        title: "Current request verdict",
        description: "Top-level evaluation for the active request chain.",
        source: "runtime.currentRequestVerdict"
      },
      {
        id: "verification-last-request-verdict",
        type: "details",
        title: "Completed request verdict",
        description: "Top-level evaluation for the most recent completed request chain.",
        source: "runtime.lastCompletedRequestVerdict"
      },
      {
        id: "verification-metric-guide",
        type: "section",
        title: "Metric guide",
        description: "Interpret the runtime counters before you drill into the raw request logs.",
        blocks: [
          {
            id: "verification-metric-guide-details",
            type: "details",
            items: [
              { id: "verification-metric-events", label: "Request events", value: "Counts every history entry attached to the active request" },
              { id: "verification-metric-workspace", label: "Workspace events", value: "Should rise when the harness updates or patches the screen" },
              { id: "verification-metric-patches", label: "Patch events", value: "Only increments for screen.patched and should stay 0 for direct flows" },
              { id: "verification-metric-resources", label: "Resource events", value: "Captures artifacts and capability request/resolve activity" },
              { id: "verification-metric-issues", label: "Issues", value: "Any non-zero issue count means the chain needs review" }
            ]
          }
        ]
      },
      {
        id: "verification-current-request-details",
        type: "details",
        title: "Current request chain",
        description: "If a flow is still active, inspect it here first.",
        source: "runtime.currentRequest"
      },
      {
        id: "verification-current-request-assertions",
        type: "details",
        title: "Current request assertions",
        description: "High-level checks derived from the active request chain.",
        source: "runtime.currentRequestAssertions"
      },
      {
        id: "verification-current-request-matrix",
        type: "details",
        title: "Current request matrix",
        description: "Profile-specific pass/fail checks for the active request chain.",
        source: "runtime.currentRequestMatrix"
      },
      {
        id: "verification-last-request-details",
        type: "details",
        title: "Last completed request chain",
        description: "If the runtime already returned to waiting, inspect the last completed chain here.",
        source: "runtime.lastCompletedRequest"
      },
      {
        id: "verification-last-request-assertions",
        type: "details",
        title: "Completed request assertions",
        description: "High-level checks derived from the most recent completed request chain.",
        source: "runtime.lastCompletedRequestAssertions"
      },
      {
        id: "verification-last-request-matrix",
        type: "details",
        title: "Completed request matrix",
        description: "Profile-specific pass/fail checks for the most recent completed chain.",
        source: "runtime.lastCompletedRequestMatrix"
      },
      {
        id: "verification-lock-details",
        type: "details",
        title: "Interaction locks",
        description: "Use this to confirm shell and form locking behavior.",
        source: "runtime.interaction"
      },
      {
        id: "verification-request-logs",
        type: "section",
        title: "Request logs",
        description: "Compare active and completed chains without opening the full session history.",
        blocks: [
          {
            id: "verification-current-request-log",
            type: "log",
            title: "Current request history",
            source: "runtime.currentRequestHistory",
            maxItems: 6,
            emptyLabel: "No active request chain."
          },
          {
            id: "verification-last-request-log",
            type: "log",
            title: "Last completed request history",
            source: "runtime.lastCompletedRequestHistory",
            maxItems: 6,
            emptyLabel: "No completed request chain yet."
          }
        ]
      },
      {
        id: "verification-actions",
        type: "actions",
        items: [
          { id: "show-flow-lab", label: "Open flow lab" },
          { id: "show-playground", label: "Open playground" },
          { id: "show-log", label: "Open event log" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function buildPlanScaffoldScreen(requestId?: string): ScreenSchema {
  return createTaskScreen(
    {
      id: "plan",
      title: "Generated task plan",
      subtitle: "Task workspace is taking shape",
      blocks: [
        {
          id: "plan-intro",
          type: "text",
          value: "The harness has moved past the processing shell and is now building a task workspace."
        },
        {
          id: "plan-status",
          type: "card",
          title: "Task stage",
          body: "Collecting steps and preparing follow-up actions."
        }
      ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is still building the task plan."
    },
    createOngoingFlow(requestId)
  );
}

function buildDirectResultScreen(): ScreenSchema {
  return createResultScreen({
    id: "direct-result",
    title: "Direct result surface",
    subtitle: "Result returned without an intermediate task workspace",
    blocks: [
      {
        id: "direct-result-intro",
        type: "text",
        value: "The harness resolved this request without opening a task screen. This is the shortest standard page flow."
      },
      {
        id: "direct-result-details",
        type: "details",
        title: "Flow summary",
        items: [
          { id: "direct-result-stage-1", label: "Request path", value: "processing -> result" },
          { id: "direct-result-stage-2", label: "Workspace", value: "Skipped intermediate task page" },
          { id: "direct-result-stage-3", label: "State", value: "Ready for next input", tone: "success" }
        ]
      },
      {
        id: "direct-result-actions",
        type: "actions",
        items: [
          { id: "show-plan", label: "Run staged plan" },
          { id: "show-timeline", label: "Run timeline" },
          ...flowLabResultFollowUpActions
        ]
      }
    ]
  });
}

function buildPlanSettlingScreen(requestId?: string): ScreenSchema {
  return createTaskScreen(
    {
      id: "plan-finalizing",
      title: "Generated task plan",
      subtitle: "Finalizing workspace",
      blocks: [
        {
          id: "plan-finalizing-text",
          type: "text",
          value: "The harness has assembled the plan and is now locking the final result surface."
        },
        {
          id: "plan-finalizing-card",
          type: "card",
          title: "Finalizing",
          body: "Committing the last workspace blocks before the result surface is released."
        }
      ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is finalizing the task plan."
    },
    createOngoingFlow(requestId)
  );
}

function buildPlanResultScreen(): ScreenSchema {
  return createResultScreen({
    id: "plan-result",
    title: "Generated task plan",
    subtitle: "Result surface returned by the local harness",
    blocks: [
      {
        id: "plan-intro",
        type: "text",
        value: "The harness has moved past the processing shell and is now building a task workspace."
      },
      {
        id: "plan-status",
        type: "card",
        title: "Result stage",
        body: "The harness incrementally patched the workspace into a final result surface."
      },
      {
        id: "list-1",
        type: "list",
        items: [
          { id: "a", title: "Capture voice input", description: "Hold-to-talk shell entry point." },
          { id: "b", title: "Stream harness events", description: "Drive UI from protocol events." },
          { id: "c", title: "Render blocks", description: "Translate schema into native components." },
          { id: "d", title: "Bridge artifacts", description: "Return preview/open resources without breaking transport boundaries." }
        ]
      },
      {
        id: "actions-2",
        type: "actions",
        items: [
          { id: "show-report", label: "Show report" },
          { id: "preview-asset", label: "Preview artifact" },
          ...flowLabResultFollowUpActions
        ]
      }
    ]
  });
}

function buildTimelineIntroScreen(requestId?: string): ScreenSchema {
  return createTaskScreen(
    {
      id: "task-timeline",
      title: "Task timeline",
      subtitle: "Task workspace is streaming step progression",
      blocks: [
        {
          id: "timeline-intro",
          type: "text",
          value: "The harness is publishing a constrained task timeline instead of a free-form text dump."
        },
        {
          id: "timeline-block",
          type: "timeline",
          title: "Execution flow",
          description: "This block is suited for agent work that moves through clear stages.",
          items: [
            {
              id: "timeline-step-capture",
              title: "Capture intent",
              description: "Voice or form input has been normalized into structured task context.",
              status: "complete",
              meta: "done"
            },
            {
              id: "timeline-step-plan",
              title: "Build plan",
              description: "The harness is decomposing the request into executable workspace steps.",
              status: "active",
              meta: "in progress"
            },
            {
              id: "timeline-step-artifacts",
              title: "Prepare artifacts",
              description: "Attach report surfaces and related resources once the plan stabilizes.",
              status: "pending",
              meta: "queued"
            }
          ]
        }
      ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is still streaming task progression."
    },
    createOngoingFlow(requestId)
  );
}

function createLockedTimelineInteraction(reason: string) {
  return {
    input: "locked",
    actions: "locked",
    forms: "locked",
    artifacts: "enabled",
    history: "enabled",
    reason
  } as const;
}

function buildTimelineStreamingPatchOperations(): ScreenPatchOperation[] {
  return [
    {
      type: "set_subtitle",
      subtitle: "Task workspace is receiving incremental timeline patches"
    },
    {
      type: "upsert_block",
      block: {
        id: "timeline-block",
        type: "timeline",
        title: "Execution flow",
        description: "The harness is patching the active task workspace instead of replacing the full screen.",
        items: [
          {
            id: "timeline-step-capture",
            title: "Capture intent",
            description: "Voice or form input has been normalized into structured task context.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-plan",
            title: "Build plan",
            description: "The harness has locked the execution shape and advanced to the patch stage.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-artifacts",
            title: "Prepare artifacts",
            description: "Resource links and follow-up surfaces are being attached through incremental updates.",
            status: "active",
            meta: "patching"
          },
          {
            id: "timeline-step-verify",
            title: "Verify request chain",
            description: "Runtime history should now show multiple workspace updates for the same request.",
            status: "pending",
            meta: "queued"
          }
        ]
      }
    },
    {
      type: "append_blocks",
      blocks: [
        {
          id: "timeline-patch-details",
          type: "details",
          title: "Patch checkpoint",
          items: [
            {
              id: "timeline-patch-mode",
              label: "Update mode",
              value: "screen.patched"
            },
            {
              id: "timeline-patch-scope",
              label: "Scope",
              value: "Subtitle, timeline block, and diagnostics"
            },
            {
              id: "timeline-patch-request",
              label: "Expectation",
              value: "Same requestId should survive the full patched chain"
            }
          ]
        }
      ]
    }
  ];
}

function buildTimelineFinalizingPatchOperations(): ScreenPatchOperation[] {
  return [
    {
      type: "set_subtitle",
      subtitle: "Finalizing patched timeline surface"
    },
    {
      type: "set_interaction",
      interaction: createLockedTimelineInteraction("The harness is finalizing the patched task timeline.")
    },
    {
      type: "upsert_block",
      block: {
        id: "timeline-block",
        type: "timeline",
        title: "Execution flow",
        description: "The active task workspace has been patched twice and is now being sealed for release.",
        items: [
          {
            id: "timeline-step-capture",
            title: "Capture intent",
            description: "Voice or form input has been normalized into structured task context.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-plan",
            title: "Build plan",
            description: "The task shape is fixed and no longer changing.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-artifacts",
            title: "Prepare artifacts",
            description: "Artifact attachment has been stabilized and is ready for result release.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-verify",
            title: "Verify request chain",
            description: "Diagnostics are pinned so the result screen can be released next.",
            status: "active",
            meta: "finalizing"
          }
        ]
      }
    },
    {
      type: "upsert_block",
      block: {
        id: "timeline-finalizing-card",
        type: "card",
        title: "Finalizing",
        body: "The harness is sealing the patched workspace before releasing the final result screen."
      }
    }
  ];
}

function buildTimelineResultScreen(): ScreenSchema {
  return createResultScreen({
    id: "timeline-result",
    title: "Task timeline",
    subtitle: "Result surface returned with incremental timeline updates",
    blocks: [
      {
        id: "timeline-intro",
        type: "text",
        value: "The harness is publishing a constrained task timeline instead of a free-form text dump."
      },
      {
        id: "timeline-block",
        type: "timeline",
        title: "Execution flow",
        description: "The harness advanced this request through task-state patches before releasing the final result.",
        items: [
          {
            id: "timeline-step-capture",
            title: "Capture intent",
            description: "Voice or form input has been normalized into structured task context.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-plan",
            title: "Build plan",
            description: "The harness decomposed the request into actionable workspace stages.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-artifacts",
            title: "Prepare artifacts",
            description: "Report surfaces and resource links were attached during the patched task phase.",
            status: "complete",
            meta: "done"
          },
          {
            id: "timeline-step-verify",
            title: "Verify request chain",
            description: "Runtime diagnostics should show one requestId with multiple workspace patch events.",
            status: "complete",
            meta: "done"
          }
        ]
      },
      {
        id: "timeline-result-details",
        type: "details",
        title: "Patch summary",
        items: [
          { id: "timeline-result-path", label: "Path", value: "processing -> task.updated -> task.patched -> result" },
          { id: "timeline-result-request", label: "Request continuity", value: "One requestId across screen.updated and screen.patched events" },
          { id: "timeline-result-debug", label: "Best check", value: "Open Verification board or Runtime playground" }
        ]
      },
      {
        id: "timeline-actions",
        type: "actions",
        items: [
          { id: "show-report", label: "Show report" },
          { id: "preview-asset", label: "Preview artifact" },
          ...flowLabResultFollowUpActions
        ]
      }
    ]
  });
}

function buildTaskBriefScreen(): ScreenSchema {
  return createResultScreen({
    id: "task-brief",
    title: "Task brief",
    subtitle: "Structured summary block",
    blocks: [
      {
        id: "task-brief-intro",
        type: "text",
        value: "This view is designed for compact agent summaries, status readouts, and result metadata."
      },
      {
        id: "task-brief-details",
        type: "details",
        title: "Workspace snapshot",
        description: "A compact key-value block is often easier to scan than a free-form paragraph.",
        items: [
          {
            id: "brief-owner",
            label: "Owner",
            value: "runtime"
          },
          {
            id: "brief-track",
            label: "Track",
            value: "react-native"
          },
          {
            id: "brief-status",
            label: "Status",
            value: "staged demo flow is ready",
            tone: "success"
          },
          {
            id: "brief-transport",
            label: "Transport",
            value: "local harness or remote HTTP + SSE"
          }
        ]
      },
      {
        id: "task-brief-actions",
        type: "actions",
        items: [
          { id: "show-timeline", label: "Open timeline" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function buildDayPlannerScreen(): ScreenSchema {
  return createResultScreen({
    id: "day-planner",
    title: "Daily planner",
    subtitle: "Lifestyle schedule surface",
    blocks: [
      {
        id: "day-planner-overview",
        type: "details",
        title: "Today",
        items: [
          { id: "day-planner-focus", label: "Focus", value: "Deep work and recovery" },
          { id: "day-planner-time", label: "Free window", value: "3h 30m" },
          { id: "day-planner-energy", label: "Energy", value: "Stable", tone: "success" }
        ]
      },
      {
        id: "day-planner-timeline",
        type: "timeline",
        title: "Schedule",
        items: [
          {
            id: "day-planner-step-1",
            title: "Morning planning",
            description: "Review priorities, clear quick messages, and lock the first focus block.",
            status: "complete",
            meta: "08:30"
          },
          {
            id: "day-planner-step-2",
            title: "Deep work block",
            description: "Two uninterrupted tasks with one review checkpoint in the middle.",
            status: "active",
            meta: "10:00"
          },
          {
            id: "day-planner-step-3",
            title: "Gym + reset",
            description: "Leave buffer before the evening admin pass.",
            status: "pending",
            meta: "18:30"
          }
        ]
      },
      {
        id: "day-planner-actions",
        type: "actions",
        items: [
          { id: "show-wellness", label: "Open wellness" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function buildGroceryRunScreen(): ScreenSchema {
  return createResultScreen({
    id: "grocery-run",
    title: "Grocery run",
    subtitle: "Everyday errand planner",
    blocks: [
      {
        id: "grocery-summary",
        type: "section",
        title: "Trip summary",
        description: "A simple household errand page rendered through the same schema runtime.",
        blocks: [
          {
            id: "grocery-details",
            type: "details",
            items: [
              { id: "grocery-budget", label: "Budget", value: "¥280" },
              { id: "grocery-store", label: "Primary store", value: "CitySuper" },
              { id: "grocery-status", label: "Status", value: "Ready to shop", tone: "success" }
            ]
          },
          {
            id: "grocery-actions",
            type: "actions",
            items: [
              { id: "show-trip", label: "Open travel" },
              { id: "back-home", label: "Back home" }
            ]
          }
        ]
      },
      {
        id: "grocery-list",
        type: "list",
        items: [
          { id: "grocery-item-1", title: "Salmon fillet", description: "Protein for two dinners." },
          { id: "grocery-item-2", title: "Greek yogurt", description: "Breakfast stock for the week." },
          { id: "grocery-item-3", title: "Spinach + berries", description: "Smoothie and salad overlap." },
          { id: "grocery-item-4", title: "Sparkling water", description: "Case price looks best today." }
        ]
      }
    ]
  });
}

function buildTravelCompanionScreen(): ScreenSchema {
  return createResultScreen({
    id: "travel-companion",
    title: "Travel companion",
    subtitle: "Trip-day support surface",
    blocks: [
      {
        id: "travel-split",
        type: "split",
        title: "Trip overview",
        description: "The app can still feel like a normal travel product while being generated by the harness.",
        ratio: "primary",
        panes: [
          {
            id: "travel-primary",
            title: "Itinerary",
            blocks: [
              {
                id: "travel-itinerary",
                type: "timeline",
                title: "Today in Shanghai",
                items: [
                  {
                    id: "travel-step-1",
                    title: "Airport transfer",
                    description: "Leave with a 20-minute traffic buffer.",
                    status: "complete",
                    meta: "09:00"
                  },
                  {
                    id: "travel-step-2",
                    title: "Hotel check-in",
                    description: "Drop luggage and move the first meeting earlier if possible.",
                    status: "active",
                    meta: "12:30"
                  },
                  {
                    id: "travel-step-3",
                    title: "Dinner booking",
                    description: "Walk-in backup is already prepared in the notes.",
                    status: "pending",
                    meta: "19:00"
                  }
                ]
              }
            ]
          },
          {
            id: "travel-secondary",
            title: "Travel notes",
            blocks: [
              {
                id: "travel-notes",
                type: "details",
                items: [
                  { id: "travel-gate", label: "Gate", value: "T2 / 14" },
                  { id: "travel-luggage", label: "Luggage", value: "Carry-on only" },
                  { id: "travel-weather", label: "Weather", value: "31C, light rain" }
                ]
              },
              {
                id: "travel-actions",
                type: "actions",
                items: [
                  { id: "show-report", label: "Open report" },
                  { id: "back-home", label: "Back home" }
                ]
              }
            ]
          }
        ]
      }
    ]
  });
}

function buildWellnessCheckInScreen(): ScreenSchema {
  return createResultScreen({
    id: "wellness-check-in",
    title: "Wellness check-in",
    subtitle: "Daily recovery and habit surface",
    blocks: [
      {
        id: "wellness-card",
        type: "card",
        title: "Recovery score",
        body: "Sleep, hydration, and strain are stable enough for one hard block and one lighter block."
      },
      {
        id: "wellness-details",
        type: "details",
        title: "Vitals",
        items: [
          { id: "wellness-sleep", label: "Sleep", value: "7h 42m", tone: "success" },
          { id: "wellness-water", label: "Hydration", value: "1.8L" },
          { id: "wellness-strain", label: "Strain", value: "Moderate", tone: "warning" }
        ]
      },
      {
        id: "wellness-actions",
        type: "actions",
        items: [
          { id: "show-day-planner", label: "Open daily planner" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function buildOpsBoardScreen(): ScreenSchema {
  return createStableScreen({
    id: "ops-board",
    title: "Ops board",
    subtitle: "Common business workspace",
    blocks: [
      {
        id: "ops-summary-section",
        type: "section",
        title: "Service health",
        description: "A conventional operational console surface generated from block schema.",
        blocks: [
          {
            id: "ops-summary-details",
            type: "details",
            items: [
              { id: "ops-region", label: "Region", value: "ap-east-1" },
              { id: "ops-incidents", label: "Open incidents", value: "2", tone: "warning" },
              { id: "ops-status", label: "Deploy window", value: "Ready", tone: "success" }
            ]
          },
          {
            id: "ops-summary-actions",
            type: "actions",
            items: [
              { id: "show-log", label: "Open event log" },
              { id: "back-home", label: "Back home" }
            ]
          }
        ]
      },
      {
        id: "ops-queue-section",
        type: "section",
        title: "Approval queue",
        blocks: [
          {
            id: "ops-queue-list",
            type: "list",
            items: [
              { id: "ops-queue-1", title: "Scale worker pool", description: "Awaiting approval from on-call lead." },
              { id: "ops-queue-2", title: "Rotate API key", description: "Planned after the current traffic spike." },
              { id: "ops-queue-3", title: "Promote canary release", description: "Blocked on one dashboard regression." }
            ]
          }
        ]
      }
    ]
  });
}

function buildEventLogScreen(): ScreenSchema {
  return createStableScreen({
    id: "event-log",
    title: "Runtime event log",
    subtitle: "Resolved from the client runtime",
    blocks: [
      {
        id: "event-log-intro",
        type: "text",
        value: "This block reads directly from the runtime event log, so it reflects real client, harness, and runtime traffic."
      },
      {
        id: "event-log-block",
        type: "log",
        title: "Recent events",
        description: "Latest entries appear first.",
        source: "runtime.eventLog",
        maxItems: 24,
        emptyLabel: "No events have been recorded yet."
      },
      {
        id: "event-log-actions",
        type: "actions",
        items: [
          { id: "show-playground", label: "Inspect runtime" },
          { id: "show-timeline", label: "Open timeline" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function buildGroupedWorkspaceScreen(): ScreenSchema {
  return createStableScreen({
    id: "grouped-workspace",
    title: "Grouped workspace",
    subtitle: "Section-based task surface",
    blocks: [
      {
        id: "workspace-summary-section",
        type: "section",
        title: "Summary",
        description: "Compact task context and execution summary.",
        blocks: [
          {
            id: "workspace-summary-details",
            type: "details",
            title: "Task snapshot",
            items: [
              {
                id: "workspace-summary-owner",
                label: "Owner",
                value: "runtime"
              },
              {
                id: "workspace-summary-surface",
                label: "Surface",
                value: "react-native mobile workspace"
              },
              {
                id: "workspace-summary-status",
                label: "Status",
                value: "ready for next action",
                tone: "success"
              }
            ]
          },
          {
            id: "workspace-summary-actions",
            type: "actions",
            items: [
              { id: "show-plan", label: "Build plan" },
              { id: "show-timeline", label: "Open timeline" }
            ]
          }
        ]
      },
      {
        id: "workspace-activity-section",
        type: "section",
        title: "Activity",
        description: "This section mixes timeline and runtime log views in the same grouped workspace.",
        blocks: [
          {
            id: "workspace-activity-timeline",
            type: "timeline",
            title: "Recent flow",
            items: [
              {
                id: "workspace-activity-step-1",
                title: "Session connected",
                description: "The runtime connected and hydrated the session state.",
                status: "complete",
                meta: "done"
              },
              {
                id: "workspace-activity-step-2",
                title: "Workspace resolved",
                description: "The harness selected a section-based layout for the next screen.",
                status: "active",
                meta: "live"
              }
            ]
          },
          {
            id: "workspace-activity-log",
            type: "log",
            title: "Runtime events",
            source: "runtime.eventLog",
            maxItems: 8,
            emptyLabel: "No activity recorded yet."
          }
        ]
      },
      {
        id: "workspace-resources-section",
        type: "section",
        title: "Resources",
        description: "Artifacts remain protocol-native even inside grouped sections.",
        blocks: [
          {
            id: "workspace-resource-report",
            type: "resource",
            resource: reportArtifact
          },
          {
            id: "workspace-resource-link",
            type: "resource",
            resource: linkedArtifact
          }
        ]
      }
    ]
  });
}

function buildSplitWorkspaceScreen(): ScreenSchema {
  return createStableScreen({
    id: "split-workspace",
    title: "Split workspace",
    subtitle: "Primary and secondary panes",
    blocks: [
      {
        id: "split-root",
        type: "split",
        title: "Agent workspace",
        description: "The split container keeps primary task context separate from secondary activity and resources.",
        ratio: "primary",
        panes: [
          {
            id: "split-primary",
            title: "Primary pane",
            description: "Main task context and next actions.",
            blocks: [
              {
                id: "split-primary-summary",
                type: "section",
                title: "Task summary",
                blocks: [
                  {
                    id: "split-primary-details",
                    type: "details",
                    items: [
                      {
                        id: "split-primary-goal",
                        label: "Goal",
                        value: "Advance the runtime workspace surface"
                      },
                      {
                        id: "split-primary-state",
                        label: "State",
                        value: "ready for next iteration",
                        tone: "success"
                      }
                    ]
                  },
                  {
                    id: "split-primary-actions",
                    type: "actions",
                    items: [
                      { id: "show-plan", label: "Build plan" },
                      { id: "show-form", label: "Open intake form" }
                    ]
                  }
                ]
              },
              {
                id: "split-primary-timeline",
                type: "timeline",
                title: "Execution flow",
                items: [
                  {
                    id: "split-primary-step-1",
                    title: "Prepare workspace shell",
                    description: "The runtime assembled the pane structure for the task surface.",
                    status: "complete",
                    meta: "done"
                  },
                  {
                    id: "split-primary-step-2",
                    title: "Wait for user action",
                    description: "The primary pane is ready for the next command or input.",
                    status: "active",
                    meta: "live"
                  }
                ]
              }
            ]
          },
          {
            id: "split-secondary",
            title: "Secondary pane",
            description: "Activity trace and linked resources.",
            blocks: [
              {
                id: "split-secondary-log",
                type: "log",
                title: "Recent events",
                source: "runtime.eventLog",
                maxItems: 6
              },
              {
                id: "split-secondary-resource",
                type: "resource",
                resource: linkedArtifact
              }
            ]
          }
        ]
      }
    ]
  });
}

function buildFormScreen(): ScreenSchema {
  return createStableScreen({
    id: "intake-form",
    title: "Task intake form",
    subtitle: "Structured input block driven by the protocol",
    blocks: [
      {
        id: "task-intake-form",
        type: "form",
        title: "Plan a focused work block",
        description: "The harness can ask for structured details instead of relying only on voice transcripts.",
        submitLabel: "Submit intake",
        fields: [
          {
            id: "goal",
            kind: "text",
            label: "Primary goal",
            defaultValue: "Ship the next runtime milestone",
            placeholder: "Describe the primary goal",
            required: true
          },
          {
            id: "duration",
            kind: "text",
            label: "Available time",
            defaultValue: "90 minutes",
            placeholder: "Enter the available time",
            required: true
          },
          {
            id: "constraints",
            kind: "multiline",
            label: "Constraints",
            description: "Optional notes the harness should consider before building the next workspace.",
            defaultValue: "Need a quiet block, avoid meetings, include one review pass.",
            placeholder: "Add any extra constraints"
          }
        ]
      },
      {
        id: "intake-form-actions",
        type: "actions",
        items: [{ id: "back-home", label: "Back home" }]
      }
    ]
  });
}

function buildFormProcessingScreen(values: Record<string, string>, requestId?: string): ScreenSchema {
  return createProcessingScreen(
    {
      id: "form-processing",
      title: "Task intake form",
      subtitle: "Processing submitted fields",
      blocks: [
        {
          id: "form-processing-text",
          type: "text",
          value: "The harness is validating the submitted fields before building the next result surface."
        },
        {
          id: "form-processing-card",
          type: "card",
          title: values.goal || "Submitted goal",
          body: `Preparing the next step from ${values.duration || "the provided"} time window.`
        }
      ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is processing the submitted form."
    },
    createOngoingFlow(requestId)
  );
}

function buildFormSettlingScreen(values: Record<string, string>, requestId?: string): ScreenSchema {
  return createTaskScreen(
    {
      id: "form-finalizing",
      title: "Task intake form",
      subtitle: "Finalizing submitted fields",
      blocks: [
        {
          id: "form-finalizing-text",
          type: "text",
          value: "The harness has validated the structured fields and is packaging the final result surface."
        },
        {
          id: "form-finalizing-card",
          type: "card",
          title: values.goal || "Submitted goal",
          body: `Locking the final summary for ${values.duration || "the provided"} time window.`
        }
      ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is finalizing the submitted form."
    },
    createOngoingFlow(requestId)
  );
}

function buildFormResultScreen(values: Record<string, string>): ScreenSchema {
  return createResultScreen({
    id: "form-result",
    title: "Form submission received",
    subtitle: "Returned after form.submitted",
    blocks: [
      {
        id: "form-result-text",
        type: "text",
        value: "The harness received structured input from the runtime and can now plan from explicit fields."
      },
      {
        id: "form-result-card",
        type: "card",
        title: values.goal || "Untitled goal",
        body: `Available time: ${values.duration || "-"}`
      },
      {
        id: "form-result-details",
        type: "details",
        title: "Submission summary",
        items: [
          {
            id: "form-detail-goal",
            label: "Goal",
            value: values.goal || "-"
          },
          {
            id: "form-detail-duration",
            label: "Duration",
            value: values.duration || "-"
          },
          {
            id: "form-detail-constraints",
            label: "Constraints",
            value: values.constraints || "None provided."
          }
        ]
      },
      {
        id: "form-result-list",
        type: "list",
        items: [
          {
            id: "form-field-goal",
            title: "Primary goal",
            description: values.goal || "-"
          },
          {
            id: "form-field-duration",
            title: "Available time",
            description: values.duration || "-"
          },
          {
            id: "form-field-constraints",
            title: "Constraints",
            description: values.constraints || "None provided."
          }
        ]
      },
      {
        id: "form-result-actions",
        type: "actions",
        items: [
          { id: "show-plan", label: "Build plan" },
          ...flowLabResultFollowUpActions
        ]
      }
    ]
  });
}

function buildResourceScreen(resource: ArtifactRef, subtitle: string): ScreenSchema {
  return createResultScreen({
    id: `resource-${resource.id}`,
    title: resource.title ?? "Artifact preview",
    subtitle,
    blocks: [
      {
        id: `resource-block-${resource.id}`,
        type: "resource",
        resource
      },
      {
        id: `resource-actions-${resource.id}`,
        type: "actions",
        items: [...runtimeInspectActions]
      }
    ]
  });
}

function buildCapabilityResultScreenWithPayload(
  requestId: string,
  granted: boolean | undefined,
  payload?: Record<string, unknown>
): ScreenSchema {
  return createResultScreen({
    id: "capability-result",
    title: "Capability result",
    subtitle: "Returned after capability.resolved",
    blocks: [
      {
        id: "capability-text",
        type: "text",
        value: `Capability request ${requestId} resolved with granted=${String(granted)}.`
      },
      ...(payload
        ? [
            {
              id: "capability-payload",
              type: "card" as const,
              title: "Capability payload",
              body: JSON.stringify(payload, null, 2)
            }
          ]
        : []),
      {
        id: "capability-actions",
        type: "actions",
        items: [...flowLabResultFollowUpActions]
      }
    ]
  });
}

function createDemoLocalHarness() {
  let inputFlowMode: InputFlowMode = "sequence";
  let scenarioCursor = 0;
  let lastRandomScenarioIndex = -1;

  function buildLocalHomeScreen() {
    return createHomeScreen(
      "Local harness with staged status updates, richer mock artifacts, and rotating scenario routing.",
      inputFlowMode,
      getNextAutoScenarioPreviewLabel(inputFlowMode, scenarioCursor)
    );
  }

  function getNextInputScenario() {
    if (inputFlowMode === "random") {
      let nextIndex = Math.floor(Math.random() * autoInputScenarioActions.length);

      if (autoInputScenarioActions.length > 1 && nextIndex === lastRandomScenarioIndex) {
        nextIndex = (nextIndex + 1) % autoInputScenarioActions.length;
      }

      lastRandomScenarioIndex = nextIndex;
      return autoInputScenarioActions[nextIndex];
    }

    const scenario = autoInputScenarioActions[scenarioCursor % autoInputScenarioActions.length];
    scenarioCursor = (scenarioCursor + 1) % autoInputScenarioActions.length;
    return scenario;
  }

  function isTaskScenario(actionId: string) {
    return actionId === "show-plan" || actionId === "show-timeline";
  }

  function isProcessingScenario(actionId: string) {
    return isTaskScenario(actionId) || actionId === "show-direct";
  }

  function emitRootScreen(screen: ScreenSchema, emit: DemoEmit) {
    emit({ type: "screen.updated", screen: applyFlow(screen, createRootFlow()) });
    emit({ type: "status", phase: "waiting" });
  }

  function emitResolvedScreen(screen: ScreenSchema, emit: DemoEmit, requestId?: string) {
    emit({
      type: "screen.updated",
      screen: requestId ? applyFlow(screen, createCompletedFlow(requestId)) : screen
    });
    emit({ type: "status", phase: "waiting" });
  }

  async function runTaskScenario(actionId: string, emit: DemoEmit, requestId?: string) {
    if (actionId === "show-plan") {
      emit({
        type: "screen.updated",
        screen: buildProcessingStageScreen(
          "plan-processing",
          "Generated task plan",
          "Processing request",
          "The harness is analyzing the request before opening a task workspace.",
          requestId
        )
      });
      await delay(220);
      const scaffold = buildPlanScaffoldScreen(requestId);
      emit({ type: "screen.updated", screen: scaffold });
      await delay(360);
      emit({ type: "screen.updated", screen: buildPlanSettlingScreen(requestId) });
      await delay(760);
      emitResolvedScreen(buildPlanResultScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-timeline") {
      emit({
        type: "screen.updated",
        screen: buildProcessingStageScreen(
          "timeline-processing",
          "Task timeline",
          "Processing request",
          "The harness is organizing execution stages before opening the task timeline.",
          requestId
        )
      });
      await delay(220);
      const timelineScreen = buildTimelineIntroScreen(requestId);
      emit({ type: "screen.updated", screen: timelineScreen });
      await delay(360);
      emit({
        type: "screen.patched",
        screenId: timelineScreen.id,
        operations: buildTimelineStreamingPatchOperations()
      });
      await delay(360);
      emit({
        type: "screen.patched",
        screenId: timelineScreen.id,
        operations: buildTimelineFinalizingPatchOperations()
      });
      await delay(520);
      emitResolvedScreen(buildTimelineResultScreen(), emit, requestId);
    }
  }

  async function runDirectResultScenario(emit: DemoEmit, requestId?: string) {
    emit({
      type: "screen.updated",
      screen: buildProcessingStageScreen(
        "direct-processing",
        "Direct result surface",
        "Processing request",
        "The harness is resolving the request and will return a final result without opening an intermediate task workspace.",
        requestId
      )
    });
    await delay(320);
    emitResolvedScreen(buildDirectResultScreen(), emit, requestId);
  }

  async function runLocalAction(actionId: string, emit: DemoEmit, requestId?: string) {
    if (isTaskScenario(actionId)) {
      await runTaskScenario(actionId, emit, requestId);
      return;
    }

    if (actionId === "show-direct") {
      await runDirectResultScenario(emit, requestId);
      return;
    }

    if (actionId === "show-flow-lab") {
      emitResolvedScreen(buildFlowLabScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-verification") {
      emitResolvedScreen(buildVerificationBoardScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-playground") {
      emitResolvedScreen(buildRuntimePlaygroundScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-brief") {
      emitResolvedScreen(buildTaskBriefScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-day-planner") {
      emitResolvedScreen(buildDayPlannerScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-grocery") {
      emitResolvedScreen(buildGroceryRunScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-trip") {
      emitResolvedScreen(buildTravelCompanionScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-wellness") {
      emitResolvedScreen(buildWellnessCheckInScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-log") {
      emitResolvedScreen(buildEventLogScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-workspace") {
      emitResolvedScreen(buildGroupedWorkspaceScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-split") {
      emitResolvedScreen(buildSplitWorkspaceScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-form") {
      emitResolvedScreen(buildFormScreen(), emit, requestId);
      return;
    }

    if (actionId === "show-ops-board") {
      emitResolvedScreen(buildOpsBoardScreen(), emit, requestId);
      return;
    }

    if (actionId === "preview-asset") {
      emitResolvedScreen(buildResourceScreen(linkedArtifact, "Resource block wired through the protocol"), emit, requestId);
      return;
    }

    if (actionId === "show-report") {
      emitResolvedScreen(
        buildResourceScreen(reportArtifact, "HTML artifact sent through the same schema surface"),
        emit,
        requestId
      );
      return;
    }

    if (actionId === "show-pdf") {
      emitResolvedScreen(buildResourceScreen(pdfArtifact, "PDF artifact sent through the same schema surface"), emit, requestId);
      return;
    }

    if (actionId === "request-microphone") {
      emit({
        type: "capability.requested",
        request: {
          id: requestId ?? "cap_microphone_demo",
          capability: "microphone",
          reason: "The local harness wants to demonstrate the capability bridge flow."
        }
      });
      return;
    }

    if (actionId === "request-open-url") {
      emit({
        type: "capability.requested",
        request: {
          id: requestId ?? "cap_open_url_demo",
          capability: "open-url",
          reason: "The local harness wants to open a linked surface through the default renderer bridge.",
          payload: {
            title: "Unstable UI repository",
            url: "https://github.com/SelfMeAI/unstable-ui"
          }
        }
      });
      return;
    }

    if (actionId === "request-share") {
      emit({
        type: "capability.requested",
        request: {
          id: requestId ?? "cap_share_demo",
          capability: "share",
          reason: "The local harness wants to forward a generated summary into the native share sheet.",
          payload: {
            title: "Share runtime summary",
            message: "Unstable UI is ready for the next runtime iteration.",
            url: "https://github.com/SelfMeAI/unstable-ui"
          }
        }
      });
      return;
    }

    if (actionId === "simulate-error") {
      emit({
        type: "error",
        message: "Mock harness failure: the remote planner timed out while composing the next workspace."
      });
      return;
    }

    if (actionId === "set-input-flow-sequence") {
      inputFlowMode = "sequence";
      emitRootScreen(buildLocalHomeScreen(), emit);
      return;
    }

    if (actionId === "set-input-flow-random") {
      inputFlowMode = "random";
      emitRootScreen(buildLocalHomeScreen(), emit);
      return;
    }

    if (actionId === "back-home") {
      emitRootScreen(buildLocalHomeScreen(), emit);
    }
  }

  return createLocalHarness({
    bootstrap(emit) {
      emit({ type: "session.started", sessionId: "demo-session" });
      emit({ type: "status", phase: "waiting" });
      emit({
        type: "screen.updated",
        screen: buildLocalHomeScreen()
      });
    },
    async handleClientEvent(event, emit) {
      if (event.type === "voice.input" || event.type === "input.submitted") {
        const nextScenario = getNextInputScenario();

        emit({ type: "status", phase: "thinking" });
        await delay(280);
        emit({ type: "status", phase: "running" });
        await delay(180);
        await runLocalAction(nextScenario.id, emit, event.clientRequestId);
        return;
      }

      if (event.type === "artifact.requested") {
        emit({ type: "status", phase: "running" });
        await delay(180);
        emit({
          type: "artifact.available",
          artifact: getDemoArtifact(event.artifactId)
        });
        emit({ type: "status", phase: "waiting" });
        return;
      }

      if (event.type === "capability.resolved") {
        emitResolvedScreen(
          buildCapabilityResultScreenWithPayload(
            event.requestId,
            event.payload?.granted as boolean | undefined,
            event.payload
          ),
          emit,
          event.requestId
        );
        return;
      }

      if (event.type === "form.submitted") {
        emit({ type: "status", phase: "thinking" });
        emit({
          type: "screen.updated",
          screen: buildFormProcessingScreen(event.values, event.clientRequestId)
        });
        await delay(220);
        emit({ type: "status", phase: "running" });
        emit({
          type: "screen.updated",
          screen: buildFormSettlingScreen(event.values, event.clientRequestId)
        });
        await delay(760);
        emitResolvedScreen(buildFormResultScreen(event.values), emit, event.clientRequestId);
        return;
      }

      if (event.type !== "action.triggered") {
        return;
      }

      if (isProcessingScenario(event.actionId)) {
        emit({ type: "status", phase: "thinking" });
        await delay(180);
        emit({ type: "status", phase: "running" });
      }

      await runLocalAction(event.actionId, emit, event.clientRequestId);
    }
  });
}

const remoteHarnessBaseUrl = (
  globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }
).process?.env?.EXPO_PUBLIC_UNSTABLE_UI_HARNESS_BASE_URL;

const harness = remoteHarnessBaseUrl
  ? createRemoteHttpSseHarness({
      baseUrl: remoteHarnessBaseUrl,
      sessionStore: demoRemoteSessionStore
    })
  : createDemoLocalHarness();

export default function App() {
  const {
    transitionHooks,
    transitionState,
    runtimeStageStyle,
    blockRuntimePointerEvents
  } = useDemoScreenTransition();

  return (
    <View style={styles.appRoot}>
      <Animated.View
        pointerEvents={blockRuntimePointerEvents ? "none" : "auto"}
        style={[styles.runtimeStage, runtimeStageStyle]}
      >
        <AgentRuntimeView
          harness={harness}
          voiceShell={demoVoiceShell}
          artifactHandlers={demoArtifactHandlers}
          capabilityHandlers={demoCapabilityHandlers}
          transitionHooks={transitionHooks}
          runtimeOptions={{
            persistence: demoRuntimePersistence
          }}
        />
      </Animated.View>
      <DemoTransitionOverlay state={transitionState} />
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: "#F3F6FB"
  },
  runtimeStage: {
    flex: 1
  }
});
