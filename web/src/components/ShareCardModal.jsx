// Share your review as an image: renders a branded card, captures it with
// html2canvas, then uses the Web Share API (phones) or downloads the PNG.
import { useRef, useState } from "react";
import { VERDICTS } from "@voidation/shared/backend/store";
import Modal from "./Modal.jsx";

export default function ShareCardModal({ open, item, review, onClose }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("");
  const verdict = VERDICTS.find((v) => v.key === review?.verdict);
  if (!review) return null;

  const share = async () => {
    setStatus("Preparing…");
    try {
      // loaded on demand: ~200 KB nobody needs until they share
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(ref.current, { useCORS: true, backgroundColor: null, scale: Math.min(window.devicePixelRatio || 1, 3) });
      const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
      const file = new File([blob], "voidation-review.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "My Voidation verdict" }); setStatus(""); return; }
        catch (e) { if (e?.name === "AbortError") { setStatus(""); return; } }
      }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: "voidation-review.png" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Image downloaded.");
    } catch {
      setStatus("Couldn't create the image. Try again.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} label="Share your review" className="share-modal">
      <div className="share-card" ref={ref}>
        <div className="row gap-12">
          {item.image && <img src={item.image} alt="" crossOrigin="anonymous" />}
          <div className="grow">
            <div className="share-title">{item.title}</div>
            <div className="share-user">My verdict</div>
            {verdict && <span className="verdict" style={{ background: verdict.color }}>{verdict.label}</span>}
          </div>
        </div>
        {!!review.comment && <p className="share-comment">“{review.comment}”</p>}
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
