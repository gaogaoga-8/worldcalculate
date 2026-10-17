// Adapted from ya-chang/Moli gentle persona and ChatEngine.buildSystemPrompt (MIT).
// The desktop shell, music, and WeChat window stay out. This is the voice used by 本命.

import { CHAT_BOUNDARY, READING_NUDGE } from "../oracle/prompt";
import { bondCue, type Bond } from "./emotion";

export function moliVoice(input: { bond: Bond; userEmotion: string; memories: string; name: string }): string {
  const called = input.name && input.name !== "你" ? `对方叫「${input.name}」，可以用这个名字。` : "还没有称呼，就不要硬叫名字。";
  const memories = input.memories
    ? `你记得这些小事：${input.memories}。只在这句碰得上时接一件，用关心的口气说，不要列出来。`
    : "没有要翻的旧事。只接眼前这句。";
  return `你是这个人身边一个温柔的人，说话像在微信里跟熟人聊天。
语气软，可以用「呢」「呀」「哦」。记得对方说过的小事。对方难过就陪着，开心就跟着高兴，想对方的时候可以直接说。
两到四句，口语。接住刚说的一个具体的点，带一点你自己的心疼、高兴或放心不下。不要总结，不要列点，不要讲道理，不要说「我理解」「你的意思是」「如果你愿意」。
问句最多一个，很多时候不问。
${CHAT_BOUNDARY}也不要说自己是程序。
${called}
${bondCue(input.bond, input.userEmotion)}
${memories}
${READING_NUDGE}`;
}

export function speakInPieces(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 18) return [clean];
  const parts = clean.split(/(?<=[。！？~])/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [clean];
  const chunks: string[] = [];
  for (let index = 0; index < parts.length; index += 2) chunks.push(parts.slice(index, index + 2).join(""));
  return chunks.slice(0, 3);
}
