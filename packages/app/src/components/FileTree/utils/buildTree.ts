// types
import type { GraphData } from "@plugin/utils/generateGraphFromChunkIdVsChunkMap";
import type { TreeNode } from "../types";
import type { Module, Chunk } from "@plugin/types";

// constants
import { TYPE_MAP } from "../constants";

export const buildTree = (graphData: GraphData, chunkMode: boolean): TreeNode => {
  const root: TreeNode = {
    id: "root",
    name: "Bundle Root",
    path: "",
    type: "folder",
    statSize: 0,
    parsedSize: 0,
    gzipSize: 0,
    children: [],
    importedBy: [],
  };

  const folderMap = new Map<string, TreeNode>();
  folderMap.set("", root);

  const hasExtension = (fileName: string): boolean => {
    const lastDotIndex = fileName.lastIndexOf(".");
    const lastSlashIndex = fileName.lastIndexOf("/");
    return lastDotIndex > -1 && lastDotIndex > lastSlashIndex;
  };

  const getFileType = (fileName: string): string => {
    if (!hasExtension(fileName)) return "unknown";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    return TYPE_MAP[ext] || "unknown";
  };

  const createFolderPath = (path: string): TreeNode => {
    if (folderMap.has(path)) {
      return folderMap.get(path)!;
    }

    const parts = path.split("/").filter(Boolean);
    let currentPath = "";
    let parentFolder = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const newPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(newPath)) {
        const folder: TreeNode = {
          id: newPath,
          name: part,
          path: newPath,
          type: "folder",
          parsedSize: 0,
          gzipSize: 0,
          statSize: 0,
          children: [],
          importedBy: [],
        };
        folderMap.set(newPath, folder);
        parentFolder.children.push(folder);
      }

      parentFolder = folderMap.get(newPath)!;
      currentPath = newPath;
    }

    return parentFolder;
  };

  if(chunkMode){
    // Add chunk nodes
    graphData.nodes
      .filter(node => node.type === "chunk")
      .forEach(node => {
        const chunk = node.data as Chunk;
        const chunkNode: TreeNode = {
          id: node.id,
          name: `Chunk: ${node.id}`,
          path: node.id,
          type: "chunk",
          gzipSize: chunk.gzipSize || 0,
          statSize: chunk.statSize || 0,
          parsedSize: chunk.parsedSize || 0,
          children: [],
          node,
          importedBy: [],
          fileType: "chunk",
        };
        root.children.push(chunkNode);
      });
  }
  else{
    // Add module nodes
    graphData.nodes
      .filter(node => node.type === "module")
      .forEach(node => {
        const module = node.data as Module;
        if (!module.fileName) return;

        const pathParts = module.fileName.split("/");
        const fileName = pathParts.pop() || module.fileName;
        const folderPath = pathParts.join("/");

        const parentFolder = createFolderPath(folderPath);
        const fileType = getFileType(module.fileName);

        if (hasExtension(module.fileName)) {
          const importedBy = graphData.links
            .filter(link => link.target === node.id)
            .map(link => link.source);

          const fileNode: TreeNode = {
            id: node.id,
            name: fileName,
            path: module.fileName,
            type: "file",
            parsedSize: module.parsedSize || 0,
            gzipSize: module.gzipSize || 0,
            statSize: module.statSize || 0,
            children: [],
            node,
            importedBy,
            isCommonJS: module.isCommonJS,
            fileType,
          };
          parentFolder.children.push(fileNode);
        }
      });
  }
  
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

  const dedupeChildren = (node: TreeNode): void => {
    const seen = new Set<string>();
    node.children = node.children.filter(child => {
      if (seen.has(child.id)) return false;
      seen.add(child.id);
      return true;
    });

    node.children.forEach(dedupeChildren);
  };

  calculateFolderSizes(root);
  dedupeChildren(root);
  return root;
};
