# unstable-ui Protocol v0.1

## Status

Draft for public integration.

This document defines the current protocol surface between a harness and the `unstable-ui` React Native framework. The protocol is event-driven and schema-based. It does not allow executable UI code.

## Design Goals

- Keep the protocol transport-agnostic.
- Support local, remote, and hybrid harnesses.
- Drive UI through constrained schema blocks instead of arbitrary components.
- Treat artifacts and device capabilities as first-class concepts.

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
  "audioUri": "file:///local/session/voice.m4a"
}
```

### `action.triggered`

Reports a user action from the rendered UI.

```json
{
  "type": "action.triggered",
  "actionId": "show-plan"
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
  blocks: Block[];
};
```

## Supported Blocks in v0.1

- `text`
- `card`
- `list`
- `actions`
- `resource`

The first release intentionally keeps the built-in block set constrained.

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

- `v0.1` uses full screen replacement through `screen.updated`.
- Streaming screen patches are intentionally out of scope for this draft.
- The protocol is position-agnostic: the harness may run locally, remotely, or in a hybrid topology.
