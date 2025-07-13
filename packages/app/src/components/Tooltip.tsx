import React, { ReactNode, useRef, useState, useLayoutEffect } from "react";
import ReactDOM from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (visible && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (position) {
        case "bottom":
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2;
          left = rect.left - 8;
          break;
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + 8;
          break;
        case "top":
        default:
          top = rect.top - 8;
          left = rect.left + rect.width / 2;
      }

      setCoords({ top, left });
    }
  }, [visible, position]);

  return (
    <>
      <div
        ref={wrapperRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>

      {visible &&
        ReactDOM.createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 text-sm text-white bg-gray-800 rounded shadow-md transition-opacity duration-150 opacity-100 pointer-events-none"
            style={{
              top: coords.top,
              left: coords.left,
              transform:
                position === "top" || position === "bottom"
                  ? "translateX(-50%)"
                  : "translateY(-50%)",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
};
