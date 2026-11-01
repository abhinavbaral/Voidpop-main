import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const { parseFeed, classifyNews, mergeNews, filterNews, stripHtml, shorten } = await import("../features/news.js");
const { fetchNews } = await import("../api/news.js");
const store = await import("../backend/store.js");

const NOW = Date.UTC(2026, 9, 29, 12);

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Feed</title>
<item>
  <title><![CDATA[Frieren Anime Gets Season 3 &amp; New Trailer]]></title>
  <link>http://example.com/news/frieren-s3?utm=x</link>
  <description><![CDATA[<p>The <b>TV anime</b> returns in 2027. See the &quot;key visual&quot;.</p><img src="https://img.example.com/a.jpg">]]></description>
  <pubDate>Wed, 28 Oct 2026 09:00:00 GMT</pubDate>
  <category>Anime</category><category><![CDATA[TV]]></category>
  <enclosure url="https://img.example.com/enc.jpg" type="image/jpeg" length="0"/>
</item>
<item>
  <title>Shueisha Ends Manga Magazine After 50 Years</title>
  <link>https://example.com/news/mag-ends</link>
  <description>Final chapters of the manga run in December.</description>
  <pubDate>Tue, 27 Oct 2026 20:00:00 GMT</pubDate>
  <category>Manga</category>
  <media:thumbnail url="https://img.example.com/thumb.png"/>
</item>
<item>
  <title>New Light Novel Series Announced</title>
  <link>https://example.com/news/ln-new</link>
  <description>A web novel is getting a print release.</description>
  <pubDate>Tomorrow-ish nonsense</pubDate>
</item>
<item><title>No link here</title><description>skipped</description></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
<item>
  <title>From the future</title><link>https://example.com/news/future</link><pubDate>Mon, 01 Jan 2035 00:00:00 GMT</pubDate>
</item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
  <title type="html">Dandadan Season 3 Release Date</title>
  <link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/news/dandadan-3"/>
  <updated>2026-10-29T08:00:00Z</updated>
  <summary type="html">&lt;p&gt;Episodes begin in &lt;b&gt;July&lt;/b&gt;.&lt;/p&gt;</summary>
  <category term="Anime"/>
</entry></feed>`;

test("RSS: titles, summaries, https links, images, dates, tags", () => {
  const items = parseFeed(RSS, { id: "t", name: "Test" }, NOW);
  assert.deepEqual(items.map((i) => i.title), [
    "Frieren Anime Gets Season 3 & New Trailer", "Shueisha Ends Manga Magazine After 50 Years", "New Light Novel Series Announced", "From the future",
  ]); // no link and a javascript: link are dropped
  const [a, b, c, d] = items;
  assert.equal(a.url, "https://example.com/news/frieren-s3?utm=x");                // http → https
  assert.equal(a.summary, 'The TV anime returns in 2027. See the "key visual".');
  assert.equal(a.image, "https://img.example.com/enc.jpg");                          // enclosure first
  assert.deepEqual(a.tags, ["Anime", "TV"]);
  assert.equal(a.publishedAt, Date.UTC(2026, 9, 28, 9));
  assert.equal(a.sourceName, "Test");
  assert.equal(b.image, "https://img.example.com/thumb.png");                       // media:thumbnail
  assert.equal(c.publishedAt, NOW);                                                   // unreadable date → now
  assert.equal(d.publishedAt, NOW);                                                   // a date in the future is clamped
});

test("Atom: the alternate link, html summary, term categories", () => {
  const [e] = parseFeed(ATOM, { id: "a", name: "Atom" }, NOW);
  assert.deepEqual([e.url, e.summary, e.tags, e.kind], ["https://example.com/news/dandadan-3", "Episodes begin in July.", ["Anime"], "anime"]);
});

test("garbage in, nothing out (never throws)", () => {
  assert.deepEqual(parseFeed("", { id: "x", name: "x" }), []);
  assert.deepEqual(parseFeed("<html><body>404</body></html>", { id: "x", name: "x" }), []);
  assert.deepEqual(parseFeed(null), []);
});

test("kinds: anime, manga, novels, other", () => {
  const k = (title, tags = [], summary = "") => classifyNews({ title, tags, summary });
  assert.equal(k("New Light Novel Series Announced"), "novel");
  assert.equal(k("Chainsaw Man manga hits 20 million copies"), "manga");
  assert.equal(k("Frieren Anime Gets Season 3"), "anime");
  assert.equal(k("Some title", ["Manga"]), "manga");
  assert.equal(k("Anime based on a light novel premieres", [], "light novel by X"), "anime"); // the title says anime: it's anime news
  assert.equal(k("Konami announces a new game", ["Games"]), "other");
  assert.equal(k("Novelty merchandise arrives"), "other");                                  // "novelty" is not "novel"
});

test("merge: newest first, the same link or headline only once, limited", () => {
  const mk = (id, title, t, url) => ({ id: url, url, title, publishedAt: t, kind: "anime" });
  const a = [mk(1, "Big News!", 100, "https://a.com/x/"), mk(2, "Old", 10, "https://a.com/old")];
  const b = [mk(3, "Big News", 105, "https://b.com/y"), mk(4, "Dup link", 50, "https://a.com/x?utm=1")];
  const out = mergeNews([a, b]);
  assert.deepEqual(out.map((i) => i.title), ["Big News", "Old"]); // "Big News!" is the same headline; "Dup link" has the same link as it
  assert.equal(mergeNews([a, b], 1).length, 1);
});

test("filter by tab; helpers", () => {
  const items = [{ kind: "anime" }, { kind: "manga" }, { kind: "novel" }, { kind: "other" }];
  assert.equal(filterNews(items, "all").length, 4);
  assert.deepEqual(filterNews(items, "novel"), [{ kind: "novel" }]);
  assert.equal(stripHtml("<p>A&nbsp;&amp;&#33; <script>x()</script>b</p>"), "A &! b");
  assert.equal(shorten("one two three four", 10), "one two…");
});

test("fetchNews: merges feeds, one failing site is reported, saved for 15 minutes, saved copy used when all fail", async () => {
  const feeds = [{ id: "ok", name: "OK Site", url: "https://ok.test/rss" }, { id: "bad", name: "Bad Site", url: "https://bad.test/rss" }];
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (url.includes("bad.test")) throw new Error("down");
    return { ok: true, status: 200, text: async () => RSS };
  };
  const first = await fetchNews({ feeds, now: NOW });
  assert.equal(first.items.length, 4);
  assert.deepEqual(first.failed, ["Bad Site"]);
  assert.equal(calls, 2);

  const again = await fetchNews({ feeds, now: NOW + 5 * 60000 });                    // inside 15 minutes: no network at all
  assert.deepEqual([again.items.length, calls], [4, 2]);

  globalThis.fetch = async () => { throw new Error("offline"); };
  const offline = await fetchNews({ feeds, now: NOW + 3600000 });                    // an hour later and offline: the saved list
  assert.deepEqual([offline.items.length, offline.stale, offline.failed.length], [4, true, 2]);
  assert.equal((await fetchNews({ feeds, now: NOW + 3600000, force: true })).items.length, 4);
});

test("news verdicts: no moods, replace, remove, survive a backup", async () => {
  const art = { url: "https://example.com/news/frieren-s3", title: "Frieren S3", sourceName: "Test" };
  await store.setNewsVerdict(art, "peak");
  await store.setNewsVerdict(art, "divein");                                          // changing it replaces it
  let all = await store.getNewsVerdicts();
  assert.deepEqual(Object.keys(all), [art.url]);
  assert.deepEqual([all[art.url].verdict, all[art.url].moods, all[art.url].title], ["divein", undefined, "Frieren S3"]);
  await assert.rejects(() => store.setNewsVerdict(art, "great"), /Unknown verdict/);

  const backup = await store.exportData();
  await store.clearData();
  assert.deepEqual(await store.getNewsVerdicts(), {});
  assert.equal(await store.importData(backup), null);
  assert.equal((await store.getNewsVerdicts())[art.url].verdict, "divein");
  const old = JSON.parse(backup); delete old.newsVerdicts;                             // a backup from before News
  assert.equal(await store.importData(JSON.stringify(old)), null);
  assert.deepEqual(await store.getNewsVerdicts(), {});

  await store.setNewsVerdict(art, "voidit");
  await store.setNewsVerdict(art, null);
  assert.deepEqual(await store.getNewsVerdicts(), {});
});

test("news verdicts: only the newest 500 are kept", async () => {
  for (let i = 0; i < 503; i++) await store.setNewsVerdict({ url: `https://e.com/${i}`, title: `T${i}` }, "onetime");
  const all = await store.getNewsVerdicts();
  assert.equal(Object.keys(all).length, 500);
  assert.ok(all["https://e.com/502"] && !all["https://e.com/0"]);
});
