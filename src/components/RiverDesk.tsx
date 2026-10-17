import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { buildChart, type Chart } from "../bazi/chart";
import { ensurePalaces, coreStar, formed } from "../galaxy";
import { askOracle } from "../oracle/client";
import { oracleMessages, plainReading, readingChart, type OracleKind } from "../oracle/prompt";
import { scoreQuiz } from "../mbti";
import { updateState, useAppState } from "../store";
import { PersonaView } from "./PersonaView";
import { WaitStar } from "./WaitStar";

export function RiverDesk({
  chart,
  start,
  onClose,
  embedded = false,
}: {
  chart: Chart;
  start: "persona" | "ask";
  onClose: () => void;
  embedded?: boolean;
}) {
  const state = useAppState();
  const [modal, setModal] = useState<"persona" | "ask">(start);

  useEffect(() => { setModal(start); }, [start]);
  const [ask, setAsk] = useState<OracleKind>("thing");
  const [question, setQuestion] = useState("");
  const [oracle, setOracle] = useState("");
  const [busy, setBusy] = useState(false);
  const mbti = scoreQuiz(state.quiz)?.type ?? chart.person.mbti ?? null;
  const voiced = { ...chart, person: { ...chart.person, mbti } };
  const conjunctionAsk = !!state.conjunctionAt && !state.conjunctionAsked;

  useEffect(() => {
    updateState((prev) => {
      const stars = ensurePalaces(prev.stars.some((star) => star.kind === "core") ? prev.stars : [coreStar("本命"), ...prev.stars]);
      return stars === prev.stars ? prev : { ...prev, stars };
    });
  }, []);

  async function submitAsk(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const granted = ask === "thing" && conjunctionAsk;
    const completed = state.stars.filter(formed);
    if (!granted && ((ask === "thing" && completed.length < 1) || (ask === "feeling" && completed.length < 3))) {
      setOracle(ask === "thing" ? "先给一颗星写下你的一句话，再问这件事。" : "完成三颗星的记录后，可以问感情。");
      return;
    }
    const others = state.people.map((person) => buildChart(person, { ziHour: state.settings.ziHour }));
    const subject = readingChart(text, voiced, others);
    setBusy(true);
    setOracle("");
    try {
      setOracle(plainReading(await askOracle(oracleMessages({
        kind: ask,
        question: text,
        chart: subject,
        mbti,
        stars: state.stars,
        whose: subject.person.id === voiced.person.id ? "self" : "named",
      }))));
      if (granted) updateState((prev) => ({ ...prev, conjunctionAsked: true }));
    } catch (error) {
      setOracle(error instanceof Error ? error.message : "模型没有答上来。");
    } finally {
      setBusy(false);
    }
  }

  const body = modal === "persona" ? (
    <PersonaView quiz={state.quiz} chart={voiced} />
  ) : (
    <div className="cosmos-ask">
      <div className="ask-types">
        {(conjunctionAsk ? (["thing"] as const) : (["thing", "feeling", "bond"] as const)).map((kind, index) => (
          <button key={kind} type="button" className={ask === kind ? "on" : ""} onClick={() => { setAsk(kind); setOracle(""); }}>
            {conjunctionAsk ? "一件事" : ["一件事", "感情", "关系"][index]}
          </button>
        ))}
      </div>
      {conjunctionAsk && <p className="sub">七星连珠。问一件事。</p>}
      {busy ? <WaitStar pace="ask" /> : (
        <form onSubmit={submitAsk}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={ask === "bond" ? "好友的名字，以及想问的事…" : "你想问什么…"} required />
          <button aria-label="提问" className="ask-send">↑</button>
        </form>
      )}
      {oracle && !busy && <p className="bubble guide">{oracle}</p>}
    </div>
  );

  if (embedded) return body;

  const surface = (
    <div className="star-overlay">
      <button className="star-backdrop" aria-label="回到星河" onClick={onClose} />
      <section className="star-surface" role="dialog" aria-modal="true" aria-label={modal === "ask" ? "问事" : "人格"}>
        <header className="star-surface-head">
          <div><i /><h1>{modal === "ask" ? "问事" : "人格"}</h1></div>
          <button className="surface-close" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className="star-surface-body">{body}</div>
      </section>
    </div>
  );

  return createPortal(surface, document.body);
}
