// plugin
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

// types
import type { Configuration } from "webpack";
import type { DisableTreeShaking } from "./utils/types";

export type WebpackConfigHOC = (
  config: Configuration,
  context?: Record<string, any>,
) => Configuration;

type BundleAnalyzerOptions = BundleAnalyzerPlugin.Options;

export type Options = Omit<BundleAnalyzerOptions, "analyzerMode"> & {
  outputDirectory?: string;
  enabled?: boolean;
  emitChunkIdVsModuleData?: boolean;
  disableTreeShaking?: DisableTreeShaking;
  useBabel?: boolean;
};

export type RequireKeys<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

export type Module = {
  type: "Normal" | "Concatenated" | "External";
  id: string | number | null;
  fileName: string;
  exports: string[];
  treeShakenExports: string[];
  gzipSize: number;
  parsedSize: number;
  statSize: number;
  subModules: Module[];
  reasons: Reason[];
  isCommonJS: boolean;
};

export type Chunk = {
  gzipSize: number;
  parsedSize: number;
  statSize: number;
  id: string;
  modules: Module[];
  type: string;
};

export type Datum = {
  id?: string | number;
  label: string;
  path?: string;
  isAsset?: boolean;
  gzipSize: number;
  statSize: number;
  parsedSize: number;
  concatenated?: boolean;
  groups?: Datum[];
};

export type Reason = {
  from: string;
  explanation: string;
  type: string | undefined;
};
