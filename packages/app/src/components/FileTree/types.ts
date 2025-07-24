import type {
  GraphData,
  GraphNode,
} from "@plugin/utils/generateGraphFromChunkIdVsChunkMap";

export interface FileTreeProps {
  graphData: GraphData;
  onNodeSelect: (node: GraphNode) => void;
  selectedNodeId?: string;
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: "folder" | "file" | "chunk";
  statSize: number;
  parsedSize: number;
  gzipSize: number;
  children: TreeNode[];
  node?: GraphNode;
  importedBy: string[];
  isCommonJS?: boolean;
  fileType?: string;
  isRequiredOnInitialLoad?: boolean;
}

export type SortOption = "name" | "statSize" | "gzipSize" | "parsedSize";

export type FilterOption =
  | "chunk"
  | "module"
  | "commonjs"
  | "large"
  | "required"
  | "not-required";
