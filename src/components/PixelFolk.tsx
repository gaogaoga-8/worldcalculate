const TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

const INK = "#141820";
const SKIN = "#e7d3c4";
const EYE = "#1b2433";

const LOOK: Record<string, { hair: string; cloth: string; accent: string }> = {
  INTJ: { hair: "#2a2144", cloth: "#6d4f96", accent: "#d2c4ea" },
  INTP: { hair: "#3a3158", cloth: "#8a74b0", accent: "#e4dcf4" },
  ENTJ: { hair: "#1c1730", cloth: "#4e3878", accent: "#cbbbe4" },
  ENTP: { hair: "#4a3d68", cloth: "#a08bc4", accent: "#f0e9fb" },
  INFJ: { hair: "#1c3d34", cloth: "#2f8a68", accent: "#c9eadc" },
  INFP: { hair: "#2d4a3e", cloth: "#6aab8c", accent: "#e5f6ee" },
  ENFJ: { hair: "#16382e", cloth: "#1f6b50", accent: "#bfe6d4" },
  ENFP: { hair: "#3d5c4c", cloth: "#8fc9a8", accent: "#f3fff8" },
  ISTJ: { hair: "#1a3344", cloth: "#3d7ea3", accent: "#d3e7f4" },
  ISFJ: { hair: "#2a4558", cloth: "#7aafcc", accent: "#eef6fb" },
  ESTJ: { hair: "#152838", cloth: "#2a6284", accent: "#c5dced" },
  ESFJ: { hair: "#3a5568", cloth: "#9ec4da", accent: "#f7fbfd" },
  ISTP: { hair: "#4a3518", cloth: "#c4922a", accent: "#f6e3b4" },
  ISFP: { hair: "#5c4630", cloth: "#e0b96a", accent: "#fff3d8" },
  ESTP: { hair: "#3d2c12", cloth: "#a87418", accent: "#f3d48a" },
  ESFP: { hair: "#6a4e28", cloth: "#f0c56e", accent: "#fff8e8" },
};

const POSES = [
  [
    "..hhhhh..",
    ".hhhhhhh.",
    "hhskkkshh",
    "hskekeksh",
    "hskkkkksh",
    ".skkkkkks.",
    "..ccccc..",
    ".cccaaccc",
    "cc.....cc",
    ".ccccccc.",
    "..cc.cc..",
    "..cc.cc..",
    ".bb...bb.",
  ],
  [
    "...hhh...",
    "..hhhhh..",
    ".hhskkshh",
    "hskekeksh",
    ".skkkkkks.",
    "..ccccc..",
    ".ccc.accc",
    "cc.....cc",
    ".ccccccc.",
    "..c.c.c..",
    "..c...c..",
    "..b...b..",
    ".bb...bb.",
  ],
  [
    "hhhhhhhhh",
    "hhhskkshh",
    "hhskekksh",
    ".hskkkksh.",
    "..ccccc..",
    ".cccaaccc",
    "cc.....cc",
    ".ccccccc.",
    "..c.c.c..",
    "..c...c..",
    ".bb...bb.",
    "b.......b",
    "..........",
  ],
  [
    ".hhhhhhh.",
    "hhhhhhhhh",
    "hhskkkshh",
    ".skekeks.",
    ".skkkkkks.",
    "..ccccc..",
    ".cccaaccc",
    "c.......c",
    ".ccccccc.",
    "...c.c...",
    "...c.c...",
    "..bb.bb..",
    "..........",
  ],
];

const ACT: Record<string, string[]> = {
  INTJ: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkks.", ".skkkkkc.", "..ccccc..", ".cccaacc.", "c......c.", ".cccccc..", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  INTP: ["..hhhhhc.", ".hhhhhhc.", "hhskkksh.", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "c.....cc.", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ENTJ: ["..hhhhh..", ".hhhhhhh.", "hhskkkshc", "hskekeksc", "hskkkkksc", ".skkkkkkc", "..cccccc.", ".cccaacc.", "cc.....c.", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ENTP: ["c.hhhhh.c", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "c.......c", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  INFJ: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", ".c.....c.", ".c.ccc.c.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  INFP: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", ".c.ccc.c.", ".c.caac.c", "..c...c..", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ENFJ: ["c.hhhhh.c", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "c.......c", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ENFP: ["c.hhhhh.c", "c.hhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "..c...c..", ".ccccccc.", "..cc.cc..", ".c.....c.", "b.......b"],
  ISTJ: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccacccc", "..c...c..", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ISFJ: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "...c.c...", "..ccccc..", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ESTJ: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", ".c.ccc.c.", ".cccaaccc", "c.......c", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ESFJ: ["..hhhhhc.", ".hhhhhhc.", "hhskkkshc", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaacc.", "cc.....c.", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ISTP: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "cskkkkksc", ".skkkkkks.", ".c.ccc.c.", ".cccaaccc", "..c...c..", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ISFP: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksc", ".skkkkkkc", "..cccccc.", ".cccaacc.", "cc......c", ".ccccccc.", "..cc.cc..", "..cc.cc..", ".bb...bb."],
  ESTP: ["..hhhhh..", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "cc.....cc", ".ccccccc.", ".c.....c.", "c.......c", "b.......b"],
  ESFP: ["c.hhhhh.c", ".hhhhhhh.", "hhskkkshh", "hskekeksh", "hskkkkksh", ".skkkkkks.", "..ccccc..", ".cccaaccc", "c.......c", ".ccccccc.", ".c.....c.", "c.......c", "b.......b"],
};

function glyphs(rows: string[], prefix: string, color: Record<string, string>) {
  return rows.flatMap((row, y) =>
    [...row.padEnd(11, ".").slice(0, 11)].map((cell, x) =>
      cell === "." ? null : (
        <rect
          key={`${prefix}-${x}-${y}`}
          className={cell === "e" ? "folk-eye" : undefined}
          x={x}
          y={y}
          width="1"
          height="1"
          fill={color[cell] ?? INK}
        />
      ),
    ),
  );
}

export function PixelFolk({ type }: { type: string }) {
  const key = type.toUpperCase();
  const look = LOOK[key] ?? LOOK.INFJ;
  const pose = POSES[Math.max(0, TYPES.indexOf(key as (typeof TYPES)[number])) % POSES.length];
  const color: Record<string, string> = {
    h: look.hair,
    s: SKIN,
    k: "#f4e6da",
    e: EYE,
    c: look.cloth,
    a: look.accent,
    b: INK,
  };

  return (
    <svg className="pixel-folk" data-type={key} viewBox="0 0 11 13" role="img" aria-label={`${key} 的像素小人`}>
      <g className="folk-rest">{glyphs(pose, "rest", color)}</g>
      <g className="folk-act">{glyphs(ACT[key] ?? pose, "act", color)}</g>
    </svg>
  );
}
