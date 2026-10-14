import { newId } from "./id";
import type { AppState } from "./store";
import { roundStar, starProgress, dailyRoundTurns } from "./galaxy";
import { RITUALS } from "./ritual";

export function finishDailyRound(prev: AppState, now = Date.now()): AppState {
  if (
    !starProgress(
      prev.stars,
      dailyRoundTurns(prev.messages, prev.roundTurns, now),
      now,
    ).allowed
  )
    return prev;
  const ritual =
    RITUALS[
      prev.stars.filter((s) => s.kind === "round").length % RITUALS.length
    ];
  const star = roundStar(ritual.title, { god: "", echo: ritual.prompt });
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
