import { AgentRuntimeView } from "@selfme/unstable-ui-renderer";
import { createLocalHarness } from "@selfme/unstable-ui-harness-sdk";
import type { ScreenSchema } from "@selfme/unstable-ui-protocol";

const homeScreen: ScreenSchema = {
  id: "home",
  title: "unstable-ui",
  subtitle: "Press and hold the voice shell to drive the workspace",
  blocks: [
    {
      id: "intro",
      type: "text" as const,
      value: "The runtime is ready. Use the bottom voice shell or trigger one of the sample actions."
    },
    {
      id: "card-1",
      type: "card" as const,
      title: "Current mode",
      body: "Local harness with a fixed voice shell and built-in core blocks."
    },
    {
      id: "actions-1",
      type: "actions" as const,
      items: [
        { id: "show-plan", label: "Show sample plan" },
        { id: "preview-asset", label: "Preview asset" },
        { id: "request-microphone", label: "Request microphone" }
      ]
    }
  ]
};

function buildVoiceResultScreen(transcript: string): ScreenSchema {
  return {
    id: "voice-result",
    title: "Voice task result",
    subtitle: "Returned from the local harness after voice.input",
    blocks: [
      {
        id: "voice-intro",
        type: "text",
        value: `Received voice input: "${transcript}"`
      },
      {
        id: "voice-card",
        type: "card",
        title: "Interpreted request",
        body: "The harness treated this as a task request and generated a temporary workspace."
      },
      {
        id: "voice-list",
        type: "list",
        items: [
          {
            id: "voice-step-1",
            title: "Capture intent",
            description: "Voice input was converted into a structured client event."
          },
          {
            id: "voice-step-2",
            title: "Plan next actions",
            description: "The harness switched into thinking mode and built a task-oriented screen."
          },
          {
            id: "voice-step-3",
            title: "Wait for follow-up",
            description: "The runtime is ready for another hold-to-talk input or an explicit action."
          }
        ]
      },
      {
        id: "voice-actions",
        type: "actions",
        items: [
          { id: "preview-asset", label: "Show linked artifact" },
          { id: "back-home", label: "Back home" }
        ]
      }
    ]
  };
}

const harness = createLocalHarness({
  bootstrap(emit) {
    emit({ type: "session.started", sessionId: "demo-session" });
    emit({ type: "status", phase: "waiting" });
    emit({
      type: "screen.updated",
      screen: homeScreen
    });
  },
  handleClientEvent(event, emit) {
    if (event.type === "voice.input") {
      emit({ type: "status", phase: "thinking" });
      emit({
        type: "screen.updated",
        screen: buildVoiceResultScreen(event.transcript)
      });
      emit({ type: "status", phase: "waiting" });
      return;
    }

    if (event.type === "artifact.requested") {
      emit({ type: "status", phase: "running" });
      emit({
        type: "artifact.available",
        artifact: {
          id: event.artifactId,
          kind: "link",
          uri: "https://github.com",
          source: "remote",
          title: "GitHub",
          previewable: true,
          openable: true
        }
      });
      emit({ type: "status", phase: "waiting" });
      return;
    }

    if (event.type === "capability.resolved") {
      emit({
        type: "screen.updated",
        screen: {
          id: "capability-result",
          title: "Capability result",
          subtitle: "Returned after capability.resolved",
          blocks: [
            {
              id: "capability-text",
              type: "text",
              value: `Capability request ${event.requestId} resolved with granted=${String(event.payload?.granted)}.`
            },
            {
              id: "capability-actions",
              type: "actions",
              items: [{ id: "back-home", label: "Back home" }]
            }
          ]
        }
      });
      return;
    }

    if (event.type !== "action.triggered") {
      return;
    }

    if (event.actionId === "show-plan") {
      emit({ type: "status", phase: "thinking" });
      emit({
        type: "screen.updated",
        screen: {
          id: "plan",
          title: "Generated task plan",
          subtitle: "Returned by the local harness",
          blocks: [
            {
              id: "list-1",
              type: "list",
              items: [
                { id: "a", title: "Capture voice input", description: "Hold-to-talk shell entry point." },
                { id: "b", title: "Stream harness events", description: "Drive UI from protocol events." },
                { id: "c", title: "Render blocks", description: "Translate schema into native components." }
              ]
            },
            {
              id: "actions-2",
              type: "actions",
              items: [
                { id: "preview-asset", label: "Preview asset" },
                { id: "back-home", label: "Back home" }
              ]
            }
          ]
        }
      });
      emit({ type: "status", phase: "waiting" });
      return;
    }

    if (event.actionId === "preview-asset") {
      emit({
        type: "screen.updated",
        screen: {
          id: "artifact-screen",
          title: "Artifact preview",
          subtitle: "Resource block wired through the protocol",
          blocks: [
            {
              id: "resource-1",
              type: "resource",
              resource: {
                id: "artifact-1",
                kind: "link",
                uri: "https://github.com",
                source: "remote",
                title: "GitHub",
                previewable: true,
                openable: true
              }
            },
            {
              id: "actions-3",
              type: "actions",
              items: [{ id: "back-home", label: "Back home" }]
            }
          ]
        }
      });
      return;
    }

    if (event.actionId === "request-microphone") {
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

    if (event.actionId === "back-home") {
      emit({
        type: "screen.updated",
        screen: homeScreen
      });
    }
  }
});

export default function App() {
  return <AgentRuntimeView harness={harness} />;
}
