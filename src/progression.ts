import { newId } from "./id";
import type { AppState } from "./store";
import { roundStar, starProgress, dailyRoundTurns } from "./galaxy";
import { RITUALS } from "./ritual";

/** 星名从这一轮真正说过的话里取，不再每颗都叫「缓一缓」。 */
function starTitle(text: string, fallback: string): string {
  const bare = text
    .replace(/[，。！？、；：""''（）《》…—\s,.!?;:'"()]+/gu, " ")
    .trim();
  if (!bare) return fallback;
  const first = bare.split(" ").find((part) => part.length >= 2) || bare;
  const title = first.slice(0, 8);
  return title.length >= 2 ? title : fallback;
}

export function finishDailyRound(prev: AppState, now = Date.now()): AppState {
  if (
    !starProgress(
      prev.stars,
      dailyRoundTurns(prev.messages, prev.roundTurns, now),
      now,
    ).allowed
  )
    return prev;
  const lit = prev.stars.filter((s) => s.kind === "round").length;
  const ritual = RITUALS[lit % RITUALS.length];
  const lastUser = [...prev.messages].reverse().find((message) => message.role === "user");
  const star = roundStar(starTitle(lastUser?.text || "", ritual.title), {
    god: "",
    echo: ritual.prompt,
  });
  return {
    ...prev,
    roundTurns: 0,
    stars: [...prev.stars, { ...star, litAt: now }],
    messages: [
      ...prev.messages,
      {
        id: newId(),
        role: "guide",
        text: "新的星，已经点亮。",
        at: now,
      },
    ],
  };
}
