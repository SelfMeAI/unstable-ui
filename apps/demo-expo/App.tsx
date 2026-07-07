import {
  AgentRuntimeView,
  type ArtifactHandlers,
  type CapabilityHandlers
} from "@selfme/unstable-ui-renderer";
import {
  createLocalHarness,
  createRemoteHttpSseHarness,
  type LocalHarnessOptions,
  type RemoteSessionSnapshot,
  type RemoteSessionStore
} from "@selfme/unstable-ui-harness-sdk";
import {
  type ArtifactRef,
  type ScreenInteraction,
  type ScreenMode,
  type ScreenPatchOperation,
  type ScreenSchema
} from "@selfme/unstable-ui-protocol";
import type { RuntimePersistenceAdapter, RuntimeSnapshot } from "@selfme/unstable-ui-runtime";

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
    case reportArtifact.id:
      return reportArtifact;
    case linkedArtifact.id:
    default:
      return linkedArtifact;
  }
}

type InputFlowMode = "sequence" | "random";
type DemoEmit = Parameters<NonNullable<LocalHarnessOptions["bootstrap"]>>[0];

const defaultScreenInteraction: ScreenInteraction = {
  input: "enabled",
  actions: "enabled",
  forms: "enabled",
  artifacts: "enabled",
  history: "enabled"
};

function withScreenState(
  screen: Omit<ScreenSchema, "mode" | "interaction">,
  mode: ScreenMode,
  interaction: Partial<ScreenInteraction> = {}
): ScreenSchema {
  return {
    ...screen,
    mode,
    interaction: {
      ...defaultScreenInteraction,
      ...interaction
    }
  };
}

function createStableScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction">,
  interaction: Partial<ScreenInteraction> = {}
) {
  return withScreenState(screen, "stable", interaction);
}

function createTaskScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction">,
  interaction: Partial<ScreenInteraction> = {}
) {
  return withScreenState(screen, "task", interaction);
}

function createResultScreen(
  screen: Omit<ScreenSchema, "mode" | "interaction">,
  interaction: Partial<ScreenInteraction> = {}
) {
  return withScreenState(screen, "result", interaction);
}

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
  { id: "request-microphone", label: "Microphone bridge" },
  { id: "simulate-error", label: "Harness error" }
] as const;

const quickTestActions = [
  { id: "show-plan", label: "Test staged plan" },
  { id: "show-timeline", label: "Test timeline" },
  { id: "show-workspace", label: "Test workspace" },
  { id: "show-form", label: "Test form" }
] as const;

const autoInputScenarioActions = [
  ...everydayScenarioActions,
  ...workspaceScenarioActions,
  { id: "preview-asset", label: "Link artifact" },
  { id: "show-report", label: "HTML report" }
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

function buildPlanScaffoldScreen(): ScreenSchema {
  return createTaskScreen(
    {
    id: "plan",
    title: "Generated task plan",
    subtitle: "Streaming plan blocks",
    blocks: [
      {
        id: "plan-intro",
        type: "text",
        value: "The harness has started planning and is streaming the workspace in stages."
      },
      {
        id: "plan-status",
        type: "card",
        title: "Plan stream",
        body: "Collecting steps and preparing follow-up actions."
      }
    ]
    },
    {
      input: "locked",
      actions: "locked",
      forms: "locked",
      reason: "The harness is still building the task plan."
    }
  );
}

function buildPlanPatchOperations(): ScreenPatchOperation[] {
  return [
    {
      type: "set_subtitle" as const,
      subtitle: "Returned by the local harness"
    },
    {
      type: "upsert_block" as const,
      block: {
        id: "plan-status",
        type: "card" as const,
        title: "Plan stream",
        body: "The harness incrementally patched the workspace instead of replacing the full screen."
      }
    },
    {
      type: "append_blocks" as const,
      blocks: [
        {
          id: "list-1",
          type: "list" as const,
          items: [
            { id: "a", title: "Capture voice input", description: "Hold-to-talk shell entry point." },
            { id: "b", title: "Stream harness events", description: "Drive UI from protocol events." },
            { id: "c", title: "Render blocks", description: "Translate schema into native components." },
            { id: "d", title: "Bridge artifacts", description: "Return preview/open resources without breaking transport boundaries." }
          ]
        },
        {
          id: "actions-2",
          type: "actions" as const,
          items: [
            { id: "show-report", label: "Show report" },
            { id: "preview-asset", label: "Preview artifact" },
            { id: "back-home", label: "Back home" }
          ]
        }
      ]
    },
    {
      type: "set_interaction" as const,
      interaction: {
        ...defaultScreenInteraction
      }
    }
  ];
}

function buildTimelineIntroScreen(): ScreenSchema {
  return createTaskScreen(
    {
    id: "task-timeline",
    title: "Task timeline",
    subtitle: "Streaming step progression",
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
    }
  );
}

function buildTimelinePatchOperations(): ScreenPatchOperation[] {
  return [
    {
      type: "set_subtitle" as const,
      subtitle: "Returned by the local harness with incremental timeline updates"
    },
    {
      type: "upsert_block" as const,
      block: {
        id: "timeline-block",
        type: "timeline" as const,
        title: "Execution flow",
        description: "The harness patched stage progress without replacing the entire workspace.",
        items: [
          {
            id: "timeline-step-capture",
            title: "Capture intent",
            description: "Voice or form input has been normalized into structured task context.",
            status: "complete" as const,
            meta: "done"
          },
          {
            id: "timeline-step-plan",
            title: "Build plan",
            description: "The harness decomposed the request into actionable workspace stages.",
            status: "complete" as const,
            meta: "done"
          },
          {
            id: "timeline-step-artifacts",
            title: "Prepare artifacts",
            description: "Report surfaces and resource links were attached to the next workspace.",
            status: "active" as const,
            meta: "streaming"
          },
          {
            id: "timeline-step-wait",
            title: "Wait for follow-up",
            description: "The runtime is now ready for another action or voice request.",
            status: "pending" as const,
            meta: "next"
          }
        ]
      }
    },
    {
      type: "append_blocks" as const,
      blocks: [
        {
          id: "timeline-actions",
          type: "actions" as const,
          items: [
            { id: "show-report", label: "Show report" },
            { id: "preview-asset", label: "Preview artifact" },
            { id: "back-home", label: "Back home" }
          ]
        }
      ]
    },
    {
      type: "set_interaction" as const,
      interaction: {
        ...defaultScreenInteraction
      }
    }
  ];
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
        id: "intake-form-actions",
        type: "actions",
        items: [{ id: "back-home", label: "Back home" }]
      }
    ]
  });
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
          { id: "back-home", label: "Back home" }
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
        items: [{ id: "back-home", label: "Back home" }]
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
        items: [{ id: "back-home", label: "Back home" }]
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

  function emitResolvedScreen(screen: ScreenSchema, emit: DemoEmit) {
    emit({ type: "screen.updated", screen });
    emit({ type: "status", phase: "waiting" });
  }

  async function runTaskScenario(actionId: string, emit: DemoEmit) {
    if (actionId === "show-plan") {
      const scaffold = buildPlanScaffoldScreen();
      emit({ type: "screen.updated", screen: scaffold });
      await delay(340);
      emit({
        type: "screen.patched",
        screenId: scaffold.id,
        operations: buildPlanPatchOperations()
      });
      emit({ type: "status", phase: "waiting" });
      return;
    }

    if (actionId === "show-timeline") {
      const scaffold = buildTimelineIntroScreen();
      emit({ type: "screen.updated", screen: scaffold });
      await delay(340);
      emit({
        type: "screen.patched",
        screenId: scaffold.id,
        operations: buildTimelinePatchOperations()
      });
      emit({ type: "status", phase: "waiting" });
    }
  }

  async function runLocalAction(actionId: string, emit: DemoEmit) {
    if (isTaskScenario(actionId)) {
      await runTaskScenario(actionId, emit);
      return;
    }

    if (actionId === "show-brief") {
      emitResolvedScreen(buildTaskBriefScreen(), emit);
      return;
    }

    if (actionId === "show-day-planner") {
      emitResolvedScreen(buildDayPlannerScreen(), emit);
      return;
    }

    if (actionId === "show-grocery") {
      emitResolvedScreen(buildGroceryRunScreen(), emit);
      return;
    }

    if (actionId === "show-trip") {
      emitResolvedScreen(buildTravelCompanionScreen(), emit);
      return;
    }

    if (actionId === "show-wellness") {
      emitResolvedScreen(buildWellnessCheckInScreen(), emit);
      return;
    }

    if (actionId === "show-log") {
      emitResolvedScreen(buildEventLogScreen(), emit);
      return;
    }

    if (actionId === "show-workspace") {
      emitResolvedScreen(buildGroupedWorkspaceScreen(), emit);
      return;
    }

    if (actionId === "show-split") {
      emitResolvedScreen(buildSplitWorkspaceScreen(), emit);
      return;
    }

    if (actionId === "show-form") {
      emitResolvedScreen(buildFormScreen(), emit);
      return;
    }

    if (actionId === "show-ops-board") {
      emitResolvedScreen(buildOpsBoardScreen(), emit);
      return;
    }

    if (actionId === "preview-asset") {
      emitResolvedScreen(buildResourceScreen(linkedArtifact, "Resource block wired through the protocol"), emit);
      return;
    }

    if (actionId === "show-report") {
      emitResolvedScreen(
        buildResourceScreen(reportArtifact, "HTML artifact sent through the same schema surface"),
        emit
      );
      return;
    }

    if (actionId === "request-microphone") {
      emit({
        type: "capability.requested",
        request: {
          id: "cap_microphone_demo",
          capability: "microphone",
          reason: "The local harness wants to demonstrate the capability bridge flow."
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
      emitResolvedScreen(buildLocalHomeScreen(), emit);
      return;
    }

    if (actionId === "set-input-flow-random") {
      inputFlowMode = "random";
      emitResolvedScreen(buildLocalHomeScreen(), emit);
      return;
    }

    if (actionId === "back-home") {
      emitResolvedScreen(buildLocalHomeScreen(), emit);
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
        await runLocalAction(nextScenario.id, emit);
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
          emit
        );
        return;
      }

      if (event.type === "form.submitted") {
        emit({ type: "status", phase: "running" });
        await delay(180);
        emit({
          type: "screen.updated",
          screen: buildFormResultScreen(event.values)
        });
        emit({ type: "status", phase: "waiting" });
        return;
      }

      if (event.type !== "action.triggered") {
        return;
      }

      if (isTaskScenario(event.actionId)) {
        emit({ type: "status", phase: "thinking" });
        await delay(180);
        emit({ type: "status", phase: "running" });
      }

      await runLocalAction(event.actionId, emit);
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
  return (
    <AgentRuntimeView
      harness={harness}
      artifactHandlers={demoArtifactHandlers}
      capabilityHandlers={demoCapabilityHandlers}
      runtimeOptions={{
        persistence: demoRuntimePersistence
      }}
    />
  );
}
