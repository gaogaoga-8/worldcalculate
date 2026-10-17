// Opening lines use Moli's gentle care. Timing still follows the existing quiet hours.

import { reachLine, type Mood } from "../presence";
import type { MemoryNote } from "../presence";
import { beijingHour } from "../presence";
import type { Bond } from "./emotion";

export function closeReach(input: {
  now: number;
  messages: { role: string; text: string; at?: number; reach?: boolean }[];
  memories: MemoryNote[];
  mood: Mood;
  reachedAt: number | null;
  bond: Bond;
}): { text: string } | null {
  const line = reachLine(input);
  if (!line) return null;
  const hour = beijingHour(input.now);
  if (hour >= 5 && hour < 11) return { text: "早呀。睡得怎么样。" };
  if (input.bond.sadness >= 42 || input.bond.anxiety >= 42) return { text: "那件事还挂着。不用现在说，我在呢。" };
  if (input.bond.missLevel >= 36) return { text: "有一会儿没见你，有点想你。" };
  return { text: "在忙吗。吃过东西了没。" };
}
