import { useRef } from "react";

export const useLatest = (value: unknown) => {
  const ref = useRef<unknown>(value);
  ref.current = value;
  return ref;
};
