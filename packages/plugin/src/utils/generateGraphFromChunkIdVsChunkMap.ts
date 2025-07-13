import type { Module, Chunk, Reason } from "../types";

type GraphNode = {
  id: string;
  type: "module" | "chunk";
  data: Module | Chunk;
  dependencies: string[];
};

type GraphLink = {
  source: string;
  target: string;
  reason?: Reason;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type ChunkIdVsChunkMap = Record<string, Chunk>;

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

  // Then process modules and their relationships
  Object.entries(chunkIdVsChunkMap).forEach(([chunkId, chunk]) => {
    if (!chunkId) {
      return;
    }
    chunk.modules.forEach(module => {
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

      // Create link from chunk to module
      links.push({
        source: chunkId,
        target: module.fileName,
      });
      chunkMap.get(chunkId)?.dependencies.push(module.fileName);

      const seen = new Set<string>();

      // Process module dependencies
      module.reasons.forEach(reason => {
        if (
          reason.from &&
          !seen.has(reason.from) &&
          moduleMap.has(reason.from)
        ) {
          links.push({
            source: reason.from,
            target: module.fileName,
            reason,
          });
          moduleMap.get(reason.from)?.dependencies.push(module.fileName);
          seen.add(reason.from);
        }
      });
    });
  });

  return { nodes, links };
}
