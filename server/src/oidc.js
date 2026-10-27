// Checking a "Sign in with Google / Apple" token, using only node:crypto and fetch (no packages).
//
// The phone asks Google or Apple who the person is and gets back an ID token: a signed JWT. It sends that token
// here, and this file decides whether to believe it. A token is accepted only when ALL of these hold:
//   - it is signed with RS256 by one of the provider's published keys (alg "none" / HS256 are refused outright,
//     which is the classic way to forge one)
//   - it was issued by that provider (iss) and for OUR app (aud is one of the client ids we were given)
//   - it has not expired (exp) and was not issued in the future (iat)
//   - it names a person (sub)
// Nothing here trusts what the phone says about itself: only what the signed token says.
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

export const GOOGLE = {
  issuers: ["https://accounts.google.com", "accounts.google.com"],
  jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
};
export const APPLE = {
  issuers: ["https://appleid.apple.com"],
  jwksUrl: "https://appleid.apple.com/auth/keys",
};

// kind "invalid": the token is no good.  kind "unavailable": we couldn't fetch the provider's keys, so can't tell.
export class OidcError extends Error {
  constructor(kind) {
    super(kind === "unavailable" ? "Couldn't reach the sign-in service. Try again in a moment." : "That sign-in couldn't be verified. Try again.");
    this.kind = kind;
  }
}

const LEEWAY_SECONDS = 60;        // clocks differ a little
const KEYS_TTL = 60 * 60 * 1000;  // keep a provider's keys for an hour
const REFETCH_GAP = 60 * 1000;    // an unknown key id re-fetches at most once a minute, so junk tokens can't make us hammer Google

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

// → verify(token, { jwksUrl, issuers, audiences }) → { sub, email, emailVerified, name }   (throws OidcError)
export function makeVerifier({ fetchJson = defaultFetchJson, now = Date.now } = {}) {
  const cache = new Map(); // jwksUrl → { keys, at }

  async function keysFor(url, { fresh = false } = {}) {
    const hit = cache.get(url);
    const t = now();
    if (hit && (fresh ? t - hit.at < REFETCH_GAP : t - hit.at < KEYS_TTL)) return hit.keys;
    try {
      const json = await fetchJson(url);
      const keys = Array.isArray(json?.keys) ? json.keys : [];
      cache.set(url, { keys, at: t });
      return keys;
    } catch {
      if (hit) return hit.keys; // the provider is down: the keys we have are still good
      throw new OidcError("unavailable");
    }
  }

  return async function verify(token, { jwksUrl, issuers, audiences }) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3 || parts.some((p) => !p)) throw new OidcError("invalid");
    let header, claims;
    try { header = decode(parts[0]); claims = decode(parts[1]); } catch { throw new OidcError("invalid"); }
    if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") throw new OidcError("invalid");

    const find = (keys) => keys.find((k) => k?.kid === header.kid && k.kty === "RSA");
    let jwk = find(await keysFor(jwksUrl));
    if (!jwk) jwk = find(await keysFor(jwksUrl, { fresh: true })); // the provider may have rotated its keys
    if (!jwk) throw new OidcError("invalid");

    let signed = false;
    try {
      signed = cryptoVerify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
    } catch { signed = false; }
    if (!signed) throw new OidcError("invalid");

    const nowSeconds = Math.floor(now() / 1000);
    if (!issuers.includes(claims.iss)) throw new OidcError("invalid");
    if (!(audiences || []).length || ![].concat(claims.aud ?? []).some((a) => audiences.includes(a))) throw new OidcError("invalid");
    if (typeof claims.exp !== "number" || claims.exp + LEEWAY_SECONDS < nowSeconds) throw new OidcError("invalid");
    if (typeof claims.iat === "number" && claims.iat - LEEWAY_SECONDS > nowSeconds) throw new OidcError("invalid");
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new OidcError("invalid");

    return {
      sub: claims.sub,
      email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null,
      // Google sends a boolean, Apple sometimes the string "true"
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: typeof claims.name === "string" ? claims.name : null,
    };
  };
}
