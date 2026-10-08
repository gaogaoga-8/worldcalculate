export const FORMATION_MS = 7600;

export const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
export function easeBetween(value: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  // Zero velocity and acceleration at both ends: the release settles without a snap.
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function formationPose(progress: number, width: number, height: number) {
  const arrival = easeBetween(progress, 0.24, 0.87);
  const distance = Math.min(width * 0.28, height * 0.44);
  const arc = arrival === 1 ? 0 : Math.sin(arrival * Math.PI);
  return {
    x: distance * (0.4 * (1 - arrival) + arc * 0.065),
    y: distance * (-0.15 * (1 - arrival) - arc * 0.07),
    size: mix(3, 8, easeBetween(progress, 0.38, 0.88)),
    opacity: mix(0.62, 1, easeBetween(progress, 0.34, 0.86)),
    label: easeBetween(progress, 0.85, 0.97),
    release: easeBetween(progress, 0.06, 0.8),
  };
}

export type DustSeed = {
  radius: number;
  angle: number;
  scatterX: number;
  scatterY: number;
  phase: number;
  depth: number;
};
export function dustPosition(
  star: DustSeed,
  progress: number,
  time: number,
  width: number,
  height: number,
) {
  const release = easeBetween(
    progress,
    0.06 + star.radius * 0.09,
    0.73 + star.radius * 0.06,
  );
  const scale = Math.min(width * 0.29, height * 0.43);
  const angle = star.angle + release * 0.32;
  const radius = scale * (0.08 + star.radius * 0.78);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * 0.36;
  const initialX = x * 0.97 + y * 0.24;
  const initialY = -x * 0.24 + y * 0.97;
  const curl = Math.sin(release * Math.PI) * scale * 0.1;
  return {
    x:
      mix(initialX, star.scatterX * width * 0.57, release) +
      Math.cos(star.angle + 0.8) * curl +
      Math.sin(time * 0.07 + star.phase) * star.depth * 2 * release,
    y:
      mix(initialY, star.scatterY * height * 0.54, release) +
      Math.sin(star.angle + 0.8) * curl * 0.45 +
      Math.cos(time * 0.06 + star.phase) * star.depth * 1.4 * release,
    release,
  };
}
