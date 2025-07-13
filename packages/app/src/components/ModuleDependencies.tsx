import { memo, FC, useMemo } from "react";
import { formatBytes } from "../utils/graphUtils";
import { ArrowRight, Package, File, ExternalLink } from "lucide-react";
import type { Module, Chunk } from "@plugin/types";
import type {
  GraphData,
  GraphNode,
} from "@plugin/utils/generateGraphFromChunkIdVsChunkMap";
import { Tooltip } from "./Tooltip";


interface ModuleDependenciesProps {
  selectedNode: GraphNode | null;
  graphData: GraphData;
  onNodeSelect: (node: GraphNode) => void;
}

const LIST_STYLE = {
  maxHeight: "250px",
  overflow: "auto",
};

const EmptyDependency = memo(() => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex items-center justify-center">
      <div className="text-center text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">Select a node to view dependencies</p>
      </div>
    </div>
  );
});

const Dependencies: FC<
  Omit<ModuleDependenciesProps, "selectedNode"> & { selectedNode: GraphNode }
> = memo(({ selectedNode, graphData, onNodeSelect }) => {
  
const dependencies = useMemo(() => {
  const seen = new Set<string>();
  return graphData.links
    .filter(link => link.source === selectedNode.id)
    .map(link => {
      const node = graphData.nodes.find(n => n.id === link.target);
      return node ? { link, node } : null;
    })
    .filter(
      (
        item
      ): item is {
        link: (typeof graphData.links)[number];
        node: (typeof graphData.nodes)[number];
      } => {
        if (!item || seen.has(item.node.id)) return false;
        seen.add(item.node.id);
        return true;
      }
    );
}, [graphData, selectedNode.id]);

const dependents = useMemo(() => {
  const seen = new Set<string>();
  return graphData.links
    .filter(link => link.target === selectedNode.id)
    .map(link => {
      const node = graphData.nodes.find(n => n.id === link.source);
      return node ? { link, node } : null;
    })
    .filter(
      (
        item
      ): item is {
        link: (typeof graphData.links)[number];
        node: (typeof graphData.nodes)[number];
      } => {
        if (!item || seen.has(item.node.id)) return false;
        seen.add(item.node.id);
        return true;
      }
    );
}, [graphData, selectedNode.id]);

  const isModule = selectedNode.type === "module";
  const data = selectedNode.data as Module | Chunk;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          {isModule ? (
            <File className="w-5 h-5 text-blue-600" />
          ) : (
            <Package className="w-5 h-5 text-purple-600" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {isModule ? "Module Details" : "Chunk Details"}
            </h3>
            <Tooltip
              content={isModule ? (data as Module).fileName : selectedNode.id}
            >
              <p className="text-sm text-gray-600 text-wrap truncate">
                {isModule ? (data as Module).fileName : selectedNode.id}
              </p>
            </Tooltip>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Type:</span>
            <span className="ml-2 text-gray-600">
              {isModule ? (data as Module).type : (data as Chunk).type}
            </span>
          </div>
          {isModule && (
            <div>
              <span className="font-medium text-gray-700">CommonJS:</span>
              <span className="ml-2 text-gray-600">
                {(data as Module).isCommonJS ? "Yes" : "No"}
              </span>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Stat Size:</span>
            <span className="ml-2 text-gray-600">
              {formatBytes(data.statSize || 0)}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Parsed Size:</span>
            <span className="ml-2 text-gray-600">
              {formatBytes(data.parsedSize || 0)}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Gzip Size:</span>
            <span className="ml-2 text-gray-600">
              {formatBytes(data.gzipSize || 0)}
            </span>
          </div>
        </div>

        {/* Module specific info */}
        {isModule && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="space-y-2 text-sm" style={LIST_STYLE}>
              {(data as Module).exports.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Exports:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(data as Module).exports.map((exp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(data as Module).treeShakenExports.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">
                    Tree Shaken:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1" style={LIST_STYLE}>
                    {(data as Module).treeShakenExports.map((exp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dependencies and Dependents */}
      <div className="flex-1 overflow-auto">
        {/* Dependencies */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-gray-500" />
            Dependencies ({dependencies.length})
          </h4>

          {dependencies.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No dependencies</p>
          ) : (
            <div className="space-y-2" style={LIST_STYLE}>
              {dependencies.map(({ link, node }, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onNodeSelect(node)}
                >
                  {node.type === "chunk" ? (
                    <Package className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <Tooltip content={node.id}>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {node.id}
                      </p>
                    </Tooltip>

                    {link.reason && (
                      <p className="text-xs text-gray-500 truncate">
                        {link.reason.type}: {link.reason.explanation}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {formatBytes(node.data.gzipSize || 0)}
                  </div>

                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dependents */}
        <div className="p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-gray-500 rotate-180" />
            Imported By ({dependents.length})
          </h4>

          {dependents.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Not imported by any modules
            </p>
          ) : (
            <div className="space-y-2" style={LIST_STYLE}>
              {dependents.map(({ link, node }, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onNodeSelect(node)}
                >
                  {node.type === "chunk" ? (
                    <Package className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <Tooltip content={node.id}>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {node.id}
                      </p>
                    </Tooltip>
                    {link.reason && (
                      <p className="text-xs text-gray-500 truncate">
                        {link.reason.type}: {link.reason.explanation}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {formatBytes(node.data.gzipSize || 0)}
                  </div>

                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const ModuleDependencies: FC<ModuleDependenciesProps> = memo(
  ({ selectedNode, graphData, onNodeSelect }) => {
    return selectedNode ? (
      <Dependencies
        selectedNode={selectedNode}
        graphData={graphData}
        onNodeSelect={onNodeSelect}
      />
    ) : (
      <EmptyDependency />
    );
  },
);
