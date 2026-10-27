// A fake Google/Apple for tests: a real RSA key pair, real RS256-signed tokens, and a fetchJson that serves the
// public key the way the providers' key endpoints do. No network, and the server's real checking code runs.
import { generateKeyPairSync, sign } from "node:crypto";

export function makeIdp({ kid = "key-1" } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };
  const state = { calls: 0, down: false, keys: [jwk] };
  const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

  // jwt(claims) → a valid token. Options break it on purpose: another key, header, alg, kid.
  const jwt = (claims, { key = privateKey, alg = "RS256", kid: k = kid, header = {} } = {}) => {
    const head = b64({ alg, typ: "JWT", kid: k, ...header });
    const body = b64(claims);
    const sig = key ? sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url") : "";
    return `${head}.${body}.${sig}`;
  };
  const fetchJson = async () => {
    state.calls += 1;
    if (state.down) throw new Error("the provider is down");
    return { keys: state.keys };
  };
  return { jwk, state, jwt, b64, fetchJson, privateKey };
}
