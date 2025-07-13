// types
import type { TreeNode } from "../types";

export const adaptTree = ({
  tree,
  searchTerm,
  sortBy,
  filterBy,
  sortDirection,
}: {
  tree: TreeNode;
  searchTerm: string;
  sortBy: string;
  filterBy: string;
  sortDirection: string;
}): TreeNode => {
  // Clone the tree to avoid mutating the original
  const clonedTree = JSON.parse(JSON.stringify(tree));

  // Filter the tree based on search term and filter criteria
  const filterNode = (node: TreeNode): boolean => {
    // Apply search filter
    const matchesSearch =
      searchTerm === "" ||
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.path.toLowerCase().includes(searchTerm.toLowerCase());

    // Apply type filter
    let matchesFilter = true;
    if (filterBy) {
      if (filterBy === "commonjs") {
        matchesFilter = node.isCommonJS === true;
      } else if (filterBy === "chunk") {
        matchesFilter = node.fileType === "chunk";
      } else if (filterBy === "module") {
        matchesFilter = node.fileType !== "chunk";
      } else {
        matchesFilter = node.gzipSize > 1000;
      }
    }

    return matchesSearch && matchesFilter;
  };

  // Recursive function to filter tree
  const filterTree = (node: TreeNode): TreeNode | null => {
    // Filter children first
    const filteredChildren = node.children
      .map(child => filterTree(child))
      .filter(child => child !== null) as TreeNode[];

    // Only keep the node if it matches filter or has children that do
    const shouldKeep = filterNode(node) || filteredChildren.length > 0;

    if (!shouldKeep) return null;

    return {
      ...node,
      children: filteredChildren,
    };
  };

  // Sort the tree based on the specified criteria
  const sortTree = (node: TreeNode) => {
    if (node.children.length === 0) return;

    // Sort children
    node.children.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case "name":
          compareValue = a.name.localeCompare(b.name);
          break;
        case "statSize":
          compareValue = (a.statSize || 0) - (b.statSize || 0);
          break;
        case "parsedSize":
          compareValue = (a.parsedSize || 0) - (b.parsedSize || 0);
          break;
        case "gzipSize":
          compareValue = (a.gzipSize || 0) - (b.gzipSize || 0);
          break;
        default:
          compareValue = 0;
      }

      // Apply sort direction
      return sortDirection === "asc" ? compareValue : -compareValue;
    });

    // Recursively sort children
    node.children.forEach(sortTree);
  };

  // Apply filters
  const filteredTree = filterTree(clonedTree);

  if (!filteredTree) {
    // If root is filtered out, return empty root
    return {
      ...tree,
      children: [],
      statSize: 0,
      parsedSize: 0,
      gzipSize: 0,
    };
  }

  // Apply sorting
  sortTree(filteredTree);

  // Recalculate folder sizes after filtering
  const calculateFolderSizes = (node: TreeNode): void => {
    if (node.type === "folder") {
      node.statSize = 0;
      node.gzipSize = 0;
      node.parsedSize = 0;
      node.children.forEach(child => {
        calculateFolderSizes(child);
        node.statSize += child.statSize;
        node.parsedSize += child.parsedSize;
        node.gzipSize += child.gzipSize;
      });
    }
  };

  calculateFolderSizes(filteredTree);

  return filteredTree;
};
