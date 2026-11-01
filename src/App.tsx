import { useEffect, useMemo, useRef, useState } from "react";
import { beginDevelopBackup, openStar, restoreDevelopBackup, returnStar, saveAccount, startAccountSync } from "./account";
import { buildChart } from "./bazi/chart";
import { ConnectMap } from "./components/ConnectMap";
import { ChartView } from "./components/ChartView";
import { ChatView } from "./components/ChatView";
import { rememberGalaxy, StarRiverHome } from "./components/StarRiverHome";
import { RiverDesk } from "./components/RiverDesk";
import { FateRite } from "./components/FateRite";
import { Shell } from "./components/Shell";
import { beginOpening } from "./bgm";
import { PALACES, coreStar, palaceStars } from "./galaxy";
import { getState, hydrate, quietly, replaceState, updateState, useAppState } from "./store";
import { newId } from "./id";
import { askOracle } from "./oracle/client";
import { palaceMessages, plainReading } from "./oracle/prompt";
import type { PalaceId } from "./galaxy";
import type { Person } from "./types";
import "./styles.css";

type Phase = "boot" | "river";
type Overlay = "chat" | "palace" | "connect" | "persona" | "round" | null;

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
  const [slowChat, setSlowChat] = useState(false);
  const [guide, setGuide] = useState(readGuide);
  const [showChatGuide, setShowChatGuide] = useState(readChatGuide);
  const [showPromptGuide, setShowPromptGuide] = useState(readPromptGuide);
  const rehearseRef = useRef(false);
  const guideRef = useRef(guide);
  const adoptedRehearsal = useRef(false);
  guideRef.current = guide;
  const [rehearse, setRehearse] = useState(false);
  const [reading, setReading] = useState("");
  const [readingBusy, setReadingBusy] = useState(false);
  const [fateOpen, setFateOpen] = useState(false);
  const settled = useRef(false);
  const litStars = state.stars.filter((star) => star.kind === "round").length;
  const fateTier = Math.floor(litStars / 2);
  const fatePrompted = useRef<number | null>(null);
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

  function saveGuide(step: "six" | "core" | "echo" | "menu" | "done") {
    setGuide(step);
    try { localStorage.setItem(GUIDE_KEY, step); } catch { /* 记不住就下次再轻轻说一次。 */ }
  }

  function closeOverlay() {
    if (overlay === "chat" && showChatGuide) {
      setShowChatGuide(false);
      try { localStorage.setItem(CHAT_GUIDE, "1"); } catch { /* 看过一次就够。 */ }
    }
    setOverlay(null);
    setSlowChat(false);
    try { sessionStorage.removeItem("shijie-suanfa/relight-invite"); } catch { /* 关掉这次提示。 */ }
  }

  function develop() {
    if (rehearseRef.current) {
      endRehearsal();
      return;
    }
    beginDevelopBackup();
    adoptedRehearsal.current = false;
    quietly(() => replaceState(hydrate({
      settings: getState().settings,
      self: null,
      galaxyId: "",
      stars: [],
      messages: [],
      branchMessages: [],
      memories: [],
      asks: [],
      people: [],
      links: [],
      plans: [],
      roundTurns: 0,
      fateUses: 0,
      fateAsked: false,
      mirror: null,
      quiz: null,
      personaSource: null,
      conjunctionAt: null,
      conjunctionAsked: false,
      reachedAt: null,
    })));
    setShowChatGuide(true);
    setShowPromptGuide(true);
    setFateOpen(false);
    try { localStorage.removeItem(CHAT_GUIDE); } catch { /* 开发模式再看一次对话提示。 */ }
    try { localStorage.removeItem(PROMPT_GUIDE); } catch { /* 开发模式再看一次结构化提示。 */ }
    rehearseRef.current = true;
    setRehearse(true);
    replay();
  }

  function endRehearsal() {
    rehearseRef.current = false;
    setRehearse(false);
    setRiverReset(false);
    setOverlay(null);
    setSlowChat(false);
    setFateOpen(false);
    restoreDevelopBackup();
    const self = getState().self;
    if (self) rememberGalaxy(self);
    setRiverKey((key) => key + 1);
  }

  function finishGuide() {
    saveGuide("done");
  }

  function adoptRehearsal(person: Person) {
    if (adoptedRehearsal.current) return;
    adoptedRehearsal.current = true;
    quietly(() => updateState((prev) => ({
      ...prev,
      self: { ...person, id: "self", mbti: null },
      galaxyId: prev.galaxyId || newId(),
      stars: [coreStar("本命"), ...palaceStars()],
      roundTurns: 0,
      messages: [],
      branchMessages: [],
      memories: [],
      mirror: null,
      fateAsked: false,
      fateUses: 0,
    })));
    setPhase("river");
  }

  function replay() {
    setOverlay(null);
    setSlowChat(false);
    saveGuide("six");
    if (rehearseRef.current) adoptedRehearsal.current = false;
    try { localStorage.removeItem("star-river:galaxy"); } catch { /* 清不掉就让星河自己再问一次。 */ }
    try { sessionStorage.setItem("shijie-suanfa/relight-invite", "1"); } catch { /* 这次录入结束后仍要提示对话。 */ }
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

  useEffect(() => {
    if (phase !== "river" || !chart || fateTier < 1 || fateTier <= state.fateUses) return;
    if (fatePrompted.current === litStars) return;
    fatePrompted.current = litStars;
    setOverlay(null);
    setSlowChat(false);
    setFateOpen(true);
  }, [phase, chart, fateTier, state.fateUses, litStars]);

  const openConnect = chart ? () => { setEchoDraft(""); setOverlay("connect"); } : undefined;

  return (
    <Shell
      mode={phase === "river" ? "desk" : "intake"}
      onReplay={replay}
      onEdit={replay}
      onCards={openConnect}
      onDevelop={develop}
      developing={rehearse}
      menuHint={phase === "river" && !!chart && !fateOpen && !overlay && guide === "menu"}
      onMenuHintDone={finishGuide}
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
            rounds={rehearse ? [] : state.stars.filter((star) => star.kind === "round").map((star) => ({ id: star.id, title: star.title }))}
            onReady={(person) => {
              if (rehearseRef.current) adoptRehearsal(person);
              else adopt(person);
            }}
            guide={guide}
            rehearse={rehearse}
            onGuide={(step) => {
              if (step === "six" || step === "core" || step === "echo" || step === "menu" || step === "done") saveGuide(step);
            }}
            onPick={(id, slow) => {
              const invited = slow === true || sessionStorage.getItem("shijie-suanfa/relight-invite") === "1";
              if (id === "core") {
                if (slow && rehearseRef.current && (guideRef.current === "six" || guideRef.current === "core")) return;
                setSlowChat(invited);
                setOverlay("chat");
              } else if (id.startsWith("round:")) {
                setSlowChat(false);
                setRoundId(id.slice(6));
                setOverlay("round");
              } else {
                setSlowChat(false);
                setPalace(id as PalaceId);
                setOverlay("palace");
              }
            }}
          />
          {chart && !fateOpen && !overlay && guide === "echo" && (
            <RiverGuide step="echo" onDone={() => saveGuide("menu")} />
          )}
          {chart && (
            <button type="button" className="river-echo" onClick={openConnect}>回声</button>
          )}
        </div>
      )}
      {overlay && chart && (
        <div className="star-overlay">
          <button className="star-backdrop" aria-label="回到星河" onClick={closeOverlay} />
          <section className={slowChat && overlay === "chat" ? "star-surface is-slow" : "star-surface"} role="dialog" aria-modal="true" aria-label={overlay === "palace" ? (PALACES.find((item) => item.id === palace)?.title ?? "这颗星") : overlay === "round" ? (state.stars.find((star) => star.id === roundId)?.title ?? "这颗星") : "本命"}>
            <header className="star-surface-head">
              <div>
                <i />
                <h1>{overlay === "palace" ? (PALACES.find((item) => item.id === palace)?.title.replace(/星$/u, "") ?? "这颗星") : overlay === "round" ? (state.stars.find((star) => star.id === roundId)?.title ?? "这颗星") : "本命"}</h1>
              </div>
              <button className="surface-close" type="button" aria-label="关闭" onClick={closeOverlay}>×</button>
            </header>
            {overlay !== "palace" && overlay !== "connect" && overlay !== "round" && (
              <div className="star-tabs" role="tablist" aria-label="本命">
                {(["chat", "persona"] as const).map((tab) => (
                  <button key={tab} type="button" role="tab" aria-selected={overlay === tab} onClick={() => setOverlay(tab)}>
                    {tab === "chat" ? "对话" : "人格"}
                  </button>
                ))}
              </div>
            )}
            <div className="star-surface-body">
              {overlay === "chat" && (
                <ChatView chart={chart} embedded presence starName="本命" invite={showChatGuide ? "一天点亮一颗星。累计两颗，可以问一次神谕。" : slowChat ? "现在跟本命星对话，来点亮星河···" : undefined} promptGuide={showPromptGuide} onPromptGuideDone={() => {
                  setShowPromptGuide(false);
                  try { localStorage.setItem(PROMPT_GUIDE, "1"); } catch { /* 看过一次就够。 */ }
                }} onUserSend={(text) => {
                  window.dispatchEvent(new CustomEvent("worldcal-chat", { detail: text }));
                }} />
              )}
              {overlay === "persona" && (
                <RiverDesk chart={chart} start="persona" embedded onClose={() => setOverlay(null)} />
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
                  {palace === "ming" && <ChartView chart={chart} ziHour={state.settings.ziHour} embedded />}
                  {readingBusy && <p>正在看这颗星…</p>}
                  {reading && <p className="bubble guide">{reading}</p>}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {fateOpen && chart && (
        <FateRite chart={chart} again={state.fateUses > 0} onClose={() => setFateOpen(false)} />
      )}
    </Shell>
  );
}

const GUIDE_KEY = "shijie-suanfa/guide-v3";
const CHAT_GUIDE = "shijie-suanfa/guide-chat-v3";
const PROMPT_GUIDE = "shijie-suanfa/guide-prompt";

function readChatGuide() {
  try { return localStorage.getItem(CHAT_GUIDE) !== "1"; } catch { return true; }
}

function readPromptGuide() {
  try { return localStorage.getItem(PROMPT_GUIDE) !== "1"; } catch { return true; }
}

function readGuide(): "six" | "core" | "echo" | "menu" | "done" {
  try {
    const saved = localStorage.getItem(GUIDE_KEY);
    if (saved === "six" || saved === "core" || saved === "echo" || saved === "menu" || saved === "done") return saved;
    if (saved === "chat") return "echo";
  } catch { /* 读不到就从头说。 */ }
  return "six";
}

function RiverGuide({ step, onDone }: { step: "echo"; onDone: () => void }) {
  if (step !== "echo") return null;
  return (
    <p className="echo-tip">
      这里是回声。可以和世界上的人说话。
      <button type="button" onClick={onDone}>好</button>
    </p>
  );
}
