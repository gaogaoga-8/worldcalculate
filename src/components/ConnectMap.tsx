import type { Chart } from "../bazi/chart";
import { useGuest } from "../guest";
import { SocialSky } from "./SocialSky";

export function ConnectMap({
  chart: _chart,
  onOpenSelf,
  draft = "",
  onDraftUsed,
}: {
  chart: Chart;
  onOpenSelf: () => void;
  draft?: string;
  onDraftUsed?: () => void;
}) {
  const guest = useGuest();
  return (
    <section className="panel world-echo">
      <SocialSky
        user={guest.user}
        draft={draft}
        homeLabel="回到星图"
        onHome={() => {
          onDraftUsed?.();
          onOpenSelf();
        }}
      />
    </section>
  );
}
