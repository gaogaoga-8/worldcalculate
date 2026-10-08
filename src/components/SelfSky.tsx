import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { Chart } from "../bazi/chart";
import {
  formed,
  MIRROR_AT,
  dailyRoundTurns,
  starPosition,
  starProgress,
  type LitStar,
} from "../galaxy";
import { askBond, askFeeling, askThing } from "../insight";
import { askOracle } from "../oracle/client";
import { oracleMessages } from "../oracle/prompt";
import { scoreQuiz } from "../mbti";
import { updateState, useAppState } from "../store";
import { finishDailyRound } from "../progression";
import { ChartView } from "./ChartView";
import { ChatView } from "./ChatView";
import { PersonaView } from "./PersonaView";
import { Nebula } from "./Nebula";
import { Galaxy } from "./Galaxy";

export function SelfSky({
  chart,
  onHome,
  forming = false,
  formationId = 0,
  onSettled,
}: {
  chart: Chart;
  onHome: () => void;
  forming?: boolean;
  formationId?: number;
  onSettled?: () => void;
}) {
  const state = useAppState();
  const rounds = [...state.stars.filter((star) => star.kind === "round")].sort(
    (a, b) => a.litAt - b.litAt,
  );
  const core = state.stars.find((star) => star.kind === "core");
  const [activeId, setActiveId] = useState(core?.id ?? "");
  const active = state.stars.find((star) => star.id === activeId) ?? core;
  const [modal, setModal] = useState<
    "chat" | "chart" | "persona" | "ask" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now);
  const [ask, setAsk] = useState<"thing" | "feeling" | "bond">("thing");
  const [question, setQuestion] = useState("");
  const [oracle, setOracle] = useState("");
  const [busy, setBusy] = useState(false);
  const surfaceRef = useRef<HTMLElement>(null);
  const coreRef = useRef<HTMLButtonElement>(null);
  const [skipToken, setSkipToken] = useState(0);
  useEffect(() => {
    if (forming) {
      setModal(null);
      setNotice("");
    }
  }, [forming]);
  const surfaceOpen = modal !== null;
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timer);
  }, [notice]);
  const progress = starProgress(
    state.stars,
    dailyRoundTurns(state.messages, state.roundTurns, now),
    now,
  );
  const mbti = scoreQuiz(state.quiz)?.type ?? chart.person.mbti ?? null;
  const voiced = { ...chart, person: { ...chart.person, mbti } };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!surfaceOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const card = surfaceRef.current;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    card?.querySelector<HTMLElement>("button")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab" && card) {
        const items = Array.from(
          card.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
          ),
        ).filter(
          (item) => item.getClientRects().length > 0 && item.tabIndex >= 0,
        );
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (root) root.inert = wasInert;
      previous?.focus();
    };
  }, [surfaceOpen]);
  function select(star: LitStar) {
    setActiveId(star.id);
    setNotice("");
    setModal("chat");
  }

  async function submitAsk(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const completed = state.stars.filter(formed);
    if (
      (ask === "thing" && completed.length < 1) ||
      (ask === "feeling" && completed.length < 3)
    ) {
      setOracle(
        ask === "thing"
          ? "先给一颗星写下你的一句话，再问这件事。"
          : "完成三颗星的记录后，可以问感情。",
      );
      return;
    }
    const named = state.links.find((link) => text.includes(link.name)) ?? null;
    const local =
      ask === "thing"
        ? askThing(text, state.stars)
        : ask === "feeling"
          ? askFeeling(text, state.stars, voiced, state.links)
          : askBond(text, state.stars, voiced, state.links);
    if (ask === "bond" && !named) {
      setOracle(local.text);
      return;
    }
    setBusy(true);
    setOracle("");
    try {
      setOracle(
        await askOracle(
          oracleMessages({
            kind: ask,
            question: text,
            chart: voiced,
            mbti,
            stars: state.stars,
            other: named,
          }),
        ),
      );
    } catch (error) {
      setOracle(error instanceof Error ? error.message : "模型没有答上来。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="star-world" aria-label="我的星系">
      <div className={`star-scene${forming ? " is-forming" : ""}`}>
        <Nebula
          formationId={formationId}
          forming={forming}
          skipToken={skipToken}
          coreRef={coreRef}
          onSettled={onSettled}
        />
        <button
          ref={coreRef}
          type="button"
          disabled={forming}
          aria-label="与本命星对话"
          className={`orb core cosmos-core ${surfaceOpen && active?.kind === "core" ? "on" : ""}`}
          style={{ left: "50%", top: "48%" }}
          onClick={() => core && select(core)}
        >
          <i />
          <b>本命</b>
        </button>
        {Array.from({ length: MIRROR_AT }, (_, index) => {
          const point = starPosition(index);
          const star = rounds[index];
          return star ? (
            <button
              type="button"
              disabled={forming}
              key={star.id}
              aria-label={`与星星「${star.title}」对话`}
              className={`orb round ${formed(star) ? "formed" : ""} ${surfaceOpen && active?.id === star.id ? "on" : ""} ${now - star.litAt < 6000 ? "fresh" : ""}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => select(star)}
            >
              <i />
              <b>{star.title}</b>
            </button>
          ) : (
            <button
              type="button"
              disabled={forming}
              key={`waiting-${index}`}
              className={`orb dormant${index === rounds.length && progress.allowed ? " ready" : ""}`}
              aria-label={
                index === rounds.length && progress.allowed
                  ? `点亮第${index + 1}颗星`
                  : `第${index + 1}颗星，尚未点亮`
              }
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => {
                if (index === rounds.length && progress.allowed) {
                  updateState((prev) => finishDailyRound(prev));
                  setNotice("新的星，已经点亮。");
                  return;
                }
                setNotice(
                  index === rounds.length
                    ? progress.litToday
                      ? "今天已点亮。明天继续。"
                      : "和本命聊两次，点亮下一颗星。"
                    : "这颗星，还在等候。 ",
                );
              }}
            >
              <i />
              <b>待点亮</b>
            </button>
          );
        })}
        <button
          type="button"
          disabled={forming}
          className="world-object"
          aria-label="世界与连接"
          onClick={onHome}
        >
          <i />
          <span>世界</span>
        </button>
        <p className="star-invitation">点击星星</p>
        {forming && (
          <Galaxy onSkip={() => setSkipToken((token) => token + 1)} />
        )}
        {notice && (
          <div
            className="star-whisper"
            role="status"
            onAnimationEnd={() => setNotice("")}
          >
            {notice}
          </div>
        )}
      </div>
      {modal &&
        createPortal(
          <div className="star-overlay">
            <button
              className="star-backdrop"
              aria-label="回到星空"
              onClick={() => setModal(null)}
            />
            <section
              ref={surfaceRef}
              className="star-surface"
              role="dialog"
              aria-modal="true"
              aria-label={`${active?.title ?? "本命"}星`}
            >
              <header className="star-surface-head">
                <div>
                  <i />
                  <h1>{active?.title ?? "本命"}</h1>
                </div>
                <button
                  className="surface-close"
                  aria-label="关闭星星"
                  onClick={() => setModal(null)}
                >
                  ×
                </button>
              </header>
              <div
                className="star-tabs"
                role="tablist"
                aria-label="星星内容"
                onKeyDown={(event) => {
                  const tabs = ["chat", "chart", "persona", "ask"] as const;
                  const index = tabs.indexOf(modal);
                  let next = index;
                  if (event.key === "ArrowRight")
                    next = (index + 1) % tabs.length;
                  else if (event.key === "ArrowLeft")
                    next = (index + tabs.length - 1) % tabs.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  setModal(tabs[next]);
                  document.getElementById(`star-tab-${tabs[next]}`)?.focus();
                }}
              >
                {(["chat", "chart", "persona", "ask"] as const).map(
                  (tab, index) => (
                    <button
                      type="button"
                      key={tab}
                      role="tab"
                      id={`star-tab-${tab}`}
                      aria-selected={modal === tab}
                      tabIndex={modal === tab ? 0 : -1}
                      aria-controls={`star-content-${tab}`}
                      onClick={() => setModal(tab)}
                    >
                      {["对话", "命盘", "人格", "问事"][index]}
                    </button>
                  ),
                )}
              </div>
              <div className="star-surface-body">
                <div
                  id="star-content-chat"
                  role="tabpanel"
                  aria-labelledby="star-tab-chat"
                  className="star-chat-panel"
                  hidden={modal !== "chat"}
                >
                  {rounds.length > MIRROR_AT && (
                    <label className="field">
                      以前的星
                      <select
                        value={active?.id}
                        onChange={(e) => {
                          const star = state.stars.find(
                            (s) => s.id === e.target.value,
                          );
                          if (star) select(star);
                        }}
                      >
                        {state.stars.map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {active?.kind === "round" && (
                    <details className="star-memory" key={active.id}>
                      <summary>星星里的话</summary>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const note = String(
                            new FormData(event.currentTarget).get("note") ?? "",
                          ).trim();
                          updateState((prev) => ({
                            ...prev,
                            stars: prev.stars.map((s) =>
                              s.id === active.id ? { ...s, note } : s,
                            ),
                          }));
                          setNotice("已经记下。");
                        }}
                      >
                        <p>{active.echo}</p>
                        <label className="field">
                          <span className="sr-only">留在这颗星里的一句话</span>
                          <input
                            name="note"
                            defaultValue={active.note}
                            maxLength={42}
                            placeholder="留下一句话…"
                          />
                        </label>
                        <button type="submit" className="ghost">
                          记下
                        </button>
                      </form>
                    </details>
                  )}
                  <ChatView
                    chart={voiced}
                    embedded
                    minimal
                    starName={active?.title ?? "本命"}
                  />
                </div>
                {modal === "chart" && (
                  <div
                    id="star-content-chart"
                    role="tabpanel"
                    aria-labelledby="star-tab-chart"
                  >
                    <ChartView
                      chart={voiced}
                      ziHour={state.settings.ziHour}
                      embedded
                    />
                  </div>
                )}
                {modal === "persona" && (
                  <div
                    id="star-content-persona"
                    role="tabpanel"
                    aria-labelledby="star-tab-persona"
                  >
                    <PersonaView quiz={state.quiz} chart={voiced} />
                  </div>
                )}
                {modal === "ask" && (
                  <div
                    id="star-content-ask"
                    role="tabpanel"
                    aria-labelledby="star-tab-ask"
                    className="cosmos-ask"
                  >
                    <div className="ask-types">
                      {(["thing", "feeling", "bond"] as const).map(
                        (kind, i) => (
                          <button
                            key={kind}
                            type="button"
                            className={ask === kind ? "on" : ""}
                            onClick={() => {
                              setAsk(kind);
                              setOracle("");
                            }}
                          >
                            {["一件事", "感情", "关系"][i]}
                          </button>
                        ),
                      )}
                    </div>
                    <form onSubmit={submitAsk}>
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={
                          ask === "bond"
                            ? "好友的名字，以及想问的事…"
                            : "你想问什么…"
                        }
                        disabled={busy}
                        required
                      />
                      <button
                        aria-label="提问"
                        className="ask-send"
                        disabled={busy}
                      >
                        {busy ? "…" : "↑"}
                      </button>
                    </form>
                    {oracle && (
                      <p className="bubble guide" role="status">
                        {oracle}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
