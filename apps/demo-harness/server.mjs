import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
const sessions = new Map();

const linkedArtifact = {
  id: "artifact-1",
  kind: "link",
  uri: "https://github.com/SelfMeAI/unstable-ui",
  source: "remote",
  title: "unstable-ui on GitHub",
  preview: {
    summary: "Repository home for the React Native runtime-first framework.",
    fields: [
      { label: "Owner", value: "SelfMeAI" },
      { label: "Surface", value: "GitHub repository" }
    ]
  },
  previewable: true,
  openable: true
};

const reportArtifact = {
  id: "report-1",
  kind: "html",
  uri: "https://selfme.ai/unstable-ui/",
  source: "remote",
  title: "Unstable UI report surface",
  mimeType: "text/html",
  preview: {
    summary: "Hosted HTML surface generated from the project website.",
    fields: [
      { label: "Format", value: "HTML document" },
      { label: "Intent", value: "Hosted preview surface" }
    ]
  },
  previewable: true,
  openable: true
};

const pdfArtifact = {
  id: "pdf-1",
  kind: "pdf",
  uri: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  source: "remote",
  title: "Sample PDF artifact",
  mimeType: "application/pdf",
  preview: {
    summary: "PDF resource available through the default bridge path.",
    fields: [
      { label: "Pages", value: "Demo sample" },
      { label: "Intent", value: "Open or download test" }
    ]
  },
  previewable: true,
  openable: true
};

const textArtifact = {
  id: "text-1",
  kind: "text",
  uri: "https://selfme.ai/unstable-ui/notes.txt",
  source: "remote",
  title: "Runtime notes",
  mimeType: "text/plain",
  preview: {
    text: "Bridge preview content can arrive inside the artifact itself, so the renderer can show a useful sheet before opening anything.",
    summary: "Plain-text artifact with inline preview content.",
    fields: [
      { label: "Lines", value: "1" },
      { label: "Encoding", value: "UTF-8" }
    ]
  },
  previewable: true,
  openable: true
};

const jsonArtifact = {
  id: "json-1",
  kind: "json",
  uri: "https://selfme.ai/unstable-ui/runtime.json",
  source: "remote",
  title: "Runtime manifest",
  mimeType: "application/json",
  preview: {
    text: '{\n  "surface": "runtime-playground",\n  "version": "0.1.0-alpha.3",\n  "requestAware": true\n}',
    summary: "Structured JSON payload for renderer-side inspection.",
    fields: [
      { label: "Schema", value: "runtime-manifest" },
      { label: "Keys", value: "surface, version, requestAware" }
    ]
  },
  previewable: true,
  openable: true
};

const imageArtifact = {
  id: "image-1",
  kind: "image",
  uri: "https://selfme.ai/logo.png",
  source: "remote",
  title: "Brand image",
  mimeType: "image/png",
  preview: {
    summary: "Image artifact with a thumbnail reference for richer default previews.",
    thumbnailUri: "https://selfme.ai/logo.png",
    fields: [
      { label: "Format", value: "PNG" },
      { label: "Use", value: "Preview surface test" }
    ]
  },
  previewable: true,
  openable: true
};

const defaultScreenInteraction = {
  input: "enabled",
  actions: "enabled",
  forms: "enabled",
  artifacts: "enabled",
  history: "enabled"
};

function createRootFlow() {
  return {
    transition: "root",
    state: "complete"
  };
}

function createOngoingFlow(requestId, parentRequestId) {
  return {
    requestId,
    parentRequestId,
    transition: "replace",
    state: "ongoing"
  };
}

function createCompletedFlow(requestId, parentRequestId) {
  return {
    requestId,
    parentRequestId,
    transition: "replace",
    state: "complete"
  };
}

function withScreenState(screen, mode, interaction = {}, flow = createRootFlow()) {
  return {
    ...screen,
    mode,
    flow,
    interaction: {
      ...defaultScreenInteraction,
      ...interaction
    }
  };
}

function applyFlow(screen, flow) {
  return {
    ...screen,
    flow
  };
}

function createStableScreen(screen, interaction = {}, flow = createRootFlow()) {
  return withScreenState(screen, "stable", interaction, flow);
}

function createProcessingScreen(screen, interaction = {}, flow = createOngoingFlow()) {
  return withScreenState(screen, "processing", interaction, flow);
}

function createTaskScreen(screen, interaction = {}, flow = createOngoingFlow()) {
  return withScreenState(screen, "task", interaction, flow);
}

function createResultScreen(screen, interaction = {}, flow = createCompletedFlow()) {
  return withScreenState(screen, "result", interaction, flow);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getDemoArtifact(artifactId) {
  switch (artifactId) {
    case pdfArtifact.id:
      return pdfArtifact;
    case textArtifact.id:
      return textArtifact;
    case jsonArtifact.id:
      return jsonArtifact;
    case imageArtifact.id:
      return imageArtifact;
    case reportArtifact.id:
      return reportArtifact;
    case linkedArtifact.id:
    default:
      return linkedArtifact;
  }
}

const inputFlowActions = [
  { id: "set-input-flow-sequence", label: "Sequential routing" },
  { id: "set-input-flow-random", label: "Random routing" }
];

const everydayScenarioActions = [
  { id: "show-day-planner", label: "Daily planner" },
  { id: "show-grocery", label: "Grocery run" },
  { id: "show-trip", label: "Travel companion" },
  { id: "show-wellness", label: "Wellness check-in" }
];

const workspaceScenarioActions = [
  { id: "show-flow-lab", label: "Flow lab" },
  { id: "show-verification", label: "Verification board" },
  { id: "show-playground", label: "Playground" },
  { id: "show-request-inspector", label: "Request inspector" },
  { id: "show-direct", label: "Direct result" },
  { id: "show-plan", label: "Staged plan" },
  { id: "show-timeline", label: "Task timeline" },
  { id: "show-brief", label: "Task brief" },
  { id: "show-workspace", label: "Grouped workspace" },
  { id: "show-split", label: "Split workspace" },
  { id: "show-form", label: "Intake form" },
  { id: "show-log", label: "Event log" },
  { id: "show-ops-board", label: "Ops board" }
];

const systemScenarioActions = [
  { id: "preview-asset", label: "Link artifact" },
  { id: "show-report", label: "HTML report" },
  { id: "show-pdf", label: "PDF artifact" },
  { id: "request-microphone", label: "Microphone bridge" },
  { id: "request-camera", label: "Camera bridge" },
  { id: "request-photo-library", label: "Photo library bridge" },
  { id: "request-location", label: "Location bridge" },
  { id: "request-file-picker", label: "File picker bridge" },
  { id: "request-open-url", label: "Open URL bridge" },
  { id: "request-share", label: "Share bridge" },
  { id: "simulate-error", label: "Harness error" }
];

const quickTestActions = [
  { id: "show-flow-lab", label: "Open flow lab" },
  { id: "show-verification", label: "Open verification" },
  { id: "show-playground", label: "Open playground" },
  { id: "show-request-inspector", label: "Open inspector" },
  { id: "show-direct", label: "Test direct result" },
  { id: "show-plan", label: "Test staged plan" },
  { id: "show-timeline", label: "Test timeline" },
  { id: "show-workspace", label: "Test workspace" },
  { id: "show-form", label: "Test form" }
];

const autoInputScenarioActions = [
  ...everydayScenarioActions,
  ...workspaceScenarioActions,
  { id: "preview-asset", label: "Link artifact" },
  { id: "show-report", label: "HTML report" },
  { id: "show-pdf", label: "PDF artifact" }
];

function getInputFlowModeLabel(mode) {
  return mode === "random" ? "Random" : "Sequential";
}

function getNextAutoScenarioPreviewLabel(mode, cursor) {
  if (mode === "random") {
    return `Random from ${autoInputScenarioActions.length} scenes`;
  }

  return autoInputScenarioActions[cursor % autoInputScenarioActions.length]?.label ?? "Scenario pool unavailable";
}

function createHomeScreen(inputFlowMode = "sequence", scenarioCursor = 0) {
  return createStableScreen({
    id: "remote-home",
    title: "unstable-ui",
    subtitle: "Remote harness demo",
    blocks: [
      {
        id: "intro",
        type: "text",
        value: "This screen is being streamed from the demo harness server."
      },
      {
        id: "card-1",
        type: "card",
        title: "Current mode",
        body: "Remote harness over HTTP + SSE with staged status transitions, richer mock artifacts, and rotating scenario routing."
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
              { id: "input-routing-mode", label: "Mode", value: getInputFlowModeLabel(inputFlowMode) },
              {
                id: "input-routing-next",
                label: "Next scene",
                value: getNextAutoScenarioPreviewLabel(inputFlowMode, scenarioCursor),
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
          { id: "everyday-scenarios-actions", type: "actions", items: [...everydayScenarioActions] }
        ]
      },
      {
        id: "workspace-scenarios-section",
        type: "section",
        title: "Work surfaces",
        description: "Common structured agent screens, workspace layouts, and runtime views.",
        blocks: [
          { id: "workspace-scenarios-actions", type: "actions", items: [...workspaceScenarioActions] }
        ]
      },
      {
        id: "system-scenarios-section",
        type: "section",
        title: "System flows",
        description: "Artifacts, bridge requests, and failure states for runtime validation.",
        blocks: [
          { id: "system-scenarios-actions", type: "actions", items: [...systemScenarioActions] }
        ]
      }
    ]
  });
}

function createProcessingStageScreen(screenId, title, subtitle, body, requestId) {
  return createProcessingScreen(
    {
      id: screenId,
      title,
      subtitle,
      blocks: [
        {
          id: `${screenId}-text`,
          type: "text",
          value: body
        },
        {
          id: `${screenId}-card`,
          type: "card",
          title: "Processing",
          body: "The harness is resolving the next workspace surface."
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

function createFlowLabScreen() {
  return createStableScreen({
    id: "remote-flow-lab",
    title: "Flow lab",
    subtitle: "Manual test entry for standard runtime flows",
    blocks: [
      {
        id: "flow-lab-intro",
        type: "text",
        value: "Use this page to trigger the framework's baseline request flows without hunting through the remote home screen."
      },
      {
        id: "flow-lab-summary",
        type: "details",
        title: "Current baseline",
        items: [
          { id: "flow-lab-task", label: "Task flow", value: "processing -> task -> finalizing -> result" },
          { id: "flow-lab-direct", label: "Direct flow", value: "processing -> result" },
          { id: "flow-lab-approval", label: "Approval flow", value: "approval -> result" },
          { id: "flow-lab-form", label: "Form flow", value: "processing -> finalizing -> result" }
        ]
      },
      {
        id: "flow-lab-task-actions",
        type: "actions",
        items: [
          { id: "show-direct", label: "Run direct result" },
          { id: "show-plan", label: "Run staged plan" },
          { id: "show-timeline", label: "Run timeline" },
          { id: "show-form", label: "Open intake form" }
        ]
      },
      {
        id: "flow-lab-metrics",
        type: "details",
        title: "Metric hints",
        items: [
          { id: "flow-lab-metric-direct", label: "Direct flow", value: "Patch events should stay at 0" },
          { id: "flow-lab-metric-timeline", label: "Timeline flow", value: "Patch events should be greater than 0" },
          { id: "flow-lab-metric-task", label: "Task flows", value: "Workspace events should be greater than 1" },
          { id: "flow-lab-metric-approval", label: "Approval flow", value: "Resource events should include at least one capability event" }
        ]
      },
      {
        id: "flow-lab-bridge-actions",
        type: "actions",
        items: [
          { id: "request-microphone", label: "Test capability" },
          { id: "request-camera", label: "Test camera" },
          { id: "request-photo-library", label: "Test library" },
          { id: "request-location", label: "Test location" },
          { id: "request-file-picker", label: "Test file picker" },
          { id: "request-open-url", label: "Test open URL" },
          { id: "request-share", label: "Test share" },
          { id: "preview-asset", label: "Test artifact" },
          { id: "show-pdf", label: "Test download" },
          { id: "simulate-error", label: "Test error" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function createRuntimePlaygroundScreen() {
  return createStableScreen({
    id: "remote-runtime-playground",
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
        id: "playground-recovery-details",
        type: "details",
        title: "Recovery state",
        description: "Resolved directly from runtime.recovery.",
        source: "runtime.recovery"
      },
      {
        id: "playground-session-actions",
        type: "actions",
        source: "runtime.sessionActions"
      },
      {
        id: "playground-session-log",
        type: "log",
        title: "Session lifecycle",
        source: "runtime.sessionLog",
        maxItems: 10,
        emptyLabel: "No session lifecycle entries recorded yet."
      },
      {
        id: "playground-flow-details",
        type: "details",
        title: "Request flow",
        description: "Resolved directly from runtime.flow.",
        source: "runtime.flow"
      },
      {
        id: "playground-transport-details",
        type: "details",
        title: "Transport state",
        description: "Resolved directly from runtime.transport.",
        source: "runtime.transport"
      },
      {
        id: "playground-transport-log",
        type: "log",
        title: "Transport lifecycle",
        source: "runtime.transportLog",
        maxItems: 8,
        emptyLabel: "No transport lifecycle entries recorded yet."
      },
      {
        id: "playground-request-index-summary",
        type: "details",
        title: "Request index",
        description: "All indexed request chains grouped by requestId.",
        source: "runtime.requestIndexSummary"
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
        id: "playground-navigation-details",
        type: "details",
        title: "Navigation overlays",
        description: "Resolved directly from runtime.navigation.",
        source: "runtime.navigation"
      },
      {
        id: "playground-persistence-details",
        type: "details",
        title: "Persistence state",
        description: "Resolved directly from runtime.persistence.",
        source: "runtime.persistence"
      },
      {
        id: "playground-persistence-actions",
        type: "actions",
        source: "runtime.persistenceActions"
      },
      {
        id: "playground-persistence-log",
        type: "log",
        title: "Persistence lifecycle",
        source: "runtime.persistenceLog",
        maxItems: 8,
        emptyLabel: "No persistence lifecycle entries recorded yet."
      },
      {
        id: "playground-bridge-section",
        type: "section",
        title: "Bridge runtime state",
        description: "Inspect the renderer-facing artifact inventory and pending capability queue.",
        blocks: [
          {
            id: "playground-bridge-details",
            type: "details",
            title: "Bridge summary",
            description: "Resolved directly from runtime bridge state.",
            source: "runtime.bridge"
          },
          {
            id: "playground-bridge-integration",
            type: "details",
            title: "Bridge integration",
            description: "Host-registered bridge methods and handler coverage currently active in the renderer.",
            source: "runtime.bridgeIntegration"
          },
          {
            id: "playground-bridge-routing",
            type: "details",
            title: "Bridge routing",
            description: "Effective route selection for representative artifact and capability bridge paths.",
            source: "runtime.bridgeRouting"
          },
          {
            id: "playground-bridge-verdict",
            type: "details",
            title: "Bridge verdict",
            description: "Top-level evaluation of artifact inventory and capability accounting.",
            source: "runtime.bridgeVerdict"
          },
          {
            id: "playground-bridge-assertions",
            type: "details",
            title: "Bridge assertions",
            description: "Inspect the specific artifact and capability checks behind the verdict.",
            source: "runtime.bridgeAssertions"
          },
          {
            id: "playground-bridge-errors",
            type: "details",
            title: "Bridge errors",
            description: "Current renderer-side bridge failures for artifact or capability handling.",
            source: "runtime.bridgeErrors"
          },
          {
            id: "playground-artifact-log",
            type: "log",
            title: "Artifact inventory",
            source: "runtime.artifacts",
            maxItems: 8,
            emptyLabel: "No artifacts are registered in the runtime yet."
          },
          {
            id: "playground-capability-log",
            type: "log",
            title: "Pending capabilities",
            source: "runtime.capabilityRequests",
            maxItems: 8,
            emptyLabel: "No capability request is waiting right now."
          },
          {
            id: "playground-last-capability-resolution",
            type: "details",
            title: "Last capability resolution",
            source: "runtime.lastCapabilityResolution"
          },
          {
            id: "playground-capability-history",
            type: "log",
            title: "Capability history",
            source: "runtime.capabilityHistory",
            maxItems: 8,
            emptyLabel: "No capability activity recorded yet."
          }
        ]
      },
      {
        id: "playground-actions",
        type: "actions",
        items: [
          { id: "show-flow-lab", label: "Open flow lab" },
          { id: "show-request-inspector", label: "Inspect request" },
          { id: "show-verification", label: "Open verification" },
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
            id: "playground-request-index-actions",
            type: "actions",
            source: "runtime.requestIndexActions",
            maxItems: 8
          },
          {
            id: "playground-request-index-log",
            type: "log",
            title: "Request index log",
            source: "runtime.requestIndex",
            maxItems: 10,
            emptyLabel: "No indexed request chains recorded yet."
          },
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
            id: "playground-current-request-resources",
            type: "details",
            title: "Current request resources",
            source: "runtime.currentRequestResources"
          },
          {
            id: "playground-current-request-log",
            type: "log",
            title: "Current request history",
            source: "runtime.currentRequestHistory",
            maxItems: 8,
            emptyLabel: "No active request chain is attached right now."
          },
          {
            id: "playground-current-request-resource-log",
            type: "log",
            title: "Current request resource history",
            source: "runtime.currentRequestResourceHistory",
            maxItems: 6,
            emptyLabel: "No resource activity is attached to the active request."
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
            id: "playground-last-completed-request-resources",
            type: "details",
            title: "Last completed request resources",
            source: "runtime.lastCompletedRequestResources"
          },
          {
            id: "playground-last-completed-request-log",
            type: "log",
            title: "Last completed request history",
            source: "runtime.lastCompletedRequestHistory",
            maxItems: 8,
            emptyLabel: "No completed request chain has been recorded yet."
          },
          {
            id: "playground-last-completed-request-resource-log",
            type: "log",
            title: "Last completed request resource history",
            source: "runtime.lastCompletedRequestResourceHistory",
            maxItems: 6,
            emptyLabel: "No resource activity is attached to the last completed request."
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
          { id: "playground-resource-pdf", type: "resource", resource: pdfArtifact },
          { id: "playground-resource-text", type: "resource", resource: textArtifact },
          { id: "playground-resource-json", type: "resource", resource: jsonArtifact },
          { id: "playground-resource-image", type: "resource", resource: imageArtifact }
        ]
      }
    ]
  });
}

function createVerificationBoardScreen() {
  return createStableScreen({
    id: "remote-verification-board",
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
        id: "verification-flow-details",
        type: "details",
        title: "Runtime flow",
        description: "Current request pointer and last completed request pointer.",
        source: "runtime.flow"
      },
      {
        id: "verification-request-index-summary",
        type: "details",
        title: "Request index",
        description: "Use this to inspect the full request catalog before drilling into one chain.",
        source: "runtime.requestIndexSummary"
      },
      {
        id: "verification-request-actions",
        type: "actions",
        items: [
          { id: "inspect-current-request", label: "Inspect current" },
          { id: "inspect-last-completed-request", label: "Inspect last completed" },
          { id: "show-request-inspector", label: "Open inspector" }
        ]
      },
      {
        id: "verification-recovery-section",
        type: "section",
        title: "Session recovery",
        description: "Validate restore, reconnect, and reset health at the same level as request-chain checks.",
        blocks: [
          {
            id: "verification-recovery-verdict",
            type: "details",
            title: "Recovery verdict",
            description: "Top-level evaluation of recovery, persistence, and transport consistency.",
            source: "runtime.recoveryVerdict"
          },
          {
            id: "verification-recovery-assertions",
            type: "details",
            title: "Recovery assertions",
            description: "Inspect the specific restore, reconnect, reset, and persistence checks behind the verdict.",
            source: "runtime.recoveryAssertions"
          },
          {
            id: "verification-recovery-raw",
            type: "details",
            title: "Recovery state",
            description: "Raw recovery counters and timestamps from the runtime.",
            source: "runtime.recovery"
          },
          {
            id: "verification-transport-raw",
            type: "details",
            title: "Transport state",
            description: "Raw transport counters and connection status from the runtime.",
            source: "runtime.transport"
          },
          {
            id: "verification-persistence-raw",
            type: "details",
            title: "Persistence state",
            description: "Raw persistence counters, timestamps, and errors from the runtime.",
            source: "runtime.persistence"
          },
          {
            id: "verification-session-actions",
            type: "actions",
            source: "runtime.sessionActions"
          },
          {
            id: "verification-persistence-actions",
            type: "actions",
            source: "runtime.persistenceActions"
          }
        ]
      },
      {
        id: "verification-request-index-drilldown",
        type: "section",
        title: "Indexed request drill-down",
        description: "Open a specific request chain directly from the runtime-generated request catalog.",
        blocks: [
          {
            id: "verification-request-index-actions",
            type: "actions",
            source: "runtime.requestIndexActions",
            maxItems: 8
          }
        ]
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
        type: "details",
        title: "Metric guide",
        items: [
          { id: "verification-metric-events", label: "Request events", value: "Counts every history entry attached to the active request" },
          { id: "verification-metric-workspace", label: "Workspace events", value: "Should rise when the harness updates or patches the screen" },
          { id: "verification-metric-patches", label: "Patch events", value: "Only increments for screen.patched and should stay 0 for direct flows" },
          { id: "verification-metric-resources", label: "Resource events", value: "Captures artifacts and capability request or resolve activity" },
          { id: "verification-metric-issues", label: "Issues", value: "Any non-zero issue count means the chain needs review" }
        ]
      },
      {
        id: "verification-bridge-section",
        type: "section",
        title: "Bridge state",
        description: "Inspect renderer-facing artifact and capability state without leaving the verification surface.",
        blocks: [
          {
            id: "verification-bridge-details",
            type: "details",
            title: "Bridge summary",
            source: "runtime.bridge"
          },
          {
            id: "verification-bridge-integration",
            type: "details",
            title: "Bridge integration",
            description: "Host-registered bridge methods and handler coverage currently active in the renderer.",
            source: "runtime.bridgeIntegration"
          },
          {
            id: "verification-bridge-routing",
            type: "details",
            title: "Bridge routing",
            description: "Effective route selection for representative artifact and capability bridge paths.",
            source: "runtime.bridgeRouting"
          },
          {
            id: "verification-bridge-verdict",
            type: "details",
            title: "Bridge verdict",
            description: "Top-level evaluation of artifact inventory and capability accounting.",
            source: "runtime.bridgeVerdict"
          },
          {
            id: "verification-bridge-assertions",
            type: "details",
            title: "Bridge assertions",
            description: "Inspect the specific artifact and capability checks behind the verdict.",
            source: "runtime.bridgeAssertions"
          },
          {
            id: "verification-bridge-errors",
            type: "details",
            title: "Bridge errors",
            description: "Current renderer-side bridge failures for artifact or capability handling.",
            source: "runtime.bridgeErrors"
          },
          {
            id: "verification-bridge-artifacts",
            type: "log",
            title: "Artifact inventory",
            source: "runtime.artifacts",
            maxItems: 4,
            emptyLabel: "No artifacts are registered in the runtime yet."
          },
          {
            id: "verification-bridge-capabilities",
            type: "log",
            title: "Pending capabilities",
            source: "runtime.capabilityRequests",
            maxItems: 4,
            emptyLabel: "No capability request is waiting right now."
          },
          {
            id: "verification-bridge-last-capability",
            type: "details",
            title: "Last capability resolution",
            source: "runtime.lastCapabilityResolution"
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
            id: "verification-request-index-log",
            type: "log",
            title: "Request index log",
            source: "runtime.requestIndex",
            maxItems: 8,
            emptyLabel: "No indexed request chains recorded yet."
          },
          {
            id: "verification-current-request-resources",
            type: "details",
            title: "Current request resources",
            source: "runtime.currentRequestResources"
          },
          {
            id: "verification-current-request-log",
            type: "log",
            title: "Current request history",
            source: "runtime.currentRequestHistory",
            maxItems: 6,
            emptyLabel: "No active request chain."
          },
          {
            id: "verification-current-request-resource-log",
            type: "log",
            title: "Current request resource history",
            source: "runtime.currentRequestResourceHistory",
            maxItems: 4,
            emptyLabel: "No resource activity on the active request."
          },
          {
            id: "verification-last-request-resources",
            type: "details",
            title: "Last completed request resources",
            source: "runtime.lastCompletedRequestResources"
          },
          {
            id: "verification-last-request-log",
            type: "log",
            title: "Last completed request history",
            source: "runtime.lastCompletedRequestHistory",
            maxItems: 6,
            emptyLabel: "No completed request chain yet."
          },
          {
            id: "verification-last-request-resource-log",
            type: "log",
            title: "Last completed request resource history",
            source: "runtime.lastCompletedRequestResourceHistory",
            maxItems: 4,
            emptyLabel: "No resource activity on the last completed request."
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

function createPlanScaffoldScreen(requestId) {
  return createTaskScreen(
    {
      id: "remote-plan",
      title: "Generated task plan",
      subtitle: "Task workspace is taking shape",
      blocks: [
        {
          id: "plan-intro",
          type: "text",
          value: "The remote harness has moved past the processing shell and is now building a task workspace."
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

function createDirectResultScreen() {
  return createResultScreen({
    id: "remote-direct-result",
    title: "Direct result surface",
    subtitle: "Result returned without an intermediate task workspace",
    blocks: [
      {
        id: "direct-result-intro",
        type: "text",
        value: "The remote harness resolved this request without opening a task screen. This is the shortest standard page flow."
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
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function createPlanSettlingScreen(requestId) {
  return createTaskScreen(
    {
      id: "remote-plan-finalizing",
      title: "Generated task plan",
      subtitle: "Finalizing workspace",
      blocks: [
        {
          id: "plan-finalizing-text",
          type: "text",
          value: "The remote harness has assembled the plan and is now locking the final result surface."
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

function createPlanResultScreen() {
  return createResultScreen({
    id: "remote-plan-result",
    title: "Generated task plan",
    subtitle: "Result surface returned by the remote harness",
    blocks: [
      {
        id: "plan-intro",
        type: "text",
        value: "The remote harness has moved past the processing shell and returned a stable result surface."
      },
      {
        id: "plan-status",
        type: "card",
        title: "Result stage",
        body: "The remote harness completed the staged plan flow over HTTP + SSE."
      },
      {
        id: "list-1",
        type: "list",
        items: [
          { id: "a", title: "Capture voice input", description: "Submit transcript or audio context." },
          { id: "b", title: "Plan next actions", description: "Turn intent into a constrained workspace." },
          { id: "c", title: "Return structured UI", description: "Update the screen through schema events." },
          { id: "d", title: "Attach artifacts", description: "Publish resources without leaking transport details into the UI layer." }
        ]
      },
      {
        id: "actions-2",
        type: "actions",
        items: [
          { id: "show-report", label: "Show report" },
          { id: "preview-asset", label: "Preview artifact" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function createTimelineIntroScreen(requestId) {
  return createTaskScreen(
    {
      id: "remote-task-timeline",
      title: "Task timeline",
      subtitle: "Task workspace is streaming step progression",
      blocks: [
        {
          id: "timeline-intro",
          type: "text",
          value: "The remote harness is publishing a constrained task timeline instead of a free-form text dump."
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
              description: "The remote harness is decomposing the request into executable workspace steps.",
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

function createLockedTimelineInteraction(reason) {
  return {
    input: "locked",
    actions: "locked",
    forms: "locked",
    artifacts: "enabled",
    history: "enabled",
    reason
  };
}

function createTimelineStreamingPatchOperations() {
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
        description: "The remote harness is patching the active task workspace instead of replacing the full screen.",
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
            description: "The remote harness has locked the execution shape and advanced to the patch stage.",
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

function createTimelineFinalizingPatchOperations() {
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

function createTimelineResultScreen() {
  return createResultScreen({
    id: "remote-timeline-result",
    title: "Task timeline",
    subtitle: "Result surface returned with staged timeline updates",
    blocks: [
      {
        id: "timeline-intro",
        type: "text",
        value: "The remote harness is publishing a constrained task timeline instead of a free-form text dump."
      },
      {
        id: "timeline-block",
        type: "timeline",
        title: "Execution flow",
        description: "The remote harness advanced this request through task-state patches before releasing the final result.",
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
            description: "The remote harness decomposed the request into actionable workspace stages.",
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
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function createTaskBriefScreen() {
  return createResultScreen({
    id: "remote-task-brief",
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
            value: "remote harness"
          },
          {
            id: "brief-track",
            label: "Track",
            value: "react-native"
          },
          {
            id: "brief-status",
            label: "Status",
            value: "sse workspace stream is ready",
            tone: "success"
          },
          {
            id: "brief-transport",
            label: "Transport",
            value: "http session start + sse stream + post event"
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

function createDayPlannerScreen() {
  return createResultScreen({
    id: "remote-day-planner",
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

function createGroceryRunScreen() {
  return createResultScreen({
    id: "remote-grocery-run",
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

function createTravelCompanionScreen() {
  return createResultScreen({
    id: "remote-travel-companion",
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

function createWellnessCheckInScreen() {
  return createResultScreen({
    id: "remote-wellness-check-in",
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

function createOpsBoardScreen() {
  return createStableScreen({
    id: "remote-ops-board",
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

function createEventLogScreen() {
  return createStableScreen({
    id: "remote-event-log",
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
          { id: "show-timeline", label: "Open timeline" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function createGroupedWorkspaceScreen() {
  return createStableScreen({
    id: "remote-grouped-workspace",
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
                value: "remote harness"
              },
              {
                id: "workspace-summary-surface",
                label: "Surface",
                value: "react-native workspace over http + sse"
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
                description: "The runtime connected and hydrated the remote session state.",
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

function createSplitWorkspaceScreen() {
  return createStableScreen({
    id: "remote-split-workspace",
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
                    description: "The remote harness assembled the pane structure for the task surface.",
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

function createFormScreen() {
  return createStableScreen({
    id: "remote-intake-form",
    title: "Task intake form",
    subtitle: "Structured input block streamed from the remote harness",
    blocks: [
      {
        id: "task-intake-form",
        type: "form",
        title: "Plan a focused work block",
        description: "The remote harness can request structured details before composing the next workspace.",
        submitLabel: "Submit intake",
        fields: [
          {
            id: "goal",
            kind: "text",
            label: "Primary goal",
            placeholder: "Ship the next runtime milestone",
            required: true
          },
          {
            id: "duration",
            kind: "text",
            label: "Available time",
            placeholder: "90 minutes",
            required: true
          },
          {
            id: "constraints",
            kind: "multiline",
            label: "Constraints",
            description: "Optional notes the harness should consider before building the next workspace.",
            placeholder: "Need a quiet block, avoid meetings, include one review pass."
          }
        ]
      },
      {
        id: "remote-intake-form-actions",
        type: "actions",
        items: [{ id: "back-home", label: "Back home" }]
      }
    ]
  });
}

function createFormProcessingScreen(values, requestId) {
  return createProcessingScreen(
    {
      id: "remote-form-processing",
      title: values.goal || "Form submission",
      subtitle: "Processing structured intake",
      blocks: [
        {
          id: "form-processing-text",
          type: "text",
          value: "The remote harness is validating the structured form values before composing the next workspace."
        },
        {
          id: "form-processing-details",
          type: "details",
          title: "Received values",
          items: [
            { id: "form-processing-goal", label: "Goal", value: values.goal || "-" },
            { id: "form-processing-duration", label: "Duration", value: values.duration || "-" },
            {
              id: "form-processing-constraints",
              label: "Constraints",
              value: values.constraints || "None provided."
            }
          ]
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

function createFormSettlingScreen(values, requestId) {
  return createTaskScreen(
    {
      id: "remote-form-finalizing",
      title: values.goal || "Form submission",
      subtitle: "Finalizing submitted fields",
      blocks: [
        {
          id: "form-finalizing-text",
          type: "text",
          value: "The remote harness is sealing the composed screen before releasing the final result."
        },
        {
          id: "form-finalizing-card",
          type: "card",
          title: "Finalizing",
          body: "Structured values have been accepted and are being applied to the final workspace surface."
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

function createFormResultScreen(values) {
  return createResultScreen({
    id: "remote-form-result",
    title: "Form submission received",
    subtitle: "Returned after form.submitted",
    blocks: [
      {
        id: "form-result-text",
        type: "text",
        value: "The remote harness received structured input from the runtime and can now plan from explicit fields."
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
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  });
}

function createResourceScreen(resource, subtitle) {
  return createResultScreen({
    id: `remote-resource-${resource.id}`,
    title: resource.title ?? "Artifact preview",
    subtitle,
    blocks: [
      {
        id: `resource-${resource.id}`,
        type: "resource",
        resource
      },
      {
        id: `resource-actions-${resource.id}`,
        type: "actions",
        items: [{ id: "back-home", label: "Back home" }]
      }
    ]
  });
}

function createCapabilityResultScreen(requestId, granted, payload) {
  return createResultScreen({
    id: "remote-capability-result",
    title: "Capability result",
    subtitle: "Returned after capability.resolved",
    blocks: [
      {
        id: "capability-text",
        type: "text",
        value: `Capability request ${requestId} resolved with granted=${String(granted)}.`
      },
      {
        id: "capability-result-details",
        type: "details",
        title: "Resolution summary",
        items: [
          { id: "capability-result-request", label: "Request ID", value: requestId },
          { id: "capability-result-granted", label: "Granted", value: String(granted) },
          {
            id: "capability-result-bridge",
            label: "Bridge",
            value: typeof payload?.bridge === "string" ? payload.bridge : "None"
          }
        ]
      },
      ...(payload
        ? [
            {
              id: "capability-payload",
              type: "card",
              title: "Capability payload",
              body: JSON.stringify(payload, null, 2)
            }
          ]
        : []),
      {
        id: "capability-actions",
        type: "actions",
        items: [{ id: "back-home", label: "Back home" }]
      }
    ]
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function writeEvent(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function ensureSession(sessionId) {
  return sessions.get(sessionId);
}

function broadcast(sessionId, event) {
  const session = ensureSession(sessionId);

  if (!session) {
    return;
  }

  if (event.type === "status") {
    session.status = event.phase;
  }

  if (event.type === "screen.updated") {
    session.screen = event.screen;
  }

  for (const client of session.clients) {
    writeEvent(client, event);
  }
}

function createSession() {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    clients: new Set(),
    screen: createHomeScreen("sequence", 0),
    status: "waiting",
    inputFlowMode: "sequence",
    scenarioCursor: 0,
    lastRandomScenarioIndex: -1
  });
  return sessionId;
}

function getNextInputScenario(session) {
  if (session.inputFlowMode === "random") {
    let nextIndex = Math.floor(Math.random() * autoInputScenarioActions.length);

    if (autoInputScenarioActions.length > 1 && nextIndex === session.lastRandomScenarioIndex) {
      nextIndex = (nextIndex + 1) % autoInputScenarioActions.length;
    }

    session.lastRandomScenarioIndex = nextIndex;
    return autoInputScenarioActions[nextIndex];
  }

  const scenario = autoInputScenarioActions[session.scenarioCursor % autoInputScenarioActions.length];
  session.scenarioCursor = (session.scenarioCursor + 1) % autoInputScenarioActions.length;
  return scenario;
}

function isTaskScenario(actionId) {
  return actionId === "show-plan" || actionId === "show-timeline";
}

function isProcessingScenario(actionId) {
  return isTaskScenario(actionId) || actionId === "show-direct";
}

function broadcastRootScreen(sessionId, screen) {
  broadcast(sessionId, { type: "screen.updated", screen: applyFlow(screen, createRootFlow()) });
  broadcast(sessionId, { type: "status", phase: "waiting" });
}

function broadcastResolvedScreen(sessionId, screen, requestId) {
  broadcast(sessionId, {
    type: "screen.updated",
    screen: requestId ? applyFlow(screen, createCompletedFlow(requestId)) : screen
  });
  broadcast(sessionId, { type: "status", phase: "waiting" });
}

async function runRemoteTaskScenario(sessionId, actionId, requestId) {
  if (actionId === "show-plan") {
    broadcast(sessionId, {
      type: "screen.updated",
      screen: createProcessingStageScreen(
        "remote-plan-processing",
        "Generated task plan",
        "Processing request",
        "The remote harness is analyzing the request before opening a task workspace.",
        requestId
      )
    });
    await delay(220);
    broadcast(sessionId, { type: "screen.updated", screen: createPlanScaffoldScreen(requestId) });
    await delay(360);
    broadcast(sessionId, { type: "screen.updated", screen: createPlanSettlingScreen(requestId) });
    await delay(760);
    broadcastResolvedScreen(sessionId, createPlanResultScreen(), requestId);
    return;
  }

  if (actionId === "show-timeline") {
    broadcast(sessionId, {
      type: "screen.updated",
      screen: createProcessingStageScreen(
        "remote-timeline-processing",
        "Task timeline",
        "Processing request",
        "The remote harness is organizing execution stages before opening the task timeline.",
        requestId
      )
    });
    await delay(220);
    const timelineScreen = createTimelineIntroScreen(requestId);
    broadcast(sessionId, { type: "screen.updated", screen: timelineScreen });
    await delay(360);
    broadcast(sessionId, {
      type: "screen.patched",
      screenId: timelineScreen.id,
      operations: createTimelineStreamingPatchOperations()
    });
    await delay(360);
    broadcast(sessionId, {
      type: "screen.patched",
      screenId: timelineScreen.id,
      operations: createTimelineFinalizingPatchOperations()
    });
    await delay(520);
    broadcastResolvedScreen(sessionId, createTimelineResultScreen(), requestId);
  }
}

async function runRemoteDirectResultScenario(sessionId, requestId) {
  broadcast(sessionId, {
    type: "screen.updated",
    screen: createProcessingStageScreen(
      "remote-direct-processing",
      "Direct result surface",
      "Processing request",
      "The remote harness is resolving the request and will return a final result without opening an intermediate task workspace.",
      requestId
    )
  });
  await delay(320);
  broadcastResolvedScreen(sessionId, createDirectResultScreen(), requestId);
}

async function runRemoteAction(sessionId, actionId, requestId, payload) {
  const session = ensureSession(sessionId);

  if (!session) {
    return;
  }

  if (isTaskScenario(actionId)) {
    await runRemoteTaskScenario(sessionId, actionId, requestId);
    return;
  }

  if (actionId === "show-direct") {
    await runRemoteDirectResultScenario(sessionId, requestId);
    return;
  }

  if (actionId === "show-flow-lab") {
    broadcastResolvedScreen(sessionId, createFlowLabScreen(), requestId);
    return;
  }

  if (actionId === "show-verification") {
    broadcastResolvedScreen(sessionId, createVerificationBoardScreen(), requestId);
    return;
  }

  if (actionId === "show-playground") {
    broadcastResolvedScreen(sessionId, createRuntimePlaygroundScreen(), requestId);
    return;
  }

  if (actionId === "show-request-inspector") {
    const requestTarget =
      typeof payload?.requestTarget === "string"
        ? payload.requestTarget
        : typeof payload?.requestId === "string"
          ? payload.requestId
          : "current";
    broadcast(sessionId, {
      type: "navigation.updated",
      navigation: {
        surface: "request-inspector",
        visibility: "open",
        requestTarget
      }
    });
    return;
  }

  if (actionId === "inspect-current-request") {
    broadcast(sessionId, {
      type: "navigation.updated",
      navigation: {
        surface: "request-inspector",
        visibility: "open",
        requestTarget: "current"
      }
    });
    return;
  }

  if (actionId === "inspect-last-completed-request") {
    broadcast(sessionId, {
      type: "navigation.updated",
      navigation: {
        surface: "request-inspector",
        visibility: "open",
        requestTarget: "lastCompleted"
      }
    });
    return;
  }

  if (actionId.startsWith("inspect-request-")) {
    const requestTarget =
      typeof payload?.requestTarget === "string"
        ? payload.requestTarget
        : typeof payload?.requestId === "string"
          ? payload.requestId
          : "current";
    broadcast(sessionId, {
      type: "navigation.updated",
      navigation: {
        surface: "request-inspector",
        visibility: "open",
        requestTarget
      }
    });
    return;
  }

  if (actionId === "show-brief") {
    broadcastResolvedScreen(sessionId, createTaskBriefScreen(), requestId);
    return;
  }

  if (actionId === "show-day-planner") {
    broadcastResolvedScreen(sessionId, createDayPlannerScreen(), requestId);
    return;
  }

  if (actionId === "show-grocery") {
    broadcastResolvedScreen(sessionId, createGroceryRunScreen(), requestId);
    return;
  }

  if (actionId === "show-trip") {
    broadcastResolvedScreen(sessionId, createTravelCompanionScreen(), requestId);
    return;
  }

  if (actionId === "show-wellness") {
    broadcastResolvedScreen(sessionId, createWellnessCheckInScreen(), requestId);
    return;
  }

  if (actionId === "show-log") {
    broadcastResolvedScreen(sessionId, createEventLogScreen(), requestId);
    return;
  }

  if (actionId === "show-workspace") {
    broadcastResolvedScreen(sessionId, createGroupedWorkspaceScreen(), requestId);
    return;
  }

  if (actionId === "show-split") {
    broadcastResolvedScreen(sessionId, createSplitWorkspaceScreen(), requestId);
    return;
  }

  if (actionId === "show-form") {
    broadcastResolvedScreen(sessionId, createFormScreen(), requestId);
    return;
  }

  if (actionId === "show-ops-board") {
    broadcastResolvedScreen(sessionId, createOpsBoardScreen(), requestId);
    return;
  }

  if (actionId === "preview-asset") {
    broadcastResolvedScreen(
      sessionId,
      createResourceScreen(linkedArtifact, "Resource block sent by the remote harness"),
      requestId
    );
    return;
  }

  if (actionId === "show-report") {
    broadcastResolvedScreen(
      sessionId,
      createResourceScreen(reportArtifact, "HTML artifact sent through the same schema surface"),
      requestId
    );
    return;
  }

  if (actionId === "show-pdf") {
    broadcastResolvedScreen(
      sessionId,
      createResourceScreen(pdfArtifact, "PDF artifact sent through the same schema surface"),
      requestId
    );
    return;
  }

  if (actionId === "request-microphone") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_microphone_remote_demo",
        capability: "microphone",
        reason: "The remote harness wants to demonstrate the capability bridge flow."
      }
    });
    return;
  }

  if (actionId === "request-camera") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_camera_remote_demo",
        capability: "camera",
        reason: "The remote harness wants to validate the default camera bridge payload.",
        payload: {
          mode: "image",
          facing: "rear"
        }
      }
    });
    return;
  }

  if (actionId === "request-photo-library") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_photo_library_remote_demo",
        capability: "photo-library",
        reason: "The remote harness wants to validate the default photo-library bridge payload.",
        payload: {
          accept: "image/*",
          selectionMode: "single"
        }
      }
    });
    return;
  }

  if (actionId === "request-location") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_location_remote_demo",
        capability: "location",
        reason: "The remote harness wants to validate the default location bridge payload.",
        payload: {
          accuracy: "city",
          purpose: "routing context"
        }
      }
    });
    return;
  }

  if (actionId === "request-file-picker") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_file_picker_remote_demo",
        capability: "file-picker",
        reason: "The remote harness wants to validate the default file-picker bridge payload.",
        payload: {
          accept: "text/plain,application/json",
          selectionMode: "single"
        }
      }
    });
    return;
  }

  if (actionId === "request-open-url") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_open_url_remote_demo",
        capability: "open-url",
        reason: "The remote harness wants to open a linked surface through the default renderer bridge.",
        payload: {
          title: "Unstable UI repository",
          url: "https://github.com/SelfMeAI/unstable-ui"
        }
      }
    });
    return;
  }

  if (actionId === "request-share") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: requestId ?? "cap_share_remote_demo",
        capability: "share",
        reason: "The remote harness wants to forward a generated summary into the native share sheet.",
        payload: {
          title: "Share runtime summary",
          message: "Unstable UI remote harness flow is ready for the next iteration.",
          url: "https://github.com/SelfMeAI/unstable-ui"
        }
      }
    });
    return;
  }

  if (actionId === "simulate-error") {
    broadcast(sessionId, {
      type: "error",
      message: "Mock remote harness failure: the planner exceeded its staging window before the next UI update."
    });
    return;
  }

  if (actionId === "set-input-flow-sequence") {
    session.inputFlowMode = "sequence";
    broadcastRootScreen(sessionId, createHomeScreen(session.inputFlowMode, session.scenarioCursor));
    return;
  }

  if (actionId === "set-input-flow-random") {
    session.inputFlowMode = "random";
    broadcastRootScreen(sessionId, createHomeScreen(session.inputFlowMode, session.scenarioCursor));
    return;
  }

  if (actionId === "back-home") {
    broadcastRootScreen(sessionId, createHomeScreen(session.inputFlowMode, session.scenarioCursor));
  }
}

async function handleClientEvent(sessionId, event) {
  const session = ensureSession(sessionId);

  if (!session) {
    return;
  }

  if (event.type === "voice.input" || event.type === "input.submitted") {
    const nextScenario = getNextInputScenario(session);

    broadcast(sessionId, { type: "status", phase: "thinking" });
    await delay(260);
    broadcast(sessionId, { type: "status", phase: "running" });
    await delay(180);
    await runRemoteAction(sessionId, nextScenario.id, event.clientRequestId);
    return;
  }

  if (event.type === "artifact.requested") {
    broadcast(sessionId, { type: "status", phase: "running" });
    await delay(180);
    broadcast(sessionId, {
      type: "artifact.available",
      artifact: getDemoArtifact(event.artifactId)
    });
    broadcast(sessionId, { type: "status", phase: "waiting" });
    return;
  }

  if (event.type === "navigation.changed") {
    broadcast(sessionId, {
      type: "navigation.updated",
      navigation: event.navigation
    });
    return;
  }

  if (event.type === "capability.resolved") {
    broadcastResolvedScreen(
      sessionId,
      createCapabilityResultScreen(event.requestId, event.payload?.granted, event.payload),
      event.requestId
    );
    return;
  }

  if (event.type === "form.submitted") {
    broadcast(sessionId, { type: "status", phase: "thinking" });
    broadcast(sessionId, {
      type: "screen.updated",
      screen: createFormProcessingScreen(event.values, event.clientRequestId)
    });
    await delay(220);
    broadcast(sessionId, { type: "status", phase: "running" });
    broadcast(sessionId, {
      type: "screen.updated",
      screen: createFormSettlingScreen(event.values, event.clientRequestId)
    });
    await delay(760);
    broadcastResolvedScreen(sessionId, createFormResultScreen(event.values), event.clientRequestId);
    return;
  }

  if (event.type !== "action.triggered") {
    return;
  }

  if (isProcessingScenario(event.actionId)) {
    broadcast(sessionId, { type: "status", phase: "thinking" });
    await delay(180);
    broadcast(sessionId, { type: "status", phase: "running" });
  }

  await runRemoteAction(sessionId, event.actionId, event.clientRequestId, event.payload);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/session/start") {
    const sessionId = createSession();
    json(res, 200, {
      sessionId,
      streamUrl: `/session/${sessionId}/stream`,
      eventUrl: `/session/${sessionId}/event`
    });
    return;
  }

  if (pathParts[0] === "session" && pathParts[2] === "stream" && req.method === "GET") {
    const sessionId = pathParts[1];
    const session = ensureSession(sessionId);

    if (!session) {
      json(res, 404, { error: "Session not found." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });

    session.clients.add(res);
    writeEvent(res, { type: "session.started", sessionId });
    writeEvent(res, { type: "status", phase: session.status });
    writeEvent(res, { type: "screen.updated", screen: session.screen });

    req.on("close", () => {
      session.clients.delete(res);
      res.end();
    });
    return;
  }

  if (pathParts[0] === "session" && pathParts[2] === "event" && req.method === "POST") {
    const sessionId = pathParts[1];
    const session = ensureSession(sessionId);

    if (!session) {
      json(res, 404, { error: "Session not found." });
      return;
    }

    try {
      const event = await readJson(req);
      await handleClientEvent(sessionId, event);
      json(res, 202, { accepted: true });
    } catch (error) {
      json(res, 400, {
        error: error instanceof Error ? error.message : "Invalid JSON payload."
      });
    }
    return;
  }

  json(res, 404, { error: "Not found." });
});

server.listen(port, () => {
  console.log(`demo-harness listening on http://127.0.0.1:${port}`);
});
