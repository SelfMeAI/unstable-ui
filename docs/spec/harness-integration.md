# unstable-ui Harness Integration

## Overview

`unstable-ui` accepts local, remote, and hybrid harness implementations through a shared adapter model.

The framework is responsible for runtime state, schema rendering, artifact handling, and capability bridging on the React Native side. The harness is responsible for producing events and screen schema.

## Current Integration Modes

- `createLocalHarness`
  Use this for in-app mock flows, local task orchestration, and fast UI iteration.

- `createRemoteHttpSseHarness`
  Use this when the agent or workflow runs outside the client and streams events back to the app.

- Hybrid harness
  Use this when part of the flow stays on-device and part of the flow executes remotely behind the same protocol surface.

## Recommended Starter Path

1. Start with `@selfme/unstable-ui` as the default install entry.
2. Build against a local harness first.
3. Validate block schema, action round-trips, and artifact handling in the demo app.
4. Move to a remote harness after the event flow is stable.

## Recommended Remote Flow Shape

For remote harnesses, the current recommended baseline is an explicit screen lifecycle:

1. Emit a `status` event such as `thinking` or `running`.
2. Emit a `screen.updated` event with `screen.mode = "processing"` and a shared `screen.flow.requestId`.
3. If the request needs an intermediate workspace, emit a `screen.updated` event with `screen.mode = "task"` and the same `screen.flow.requestId`.
4. If the harness needs a final sealing stage, emit one more `processing` or `task` screen with the same request id.
5. Emit the final `screen.updated` event with `screen.mode = "result"` and `screen.flow.state = "complete"`.
6. Return runtime interaction to normal by unlocking the screen and sending `status = "waiting"`.

This keeps remote, local, and hybrid harnesses aligned on one page-flow model. It also gives the animation layer a stable set of transition hooks later, instead of forcing animation to infer intent from arbitrary screen swaps.

It also means the runtime can group `history` entries by request instead of treating every input, task page, result page, and artifact handoff as unrelated rows.

After `input.submitted`, `voice.input`, `action.triggered`, or `form.submitted`, the runtime enters a request `pending` phase immediately and locks input, actions, and forms. The lock remains until the harness emits an active or completed screen flow, an explicit capability decision, or an error. Harnesses should therefore send their first `status` or `screen.updated` event promptly rather than relying on renderer-local debounce behavior.

An unscoped stable `screen.updated` is treated as a root reset by the runtime and releases any pending request. Prefer an explicit `flow.transition = "root"` for that reset so renderers and host transition hooks can identify it directly.

## Flow Metadata

Use `screen.flow` whenever a screen belongs to an in-flight request:

- `requestId`
  Use the incoming `clientRequestId` when available so the runtime can associate multiple screens with one user action.

- `state`
  Use `ongoing` for processing or task surfaces, `complete` for a final result surface, and `failed` for a terminal error surface.

- `transition`
  Use `replace` for staged pages inside a request. Use `root` only when resetting to a new top-level surface such as the home workspace.

If the harness keeps one workspace alive while it advances internal steps, prefer `screen.patched` over full replacement so the runtime can measure real incremental progress instead of only final page swaps.

## Derived Lifecycle Roles

The protocol exposes `resolveScreenLifecycle(screen)`, a derived helper shared by runtime and renderer. It does not add another mutable screen field: lifecycle is always resolved from the existing `mode` and `flow` metadata.

- `root`: a top-level stable surface that is not part of an active request
- `transient`: a processing surface while the harness is preparing the next page
- `intermediate`: an active task or approval workspace
- `final`: a completed result or error surface

This is the recommended signal for transition systems. A renderer or host animation can react to `lifecycleRole` from `RendererTransitionHooks` without guessing intent from arbitrary screen ids or block changes.

## Harness SDK Helpers

The harness SDK now exports screen helpers for the most common page-flow cases:

- `createStableScreen`
- `createProcessingScreen`
- `createTaskScreen`
- `createResultScreen`
- `createErrorScreen`
- `createRootScreenFlow`
- `createOngoingScreenFlow`
- `createCompletedScreenFlow`
- `createFailedScreenFlow`
- `applyScreenFlow`

Use them when you want the harness implementation to stay focused on content instead of hand-assembling `mode`, `flow`, and `interaction` objects for each screen.

## Demo References

- `apps/demo-expo`
  Shows the local harness path, the default runtime shell, a `Flow lab` surface for baseline page-flow testing, a `Runtime playground` surface for embedded history/event-log inspection, and a `Verification board` surface for request-level checks.

- `apps/demo-harness`
  Shows a minimal remote HTTP + SSE harness server with staged task, direct-result, form, and patched timeline flows plus the same `Runtime playground` and `Verification board` surfaces.

## Verification Surfaces

The runtime now exposes a verification layer that harness authors can use while stabilizing flows:

- request-aware history grouped by `screen.flow.requestId`
- active and last-completed request snapshots, plus a `lastFailed` request target for error-chain inspection
- request metrics for history, workspace, patch, resource, and issue counts
- derived assertions, matrix rows, and a top-level verdict
- bridge-facing runtime sources for artifact inventory and pending capability queues
- bridge-facing integration sources for host-registered bridge methods and handler coverage
- bridge-facing routing sources for effective per-path bridge resolution
- bridge-facing renderer diagnostics for artifact and capability bridge failures
- bridge-facing assertion and verdict sources for artifact-inventory and capability-accounting checks
- persistence-facing runtime sources for hydration, save state, and local-cache diagnostics
- transport-facing runtime sources for reconnect, disconnect, and connection-attempt diagnostics
- recovery-facing runtime sources for reset / hydrate / reconnect consistency diagnostics, including assertion rows and a top-level verdict
- request-scoped resource queries for the active and last completed request chains
- request index sources that summarize every grouped request chain in the runtime history
- request index action sources that let hosts jump directly from the catalog into one request chain
- request stage replay timeline sources that let hosts visualize one request chain as a runtime-derived sequence
- request stage summary sources that let hosts inspect per-stage event, resource, patch, and issue metrics

These are runtime projections. A harness does not need to emit extra verification events to benefit from them.

A request with a terminal error screen or error event is classified as a failed flow. Its verifier verdict is `Failed`, which is distinct from `Needs review`: the former describes task outcome, while the latter indicates that the observed protocol chain does not match its expected lifecycle.

The runtime package also exports request query helpers for these projections, including `getRuntimeLastFailedRequestEntries(...)`, so custom renderers or host diagnostics can reuse the same request catalog, request-target resolver, resource query, and summary logic directly from `@selfme/unstable-ui-runtime`. When persistence is enabled, the runtime snapshot also keeps the last-completed and last-failed request ids so those inspector targets survive a restore.

The default renderer now also exposes a host-level imperative surface through `AgentRuntimeViewHandle`. A host app can open grouped history or a request inspector programmatically with `openHistory()`, `closeHistory()`, `openRequestInspector(target)`, and `closeRequestInspector()`.
It can also clear the persisted runtime snapshot with `clearPersistence()` when the persistence adapter supports `clear()`, reconnect the harness with `reconnect()`, and fully reset the live runtime with `resetSession()`.

For runtime diagnostics, the built-in renderer now also exposes focused log sources for these lifecycle controls: `runtime.sessionLog`, `runtime.transportLog`, and `runtime.persistenceLog`.

Those overlays now also participate in the protocol. Renderer-initiated history and request-inspector transitions emit `navigation.changed`, and a harness can synchronize or drive the same surfaces with `navigation.updated`.

The built-in request inspector now supports explicit `requestId` drill-down, and the built-in history overlay can jump directly from grouped request rows into that inspector.

If the host also needs overlay-state synchronization, pass `navigationHooks`. The current hooks surface includes `onRequestInspectorChange` and `onHistoryVisibilityChange`.

## Notes

The current React Native track is optimized for a minimal but real integration loop:

- fixed input shell with voice / text switching
- workspace-first surface with a separate session history entry
- request-aware history entries tied back to the active `screen.flow.requestId`
- request-aware verification views for the active and last completed request
- schema-driven screen rendering
- action round-trip
- structured form round-trip
- explicit `processing -> result` and `processing -> task -> finalizing -> result` remote page flows
- real `screen.patched` progression for incremental workspace updates
- minimal artifact preview/open/share/download behavior
- minimal capability request / resolve flow

The default renderer now includes built-in bridge behavior for:

- artifact `share`
- artifact `download`
- capability `open-url`
- capability `share`
- mock capability resolution for `microphone`, `camera`, `photo-library`, `location`, and `file-picker`

So a host app does not need a custom handler just to demo those common system actions.

The renderer now also honors `interaction.history`. If a harness or host locks history for a screen, the fixed `History` entry becomes unavailable until that lock is released.

The default renderer also supports a middle path for input-shell integration:

- pass `voiceShell` when you want to keep the built-in floating shell but adjust copy, default mode, and recent-input behavior
- pass `renderVoiceShell` only when the host app needs to replace the bottom shell UI completely

There is now also a middle path for host bridge integration:

- pass `hostBridge` when the host app wants to intercept open-url, share, download/open fallback, or default capability resolution behavior without rewriting the higher-level renderer handlers
- use `createHostBridge(...)` when the host only needs `openUrl`, `share`, or a simple capability payload override without hand-writing full `resolveCapability()` boilerplate
- keep `artifactHandlers` and `capabilityHandlers` for resource-kind or capability-specific UI and resolution customizations
- use `createArtifactPreviewHandlers(...)` when the host only needs preview overrides by artifact kind
- use `createCapabilityHandlers(...)` when the host wants prompt descriptors plus simple payload overrides without hand-writing full `resolve()` functions
- use `createHostIntegration(...)` when the host wants one builder that combines preview overrides, capability presets, and host bridge wiring into a single integration object

It is intended as a starter integration surface, not yet a full production integration kit.
