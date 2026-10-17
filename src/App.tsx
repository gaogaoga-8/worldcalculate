import { useEffect, useMemo, useRef, useState } from "react";
import { openStar, returnStar, saveAccount, startAccountSync } from "./account";
import { buildChart } from "./bazi/chart";
import { ConnectMap } from "./components/ConnectMap";
import { ChartView } from "./components/ChartView";
import { ChatView } from "./components/ChatView";
import { rememberGalaxy, StarRiverHome } from "./components/StarRiverHome";
import { RiverDesk } from "./components/RiverDesk";
import { Shell } from "./components/Shell";
import { beginOpening } from "./bgm";
import { PALACES, coreStar, palaceStars } from "./galaxy";
import { getState, updateState, useAppState } from "./store";
import { newId } from "./id";
import { askOracle } from "./oracle/client";
import { palaceMessages, plainReading } from "./oracle/prompt";
import type { PalaceId } from "./galaxy";
import type { Person } from "./types";
import "./styles.css";

type Phase = "boot" | "river";
type Overlay = "chat" | "chart" | "palace" | "connect" | "persona" | "ask" | "round" | null;

export function App() {
  const state = useAppState();
  const [phase, setPhase] = useState<Phase>("boot");
  const [authed, setAuthed] = useState(false);
  const [riverReset, setRiverReset] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [riverKey, setRiverKey] = useState(0);
  const [echoDraft, setEchoDraft] = useState("");
  const [palace, setPalace] = useState<PalaceId | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [reading, setReading] = useState("");
  const [readingBusy, setReadingBusy] = useState(false);
  const settled = useRef(false);
  const chart = useMemo(() => {
    if (!state.self) return null;
    return buildChart(state.self, { ziHour: state.settings.ziHour, now: new Date() });
  }, [state.self, state.settings.ziHour]);

  function adopt(person: Person) {
    const kind = state.self ? "edit" : "open";
    if (!state.self) void beginOpening();
    updateState((prev) => ({
      ...prev,
      self: { ...person, id: "self", mbti: prev.self?.mbti ?? person.mbti },
      galaxyId: prev.galaxyId || newId(),
      stars: prev.self ? prev.stars : [coreStar("本命"), ...palaceStars()],
      roundTurns: prev.self ? prev.roundTurns : 0,
      messages: prev.self ? prev.messages : [],
      mirror: prev.self ? prev.mirror : null,
      plans: prev.plans,
    }));
    void saveAccount(person, kind).catch(() => {});
    setPhase("river");
  }

  function replay() {
    setOverlay(null);
    try { localStorage.removeItem("star-river:galaxy"); } catch { /* 清不掉就让星河自己再问一次。 */ }
    setRiverReset(true);
    setRiverKey((key) => key + 1);
    setPhase("river");
  }

  async function claim(name: string, secret: string) {
    if (authed) return { ok: true };
    if (secret.length < 4) return { ok: false, message: "暗语再长一点。" };
    try {
      await returnStar(name, secret);
      const saved = getState().self;
      if (saved) rememberGalaxy(saved);
      setAuthed(true);
      setRiverReset(false);
      setRiverKey((key) => key + 1);
      return { ok: true, restore: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("对不上")) return { ok: false, message: message || "暂时没连上，再试一次。" };
    }
    try {
      await openStar(name, secret);
      setAuthed(true);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("已经留下")) return { ok: false, message: "这个名字已经留下过了，暗语对不上。" };
      return { ok: false, message: message || "暂时没连上，再试一次。" };
    }
  }

  useEffect(() => {
    let live = true;
    void startAccountSync()
      .then((entry) => {
        if (!live) return;
        if (settled.current) return;
        settled.current = true;
        setAuthed(entry === "ready" || entry === "intake");
        setPhase("river");
      })
      .catch(() => {
        if (!live) return;
        setPhase("river");
      });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!chart || !palace || overlay !== "palace") return;
    const saved = state.stars.find((star) => star.palace === palace)?.reading;
    if (saved) {
      setReading(plainReading(saved));
      setReadingBusy(false);
      return;
    }
    let cancel = false;
    setReading("");
    setReadingBusy(true);
    void askOracle(palaceMessages(chart, palace))
      .then((text) => {
        if (cancel) return;
        const clean = plainReading(text);
        setReading(clean);
        updateState((prev) => ({
          ...prev,
          stars: prev.stars.map((star) => (star.palace === palace ? { ...star, reading: clean } : star)),
        }));
      })
      .catch((error: unknown) => { if (!cancel) setReading(error instanceof Error ? error.message : "模型没有答上来。"); })
      .finally(() => { if (!cancel) setReadingBusy(false); });
    return () => { cancel = true; };
  }, [chart, palace, overlay, state.stars]);

  const openConnect = chart ? () => { setEchoDraft(""); setOverlay("connect"); } : undefined;

  return (
    <Shell
      mode={phase === "river" ? "desk" : "intake"}
      onReplay={replay}
      onEdit={replay}
      onCards={openConnect}
    >
      {phase !== "river" ? (
        <div className="boot-sky" />
      ) : (
        <div className="river-home">
          <StarRiverHome
            person={state.self}
            resetKey={riverKey}
            reset={riverReset}
            authed={authed}
            onClaim={claim}
            rounds={state.stars.filter((star) => star.kind === "round").map((star) => ({ id: star.id, title: star.title }))}
            onReady={adopt}
            onPick={(id) => {
              if (id === "core") setOverlay("chat");
              else if (id.startsWith("round:")) {
                setRoundId(id.slice(6));
                setOverlay("round");
              } else {
                setPalace(id as PalaceId);
                setOverlay("palace");
              }
            }}
          />
          {chart && (
            <button type="button" className="river-echo" onClick={openConnect}>回声</button>
          )}
        </div>
      )}
      {overlay && chart && (
        <div className="star-overlay">
          <button className="star-backdrop" aria-label="回到星河" onClick={() => setOverlay(null)} />
          <section className="star-surface" role="dialog" aria-modal="true" aria-label={overlay === "palace" ? (PALACES.find((item) => item.id === palace)?.title ?? "这颗星") : overlay === "round" ? (state.stars.find((star) => star.id === roundId)?.title ?? "这颗星") : "本命"}>
            <header className="star-surface-head">
              <div>
                <i />
                <h1>{overlay === "palace" ? (PALACES.find((item) => item.id === palace)?.title.replace(/星$/u, "") ?? "这颗星") : overlay === "round" ? (state.stars.find((star) => star.id === roundId)?.title ?? "这颗星") : "本命"}</h1>
              </div>
              <button className="surface-close" type="button" aria-label="关闭" onClick={() => setOverlay(null)}>×</button>
            </header>
            {overlay !== "palace" && overlay !== "connect" && overlay !== "round" && (
              <div className="star-tabs" role="tablist" aria-label="本命">
                {(["chat", "chart", "persona", "ask"] as const).map((tab) => (
                  <button key={tab} type="button" role="tab" aria-selected={overlay === tab} onClick={() => setOverlay(tab)}>
                    {tab === "chat" ? "对话" : tab === "chart" ? "命盘" : tab === "persona" ? "人格" : "问事"}
                  </button>
                ))}
              </div>
            )}
            <div className="star-surface-body">
              {overlay === "chat" && (
                <ChatView chart={chart} embedded presence starName="本命" onUserSend={(text) => {
                  window.dispatchEvent(new CustomEvent("worldcal-chat", { detail: text }));
                }} />
              )}
              {overlay === "chart" && (
                <ChartView chart={chart} ziHour={state.settings.ziHour} embedded />
              )}
              {overlay === "persona" && (
                <RiverDesk chart={chart} start="persona" embedded onClose={() => setOverlay(null)} />
              )}
              {overlay === "ask" && (
                <RiverDesk chart={chart} start="ask" embedded onClose={() => setOverlay(null)} />
              )}
              {overlay === "connect" && (
                <ConnectMap chart={chart} draft={echoDraft} onDraftUsed={() => setEchoDraft("")} onOpenSelf={() => setOverlay(null)} />
              )}
              {overlay === "round" && (() => {
                const star = state.stars.find((item) => item.id === roundId && item.kind === "round");
                if (!star) return null;
                return (
                  <form
                    className="star-memory"
                    key={star.id}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
                      updateState((prev) => ({
                        ...prev,
                        stars: prev.stars.map((item) => (item.id === star.id ? { ...item, note } : item)),
                      }));
                    }}
                  >
                    {star.echo && <p>{star.echo}</p>}
                    <label className="field">
                      <span className="sr-only">留在这颗星里的一句话</span>
                      <input name="note" defaultValue={star.note} maxLength={160} placeholder="留下一句话…" />
                    </label>
                    <button type="submit" className="ghost">记下</button>
                  </form>
                );
              })()}
              {overlay === "palace" && (
                <div className="palace-reading">
                  {readingBusy && <p>正在看这颗星…</p>}
                  {reading && <p className="bubble guide">{reading}</p>}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}
