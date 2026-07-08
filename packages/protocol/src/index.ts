import { z } from "zod";

export const actionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  intent: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const artifactRefSchema = z.object({
  id: z.string(),
  kind: z.enum(["text", "image", "audio", "video", "pdf", "html", "file", "link", "json"]),
  uri: z.string(),
  source: z.enum(["local", "remote"]),
  title: z.string().optional(),
  mimeType: z.string().optional(),
  previewable: z.boolean().default(true),
  openable: z.boolean().default(true),
  expiresAt: z.string().optional()
});

export const capabilityRequestSchema = z.object({
  id: z.string(),
  capability: z.enum([
    "microphone",
    "camera",
    "photo-library",
    "location",
    "file-picker",
    "share",
    "open-url"
  ]),
  reason: z.string(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const textBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  value: z.string()
});

export const cardBlockSchema = z.object({
  id: z.string(),
  type: z.literal("card"),
  title: z.string(),
  body: z.string().optional()
});

export const listBlockSchema = z.object({
  id: z.string(),
  type: z.literal("list"),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional()
    })
  )
});

export const actionsBlockSchema = z.object({
  id: z.string(),
  type: z.literal("actions"),
  items: z.array(actionItemSchema)
});

export const formFieldSchema = z.object({
  id: z.string(),
  kind: z.enum(["text", "multiline"]),
  label: z.string(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  required: z.boolean().optional()
});

export const formBlockSchema = z.object({
  id: z.string(),
  type: z.literal("form"),
  title: z.string().optional(),
  description: z.string().optional(),
  submitLabel: z.string().optional(),
  fields: z.array(formFieldSchema).min(1)
});

export const timelineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["pending", "active", "complete", "error"]),
  meta: z.string().optional()
});

export const timelineBlockSchema = z.object({
  id: z.string(),
  type: z.literal("timeline"),
  title: z.string().optional(),
  description: z.string().optional(),
  items: z.array(timelineItemSchema).min(1)
});

export const detailItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  tone: z.enum(["default", "success", "warning", "danger"]).optional()
});

export const detailsBlockSchema = z.object({
  id: z.string(),
  type: z.literal("details"),
  title: z.string().optional(),
  description: z.string().optional(),
  source: z
    .enum([
      "runtime.flow",
      "runtime.interaction",
      "runtime.session",
      "runtime.currentRequest",
      "runtime.lastCompletedRequest",
      "runtime.currentRequestAssertions",
      "runtime.lastCompletedRequestAssertions",
      "runtime.currentRequestMatrix",
      "runtime.lastCompletedRequestMatrix",
      "runtime.currentRequestVerdict",
      "runtime.lastCompletedRequestVerdict"
    ])
    .optional(),
  items: z.array(detailItemSchema).optional()
}).refine((value) => value.source || value.items?.length, {
  message: "A details block requires either source or items."
});

export const logItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  meta: z.string().optional(),
  tone: z.enum(["default", "success", "warning", "danger"]).optional()
});

export const logBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal("log"),
    title: z.string().optional(),
    description: z.string().optional(),
    source: z
      .enum([
        "runtime.eventLog",
        "runtime.history",
        "runtime.currentRequestHistory",
        "runtime.lastCompletedRequestHistory"
      ])
      .optional(),
    maxItems: z.number().int().positive().optional(),
    emptyLabel: z.string().optional(),
    items: z.array(logItemSchema).optional()
  })
  .refine((value) => value.source || value.items?.length, {
    message: "A log block requires either source or items."
  });

export const resourceBlockSchema = z.object({
  id: z.string(),
  type: z.literal("resource"),
  resource: artifactRefSchema
});

export const leafBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  cardBlockSchema,
  listBlockSchema,
  actionsBlockSchema,
  formBlockSchema,
  timelineBlockSchema,
  detailsBlockSchema,
  logBlockSchema,
  resourceBlockSchema
]);

export const sectionBlockSchema = z.object({
  id: z.string(),
  type: z.literal("section"),
  title: z.string().optional(),
  description: z.string().optional(),
  blocks: z.array(leafBlockSchema).min(1)
});

export const nestableBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  cardBlockSchema,
  listBlockSchema,
  actionsBlockSchema,
  formBlockSchema,
  timelineBlockSchema,
  detailsBlockSchema,
  logBlockSchema,
  resourceBlockSchema,
  sectionBlockSchema
]);

export const splitPaneSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  blocks: z.array(nestableBlockSchema).min(1)
});

export const splitBlockSchema = z.object({
  id: z.string(),
  type: z.literal("split"),
  title: z.string().optional(),
  description: z.string().optional(),
  ratio: z.enum(["equal", "primary", "secondary"]).optional(),
  panes: z.array(splitPaneSchema).min(2).max(2)
});

export const screenModeSchema = z.enum(["stable", "processing", "task", "result", "approval", "error"]);

export const screenFlowStateSchema = z.enum(["ongoing", "complete"]);

export const screenFlowTransitionSchema = z.enum(["replace", "root"]);

export const screenFlowSchema = z.object({
  requestId: z.string().optional(),
  parentRequestId: z.string().optional(),
  state: screenFlowStateSchema.default("ongoing"),
  transition: screenFlowTransitionSchema.default("replace")
});

export const screenInteractionAccessSchema = z.enum(["enabled", "locked"]);

export const screenInteractionSchema = z.object({
  input: screenInteractionAccessSchema.default("enabled"),
  actions: screenInteractionAccessSchema.default("enabled"),
  forms: screenInteractionAccessSchema.default("enabled"),
  artifacts: screenInteractionAccessSchema.default("enabled"),
  history: screenInteractionAccessSchema.default("enabled"),
  reason: z.string().optional()
});

export const blockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  cardBlockSchema,
  listBlockSchema,
  actionsBlockSchema,
  formBlockSchema,
  timelineBlockSchema,
  detailsBlockSchema,
  logBlockSchema,
  resourceBlockSchema,
  sectionBlockSchema,
  splitBlockSchema
]);

export const screenSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  mode: screenModeSchema.default("stable"),
  flow: screenFlowSchema.optional(),
  interaction: screenInteractionSchema.optional(),
  blocks: z.array(blockSchema)
});

export const screenPatchOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set_title"),
    title: z.string().nullable()
  }),
  z.object({
    type: z.literal("set_subtitle"),
    subtitle: z.string().nullable()
  }),
  z.object({
    type: z.literal("set_mode"),
    mode: screenModeSchema
  }),
  z.object({
    type: z.literal("set_flow"),
    flow: screenFlowSchema.nullable()
  }),
  z.object({
    type: z.literal("set_interaction"),
    interaction: screenInteractionSchema.nullable()
  }),
  z.object({
    type: z.literal("replace_blocks"),
    blocks: z.array(blockSchema)
  }),
  z.object({
    type: z.literal("append_blocks"),
    blocks: z.array(blockSchema)
  }),
  z.object({
    type: z.literal("upsert_block"),
    block: blockSchema
  }),
  z.object({
    type: z.literal("remove_block"),
    blockId: z.string()
  })
]);

export const harnessEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.started"),
    sessionId: z.string()
  }),
  z.object({
    type: z.literal("status"),
    phase: z.enum(["idle", "listening", "thinking", "waiting", "running", "complete"])
  }),
  z.object({
    type: z.literal("screen.updated"),
    screen: screenSchema
  }),
  z.object({
    type: z.literal("screen.patched"),
    screenId: z.string(),
    operations: z.array(screenPatchOperationSchema).min(1)
  }),
  z.object({
    type: z.literal("artifact.available"),
    artifact: artifactRefSchema
  }),
  z.object({
    type: z.literal("capability.requested"),
    request: capabilityRequestSchema
  }),
  z.object({
    type: z.literal("error"),
    message: z.string()
  }),
  z.object({
    type: z.literal("session.completed")
  })
]);

export const clientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.start"),
    input: z.string().optional()
  }),
  z.object({
    type: z.literal("voice.input"),
    transcript: z.string(),
    audioUri: z.string().optional(),
    clientRequestId: z.string().optional()
  }),
  z.object({
    type: z.literal("input.submitted"),
    mode: z.enum(["voice", "text"]),
    text: z.string().optional(),
    audioUri: z.string().optional(),
    clientRequestId: z.string().optional()
  }),
  z.object({
    type: z.literal("action.triggered"),
    actionId: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
    clientRequestId: z.string().optional()
  }),
  z.object({
    type: z.literal("form.submitted"),
    formId: z.string(),
    values: z.record(z.string(), z.string()),
    clientRequestId: z.string().optional()
  }),
  z.object({
    type: z.literal("artifact.requested"),
    artifactId: z.string(),
    mode: z.enum(["preview", "open", "share", "download"])
  }),
  z.object({
    type: z.literal("capability.resolved"),
    requestId: z.string(),
    payload: z.record(z.string(), z.unknown()).optional()
  })
]);

export type ActionItem = z.infer<typeof actionItemSchema>;
export type ArtifactRef = z.infer<typeof artifactRefSchema>;
export type CapabilityRequest = z.infer<typeof capabilityRequestSchema>;
export type DetailItem = z.infer<typeof detailItemSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormBlock = z.infer<typeof formBlockSchema>;
export type DetailsBlock = z.infer<typeof detailsBlockSchema>;
export type LogBlock = z.infer<typeof logBlockSchema>;
export type LogItem = z.infer<typeof logItemSchema>;
export type SectionBlock = z.infer<typeof sectionBlockSchema>;
export type SplitBlock = z.infer<typeof splitBlockSchema>;
export type SplitPane = z.infer<typeof splitPaneSchema>;
export type ScreenMode = z.infer<typeof screenModeSchema>;
export type ScreenFlow = z.infer<typeof screenFlowSchema>;
export type ScreenFlowState = z.infer<typeof screenFlowStateSchema>;
export type ScreenFlowTransition = z.infer<typeof screenFlowTransitionSchema>;
export type ScreenInteraction = z.infer<typeof screenInteractionSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type TimelineBlock = z.infer<typeof timelineBlockSchema>;
export type Block = z.infer<typeof blockSchema>;
export type ScreenSchema = z.infer<typeof screenSchema>;
export type ScreenPatchOperation = z.infer<typeof screenPatchOperationSchema>;
export type HarnessEvent = z.infer<typeof harnessEventSchema>;
export type ClientEvent = z.infer<typeof clientEventSchema>;

export function parseHarnessEvent(input: unknown): HarnessEvent {
  return harnessEventSchema.parse(input);
}

export function parseClientEvent(input: unknown): ClientEvent {
  return clientEventSchema.parse(input);
}

export function applyScreenPatch(
  screen: ScreenSchema,
  operations: ScreenPatchOperation[]
): ScreenSchema {
  let nextScreen: ScreenSchema = {
    ...screen,
    blocks: [...screen.blocks]
  };

  for (const operation of operations) {
    switch (operation.type) {
      case "set_title":
        nextScreen = {
          ...nextScreen,
          title: operation.title ?? undefined
        };
        break;
      case "set_subtitle":
        nextScreen = {
          ...nextScreen,
          subtitle: operation.subtitle ?? undefined
        };
        break;
      case "set_mode":
        nextScreen = {
          ...nextScreen,
          mode: operation.mode
        };
        break;
      case "set_flow":
        nextScreen = {
          ...nextScreen,
          flow: operation.flow ?? undefined
        };
        break;
      case "set_interaction":
        nextScreen = {
          ...nextScreen,
          interaction: operation.interaction ?? undefined
        };
        break;
      case "replace_blocks":
        nextScreen = {
          ...nextScreen,
          blocks: [...operation.blocks]
        };
        break;
      case "append_blocks":
        nextScreen = {
          ...nextScreen,
          blocks: [...nextScreen.blocks, ...operation.blocks]
        };
        break;
      case "upsert_block": {
        const existingIndex = nextScreen.blocks.findIndex((block) => block.id === operation.block.id);
        const blocks = [...nextScreen.blocks];

        if (existingIndex >= 0) {
          blocks[existingIndex] = operation.block;
        } else {
          blocks.push(operation.block);
        }

        nextScreen = {
          ...nextScreen,
          blocks
        };
        break;
      }
      case "remove_block":
        nextScreen = {
          ...nextScreen,
          blocks: nextScreen.blocks.filter((block) => block.id !== operation.blockId)
        };
        break;
    }
  }

  return nextScreen;
}
