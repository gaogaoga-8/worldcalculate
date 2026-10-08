import type { AppState } from "./store";
import {
  ROUND_TURNS,
  roundStar,
  starProgress,
  dailyRoundTurns,
} from "./galaxy";
import { senseRound } from "./chat";

export function finishDailyRound(prev: AppState, now = Date.now()): AppState {
  if (
    !starProgress(
      prev.stars,
      dailyRoundTurns(prev.messages, prev.roundTurns, now),
      now,
    ).allowed
  )
    return prev;
  const users = prev.messages
    .filter((message) => message.role === "user")
    .slice(-ROUND_TURNS);
  const star = roundStar(
    users.at(-1)?.text ?? "今天",
    senseRound(users.map((message) => message.text).join(" ")),
  );
  return {
    ...prev,
    roundTurns: 0,
    stars: [...prev.stars, { ...star, litAt: now }],
    messages: [
      ...prev.messages,
      {
        id: crypto.randomUUID(),
        role: "guide",
        text: "新的星，已经点亮。",
        at: now,
      },
    ],
  };
}
