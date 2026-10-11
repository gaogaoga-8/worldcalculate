export type User = { id: string; name: string };
export type Beacon = {
  id: string;
  userId: string;
  name: string;
  body: string;
  mood: string;
  topic: string;
  at: number;
};
export type Connection = {
  id: string;
  name: string;
  otherId: string;
  status: "pending" | "accepted";
  incoming: boolean;
  at: number;
};
export type DirectMessage = {
  id: string;
  sender: string;
  body: string;
  at: number;
};
export const MOODS = {
  hear: "想被听见",
  listen: "愿意听你说",
  together: "一起做点事",
};
export const TOPICS = {
  life: "生活",
  work: "工作",
  relationship: "关系",
  study: "学业",
  anything: "随便聊聊",
};
export async function community<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/community${path}`, {
    method,
    credentials: "same-origin",
    headers:
      method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "这片星空暂时没连上。" }));
  if (!response.ok) throw new Error(data.error || "暂时没连上，再试一次。");
  return data as T;
}
