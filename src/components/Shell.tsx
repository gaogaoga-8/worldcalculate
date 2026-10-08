import { Capacitor } from "@capacitor/core";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  hydrate,
  isPerson,
  replaceState,
  resetState,
  hasResetBackup,
  restoreResetBackup,
  updateState,
  useAppState,
  type AppState,
} from "../store";
import { musicOn, subscribeMusic, toggleMusic } from "../bgm";
import { readModel, writeModel, type ModelLink } from "../oracle/settings";

export type ViewId = "self" | "connect";

type Props = {
  mode: "intake" | "desk";
  forming?: boolean;
  view?: ViewId;
  onReplay?: () => void;
  onEdit?: () => void;
  children: ReactNode;
};

export function Shell({
  mode,
  forming = false,
  onReplay,
  onEdit,
  children,
}: Props) {
  const state = useAppState();
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [model, setModel] = useState<ModelLink>(() => readModel());
  const [music, setMusic] = useState(musicOn);
  const onPhone = Capacitor.isNativePlatform();
  useEffect(() => subscribeMusic(setMusic), []);

  return (
    <div className={`desktop${forming ? " scene-forming" : ""}`}>
      <Sky />
      <header
        className="topbar"
        inert={forming}
        aria-hidden={forming || undefined}
      >
        <div className="brand">
          <i className="mark" />
          <b>世界算法</b>
        </div>
        <div className="menu-wrap">
          <button
            className={`icon-btn music-toggle${music ? "" : " off"}`}
            type="button"
            aria-pressed={music}
            aria-label={music ? "关闭音乐" : "打开音乐"}
            onClick={() => void toggleMusic()}
          >
            ♪
          </button>
          <button
            className="icon-btn"
            onClick={() => setMenu((v) => !v)}
            aria-label="菜单"
          >
            ···
          </button>
          {menu && (
            <>
              <button
                className="scrim"
                aria-label="关闭菜单"
                onClick={() => setMenu(false)}
              />
              <div className="menu">
                <p>子时</p>
                <button
                  className={state.settings.ziHour === "early" ? "on" : ""}
                  onClick={() => updateState({ settings: { ziHour: "early" } })}
                >
                  早子时 · 二十三点换日
                </button>
                <button
                  className={state.settings.ziHour === "late" ? "on" : ""}
                  onClick={() => updateState({ settings: { ziHour: "late" } })}
                >
                  晚子时 · 零点换日
                </button>
                {mode === "desk" && (
                  <>
                    <p>星图</p>
                    <button
                      onClick={() => {
                        setMenu(false);
                        onReplay?.();
                      }}
                    >
                      重看星图
                    </button>
                    <button
                      onClick={() => {
                        setMenu(false);
                        onEdit?.();
                      }}
                    >
                      重新录入
                    </button>
                    <button onClick={exportJson}>导出</button>
                    <label className="file">
                      导入
                      <input
                        ref={fileRef}
                        hidden
                        type="file"
                        accept="application/json"
                        onChange={(e) => void importJson(e, setNotice)}
                      />
                    </label>
                  </>
                )}
                <p>本机</p>
                <p>模型</p>
                <label className="model-field">
                  接口
                  <input
                    value={model.baseUrl}
                    onChange={(event) =>
                      setModel({ ...model, baseUrl: event.target.value })
                    }
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
                <label className="model-field">
                  模型
                  <input
                    value={model.model}
                    onChange={(event) =>
                      setModel({ ...model, model: event.target.value })
                    }
                    placeholder="模型名"
                  />
                </label>
                <label className="model-field">
                  密钥
                  <input
                    value={model.apiKey}
                    onChange={(event) =>
                      setModel({ ...model, apiKey: event.target.value })
                    }
                    type="password"
                    placeholder={onPhone ? "必填" : "留空则用本机 Cursor"}
                  />
                </label>
                <button
                  onClick={() => {
                    writeModel(model);
                    setNotice(
                      onPhone
                        ? "模型接口已记在这台手机。"
                        : "模型接口已记在这台浏览器。",
                    );
                  }}
                >
                  记下接口
                </button>
                <p className="model-hint">
                  {onPhone
                    ? "问事要填你自己的接口、模型和密钥，三项都记下才能问。密钥不进星图导出。"
                    : "给别人用时，他们填自己的接口、模型和密钥。三项都留空，调试就走本机的 Cursor。密钥不进星图导出。"}
                </p>
                <button
                  onClick={() => {
                    if (!confirmClear) {
                      setConfirmClear(true);
                      return;
                    }
                    try {
                      resetState();
                    } catch {
                      setNotice(
                        "无法保存备份，记录没有清空。请检查浏览器存储。 ",
                      );
                      return;
                    }
                    setMenu(false);
                    setConfirmClear(false);
                  }}
                >
                  {confirmClear ? "再点一次，清除本机记录" : "清除本机记录"}
                </button>
                {hasResetBackup() && (
                  <button
                    onClick={() => {
                      try {
                        if (restoreResetBackup()) {
                          setMenu(false);
                          onReplay?.();
                        } else setNotice("没有可恢复的备份。");
                      } catch {
                        setNotice("备份暂时无法恢复。");
                      }
                    }}
                  >
                    恢复上次清空前的记录
                  </button>
                )}
                {notice && <p>{notice}</p>}
              </div>
            </>
          )}
        </div>
      </header>
      {mode === "desk" ? (
        <div className="workspace">
          <div className="stage">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function exportJson() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          state: JSON.parse(localStorage.getItem("shijie-suanfa/v1") || "{}")
            .state,
        },
        null,
        2,
      ),
    ],
    {
      type: "application/json",
    },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "世界算法-星图.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importJson(
  event: ChangeEvent<HTMLInputElement>,
  setNotice: (value: string) => void,
) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()) as {
      version?: number;
      state?: AppState;
    };
    if (
      data.version !== 1 ||
      !data.state ||
      (data.state.self && !isPerson(data.state.self))
    ) {
      setNotice("这个文件读不了。");
      return;
    }
    const people = Array.isArray(data.state.people)
      ? data.state.people.filter(isPerson)
      : [];
    replaceState(
      hydrate({ ...data.state, self: data.state.self ?? null, people }),
    );
    setNotice("已导入。");
  } catch {
    setNotice("这个文件读不了。");
  }
}

function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.7 + 0.15,
      a: Math.random() * 0.28 + 0.04,
    }));
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        ctx.fillStyle = `rgba(255,255,255,${star.a})`;
        ctx.beginPath();
        ctx.arc(
          star.x * canvas.width,
          star.y * canvas.height,
          star.r * dpr,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);
  return <canvas ref={ref} className="sky" />;
}
