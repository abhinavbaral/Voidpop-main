// Rank-up celebration: when you reach a new rank ("You are an Elite"), a
// full-screen medal pops in with a glow and confetti. Shown once per rank.
import { useCallback, useEffect, useState } from "react";
import { checkRankUp, markRankSeen, onDataChange, onCelebrate, TIERS } from "@voidation/shared/backend/store";
import Icon from "./Icon.jsx";

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.12,
  dur: 1.6 + ((i * 13) % 10) / 10,
  color: ["#a855f7", "#ee8f2e", "#22d3ee", "#10b981", "#f43f5e", "#f59e0b"][i % 6],
  rot: (i * 47) % 360,
}));

export default function RankUp() {
  const [tier, setTier] = useState(null);
  const check = useCallback(() => { checkRankUp().then((t) => t && setTier(t)).catch(() => {}); }, []);
  useEffect(() => { check(); return onDataChange(check); }, [check]);
  useEffect(() => onCelebrate(setTier), []); // replay from More → Your badge

  const close = async () => { await markRankSeen(tier.key); setTier(null); };
  useEffect(() => {
    if (!tier) return undefined;
    const key = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!tier) return null;

  const rank = TIERS.findIndex((t) => t.key === tier.key) + 1;
  const addict = tier.key === "addicted";
  return (
    <div className="rankup" role="dialog" aria-modal="true" aria-labelledby="rankup-title" style={{ "--tier": tier.color }}>
      <div className="rankup-confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i key={i} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }} />
        ))}
      </div>
      <div className="rankup-body">
        <div className="rankup-eyebrow">New rank · {rank} of {TIERS.length}</div>
        <div className="medal" aria-hidden="true">
          <div className="medal-ring" />
          <div className="medal-face">
            <span className="medal-star"><Icon name={addict ? "coffee" : "star"} size={34} fill={!addict} /></span>
            <b>{tier.label}</b>
            <small>{tier.min}+ titles</small>
          </div>
          <div className="medal-shine" />
        </div>
        <h2 id="rankup-title">{tier.title}</h2>
        <p>{tier.message}</p>
        <button className="btn primary" autoFocus onClick={close}>{addict ? "Okay, break time" : "Let's go"}</button>
      </div>
    </div>
  );
}
