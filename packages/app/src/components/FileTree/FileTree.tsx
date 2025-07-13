// libs
import { useState, useMemo } from "react";

// components
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  Filter,
  ArrowUpDown,
  Package,
  FileText,
  Code,
  Palette,
  Settings,
} from "lucide-react";

// utils
import { formatBytes } from "../../utils/graphUtils";
import { buildTree } from "./utils/buildTree";
import { getNodeColor } from "./utils/getNodeColor";

// types
import { FileTreeProps, SortOption, FilterOption, TreeNode } from "./types";
import { adaptTree } from "./utils/adaptTree";
import { useLatestCallback } from "../../hooks/useLatestCallback";

export const FileTree: React.FC<FileTreeProps> = ({
  graphData,
  onNodeSelect,
  selectedNodeId,
}) => {
  // wrapper
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["root"]),
  );
  
  // states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterBy, setFilterBy] = useState<FilterOption>("module");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const tree = useMemo(() => buildTree(graphData, filterBy==="chunk" ), [graphData, filterBy]);
  const adaptedTree = useMemo(
    () => adaptTree({ tree, searchTerm, sortBy, filterBy, sortDirection }),
    [tree, sortBy, filterBy, sortDirection, searchTerm],
  );

  const toggleExpanded = useLatestCallback((nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  });

  const handleSort = useLatestCallback((option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortDirection("asc");
    }
  });

  const getFileIcon = useLatestCallback((node: TreeNode) => {
    if (node.type === "chunk") return Package;
    if (node.type === "folder") {
      return expandedNodes.has(node.id) ? FolderOpen : Folder;
    }

    if (node.isCommonJS) return Settings;
    switch (node.fileType) {
      case "javascript":
        return Code;
      case "typescript":
        return Code;
      case "stylesheet":
        return Palette;
      case "data":
        return FileText;
      default:
        return File;
    }
  });

  const renderTreeNode = useLatestCallback(
    (node: TreeNode, depth: number = 0): React.ReactNode => {
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedNodeId === node.id;
      const hasChildren = node.children.length > 0;
      const Icon = getFileIcon(node);

      return (
        <div key={node.id} className="select-none">
          <div
            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
              isSelected ? "bg-blue-100 border border-blue-300" : ""
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleExpanded(node.id);
              }
              if (node.node) {
                onNodeSelect(node.node);
              }
            }}
          >
            {hasChildren && (
              <button className="p-0.5 hover:bg-gray-200 rounded">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}

            <Icon className={`w-4 h-4 ${getNodeColor(node)}`} />

            <span className="flex-1 text-sm font-medium text-gray-900 truncate">
              {node.name}
            </span>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              {node.importedBy.length > 0 && (
                <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                  {node.importedBy.length} deps
                </span>
              )}
              <span className="font-mono">{formatBytes(node.statSize)}</span>
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div>
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
  );

  if (!adaptedTree) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">File Tree</h3>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => handleSort(e.target.value as SortOption)}
              className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
            >
              <option value="name">Name</option>
              <option value="statSize">Stat Size</option>
              <option value="parsedSize">Parsed Size</option>
              <option value="gzipSize">Gzip Size</option>
            </select>
            <ArrowUpDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={filterBy}
              onChange={e => setFilterBy(e.target.value as FilterOption)}
              className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
            >
              <option value="chunk">Chunks Only</option>
              <option value="module">Modules Only</option>
              <option value="commonjs">CommonJS</option>
              <option value="large">Large Files (&gt;1KB Gzipped)</option>
            </select>
            <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tree */}
      <div style={{ height: "450px", overflow: "auto" }}>
        <div className="flex-1 p-2">{renderTreeNode(adaptedTree)}</div>
      </div>

      {/* Stats */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-medium text-gray-700">Total Size:</span>
            <span className="ml-1 text-gray-600">
              {formatBytes(adaptedTree.statSize || 0)}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Gzip Size:</span>
            <span className="ml-1 text-gray-600">
              {formatBytes(adaptedTree.gzipSize || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
