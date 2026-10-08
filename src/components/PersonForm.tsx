import { useState } from "react";
import type { Gender, Person } from "../types";
import {
  BirthFields,
  LocationFields,
  birthError,
  emptyBirth,
  emptyLocation,
  selectedCity,
} from "./BirthFields";

type Props = {
  requireName?: boolean;
  submitLabel: string;
  initialName?: string;
  onSubmit: (person: Person) => void;
};
export function PersonForm({
  requireName,
  submitLabel,
  initialName = "",
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [gender, setGender] = useState<Gender | "">("");
  const [birth, setBirth] = useState({ ...emptyBirth });
  const [location, setLocation] = useState({ ...emptyLocation });
  const [error, setError] = useState("");
  function submit() {
    const fault = birthError(birth);
    if (requireName && !name.trim()) {
      setError("先写一个名字，方便以后对照。");
      return;
    }
    if (!gender) {
      setError("请选择性别。");
      return;
    }
    if (fault) {
      setError(fault);
      return;
    }
    const city = selectedCity(location);
    if (!city) {
      setError("请依次选择国家、省份和城市。");
      return;
    }
    setError("");
    onSubmit({
      id: crypto.randomUUID(),
      name: name.trim() || "未名",
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
      mbti: null,
    });
  }
  return (
    <div className="form">
      <label className="field">
        怎么称呼
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder={requireName ? "对方的名字" : "可以留空"}
        />
      </label>
      <label className="field">
        性别
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
        >
          <option value="">请选择</option>
          <option value="male">男</option>
          <option value="female">女</option>
        </select>
      </label>
      <BirthFields value={birth} onChange={setBirth} />
      <LocationFields value={location} onChange={setLocation} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="primary" onClick={submit}>
        {submitLabel}
      </button>
    </div>
  );
}
