// Adapted from ya-chang/Moli src/main/emotion/EmotionFSM.ts (MIT).
// Disk files are replaced by the star-chart record.

export type Bond = {
  happiness: number;
  sadness: number;
  anger: number;
  anxiety: number;
  affection: number;
  intimacy: number;
  trust: number;
  energy: number;
  missLevel: number;
  patience: number;
  currentMood: string;
  lastInteraction: number;
  conversationStreak: number;
};

export const REST_BOND: Bond = {
  happiness: 70,
  sadness: 10,
  anger: 0,
  anxiety: 5,
  affection: 50,
  intimacy: 30,
  trust: 40,
  energy: 80,
  missLevel: 20,
  patience: 80,
  currentMood: "开心",
  lastInteraction: 0,
  conversationStreak: 0,
};

const LOVE = ["爱你", "喜欢你", "想你", "我喜欢"];

export function settleBond(bond: Bond, now: number): Bond {
  const last = bond.lastInteraction || now;
  const hours = Math.max(0, now - last) / 3600000;
  if (hours < 1 / 60) return bond;
  const factor = Math.max(0, 1 - hours * 0.01);
  const decay = (current: number, baseline: number) => baseline + (current - baseline) * factor;
  let missLevel = decay(bond.missLevel, 20);
  let sadness = decay(bond.sadness, 10);
  if (hours > 2) {
    missLevel = Math.min(100, missLevel + hours * 2);
    sadness = Math.min(100, sadness + 2);
  }
  const next = clampBond({
    ...bond,
    happiness: decay(bond.happiness, 70),
    affection: decay(bond.affection, 50),
    intimacy: decay(bond.intimacy, 30),
    anger: decay(bond.anger, 0),
    sadness,
    missLevel,
  });
  return { ...next, currentMood: moodLabel(next) };
}

export function hearBond(bond: Bond, text: string, userEmotion: string, now: number): Bond {
  const heard = settleBond(bond, now);
  const line = text.replace(/\s+/g, "");
  let next = { ...heard };
  if (LOVE.some((word) => line.includes(word))) {
    next.happiness += 20;
    next.affection += 5;
    next.intimacy += 3;
    next.missLevel -= 12;
  }
  if (userEmotion === "angry") {
    next.happiness -= 15;
    next.sadness += 10;
    next.energy -= 5;
    next.anger += 10;
  } else if (userEmotion === "sad") {
    next.sadness += 5;
    next.affection += 2;
    next.anxiety += 4;
  } else if (userEmotion === "happy" || userEmotion === "excited") {
    next.happiness += 5;
    next.energy += 3;
  } else {
    next.intimacy += 1;
    next.trust += 1;
    next.affection += 1;
    next.missLevel -= 8;
  }
  next.conversationStreak += 1;
  next.lastInteraction = now;
  next = clampBond(next);
  return { ...next, currentMood: moodLabel(next) };
}

export function bondCue(bond: Bond, userEmotion: string): string {
  const theirs =
    userEmotion === "sad"
      ? "对方这句是难过的。接住这件事，别追问，别讲道理。"
      : userEmotion === "angry"
        ? "对方这句在生气。话短一点，别顶回去，也别消失。"
        : userEmotion === "happy" || userEmotion === "excited"
          ? "对方这句是高兴的。跟着高兴，别泼冷水。"
          : "按这句本身接，不要另起一套安慰。";
  return `你现在的感受：心情${bond.currentMood}，开心 ${Math.round(bond.happiness)}，难过 ${Math.round(bond.sadness)}，生气 ${Math.round(bond.anger)}，牵挂 ${Math.round(bond.missLevel)}，亲近 ${Math.round(bond.intimacy)}，信任 ${Math.round(bond.trust)}。\n${theirs}`;
}

export function isBond(value: unknown): value is Bond {
  if (!value || typeof value !== "object") return false;
  const bond = value as Bond;
  return (
    ["happiness", "sadness", "anger", "anxiety", "affection", "intimacy", "trust", "energy", "missLevel", "patience", "lastInteraction", "conversationStreak"].every(
      (key) => typeof bond[key as keyof Bond] === "number",
    ) && typeof bond.currentMood === "string"
  );
}

function moodLabel(bond: Bond): string {
  if (bond.anger > 60) return "生气";
  if (bond.sadness > 60) return "难过";
  if (bond.anxiety > 60) return "不安";
  if (bond.happiness > 70) return "开心";
  if (bond.happiness > 40) return "平静";
  return "低落";
}

function clampBond(bond: Bond): Bond {
  const score = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  return {
    ...bond,
    happiness: score(bond.happiness),
    sadness: score(bond.sadness),
    anger: score(bond.anger),
    anxiety: score(bond.anxiety),
    affection: score(bond.affection),
    intimacy: score(bond.intimacy),
    trust: score(bond.trust),
    energy: score(bond.energy),
    missLevel: score(bond.missLevel),
    patience: score(bond.patience),
    conversationStreak: Math.max(0, Math.round(bond.conversationStreak)),
  };
}
