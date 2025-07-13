// libs
import path from "path";
import fs from "fs";
import _ from "lodash";
import { parse } from "cjs-module-lexer";
// @ts-ignore
import { mergeRuntimeOwned, getEntryRuntime } from "webpack/lib/util/runtime";
// @ts-ignore
import ConcatenatedModule from "webpack/lib/optimize/ConcatenatedModule";
import {
  Compiler,
  NormalModule,
  Chunk as WebpackChunk,
  Module as WebpackModule,
  ModuleGraphConnection,
  Compilation,
  Stats,
} from "webpack";
import ts from "typescript";

// utils
import { markAsUsed } from "./utils/markAsUsed";
import { isTargetChunk } from "./utils/isTargetChunk";

// types
import type { DisableTreeShaking } from "./utils/types";
import type { RequireKeys, Module, Chunk, Datum, Reason } from "./types";
import { addScriptToHtml } from "./utils/addScript";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitUntilFileExists = async (
  filePath: string,
  timeout = 10000,
  interval = 100,
): Promise<void> => {
  const start = Date.now();

  while (!fs.existsSync(filePath)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for file: ${filePath}`);
    }
    await sleep(interval);
  }
};

function isSourceCommonJS(sourceCode: ts.Node): boolean {
  let isCommonJS = false;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require"
      ) {
        isCommonJS = true;
      }
    }
    // Detect module.exports/exports assignments
    if (ts.isBinaryExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.getText() === "module" &&
        node.left.name.text === "exports"
      ) {
        isCommonJS = true;
      }

      if (
        ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.getText() === "exports"
      ) {
        isCommonJS = true;
      }
    }

    // Detect Object.assign(exports, ...) or Object.defineProperty(exports, ...)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === "Object"
    ) {
      const methodName = node.expression.name.text;
      if (
        (methodName === "assign" || methodName === "defineProperty") &&
        node.arguments.some(arg => arg.getText() === "exports")
      ) {
        isCommonJS = true;
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceCode);
  return isCommonJS;
}

function collectExports(node: ts.Node, exportNames: Set<string>): void {
  if (ts.isExportDeclaration(node)) {
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        exportNames.add(element.name.text); // `export { x as y }` → y
      }
    }
  } else if (ts.isExportAssignment(node)) {
    if (!node.isExportEquals) {
      exportNames.add("default"); // `export default something`
    }
  } else if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
  ) {
    exportNames.add("default"); // `export default function foo() {}` → only "default"
  } else if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
  ) {
    if (node.name) {
      exportNames.add(node.name.text); // `export class Foo {}` → Foo
    }
  } else if (
    ts.isVariableStatement(node) &&
    node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
  ) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        exportNames.add(decl.name.text); // `export const bar = 1` → bar
      }
    }
  }
  ts.forEachChild(node, child => collectExports(child, exportNames));
}

const isConcatenatedModule = (datum: Datum): boolean =>
  !!(datum.concatenated || datum.label.includes("concatenated"));

const getChunkId = (label: string): string => {
  // Remove path prefixes
  let filename = label.replace("static/chunks/", "").replaceAll("../", "");

  // Check for standard webpack hash pattern (8+ hex chars before extension)
  const hashPattern = /([.-])([0-9a-f]{8,})(?=\.|$)/i;
  const hashMatch = filename.match(hashPattern);

  if (hashMatch) {
    // Split at the hash separator position
    return filename.substring(0, hashMatch.index);
  }

  // If no hash found, just remove the extension if present
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
};

const flattenGroups = (groups: Datum[] | undefined): Datum[] => {
  if (!groups) return [];

  const result: Datum[] = [];

  const stack = [...groups];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const { groups: nested, ...rest } = current;
    result.push({ ...rest, concatenated: isConcatenatedModule(rest) });
    if (nested?.length) {
      stack.push(...nested);
    }
  }

  return result;
};

const readAndAdaptFile = (
  fileName: string,
): {
  chunkIdVsModuleData: Record<string, RequireKeys<Datum, "concatenated">[]>;
  chunkIdVsChunkData: Record<
    string,
    { parsedSize: number; gzipSize: number; statSize: number }
  >;
} => {
  const source = fs.readFileSync(fileName, "utf-8");

  // Add chunk ids
  const data = JSON.parse(source) as Datum[];
  const adaptedData = data.map(datum => {
    return {
      ...datum,
      id: getChunkId(datum.label),
      groups: flattenGroups(datum.groups),
    };
  });

  const chunkIdVsChunkData = adaptedData.reduce<
    Record<string, { parsedSize: number; gzipSize: number; statSize: number }>
  >((acc, chunk) => {
    acc[chunk.id] = {
      parsedSize: chunk.parsedSize || 0,
      gzipSize: chunk.gzipSize || 0,
      statSize: chunk.statSize || 0,
    };
    return acc;
  }, {});

  const chunkIdVsModuleData = adaptedData.reduce<
    Record<string, RequireKeys<Datum, "concatenated">[]>
  >((acc, chunk) => {
    const id = String(chunk.id); // Ensures the key is a string
    acc[id] = (chunk.groups ?? []) as RequireKeys<Datum, "concatenated">[];
    return acc;
  }, {});

  return { chunkIdVsModuleData, chunkIdVsChunkData };
};

export class ChunkReportPlugin {
  #filePath: string;
  runtime: string;
  reportFilename: string;
  outputDirectory: string | undefined;
  emitChunkIdVsModuleData: boolean | undefined;
  disableTreeShaking: DisableTreeShaking | undefined;

  constructor({
    runtime,
    reportFilename,
    outputDirectory,
    emitChunkIdVsModuleData,
    disableTreeShaking,
  }: {
    runtime: string;
    reportFilename: string;
    outputDirectory: string | undefined;
    emitChunkIdVsModuleData: boolean | undefined;
    disableTreeShaking: DisableTreeShaking | undefined;
  }) {
    this.runtime = runtime;
    this.reportFilename = reportFilename;
    this.#filePath = "";
    this.outputDirectory = outputDirectory;
    this.emitChunkIdVsModuleData = emitChunkIdVsModuleData;
    this.disableTreeShaking = disableTreeShaking;
  }

  getChunkType = ({
    isInitial,
    modules,
    getIncomingConnections,
  }: {
    isInitial: boolean;
    modules: Iterable<WebpackModule>;
    getIncomingConnections: (
      module: WebpackModule,
    ) => Iterable<ModuleGraphConnection>;
  }): string => {
    const reasons: string[] = [];
    for (const module of modules) {
      for (const dep of getIncomingConnections(module)) {
        const depModule = dep.originModule;
        if (depModule && dep.dependency && dep.dependency.loc) {
          const locStr = dep.dependency.loc.toString();
          if (locStr.includes("webpackPrefetch")) {
            reasons.push("prefetch");
          } else if (locStr.includes("webpackPreload")) {
            reasons.push("preload");
          } else {
            reasons.push("dynamic");
          }
        }
      }
    }
    // Classify type
    let type = "sync";
    if (!isInitial) {
      if (reasons.includes("prefetch")) {
        type = "prefetch";
      } else if (reasons.includes("preload")) {
        type = "preload";
      } else {
        type = "lazy";
      }
    }
    return type;
  };

  getModuleExportsMetadata = (
    module: NormalModule,
    compilation: Compilation,
    chunk: WebpackChunk,
  ): {
    isCommonJS: boolean;
    exports: string[];
    treeShakenExports: string[];
  } => {
    const filePath = module.resource;

    if (!filePath || !fs.existsSync(filePath)) {
      return { isCommonJS: false, exports: [], treeShakenExports: [] };
    }
    const sourceCode = fs.readFileSync(module.resource, "utf-8");

    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
    );

    const exportNames = new Set<string>();

    // Check if CJS or ECMA Module
    const isCommonJS =
      !sourceCode.includes("__esModule") && isSourceCommonJS(sourceFile);

    // ECMA Modules
    collectExports(sourceFile, exportNames);

    // CJS Modules
    try {
      const { exports, reexports } = parse(sourceCode);
      exports.forEach(ex => {
        exportNames.add(ex);
      });
      reexports.forEach(ex => {
        exportNames.add(ex);
      });
    } catch (e) {
      // Fail silently - ?? No clue
    }

    const treeShakenExports = new Set<string>();

    const used = compilation.moduleGraph.getUsedExports(module, chunk.runtime);
    if (!used) {
      exportNames.forEach(e => treeShakenExports.add(e));
    } else if (used !== true) {
      exportNames.forEach(e => {
        if (used && !used.has(e)) {
          treeShakenExports.add(e);
        }
      });
    }

    return {
      isCommonJS,
      exports: Array.from(exportNames),
      treeShakenExports: Array.from(treeShakenExports),
    };
  };

  getSourceModules(module: WebpackModule): NormalModule[] {
    const modules: NormalModule[] = [];

    const recurse = (mod: any) => {
      if (!mod || typeof mod !== "object") return;

      if (mod instanceof ConcatenatedModule && Array.isArray(mod.modules)) {
        for (const inner of mod.modules) {
          recurse(inner);
        }
      } else if (mod instanceof NormalModule) {
        modules.push(mod);
      }
    };

    recurse(module);
    return modules;
  }

  getModuleIdentifier(compilation: Compilation, module: WebpackModule): string {
    if (module instanceof NormalModule) {
      const resourcePath = module.resource;
      const relativePath = path.relative(
        compilation.compiler.context,
        resourcePath,
      );
      return relativePath;
    } else {
      const pipedIdentifier = module.identifier().split("|");
      const fileWithLoaders =
        pipedIdentifier.find(item => item.includes(process.cwd())) ?? "";
      const loaderMetadata = fileWithLoaders.split("!");
      const resourcePath = loaderMetadata[loaderMetadata.length - 1];
      const relativePath = path.relative(
        compilation.compiler.context,
        resourcePath,
      );
      const modules = this.getSourceModules(module);
      return module instanceof ConcatenatedModule
        ? `${relativePath} + ${modules.length - 1} modules (concatenated)`
        : relativePath;
    }
  }

  getReasons(compilation: Compilation, module: WebpackModule): Reason[] {
    const reasons: Reason[] = [];
    // Get all incoming connections (why this module was included)
    for (const connection of compilation.moduleGraph.getIncomingConnections(
      module,
    )) {
      if (connection.originModule) {
        reasons.push({
          from: this.getModuleIdentifier(compilation, connection.originModule),
          explanation: connection.explanation,
          type: connection.dependency?.type,
        });
      }
    }
    return reasons;
  }

  async compute(compiler: Compiler, stats: Stats) {
    const compilation = stats.compilation;
    const { chunkGraph } = compilation;
    const chunkDataMap: Record<string, Chunk> = {};

    const fileName = this.#filePath;

    const { chunkIdVsModuleData, chunkIdVsChunkData } =
      readAndAdaptFile(fileName);

    for (const chunk of compilation.chunks) {
      const chunkId =
        chunk.name || chunk.id?.toString() || `chunk-${chunk.debugId}`;

      chunkIdVsModuleData[chunkId] ??= [];

      const modules = chunkGraph.getChunkModulesIterable(chunk);
      const isInitial = chunk.canBeInitial();
      const chunkType = this.getChunkType({
        isInitial,
        modules,
        getIncomingConnections: mod =>
          compilation.moduleGraph.getIncomingConnections(mod),
      });

      const chunkData: Chunk = {
        ...chunkIdVsChunkData[chunkId],
        id: chunkId,
        modules: [],
        type: chunkType,
      };

      for (const module of modules) {
        const moduleId = chunkGraph.getModuleId(module);
        const moduleType =
          module instanceof NormalModule
            ? "Normal"
            : module instanceof ConcatenatedModule
              ? "Concatenated"
              : "External";
        const fileName = this.getModuleIdentifier(compilation, module);

        const moduleMetadata: Module = {
          type: moduleType,
          id: moduleId,
          fileName,
          exports: [],
          treeShakenExports: [],
          parsedSize: 0,
          gzipSize: 0,
          statSize: 0,
          subModules: [],
          reasons: this.getReasons(compilation, module),
          isCommonJS: false,
        };

        const modulesInChunk = chunkIdVsModuleData[chunkId];

        if (module instanceof NormalModule) {
          const normalModule = module as NormalModule;
          if (fileName) {
            const { exports, treeShakenExports, isCommonJS } =
              this.getModuleExportsMetadata(normalModule, compilation, chunk);
            moduleMetadata.exports = exports;
            moduleMetadata.treeShakenExports = treeShakenExports;
            moduleMetadata.fileName = fileName;
            const moduleIndex = modulesInChunk.findIndex(
              mod => mod.path && mod.path.includes(fileName),
            );
            moduleMetadata.gzipSize =
              moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].gzipSize;
            moduleMetadata.statSize =
              moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].statSize;
            moduleMetadata.parsedSize =
              moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].parsedSize;
            moduleMetadata.isCommonJS = isCommonJS;
          }
        } else if (module instanceof ConcatenatedModule) {
          const concatenatedModuleFilename = `./${fileName}`;
          const concatenatedModuleIndex = modulesInChunk.findIndex(
            mod => mod.path && mod.path.includes(concatenatedModuleFilename),
          );
          moduleMetadata.gzipSize =
            concatenatedModuleIndex === -1
              ? 0
              : modulesInChunk[concatenatedModuleIndex].gzipSize;
          moduleMetadata.statSize =
            concatenatedModuleIndex === -1
              ? 0
              : modulesInChunk[concatenatedModuleIndex].statSize;
          moduleMetadata.parsedSize =
            concatenatedModuleIndex === -1
              ? 0
              : modulesInChunk[concatenatedModuleIndex].parsedSize;

          const sourceModules = this.getSourceModules(module);
          for (const mod of sourceModules) {
            const { exports, treeShakenExports, isCommonJS } =
              this.getModuleExportsMetadata(mod, compilation, chunk);
            const relativePath = path.relative(
              compilation.compiler.context,
              mod.resource,
            );
            const identifier = `${concatenatedModuleFilename}/${relativePath}`;
            const moduleIndex = modulesInChunk.findIndex(
              mod => mod.path && mod.path.includes(identifier),
            );
            moduleMetadata.subModules.push({
              type: mod instanceof NormalModule ? "Normal" : "Concatenated",
              id: chunkGraph.getModuleId(mod) ?? moduleId,
              fileName: relativePath,
              exports,
              treeShakenExports,
              gzipSize:
                moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].gzipSize,
              statSize:
                moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].statSize,
              parsedSize:
                moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].parsedSize,
              subModules: [],
              reasons: this.getReasons(compilation, mod),
              isCommonJS,
            });
          }
        } else {
          const moduleIndex = modulesInChunk.findIndex(
            mod => mod.path && mod.path.includes(fileName),
          );
          moduleMetadata.gzipSize =
            moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].gzipSize;
          moduleMetadata.statSize =
            moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].statSize;
          moduleMetadata.parsedSize =
            moduleIndex === -1 ? 0 : modulesInChunk[moduleIndex].parsedSize;
        }
        chunkData.modules.push(moduleMetadata);
      }
      chunkDataMap[chunkId] = chunkData;
    }

    const chunkDataMapJSON = JSON.stringify(chunkDataMap);
    const chunkDataMapOutputDirectory =
      this.outputDirectory ?? path.resolve(process.cwd(), "chunk-reports");
    const htmlOutputFile = path.resolve(
      chunkDataMapOutputDirectory,
      `${this.runtime}.html`,
    );


    fs.mkdirSync(chunkDataMapOutputDirectory, { recursive: true });
    const content = `window.CHUNK_DATA = ${chunkDataMapJSON};`;
    await addScriptToHtml(content, htmlOutputFile);

    if (this.emitChunkIdVsModuleData) {
      const chunkIdVsModuleDataJSON = JSON.stringify(
        chunkIdVsModuleData,
        null,
        2,
      );
      const chunkIdVsModuleDataOutputFile = path.resolve(
        chunkDataMapOutputDirectory,
        `chunkIdVsModuleData-${this.runtime}.json`,
      );
      fs.writeFileSync(
        chunkIdVsModuleDataOutputFile,
        chunkIdVsModuleDataJSON,
        "utf-8",
      );
    }
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap("ChunkReportPlugin", compilation => {
      const { moduleGraph } = compilation;
      compilation.hooks.afterOptimizeChunkModules.tap(
        "ChunkReportPlugin",
        chunks => {
          const targetChunks = Array.from(chunks).filter(
            chunk =>
              chunk.name && isTargetChunk(chunk.name, this.disableTreeShaking),
          );
          let runtime: string | undefined = undefined;
          for (const [name, { options }] of compilation.entries) {
            runtime = mergeRuntimeOwned(
              runtime,
              getEntryRuntime(compilation, name, options),
            );
          }
          targetChunks.forEach(targetChunk => {
            const mods =
              compilation.chunkGraph.getChunkModulesIterable(targetChunk);
            for (const mod of mods) {
              if (mod.type.startsWith("javascript/")) {
                markAsUsed(mod, moduleGraph, runtime);
                if (module instanceof ConcatenatedModule) {
                  markAsUsed(
                    (mod as ConcatenatedModule).rootModule,
                    moduleGraph,
                    runtime,
                  );
                }
              }
            }
          });
        },
      );
    });

    compiler.hooks.done.tapAsync(
      "ChunkReportPlugin",
      async (stats, callback) => {
        try {
          this.#filePath = path.resolve(
            compiler.outputPath,
            this.reportFilename || "report.json",
          );
          await waitUntilFileExists(this.#filePath); // Waits until file exists or throws after timeout
          await this.compute(compiler, stats);
          callback();
        } catch (err) {
          console.error("Error in ChunkReportPlugin:", err);
          callback(err as Error);
        }
      },
    );
  }
}
