// React hooks over api/community.js, shared by the website and the app.
//   useAccount()                   who's signed in
//   useTitleVerdicts(segment, id)  the community's Void Verdict counts for a title
//   useComments(segment, id)       a title's comments + post / reply / edit / delete / like
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hasCommunity, loadAccount, currentUser, onAccountChange,
  fetchTitleVerdicts, fetchComments, postComment, editComment, deleteComment, setCommentLike,
} from "../api/community.js";

export function useAccount() {
  const [user, setUser] = useState(currentUser());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadAccount().then((u) => { if (alive) { setUser(u); setReady(true); } });
    const off = onAccountChange((u) => alive && setUser(u));
    return () => { alive = false; off(); };
  }, []);
  return { user, ready, enabled: hasCommunity() };
}

// counts: null while loading or when there's no server. `refresh` after you save your own verdict.
export function useTitleVerdicts(segment, id) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasCommunity()) { setData(null); return undefined; }
    let alive = true;
    fetchTitleVerdicts(segment, id).then((d) => alive && setData(d)).catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [segment, id, tick]);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { counts: data?.counts ?? null, total: data?.total ?? 0, refresh };
}

const patch = (list, id, fn) => list.map((c) => (c.id === id ? fn(c) : { ...c, replies: c.replies.map((r) => (r.id === id ? fn(r) : r)) }));

export function useComments(segment, id) {
  const [comments, setComments] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const req = useRef(0); // answers for a title you've already left are ignored

  const load = useCallback(async (before) => {
    const mine = ++req.current;
    setLoading(true); setError("");
    try {
      const r = await fetchComments(segment, id, { before });
      if (mine !== req.current) return;
      setComments((prev) => (before ? [...prev, ...r.comments] : r.comments));
      setNextBefore(r.nextBefore);
    } catch (e) {
      if (mine === req.current) setError(e.message);
    } finally {
      if (mine === req.current) setLoading(false);
    }
  }, [segment, id]);

  useEffect(() => {
    setComments([]); setNextBefore(null);
    if (!hasCommunity()) { setLoading(false); return undefined; }
    load();
    return () => { req.current += 1; };
  }, [load]);

  // every action returns an error message, or "" when it worked
  const run = async (fn) => { try { await fn(); return ""; } catch (e) { return e.message; } };

  const post = (body, parentId) => run(async () => {
    const c = await postComment(segment, id, body, parentId);
    setComments((prev) => (parentId ? prev.map((p) => (p.id === parentId ? { ...p, replies: [...p.replies, c] } : p)) : [c, ...prev]));
  });
  const edit = (commentId, body) => run(async () => {
    const c = await editComment(commentId, body);
    setComments((prev) => patch(prev, commentId, (x) => ({ ...x, body: c.body, editedAt: c.editedAt })));
  });
  const remove = (commentId) => run(async () => {
    await deleteComment(commentId);
    setComments((prev) => prev
      .map((c) => (c.id === commentId ? { ...c, deleted: true, body: "" } : { ...c, replies: c.replies.filter((r) => r.id !== commentId) }))
      .filter((c) => !(c.deleted && c.replies.length === 0)));
  });
  const like = (commentId, on) => run(async () => {
    setComments((prev) => patch(prev, commentId, (x) => ({ ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) }))); // instant
    try { await setCommentLike(commentId, on); }
    catch (e) { setComments((prev) => patch(prev, commentId, (x) => ({ ...x, liked: !on, likes: Math.max(0, x.likes + (on ? -1 : 1)) }))); throw e; } // undo
  });

  return { comments, loading, error, hasMore: nextBefore != null, more: () => load(nextBefore), reload: () => load(), post, edit, remove, like };
}
