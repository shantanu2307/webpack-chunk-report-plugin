import type { Module, ModuleGraph } from "webpack";

export const markAsUsed = (
  module: Module,
  moduleGraph: ModuleGraph,
  runtime: string | undefined,
): void => {
  const exportsInfo = moduleGraph.getExportsInfo(module);
  exportsInfo.setUsedInUnknownWay(runtime);
};
