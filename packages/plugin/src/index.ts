import { merge } from "webpack-merge";

// plugins
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import { ChunkReportPlugin } from "./ChunkReportPlugin";

// types
import type { Configuration } from "webpack";
import type { WebpackConfigHOC, Options } from "./types";

/**
 * Creates a higher-order function for Webpack configuration
 * @param baseConfig - The base Webpack configuration
 * @param hocs - Array of configuration higher-order functions
 * @returns Merged Webpack configuration
 */
export function createWebpackConfig(
  baseConfig: Configuration,
  ...hocs: WebpackConfigHOC[]
): Configuration {
  return hocs.reduce((config, hoc) => hoc(config), baseConfig);
}

export function withChunkReportPlugin(options: Options = {}): WebpackConfigHOC {
  return (config: Configuration, context?: Record<string, any>) => {
    const {
      enabled,
      outputDirectory,
      emitChunkIdVsModuleData,
      disableTreeShaking,
      ...restOptions
    } = options;

    if (!enabled) {
      return config;
    }

    const runtime: string = context?.nextRuntime || "client";
    const reportFilename =
      options.reportFilename ?? `./analyze/${runtime}.json`;
    const analyzerMode = "json";
    const openAnalyzer =
      options.openAnalyzer !== undefined ? options.openAnalyzer : false;

    const newConfig: Configuration = {
      plugins: [
        new BundleAnalyzerPlugin({
          ...restOptions,
          analyzerMode,
          openAnalyzer,
          reportFilename,
        }),
        new ChunkReportPlugin({
          runtime,
          reportFilename,
          outputDirectory,
          emitChunkIdVsModuleData,
          disableTreeShaking,
        }),
      ],
    };
    return merge(config, newConfig);
  };
}

export type { Module, Chunk, Reason } from "./types";
export type { WebpackConfigHOC, Options } from "./types";
