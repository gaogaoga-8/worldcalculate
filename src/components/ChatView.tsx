import { useEffect, useMemo, useRef, useState } from "react";
import { buildChart, type Chart } from "../bazi/chart";
import { opening, promptsFor, type ChatContext } from "../chat";
import { askOracle } from "../oracle/client";
import { oracleMessages } from "../oracle/prompt";
import { ROUND_TURNS, starProgress, dailyRoundTurns } from "../galaxy";
import { knowledgePack } from "../knowledge/pack";
import { scoreQuiz } from "../mbti";
import { updateState, useAppState } from "../store";
import { finishDailyRound } from "../progression";
import type { Person } from "../types";

export function ChatView({
  chart,
  embedded,
  starName = "本命",
  minimal = false,
}: {
  chart: Chart;
  embedded?: boolean;
  starName?: string;
  minimal?: boolean;
}) {
  const state = useAppState();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const todayTurns = dailyRoundTurns(state.messages, state.roundTurns, now);
  const progress = starProgress(state.stars, todayTurns, now);
  const endRef = useRef<HTMLDivElement>(null);
  const mbti = scoreQuiz(state.quiz)?.type ?? chart.person.mbti ?? null;
  const ctx = useMemo<ChatContext>(() => {
    const others = [
      ...state.people.map((person) => wrap(person, state.settings.ziHour)),
      ...knowledgePack.figures.map((figure) =>
        wrap(
          {
            id: `figure:${figure.id}`,
            name: figure.name,
            gender: figure.gender,
            time: figure.time,
            place: figure.place,
            hourUnknown: figure.hourUnknown,
            mbti: figure.mbti ?? null,
          },
          state.settings.ziHour,
        ),
      ),
    ];
    return {
      chart,
      mbti,
      people: state.people,
      charts: [{ person: chart.person, chart, mbti }, ...others],
    };
  }, [chart, mbti, state.people, state.settings.ziHour]);

  useEffect(() => {
    endRef.current?.parentElement?.scrollTo({
      top: endRef.current.parentElement.scrollHeight,
      behavior: "smooth",
    });
  }, [state.messages.length]);

  async function send(value: string) {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    setFault("");
    try {
      const answer = await askOracle(
        oracleMessages({
          kind: "chat",
          question: `正在与星星「${starName}」对话。用户说：${content}`,
          chart,
          mbti,
          stars: state.stars,
          history: state.messages,
        }),
      );
      updateState((prev) => ({
        ...prev,
        roundTurns: prev.roundTurns + 1,
        messages: [
          ...prev.messages,
          {
            id: crypto.randomUUID(),
            role: "user",
            text: content,
            at: Date.now(),
          },
          { id: crypto.randomUUID(), role: "guide", text: answer },
        ],
      }));
      setText("");
    } catch (error) {
      setFault(error instanceof Error ? error.message : "模型没有答上来。");
    } finally {
      setBusy(false);
    }
  }

  const talk = (
    <>
      <div className="thread">
        <div className="bubble guide">
          {minimal ? "我在。想聊些什么？" : opening(chart, mbti)}
        </div>
        {state.messages.map((message) => (
          <div key={message.id} className={`bubble ${message.role}`}>
            {message.at && message.role === "user" ? (
              <time>{whenLabel(message.at)}</time>
            ) : null}
            {message.text}
          </div>
        ))}
        {!minimal && (
          <div className="chips">
            {promptsFor(ctx).map((prompt) => (
              <button
                key={prompt}
                className="chip"
                onClick={() => send(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="round-bar">
        {progress.allowed && !minimal ? (
          <button
            className="ghost"
            type="button"
            disabled={busy}
            onClick={() => updateState((prev) => finishDailyRound(prev))}
          >
            结束这一轮，点亮今天的星 ↗
          </button>
        ) : (
          <p className="progress-note">
            {progress.allowed
              ? "回到星空，点亮下一颗星。"
              : progress.complete
                ? minimal
                  ? "七颗星，都亮了。"
                  : "七颗星都已点亮，故事还可以继续。"
                : progress.litToday
                  ? minimal
                    ? "明天，继续点亮。"
                    : "今天已点亮一颗星 · 明天继续"
                  : `再完成 ${Math.max(0, ROUND_TURNS - todayTurns)} 次对话，点亮今天的星`}
          </p>
        )}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            minimal ? "说点什么…" : `对${starName}说说，今天你在想什么…`
          }
          disabled={busy}
        />
        <button
          className="primary"
          aria-label="发送"
          type="submit"
          disabled={busy || !text.trim()}
        >
          {minimal ? (busy ? "…" : "↑") : busy ? "在看" : "发送"}
        </button>
      </form>
      {fault && <p className="sky-note">{fault}</p>}
    </>
  );
  if (embedded)
    return (
      <div className="chat-embed" aria-label={`与${starName}对话`}>
        {talk}
      </div>
    );
  return (
    <section className="panel">
      <header className="panel-head">
        <h1>对话</h1>
        <span>
          {state.roundTurns >= ROUND_TURNS
            ? "这一轮可以点亮"
            : `这一轮 ${state.roundTurns}/${ROUND_TURNS}`}
        </span>
      </header>
      {talk}
    </section>
  );
}

function whenLabel(at: number) {
  const date = new Date(at);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function wrap(person: Person, ziHour: "early" | "late") {
  return {
    person,
    chart: buildChart(person, { ziHour }),
    mbti: person.mbti ?? null,
  };
}
