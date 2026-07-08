# unstable-ui

`unstable-ui` is a React Native framework for agent and harness driven interfaces.

The project ships as reusable npm packages. A demo Expo app lives in the repo as a reference shell.

## Packages

- `@selfme/unstable-ui`: default install entry that re-exports the framework surface.
- `@selfme/unstable-ui-protocol`: shared event, screen, artifact, and capability schemas.
- `@selfme/unstable-ui-harness-sdk`: adapter interfaces for local, remote, and hybrid harnesses.
- `@selfme/unstable-ui-runtime`: session lifecycle and runtime state management.
- `@selfme/unstable-ui-core-blocks`: default block implementations for the built-in schema.
- `@selfme/unstable-ui-renderer`: the default React Native renderer and runtime view.

## Repo Layout

```txt
apps/
  demo-expo/
packages/
  unstable-ui/
  protocol/
  harness-sdk/
  runtime/
  core-blocks/
  renderer/
```

## Install

```bash
npm install @selfme/unstable-ui
```

## Minimal Usage

```tsx
import { AgentRuntimeView, createLocalHarness } from "@selfme/unstable-ui";

const harness = createLocalHarness({
  bootstrap(emit) {
    emit({
      type: "screen.updated",
      screen: {
        id: "welcome",
        title: "Agent Runtime",
        blocks: [
          { id: "intro", type: "text", value: "Runtime connected." }
        ]
      }
    });
  }
});

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} />;
}
```

Use the split packages only when you want tighter control over which layer you consume.

## Remote Harness Starter

The harness SDK now includes a first-party HTTP + SSE adapter for the repo's recommended remote shape:

```tsx
import { AgentRuntimeView, createRemoteHttpSseHarness } from "@selfme/unstable-ui";

const harness = createRemoteHttpSseHarness({
  baseUrl: "http://127.0.0.1:8787"
});

export function RemoteAssistantScreen() {
  return <AgentRuntimeView harness={harness} />;
}
```

The Expo demo can switch to the remote harness automatically:

```bash
PORT=8787 npm run start --workspace @selfme/unstable-ui-demo-harness
EXPO_PUBLIC_UNSTABLE_UI_HARNESS_BASE_URL=http://127.0.0.1:8787 npm run start --workspace @selfme/unstable-ui-demo-expo
```

If you want the remote adapter to reconnect to the same server-side session, add a session store:

```tsx
import { createRemoteHttpSseHarness, type RemoteSessionStore } from "@selfme/unstable-ui";

const sessionStore: RemoteSessionStore = {
  load: async () => undefined,
  save: async (session) => {
    console.log(session.sessionId);
  }
};

const harness = createRemoteHttpSseHarness({
  baseUrl: "http://127.0.0.1:8787",
  sessionStore
});
```

For remote task flows, the recommended baseline is to emit explicit screen phases instead of jumping directly from one static page to another:

1. emit a `processing` screen when the request starts
2. emit a `task` screen if the harness needs an intermediate workspace
3. emit another `task` or `processing` screen while finalizing if needed
4. emit a `result` screen when the request is complete

Attach `screen.flow.requestId` to the same request across those screens so the runtime can treat them as one continuous page flow.

That same `requestId` now also drives request-aware history grouping in the runtime and renderer, so the demo's History view and Runtime playground can inspect one request chain instead of only flat event rows.

Both demos also expose a `Flow lab` surface so you can manually trigger the current baseline flows from one place:

- `processing -> result`
- `processing -> task -> finalizing -> result`
- `approval -> result`
- `form -> processing -> finalizing -> result`

Both demos also include a verification layer that is split across two surfaces:

- `Runtime playground`
- `Verification board`

The `Runtime playground` embeds:

- `runtime.history`
- `runtime.requestIndex`
- `runtime.artifacts`
- `runtime.capabilityRequests`
- `runtime.capabilityHistory`
- `runtime.bridge`
- `runtime.requestIndexSummary`
- `runtime.lastCapabilityResolution`
- `runtime.currentRequest`
- `runtime.currentRequestResources`
- `runtime.currentRequestHistory`
- `runtime.currentRequestResourceHistory`
- `runtime.lastCompletedRequest`
- `runtime.lastCompletedRequestResources`
- `runtime.lastCompletedRequestHistory`
- `runtime.lastCompletedRequestResourceHistory`
- generic request-target sources driven by `requestTarget`, including `runtime.request`, `runtime.requestResources`, `runtime.requestHistory`, `runtime.requestResourceHistory`, `runtime.requestAssertions`, `runtime.requestMatrix`, and `runtime.requestVerdict`
- `runtime.eventLog`
- runtime flow / interaction / session details
- resource bridge test blocks

The same request-aware projections are now also exported from `@selfme/unstable-ui-runtime` as reusable query helpers, including catalog, summary, resource, and request-target resolvers such as `getRuntimeRequestCatalog`, `getRuntimeRequestGroup`, and `resolveRuntimeRequestChain`.

The `Verification board` turns the current runtime state into request-level checks:

- request-chain summaries
- inferred flow profile (`direct`, `staged`, `patched`, `approval`, `form`)
- assertion rows for the active or last completed request
- verification matrix data
- top-level verdict (`Pass`, `Needs review`, `Idle`)

The timeline flow in both demos now exercises real `screen.patched` updates instead of only full-screen swaps, so verification can inspect patch counts, resource events, and issue signals at the request level.

The harness SDK also exports screen helpers so harness authors do not need to rebuild `mode`, `flow`, and `interaction` objects by hand:

```tsx
import {
  createProcessingScreen,
  createResultScreen,
  createOngoingScreenFlow,
  createCompletedScreenFlow
} from "@selfme/unstable-ui";

const processingScreen = createProcessingScreen(
  {
    id: "task-processing",
    title: "Workspace request",
    blocks: [{ id: "processing-copy", type: "text", value: "Preparing the next workspace." }]
  },
  {
    input: "locked",
    actions: "locked",
    forms: "locked",
    reason: "The harness is still processing the request."
  },
  createOngoingScreenFlow("req_123")
);

const resultScreen = createResultScreen(
  {
    id: "task-result",
    title: "Workspace request",
    blocks: [{ id: "result-copy", type: "text", value: "The workspace is ready." }]
  },
  {},
  createCompletedScreenFlow("req_123")
);
```

## Artifact Handlers

The default renderer also accepts artifact handlers so a host app can customize preview, open, share, and download behavior by artifact kind:

```tsx
import { AgentRuntimeView, type ArtifactHandlers } from "@selfme/unstable-ui";

const artifactHandlers: ArtifactHandlers = {
  html: {
    preview: (artifact) => ({
      title: artifact.title,
      description: "Custom host preview for HTML artifacts.",
      fields: [{ label: "Surface", value: artifact.uri }],
      openLabel: "Open report"
    }),
    share: async (artifact, context) => {
      console.log(artifact.id);
      await context.shareWithSystem();
    }
  }
};

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} artifactHandlers={artifactHandlers} />;
}
```

Without a custom handler, the renderer now includes built-in defaults for:

- artifact inline preview data
  If an artifact includes `preview.text`, `preview.summary`, `preview.thumbnailUri`, or preview `fields`, the default preview sheet renders that data directly.

- artifact `share`
  Opens the native share sheet with the artifact URI.

- artifact `download`
  Falls back to the system URL handler for downloadable artifact kinds.

Capability handlers work the same way for device-bridge requests:

```tsx
import { AgentRuntimeView, type CapabilityHandlers } from "@selfme/unstable-ui";

const capabilityHandlers: CapabilityHandlers = {
  microphone: {
    describe: () => ({
      title: "Microphone bridge",
      primaryLabel: "Grant access",
      secondaryLabel: "Not now"
    }),
    resolve: async (_request, granted) => ({
      payload: {
        bridge: "host-app",
        granted
      }
    })
  }
};

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} capabilityHandlers={capabilityHandlers} />;
}
```

If you want to intercept system-facing bridge behavior without attaching per-artifact or per-capability handlers, pass `hostBridge`:

```tsx
import { AgentRuntimeView, type HostBridge } from "@selfme/unstable-ui";

const hostBridge: HostBridge = {
  openUrl: async (url, context) => {
    console.log(context.reason, url);
  },
  share: async (payload, context) => {
    console.log(context.reason, payload.url ?? payload.message);
  },
  resolveCapability: async (request, granted, context) => {
    if (!granted) {
      return {
        payload: {
          bridge: "host-app",
          granted: false
        }
      };
    }

    return {
      payload: {
        ...(context.defaultPayload ?? {}),
        bridge: "host-app"
      }
    };
  }
};

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} hostBridge={hostBridge} />;
}
```

Without a custom handler, the renderer now includes built-in defaults for:

- `open-url`
  Opens the requested `payload.url` or `payload.uri` with the system browser.

- `share`
  Opens the native share sheet from `payload.title`, `payload.message`, and `payload.url`.

- `microphone`, `camera`, `photo-library`, `location`, `file-picker`
  Return explicit default mock resolution payloads when no host-specific capability handler is registered.

## Voice Shell Configuration

If you want to keep the built-in floating shell but tune its copy, default mode, and recent-input behavior, pass `voiceShell`:

```tsx
import { AgentRuntimeView, type VoiceShellOptions } from "@selfme/unstable-ui";

const voiceShell: VoiceShellOptions = {
  defaultInputMode: "voice",
  promptLabel: "Voice-first shell for the runtime.",
  idleLabel: "Hold to talk",
  textPlaceholder: "Type a request",
  talkButtonLabel: "Speak",
  listeningButtonLabel: "Release",
  textSubmitLabel: "Send",
  recentInputHeadingLabel: "Recent",
  recentInputCollapsedLabel: "LAST",
  recentInputExpandedLabel: "HIDE",
  recentInputPreviewDurationMs: 2400
};

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} voiceShell={voiceShell} />;
}
```

## Custom Input Shell

The default input shell can also be replaced by the host app. The renderer still owns the workspace surface and the session history entry; the host app only swaps the bottom input control:

```tsx
import { AgentRuntimeView, type VoiceShellRenderProps } from "@selfme/unstable-ui";
import { Pressable, Text, TextInput, View } from "react-native";

function CustomVoiceShell(props: VoiceShellRenderProps) {
  return (
    <View>
      <Text>{props.statusLabel}</Text>
      <Text>{props.promptLabel}</Text>
      {props.inputMode === "text" ? (
        <View>
          <TextInput
            value={props.textValue}
            onChangeText={props.onChangeText}
            placeholder={props.textPlaceholder}
            editable={!props.disabled}
            onSubmitEditing={props.onSubmitText}
          />
          <Pressable disabled={props.disabled || props.submitDisabled} onPress={props.onSubmitText}>
            <Text>Send</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable disabled={props.disabled} onPressIn={props.onPressIn} onPressOut={props.onPressOut}>
          <Text>{props.actionLabel}</Text>
        </Pressable>
      )}
      <Pressable onPress={props.onToggleInputMode}>
        <Text>{props.secondaryActionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} renderVoiceShell={(props) => <CustomVoiceShell {...props} />} />;
}
```

The default renderer exposes a top-right `History` entry so the main surface can stay workspace-first instead of falling back to a chat transcript by default.

## Form Blocks

The built-in block set now includes `form`, so a harness can request structured input without dropping down to a custom native screen:

```tsx
import type { ScreenSchema } from "@selfme/unstable-ui";

const screen: ScreenSchema = {
  id: "task-intake",
  blocks: [
    {
      id: "task-form",
      type: "form",
      title: "Task intake",
      submitLabel: "Submit",
      fields: [
        {
          id: "goal",
          kind: "text",
          label: "Primary goal",
          required: true
        },
        {
          id: "constraints",
          kind: "multiline",
          label: "Constraints"
        }
      ]
    }
  ]
};
```

When the user submits the block, the runtime emits a `form.submitted` client event with the `formId` and field values.

## Timeline Blocks

The built-in block set also includes `timeline`, which is useful for staged agent execution, progress history, and resumable task views:

```tsx
import type { ScreenSchema } from "@selfme/unstable-ui";

const screen: ScreenSchema = {
  id: "task-timeline",
  blocks: [
    {
      id: "timeline-1",
      type: "timeline",
      title: "Execution flow",
      items: [
        {
          id: "capture",
          title: "Capture intent",
          status: "complete"
        },
        {
          id: "plan",
          title: "Build plan",
          status: "active"
        },
        {
          id: "deliver",
          title: "Deliver workspace",
          status: "pending"
        }
      ]
    }
  ]
};
```

`timeline` works well with either `screen.patched` or full-screen replacements inside the same `screen.flow.requestId`, depending on whether the harness wants incremental updates or explicit stage surfaces.

## Details Blocks

The built-in block set also includes `details`, which is useful for compact task briefs, summary cards, and structured result metadata:

```tsx
import type { ScreenSchema } from "@selfme/unstable-ui";

const screen: ScreenSchema = {
  id: "task-brief",
  blocks: [
    {
      id: "brief-1",
      type: "details",
      title: "Workspace snapshot",
      items: [
        {
          id: "owner",
          label: "Owner",
          value: "runtime"
        },
        {
          id: "status",
          label: "Status",
          value: "ready",
          tone: "success"
        }
      ]
    }
  ]
};
```

## Log Blocks

The built-in block set also includes `log`. It can render static entries from the harness or resolve directly from the client runtime when `source` is set to `runtime.eventLog`:

```tsx
import type { ScreenSchema } from "@selfme/unstable-ui";

const screen: ScreenSchema = {
  id: "event-log",
  blocks: [
    {
      id: "log-1",
      type: "log",
      title: "Recent events",
      source: "runtime.eventLog",
      maxItems: 20
    }
  ]
};
```

This is useful for debug workspaces, transport inspection, and resume diagnostics without wiring a separate host-only panel.

## Section Blocks

The built-in block set also includes `section`, which groups a one-level set of child blocks under a shared heading:

```tsx
import type { ScreenSchema } from "@selfme/unstable-ui";

const screen: ScreenSchema = {
  id: "grouped-workspace",
  blocks: [
    {
      id: "summary-section",
      type: "section",
      title: "Summary",
      blocks: [
        {
          id: "summary-details",
          type: "details",
          items: [
            {
              id: "status",
              label: "Status",
              value: "ready",
              tone: "success"
            }
          ]
        }
      ]
    }
  ]
};
```

`section` is intentionally limited to one level of nesting in `v0.1`, which keeps the protocol constrained while still allowing grouped workspaces.

## Split Blocks

The built-in block set also includes `split`, which organizes a screen into two panes for primary/secondary workspace layouts:

```tsx
import type { ScreenSchema } from "@selfme/unstable-ui";

const screen: ScreenSchema = {
  id: "split-workspace",
  blocks: [
    {
      id: "split-root",
      type: "split",
      ratio: "primary",
      panes: [
        {
          id: "primary",
          blocks: [
            {
              id: "primary-details",
              type: "details",
              items: [
                {
                  id: "status",
                  label: "Status",
                  value: "ready",
                  tone: "success"
                }
              ]
            }
          ]
        },
        {
          id: "secondary",
          blocks: [
            {
              id: "secondary-log",
              type: "log",
              source: "runtime.eventLog"
            }
          ]
        }
      ]
    }
  ]
};
```

On compact screens the panes stack vertically. On wider layouts the renderer switches to a side-by-side split.

## Runtime Persistence And Event Log

The runtime also accepts a persistence adapter and exposes an event log through `useAgentRuntime()`:

```tsx
import { AgentRuntimeView, useAgentRuntime, type RuntimePersistenceAdapter } from "@selfme/unstable-ui";

const persistence: RuntimePersistenceAdapter = {
  load: async () => undefined,
  save: async (snapshot) => {
    console.log(snapshot.eventLog);
  }
};

function DebugPanel() {
  const runtime = useAgentRuntime();
  return <>{runtime.eventLog.length}</>;
}

export function AssistantScreen() {
  return <AgentRuntimeView harness={harness} runtimeOptions={{ persistence }} />;
}
```

`details` can also be resolved from runtime sources such as `runtime.flow`, `runtime.interaction`, and `runtime.session` when the host app needs a framework-native debug or inspection surface.

## Development

```bash
npm install
npm run typecheck
npm run build
```

Run the Expo demo:

```bash
npm install
npm run start --workspace @selfme/unstable-ui-demo-expo
```

## Publishing

Package publishing is maintainer-operated and wired around Changesets and GitHub Actions.

The current release flow is:

1. The maintainer records release changes with Changesets when a package version should move.
2. Package versions are updated from the workspace before release.
3. Publishing runs from CI with a repository-level `NPM_TOKEN`.

Only maintainers with access to the npm scope and repository secrets can publish packages.
