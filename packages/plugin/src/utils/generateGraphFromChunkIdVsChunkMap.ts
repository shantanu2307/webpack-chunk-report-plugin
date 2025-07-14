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

const getImportersOfConcatenatedModule = (
  module: Module,
  allModules: Record<string, Module>,
  seen: Set<string> = new Set<string>(),
): string[] => {
  // Base case: already processed this module
  if (seen.has(module.fileName)) {
    return [];
  }
  seen.add(module.fileName);

  const importers: string[] = [];

  for (const reason of module.reasons) {
    const parentModuleId = reason.from;
    if (!parentModuleId) continue;

    const parentModule = allModules[parentModuleId];
    if (!parentModule) continue;

    if (parentModule.type === "Concatenated") {
      // Recursively get importers of concatenated parent
      const parentImporters = getImportersOfConcatenatedModule(
        parentModule,
        allModules,
        seen,
      );
      importers.push(...parentImporters);
    } else {
      // Regular module - add directly
      importers.push(parentModuleId);
    }
  }

  return importers;
};

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
  Object.entries(moduleMap).forEach(([chunkId, moduleIdVsGraphNode]) => {
    Object.entries(moduleIdVsGraphNode).forEach(([moduleId, graphNode]) => {
      const module = graphNode.data as Module;
      const seen = new Set<string>();
      const processReasons = (mod: Module) => {
        mod.reasons.forEach(reason => {
          const shouldAvoidAdding =
            !reason.from ||
            reason.from === mod.fileName ||
            seen.has(reason.from);

          if (shouldAvoidAdding) {
            return;
          }

          seen.add(reason.from);

          // Find the source module (could be in any chunk)
          const sourceModule = allModules[reason.from];
          if (!sourceModule) return;

          switch (module.type) {
            case "Concatenated": {
              mod.subModules.forEach(processReasons);
              break;
            }
            default: {
              switch (sourceModule.type) {
                case "Concatenated": {
                  const importers = getImportersOfConcatenatedModule(
                    sourceModule,
                    allModules,
                  );
                  importers.forEach(importer => {
                    links.push({
                      source: importer,
                      target: module.fileName,
                      reason: {
                        from: importer,
                        explanation: `Via concatenated source module: ${sourceModule.fileName}`,
                        type: reason.type,
                      },
                    });
                    // Add dependency from each submodule
                    Object.values(moduleMap).forEach(modIdVsModMap => {
                      importers.forEach(importer => {
                        if (modIdVsModMap[importer]) {
                          modIdVsModMap[importer].dependencies.push(
                            module.fileName,
                          );
                        }
                      });
                    });
                  });
                }
                default: {
                  // External Module or Normal Module
                  links.push({
                    source: reason.from,
                    target: module.fileName,
                    reason,
                  });
                  // Find the source module's node to add dependency
                  Object.values(moduleMap).forEach(modIdVsModMap => {
                    if (modIdVsModMap[reason.from]) {
                      modIdVsModMap[reason.from].dependencies.push(
                        module.fileName,
                      );
                    }
                  });
                }
              }
            }
          }
        });
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
