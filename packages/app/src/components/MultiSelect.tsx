import { useEffect, FC, useState, useCallback, useMemo, useRef } from "react";
import { VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { Tooltip } from "./Tooltip";

interface MultiSelectItem {
  id: string;
  label: string;
  description?: string; // Optional field that might affect item height
}

interface VirtualizedMultiSelectProps {
  items: MultiSelectItem[];
  selectedItems: string[];
  onSelect: (selectedIds: string[]) => void;
  minHeight?: number;
  maxHeight?: number;
}

const getItemSize = () => 32;

const VirtualizedMultiSelect: FC<VirtualizedMultiSelectProps> = ({
  items,
  selectedItems,
  onSelect,
  minHeight = 200,
  maxHeight = 500,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const listRef = useRef<VariableSizeList>(null);

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    return items.filter(
      item =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [items, searchTerm]);

  // Reset row heights when filtered items change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [filteredItems]);

  // Toggle item selection
  const toggleItem = useCallback(
    (itemId: string) => {
      const newSelectedItems = selectedItems.includes(itemId)
        ? selectedItems.filter(id => id !== itemId)
        : [...selectedItems, itemId];
      onSelect(newSelectedItems);
    },
    [selectedItems, onSelect],
  );

  // Render each row
  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const item = filteredItems[index];
    const isSelected = selectedItems.includes(item.id);

    return (
      <div
        style={style}
        className={`px-3 py-1 cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden ${
          isSelected ? "bg-blue-50 text-blue-600" : ""
        }`}
        onClick={() => toggleItem(item.id)}
      >
        <div className="flex flex-row justify-between items-center gap-2">
          <div className="flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div className="w-full min-w-0">
            <Tooltip content={item.id}>
              <div className="text-sm font-medium truncate">{item.label}</div>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden flex flex-col">
      {/* Search input */}
      <div className="p-2 border-b border-gray-300">
        <input
          type="text"
          placeholder="Search..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Selected items count */}
      {selectedItems.length > 0 && (
        <div className="px-3 py-2 text-sm text-gray-600 bg-gray-50 border-b border-gray-200">
          {selectedItems.length} selected
        </div>
      )}

      {/* Virtualized list with AutoSizer */}
      <div className="flex-1" style={{ minHeight, maxHeight }}>
        {filteredItems.length > 0 ? (
          <AutoSizer>
            {({ height, width }) => (
              // @ts-expect-error --- Can use here
              <VariableSizeList
                ref={listRef}
                height={height}
                itemCount={filteredItems.length}
                itemSize={getItemSize}
                width={width}
                overscanCount={5} // Improves scroll performance
              >
                {Row}
              </VariableSizeList>
            )}
          </AutoSizer>
        ) : (
          <div className="flex items-center justify-center h-full py-4 text-gray-500">
            No items found
          </div>
        )}
      </div>
    </div>
  );
};

export { VirtualizedMultiSelect as MultiSelect };
