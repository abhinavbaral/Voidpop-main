// Share a countdown as an image: "Solo Leveling · Episode 7 · in 2d 4h".
// Same capture/share path as the verdict card (ShareCardModal).
import { useRef, useState } from "react";
import { formatCountdown, shareAirTime } from "@voidation/shared/format";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import Modal from "./Modal.jsx";

export default function CountdownShareModal({ open, item, next, onClose }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("");
  const { clock24 } = useSettings().settings;
  if (!next) return null;

  const share = async () => {
    setStatus("Preparing…");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(ref.current, { useCORS: true, backgroundColor: null, scale: Math.min(window.devicePixelRatio || 1, 3) });
      const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
      const file = new File([blob], "voidation-countdown.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${item.title}: episode ${next.episode}` }); setStatus(""); return; }
        catch (e) { if (e?.name === "AbortError") { setStatus(""); return; } }
      }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: "voidation-countdown.png" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Image downloaded.");
    } catch {
      setStatus("Couldn't create the image. Try again.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} label="Share countdown" className="share-modal">
      <div className="share-card countdown-card" ref={ref}>
        <div className="row gap-12">
          {item.image && <img src={item.image} alt="" crossOrigin="anonymous" />}
          <div className="grow">
            <div className="share-title">{item.title}</div>
            <div className="share-user">Episode {next.episode}{item.episodes ? ` of ${item.episodes}` : ""}</div>
            <div className="share-countdown">{formatCountdown(next.airingAt)}</div>
            <div className="share-user">{shareAirTime(next.airingAt, clock24)}</div>
          </div>
        </div>
        <div className="share-brand">VOID<b>ATION</b></div>
      </div>
      <div className="modal-actions">
        <span className="faint small grow" role="status">{status}</span>
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={share}>Share image</button>
      </div>
    </Modal>
  );
}
