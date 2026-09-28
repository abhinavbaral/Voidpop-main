// Horizontal row of cards with ‹ › buttons (a plain mouse wheel can't scroll sideways).
import { useEffect, useRef, useState } from "react";
import Card, { CardSkeleton } from "./Card.jsx";
import Icon from "./Icon.jsx";

export default function PosterRow({ title, items, loading, now }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(measure, [items, loading]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const page = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  if (!loading && !items?.length) return null;
  return (
    <section className="row-section">
      <div className="row-head">
        <h2>{title}</h2>
        <div className="row-arrows desktop-only">
          <button className="round-btn" onClick={() => page(-1)} disabled={!edges.left} aria-label={`Scroll ${title} left`}><Icon name="left" /></button>
          <button className="round-btn" onClick={() => page(1)} disabled={!edges.right} aria-label={`Scroll ${title} right`}><Icon name="right" /></button>
        </div>
      </div>
      <div className="poster-row" ref={ref} onScroll={measure}>
        {loading
          ? Array.from({ length: 7 }, (_, i) => <CardSkeleton key={i} />)
          : items.map((it) => <Card key={`${it.segment}-${it.id}`} item={it} now={now} />)}
      </div>
    </section>
  );
}
