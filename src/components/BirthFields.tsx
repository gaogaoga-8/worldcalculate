import { PROVINCES, type RegionCity } from "../places";

export type BirthSelection = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  unknown: boolean;
};
export type LocationSelection = {
  country: string;
  province: string;
  city: string;
};
export const emptyBirth: BirthSelection = {
  year: "",
  month: "",
  day: "",
  hour: "",
  minute: "",
  unknown: false,
};
export const emptyLocation: LocationSelection = {
  country: "",
  province: "",
  city: "",
};

export function daysInMonth(year: string, month: string) {
  return year && month
    ? new Date(Number(year), Number(month), 0).getDate()
    : 31;
}

export function birthError(
  value: BirthSelection,
  now = new Date(),
): string | null {
  const { year, month, day, hour, minute, unknown } = value;
  if (!year || !month || !day) return "请选择完整的出生日期。";
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  if (
    ![y, m, d].every(Number.isInteger) ||
    y < 1901 ||
    y > now.getFullYear() ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > daysInMonth(year, month)
  )
    return "请选择有效的公历日期。";
  if (new Date(y, m - 1, d) > now) return "出生日期不能晚于今天。";
  if (
    !unknown &&
    (hour === "" ||
      minute === "" ||
      !Number.isInteger(Number(hour)) ||
      !Number.isInteger(Number(minute)) ||
      Number(hour) < 0 ||
      Number(hour) > 23 ||
      Number(minute) < 0 ||
      Number(minute) > 59)
  )
    return "请选择完整的出生小时和分钟。";
  return null;
}

export function selectedCity(
  location: LocationSelection,
): RegionCity | undefined {
  if (location.country !== "CN") return;
  return PROVINCES.find((p) => p.code === location.province)?.cities.find(
    (c) => c.code === location.city,
  );
}

export function BirthFields({
  value,
  onChange,
  minimal = false,
}: {
  value: BirthSelection;
  onChange: (value: BirthSelection) => void;
  minimal?: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const days = daysInMonth(value.year, value.month);
  function change(
    key: "year" | "month" | "day" | "hour" | "minute",
    next: string,
  ) {
    const updated = { ...value, [key]: next };
    if (Number(updated.day) > daysInMonth(updated.year, updated.month))
      updated.day = "";
    onChange(updated);
  }
  return (
    <>
      <div className="birth-grid">
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>出生年份</span>
          <select
            required
            aria-label="出生年份"
            value={value.year}
            onChange={(e) => change("year", e.target.value)}
          >
            <option value="">选择年份</option>
            {Array.from(
              { length: currentYear - 1900 },
              (_, i) => currentYear - i,
            ).map((n) => (
              <option key={n} value={n}>
                {n} 年
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>月份</span>
          <select
            required
            aria-label="出生月份"
            value={value.month}
            onChange={(e) => change("month", e.target.value)}
          >
            <option value="">选择月份</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} 月
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>日期</span>
          <select
            required
            aria-label="出生日期"
            value={value.day}
            disabled={!value.year || !value.month}
            onChange={(e) => change("day", e.target.value)}
          >
            <option value="">选择日期</option>
            {Array.from({ length: days }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} 日
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="birth-time">
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>出生小时 · 24 小时制</span>
          <select
            required={!value.unknown}
            aria-label="出生小时"
            value={value.hour}
            disabled={value.unknown}
            onChange={(e) => change("hour", e.target.value)}
          >
            <option value="">{minimal ? "时 · 24 小时制" : "选择小时"}</option>
            {Array.from({ length: 24 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {String(n).padStart(2, "0")} 时
              </option>
            ))}
          </select>
        </label>
        <span className="time-colon">:</span>
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>分钟</span>
          <select
            required={!value.unknown}
            aria-label="出生分钟"
            value={value.minute}
            disabled={value.unknown}
            onChange={(e) => change("minute", e.target.value)}
          >
            <option value="">选择分钟</option>
            {Array.from({ length: 60 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {String(n).padStart(2, "0")} 分
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={value.unknown}
          onChange={(e) => onChange({ ...value, unknown: e.target.checked })}
        />
        {minimal ? "时间不详" : "不确定出生时间"}
      </label>
      {!minimal && (
        <p className="hint">
          使用公历与出生地的当地钟表时间。时间可以精确到分钟。
        </p>
      )}
    </>
  );
}

export function LocationFields({
  value,
  onChange,
  minimal = false,
}: {
  value: LocationSelection;
  onChange: (value: LocationSelection) => void;
  minimal?: boolean;
}) {
  const province = PROVINCES.find((p) => p.code === value.province);
  return (
    <div className="location-fields">
      <label className="field">
        <span className={minimal ? "sr-only" : ""}>国家</span>
        <select
          required
          aria-label="出生国家"
          value={value.country}
          onChange={(e) =>
            onChange({ country: e.target.value, province: "", city: "" })
          }
        >
          <option value="">选择国家</option>
          <option value="CN">中国</option>
        </select>
      </label>
      {value.country && (
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>
            省份 / 自治区 / 直辖市
          </span>
          <select
            required
            aria-label="出生省份"
            value={value.province}
            onChange={(e) =>
              onChange({ ...value, province: e.target.value, city: "" })
            }
          >
            <option value="">选择省份或直辖市</option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {province && (
        <label className="field">
          <span className={minimal ? "sr-only" : ""}>城市 / 地区</span>
          <select
            required
            aria-label="出生城市"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          >
            <option value="">选择城市或地区</option>
            {province.cities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!minimal && (
        <p className="hint">
          目前支持中国大陆。直辖市选择同名城市，自治州、地区与省直辖地区也可选择。
        </p>
      )}
    </div>
  );
}
