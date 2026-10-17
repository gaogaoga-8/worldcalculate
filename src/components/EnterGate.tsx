import { useState } from "react";
import { openStar, returnStar } from "../account";
import { StarClaim } from "./StarClaim";

export function EnterGate({
  onOpened,
  onReturned,
}: {
  onOpened: () => void;
  onReturned: () => void;
}) {
  const [intent, setIntent] = useState<"open" | "return">("open");
  return (
    <main className="intake constellation-intake" aria-label="登录">
      <p className="intake-hint">
        <span>{intent === "open" ? "新的星，先留下名字" : "认回已经留下的星"}</span>
      </p>
      <StarClaim
        key={intent}
        intent={intent === "open" ? "keep" : "return"}
        required
        alternate={{
          label: intent === "open" ? "认回这颗星" : "我是新的",
          onClick: () => setIntent(intent === "open" ? "return" : "open"),
        }}
        onClose={() => {}}
        onSubmit={async (name, secret) => {
          if (intent === "open") {
            await openStar(name, secret);
            onOpened();
          } else {
            await returnStar(name, secret);
            onReturned();
          }
        }}
      />
    </main>
  );
}
