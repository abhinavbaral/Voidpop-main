// TITLE PAGE — /title/:segment/:id. Linkable, refresh-safe.
// Trailer / banner, poster, creator, release, next-episode countdown,
// tracking, your verdict, seasons / related entries.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import {
  statusesFor, getStatus, setStatus, addReview, getMyReview, getExcited, toggleExcited,
  getEntry, setProgress, noteAiring,
} from "@voidation/shared/backend/store";
import ProgressStepper from "../components/Progress.jsx";
import { fetchAniListDetail, fetchNextEpisodes, fetchAniListItem } from "@voidation/shared/api/anilist";
import { releaseLabel, formatCountdown, dayLabel, airTime } from "@voidation/shared/format";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import ReviewCard from "../components/ReviewCard.jsx";
import VerdictModal from "../components/VerdictModal.jsx";
import ShareCardModal from "../components/ShareCardModal.jsx";
import PosterRow from "../components/PosterRow.jsx";
import Modal from "../components/Modal.jsx";
import Icon from "../components/Icon.jsx";
import { SEGMENTS, SEGMENT_LABEL, CREATOR_LABEL, loadTitle, cachedTitle, cacheTitle } from "../lib/titles.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

export default function Title() {
  const { segment, id } = useParams();
  const [item, setItem] = useState(() => cachedTitle(segment, id));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    const hit = cachedTitle(segment, id);
    setItem(hit);
    if (hit && !hit.partial) return;
    if (!SEGMENTS.includes(segment)) { setFailed(true); return; }
    // imported titles have no synopsis or creator yet: show what we have, then fill in
    (hit ? fetchAniListItem(segment, id).then((it) => { if (it) cacheTitle(it); return it || hit; }) : loadTitle(segment, id))
      .then((it) => alive && (it ? setItem(it) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [segment, id]);

  useDocumentTitle(item?.title || (failed ? "Not found" : null));

  if (failed) {
    return (
      <div className="center-page">
        <h1>Title not found</h1>
        <p className="muted">This link may be broken, or the title was removed from its source.</p>
        <Link to="/" className="btn primary">Back to Explore</Link>
      </div>
    );
  }
  if (!item) return <div className="center-page"><div className="spinner" aria-label="Loading" /></div>;
  return <TitleBody key={`${item.segment}:${item.id}`} item={item} />;
}

function TitleBody({ item }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const creator = item.creator;
  const now = useNow(1000);
  const { clock24 } = useSettings().settings;

  const [status, setStatusState] = useState(null);
  const [nextEpisode, setNextEpisode] = useState(item.nextEpisode || null);
  const [myReview, setMyReview] = useState(null);
  const [isExcited, setIsExcited] = useState(false);
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [trailer, setTrailer] = useState(null);
  const [related, setRelated] = useState([]);
  const [watch, setWatch] = useState([]);
  const [progress, setProgressState] = useState(0);
  const [delay, setDelay] = useState(null);
  const refresh = useCallback(async () => {
    const entry = await getEntry(item.segment, item.id);
    setProgressState(entry?.progress || 0);
    setDelay(entry?.delay?.episode === (entry?.item.nextEpisode?.episode) ? entry.delay : null);
    setStatusState(await getStatus(user, item.segment, item.id));
    setMyReview(await getMyReview(user, item.segment, item.id));
    if (item.unreleased) setIsExcited(!!(await getExcited(user))[`${item.segment}:${item.id}`]);
  }, [user, item]);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchAniListDetail(item.segment, item.id);
        if (alive) { setTrailer(d.trailer); setRelated(d.related.map((r) => r.item)); setWatch(d.whereToWatch || []); }
      } catch { /* extras are optional */ }
    })();
    // items opened from the library are snapshots: re-check when the next episode airs
    if (item.segment === "anime" && !item.finished) {
      fetchNextEpisodes([item.id])
        .then(async (fresh) => {
          if (!alive || !fresh[item.id]) return;
          setNextEpisode(fresh[item.id].nextEpisode);
          if (await noteAiring(fresh)) refresh();
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [item]);

  const pick = async (key) => {
    if (key === status) {
      await setStatus(user, item.segment, item, null);
      return setStatusState(null);
    }
    if (key === "completed") return setVerdictOpen(true);
    await setStatus(user, item.segment, item, key);
    setStatusState(key);
  };

  const changeProgress = async (n) => {
    const r = await setProgress(user, item, n);
    setProgressState(r.progress);
    setStatusState(r.status);
    if (r.reachedEnd) setVerdictOpen(true); // last episode: ask for the verdict
  };

  const saveVerdict = async ({ verdict, vibes, comment }) => {
    await setStatus(user, item.segment, item, "completed");
    await addReview(user, item.segment, item.id, { verdict, vibes, comment });
    setStatusState("completed");
    setVerdictOpen(false);
    refresh();
  };

  return (
    <article className="title-page">
      {trailer ? (
        <div className="trailer">
          <iframe title={`${item.title} trailer`} src={`https://www.youtube.com/embed/${trailer}?rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : item.banner ? (
        <div className="banner" style={{ backgroundImage: `url("${item.banner}")` }} />
      ) : null}

      <div className="title-body">
        <button className="link-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
          <Icon name="back" size={16} /> Back
        </button>

        <div className="title-head">
          <button className="poster-btn" onClick={() => setZoom(true)} aria-label="Enlarge poster">
            {item.image ? <img src={item.image} alt={`${item.title} poster`} /> : <span>No image</span>}
          </button>
          <div className="title-info">
            <div className="eyebrow">{SEGMENT_LABEL[item.segment]}</div>
            <h1>{item.title}</h1>
            {creator && (
              <p className="creator-line"><span>{CREATOR_LABEL[item.segment]}</span> {creator}</p>
            )}
            <p className="muted">{item.genre} · {releaseLabel(item)}</p>
            <div className="chips">
              {(item.genres?.length ? item.genres : [item.genre]).slice(0, 5).map((g) => <span key={g} className="chip-static">{g}</span>)}
            </div>

            <div className="status-row" role="group" aria-label="Track this title">
              {statusesFor(item.segment).map((s) => (
                <button key={s.key} className={`status-btn${status === s.key ? " on" : ""}`} aria-pressed={status === s.key} onClick={() => pick(s.key)}>
                  {s.label}
                </button>
              ))}
              {item.unreleased && (
                <button className={`status-btn excited${isExcited ? " on" : ""}`} aria-pressed={isExcited}
                  onClick={async () => setIsExcited(await toggleExcited(user, item))}>
                  {isExcited ? "Excited ✓" : "Excited?"}
                </button>
              )}
              {status === "completed" && (
                <button className="status-btn" onClick={() => setVerdictOpen(true)}>{myReview ? "Edit review" : "Review it"}</button>
              )}
            </div>

            {!!item.overview && <p className="overview">{item.overview}</p>}
            {item.url && <a className="source-link" href={item.url} target="_blank" rel="noreferrer">Source page ↗</a>}
          </div>
        </div>

        {nextEpisode && (
          <section className="panel next-episode" aria-live="off">
            <div>
              <div className="eyebrow">Next episode</div>
              <b>Episode {nextEpisode.episode}{item.episodes ? ` of ${item.episodes}` : ""}</b>
              <span className="faint small">{dayLabel(nextEpisode.airingAt, now)}, {airTime(nextEpisode.airingAt, clock24)} (your time)</span>
              {delay && (
                <span className="delayed">Delayed · was {dayLabel(delay.from, now)}, {airTime(delay.from, clock24)}</span>
              )}
            </div>
            <span className="countdown big">{formatCountdown(nextEpisode.airingAt, now)}</span>
          </section>
        )}

        {!item.unreleased && (status || progress > 0) && (
          <ProgressStepper item={{ ...item, nextEpisode }} progress={progress} onChange={changeProgress} />
        )}

        {watch.length > 0 && (
          <section className="panel where-to-watch">
            <h2>{item.segment === "manga" ? "Where to read" : "Where to watch"}</h2>
            <div className="watch-links">
              {watch.map((l) => (
                <a key={l.site} href={l.url} target="_blank" rel="noreferrer" className="watch-link">
                  <span className="dot" style={{ background: l.color || "var(--purple)" }} />
                  <span><b>{l.site}</b>{l.languages.length > 0 && <span className="faint small">{l.languages.join(" · ")}</span>}</span>
                </a>
              ))}
            </div>
            <p className="faint small">Availability depends on your country. Links from AniList.</p>
          </section>
        )}

        {myReview && (
          <section className="block">
            <ReviewCard review={myReview} onEdit={() => setVerdictOpen(true)} onShare={() => setShareOpen(true)} />
          </section>
        )}

        {related.length > 0 && <PosterRow title="Seasons & Related — track each one separately" items={related} now={now} />}
      </div>

      <Modal open={zoom} onClose={() => setZoom(false)} label="Poster" className="zoom-modal">
        <button className="icon-btn zoom-close" onClick={() => setZoom(false)} aria-label="Close"><Icon name="close" /></button>
        {item.image && <img src={item.image} alt={`${item.title} poster`} />}
      </Modal>
      {verdictOpen && <VerdictModal open initial={myReview} onSave={saveVerdict} onClose={() => setVerdictOpen(false)} />}
      <ShareCardModal open={shareOpen} item={item} review={myReview} onClose={() => setShareOpen(false)} />
    </article>
  );
}
