import { ageMonths, formatWhen, type Chart } from "../bazi/chart";
import { BRANCHES, BRANCH_ELEMENT, ELEMENTS, STEMS, stemElement } from "../bazi/ganzhi";
import { knowledgePack } from "../knowledge/pack";

export function ChartView({ chart, ziHour, embedded }: { chart: Chart; ziHour: "early" | "late"; embedded?: boolean }) {
  const months = ageMonths(chart.person, new Date());
  const current = [...chart.dayun.steps].reverse().find((step) => months >= step.startAgeMonths);
  const note = knowledgePack.stems[STEMS[chart.dayMaster]];
  const delta = chart.solar.correctionMinutes;
  const sign = delta >= 0 ? "+" : "−";

  const body = (
    <>
      <div className="chart-top">
          <div className="pillars">
            {chart.pillars.map((pillar) => (
              <article key={pillar.key} className={pillar.key === "day" ? "pillar day" : "pillar"}>
                <div className="role">{pillar.label} · {pillar.stemGod}</div>
                {pillar.missing ? (
                  <div className="unknown">时辰未知</div>
                ) : (
                  <>
                    <div className={`glyph el-${ELEMENTS[stemElement(pillar.stem)]}`}>{STEMS[pillar.stem]}</div>
                    <div className={`glyph el-${ELEMENTS[BRANCH_ELEMENT[pillar.branch]]}`}>{BRANCHES[pillar.branch]}</div>
                    <div className="nayin">{pillar.nayin}</div>
                    <div className="hidden">
                      {pillar.hidden.map((item) => (
                        <div key={item.stem} className="hidden-line">
                          {STEMS[item.stem]} {item.god}
                        </div>
                      ))}
                    </div>
                    <div className="stage">{pillar.stage}</div>
                  </>
                )}
              </article>
            ))}
          </div>
          <aside className="side">
            <h2>{STEMS[chart.dayMaster]}{ELEMENTS[stemElement(chart.dayMaster)]}</h2>
            <p className="sub">{chart.dayMasterLabel} · 月令{BRANCHES[chart.monthBranch]} · 估算{chart.strength.label}</p>
            <div className="bars">
              {chart.elements.map((item) => (
                <div key={item.name} className="bar-line">
                  <span className={`el-${item.name}`}>{item.name}</span>
                  <div className="track"><i className={`fill-${item.name}`} style={{ width: `${Math.min(100, item.ratio * 100)}%` }} /></div>
                  <span>{item.value.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <p className="note">
              同党 {chart.strength.self.toFixed(1)} · 异党 {chart.strength.other.toFixed(1)}。权重：天干 1，藏干本气 1、中气 0.6、余气 0.3，月令再乘 1.5。节气时刻通常精确到数分钟。
              <br />
              上一节 {chart.prevTerm.name} {formatWhen(chart.prevTerm.utc, chart.person.place.timezone)}
              <br />
              下一节 {chart.nextTerm.name} {formatWhen(chart.nextTerm.utc, chart.person.place.timezone)}
              <br />
              旬空 {BRANCHES[chart.voidBranch[0]]}{BRANCHES[chart.voidBranch[1]]}
              {note ? <><br />{note}</> : null}
            </p>
          </aside>
        </div>
        <div className="dayun-head">
          <span>{chart.dayun.yangYear ? "阳年" : "阴年"} · {chart.person.gender === "male" ? "男" : "女"} · {chart.dayun.forward ? "顺排" : "逆排"} · 约 {chart.dayun.startYears} 岁 {chart.dayun.startMonths} 个月起运</span>
          <span>流年 {chart.flowYear}</span>
        </div>
        <div className="dayun-wrap">
          <div className="dayun">
            {chart.dayun.steps.map((step) => (
              <div key={step.text + step.startYear} className={current?.text === step.text && current.startYear === step.startYear ? "step now" : "step"}>
                <b>{step.text}</b>
                <small>{ageText(step.startAgeMonths)}</small>
                <small>{step.startYear}</small>
              </div>
            ))}
          </div>
        </div>
      <footer className="status">
        <span>{chart.monthLabel}</span>
        <span>
          {chart.solar.trueLabel ? `真太阳 ${chart.solar.trueLabel} · ${sign}${Math.abs(delta).toFixed(1)} 分` : "时辰未记"}
          {" · "}
          {ziHour === "early" ? "早子时" : "晚子时"}
          {chart.solar.shifted ? " · 日柱已进" : ""}
        </span>
      </footer>
    </>
  );
  if (embedded) return <div className="chart-embed">{body}</div>;
  return (
    <section className="panel">
      <header className="panel-head">
        <h1>命盘</h1>
        <span>{chart.person.name} · {chart.person.place.name}</span>
      </header>
      <div className="panel-body">{body}</div>
    </section>
  );
}

function ageText(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}岁${rest}个月` : `${years}岁`;
}
