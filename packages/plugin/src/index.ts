// libs
import path from "path";
import { merge } from "webpack-merge";

// plugins
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import { ChunkReportPlugin } from "./ChunkReportPlugin";

// rules
import { transformReactComponentSource } from "./rules/transformReactComponentSource";

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
      useBabel = true,
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
      module: {
        rules: [
          useBabel
            ? {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: [
                      "@babel/preset-env",
                      "@babel/preset-react",
                      "@babel/preset-typescript", // if using TypeScript
                    ],
                    plugins: [
                      // Add your plugin here (assuming it's in src/babel/transform-react-component-source.js)
                      [
                        path.resolve(
                          __dirname,
                          "rules/babel/transformReactComponentSource.js",
                        ),
                      ],
                    ],
                  },
                },
              }
            : {
                test: /\.[jt]sx?$/, // Matches .js, .jsx, .ts, .tsx
                exclude: /node_modules/,
                use: {
                  loader: "ts-loader",
                  options: {
                    getCustomTransformers: () => ({
                      before: [transformReactComponentSource()],
                    }),
                    transpileOnly: true,
                  },
                },
              },
        ],
      },
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

export { METADATA_KEY } from "./rules/constants";
