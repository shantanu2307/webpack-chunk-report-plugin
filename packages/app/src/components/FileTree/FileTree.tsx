// libs
import { useState, useMemo, useRef, useCallback, memo } from "react";
import { FixedSizeList as List } from "react-window";

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

type FlattenedTreeNode = TreeNode & { depth: number };

export const FileTree: React.FC<FileTreeProps> = memo(({
  graphData,
  onNodeSelect,
  selectedNodeId,
}) => {
  // State management
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["root"])
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterBy, setFilterBy] = useState<FilterOption>("module");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const chunkMode = filterBy === "chunk";
  const listRef = useRef<List>(null);

  // Memoized tree data
  const tree = useMemo(() => buildTree(graphData, chunkMode), [graphData, chunkMode]);

  const adaptedTree = useMemo(() => {
    const result = adaptTree({
      tree,
      searchTerm,
      sortBy,
      filterBy,
      sortDirection,
    });
    return result;
  }, [tree, searchTerm, sortBy, filterBy, sortDirection]);

  // Handlers
  const toggleExpanded = useLatestCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return newExpanded;
    });

    // Reset list cache when items change
    if (listRef.current && "resetAfterIndex" in listRef.current && typeof listRef.current.resetAfterIndex ==="function") {
      listRef.current.resetAfterIndex(0);
    }
  });

  const handleSort = useLatestCallback((option: SortOption) => {
    const shouldToggleSortDirection = option === sortBy;
    setSortBy(option);
    if(shouldToggleSortDirection){
      setSortDirection(prev => prev==="asc"?"desc":"asc");
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

  // Tree flattening for virtualization
  const flattenTree = useCallback(
    (node: TreeNode, depth = 0): FlattenedTreeNode[] => {
      const isExpanded = expandedNodes.has(node.id);
      const result: FlattenedTreeNode[] = [{ ...node, depth }];

      if (isExpanded && node.children && node.children.length > 0) {
        node.children.forEach(child => {
          result.push(...flattenTree(child, depth + 1));
        });
      }
      return result;
    },
    [expandedNodes]
  );

  const flattenedNodes = useMemo(() => {
    const result = adaptedTree ? flattenTree(adaptedTree) : [];
    return result;
  }, [adaptedTree, flattenTree]);

  const renderTreeNode = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const node = flattenedNodes[index];
      if (!node) {
        return <div style={style}>No node at index {index}</div>;
      }

      const isSelected = selectedNodeId === node.id;
      const hasChildren = node.children && node.children.length > 0;
      const Icon = getFileIcon(node);
      return (
        <div style={style} key={node.id} className="select-none">
          <div
            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
              isSelected ? "bg-blue-100 border border-blue-300" : ""
            }`}
            style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleExpanded(node.id);
              }
              if (node.node) onNodeSelect(node.node);
            }}
            aria-label={node.name}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={hasChildren ? expandedNodes.has(node.id) : undefined}
          >
            {hasChildren ? (
              <button
                className="p-0.5 hover:bg-gray-200 rounded"
                aria-label={expandedNodes.has(node.id) ? "Collapse" : "Expand"}
                onClick={e => {
                  e.stopPropagation();
                  toggleExpanded(node.id);
                }}
              >
                {expandedNodes.has(node.id) ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}

            <Icon key={node.id} className={`w-4 h-4 ${getNodeColor(node)}`} />

            <span className="flex-1 text-sm font-medium text-gray-900 truncate">
              {node.name}
            </span>

            {node.importedBy && node.importedBy.length > 0 && (
              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                {node.importedBy.length} deps
              </span>
            )}
            <span className="text-xs text-gray-500 font-mono">
              {formatBytes(node.statSize)}
            </span>
          </div>
        </div>
      );
    },
    [expandedNodes, flattenedNodes, getFileIcon, onNodeSelect, selectedNodeId, toggleExpanded]
  );

  const onSearch = useLatestCallback((e)=>{
    setSearchTerm(e.target.value);
  });

  const onSort = useLatestCallback((e)=>{
       handleSort(e.target.value as SortOption);
  });

  const onFilter = useLatestCallback((e)=>{
      setFilterBy(e.target.value as FilterOption);
  })

  // Early return with debug info
  if (!graphData) {
    return <div className="p-4 text-red-500">No graph data provided</div>;
  }

  if (!tree) {
    return <div className="p-4 text-red-500">Failed to build tree</div>;
  }

  if (!adaptedTree) {
    return <div className="p-4 text-red-500">Failed to adapt tree</div>;
  }

  if (flattenedNodes.length === 0) {
    return <div className="p-4 text-yellow-500">No nodes to display</div>;
  }

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col"
    >
      <div className="flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            File Tree ({flattenedNodes.length} items)
          </h3>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files and folders..."
                value={searchTerm}
                onChange={onSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                aria-label="Search files and folders"
              />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={sortBy}
                  onChange={onSort}
                  className="w-full appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                  aria-label="Sort by"
                >
                  <option value="name">Name</option>
                  <option value="statSize">Stat Size</option>
                  <option value="parsedSize">Parsed Size</option>
                  <option value="gzipSize">Gzip Size</option>
                </select>
                <ArrowUpDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative flex-1">
                <select
                  value={filterBy}
                  onChange={onFilter}
                  className="w-full appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                  aria-label="Filter by"
                >
                  <option value="module">Modules Only</option>
                  <option value="chunk">Chunks Only</option>
                  <option value="commonjs">CommonJS</option>
                  <option value="large">Large Files (&gt;1KB Gzipped)</option>
                </select>
                <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex-1 min-h-0">
        {/*@ts-expect-error --- Can use here */}
        <List
          ref={listRef}
          height={window.innerHeight} // Approximate height minus header
          itemCount={flattenedNodes.length}
          itemSize={32}
          width="100%"
          className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          aria-label="File tree"
        >
          {renderTreeNode}
        </List>
      </div>
    </div>
  );
});
