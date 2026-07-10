import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const protocol = require("@selfme/unstable-ui-protocol");
const harness = require("@selfme/unstable-ui-harness-sdk");
const runtime = require("@selfme/unstable-ui-runtime");
const protocolEsm = await import("@selfme/unstable-ui-protocol");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const failedScreen = harness.createErrorScreen(
  {
    id: "package-smoke-failure",
    blocks: []
  },
  {},
  harness.createFailedScreenFlow("req_package_smoke")
);
const lifecycle = protocol.resolveScreenLifecycle(failedScreen);
const requestId = runtime.resolveRuntimeRequestId(
  {
    flow: {
      lastFailedRequestId: "req_package_smoke"
    }
  },
  "lastFailed"
);
const failedEntries = runtime.getRuntimeLastFailedRequestEntries({
  flow: {
    lastFailedRequestId: "req_package_smoke"
  },
  history: [
    {
      id: "package-smoke-entry",
      timestamp: new Date().toISOString(),
      role: "system",
      kind: "error",
      title: "Package smoke failure",
      requestId: "req_package_smoke"
    }
  ]
});
const errorScreenSummary = runtime.summarizeRuntimeRequestEntries(
  [
    {
      id: "package-smoke-error-screen",
      timestamp: new Date().toISOString(),
      role: "assistant",
      kind: "workspace",
      title: "Package smoke error screen",
      requestId: "req_package_smoke",
      screenMode: "error"
    }
  ],
  "req_package_smoke"
);

assert(typeof protocolEsm.resolveScreenLifecycle === "function", "ESM protocol entry did not load.");
assert(failedScreen.flow?.state === "failed", "Error helper did not create a failed flow.");
assert(lifecycle.role === "final" && lifecycle.isTerminal, "Failed flow did not resolve as terminal.");
assert(requestId === "req_package_smoke", "lastFailed target did not resolve.");
assert(failedEntries.length === 1, "lastFailed history query did not resolve its chain.");
assert(errorScreenSummary.hasError, "An error screen was not classified as a failed-chain signal.");

console.log("Package smoke passed: CommonJS, ESM, failed flow, lastFailed history, and error-screen classification.");
