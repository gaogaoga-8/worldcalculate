import { useEffect, useRef, useState } from "react";
import { community, type User } from "./community";
export function useGuest() {
  const [user, setUser] = useState<User | null>(null);
  const entered = useRef(false);
  useEffect(() => {
    let mounted = true;
    community<{ user: User | null }>("/session")
      .then((data) => {
        if (mounted && !entered.current) setUser(data.user);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  async function enter(name: string) {
    const result = await community<{ user: User }>("/guest", "POST", { name });
    entered.current = true;
    setUser(result.user);
    return result.user;
  }
  return { user, enter };
}
