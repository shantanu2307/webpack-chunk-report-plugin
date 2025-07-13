import type { DisableTreeShaking } from "./types";

export const isTargetChunk = (
  name: string,
  test: DisableTreeShaking | undefined,
): boolean => {
  if (typeof test === "string") {
    return test === name;
  }

  if (test instanceof RegExp) {
    return test.test(name);
  }

  if (typeof test === "function") {
    return test(name);
  }

  if (Array.isArray(test)) {
    return test.includes(name);
  }

  if (test instanceof Set) {
    return test.has(name);
  }
  return false;
};
