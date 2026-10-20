// Sample movies and series (from the Talehouse concept). Used when no TMDB key is
// configured, so Movies & TV works offline and in demo builds. Ids are "demo-N"
// strings so they can never be mistaken for real TMDB ids.
//
// Poster and backdrop paths are TMDB image paths; a few may have moved. Cards fall
// back to a plain title tile when an image can't load.
//
// sampleVotes = made-up verdict counts that exercise the community meter
// (see features/verdictMeter.js). They are NOT real people's votes and the UI
// labels them "Sample data". "demo-9" has fewer than 20 on purpose: the meter stays hidden.

const poster = (p) => `https://image.tmdb.org/t/p/w500${p}`;
const small = (p) => `https://image.tmdb.org/t/p/w342${p}`;
const back = (p) => `https://image.tmdb.org/t/p/w1280${p}`;

const make = (n, segment, title, year, genres, overview, p, b, extra) => ({
  id: `demo-${n}`, segment, title, altTitle: null,
  image: poster(p), imageSmall: small(p), color: null, banner: back(b),
  date: `${year}-01-01`, dateLabel: String(year), endDate: null,
  genres, genre: genres[0], overview, url: null,
  unreleased: false, finished: segment === "movie", format: segment === "movie" ? "MOVIE" : "TV",
  country: null, popularity: null, trending: null, score: null, favourites: null,
  episodes: null, chapters: null, nextEpisode: null,
  demo: true, ...extra,
});

export const DEMO_CINEMA = [
  make(1, "movie", "Dune: Part Two", 2024, ["Sci-Fi", "Adventure", "Drama"],
    "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. A vast, patient spectacle about power, faith, and the cost of becoming a legend.",
    "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    { creator: "Denis Villeneuve", duration: 167, runtime: "2h 47m", cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Austin Butler"], services: ["Max", "Prime Video"], vibe: "Immersive · Monumental · Intense", sampleVotes: { peak: 582, divein: 281, onetime: 100, voidit: 37 } }),
  make(2, "tv", "The Bear", 2022, ["Drama", "Comedy"],
    "A young chef returns to Chicago to run his family sandwich shop. The kitchen is chaotic, the grief is real, and every service feels like a small war worth surviving.",
    "/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg", "/7sqFEDDmK1hG5m8mZzZ1Y4w7P0M.jpg",
    { creator: "Christopher Storer", seasons: 3, runtime: "3 seasons", cast: ["Jeremy Allen White", "Ayo Edebiri", "Ebon Moss-Bachrach"], services: ["Disney+"], vibe: "Anxious · Tender · Electric", sampleVotes: { peak: 410, divein: 260, onetime: 90, voidit: 40 } }),
  make(3, "movie", "Past Lives", 2023, ["Romance", "Drama"],
    "Two deeply connected childhood friends are wrested apart after one family emigrates. Decades later, a reunion makes them reckon with destiny, love, and the lives they did not live.",
    "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", "/x3N6gJZk9XJfQwJZpG6Y9yJ7pJf.jpg",
    { creator: "Celine Song", duration: 106, runtime: "1h 46m", cast: ["Greta Lee", "Teo Yoo", "John Magaro"], services: ["Prime Video"], vibe: "Bittersweet · Quiet · Human", sampleVotes: { peak: 240, divein: 150, onetime: 45, voidit: 15 } }),
  make(4, "tv", "Severance", 2022, ["Sci-Fi", "Mystery", "Drama"],
    "Employees at a mysterious company undergo a procedure that surgically divides their memories between work and personal life. The office is strange. The questions are stranger.",
    "/lFf6LLrQjYldcZItzOkGmMMigP7.jpg", "/5C3lW1w8V3V0XkW4V8yQ3F4gY7H.jpg",
    { creator: "Dan Erickson", seasons: 2, runtime: "2 seasons", cast: ["Adam Scott", "Britt Lower", "Patricia Arquette"], services: ["Apple TV+"], vibe: "Uncanny · Precise · Addictive", sampleVotes: { peak: 520, divein: 240, onetime: 70, voidit: 30 } }),
  make(5, "movie", "Spider-Man: Across the Spider-Verse", 2023, ["Animation", "Action", "Sci-Fi"],
    "Miles Morales catapults across the multiverse and encounters a team of Spider-People charged with protecting its existence. The most personal story is the one he refuses to surrender.",
    "/8Vt6mWEReuy4Of61Lnj5Xjrg7b.jpg", "/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg",
    { creator: "Joaquim Dos Santos", duration: 140, runtime: "2h 20m", cast: ["Shameik Moore", "Hailee Steinfeld", "Brian Tyree Henry"], services: ["Netflix"], vibe: "Inventive · Heartfelt · Explosive", sampleVotes: { peak: 640, divein: 250, onetime: 60, voidit: 20 } }),
  make(6, "movie", "The Substance", 2024, ["Horror", "Drama", "Sci-Fi"],
    "A fading celebrity takes a black-market drug that creates a younger version of herself, unleashing a battle over beauty, identity, and who gets to take up space.",
    "/evKz85EKouVbIr51zy5fOtpNRPg.jpg", "/7h6TqPB3ESmjuVbxCxAeB1c9OB1.jpg",
    { creator: "Coralie Fargeat", duration: 141, runtime: "2h 21m", cast: ["Demi Moore", "Margaret Qualley", "Dennis Quaid"], services: ["MUBI", "Prime Video"], vibe: "Visceral · Satirical · Unhinged", sampleVotes: { peak: 180, divein: 220, onetime: 130, voidit: 70 } }),
  make(7, "tv", "Arcane", 2021, ["Animation", "Action", "Drama"],
    "Two sisters find themselves on opposing sides of a conflict between a prosperous city and its oppressed underground. Ambition and loyalty collide in a world on the edge.",
    "/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg", "/yXR6W2q3kz9YJf8P4wqK1Q1fR4j.jpg",
    { creator: "Christian Linke, Alex Yee", seasons: 2, runtime: "2 seasons", cast: ["Hailee Steinfeld", "Ella Purnell", "Kevin Alejandro"], services: ["Netflix"], vibe: "Beautiful · Tragic · Grand", sampleVotes: { peak: 700, divein: 230, onetime: 40, voidit: 15 } }),
  make(8, "movie", "Everything Everywhere All at Once", 2022, ["Sci-Fi", "Comedy", "Action"],
    "An exhausted laundromat owner is swept into an absurd multiverse adventure and discovers that the most important universe might be the one right in front of her.",
    "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg", "/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg",
    { creator: "Daniel Kwan, Daniel Scheinert", duration: 139, runtime: "2h 19m", cast: ["Michelle Yeoh", "Stephanie Hsu", "Ke Huy Quan"], services: ["Prime Video"], vibe: "Chaotic · Tender · Existential", sampleVotes: { peak: 460, divein: 280, onetime: 90, voidit: 50 } }),
  make(9, "tv", "Panchayat", 2020, ["Comedy", "Drama"],
    "An engineering graduate takes a reluctant job as a village secretary in rural India. What starts as a stopgap slowly becomes a lesson in community, compromise, and belonging.",
    "/sXf0k5JZ7mV8u9o6J2W6P2v8q8b.jpg", "/bQXAqRx2Fgc46uCVWgoPz5L5Dtr.jpg",
    { creator: "Deepak Kumar Mishra", seasons: 3, runtime: "3 seasons", cast: ["Jitendra Kumar", "Raghubir Yadav", "Neena Gupta"], services: ["Prime Video"], vibe: "Warm · Grounded · Charming", sampleVotes: { peak: 6, divein: 5, onetime: 2, voidit: 1 } }),
  make(10, "movie", "Arrival", 2016, ["Sci-Fi", "Drama", "Mystery"],
    "When mysterious spacecraft land around the world, a linguist is recruited to decipher their language. Communication becomes a question of time, memory, and what it means to choose love.",
    "/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg", "/yIZ1xendyqKvY3FGeeUYUd5X9Mm.jpg",
    { creator: "Denis Villeneuve", duration: 116, runtime: "1h 56m", cast: ["Amy Adams", "Jeremy Renner", "Forest Whitaker"], services: ["Paramount+"], vibe: "Contemplative · Emotional · Cosmic", sampleVotes: { peak: 330, divein: 210, onetime: 70, voidit: 25 } }),
  make(11, "tv", "The Queen’s Gambit", 2020, ["Drama"],
    "An orphaned chess prodigy fights addiction and isolation on her way to becoming one of the world’s best players. Every victory reveals another move she must make within herself.",
    "/zU0htwkhNvBQdVSIKB9s6hgVeFK.jpg", "/34OGjFEbHj0E3lE2w0iTUVq0l8w.jpg",
    { creator: "Scott Frank", seasons: 1, runtime: "Limited series", cast: ["Anya Taylor-Joy", "Chloe Pirrie", "Bill Camp"], services: ["Netflix"], vibe: "Elegant · Focused · Human", sampleVotes: { peak: 300, divein: 270, onetime: 90, voidit: 20 } }),
  make(12, "movie", "Godzilla Minus One", 2023, ["Action", "Sci-Fi", "Drama"],
    "In a postwar Japan already reduced to ruins, a former kamikaze pilot faces a new terror rising from the sea. Survival is only the beginning of the story.",
    "/hkxxMIGaiCTmrEArK7J56JTKUlB.jpg", "/fY3lD0jM5AoHJMunjGWqJ0h9J1p.jpg",
    { creator: "Takashi Yamazaki", duration: 124, runtime: "2h 4m", cast: ["Ryunosuke Kamiki", "Minami Hamabe", "Yuki Yamada"], services: ["Netflix"], vibe: "Devastating · Tense · Human", sampleVotes: { peak: 310, divein: 290, onetime: 80, voidit: 20 } }),
];

// Sample community takes (not real people). Verdict keys are VoidPop's own.
export const SAMPLE_TAKES = [
  { id: "t1", author: "Mira K.", handle: "@mirawatches", titleId: "demo-3", verdict: "peak", time: "2h ago",
    body: "It understands that some people are chapters, not endings. The silence between the characters says more than a dozen monologues could." },
  { id: "t2", author: "Rohan S.", handle: "@framesbyrohan", titleId: "demo-1", verdict: "peak", time: "5h ago",
    body: "Every frame feels carved out of stone. The scale is unreal, but the moments that stayed with me were the quiet ones." },
  { id: "t3", author: "Anika P.", handle: "@anikafilmclub", titleId: "demo-2", verdict: "divein", time: "1d ago",
    body: "A show about people who care so much it becomes a kind of violence. Messy, generous, and almost painfully real." },
];
