import _uniq from "lodash/uniq";
import _uniqBy from "lodash/uniqBy";
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
  const moduleMap: Record<string, Record<string, GraphNode>> = {};
  const chunkMap: Record<string, GraphNode> = {};
  const allModules: Record<string, Module> = {};

  // First pass: collect all modules across chunks
  Object.values(chunkIdVsChunkMap).forEach(chunk => {
    const collectModules = (module: Module) => {
      if (module.fileName) {
        allModules[module.fileName] = module;
      }
      if (module.type === "Concatenated" && module.subModules) {
        module.subModules.forEach(subModule => collectModules(subModule));
      }
    };
    chunk.modules.forEach(collectModules);
  });

  // Process chunks
  Object.entries(chunkIdVsChunkMap).forEach(([chunkId, chunk]) => {
    if (!chunkId) return;

    const chunkNode: GraphNode = {
      id: chunkId,
      type: "chunk",
      data: chunk,
      dependencies: [],
    };
    chunkMap[chunkId] = chunkNode;
    nodes.push(chunkNode);
  });

  // Process modules
  const processModule = (module: Module, parentChunkId: string) => {
    if (!module.fileName) return;

    moduleMap[parentChunkId] = moduleMap[parentChunkId] ?? {};

    if (
      module.type !== "Concatenated" &&
      !moduleMap[parentChunkId][module.fileName]
    ) {
      const moduleNode: GraphNode = {
        id: module.fileName,
        type: "module",
        data: module,
        dependencies: [],
      };
      moduleMap[parentChunkId][module.fileName] = moduleNode;
      nodes.push(moduleNode);
    }

    if (module.type !== "Concatenated") {
      links.push({
        source: parentChunkId,
        target: module.fileName,
      });
      chunkMap[parentChunkId]?.dependencies.push(module.fileName);
    }
    // Process concatenated submodules
    else if (module.subModules) {
      module.subModules.forEach(subModule => {
        processModule(subModule, parentChunkId);
        links.push({
          source: parentChunkId,
          target: subModule.fileName,
        });
        chunkMap[parentChunkId]?.dependencies.push(subModule.fileName);
      });
    }
  };

  // First process all modules to ensure they exist in the graph
  Object.entries(chunkIdVsChunkMap).forEach(([chunkId, chunk]) => {
    if (!chunkId) return;
    chunk.modules.forEach(module => processModule(module, chunkId));
  });

  // Then process all reasons to create dependencies
  Object.values(moduleMap).forEach(chunkModules => {
    Object.values(chunkModules).forEach(moduleNode => {
      const module = moduleNode.data as Module;
      const seen = new Set<string>();

      const processReasons = (m: Module) => {
        m.reasons.forEach(reason => {
          if (
            !reason.from ||
            reason.from === m.fileName ||
            seen.has(reason.from)
          )
            return;

          seen.add(reason.from);

          // Find the source module (could be in any chunk)
          const sourceModule = allModules[reason.from];
          if (!sourceModule) return;

          // For concatenated modules, we want to link to their submodules
          if (sourceModule.type === "Concatenated" && sourceModule.subModules) {
            sourceModule.subModules.forEach(subModule => {
              if (subModule.fileName) {
                links.push({
                  source: subModule.fileName,
                  target: module.fileName,
                  reason,
                });
                // Find the submodule's node to add dependency
                Object.values(moduleMap).some(chunkMods => {
                  if (chunkMods[subModule.fileName]) {
                    chunkMods[subModule.fileName].dependencies.push(
                      module.fileName,
                    );
                    return true;
                  }
                  return false;
                });
              }
            });
          } else {
            links.push({
              source: reason.from,
              target: module.fileName,
              reason,
            });
            // Find the source module's node to add dependency
            Object.values(moduleMap).some(chunkMods => {
              if (chunkMods[reason.from!]) {
                chunkMods[reason.from!].dependencies.push(module.fileName);
                return true;
              }
              return false;
            });
          }
        });

        // Also process reasons for submodules if this is a concatenated module
        if (m.type === "Concatenated" && m.subModules) {
          m.subModules.forEach(subModule => processReasons(subModule));
        }
      };

      processReasons(module);
    });
  });

  // Deduplicate dependencies
  const graphNodes = nodes.map(node => ({
    ...node,
    dependencies: _uniq(node.dependencies),
  }));

  const graphLinks = _uniqBy(links, link => `${link.source}-${link.target}`);

  return { nodes: graphNodes, links: graphLinks };
}
