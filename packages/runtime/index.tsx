import { useEffect } from "react";
import type { Fiber, FiberRoot } from "react-reconciler";

const METADATA_KEY = "__REACT_COMPONENT_SOURCE__";

declare global {
  interface Window {
    getMountedComponents?: () => void;
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
function walkFiber(fiber: Fiber, sources: Record<string, Set<string>>): void {
  if (!fiber) return;

  const source: Source | undefined = fiber.pendingProps?.[METADATA_KEY];

  if (source) {
    sources[source.fileName] ??= new Set<string>();
    sources[source.fileName].add(source.componentName);
  }

  if (fiber.child) {
    walkFiber(fiber.child, sources);
  }
  if (fiber.sibling) {
    walkFiber(fiber.sibling, sources);
  }
}

// Core function to get mounted component sources
function getMountedComponents(): Record<string, Set<string>> {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return {};

  const renderers = hook.renderers ?? new Map<number, any>();
  const sources: Record<string, Set<string>> = {};

  for (const [rendererId] of renderers) {
    const fiberRoots = hook.getFiberRoots?.(rendererId);
    if (!fiberRoots) continue;

    fiberRoots.forEach(root => {
      walkFiber(root.current, sources);
    });
  }
  return sources;
}

export function useRegisterGetMountedComponents(): void {
  useEffect(() => {
    window.getMountedComponents = getMountedComponents;
    return () => {
      delete window.getMountedComponents;
    };
  }, []);
}

export function withGetMountedSources<P extends object>(
  WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P> {
  return function WithMountedSources(props: P) {
    useRegisterGetMountedComponents();
    return <WrappedComponent {...props} />;
  };
}

export { useWhyDidYouUpdate, withWhyDidYouUpdate } from "./useWhyDidYouUpdate";
