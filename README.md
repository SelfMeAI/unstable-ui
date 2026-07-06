# unstable-ui

`unstable-ui` is a React Native framework for agent and harness driven interfaces.

The project ships as reusable npm packages. A demo Expo app lives in the repo as a reference shell.

## Packages

- `@unstable-ui/protocol`: shared event, screen, artifact, and capability schemas.
- `@unstable-ui/harness-sdk`: adapter interfaces for local, remote, and hybrid harnesses.
- `@unstable-ui/runtime`: session lifecycle and runtime state management.
- `@unstable-ui/core-blocks`: default block implementations for the built-in schema.
- `@unstable-ui/renderer`: the default React Native renderer and runtime view.

## Repo Layout

```txt
apps/
  demo-expo/
packages/
  protocol/
  harness-sdk/
  runtime/
  core-blocks/
  renderer/
```

## Install

```bash
npm install @unstable-ui/protocol @unstable-ui/harness-sdk @unstable-ui/runtime @unstable-ui/renderer
```

## Minimal Usage

```tsx
import { createLocalHarness } from "@unstable-ui/harness-sdk";
import { AgentRuntimeView } from "@unstable-ui/renderer";

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

## Development

```bash
npm install
npm run typecheck
npm run build
```

Run the Expo demo:

```bash
npm install
npm run start --workspace @unstable-ui/demo-expo
```

## Publishing

Package publishing is wired around Changesets and GitHub Actions.

1. Create a changeset: `npm run changeset`
2. Version packages: `npm run version-packages`
3. Publish from CI with `NPM_TOKEN` configured

The default package scope is `@unstable-ui`. Set the scope you own before the first publish.
