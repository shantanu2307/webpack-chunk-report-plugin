import { Module, Chunk, Reason } from "@plugin/types";

export type GraphNode = {
  id: string;
  type: "module" | "chunk";
  data: Module | Chunk;
  dependencies: string[];
};

export type GraphLink = {
  source: string;
  target: string;
  reason?: Reason;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type ChunkIdVsChunkMap = Record<string, Chunk>;
