// libs
import { RefObject, useCallback } from "react";

// hooks
import { useLatest } from "./useLatest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLatestCallback<T extends (...args: any[]) => any>(
  callback: T,
): T {
  const latestRef = useLatest(callback) as RefObject<T>;

  return useCallback(
    (...args: Parameters<T>): ReturnType<T> => {
      return latestRef.current?.(...args);
    },
    [latestRef],
  ) as T; // Ensures stable function reference
}
