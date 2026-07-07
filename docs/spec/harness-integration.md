# unstable-ui Harness Integration

## Overview

`unstable-ui` accepts local, remote, and hybrid harness implementations through a shared adapter model.

The framework is responsible for runtime state, schema rendering, artifact handling, and capability bridging on the React Native side. The harness is responsible for producing events and screen schema.

## Current Integration Modes

- `createLocalHarness`
  Use this for in-app mock flows, local task orchestration, and fast UI iteration.

- `createRemoteHarness`
  Use this when the agent or workflow runs outside the client and streams events back to the app.

- Hybrid harness
  Use this when part of the flow stays on-device and part of the flow executes remotely behind the same protocol surface.

## Recommended Starter Path

1. Start with `@selfme/unstable-ui` as the default install entry.
2. Build against a local harness first.
3. Validate block schema, action round-trips, and artifact handling in the demo app.
4. Move to a remote harness after the event flow is stable.

## Demo References

- `apps/demo-expo`
  Shows the local harness path and the default runtime shell.

- `apps/demo-harness`
  Shows a minimal remote HTTP + SSE harness server.

## Notes

The current React Native track is optimized for a minimal but real integration loop:

- fixed voice shell
- schema-driven screen rendering
- action round-trip
- minimal artifact preview/open behavior
- minimal capability request / resolve flow

It is intended as a starter integration surface, not yet a full production integration kit.
