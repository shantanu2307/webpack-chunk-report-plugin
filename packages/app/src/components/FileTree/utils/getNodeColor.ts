import type { TreeNode } from "../types";

export const getNodeColor = (node: TreeNode): string => {
  if (node.type === "chunk") return "text-purple-600";
  if (node.type === "folder") return "text-gray-600";
  if (node.isCommonJS) return "text-amber-600";

  switch (node.fileType) {
    case "javascript":
      return "text-green-600";
    case "typescript":
      return "text-blue-600";
    case "stylesheet":
      return "text-red-600";
    case "data":
      return "text-orange-600";
    default:
      return "text-gray-600";
  }
};
