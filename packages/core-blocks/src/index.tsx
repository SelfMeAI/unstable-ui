import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type {
  ActionItem,
  ArtifactRef,
  Block,
  DetailsBlock,
  DetailItem,
  FormBlock,
  LogBlock,
  LogItem,
  SectionBlock,
  SplitBlock,
  TimelineBlock,
  TimelineItem
} from "@selfme/unstable-ui-protocol";

export interface CoreBlockProps {
  block: Block;
  onAction(action: ActionItem): void;
  onFormSubmit(formId: string, values: Record<string, string>): void;
  onArtifact(resource: ArtifactRef, mode: "preview" | "open" | "share" | "download"): void;
  interaction?: {
    actionsDisabled?: boolean;
    formsDisabled?: boolean;
    artifactsDisabled?: boolean;
  };
}

export function CoreBlock({ block, onAction, onFormSubmit, onArtifact, interaction }: CoreBlockProps) {
  switch (block.type) {
    case "text":
      return <Text style={styles.text}>{block.value}</Text>;
    case "card":
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{block.title}</Text>
          {block.body ? <Text style={styles.cardBody}>{block.body}</Text> : null}
        </View>
      );
    case "list":
      return (
        <View style={styles.card}>
          {block.items.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <Text style={styles.listTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.listDescription}>{item.description}</Text> : null}
            </View>
          ))}
        </View>
      );
    case "actions":
      return (
        <View style={styles.actionGroup}>
          {block.items.map((item) => (
            <Pressable
              key={item.id}
              disabled={interaction?.actionsDisabled}
              onPress={() => onAction(item)}
              style={[styles.actionButton, interaction?.actionsDisabled ? styles.controlDisabled : null]}
            >
              <Text style={styles.actionButtonText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      );
    case "form":
      return <FormCard block={block} disabled={interaction?.formsDisabled} onSubmit={onFormSubmit} />;
    case "timeline":
      return <TimelineCard block={block} />;
    case "details":
      return <DetailsCard block={block} />;
    case "log":
      return <LogCard block={block} />;
    case "section":
      return (
        <SectionCard
          block={block}
          onAction={onAction}
          onFormSubmit={onFormSubmit}
          onArtifact={onArtifact}
          interaction={interaction}
        />
      );
    case "split":
      return (
        <SplitCard
          block={block}
          onAction={onAction}
          onFormSubmit={onFormSubmit}
          onArtifact={onArtifact}
          interaction={interaction}
        />
      );
    case "resource":
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{block.resource.title ?? block.resource.id}</Text>
          <Text style={styles.cardBody}>{block.resource.kind}</Text>
          <View style={styles.actionGroup}>
            {block.resource.previewable ? (
              <Pressable
                disabled={interaction?.artifactsDisabled}
                onPress={() => onArtifact(block.resource, "preview")}
                style={[styles.actionButton, interaction?.artifactsDisabled ? styles.controlDisabled : null]}
              >
                <Text style={styles.actionButtonText}>Preview</Text>
              </Pressable>
            ) : null}
            {block.resource.openable ? (
              <Pressable
                disabled={interaction?.artifactsDisabled}
                onPress={() => onArtifact(block.resource, "open")}
                style={[styles.secondaryActionButton, interaction?.artifactsDisabled ? styles.controlDisabled : null]}
              >
                <Text style={styles.secondaryActionText}>Open</Text>
              </Pressable>
            ) : null}
            {canShareResource(block.resource) ? (
              <Pressable
                disabled={interaction?.artifactsDisabled}
                onPress={() => onArtifact(block.resource, "share")}
                style={[styles.secondaryActionButton, interaction?.artifactsDisabled ? styles.controlDisabled : null]}
              >
                <Text style={styles.secondaryActionText}>Share</Text>
              </Pressable>
            ) : null}
            {canDownloadResource(block.resource) ? (
              <Pressable
                disabled={interaction?.artifactsDisabled}
                onPress={() => onArtifact(block.resource, "download")}
                style={[styles.secondaryActionButton, interaction?.artifactsDisabled ? styles.controlDisabled : null]}
              >
                <Text style={styles.secondaryActionText}>Download</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
  }
}

function canShareResource(resource: ArtifactRef) {
  return Boolean(resource.uri);
}

function canDownloadResource(resource: ArtifactRef) {
  return Boolean(resource.uri) && resource.kind !== "link" && resource.kind !== "html";
}

function buildFormValues(block: FormBlock) {
  return Object.fromEntries(block.fields.map((field) => [field.id, field.defaultValue ?? ""]));
}

function FormCard({
  block,
  disabled,
  onSubmit
}: {
  block: FormBlock;
  disabled?: boolean;
  onSubmit(formId: string, values: Record<string, string>): void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => buildFormValues(block));
  const [invalidFieldIds, setInvalidFieldIds] = useState<string[]>([]);

  useEffect(() => {
    setValues(buildFormValues(block));
    setInvalidFieldIds([]);
  }, [block]);

  function handleSubmit() {
    if (disabled) {
      return;
    }

    const nextInvalidFieldIds = block.fields
      .filter((field) => field.required && !values[field.id]?.trim())
      .map((field) => field.id);

    setInvalidFieldIds(nextInvalidFieldIds);

    if (nextInvalidFieldIds.length > 0) {
      return;
    }

    onSubmit(block.id, values);
  }

  return (
    <View style={styles.card}>
      {block.title ? <Text style={styles.cardTitle}>{block.title}</Text> : null}
      {block.description ? <Text style={styles.cardBody}>{block.description}</Text> : null}
      <View style={styles.formStack}>
        {block.fields.map((field) => {
          const invalid = invalidFieldIds.includes(field.id);

          return (
            <View key={field.id} style={styles.formField}>
              <Text style={styles.formFieldLabel}>
                {field.label}
                {field.required ? " *" : ""}
              </Text>
              {field.description ? <Text style={styles.formFieldDescription}>{field.description}</Text> : null}
              <TextInput
                multiline={field.kind === "multiline"}
                numberOfLines={field.kind === "multiline" ? 4 : 1}
                placeholder={field.placeholder}
                placeholderTextColor="#9CA3AF"
                style={[
                  styles.formInput,
                  field.kind === "multiline" ? styles.formInputMultiline : null,
                  invalid ? styles.formInputInvalid : null,
                  disabled ? styles.formInputDisabled : null
                ]}
                editable={!disabled}
                value={values[field.id] ?? ""}
                onChangeText={(value) => {
                  if (disabled) {
                    return;
                  }

                  setValues((current) => ({
                    ...current,
                    [field.id]: value
                  }));

                  if (invalid) {
                    setInvalidFieldIds((current) => current.filter((id) => id !== field.id));
                  }
                }}
              />
              {invalid ? <Text style={styles.formErrorText}>This field is required.</Text> : null}
            </View>
          );
        })}
      </View>
      <Pressable disabled={disabled} onPress={handleSubmit} style={[styles.actionButton, disabled ? styles.controlDisabled : null]}>
        <Text style={styles.actionButtonText}>{block.submitLabel ?? "Submit"}</Text>
      </Pressable>
    </View>
  );
}

function SectionCard({
  block,
  onAction,
  onFormSubmit,
  onArtifact,
  interaction
}: {
  block: SectionBlock;
  onAction(action: ActionItem): void;
  onFormSubmit(formId: string, values: Record<string, string>): void;
  onArtifact(resource: ArtifactRef, mode: "preview" | "open" | "share" | "download"): void;
  interaction?: CoreBlockProps["interaction"];
}) {
  return (
    <View style={styles.sectionCard}>
      {(block.title || block.description) ? (
        <View style={styles.sectionHeader}>
          {block.title ? <Text style={styles.sectionTitle}>{block.title}</Text> : null}
          {block.description ? <Text style={styles.sectionDescription}>{block.description}</Text> : null}
        </View>
      ) : null}
      <View style={styles.sectionStack}>
        {block.blocks.map((childBlock) => (
          <CoreBlock
            key={childBlock.id}
            block={childBlock}
            onAction={onAction}
            onFormSubmit={onFormSubmit}
            onArtifact={onArtifact}
            interaction={interaction}
          />
        ))}
      </View>
    </View>
  );
}

function getSplitPaneFlex(ratio: SplitBlock["ratio"], index: number) {
  if (ratio === "primary") {
    return index === 0 ? 1.35 : 0.85;
  }

  if (ratio === "secondary") {
    return index === 0 ? 0.85 : 1.35;
  }

  return 1;
}

function SplitCard({
  block,
  onAction,
  onFormSubmit,
  onArtifact,
  interaction
}: {
  block: SplitBlock;
  onAction(action: ActionItem): void;
  onFormSubmit(formId: string, values: Record<string, string>): void;
  onArtifact(resource: ArtifactRef, mode: "preview" | "open" | "share" | "download"): void;
  interaction?: CoreBlockProps["interaction"];
}) {
  const { width } = useWindowDimensions();
  const horizontal = width >= 820;

  return (
    <View style={styles.sectionCard}>
      {(block.title || block.description) ? (
        <View style={styles.sectionHeader}>
          {block.title ? <Text style={styles.sectionTitle}>{block.title}</Text> : null}
          {block.description ? <Text style={styles.sectionDescription}>{block.description}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.splitShell, horizontal ? styles.splitShellHorizontal : styles.splitShellVertical]}>
        {block.panes.map((pane, index) => (
          <View
            key={pane.id}
            style={[
              styles.splitPane,
              { flex: horizontal ? getSplitPaneFlex(block.ratio, index) : undefined }
            ]}
          >
            {(pane.title || pane.description) ? (
              <View style={styles.splitPaneHeader}>
                {pane.title ? <Text style={styles.splitPaneTitle}>{pane.title}</Text> : null}
                {pane.description ? <Text style={styles.splitPaneDescription}>{pane.description}</Text> : null}
              </View>
            ) : null}
            <View style={styles.sectionStack}>
              {pane.blocks.map((childBlock) => (
                <CoreBlock
                  key={childBlock.id}
                  block={childBlock}
                  onAction={onAction}
                  onFormSubmit={onFormSubmit}
                  onArtifact={onArtifact}
                  interaction={interaction}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function getDetailTone(item: DetailItem) {
  switch (item.tone) {
    case "success":
      return {
        label: "#047857",
        value: "#065F46",
        surface: "#ECFDF5"
      };
    case "warning":
      return {
        label: "#B45309",
        value: "#92400E",
        surface: "#FFFBEB"
      };
    case "danger":
      return {
        label: "#B91C1C",
        value: "#991B1B",
        surface: "#FEF2F2"
      };
    case "default":
    default:
      return {
        label: "#6B7280",
        value: "#111827",
        surface: "#F9FAFB"
      };
  }
}

function DetailsCard({ block }: { block: DetailsBlock }) {
  const items = block.items ?? [];

  return (
    <View style={styles.card}>
      {block.title ? <Text style={styles.cardTitle}>{block.title}</Text> : null}
      {block.description ? <Text style={styles.cardBody}>{block.description}</Text> : null}
      <View style={styles.detailsStack}>
        {items.map((item) => {
          const tone = getDetailTone(item);

          return (
            <View key={item.id} style={[styles.detailsRow, { backgroundColor: tone.surface }]}>
              <Text style={[styles.detailsLabel, { color: tone.label }]}>{item.label}</Text>
              <Text style={[styles.detailsValue, { color: tone.value }]}>{item.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getLogTone(item: LogItem) {
  switch (item.tone) {
    case "success":
      return {
        border: "#A7F3D0",
        title: "#065F46",
        meta: "#047857",
        surface: "#ECFDF5"
      };
    case "warning":
      return {
        border: "#FCD34D",
        title: "#92400E",
        meta: "#B45309",
        surface: "#FFFBEB"
      };
    case "danger":
      return {
        border: "#FECACA",
        title: "#991B1B",
        meta: "#B91C1C",
        surface: "#FEF2F2"
      };
    case "default":
    default:
      return {
        border: "#E5E7EB",
        title: "#111827",
        meta: "#6B7280",
        surface: "#F9FAFB"
      };
  }
}

function LogCard({ block }: { block: LogBlock }) {
  const items = block.items ?? [];

  return (
    <View style={styles.card}>
      {block.title ? <Text style={styles.cardTitle}>{block.title}</Text> : null}
      {block.description ? <Text style={styles.cardBody}>{block.description}</Text> : null}
      {items.length === 0 ? (
        <Text style={styles.cardBody}>{block.emptyLabel ?? "No log entries available."}</Text>
      ) : (
        <View style={styles.logStack}>
          {items.map((item) => {
            const tone = getLogTone(item);

            return (
              <View
                key={item.id}
                style={[styles.logRow, { backgroundColor: tone.surface, borderColor: tone.border }]}
              >
                <View style={styles.logHeader}>
                  <Text style={[styles.logTitle, { color: tone.title }]}>{item.title}</Text>
                  {item.meta ? <Text style={[styles.logMeta, { color: tone.meta }]}>{item.meta}</Text> : null}
                </View>
                {item.body ? <Text style={styles.logBody}>{item.body}</Text> : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function getTimelineTone(item: TimelineItem) {
  switch (item.status) {
    case "complete":
      return {
        dot: "#047857",
        surface: "#ECFDF5",
        title: "#065F46",
        meta: "#047857"
      };
    case "active":
      return {
        dot: "#B45309",
        surface: "#FFFBEB",
        title: "#92400E",
        meta: "#B45309"
      };
    case "error":
      return {
        dot: "#B91C1C",
        surface: "#FEF2F2",
        title: "#991B1B",
        meta: "#B91C1C"
      };
    case "pending":
    default:
      return {
        dot: "#6B7280",
        surface: "#F9FAFB",
        title: "#111827",
        meta: "#6B7280"
      };
  }
}

function TimelineCard({ block }: { block: TimelineBlock }) {
  return (
    <View style={styles.card}>
      {block.title ? <Text style={styles.cardTitle}>{block.title}</Text> : null}
      {block.description ? <Text style={styles.cardBody}>{block.description}</Text> : null}
      <View style={styles.timelineStack}>
        {block.items.map((item, index) => {
          const tone = getTimelineTone(item);

          return (
            <View key={item.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: tone.dot }]} />
                {index < block.items.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={[styles.timelineCard, { backgroundColor: tone.surface }]}>
                <View style={styles.timelineHeader}>
                  <Text style={[styles.timelineTitle, { color: tone.title }]}>{item.title}</Text>
                  <Text style={[styles.timelineMeta, { color: tone.meta }]}>{item.status}</Text>
                </View>
                {item.description ? <Text style={styles.timelineDescription}>{item.description}</Text> : null}
                {item.meta ? <Text style={[styles.timelineMeta, { color: tone.meta }]}>{item.meta}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "#243041",
    fontSize: 17,
    lineHeight: 27
  },
  card: {
    width: "100%",
    borderRadius: 0,
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    gap: 10
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0F172A"
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569"
  },
  listRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9E2EC"
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827"
  },
  listDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280"
  },
  formStack: {
    gap: 14
  },
  formField: {
    gap: 6
  },
  formFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A"
  },
  formFieldDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B"
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#D7E0EA",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#FFFFFF"
  },
  formInputMultiline: {
    minHeight: 112,
    textAlignVertical: "top"
  },
  formInputInvalid: {
    borderColor: "#DC2626"
  },
  formInputDisabled: {
    backgroundColor: "#F8FAFC",
    color: "#94A3B8"
  },
  formErrorText: {
    fontSize: 12,
    color: "#B91C1C"
  },
  timelineStack: {
    gap: 0
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12
  },
  timelineRail: {
    width: 16,
    alignItems: "center"
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#D1D5DB",
    marginVertical: 4
  },
  timelineCard: {
    flex: 1,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 12,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9E2EC",
    gap: 6
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  timelineTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600"
  },
  timelineDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4B5563"
  },
  timelineMeta: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  detailsStack: {
    gap: 0
  },
  detailsRow: {
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9E2EC",
    gap: 4
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  detailsValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500"
  },
  logStack: {
    gap: 10
  },
  logRow: {
    borderLeftWidth: 3,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  logTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  logMeta: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  logBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "#374151"
  },
  sectionCard: {
    width: "100%",
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    gap: 16
  },
  sectionHeader: {
    gap: 4
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A"
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B"
  },
  sectionStack: {
    gap: 14
  },
  splitShell: {
    width: "100%",
    gap: 12
  },
  splitShellHorizontal: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  splitShellVertical: {
    flexDirection: "column"
  },
  splitPane: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: "#D9E2EC",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    gap: 14
  },
  splitPaneHeader: {
    gap: 4
  },
  splitPaneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  splitPaneDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B"
  },
  actionGroup: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "stretch"
  },
  actionButton: {
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 46,
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  actionButtonText: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "700"
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 46,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.82)"
  },
  secondaryActionText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600"
  },
  controlDisabled: {
    opacity: 0.42
  }
});
