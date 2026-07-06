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

export const resourceBlockSchema = z.object({
  id: z.string(),
  type: z.literal("resource"),
  resource: artifactRefSchema
});

export const blockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  cardBlockSchema,
  listBlockSchema,
  actionsBlockSchema,
  resourceBlockSchema
]);

export const screenSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  blocks: z.array(blockSchema)
});

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
    audioUri: z.string().optional()
  }),
  z.object({
    type: z.literal("action.triggered"),
    actionId: z.string(),
    payload: z.record(z.string(), z.unknown()).optional()
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
export type Block = z.infer<typeof blockSchema>;
export type ScreenSchema = z.infer<typeof screenSchema>;
export type HarnessEvent = z.infer<typeof harnessEventSchema>;
export type ClientEvent = z.infer<typeof clientEventSchema>;

export function parseHarnessEvent(input: unknown): HarnessEvent {
  return harnessEventSchema.parse(input);
}

export function parseClientEvent(input: unknown): ClientEvent {
  return clientEventSchema.parse(input);
}
