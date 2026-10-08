import type { CivilTime, Gender, Place } from "../types";

/**
 * 命理诠释和历史人物放在这里。
 * 空着的条目不会被界面引用。填上之后，对话和相合会直接用。
 */
export type FigureRecord = {
  id: string;
  name: string;
  gender: Gender;
  time: CivilTime;
  place: Place;
  hourUnknown: boolean;
  mbti?: string | null;
  note: string;
};

export type KnowledgePack = {
  id: string;
  stems: Partial<Record<string, string>>;
  branches: Partial<Record<string, string>>;
  tenGods: Partial<Record<string, string>>;
  nayin: Partial<Record<string, string>>;
  figures: FigureRecord[];
};

export const knowledgePack: KnowledgePack = {
  id: "base",
  stems: {},
  branches: {},
  tenGods: {},
  nayin: {},
  figures: [],
};
