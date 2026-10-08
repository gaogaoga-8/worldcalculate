import { useEffect, useRef } from "react";
import { toCanvas } from "qrcode";

export function QrMark({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    void toCanvas(canvas, text, {
      margin: 1,
      width: 220,
      color: { dark: "#f4f4f4", light: "#141414" },
    });
  }, [text]);
  return <canvas ref={ref} className="qr-mark" />;
}
