export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
