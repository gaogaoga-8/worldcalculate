import { useEffect, useState } from "react";
import { community, type User } from "./community";

/** 只认已经留下暗语的会话；不再创建游客。 */
export function useGuest() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let mounted = true;
    community<{ user: (User & { login?: boolean }) | null }>("/session")
      .then((data) => {
        if (!mounted) return;
        if (data.user?.login) setUser({ id: data.user.id, name: data.user.name });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  async function enter(_name: string): Promise<User> {
    throw new Error("请先留下名字和暗语。");
  }
  return { user, enter };
}
