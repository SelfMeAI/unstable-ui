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
