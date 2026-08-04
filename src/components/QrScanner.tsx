import { useEffect, useRef } from "react";

/**
 * Camera-based QR scanner using html5-qrcode. Dynamically imported after mount
 * so the SSR/build never pulls the browser-only library.
 */
export function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused?: boolean }) {
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<any>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (!paused) onScan(decodedText);
          },
          () => {},
        );
        startedRef.current = true;
      } catch (err) {
        console.error("QR scanner error", err);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && startedRef.current) {
        s.stop().catch(() => {}).finally(() => s.clear());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-black">
      <div id={containerId} className="min-h-[200px] w-full sm:min-h-[280px]" />
    </div>
  );
}
