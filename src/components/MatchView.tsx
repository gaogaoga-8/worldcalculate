import { useMemo, useState } from "react";
import { buildChart, clockLabel, type Chart } from "../bazi/chart";
import { matchCharts } from "../bazi/match";
import { knowledgePack } from "../knowledge/pack";
import { MBTI_TYPES, scoreQuiz } from "../mbti";
import { updateState, useAppState } from "../store";
import type { Person } from "../types";
import { PersonForm } from "./PersonForm";

export function MatchView({ selfChart }: { selfChart: Chart }) {
  const state = useAppState();
  const [selected, setSelected] = useState<string | null>(state.people[0]?.id ?? null);
  const [adding, setAdding] = useState(state.people.length === 0);
  const selfMbti = scoreQuiz(state.quiz)?.type ?? null;
  const entries = useMemo(() => {
    const people = state.people.map((person) => ({ person, source: "写入" as const }));
    const figures = knowledgePack.figures.map((figure) => ({
      person: {
        id: `figure:${figure.id}`,
        name: figure.name,
        gender: figure.gender,
        time: figure.time,
        place: figure.place,
        hourUnknown: figure.hourUnknown,
        mbti: figure.mbti ?? null,
      } satisfies Person,
      source: "人物" as const,
    }));
    return [...people, ...figures];
  }, [state.people]);
  const current = entries.find((item) => item.person.id === selected) ?? entries[0];
  const report = current
    ? matchCharts(selfChart, buildChart(current.person, { ziHour: state.settings.ziHour }), selfMbti, current.person.mbti ?? null)
    : null;

  return (
    <section className="panel">
      <div className="match">
        <aside className="people">
          <button className="ghost" onClick={() => setAdding((v) => !v)}>{adding ? "收起" : "添加一个人"}</button>
          {adding && (
            <div className="inline-form">
              <header><span>对方</span></header>
              <PersonForm
                requireName
                submitLabel="写入"
                onSubmit={(person) => {
                  updateState((prev) => ({ ...prev, people: [...prev.people, person] }));
                  setSelected(person.id);
                  setAdding(false);
                }}
              />
            </div>
          )}
          {entries.length === 0 && <p className="hint">把想了解的人写进来。对照只留在这台机器上。</p>}
          {entries.map((item) => (
            <button key={item.person.id} className={current?.person.id === item.person.id ? "person on" : "person"} onClick={() => setSelected(item.person.id)}>
              {item.person.name}
              <small>{item.source} · {clockLabel(item.person)}</small>
            </button>
          ))}
        </aside>
        <div className="detail">
          {!current || !report ? (
            <p>先添加一个人。</p>
          ) : (
            <>
              <p className="score-num">{report.score ?? "—"}</p>
              <small>{selfChart.person.name} × {current.person.name}</small>
              <p>{report.summary}</p>
              {report.tags.length > 0 && (
                <div className="tags">{report.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              )}
              {report.bands.map((band) => (
                <div key={band.id} className="band">
                  <header>
                    <span>{band.label}</span>
                    <span>{band.score ?? "—"}</span>
                  </header>
                  <div className="track"><i className="fill-火" style={{ width: `${band.score ?? 0}%` }} /></div>
                  <p className="note">{band.detail}</p>
                </div>
              ))}
              {current.source === "写入" && (
                <label className="field">
                  对方的 MBTI，知道的话可以填
                  <select
                    value={current.person.mbti ?? ""}
                    onChange={(event) => {
                      const mbti = event.target.value || null;
                      updateState((prev) => ({
                        ...prev,
                        people: prev.people.map((person) => (person.id === current.person.id ? { ...person, mbti } : person)),
                      }));
                    }}
                  >
                    <option value="">未知</option>
                    {MBTI_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
              )}
              {current.source === "写入" && (
                <button
                  className="ghost"
                  onClick={() => {
                    updateState((prev) => ({ ...prev, people: prev.people.filter((person) => person.id !== current.person.id) }));
                    setSelected(null);
                  }}
                >
                  移除
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
