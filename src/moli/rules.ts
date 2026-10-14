// Adapted from ya-chang/Moli src/main/learning/RuleEngine.ts (MIT).

const EMOTION_DICT: Record<string, string[]> = {
  happy: ["哈哈哈", "哈哈", "好耶", "绝了", "可爱", "开心", "高兴", "太好了", "棒", "赞"],
  angry: ["烦死了", "滚", "你有病吧", "无语", "气死", "讨厌", "受不了", "别烦"],
  sad: ["累了", "好累", "心累", "不想", "难过", "伤心", "无聊", "没意思", "唉", "睡不着", "撑不住", "委屈", "想哭"],
  excited: ["卧槽", "牛逼", "太强了", "厉害", "666"],
};

const PUNCTUATION: Record<string, string> = {
  "！！！": "angry",
  "...": "sad",
  "？？？": "confused",
  "~~": "playful",
};

export function detectEmotion(content: string): string {
  for (const [emotion, keywords] of Object.entries(EMOTION_DICT)) {
    if (keywords.some((word) => content.includes(word))) return emotion;
  }
  for (const [mark, emotion] of Object.entries(PUNCTUATION)) {
    if (content.includes(mark)) return emotion;
  }
  return "neutral";
}
