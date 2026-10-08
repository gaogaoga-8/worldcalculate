import { useEffect, useMemo, useState } from "react";
import { buildChart } from "./bazi/chart";
import { ConnectMap } from "./components/ConnectMap";
import { SelfSky } from "./components/SelfSky";
import { IntakeChat } from "./components/IntakeChat";
import { Shell, type ViewId } from "./components/Shell";
import { coreStar } from "./galaxy";
import { updateState, useAppState } from "./store";
import type { Person } from "./types";
import "./styles.css";

type Phase = "intake" | "galaxy" | "desk";

export function App() {
  const state = useAppState();
  const [phase, setPhase] = useState<Phase>(() =>
    state.self ? "desk" : "intake",
  );
  const [view, setView] = useState<ViewId>("self");
  const [formationId, setFormationId] = useState(0);

  function replay() {
    setView("self");
    setFormationId((id) => id + 1);
    setPhase("galaxy");
  }

  useEffect(() => {
    if (!state.self && phase === "desk") setPhase("intake");
  }, [state.self, phase]);

  const chart = useMemo(() => {
    if (!state.self) return null;
    return buildChart(state.self, {
      ziHour: state.settings.ziHour,
      now: new Date(),
    });
  }, [state.self, state.settings.ziHour]);

  function commit(person: Person) {
    updateState((prev) => ({
      ...prev,
      self: { ...person, id: "self" },
      galaxyId: prev.galaxyId || crypto.randomUUID(),
      stars: prev.self ? prev.stars : [coreStar("本命")],
      roundTurns: prev.self ? prev.roundTurns : 0,
      messages: prev.self ? prev.messages : [],
      mirror: prev.self ? prev.mirror : null,
      plans: prev.plans,
    }));
    replay();
  }

  return (
    <Shell
      mode={phase !== "intake" && chart ? "desk" : "intake"}
      forming={phase === "galaxy"}
      view={view}
      onReplay={replay}
      onEdit={() => setPhase("intake")}
    >
      {phase !== "intake" && chart ? (
        <>
          {view === "self" && (
            <SelfSky
              chart={chart}
              onHome={() => setView("connect")}
              forming={phase === "galaxy"}
              formationId={formationId}
              onSettled={() => setPhase("desk")}
            />
          )}
          {view === "connect" && (
            <ConnectMap chart={chart} onOpenSelf={() => setView("self")} />
          )}
        </>
      ) : (
        <IntakeChat
          onDone={commit}
          onBack={state.self ? () => setPhase("desk") : undefined}
        />
      )}
    </Shell>
  );
}
