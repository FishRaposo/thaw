// Shared content contracts. Core and content import these types; neither needs the other's
// implementation, and platform code can describe progress/saves without importing level data.

export interface LevelDef {
  id: string;
  name: string;
  par: number;
  note?: string;
  rows: string[];
}

export interface LevelPack {
  id: string;
  name: string;
  version: number;
  levels: LevelDef[];
}

export type PackProgress = Record<string, number>; // level id -> best stars
export type Progress = Record<string, PackProgress>; // pack id -> level progress
