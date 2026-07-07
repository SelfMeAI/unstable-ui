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

function withScreenState(screen, mode, interaction = {}) {
  return {
    ...screen,
    mode,
    interaction: {
      ...defaultScreenInteraction,
      ...interaction
    }
  };
}

function createStableScreen(screen, interaction = {}) {
  return withScreenState(screen, "stable", interaction);
}

function createTaskScreen(screen, interaction = {}) {
  return withScreenState(screen, "task", interaction);
}

function createResultScreen(screen, interaction = {}) {
  return withScreenState(screen, "result", interaction);
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
  { id: "request-microphone", label: "Microphone bridge" },
  { id: "simulate-error", label: "Harness error" }
];

const quickTestActions = [
  { id: "show-plan", label: "Test staged plan" },
  { id: "show-timeline", label: "Test timeline" },
  { id: "show-workspace", label: "Test workspace" },
  { id: "show-form", label: "Test form" }
];

const autoInputScenarioActions = [
  ...everydayScenarioActions,
  ...workspaceScenarioActions,
  { id: "preview-asset", label: "Link artifact" },
  { id: "show-report", label: "HTML report" }
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

function createPlanScaffoldScreen() {
  return createTaskScreen(
    {
    id: "remote-plan",
    title: "Generated task plan",
    subtitle: "Streaming plan blocks",
    blocks: [
      {
        id: "plan-intro",
        type: "text",
        value: "The remote harness has started planning and is streaming the workspace in stages."
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

function createPlanPatchOperations() {
  return [
    {
      type: "set_subtitle",
      subtitle: "Returned by the remote harness"
    },
    {
      type: "upsert_block",
      block: {
        id: "plan-status",
        type: "card",
        title: "Plan stream",
        body: "The remote harness incrementally patched the workspace instead of replacing the full screen."
      }
    },
    {
      type: "append_blocks",
      blocks: [
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
    },
    {
      type: "set_interaction",
      interaction: {
        ...defaultScreenInteraction
      }
    }
  ];
}

function createTimelineIntroScreen() {
  return createTaskScreen(
    {
    id: "remote-task-timeline",
    title: "Task timeline",
    subtitle: "Streaming step progression",
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
    }
  );
}

function createTimelinePatchOperations() {
  return [
    {
      type: "set_subtitle",
      subtitle: "Returned by the remote harness with incremental timeline updates"
    },
    {
      type: "upsert_block",
      block: {
        id: "timeline-block",
        type: "timeline",
        title: "Execution flow",
        description: "The harness patched stage progress without replacing the entire workspace.",
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
            description: "Report surfaces and resource links were attached to the next workspace.",
            status: "active",
            meta: "streaming"
          },
          {
            id: "timeline-step-wait",
            title: "Wait for follow-up",
            description: "The runtime is now ready for another action or voice request.",
            status: "pending",
            meta: "next"
          }
        ]
      }
    },
    {
      type: "append_blocks",
      blocks: [
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
    },
    {
      type: "set_interaction",
      interaction: {
        ...defaultScreenInteraction
      }
    }
  ];
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

function broadcastHomeScreen(sessionId, session) {
  broadcast(sessionId, {
    type: "screen.updated",
    screen: createHomeScreen(session.inputFlowMode, session.scenarioCursor)
  });
}

function isTaskScenario(actionId) {
  return actionId === "show-plan" || actionId === "show-timeline";
}

function broadcastResolvedScreen(sessionId, screen) {
  broadcast(sessionId, { type: "screen.updated", screen });
  broadcast(sessionId, { type: "status", phase: "waiting" });
}

async function runRemoteTaskScenario(sessionId, actionId) {
  if (actionId === "show-plan") {
    const scaffold = createPlanScaffoldScreen();
    broadcast(sessionId, { type: "screen.updated", screen: scaffold });
    await delay(340);
    broadcast(sessionId, {
      type: "screen.patched",
      screenId: scaffold.id,
      operations: createPlanPatchOperations()
    });
    broadcast(sessionId, { type: "status", phase: "waiting" });
    return;
  }

  if (actionId === "show-timeline") {
    const scaffold = createTimelineIntroScreen();
    broadcast(sessionId, { type: "screen.updated", screen: scaffold });
    await delay(340);
    broadcast(sessionId, {
      type: "screen.patched",
      screenId: scaffold.id,
      operations: createTimelinePatchOperations()
    });
    broadcast(sessionId, { type: "status", phase: "waiting" });
  }
}

async function runRemoteAction(sessionId, actionId) {
  const session = ensureSession(sessionId);

  if (!session) {
    return;
  }

  if (isTaskScenario(actionId)) {
    await runRemoteTaskScenario(sessionId, actionId);
    return;
  }

  if (actionId === "show-brief") {
    broadcastResolvedScreen(sessionId, createTaskBriefScreen());
    return;
  }

  if (actionId === "show-day-planner") {
    broadcastResolvedScreen(sessionId, createDayPlannerScreen());
    return;
  }

  if (actionId === "show-grocery") {
    broadcastResolvedScreen(sessionId, createGroceryRunScreen());
    return;
  }

  if (actionId === "show-trip") {
    broadcastResolvedScreen(sessionId, createTravelCompanionScreen());
    return;
  }

  if (actionId === "show-wellness") {
    broadcastResolvedScreen(sessionId, createWellnessCheckInScreen());
    return;
  }

  if (actionId === "show-log") {
    broadcastResolvedScreen(sessionId, createEventLogScreen());
    return;
  }

  if (actionId === "show-workspace") {
    broadcastResolvedScreen(sessionId, createGroupedWorkspaceScreen());
    return;
  }

  if (actionId === "show-split") {
    broadcastResolvedScreen(sessionId, createSplitWorkspaceScreen());
    return;
  }

  if (actionId === "show-form") {
    broadcastResolvedScreen(sessionId, createFormScreen());
    return;
  }

  if (actionId === "show-ops-board") {
    broadcastResolvedScreen(sessionId, createOpsBoardScreen());
    return;
  }

  if (actionId === "preview-asset") {
    broadcastResolvedScreen(
      sessionId,
      createResourceScreen(linkedArtifact, "Resource block sent by the remote harness")
    );
    return;
  }

  if (actionId === "show-report") {
    broadcastResolvedScreen(
      sessionId,
      createResourceScreen(reportArtifact, "HTML artifact sent through the same schema surface")
    );
    return;
  }

  if (actionId === "request-microphone") {
    broadcast(sessionId, {
      type: "capability.requested",
      request: {
        id: "cap_microphone_remote_demo",
        capability: "microphone",
        reason: "The remote harness wants to demonstrate the capability bridge flow."
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
    broadcastHomeScreen(sessionId, session);
    broadcast(sessionId, { type: "status", phase: "waiting" });
    return;
  }

  if (actionId === "set-input-flow-random") {
    session.inputFlowMode = "random";
    broadcastHomeScreen(sessionId, session);
    broadcast(sessionId, { type: "status", phase: "waiting" });
    return;
  }

  if (actionId === "back-home") {
    broadcastHomeScreen(sessionId, session);
    broadcast(sessionId, { type: "status", phase: "waiting" });
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
    await runRemoteAction(sessionId, nextScenario.id);
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

  if (event.type === "capability.resolved") {
    broadcastResolvedScreen(
      sessionId,
      createCapabilityResultScreen(event.requestId, event.payload?.granted, event.payload)
    );
    return;
  }

  if (event.type === "form.submitted") {
    broadcast(sessionId, { type: "status", phase: "running" });
    await delay(180);
    broadcast(sessionId, {
      type: "screen.updated",
      screen: createFormResultScreen(event.values)
    });
    broadcast(sessionId, { type: "status", phase: "waiting" });
    return;
  }

  if (event.type !== "action.triggered") {
    return;
  }

  if (isTaskScenario(event.actionId)) {
    broadcast(sessionId, { type: "status", phase: "thinking" });
    await delay(180);
    broadcast(sessionId, { type: "status", phase: "running" });
  }

  await runRemoteAction(sessionId, event.actionId);
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
