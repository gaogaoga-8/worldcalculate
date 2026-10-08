import { useEffect, useState, type FormEvent } from "react";
import type { Chart } from "../bazi/chart";
import {
  MBTI_TYPES,
  POLE_LABEL,
  QUESTIONS,
  FUNCTION_BLURB,
  TYPE_BLURB,
  TYPE_STACK,
  normalizeMbti,
  scoreQuiz,
  type QuizAnswers,
} from "../mbti";
import { updateState, useAppState } from "../store";
import { PixelFolk } from "./PixelFolk";

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
  const personaSource = useAppState().personaSource;
  const typed = personaSource === "typed" ? normalizeMbti(chart.person.mbti ?? "") : null;
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [typeFault, setTypeFault] = useState("");

  function remember(type: string) {
    updateState((prev) => ({
      ...prev,
      quiz: null,
      personaSource: "typed",
      self: prev.self ? { ...prev.self, mbti: type } : prev.self,
    }));
    setWriting(false);
    setDraft("");
    setTypeFault("");
  }

  function redo() {
    updateState((prev) => ({
      ...prev,
      quiz: null,
      personaSource: null,
      self: prev.self ? { ...prev.self, mbti: null } : prev.self,
    }));
    setWriting(false);
    setDraft("");
    setTypeFault("");
  }

  function submitType(event: FormEvent) {
    event.preventDefault();
    const type = normalizeMbti(draft);
    if (!type) {
      setTypeFault("写成四字母，例如 INFJ。");
      return;
    }
    remember(type);
  }

  useEffect(() => {
    if (score)
      updateState((prev) =>
        prev.self && (prev.self.mbti !== score.type || prev.personaSource !== "quiz")
          ? { ...prev, personaSource: "quiz", self: { ...prev.self, mbti: score.type } }
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
          <button className="ghost" onClick={redo}>
            重做
          </button>
          <button className="ghost" type="button" onClick={() => setWriting(true)}>
            自己填写
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
        {writing && <TypeEntry draft={draft} fault={typeFault} onDraft={setDraft} onSubmit={submitType} />}
      </div>
    </section>
  );
  }

  if (typed && !writing) {
    return (
      <section className="panel">
        <header className="panel-head persona-head">
          <h1>人格</h1>
          <div className="persona-actions">
            <button className="ghost" onClick={redo}>重新做题</button>
            <button className="ghost" type="button" onClick={() => { setWriting(true); setDraft(typed); }}>改类型</button>
          </div>
        </header>
        <div className="panel-body">
          <div className="persona-typed">
            <PixelFolk type={typed} />
            <div className="persona-copy">
              <p className="type-name">{typed}</p>
              <ul className="folk-stack">
                {(TYPE_STACK[typed] ?? []).map((fn) => (
                  <li key={fn}>
                    <b>{fn}</b>
                    {FUNCTION_BLURB[fn]}
                  </li>
                ))}
              </ul>
              <p>{TYPE_BLURB[typed]}</p>
              <p className="note">这是你自己写下的类型，不是这二十题算出来的。</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (writing && !score) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h1>人格</h1>
          <button className="ghost" type="button" onClick={() => setWriting(false)}>返回题目</button>
        </header>
        <div className="panel-body">
          <TypeEntry draft={draft} fault={typeFault} onDraft={setDraft} onSubmit={submitType} />
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
            <button className="ghost" type="button" onClick={() => setWriting(true)}>
              我知道自己的类型
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function TypeEntry({
  draft,
  fault,
  onDraft,
  onSubmit,
}: {
  draft: string;
  fault: string;
  onDraft: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="type-entry" onSubmit={onSubmit}>
      <p className="sub">十六型里选一个写上。</p>
      <input
        value={draft}
        onChange={(event) => onDraft(event.target.value.toUpperCase())}
        placeholder="INFJ"
        maxLength={4}
        aria-label="人格类型"
        list="mbti-types"
      />
      <datalist id="mbti-types">
        {MBTI_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      <button className="primary" type="submit">记下</button>
      {fault ? <p className="sky-note">{fault}</p> : null}
    </form>
  );
}
