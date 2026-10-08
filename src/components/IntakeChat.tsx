import { useState } from "react";
import { useAppState } from "../store";
import { PROVINCES } from "../places";
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

export function IntakeChat({
  onDone,
  onBack,
}: {
  onDone: (person: Person) => void;
  onBack?: () => void;
}) {
  const self = useAppState().self;
  const existingRegion = PROVINCES.find((p) =>
    p.cities.some(
      (c) =>
        c.name === self?.place.name ||
        c.name.replace(/市$/, "") === self?.place.name,
    ),
  );
  const [step, setStep] = useState(0);
  const [birth, setBirth] = useState<BirthSelection>(() =>
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
  const [location, setLocation] = useState<LocationSelection>(() =>
    existingRegion
      ? {
          country: "CN",
          province: existingRegion.code,
          city:
            existingRegion.cities.find(
              (c) =>
                c.name === self?.place.name ||
                c.name.replace(/市$/, "") === self?.place.name,
            )?.code ?? "",
        }
      : { ...emptyLocation },
  );
  const [gender, setGender] = useState<Gender | "">(self?.gender ?? "");
  const [error, setError] = useState("");
  const city = selectedCity(location);
  function next() {
    setError("");
    if (step === 0) {
      const fault = birthError(birth);
      if (fault) {
        setError(fault);
        return;
      }
      setStep(1);
    } else {
      if (!city) {
        setError("请选择出生城市。");
        return;
      }
      if (!gender) {
        setError("请选择性别。");
        return;
      }
      onDone({
        id: "self",
        name: self?.name || "你",
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
      });
    }
  }
  return (
    <main className="intake minimal-intake">
      <form
        className="minimal-entry"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <h1>
          {step === 0 ? "出生时刻" : "出生地"}
          {step === 0 && <small>公历</small>}
        </h1>
        <div className="minimal-fields" key={step}>
          {step === 0 ? (
            <BirthFields value={birth} onChange={setBirth} minimal />
          ) : (
            <>
              <LocationFields value={location} onChange={setLocation} minimal />
              {city && (
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
                        value={value}
                        checked={gender === value}
                        required
                        onChange={() => setGender(value)}
                      />
                      <span>{index === 0 ? "男" : "女"}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
        </div>
        {error && (
          <p className="minimal-error" role="alert">
            {error}
          </p>
        )}
        <div className="minimal-entry-actions">
          {step > 0 || onBack ? (
            <button
              className="entry-back"
              type="button"
              aria-label={step > 0 ? "上一步" : "返回星系"}
              onClick={() => {
                setError("");
                if (step > 0) setStep(step - 1);
                else onBack?.();
              }}
            >
              ←
            </button>
          ) : (
            <span />
          )}
          <div className="entry-dots" aria-label={`第 ${step + 1} 步，共 2 步`}>
            <i className={step === 0 ? "on" : ""} />
            <i className={step === 1 ? "on" : ""} />
          </div>
          <button
            className="entry-next"
            type="submit"
            aria-label={step === 0 ? "继续" : "生成星系"}
          >
            →
          </button>
        </div>
      </form>
    </main>
  );
}
