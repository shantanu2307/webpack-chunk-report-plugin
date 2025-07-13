import type { Module, Chunk, Reason } from "../types";

export type GraphNode = {
  id: string;
  type: "module" | "chunk";
  data: Module | Chunk;
  dependencies: string[];
};

export type GraphLink = {
  source: string;
  target: string;
  reason?: Reason;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type ChunkIdVsChunkMap = Record<string, Chunk>;

export function generateGraphFromChunkIdVsChunkMap(
  chunkIdVsChunkMap: ChunkIdVsChunkMap,
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const moduleMap = new Map<string, GraphNode>();
  const chunkMap = new Map<string, GraphNode>();

  // Process chunks first
  Object.entries(chunkIdVsChunkMap).forEach(([chunkId, chunk]) => {
    if (!chunkId) {
      return;
    }
    const chunkNode: GraphNode = {
      id: chunkId,
      type: "chunk",
      data: chunk,
      dependencies: [],
    };
    chunkMap.set(chunkId, chunkNode);
    nodes.push(chunkNode);
  });

  // Recursive function to process modules and their submodules
  const processModule = (module: Module, parentChunkId: string) => {
    if (!module.fileName) {
      return;
    }

    if (!moduleMap.has(module.fileName)) {
      const moduleNode: GraphNode = {
        id: module.fileName,
        type: "module",
        data: module,
        dependencies: [],
      };
      moduleMap.set(module.fileName, moduleNode);
      nodes.push(moduleNode);
    }

    if(module.type!=="Concatenated"){
      // Create link from chunk to module
      links.push({
        source: parentChunkId,
        target: module.fileName,
      });
      chunkMap.get(parentChunkId)?.dependencies.push(module.fileName);
    }
  
    // Process concatenated submodules
    if (module.type === "Concatenated" && module.subModules) {
      module.subModules.forEach(subModule => {
        processModule(subModule, parentChunkId);
        // Link the submodule to the parent concatenated module
        links.push({
          source: parentChunkId,
          target: subModule.fileName,
        });
        const moduleNode = moduleMap.get(module.fileName);
        moduleNode?.dependencies.push(subModule.fileName);
      });
    }

    const seen = new Set<string>();

    // Process module dependencies
    module.reasons.forEach(reason => {
      if (
        reason.from &&
        !seen.has(reason.from) &&
        reason.from !== module.fileName // Avoid self-references
      ) {
        // Ensure the dependency module exists in the graph
        if (!moduleMap.has(reason.from)) {
          // If the dependent module isn't already processed, we might need to find it
          // in the chunks and process it (this would require access to all modules)
          // For now, we'll skip these as they might be external or not part of our chunks
          return;
        }

        links.push({
          source: reason.from,
          target: module.fileName,
          reason,
        });
        moduleMap.get(reason.from)?.dependencies.push(module.fileName);
        seen.add(reason.from);
      }
    });
  };

  // Process all modules in chunks
  Object.entries(chunkIdVsChunkMap).forEach(([chunkId, chunk]) => {
    if (!chunkId) {
      return;
    }
    chunk.modules.forEach(module => {
      processModule(module, chunkId);
    });
  });

  return { nodes, links };
}
