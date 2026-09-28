// DEMO MODE — sample catalog. Titles are real so the demo feels familiar;
// synopses are short originals, posters are generated artwork (no network).
// Upcoming titles are fictional placeholders.

const Y = new Date().getFullYear();

// [id, title, year, genres, synopsis, extra]
const ANIME = [
  [16498, "Attack on Titan", 2013, ["Action", "Drama", "Mystery"], "Humanity hides behind enormous walls from man-eating giants, until the day the walls fall and a boy swears revenge.", { related: [20958] }],
  [20958, "Attack on Titan Season 2", 2017, ["Action", "Drama", "Mystery"], "The Survey Corps discover the enemy may already be inside the walls.", { related: [16498] }],
  [154587, "Frieren: Beyond Journey's End", 2023, ["Adventure", "Drama", "Fantasy"], "An elf mage who outlived her heroic party retraces their old journey to understand the humans she barely got to know."],
  [113415, "Jujutsu Kaisen", 2020, ["Action", "Supernatural"], "A high-schooler swallows a cursed finger and becomes the vessel of the strongest curse in history.", { related: [131573] }],
  [131573, "Jujutsu Kaisen 0", 2021, ["Action", "Supernatural"], "A prequel following a boy haunted by the curse of his childhood friend.", { related: [113415] }],
  [101922, "Demon Slayer", 2019, ["Action", "Fantasy"], "A kind-hearted charcoal seller joins the Demon Slayer Corps to cure his sister, who has been turned into a demon."],
  [5114, "Fullmetal Alchemist: Brotherhood", 2009, ["Action", "Adventure", "Drama"], "Two brothers pay a terrible price for breaking alchemy's greatest taboo and set out to get their bodies back."],
  [1535, "Death Note", 2006, ["Mystery", "Psychological", "Thriller"], "A student finds a notebook that kills anyone whose name is written in it, and a genius detective starts closing in."],
  [9253, "Steins;Gate", 2011, ["Sci-Fi", "Thriller"], "A self-proclaimed mad scientist accidentally invents a way to send messages to the past."],
  [140960, "Spy x Family", 2022, ["Comedy", "Action", "Slice of Life"], "A spy, an assassin and a telepath pretend to be a normal family. None of them knows the others' secrets."],
  [127230, "Chainsaw Man", 2022, ["Action", "Horror"], "A broke young man merges with his chainsaw devil dog and gets hired to hunt devils."],
  [101348, "Vinland Saga", 2019, ["Action", "Adventure", "Drama"], "A young Viking chases revenge across a brutal age, and slowly learns what it means to have no enemies."],
  [21507, "Mob Psycho 100", 2016, ["Action", "Comedy", "Supernatural"], "An overwhelmingly powerful psychic middle-schooler just wants to be ordinary and maybe get a girlfriend."],
  [1, "Cowboy Bebop", 1998, ["Action", "Sci-Fi"], "Bounty hunters drift through the solar system, chased by jazz and their own pasts."],
  [21827, "Violet Evergarden", 2018, ["Drama", "Slice of Life"], "A former child soldier becomes a letter writer, trying to understand the last words her commander said to her."],
  [151807, "Solo Leveling", 2024, ["Action", "Fantasy"], "The weakest hunter alive gets a mysterious system that lets him level up without limits."],
  [20464, "Haikyu!!", 2014, ["Sports", "Comedy"], "A short spiker and a genius setter who can't stand each other become a volleyball team's deadliest weapon."],
  [126403, "Link Click", 2021, ["Mystery", "Supernatural", "Drama"], "Two friends run a photo studio where they can enter photographs and relive a client's past.", { country: "CN" }],
  [101086, "Mo Dao Zu Shi", 2018, ["Fantasy", "Mystery", "Action"], "A disgraced cultivator is summoned back to life and pulled into a mystery with an old rival.", { country: "CN" }],
  [118880, "Heaven Official's Blessing", 2020, ["Fantasy", "Romance"], "A thrice-ascended god returns to the heavens and is sent to investigate a ghost groom.", { country: "CN" }],
  [175001, "Lookism", 2022, ["Drama", "Action"], "A bullied teenager wakes up with a second, impossibly handsome body.", { country: "KR" }],
  [990001, "Starfall Academy", Y + 1, ["Fantasy", "Action"], "Fictional upcoming title used for the demo.", { upcoming: true }],
  [990002, "The Ninth Lantern", Y + 1, ["Mystery", "Supernatural"], "Fictional upcoming title used for the demo.", { upcoming: true }],
  [990003, "Paper Moon Café", Y, ["Slice of Life", "Romance"], "Fictional upcoming title used for the demo.", { upcoming: true, month: 12 }],
];

const MANGA = [
  [30013, "One Piece", 1997, ["Adventure", "Action", "Comedy"], "A rubber-bodied pirate sets out to find the legendary treasure and become King of the Pirates."],
  [30002, "Berserk", 1989, ["Action", "Drama", "Horror"], "A lone mercenary with a giant sword wages war on the demonic forces that betrayed him."],
  [30656, "Vagabond", 1998, ["Action", "Drama"], "A wild young swordsman becomes the legendary Miyamoto Musashi, one duel at a time."],
  [30044, "Chainsaw Man", 2018, ["Action", "Horror"], "The original manga about a devil hunter with chainsaws for arms."],
  [105398, "Solo Leveling", 2018, ["Action", "Fantasy"], "The manhwa that started it: a weak hunter levels up alone.", { country: "KR" }],
  [85143, "Tower of God", 2010, ["Adventure", "Fantasy", "Mystery"], "A boy climbs a tower where every floor is a test, chasing the only friend he has.", { country: "KR" }],
  [119257, "Omniscient Reader", 2020, ["Action", "Fantasy"], "The only reader of a web novel watches its apocalypse come true, and he knows how it ends.", { country: "KR" }],
  [86963, "Tales of Demons and Gods", 2015, ["Action", "Fantasy"], "A master cultivator is reborn into his teenage body with memories of the world's ruin.", { country: "CN" }],
  [101517, "The King's Avatar", 2017, ["Action", "Sports"], "A pro esports legend kicked off his team starts again from level one.", { country: "CN" }],
  [97000, "Saga", 2012, ["Sci-Fi", "Fantasy", "Drama"], "Lovers from two warring alien races try to raise their daughter on the run.", { country: "US" }],
  [97001, "Watchmen", 1986, ["Mystery", "Drama"], "Retired masked vigilantes investigate the murder of one of their own on the edge of nuclear war.", { country: "US" }],
  [990101, "Hollow Crown Chronicle", Y + 1, ["Fantasy"], "Fictional upcoming title used for the demo.", { upcoming: true }],
];

// [id, title, year-month-day, lang, synopsis, extra]
/* ---------- creators: studio (anime), mangaka (manga) ---------- */
const CREATORS = {
  // anime studios
  "Attack on Titan": "Wit Studio", "Attack on Titan Season 2": "Wit Studio",
  "Frieren: Beyond Journey's End": "Madhouse", "Jujutsu Kaisen": "MAPPA", "Jujutsu Kaisen 0": "MAPPA",
  "Demon Slayer": "ufotable", "Fullmetal Alchemist: Brotherhood": "Bones", "Death Note": "Madhouse",
  "Steins;Gate": "White Fox", "Spy x Family": "Wit Studio", "Chainsaw Man": "MAPPA",
  "Vinland Saga": "Wit Studio", "Mob Psycho 100": "Bones", "Cowboy Bebop": "Sunrise",
  "Violet Evergarden": "Kyoto Animation", "Solo Leveling": "A-1 Pictures", "Haikyu!!": "Production I.G",
  "Link Click": "Studio LAN", "Mo Dao Zu Shi": "B.CMAY Pictures",
  "Heaven Official's Blessing": "Haoliners Animation League", "Lookism": "Studio Mir",
  // movies & web series: production company
  "Interstellar": "Syncopy", "Oppenheimer": "Syncopy", "Dune: Part Two": "Legendary Pictures",
  "Spider-Man: Across the Spider-Verse": "Sony Pictures Animation", "3 Idiots": "Vinod Chopra Films",
  "Dangal": "Aamir Khan Productions", "Parasite": "Barunson E&A", "Train to Busan": "Next Entertainment World",
  "Spirited Away": "Studio Ghibli", "Your Name": "CoMix Wave Films", "Godzilla Minus One": "Toho",
  "RRR": "DVV Entertainment", "Breaking Bad": "Sony Pictures Television", "Stranger Things": "21 Laps Entertainment",
  "The Last of Us": "PlayStation Productions", "Arcane": "Fortiche", "Squid Game": "Siren Pictures",
  "Crash Landing on You": "Studio Dragon", "Alice in Borderland": "Robot Communications",
  "Sacred Games": "Phantom Films", "Panchayat": "The Viral Fever", "Money Heist": "Vancouver Media",
  "Dark": "Wiedemann & Berg",
};
const MANGAKA = {
  "One Piece": "Eiichiro Oda", "Berserk": "Kentaro Miura", "Vagabond": "Takehiko Inoue",
  "Chainsaw Man": "Tatsuki Fujimoto", "Solo Leveling": "Chugong & DUBU", "Tower of God": "SIU",
  "Omniscient Reader": "sing N song & Sleepy-C", "Tales of Demons and Gods": "Mad Snail & Jiang Ruotai",
  "The King's Avatar": "Butterfly Blue", "Saga": "Brian K. Vaughan & Fiona Staples",
  "Watchmen": "Alan Moore & Dave Gibbons",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (y, m, d) => `${d} ${MONTHS[m - 1]} ${y}`;

/* ---------- generated artwork ---------- */

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(title, max) {
  const lines = [];
  let line = "";
  for (const w of title.split(" ")) {
    if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

const LABEL = { anime: "ANIME", manga: "MANGA" };

function poster(title, segment) {
  const h = hash(title);
  const h1 = h % 360, h2 = (h1 + 40 + (h >>> 9) % 80) % 360;
  const lines = wrap(title, 11);
  const size = lines.length > 2 ? 34 : 40;
  const startY = 360 - (lines.length - 1) * size * 0.55;
  const cx = 60 + (h >>> 3) % 220, cy = 90 + (h >>> 7) % 160, r = 70 + (h >>> 11) % 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 342 513">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
<stop offset="0" stop-color="hsl(${h1},62%,38%)"/><stop offset="1" stop-color="hsl(${h2},55%,12%)"/></linearGradient></defs>
<rect width="342" height="513" fill="url(#g)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${(h1 + 180) % 360},70%,60%)" opacity="0.28"/>
<circle cx="${cx + 40}" cy="${cy + 30}" r="${r * 0.45}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
<text x="22" y="40" font-family="Helvetica,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3" fill="#fff" fill-opacity="0.75">${LABEL[segment]}</text>
${lines.map((l, i) => `<text x="22" y="${startY + i * size * 1.1}" font-family="Georgia,serif" font-size="${size}" font-weight="700" fill="#fff">${esc(l)}</text>`).join("")}
<rect x="22" y="470" width="44" height="4" fill="#fff" opacity="0.7"/>
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function banner(title) {
  const h = hash(title + "banner");
  const h1 = h % 360, h2 = (h1 + 60) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 439">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h1},55%,30%)"/><stop offset="1" stop-color="hsl(${h2},50%,10%)"/></linearGradient></defs>
<rect width="780" height="439" fill="url(#b)"/>
${[0, 1, 2, 3, 4].map((i) => `<circle cx="${(h >>> i) % 780}" cy="${(h >>> (i + 3)) % 439}" r="${40 + ((h >>> (i * 2)) % 120)}" fill="#fff" opacity="${0.04 + i * 0.015}"/>`).join("")}
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* ---------- build app-shaped items (same shape as src/api normalize) ---------- */

const iso = (d) => d.toISOString().slice(0, 10);

function aniItem([id, title, year, genres, overview, extra = {}], segment) {
  const month = extra.month || 1 + (hash(title) % 12);
  const day = 1 + (hash(title) >>> 4) % 27;
  return {
    id, segment, title,
    image: poster(title, segment),
    banner: banner(title),
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    // upcoming titles only know their month, like real AniList data often does
    dateLabel: extra.upcoming ? `${MONTHS[month - 1]} ${year}` : label(year, month, day),
    creator: segment === "manga" ? MANGAKA[title] || (extra.upcoming ? "Demo Mangaka" : null) : CREATORS[title] || (extra.upcoming ? "Demo Studio" : null),
    genres, genre: genres[0],
    overview,
    url: `https://anilist.co/${segment}/${id}`,
    unreleased: !!extra.upcoming,
    finished: !extra.upcoming,
    country: extra.country || "JP",
    related: extra.related || [],
    popularity: 100000 - (hash(title) % 90000) + (extra.upcoming ? -60000 : 0),
    ...airing(title, segment),
  };
}

// Currently airing in the demo: [title, next episode, total episodes, hours until it airs].
// Times are relative to when the page loads, so countdowns are always live.
const AIRING = {
  "Frieren: Beyond Journey's End": [9, 28, 0.05],
  "Solo Leveling": [7, 13, 3.5],
  "Spy x Family": [4, 12, 11],
  "Link Click": [6, 12, 26],
  "Lookism": [3, 8, 49],
  "Jujutsu Kaisen": [15, 24, 70],
  "Chainsaw Man": [2, 12, 118],
  "Haikyu!!": [11, 25, 150],
};
function airing(title, segment) {
  const a = segment === "anime" && AIRING[title];
  if (!a) return { episodes: null, nextEpisode: null };
  const [episode, episodes, hours] = a;
  return { finished: false, episodes, nextEpisode: { episode, airingAt: Math.floor(Date.now() / 1000 + hours * 3600) } };
}

export const CATALOG = {
  anime: ANIME.map((a) => aniItem(a, "anime")),
  manga: MANGA.map((m) => aniItem(m, "manga")),
};

export const findItem = (segment, id) =>
  (CATALOG[segment] || []).find((i) => String(i.id) === String(id)) || null;

// strip demo-only fields before handing items to the app
export const toAppItem = ({ country, related, popularity, seasons, ...rest }) => rest;

export { iso };
