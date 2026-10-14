import type { Chart } from "../bazi/chart";
import { useGuest } from "../guest";
import { SocialSky } from "./SocialSky";

export function ConnectMap({
  chart,
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
        name={chart.person.name}
        user={guest.user}
        enter={guest.enter}
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
