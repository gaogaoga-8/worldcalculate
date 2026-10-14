import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  community,
  MOODS,
  TOPICS,
  type Beacon,
  type Connection,
  type DirectMessage,
  type User,
} from "../community";
import { Nebula } from "./Nebula";

type Mine = Pick<Beacon, "id" | "body" | "mood" | "topic">;
type Surface =
  | { kind: "write" }
  | { kind: "beacon"; beacon: Beacon }
  | { kind: "thread"; thread: Connection }
  | null;
const places = [
  [30, 29],
  [61, 23],
  [74, 48],
  [51, 63],
  [25, 60],
  [43, 42],
  [82, 71],
  [17, 39],
  [64, 80],
];

export function SocialSky({
  name,
  user,
  enter,
  draft = "",
  onHome,
  homeLabel = "回到我的星系",
}: {
  name: string;
  user: User | null;
  enter: (name: string) => Promise<User>;
  draft?: string;
  onHome: () => void;
  homeLabel?: string;
}) {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [threads, setThreads] = useState<Connection[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [surface, setSurface] = useState<Surface>(
    draft ? { kind: "write" } : null,
  );
  const [words, setWords] = useState(draft);
  const [reply, setReply] = useState("");
  const [mood, setMood] = useState<keyof typeof MOODS>("hear");
  const [topic, setTopic] = useState<keyof typeof TOPICS>("anything");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(0);
  const [inboxPage, setInboxPage] = useState(0);
  const card = useRef<HTMLElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const selectedId = surface?.kind === "thread" ? surface.thread.id : null;
  const opened = !!surface;
  const refresh = useCallback(async () => {
    const results = await Promise.all([
      community<{ beacons: Beacon[] }>(`/beacons?mood=${mood}&topic=${topic}`),
      user
        ? community<{ threads: Connection[] }>("/threads")
        : Promise.resolve({ threads: [] }),
      user
        ? community<{ beacon: Mine | null }>("/beacons/mine")
        : Promise.resolve({ beacon: null }),
    ]);
    setBeacons(results[0].beacons);
    setThreads(results[1].threads);
    setMine(results[2].beacon);
    setLoaded(true);
    setLoadError("");
  }, [user, mood, topic]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      refresh().catch((e) => {
        if (alive) setLoadError(e.message);
      });
    const visible = () => {
      if (!document.hidden) void load();
    };
    void load();
    const timer = setInterval(visible, 20000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const load = () =>
      community<{ messages: DirectMessage[]; status: string }>(
        `/threads/${selectedId}`,
      )
        .then((data) => {
          if (alive) {
            setMessages(data.messages);
            setThreadStatus(data.status);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    const visible = () => {
      if (!document.hidden) void load();
    };
    void load();
    const timer = setInterval(visible, 5000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [selectedId]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  useEffect(() => {
    if (!opened) return;
    const root = document.getElementById("root"),
      previous = document.activeElement as HTMLElement | null,
      was = root?.inert || false;
    if (root) root.inert = true;
    card.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSurface(null);
      if (e.key !== "Tab") return;
      const items = Array.from(
        card.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary",
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      if (root) root.inert = was;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [opened]);
  function open(next: Surface) {
    setError("");
    setNotice("");
    setReply("");
    setMessages([]);
    setThreadStatus(next?.kind === "thread" ? next.thread.status : "pending");
    setSurface(next);
  }
  async function act(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时没连上。");
    } finally {
      setBusy(false);
    }
  }
  async function publish(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      if (!user) await enter(name);
      await community("/beacons", "POST", { body: words, mood, topic });
      await refresh();
      setSurface(null);
      setNotice("回声已送出。");
    });
  }
  async function respond(e: FormEvent) {
    e.preventDefault();
    if (surface?.kind !== "beacon") return;
    const beacon = surface.beacon;
    await act(async () => {
      if (!user) await enter(name);
      await community("/respond", "POST", { beaconId: beacon.id, body: reply });
      await refresh();
      setSurface(null);
      setNotice("送到了。等一颗星回应。");
    });
  }
  async function threadAction(action: "accept" | "decline" | "block") {
    if (!selectedId) return;
    await act(async () => {
      await community(`/threads/${selectedId}/${action}`, "POST");
      if (action === "accept") setThreadStatus("accepted");
      else setSurface(null);
      await refresh();
    });
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    await act(async () => {
      await community(`/threads/${selectedId}/messages`, "POST", {
        body: reply,
      });
      setReply("");
      const data = await community<{
        messages: DirectMessage[];
        status: string;
      }>(`/threads/${selectedId}`);
      setMessages(data.messages);
      await refresh();
    });
  }
  const visible = beacons.slice(
    (page % Math.max(1, Math.ceil(beacons.length / 9))) * 9,
    ((page % Math.max(1, Math.ceil(beacons.length / 9))) + 1) * 9,
  );
  const inbox = threads.slice(
    (inboxPage % Math.max(1, Math.ceil(threads.length / 5))) * 5,
    ((inboxPage % Math.max(1, Math.ceil(threads.length / 5))) + 1) * 5,
  );
  return (
    <section className="star-world social-world" aria-label="远方的星空">
      <div className="star-scene social-scene">
        <Nebula />
        <button
          className="cosmos-return"
          onClick={onHome}
          aria-label={homeLabel}
        >
          ←
        </button>
        {visible.map((beacon, i) => (
          <button
            key={beacon.id}
            className="orb echo-star"
            style={{ left: `${places[i][0]}%`, top: `${places[i][1]}%` }}
            aria-label={`听听${beacon.name}的回声`}
            onClick={() => open({ kind: "beacon", beacon })}
          >
            <i />
            <b>{beacon.name}</b>
          </button>
        ))}
        {inbox.map((thread, i) => (
          <button
            key={thread.id}
            className={`orb connection-star ${thread.incoming && thread.status === "pending" ? "calling" : ""}`}
            style={{ left: `${16 + i * 16}%`, top: "13%" }}
            aria-label={`${thread.name}${thread.status === "pending" ? "的回应" : "的聊天"}`}
            onClick={() => open({ kind: "thread", thread })}
          >
            <i />
            <b>
              {thread.name}
              {thread.incoming && thread.status === "pending"
                ? " · 回应你"
                : ""}
            </b>
          </button>
        ))}
        {threads.length > 5 && (
          <button
            className="inbox-next text-action"
            aria-label="更多回应"
            onClick={() => setInboxPage((p) => p + 1)}
          >
            →
          </button>
        )}
        <button
          className="orb my-echo"
          style={{ left: "50%", top: "85%" }}
          aria-label="写下我的回声"
          onClick={() => {
            if (!draft && mine) {
              setWords(mine.body);
              setMood(mine.mood as keyof typeof MOODS);
              setTopic(mine.topic as keyof typeof TOPICS);
            }
            open({ kind: "write" });
          }}
        >
          <i />
          <b>{mine ? "我的回声" : "留一句回声"}</b>
        </button>
        {!beacons.length && (
          <p className="empty-sky" role="status">
            {loadError
              ? "星空暂时没连上"
              : loaded
                ? "这里还很安静"
                : "正在听远方的回声…"}
          </p>
        )}
        {beacons.length > 9 && (
          <button
            className="sky-next text-action"
            onClick={() => setPage((p) => p + 1)}
            aria-label="换一片星空"
          >
            ↻
          </button>
        )}
        {notice && (
          <p className="social-notice" role="status">
            {notice}
          </p>
        )}
        {(loadError || error) && !opened && (
          <div className="social-notice" role="alert">
            {loadError || error}
            <button
              className="text-action"
              onClick={() =>
                void act(async () => {
                  await refresh();
                })
              }
            >
              再试一次
            </button>
          </div>
        )}
      </div>
      {surface &&
        createPortal(
          <div className="star-overlay">
            <button
              className="star-backdrop"
              aria-label="回到远方星空"
              onClick={() => setSurface(null)}
            />
            <section
              ref={card}
              className="star-surface echo-surface"
              role="dialog"
              aria-modal="true"
              aria-label={
                surface.kind === "write"
                  ? "我的回声"
                  : surface.kind === "beacon"
                    ? `${surface.beacon.name}的回声`
                    : `与${surface.thread.name}聊天`
              }
            >
              <header className="star-surface-head">
                <div>
                  <i />
                  <h1>
                    {surface.kind === "write"
                      ? "我的回声"
                      : surface.kind === "beacon"
                        ? surface.beacon.name
                        : surface.thread.name}
                  </h1>
                </div>
                <button
                  className="surface-close"
                  aria-label="关闭回声"
                  onClick={() => setSurface(null)}
                >
                  ×
                </button>
              </header>
              <div className="star-surface-body echo-body">
                {surface.kind === "write" && (
                  <form
                    className="echo-compose"
                    onSubmit={(e) => void publish(e)}
                  >
                    <textarea
                      aria-label="送到远方的一句话"
                      value={words}
                      onChange={(e) => setWords(e.target.value)}
                      placeholder="此刻，你想对一个人说什么？"
                      maxLength={160}
                      required
                      disabled={busy}
                    />
                    <fieldset className="echo-choices">
                      <legend className="sr-only">现在需要什么</legend>
                      {Object.entries(MOODS).map(([value, label]) => (
                        <label
                          key={value}
                          className={mood === value ? "selected" : ""}
                        >
                          <input
                            type="radio"
                            name="mood"
                            value={value}
                            checked={mood === value}
                            onChange={() =>
                              setMood(value as keyof typeof MOODS)
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </fieldset>
                    <label className="echo-topic">
                      <span className="sr-only">回声话题</span>
                      <select
                        value={topic}
                        aria-label="回声话题"
                        onChange={(e) =>
                          setTopic(e.target.value as keyof typeof TOPICS)
                        }
                      >
                        {Object.entries(TOPICS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="echo-footer">
                      <p>只有这句话与称呼会被看见。</p>
                      <button
                        className="entry-next"
                        aria-label="送出回声"
                        disabled={busy || !words.trim()}
                      >
                        {busy ? "…" : "↗"}
                      </button>
                    </div>
                    {mine && (
                      <button
                        type="button"
                        className="text-action recall"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await community("/beacons/mine", "DELETE");
                            setWords("");
                            await refresh();
                            setSurface(null);
                            setNotice("回声已收回。");
                          })
                        }
                      >
                        收回我的回声
                      </button>
                    )}
                  </form>
                )}
                {surface.kind === "beacon" && (
                  <>
                    <p className="echo-words">{surface.beacon.body}</p>
                    <p className="echo-intent">
                      {MOODS[surface.beacon.mood as keyof typeof MOODS]}
                    </p>
                    <form
                      className="composer echo-reply"
                      onSubmit={(e) => void respond(e)}
                    >
                      <input
                        aria-label="回应这句话"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="我想对你说…"
                        maxLength={600}
                        required
                        disabled={busy}
                      />
                      <button
                        className="primary"
                        aria-label="回应这颗星"
                        disabled={busy || !reply.trim()}
                      >
                        {busy ? "…" : "↑"}
                      </button>
                    </form>
                    <p className="quiet-hint">对方也愿意时，你们就可以聊聊。</p>
                  </>
                )}
                {surface.kind === "thread" && (
                  <>
                    <div className="direct-thread" aria-live="polite">
                      {messages.map((message) => (
                        <p
                          key={message.id}
                          className={`bubble ${message.sender === user?.id ? "user" : "guide"}`}
                        >
                          {message.body}
                        </p>
                      ))}
                      <div ref={end} />
                    </div>
                    {threadStatus === "pending" ? (
                      surface.thread.incoming ? (
                        <div className="consent-actions">
                          <button
                            className="ghost"
                            disabled={busy}
                            onClick={() => void threadAction("accept")}
                          >
                            愿意聊聊
                          </button>
                          <button
                            className="text-action"
                            disabled={busy}
                            onClick={() => void threadAction("decline")}
                          >
                            略过
                          </button>
                        </div>
                      ) : (
                        <p className="quiet-hint">回声已送达，等对方接住。</p>
                      )
                    ) : threadStatus === "accepted" ? (
                      <form className="composer" onSubmit={(e) => void send(e)}>
                        <input
                          aria-label="给对方的消息"
                          placeholder="说点什么…"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          maxLength={1000}
                          required
                          disabled={busy}
                        />
                        <button
                          className="primary"
                          aria-label="发送消息"
                          disabled={busy || !reply.trim()}
                        >
                          {busy ? "…" : "↑"}
                        </button>
                      </form>
                    ) : (
                      <p className="quiet-hint">这段回声已经结束。</p>
                    )}
                    <details className="connection-options">
                      <summary>···</summary>
                      <button
                        className="text-action"
                        disabled={busy}
                        onClick={() => void threadAction("block")}
                      >
                        不再遇见这颗星
                      </button>
                    </details>
                  </>
                )}
                {error && (
                  <p className="minimal-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
