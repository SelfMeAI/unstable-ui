import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActionItem, ArtifactRef, Block } from "@selfme/unstable-ui-protocol";

export interface CoreBlockProps {
  block: Block;
  onAction(action: ActionItem): void;
  onArtifact(resource: ArtifactRef, mode: "preview" | "open"): void;
}

export function CoreBlock({ block, onAction, onArtifact }: CoreBlockProps) {
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
            <Pressable key={item.id} onPress={() => onAction(item)} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      );
    case "resource":
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{block.resource.title ?? block.resource.id}</Text>
          <Text style={styles.cardBody}>{block.resource.kind}</Text>
          <View style={styles.actionGroup}>
            {block.resource.previewable ? (
              <Pressable onPress={() => onArtifact(block.resource, "preview")} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Preview</Text>
              </Pressable>
            ) : null}
            {block.resource.openable ? (
              <Pressable onPress={() => onArtifact(block.resource, "open")} style={styles.secondaryActionButton}>
                <Text style={styles.secondaryActionText}>Open</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  text: {
    color: "#111827",
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#FFFFFF",
    gap: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827"
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563"
  },
  listRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB"
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827"
  },
  listDescription: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280"
  },
  actionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  actionButton: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  actionButtonText: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "600"
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  secondaryActionText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600"
  }
});
