import { useEffect } from "react";
import type { Fiber, FiberRoot } from "react-reconciler";

const METADATA_KEY = "__REACT_COMPONENT_SOURCE__";

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      getFiberRoots?: (id: number) => Set<FiberRoot>;
      renderers?: Map<
        number,
        {
          findFiberByHostInstance?: (instance: unknown) => Fiber | null;
        }
      >;
    };
  }
}

export type Source = {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
  componentName: string;
};

// Utility function to walk the fiber tree
function walkFiber(
  fiber: Fiber,
  seen: Set<string> = new Set<string>()
): Set<string> {
  if (!fiber) return seen;
  const source: Source | undefined = fiber.pendingProps?.[METADATA_KEY];

  if (source) {
    seen.add(source.fileName);
  }

  if (fiber.child) {
    walkFiber(fiber.child, seen);
  }
  if (fiber.sibling) {
    walkFiber(fiber.sibling, seen);
  }

  return seen;
}

// Core function to get mounted component sources
function getMountedComponentSources(): Set<string> {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return new Set<string>();

  const renderers = hook.renderers ?? new Map<number, any>();
  const sources = new Set<string>();

  for (const [rendererId] of renderers) {
    const fiberRoots = hook.getFiberRoots?.(rendererId);
    if (!fiberRoots) continue;

    fiberRoots.forEach(root => {
      const mountedSources = walkFiber(root.current);
      mountedSources.forEach(src => sources.add(src));
    });
  }
  return sources;
}

// Hook version with timeout control
export function useMountedSources(options?: { timeout?: number }): void {
  const timeout = options?.timeout ?? 10_000 // 10 seconds
  useEffect(() => {
    const timer = setTimeout(()=>{
      const sources = getMountedComponentSources();
      console.log(Array.from(sources));
    }, timeout)
    return () => {
      clearTimeout(timer);
    };
  }, [timeout]);
}

export function withMountedSources<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { timeout?: number }
): React.ComponentType<P> {
  return function WithMountedSources(props: P) {
   useMountedSources(options);
    return <WrappedComponent {...props}  />;
  };
}
