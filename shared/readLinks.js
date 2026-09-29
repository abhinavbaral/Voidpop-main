// "Where to read" for manga, manhwa and manhua — official places only.
// AniList marks reading services inconsistently (some as STREAMING, some as
// plain INFO), so besides STREAMING links we also accept any link whose site
// is a known official reader or store. Nothing here points at unofficial sites.
//
//   read:   official readers (MANGA Plus, WEBTOON, K MANGA, Tapas…)
//   buy:    stores selling the volumes (BOOK☆WALKER, Kindle, Kobo…)
//   search: when AniList lists no reader, search boxes on the likeliest
//           official services (by country of origin)

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// names as AniList writes them (compared without spaces/punctuation/case)
const READERS = [
  "MANGA Plus", "VIZ", "Shonen Jump", "K MANGA", "Manga UP!", "Mangamo", "Azuki", "INKR", "Comikey",
  "WEBTOON", "Naver Webtoon", "LINE Webtoon", "Tapas", "Tappytoon", "Lezhin", "Pocket Comics", "Manta",
  "Toomics", "Pocket Toons", "Piccoma", "KakaoPage", "Kakao Webtoon", "Bilibili Comics", "ComicWalker",
  "Shonen Jump+", "Young Jump", "Magazine Pocket", "Coolmic", "J-Novel Club",
].map(norm);
const STORES = ["BOOK☆WALKER", "BookWalker", "Amazon", "Kindle", "Kobo", "ComiXology", "Google Play Books", "Apple Books", "Barnes & Noble"].map(norm);

const matches = (list, site) => { const n = norm(site); return !!n && list.some((k) => n === k || n.startsWith(k)); };

function merge(links) {
  const bySite = new Map();
  links.forEach((l) => {
    const cur = bySite.get(l.site);
    if (cur) { if (l.language && !cur.languages.includes(l.language)) cur.languages.push(l.language); }
    else bySite.set(l.site, { site: l.site, url: l.url, color: l.color || null, languages: l.language ? [l.language] : [] });
  });
  return [...bySite.values()];
}

// Search pages on official services, used only when AniList lists no reader.
function searchLinks(title, country) {
  const q = encodeURIComponent(title || "");
  const webtoon = { site: "WEBTOON", url: `https://www.webtoons.com/en/search?keyword=${q}`, color: "#00DC64" };
  const tapas = { site: "Tapas", url: `https://tapas.io/search?q=${q}`, color: "#FF006A" };
  const viz = { site: "VIZ", url: `https://www.viz.com/search?search=${q}`, color: "#E4002B" };
  const bw = { site: "BookWalker", url: `https://global.bookwalker.jp/search/?word=${q}`, color: "#1E90C8" };
  const list = country === "KR" || country === "CN" || country === "TW" ? [webtoon, tapas, bw] : [viz, bw, webtoon];
  return list.map((l) => ({ ...l, languages: [], search: true }));
}

export function readingLinks(externalLinks, { title, country } = {}) {
  const usable = (externalLinks || []).filter((l) => !l.isDisabled && l.url && l.type !== "SOCIAL");
  const read = merge(usable.filter((l) => !matches(STORES, l.site) && (l.type === "STREAMING" || matches(READERS, l.site))));
  const buy = merge(usable.filter((l) => matches(STORES, l.site)));
  return { read, buy, search: read.length ? [] : searchLinks(title, country) };
}
