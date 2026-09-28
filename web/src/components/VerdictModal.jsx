// "How was it?" — verdict + up to 3 vibes + optional comment (same rules as the app).
import { useState } from "react";
import { VERDICTS, VIBES } from "@voidation/shared/backend/store";
import Modal from "./Modal.jsx";

export default function VerdictModal({ open, initial, onSave, onClose }) {
  const [verdict, setVerdict] = useState(initial?.verdict || null);
  const [vibes, setVibes] = useState(initial?.vibes || []);
  const [comment, setComment] = useState(initial?.comment || "");
  const [saving, setSaving] = useState(false);

  const toggleVibe = (v) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].slice(-3)));

  const save = async () => {
    setSaving(true);
    try { await onSave({ verdict, vibes, comment: comment.trim() }); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} label="Your verdict">
      <h2>How was it?</h2>
      <p className="muted">Your verdict — no boring numbers.</p>
      <div className="verdict-grid">
        {VERDICTS.map((v) => (
          <button key={v.key} className={`verdict-opt${verdict === v.key ? " on" : ""}`}
            style={verdict === v.key ? { background: v.color, borderColor: v.color } : null}
            onClick={() => setVerdict(v.key)} aria-pressed={verdict === v.key}>
            {v.label}
          </button>
        ))}
      </div>
      <p className="muted mt-16">What was the vibe? (pick up to 3)</p>
      <div className="chips">
        {VIBES.map((v) => (
          <button key={v} className={`chip${vibes.includes(v) ? " on" : ""}`} onClick={() => toggleVibe(v)} aria-pressed={vibes.includes(v)}>
            {v}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="verdict-comment">Comment</label>
      <textarea id="verdict-comment" className="input mt-16" rows={4} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Tell people about the experience (optional)…" />
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!verdict || saving} onClick={save}>{saving ? "Saving…" : "Save verdict"}</button>
      </div>
    </Modal>
  );
}
