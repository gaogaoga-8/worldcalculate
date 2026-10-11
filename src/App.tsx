import { useEffect, useMemo, useState } from "react";
import { buildChart } from "./bazi/chart";
import { SocialSky } from "./components/SocialSky";
import { ConnectMap } from "./components/ConnectMap";
import { Arrival } from "./components/Arrival";
import { useGuest } from "./guest";
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
    state.self && state.self.name !== "你" ? "desk" : "intake",
  );
  const [view, setView] = useState<ViewId>("self");
  const [formationId, setFormationId] = useState(0);
  const [arrival, setArrival] = useState(false);
  const [echoDraft, setEchoDraft] = useState("");
  const guest = useGuest();

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
    setArrival(!state.self || state.self.name === "你");
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
      onCards={() => setView("cards")}
    >
      {phase !== "intake" && chart ? (
        <>
          {view === "self" && (
            <SelfSky
              chart={chart}
              onHome={(draft = "") => {
                setEchoDraft(draft);
                setView("connect");
              }}
              forming={phase === "galaxy"}
              formationId={formationId}
              onSettled={() => setPhase("desk")}
            />
          )}
          {view === "connect" && (
            <SocialSky
              name={chart.person.name}
              user={guest.user}
              enter={guest.enter}
              draft={echoDraft}
              onHome={() => {
                setEchoDraft("");
                setView("self");
              }}
            />
          )}
          {view === "cards" && (
            <ConnectMap chart={chart} onOpenSelf={() => setView("self")} />
          )}
          {phase === "desk" && arrival && (
            <Arrival
              name={chart.person.name}
              onEnter={async (destination) => {
                // Local conversation remains available when the community is offline.
                if (destination === "connect")
                  await guest.enter(chart.person.name);
                else void guest.enter(chart.person.name).catch(() => {});
                setArrival(false);
                setView(destination);
              }}
            />
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
