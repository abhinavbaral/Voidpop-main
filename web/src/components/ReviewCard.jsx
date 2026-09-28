// Your verdict on a title (Voidation has no public reviews: this is yours alone).
import { VERDICTS, timeAgo } from "@voidation/shared/backend/store";
import Icon from "./Icon.jsx";

export default function ReviewCard({ review, onEdit, onShare }) {
  const verdict = VERDICTS.find((v) => v.key === review.verdict);
  return (
    <article className="review">
      <header>
        <div className="grow">
          <b>Your verdict</b>
          <time className="faint small" dateTime={review.date}> · {timeAgo(review.date)}</time>
        </div>
        {onEdit && <button className="btn ghost sm" onClick={onEdit}>Edit</button>}
        {onShare && <button className="btn ghost sm" onClick={onShare}><Icon name="share" size={14} /> Share</button>}
      </header>
      <div className="chips">
        {verdict && <span className="verdict" style={{ background: verdict.color }}>{verdict.label}</span>}
        {(review.vibes || []).map((v) => <span key={v} className="chip-static">{v}</span>)}
      </div>
      {!!review.comment && <p className="review-text">{review.comment}</p>}
    </article>
  );
}
