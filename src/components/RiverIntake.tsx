import { useEffect, useRef, useState, type ReactNode } from "react";
import skyUrl from "../assets/sky.png";
import { birthError, type BirthSelection } from "./BirthFields";
import { CITIES } from "../places";
import type { Gender, Person } from "../types";
import { mountRiverSky } from "./riverSky";
import "./river-intake.css";

const HOME = {
  origin: { x: 0.2, y: 0.23 },
  birth: { x: 0.6, y: 0.07 },
  sign: { x: 0.7, y: 0.17 },
} as const;

type Key = keyof typeof HOME;

const TAU = Math.PI * 2;

function findCity(text: string) {
  const raw = text.trim();
  const bare = raw.replace(/(特别行政区|自治州|自治县|地区|盟|市)$/u, "");
  const exact = CITIES.find((city) => city.name === raw || city.name === bare || city.name.replace(/市$/u, "") === bare);
  if (exact) return exact;
  return CITIES.filter((city) => raw.includes(city.name) || city.name.includes(bare))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

function parseWhen(date: string, time: string): BirthSelection | null {
  const day = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = time.match(/^(\d{2}):(\d{2})$/);
  if (!day || !clock) return null;
  return {
    year: day[1],
    month: String(Number(day[2])),
    day: String(Number(day[3])),
    hour: String(Number(clock[1])),
    minute: String(Number(clock[2])),
    unknown: false,
  };
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function RiverIntake({
  onDone,
  onBack,
}: {
  onDone: (person: Person) => void;
  onBack?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nodes = useRef<Record<Key, HTMLDivElement | null>>({ origin: null, birth: null, sign: null });
  const [open, setOpen] = useState<Key | null>(null);
  const [done, setDone] = useState<Record<Key, boolean>>({ origin: false, birth: false, sign: false });
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [fault, setFault] = useState("");

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    return mountRiverSky(node, skyUrl);
  }, []);

  useEffect(() => {
    const rootNode = root.current;
    if (!rootNode) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const drift = {
      origin: { ax: 14, ay: 10, ph: 0.4, om: TAU / 32 },
      birth: { ax: 12, ay: 8, ph: 1.7, om: -TAU / 36 },
      sign: { ax: 16, ay: 9, ph: 2.8, om: TAU / 28 },
    };
    let clock = 0;
    let raf = 0;
    let last = performance.now();
    const placeStars = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!motion.matches) clock += dt;
      const width = rootNode.clientWidth;
      const height = rootNode.clientHeight;
      (Object.keys(HOME) as Key[]).forEach((key) => {
        const el = nodes.current[key];
        if (!el || width < 2) return;
        const item = drift[key];
        const ang = item.om * clock + item.ph;
        const dx = Math.cos(ang) * item.ax - Math.cos(item.ph) * item.ax;
        const dy = Math.sin(ang) * item.ay - Math.sin(item.ph) * item.ay;
        const x = HOME[key].x * width + dx;
        const y = HOME[key].y * height + dy;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      });
      raf = requestAnimationFrame(placeStars);
    };
    raf = requestAnimationFrame(placeStars);
    return () => cancelAnimationFrame(raf);
  }, []);

  function commit(key: Key) {
    if (key === "origin") {
      const city = findCity(place);
      if (!city) {
        setFault("没对上城市。说一个城市名，比如太原。");
        return;
      }
      setPlace(city.name);
    }
    if (key === "birth") {
      const when = parseWhen(date, time);
      const message = when ? birthError(when) : "请选择出生日期和时间。";
      if (message) {
        setFault(message);
        return;
      }
    }
    if (key === "sign" && (!name.trim() || !gender)) {
      setFault("写下名字，并选择性别。");
      return;
    }
    setFault("");
    const next = { ...done, [key]: true };
    setDone(next);
    setOpen(null);
    if (next.origin && next.birth && next.sign) {
      const city = findCity(place);
      const when = parseWhen(date, time);
      if (!city || !when || !gender) return;
      window.setTimeout(() => {
        onDone({
          id: "self",
          name: name.trim(),
          gender,
          time: {
            year: Number(when.year),
            month: Number(when.month),
            day: Number(when.day),
            hour: Number(when.hour),
            minute: Number(when.minute),
          },
          place: { name: city.name, longitude: city.longitude, latitude: city.latitude, timezone: 8 },
          hourUnknown: false,
          mbti: null,
        });
      }, 700);
    }
  }

  const stars: { key: Key; label: string; fields: ReactNode; ready: boolean }[] = [
    {
      key: "origin",
      label: done.origin ? place : "来处",
      ready: Boolean(findCity(place)),
      fields: (
        <>
          <input name="place" value={place} placeholder="地点" maxLength={40} aria-label="地点" onChange={(event) => { setPlace(event.target.value); setFault(""); }} />
          {open === "origin" && fault && <p className="err">{fault}</p>}
        </>
      ),
    },
    {
      key: "birth",
      label: "降生",
      ready: Boolean(parseWhen(date, time) && !birthError(parseWhen(date, time)!)),
      fields: (
        <>
          <input name="date" type="date" value={date} aria-label="出生日期" onChange={(event) => { setDate(event.target.value); setFault(""); }} />
          <input name="time" type="time" value={time} aria-label="出生时间" onChange={(event) => { setTime(event.target.value); setFault(""); }} />
          {open === "birth" && fault && <p className="err">{fault}</p>}
        </>
      ),
    },
    {
      key: "sign",
      label: done.sign ? name : "符号",
      ready: Boolean(name.trim() && gender),
      fields: (
        <>
          <input name="name" value={name} placeholder="名字" maxLength={24} aria-label="名字" onChange={(event) => { setName(event.target.value); setFault(""); }} />
          <div className="genders">
            <button type="button" className={gender === "male" ? "on" : ""} onClick={() => setGender("male")}>男</button>
            <button type="button" className={gender === "female" ? "on" : ""} onClick={() => setGender("female")}>女</button>
          </div>
          {open === "sign" && fault && <p className="err">{fault}</p>}
        </>
      ),
    },
  ];

  return (
    <div ref={root} className={`river-intake ready${done.origin && done.birth && done.sign ? " locked" : ""}`}>
      <canvas ref={canvas} aria-hidden="true" />
      {stars.map((star) => (
        <div
          key={star.key}
          className={`seed${open === star.key ? " open" : ""}${done[star.key] ? " done" : ""}${HOME[star.key].x > 0.55 ? " flip-x" : ""}`}
          ref={(node) => { nodes.current[star.key] = node; }}
          style={{ ["--twd" as string]: star.key === "birth" ? "3.4s" : star.key === "origin" ? "4.2s" : "5s" }}
        >
          <button className="star" type="button" aria-label={star.label} aria-expanded={open === star.key} onClick={() => setOpen(open === star.key ? null : star.key)}>
            <i className="halo" />
            <i className="core" />
            <span className="name">{star.label}</span>
          </button>
          <form
            className="panel"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              commit(star.key);
            }}
          >
            <div className="fields">{star.fields}</div>
            <button className="ok" type="submit" aria-label="完成" disabled={!star.ready}>
              <Check />
            </button>
          </form>
        </div>
      ))}
      {onBack && (
        <button type="button" className="back" onClick={onBack}>
          返回
        </button>
      )}
    </div>
  );
}
