// Start the server:  npm run server   (from the repo root)  or  npm start  (in server/)
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8787;
const secret = process.env.VOIDPOP_SECRET || randomBytes(32).toString("hex");
if (!process.env.VOIDPOP_SECRET) {
  console.warn("VOIDPOP_SECRET isn't set: using a temporary one. Everyone is signed out whenever the server restarts. Set it before deploying.");
}

// "Sign in with Google / Apple" are off until their client ids are set (comma separated; see server/README.md)
const ids = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const google = ids(process.env.GOOGLE_CLIENT_IDS);
const apple = ids(process.env.APPLE_CLIENT_IDS);

const db = openDb(process.env.VOIDPOP_DB || join(here, "..", "data", "voidpop.db"));
const app = createApp({ db, secret, origins: process.env.VOIDPOP_ORIGINS || "*", trustProxy: process.env.TRUST_PROXY === "1", google, apple });

createServer(app).listen(port, () => console.log(`VoidPop server listening on http://localhost:${port}`));
