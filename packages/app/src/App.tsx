import { useCallback, useState } from "react";
import { FileTree } from "./components/FileTree/FileTree";
import { ModuleDependencies } from "./components/ModuleDependencies";
import {
  GraphData,
  GraphNode,
  generateGraphFromChunkIdVsChunkMap,
} from "@plugin/utils/generateGraphFromChunkIdVsChunkMap";

import { FileText } from "lucide-react";

function App() {
  const [graphData] = useState<GraphData>(() =>
    // @ts-expect-error --- Can use here
    generateGraphFromChunkIdVsChunkMap(window.CHUNK_DATA ?? {}),
  );
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const handleNodeSelect = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Bundle Analyzer Report
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Nodes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {graphData.nodes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Chunks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {graphData.nodes.filter(n => n.type === "chunk").length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Modules</p>
                <p className="text-2xl font-bold text-gray-900">
                  {graphData.nodes.filter(n => n.type === "module").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Tree */}
          <div className="lg:col-span-2">
            <FileTree
              graphData={graphData}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNode?.id}
            />
          </div>

          {/* Dependencies Panel */}
          <div>
            <ModuleDependencies
              selectedNode={selectedNode}
              graphData={graphData}
              onNodeSelect={handleNodeSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
