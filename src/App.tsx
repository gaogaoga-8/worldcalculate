import { useEffect, useMemo, useRef, useState } from "react";
import { saveAccount, startAccountSync } from "./account";
import { buildChart } from "./bazi/chart";
import { Arrival } from "./components/Arrival";
import { ConnectMap } from "./components/ConnectMap";
import { IntakeChat } from "./components/IntakeChat";
import { SelfSky } from "./components/SelfSky";
import { Shell, type ViewId } from "./components/Shell";
import { beginOpening } from "./bgm";
import { useGuest } from "./guest";
import { coreStar, palaceStars } from "./galaxy";
import { getState, updateState, useAppState } from "./store";
import { newId } from "./id";
import type { Person } from "./types";
import "./styles.css";

type Phase = "intake" | "galaxy" | "desk";

const OPENING_PREVIEW = "shijie-suanfa/opening-preview";

function openingPreviewPending(): boolean {
  try {
    return localStorage.getItem(OPENING_PREVIEW) !== "done";
  } catch {
    return false;
  }
}

export function App() {
  const state = useAppState();
  const [phase, setPhase] = useState<Phase>(() => {
    if (!state.self) return "intake";
    return openingPreviewPending() ? "galaxy" : "desk";
  });
  const [previewOpening] = useState(() => Boolean(state.self) && openingPreviewPending());
  const [view, setView] = useState<ViewId>("self");
  const [formationId, setFormationId] = useState(0);
  const [echoDraft, setEchoDraft] = useState("");
  const [arrival, setArrival] = useState(false);
  const [booting, setBooting] = useState(() => !state.self);
  const settled = useRef(false);
  const guest = useGuest();

  function replay() {
    setView("self");
    setFormationId((id) => id + 1);
    setPhase("galaxy");
  }

  useEffect(() => {
    if (!state.self && phase === "desk") setPhase("intake");
  }, [state.self, phase]);

  useEffect(() => {
    let live = true;
    void startAccountSync().finally(() => {
      if (!live) return;
      setBooting(false);
      if (settled.current) return;
      settled.current = true;
      if (!getState().self) return;
      setPhase(openingPreviewPending() ? "galaxy" : "desk");
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!previewOpening || phase !== "galaxy") return;
    try {
      localStorage.setItem(OPENING_PREVIEW, "done");
    } catch {
      // 这次进不去也没关系，下一次刷新还会按第一次进入。
    }
    const start = () => void beginOpening();
    start();
    const onGesture = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-core-star]")) return;
      start();
    };
    window.addEventListener("pointerdown", onGesture);
    return () => window.removeEventListener("pointerdown", onGesture);
  }, [previewOpening, phase]);

  const chart = useMemo(() => {
    if (!state.self) return null;
    return buildChart(state.self, {
      ziHour: state.settings.ziHour,
      now: new Date(),
    });
  }, [state.self, state.settings.ziHour]);

  function commit(person: Person) {
    const kind = state.self ? "edit" : "open";
    const first = !state.self;
    if (first) {
      void beginOpening();
      setArrival(true);
    }
    updateState((prev) => ({
      ...prev,
      self: { ...person, id: "self" },
      galaxyId: prev.galaxyId || newId(),
      stars: prev.self ? prev.stars : [coreStar("本命"), ...palaceStars()],
      roundTurns: prev.self ? prev.roundTurns : 0,
      messages: prev.self ? prev.messages : [],
      mirror: prev.self ? prev.mirror : null,
      plans: prev.plans,
    }));
    void saveAccount(person, kind).catch(() => {});
    replay();
  }

  function openEcho(draft = "") {
    setEchoDraft(draft);
    setArrival(false);
    setView("connect");
  }

  return (
    <Shell
      mode={phase !== "intake" && chart ? "desk" : "intake"}
      forming={phase === "galaxy"}
      view={view}
      onReplay={replay}
      onEdit={() => setPhase("intake")}
      onCards={() => openEcho()}
    >
      {phase !== "intake" && chart ? (
        <>
          {view === "self" && (
            <SelfSky
              chart={chart}
              onHome={(draft = "") => openEcho(draft)}
              forming={phase === "galaxy"}
              formationId={formationId}
              onSettled={() => setPhase("desk")}
            />
          )}
          {view === "connect" && (
            <ConnectMap
              chart={chart}
              draft={echoDraft}
              onDraftUsed={() => setEchoDraft("")}
              onOpenSelf={() => setView("self")}
            />
          )}
          {arrival && (
            <Arrival
              name={chart.person.name}
              onEnter={async (destination) => {
                if (destination === "connect") await guest.enter(chart.person.name);
                else void guest.enter(chart.person.name).catch(() => {});
                setArrival(false);
                if (destination === "connect") setView("connect");
              }}
            />
          )}
        </>
      ) : booting ? (
        <div className="boot-sky" />
      ) : (
        <IntakeChat
          onDone={commit}
          onBack={state.self ? () => setPhase("desk") : undefined}
        />
      )}
    </Shell>
  );
}
