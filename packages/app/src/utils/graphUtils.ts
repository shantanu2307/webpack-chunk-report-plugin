import type {
  GraphData,
  GraphNode,
} from "@plugin/utils/generateGraphFromChunkIdVsChunkMap";
import type { Module } from "@plugin/types";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getNodeSize(node: GraphNode): number {
  const data = node?.data;
  const size = data.gzipSize || 0;

  // Scale node size based on file size (min 8, max 40)
  const minSize = 8;
  const maxSize = 40;
  const logSize = Math.log(size + 1);
  const maxLogSize = Math.log(1000000); // 1MB reference

  return Math.max(minSize, Math.min(maxSize, (logSize / maxLogSize) * maxSize));
}

export function getNodeColor(node: GraphNode): string {
  if (node.type === "chunk") {
    return "#8B5CF6"; // Purple for chunks
  }

  const module = node.data as Module;
  if (module.isCommonJS) {
    return "#F59E0B"; // Amber for CommonJS modules
  }

  // Color based on file type
  const fileName = module.fileName.toLowerCase();
  if (fileName.endsWith(".js") || fileName.endsWith(".mjs")) {
    return "#10B981"; // Green for JS
  }
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
    return "#3B82F6"; // Blue for TS
  }
  if (fileName.endsWith(".css") || fileName.endsWith(".scss")) {
    return "#EF4444"; // Red for CSS
  }
  if (fileName.endsWith(".json")) {
    return "#F97316"; // Orange for JSON
  }

  return "#6B7280"; // Gray for others
}

export function getNodeLabel(node: GraphNode): string {
  if (node.type === "chunk") {
    return `Chunk: ${node.id}`;
  }
  const fileName = (node.data as Module).fileName;
  const parts = fileName.split("/");
  return parts[parts.length - 1] || fileName;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export const addLazyLoadingInfo = (
  graphData: GraphData,
  selectedItems: string[],
): GraphData => {
  if (selectedItems.length === 0) {
    return graphData;
  }

  const chunks = graphData.nodes.filter(n => n.type === "chunk");
  const modules = graphData.nodes.filter(n => n.type === "module");

  // Create a map for faster access
  const moduleMap: Record<string, GraphNode> = modules.reduce(
    (acc, node) => {
      acc[node.id] = node;
      return acc;
    },
    {} as Record<string, GraphNode>,
  );

  const updatedModuleMap: Record<string, GraphNode> = {};
  const seen = new Set<string>();

  const dfs = (id: string) => {
    if (seen.has(id) || !(id in moduleMap)) {
      return;
    }
    seen.add(id);
    const node = moduleMap[id];
    updatedModuleMap[id] = {
      ...node,
      isRequiredOnInitialLoad: true,
    };
    node.dependencies.forEach(dfs);
  };

  selectedItems.forEach(dfs);

  // Merge original and updated module nodes
  const finalModuleNodes = modules.map(
    node => updatedModuleMap[node.id] ?? node,
  );

  return {
    ...graphData,
    nodes: [...chunks, ...finalModuleNodes],
  };
};
