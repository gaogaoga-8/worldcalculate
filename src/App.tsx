import { useEffect, useMemo, useRef, useState } from "react";
import { openStar, returnStar, saveAccount, startAccountSync } from "./account";
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
import { getState, updateState, useAppState } from "./store";
import { newId } from "./id";
import { prefetchPalaces, readPalace } from "./oracle/palaces";
import { plainReading } from "./oracle/prompt";
import type { PalaceId } from "./galaxy";
import type { Person } from "./types";
import "./styles.css";

type Phase = "boot" | "river";
type Overlay = "chat" | "palace" | "connect" | "persona" | "round" | null;

export function App() {
  const state = useAppState();
  const [phase, setPhase] = useState<Phase>("boot");
  const [authed, setAuthed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [guideAnchor, setGuideAnchor] = useState<{
    step: string;
    point: { left: number; right: number; top: number; mid: number } | null;
  } | null>(null);
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
  const [showFateGuide, setShowFateGuide] = useState(readFateGuide);
  const guideRef = useRef(guide);
  const guideSeen = useRef(false);
  guideRef.current = guide;
  const [reading, setReading] = useState("");
  const [readingBusy, setReadingBusy] = useState(false);
  const [fateOpen, setFateOpen] = useState(false);
  const settled = useRef(false);
  const litStars = state.stars.filter((star) => star.kind === "round").length;
  const fateTier = litStars;
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

  function saveGuide(step: "six" | "echo" | "menu" | "core" | "done") {
    setGuide(step);
    try { localStorage.setItem(GUIDE_KEY, step); } catch { /* 记不住就下次再轻轻说一次。 */ }
  }

  function closeOverlay() {
    const step = guideRef.current;
    const seen = guideSeen.current;
    guideSeen.current = false;
    if (overlay === "chat" && showChatGuide) {
      setShowChatGuide(false);
      try { localStorage.setItem(CHAT_GUIDE, "1"); } catch { /* 看过一次就够。 */ }
    }
    setOverlay(null);
    setSlowChat(false);
    try { sessionStorage.removeItem("shijie-suanfa/relight-invite"); } catch { /* 关掉这次提示。 */ }
    // 顺序：六颗星 → 回声 → 三个点 → 本命（最后）。
    if (seen && step === "six") saveGuide("echo");
    if (seen && step === "core") saveGuide("done");
  }

  function startNewcomer() {
    saveGuide("six");
    setShowChatGuide(true);
    setShowPromptGuide(true);
    setShowFateGuide(true);
    try {
      localStorage.removeItem(CHAT_GUIDE);
      localStorage.removeItem(PROMPT_GUIDE);
      localStorage.removeItem(FATE_GUIDE);
    } catch { /* 记不住就这一次把指引再说一遍。 */ }
  }

  function reenter() {
    setOverlay(null);
    setSlowChat(false);
    setFateOpen(false);
    setShowHistory(false);
    saveGuide("done");
    try { localStorage.removeItem("star-river:galaxy"); } catch { /* 清不掉就让星河自己再问一次。 */ }
    try { sessionStorage.removeItem("shijie-suanfa/relight-invite"); } catch { /* 这次只重播点亮，不再带新手指引。 */ }
    setRiverReset(true);
    setRiverKey((key) => key + 1);
    setPhase("river");
  }

  async function claim(name: string, secret: string) {
    if (secret.length < 4) return { ok: false, message: "暗语再长一点。" };
    const mark = await loginMark(name, secret);
    let last = "";
    try { last = localStorage.getItem(LAST_LOGIN) || ""; } catch { /* 读不到就当作第一次。 */ }
    try {
      await returnStar(name, secret);
      try { localStorage.setItem(LAST_LOGIN, mark); } catch { /* 记不住下次仍会再点亮一次。 */ }
      const saved = getState().self;
      setAuthed(true);
      if (saved && mark === last) {
        rememberGalaxy(saved);
        saveGuide("done");
        setShowHistory(true);
        setRiverReset(false);
        setRiverKey((key) => key + 1);
        return { ok: true, restore: true };
      }
      setShowHistory(false);
      startNewcomer();
      return { ok: true, guide: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("对不上")) return { ok: false, message: message || "暂时没连上，再试一次。" };
    }
    try {
      await openStar(name, secret);
      try { localStorage.setItem(LAST_LOGIN, mark); } catch { /* 记不住下次仍会再点亮一次。 */ }
      setAuthed(true);
      setShowHistory(false);
      startNewcomer();
      return { ok: true, guide: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("已经留下")) return { ok: false, message: "这个名字已经留下过了，暗语对不上。" };
      return { ok: false, message: message || "暂时没连上，再试一次。" };
    }
  }

  useEffect(() => {
    let live = true;
    void startAccountSync()
      .then(() => {
        if (!live) return;
        if (settled.current) return;
        settled.current = true;
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
    const current = palace;
    const saved = state.stars.find((star) => star.palace === current)?.reading;
    if (saved) {
      setReading(plainReading(saved));
      setReadingBusy(false);
      return;
    }
    let cancel = false;
    setReading("");
    setReadingBusy(true);
    void readPalace(chart, current)
      .then((text) => {
        if (cancel) return;
        setReading(plainReading(text));
      })
      .catch((error: unknown) => { if (!cancel) setReading(error instanceof Error ? error.message : "模型没有答上来。"); })
      .finally(() => { if (!cancel) setReadingBusy(false); });
    return () => { cancel = true; };
  }, [chart, palace, overlay, state.stars]);

  // 星河动效一出来就开始排这六颗星，用户点开时多半已经算好。
  useEffect(() => {
    if (!authed || phase !== "river" || !chart) return;
    const timer = window.setTimeout(() => prefetchPalaces(chart), 2500);
    return () => window.clearTimeout(timer);
  }, [authed, phase, chart]);

  useEffect(() => {
    if (!authed || phase !== "river" || !chart || fateTier < 1 || fateTier <= state.fateUses) return;
    if (fatePrompted.current === litStars) return;
    fatePrompted.current = litStars;
    setOverlay(null);
    setSlowChat(false);
    setFateOpen(true);
  }, [authed, phase, chart, fateTier, state.fateUses, litStars]);

  // 点亮一颗星之后，对话面板自动收起，让星河与神谕露出来。
  const litCount = useRef(litStars);
  useEffect(() => {
    const grew = litStars > litCount.current;
    litCount.current = litStars;
    if (!grew) return;
    setOverlay((current) => (current === "chat" || current === "round" ? null : current));
    setSlowChat(false);
  }, [litStars]);

  const openConnect = chart ? () => { setEchoDraft(""); setOverlay("connect"); } : undefined;

  return (
    <Shell
      mode={phase === "river" ? "desk" : "intake"}
      onReplay={reenter}
      onEdit={reenter}
      onCards={openConnect}
      menuHint={authed && phase === "river" && !!chart && !fateOpen && !overlay && guide === "menu"}
      onMenuHintDone={() => saveGuide("core")}
    >
      {phase !== "river" ? (
        <div className="boot-sky" />
      ) : (
        <div className="river-home">
          <StarRiverHome
            person={showHistory ? state.self : null}
            resetKey={riverKey}
            reset={riverReset}
            history={showHistory}
            authed={authed}
            onClaim={claim}
            rounds={state.stars.filter((star) => star.kind === "round").map((star) => ({ id: star.id, title: star.title }))}
            onReady={adopt}
            onGuideAnchor={(step, point) => setGuideAnchor({ step, point })}
            guide={guide}
            onGuide={(step) => {
              if (step === "six" || step === "echo" || step === "menu" || step === "core" || step === "done") saveGuide(step);
            }}
            onPick={(id, slow) => {
              const invited = slow === true || sessionStorage.getItem("shijie-suanfa/relight-invite") === "1";
              if (guideRef.current === "six" && id === "career") guideSeen.current = true;
              if (guideRef.current === "core" && id === "core") guideSeen.current = true;
              if (id === "core") {
                if (slow && (guideRef.current === "six" || guideRef.current === "core")) return;
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
          {guideAnchor?.point && !overlay && !fateOpen && (guide === "six" || guide === "core") && (() => {
            const cue = guide === "six" ? "点击此处看看你此生事业" : "点击此处来认识自己";
            const line = guide === "six"
              ? "这六颗星，是按八字送给你的人生。第一次登录，星星还在推算，请稍后再来查收。"
              : "这颗是本命。在这里聊天，可以认识自己。";
            const width = 168;
            const left = guideAnchor.point as { left: number; right: number; top: number; mid: number };
            const flip = left.right + width + 20 > window.innerWidth;
            return (
              <p
                className={`river-cue${flip ? " flip" : ""}`}
                style={{
                  left: Math.max(8, flip ? left.left - width - 14 : left.right + 12),
                  top: Math.max(8, left.mid - 10),
                }}
              >
                <i />
                <b>{cue}</b>
                <span>{line}</span>
              </p>
            );
          })()}
          {authed && chart && !fateOpen && !overlay && guide === "echo" && (
            <RiverGuide step="echo" onDone={() => saveGuide("menu")} />
          )}
          {authed && chart && (
            <button type="button" className="river-echo" onClick={openConnect}>回声</button>
          )}
        </div>
      )}
      {authed && overlay && chart && (
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
                <ChatView chart={chart} embedded presence starName="本命" invite={showChatGuide ? "一天点亮一颗星。点亮一颗，就可以问一次神谕。" : slowChat ? "现在跟本命星对话，来点亮星河···" : undefined} promptGuide={showPromptGuide} onPromptGuideDone={() => {
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
      {authed && fateOpen && chart && (
        <FateRite
          chart={chart}
          again={state.fateUses > 0}
          hint={showFateGuide ? "点亮一颗星，就开启一次神谕。问完，答案会自己烧掉。" : undefined}
          onHintDone={() => {
            setShowFateGuide(false);
            try { localStorage.setItem(FATE_GUIDE, "1"); } catch { /* 看过一次就够。 */ }
          }}
          onClose={() => setFateOpen(false)}
        />
      )}
    </Shell>
  );
}

const LAST_LOGIN = "shijie-suanfa/last-login";
const GUIDE_KEY = "shijie-suanfa/guide-v3";

async function loginMark(name: string, secret: string) {
  const data = new TextEncoder().encode(`${name}\n${secret}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
const CHAT_GUIDE = "shijie-suanfa/guide-chat-v3";
const PROMPT_GUIDE = "shijie-suanfa/guide-prompt";
const FATE_GUIDE = "shijie-suanfa/guide-fate";

function readFateGuide() {
  try { return localStorage.getItem(FATE_GUIDE) !== "1"; } catch { return true; }
}

function readChatGuide() {
  try { return localStorage.getItem(CHAT_GUIDE) !== "1"; } catch { return true; }
}

function readPromptGuide() {
  try { return localStorage.getItem(PROMPT_GUIDE) !== "1"; } catch { return true; }
}

function readGuide(): "six" | "core" | "echo" | "menu" | "done" {
  try {
    const saved = localStorage.getItem(GUIDE_KEY);
    // 本命已改成最后一步；旧记录里停在「本命」的，从回声重新接着走。
    if (saved === "core") return "echo";
    if (saved === "six" || saved === "echo" || saved === "menu" || saved === "done") return saved;
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
