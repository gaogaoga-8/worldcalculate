import { useEffect, useRef, useState } from "react";
import { useAppState } from "../store";
import { PROVINCES } from "../places";
import { INPUT_STARS } from "../cosmos";
import type { Gender, Person } from "../types";
import {
  BirthFields,
  LocationFields,
  birthError,
  emptyBirth,
  emptyLocation,
  selectedCity,
  type BirthSelection,
  type LocationSelection,
} from "./BirthFields";
import { returnStar } from "../account";
import { StarClaim } from "./StarClaim";

export function IntakeChat({
  onDone,
  onBack,
  onReturned,
}: {
  onDone: (person: Person) => void;
  onBack?: () => void;
  onReturned?: () => void;
}) {
  const self = useAppState().self;
  const region = PROVINCES.find((p) =>
    p.cities.some(
      (c) =>
        c.name === self?.place.name ||
        c.name.replace(/市$/, "") === self?.place.name,
    ),
  );
  const [birth, setBirth] = useState<BirthSelection>(
    self
      ? {
          year: String(self.time.year),
          month: String(self.time.month),
          day: String(self.time.day),
          hour: self.time.hour == null ? "" : String(self.time.hour),
          minute: String(self.time.minute),
          unknown: self.hourUnknown,
        }
      : { ...emptyBirth },
  );
  const [location, setLocation] = useState<LocationSelection>(
    region
      ? {
          country: "CN",
          province: region.code,
          city:
            region.cities.find(
              (c) =>
                c.name === self?.place.name ||
                c.name.replace(/市$/, "") === self?.place.name,
            )?.code ?? "",
        }
      : { ...emptyLocation },
  );
  const [name, setName] = useState(self?.name === "你" ? "" : self?.name || "");
  const [gender, setGender] = useState<Gender | "">(self?.gender ?? "");
  const [done, setDone] = useState([
    !!self,
    !!self,
    !!self && !!self.name && self.name !== "你",
  ]);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [claim, setClaim] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const city = selectedCity(location);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (active !== null)
      formRef.current?.querySelector<HTMLElement>("select,input")?.focus();
  }, [active]);
  function save() {
    setError("");
    const fault =
      active === 0
        ? birthError(birth)
        : active === 1
          ? !city
            ? "请选择出生城市。"
            : null
          : !name.trim()
            ? "给这颗星一个名字。"
            : !gender
              ? "请选择性别。"
              : null;
    if (fault) {
      setError(fault);
      return;
    }
    const completed = done.map((value, index) =>
      index === active ? true : value,
    );
    setDone(completed);
    setActive(null);
    if (completed.every(Boolean) && city && gender) {
      setJoining(true);
      const person: Person = {
        id: "self",
        name: name.trim(),
        gender,
        time: {
          year: Number(birth.year),
          month: Number(birth.month),
          day: Number(birth.day),
          hour: birth.unknown ? null : Number(birth.hour),
          minute: birth.unknown ? 0 : Number(birth.minute),
        },
        place: {
          name: city.name,
          longitude: city.longitude,
          latitude: city.latitude,
          timezone: 8,
        },
        hourUnknown: birth.unknown,
        mbti: self?.mbti ?? null,
      };
      timer.current = setTimeout(() => onDone(person), 800);
    }
  }
  const labels = ["生日", "来处", "名字"];
  const summaries = [
    `${birth.month}月${birth.day}日`,
    city?.name,
    name.trim(),
  ];
  return (
    <main
      className={`intake constellation-intake${joining ? " joining" : ""}`}
      aria-label="三颗星，开始你的星系"
    >
      <div className="intake-constellation">
        {INPUT_STARS.map((star, index) => (
          <button
            key={star.id}
            type="button"
            className={`intake-star ${done[index] ? "filled" : ""} ${active === index ? "active" : ""} ${!done[index] && done.filter(Boolean).length === index ? "calling" : ""}`}
            style={{ left: `${star.x * 100}%`, top: `${star.y * 100}%` }}
            aria-label={`填写${labels[index]}`}
            aria-pressed={active === index}
            disabled={joining}
            onClick={() => {
              setActive(index);
              setError("");
            }}
          >
            <i />
            <span>{done[index] ? summaries[index] : labels[index]}</span>
          </button>
        ))}
      </div>
      {active === null && !joining && (
        <div className="intake-hint">
          <p>{done.some(Boolean) ? "还有星星在等你" : "点一颗星，开始"}</p>
          {!done.some(Boolean) && (
            <button type="button" className="text-action" onClick={() => setClaim(true)}>
              认回这颗星
            </button>
          )}
        </div>
      )}
      {claim && (
        <StarClaim
          intent="return"
          onClose={() => setClaim(false)}
          onSubmit={async (name, secret) => {
            await returnStar(name, secret);
            onReturned?.();
          }}
        />
      )}
      {onBack && (
        <button
          className="constellation-back text-action"
          onClick={onBack}
          disabled={joining}
          aria-label="返回星系"
        >
          ←
        </button>
      )}
      {active !== null && (
        <form
          ref={formRef}
          className="intake-sheet minimal-entry"
          aria-label={labels[active]}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setActive(null);
              setError("");
            }
          }}
        >
          <header>
            <h1>
              {active === 0
                ? "出生时刻"
                : active === 1
                  ? "出生地"
                  : "怎么称呼你"}
              {active === 0 && <small>公历</small>}
            </h1>
            <button
              type="button"
              className="surface-close"
              aria-label="收起填写"
              onClick={() => setActive(null)}
            >
              ×
            </button>
          </header>
          {active === 0 ? (
            <BirthFields value={birth} onChange={setBirth} minimal />
          ) : active === 1 ? (
            <LocationFields value={location} onChange={setLocation} minimal />
          ) : (
            <>
              <input
                className="name-field"
                aria-label="名字"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="你的名字或昵称"
                maxLength={24}
                autoComplete="nickname"
                required
              />
              <fieldset className="minimal-gender">
                <legend>性别</legend>
                {(["male", "female"] as const).map((value, index) => (
                  <label
                    key={value}
                    className={gender === value ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="gender"
                      checked={gender === value}
                      onChange={() => setGender(value)}
                      required
                    />
                    <span>{index === 0 ? "男" : "女"}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {error && (
            <p className="minimal-error" role="alert">
              {error}
            </p>
          )}
          <div className="intake-save">
            <button className="entry-next" aria-label="点亮这颗星">
              ✓
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
