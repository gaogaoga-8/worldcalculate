import { useEffect } from "react";
import type { Chart } from "../bazi/chart";
import {
  POLE_LABEL,
  QUESTIONS,
  TYPE_BLURB,
  scoreQuiz,
  type QuizAnswers,
} from "../mbti";
import { updateState } from "../store";

export function PersonaView({
  quiz,
  chart,
}: {
  quiz: QuizAnswers | null;
  chart: Chart;
}) {
  const score = scoreQuiz(quiz);
  const answered = QUESTIONS.filter((q) => quiz?.[q.id]).length;
  const current = QUESTIONS.find((q) => !quiz?.[q.id]);

  useEffect(() => {
    if (score)
      updateState((prev) =>
        prev.self && prev.self.mbti !== score.type
          ? { ...prev, self: { ...prev.self, mbti: score.type } }
          : prev,
      );
  }, [score?.type]);

  useEffect(() => {
    if (!current) return;
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "1") choose("a");
      if (event.key === "2") choose("b");
    }
    function choose(side: "a" | "b") {
      if (!current) return;
      updateState((prev) => ({
        ...prev,
        quiz: { ...(prev.quiz ?? {}), [current.id]: side },
      }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (score) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h1>人格</h1>
          <button
            className="ghost"
            onClick={() =>
              updateState((prev) => ({
                ...prev,
                quiz: null,
                self: prev.self ? { ...prev.self, mbti: null } : null,
              }))
            }
          >
            重做
          </button>
        </header>
        <div className="panel-body">
          <div className="split">
            <div>
              <p className="type-name">{score.type}</p>
              <p>{TYPE_BLURB[score.type]}</p>
              <div className="letters">
                {score.letters.map((letter) => {
                  const total = letter.leftN + letter.rightN || 1;
                  return (
                    <div key={letter.dim}>
                      <div className="bar-line">
                        <span>{letter.left}</span>
                        <div className="track">
                          <i
                            className="fill-火"
                            style={{
                              width: `${(letter.leftN / total) * 100}%`,
                            }}
                          />
                        </div>
                        <span>{letter.right}</span>
                      </div>
                      <p className="note">
                        {POLE_LABEL[letter.left]} {letter.leftN} ·{" "}
                        {POLE_LABEL[letter.right]} {letter.rightN} · 取{" "}
                        {letter.chosen}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <aside>
              <p className="sub">和命盘并列，不互相换算。</p>
              <p>
                日主是 {chart.dayMasterLabel}
                。人格类型来自这二十个选择，八字来自生辰。两边可以对照着看，没有合成一个分数。
              </p>
              <p className="note">
                这不是临床诊断。想把某件事放回十神里，去「对话」。
              </p>
            </aside>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h1>人格</h1>
        <span>
          {String(answered + 1).padStart(2, "0")} / {QUESTIONS.length}
        </span>
      </header>
      <div className="quiz-progress">
        <i style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
      </div>
      <div className="panel-body">
        {current && (
          <>
            <h2 className="prompt">{current.prompt}</h2>
            <button
              className="choice"
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  quiz: { ...(prev.quiz ?? {}), [current.id]: "a" },
                }))
              }
            >
              <kbd>1</kbd>
              {current.a.text}
            </button>
            <button
              className="choice"
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  quiz: { ...(prev.quiz ?? {}), [current.id]: "b" },
                }))
              }
            >
              <kbd>2</kbd>
              {current.b.text}
            </button>
            {answered > 0 && (
              <button
                className="ghost"
                onClick={() => {
                  const last = [...QUESTIONS]
                    .reverse()
                    .find((q) => quiz?.[q.id]);
                  if (!last) return;
                  updateState((prev) => {
                    const next = { ...(prev.quiz ?? {}) };
                    delete next[last.id];
                    return { ...prev, quiz: next };
                  });
                }}
              >
                上一题
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
