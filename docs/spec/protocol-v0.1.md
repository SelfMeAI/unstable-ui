# unstable-ui Protocol v0.1

## Status

Draft for public integration.

This document defines the current protocol surface between a harness and the `unstable-ui` React Native framework. The protocol is event-driven and schema-based. It does not allow executable UI code.

## Design Goals

- Keep the protocol transport-agnostic.
- Support local, remote, and hybrid harnesses.
- Drive UI through constrained schema blocks instead of arbitrary components.
- Treat artifacts and device capabilities as first-class concepts.
- Make request lifecycle and page transitions explicit enough for runtime control.
- Preserve enough request metadata for runtime inspection and verification.

## Harness Events

### `session.started`

Indicates that a session has been created.

```json
{
  "type": "session.started",
  "sessionId": "demo-session"
}
```

### `status`

Updates the runtime phase.

Supported phases in `v0.1`:

- `idle`
- `listening`
- `thinking`
- `waiting`
- `running`
- `complete`

```json
{
  "type": "status",
  "phase": "thinking"
}
```

### `screen.updated`

Replaces the current screen schema.

```json
{
  "type": "screen.updated",
  "screen": {
    "id": "home",
    "title": "unstable-ui",
    "subtitle": "Agent-driven interface demo",
    "blocks": [
      {
        "id": "intro",
        "type": "text",
        "value": "The runtime is ready."
      }
    ]
  }
}
```

### `screen.patched`

Applies incremental updates to the current screen when the `screenId` matches.

```json
{
  "type": "screen.patched",
  "screenId": "home",
  "operations": [
    {
      "type": "set_subtitle",
      "subtitle": "Streaming additional blocks"
    },
    {
      "type": "append_blocks",
      "blocks": [
        {
          "id": "next-step",
          "type": "text",
          "value": "A new block arrived without replacing the full screen."
        }
      ]
    }
  ]
}
```

Use `screen.patched` when a request is still evolving inside the same workspace and only part of the UI needs to change. The current demo baseline uses this for incremental timeline progression and request-level verification.

### `artifact.available`

Declares an artifact that can be previewed or opened.

```json
{
  "type": "artifact.available",
  "artifact": {
    "id": "artifact-1",
    "kind": "link",
    "uri": "https://github.com",
    "source": "remote",
    "title": "GitHub",
    "previewable": true,
    "openable": true
  }
}
```

### `capability.requested`

Requests a device capability from the client.

```json
{
  "type": "capability.requested",
  "request": {
    "id": "req_1",
    "capability": "microphone",
    "reason": "Voice input is required"
  }
}
```

### `error`

Returns a readable runtime error.

```json
{
  "type": "error",
  "message": "Failed to load artifact"
}
```

### `session.completed`

Marks the current task as complete.

```json
{
  "type": "session.completed"
}
```

## Client Events

### `session.start`

Starts a new session.

```json
{
  "type": "session.start",
  "input": "Plan my next trip"
}
```

### `voice.input`

Submits transcript text with an optional audio URI.

```json
{
  "type": "voice.input",
  "transcript": "Book a table for tomorrow",
  "audioUri": "file:///local/session/voice.m4a",
  "clientRequestId": "voice_123"
}
```

### `input.submitted`

Submits unified user input from the bottom shell. This is the preferred event for voice/text dual-mode clients.

```json
{
  "type": "input.submitted",
  "mode": "text",
  "text": "Summarize the latest workspace and propose next steps",
  "clientRequestId": "input_123"
}
```

For voice mode:

```json
{
  "type": "input.submitted",
  "mode": "voice",
  "text": "Plan my afternoon around one deep work block",
  "audioUri": "file:///local/session/voice.m4a",
  "clientRequestId": "input_124"
}
```

### `action.triggered`

Reports a user action from the rendered UI.

```json
{
  "type": "action.triggered",
  "actionId": "show-plan",
  "clientRequestId": "action_123"
}
```

### `form.submitted`

Returns structured values from a rendered `form` block.

```json
{
  "type": "form.submitted",
  "formId": "task-form",
  "clientRequestId": "form_123",
  "values": {
    "goal": "Ship the next runtime milestone",
    "constraints": "Need one review pass before publish"
  }
}
```

### `artifact.requested`

Requests an artifact operation from the client runtime.

Supported modes in `v0.1`:

- `preview`
- `open`
- `share`
- `download`

```json
{
  "type": "artifact.requested",
  "artifactId": "artifact-1",
  "mode": "open"
}
```

### `capability.resolved`

Returns the result of a device capability request.

```json
{
  "type": "capability.resolved",
  "requestId": "req_1",
  "payload": {
    "granted": true
  }
}
```

## Screen Schema

```ts
type Screen = {
  id: string;
  title?: string;
  subtitle?: string;
  mode?: "stable" | "processing" | "task" | "result" | "approval" | "error";
  flow?: {
    requestId?: string;
    parentRequestId?: string;
    state?: "ongoing" | "complete";
    transition?: "replace" | "root";
  };
  interaction?: {
    input?: "enabled" | "locked";
    actions?: "enabled" | "locked";
    forms?: "enabled" | "locked";
    artifacts?: "enabled" | "locked";
    history?: "enabled" | "locked";
    reason?: string;
  };
  blocks: Block[];
};
```

Lifecycle guidance:

- Use `mode = "processing"` for request entry shells.
- Use `mode = "task"` for intermediate task workspaces.
- Use `mode = "result"` for completed result surfaces.
- Reuse the same `flow.requestId` across all staged pages that belong to one request.
- Use `flow.transition = "root"` only for top-level resets such as returning home.

The current runtime baseline uses `flow.requestId` for more than animation hooks: it also powers request-aware history grouping, runtime inspection details, and staged page-flow debugging.

## Runtime-Derived Verification

The protocol stays event-driven. Verification views are derived by the runtime from normal protocol traffic plus `screen.flow` metadata, not from a second reporting channel.

Current request projections include:

- `runtime.currentRequest`
- `runtime.lastCompletedRequest`
- `runtime.currentRequestHistory`
- `runtime.lastCompletedRequestHistory`

Current request metrics include:

- `historyEntryCount`
- `workspaceEventCount`
- `patchEventCount`
- `resourceEventCount`
- `issueCount`

These derived views let local and remote harnesses share the same verification model while continuing to emit ordinary protocol events.

## Screen Patch Operations in v0.1

- `set_title`
- `set_subtitle`
- `replace_blocks`
- `append_blocks`
- `upsert_block`
- `remove_block`

## Supported Blocks in v0.1

- `text`
- `card`
- `list`
- `actions`
- `form`
- `timeline`
- `details`
- `log`
- `section`
- `split`
- `resource`

The first release intentionally keeps the built-in block set constrained.

### `form` Block

```json
{
  "id": "task-form",
  "type": "form",
  "title": "Task intake",
  "submitLabel": "Submit",
  "fields": [
    {
      "id": "goal",
      "kind": "text",
      "label": "Primary goal",
      "required": true
    },
    {
      "id": "constraints",
      "kind": "multiline",
      "label": "Constraints"
    }
  ]
}
```

### `timeline` Block

```json
{
  "id": "timeline-1",
  "type": "timeline",
  "title": "Execution flow",
  "items": [
    {
      "id": "capture",
      "title": "Capture intent",
      "status": "complete"
    },
    {
      "id": "plan",
      "title": "Build plan",
      "status": "active"
    },
    {
      "id": "deliver",
      "title": "Deliver workspace",
      "status": "pending"
    }
  ]
}
```

Supported item statuses in `v0.1`:

- `pending`
- `active`
- `complete`
- `error`

### `details` Block

```json
{
  "id": "brief-1",
  "type": "details",
  "title": "Workspace snapshot",
  "items": [
    {
      "id": "owner",
      "label": "Owner",
      "value": "runtime"
    },
    {
      "id": "status",
      "label": "Status",
      "value": "ready",
      "tone": "success"
    }
  ]
}
```

`details` can also be driven from built-in runtime sources:

- `runtime.flow`
- `runtime.interaction`
- `runtime.session`

Supported detail tones in `v0.1`:

- `default`
- `success`
- `warning`
- `danger`

### `log` Block

```json
{
  "id": "log-1",
  "type": "log",
  "title": "Recent events",
  "source": "runtime.eventLog",
  "maxItems": 20
}
```

`log` can be driven in two ways:

- `items`: the harness provides explicit log entries.
- `source`: the client runtime resolves a built-in source such as `runtime.eventLog`, `runtime.history`, or `runtime.currentRequestHistory`.

`details` can also resolve from `runtime.currentRequest` when the host app needs a compact summary of the active request-aware flow state.

Supported log tones in `v0.1`:

- `default`
- `success`
- `warning`
- `danger`

### `section` Block

```json
{
  "id": "summary-section",
  "type": "section",
  "title": "Summary",
  "blocks": [
    {
      "id": "summary-details",
      "type": "details",
      "items": [
        {
          "id": "status",
          "label": "Status",
          "value": "ready",
          "tone": "success"
        }
      ]
    }
  ]
}
```

`section` supports one level of nested child blocks in `v0.1`. Child blocks can be any built-in block except another `section`.

### `split` Block

```json
{
  "id": "split-root",
  "type": "split",
  "ratio": "primary",
  "panes": [
    {
      "id": "primary",
      "blocks": [
        {
          "id": "primary-details",
          "type": "details",
          "items": [
            {
              "id": "status",
              "label": "Status",
              "value": "ready",
              "tone": "success"
            }
          ]
        }
      ]
    },
    {
      "id": "secondary",
      "blocks": [
        {
          "id": "secondary-log",
          "type": "log",
          "source": "runtime.eventLog"
        }
      ]
    }
  ]
}
```

`split` supports exactly two panes in `v0.1`. Pane blocks can be any built-in block except another `split`.

Supported ratios in `v0.1`:

- `equal`
- `primary`
- `secondary`

## Artifact Schema

```ts
type ArtifactRef = {
  id: string;
  kind: "text" | "image" | "audio" | "video" | "pdf" | "html" | "file" | "link" | "json";
  uri: string;
  source: "local" | "remote";
  title?: string;
  mimeType?: string;
  previewable?: boolean;
  openable?: boolean;
  expiresAt?: string;
};
```

## Capability Types in v0.1

- `microphone`
- `camera`
- `photo-library`
- `location`
- `file-picker`
- `share`
- `open-url`

## Notes

- `v0.1` supports both full screen replacement through `screen.updated` and minimal incremental updates through `screen.patched`.
- Screen patches are intentionally constrained to a small set of metadata and block operations.
- The protocol is position-agnostic: the harness may run locally, remotely, or in a hybrid topology.
- The runtime now treats `screen.flow.requestId` as the primary request correlation key for staged page flows, history entries, and transition hooks.
- `interaction.history` is a real renderer control surface, not just protocol decoration. Hosts can lock the history entry when a flow requires it.
- The current baseline request flows are:
  - input -> processing -> task -> finalizing -> result
  - input -> processing -> direct result
  - action -> approval -> result
  - form -> processing -> finalizing -> result
