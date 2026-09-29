// VOIDATION WRAPPED — full-screen story slides of your year, ending on a card
// you can share. Tap the right side (or →) for next, left side (or ←) for back.
// Everything comes from your own watch log (shared/wrapped.js).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadWrapped, wrappedSlides, wrappedYears, defaultWrapped } from "@voidation/shared/wrapped";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const BACKGROUNDS = [
  "linear-gradient(160deg,#2a0f4d,#0b0f19 70%)",
  "linear-gradient(160deg,#4a1d0c,#0b0f19 70%)",
  "linear-gradient(160deg,#0f2a4d,#0b0f19 70%)",
  "linear-gradient(160deg,#3d0f2e,#0b0f19 70%)",
];

export default function Wrapped() {
  const navigate = useNavigate();
  const [years, setYears] = useState(["all"]);
  const [year, setYear] = useState(null); // "all" or a year number
  const [w, setW] = useState(null);
  const [i, setI] = useState(0);
  useDocumentTitle(year === "all" ? "Rewind · All time" : `Rewind ${year || ""}`);

  useEffect(() => { wrappedYears().then(setYears); defaultWrapped().then(setYear); }, []);
  useEffect(() => { if (year === null) return; setW(null); setI(0); loadWrapped(year).then(setW); }, [year]);
  const slides = w ? wrappedSlides(w) : [];
  const last = slides.length - 1;
  const go = (d) => setI((x) => Math.max(0, Math.min(last, x + d)));

  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") navigate("/more");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const slide = slides[i];
  return (
    <div className="wrapped" style={{ background: BACKGROUNDS[i % BACKGROUNDS.length] }}>
      <div className="wrapped-top">
        <div className="wrapped-bars">
          {slides.map((_, k) => <span key={k} className={k <= i ? "on" : ""} />)}
        </div>
        <div className="row gap-8">
          <div className="wrapped-years" role="tablist" aria-label="Which Rewind">
            {years.map((y) => (
              <button key={y} role="tab" aria-selected={y === year} className={y === year ? "on" : ""}
                onClick={() => setYear(y)}>{y === "all" ? "All time" : y}</button>
            ))}
          </div>
          <button className="wrapped-close" onClick={() => navigate("/more")} aria-label="Close">✕</button>
        </div>
      </div>
      {!w ? <div className="spinner" aria-label="Loading" /> : (
        <>
          {slide.kind !== "summary" && (
            <>
              <button className="tap-zone left" aria-label="Previous" onClick={() => go(-1)} />
              <button className="tap-zone right" aria-label="Next" onClick={() => go(1)} />
            </>
          )}
          <div className="wrapped-slide" key={`${year}-${i}`}>
            {slide.kind === "summary" ? <Summary w={w} onBack={() => go(-1)} onRestart={() => setI(0)} /> : <Slide s={slide} />}
          </div>
        </>
      )}
    </div>
  );
}

function Slide({ s }) {
  return (
    <div className="ws">
      {s.eyebrow && <div className="ws-eyebrow">{s.eyebrow}</div>}
      {s.kind === "list" ? (
        <>
          {s.image && <img className="ws-hero" src={s.image} alt="" />}
          <ol className="ws-list">
            {s.items.map(({ item, count, note }, n) => (
              <li key={item.id}>
                <span className="ws-rank">{n + 1}</span>
                {item.image && <img src={item.image} alt="" />}
                <span className="grow"><b>{item.title}</b><span>{count ? `${count} ${s.unit}` : s.unit === "chapters" ? "Finished" : "Completed"}{note ? ` · ${note}` : ""}</span></span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="ws-big" style={s.color ? { color: s.color } : undefined}>{s.big}</div>
      )}
      {s.rows && (
        <ul className="ws-rows">
          {s.rows.map(([label, value]) => (
            <li key={label}>
              <span>{s.colors?.[label] && <i style={{ background: s.colors[label] }} />}{label}</span><b>{value}</b>
            </li>
          ))}
        </ul>
      )}
      {s.sub && <p className="ws-sub">{s.sub}</p>}
    </div>
  );
}

// The shareable card: your #1 anime's poster, top 5, top genre, episodes, hours.
function Summary({ w, onBack, onRestart }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("");
  const hero = w.topAnime[0]?.item || w.topManga[0]?.item;
  const list = w.topAnime.length ? w.topAnime : w.topManga;

  const share = async () => {
    setStatus("Preparing…");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(ref.current, { useCORS: true, backgroundColor: null, scale: Math.min(window.devicePixelRatio || 1, 3) });
      const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
      const file = new File([blob], `voidation-wrapped-${w.allTime ? "all-time" : w.year}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `My Voidation Rewind · ${w.label}` }); setStatus(""); return; }
        catch (e) { if (e?.name === "AbortError") { setStatus(""); return; } }
      }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Image downloaded.");
    } catch {
      setStatus("Couldn't create the image. Try again.");
    }
  };

  return (
    <div className="ws summary">
      <div className="wrapped-card" ref={ref}>
        <div className="wc-hero">
          <span className={`wc-year${w.allTime ? " small" : ""}`}>{w.label}</span>
          {hero?.image && <img src={hero.image} alt="" crossOrigin="anonymous" />}
        </div>
        <div className="wc-body">
          <div className="wc-cols">
            <div>
              <small>{w.topAnime.length ? "Top anime" : "Top manga"}</small>
              <ol>{list.map(({ item }) => <li key={item.id}>{item.title}</li>)}</ol>
            </div>
            <div>
              <small>Top genres</small>
              <ol>{w.genres.slice(0, 5).map((g) => <li key={g.name}>{g.name}</li>)}</ol>
            </div>
          </div>
          <div className="wc-cols">
            <div><small>{w.episodes ? "Episodes watched" : "Chapters read"}</small><b>{(w.episodes || w.chapters).toLocaleString()}</b></div>
            <div>
              <small>{w.allTime || !w.episodes ? "Completed & finished" : w.minutes < 90 ? "Minutes" : "Hours"}</small>
              <b>{w.allTime || !w.episodes ? w.completed.toLocaleString() : w.minutes < 90 ? Math.round(w.minutes) : w.hours.toLocaleString()}</b>
            </div>
          </div>
          <div className="wc-brand">VOID<span>ATION</span> · REWIND</div>
        </div>
      </div>
      <div className="row gap-8 wrap" style={{ justifyContent: "center" }}>
        <button className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn ghost" onClick={onRestart}>Watch again</button>
        <button className="btn primary" onClick={share}>Share image</button>
      </div>
      {status && <p className="ws-sub" role="status">{status}</p>}
    </div>
  );
}
