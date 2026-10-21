// Passwords and login tokens, using only node:crypto.
//  - passwords: scrypt with a random salt (never stored or logged in clear)
//  - tokens: "payload.signature", HMAC-SHA256, 30 days. Stateless: signing out just forgets it on the device.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const TOKEN_DAYS = 30;

export function makeTokens(secret) {
  const sign = (data) => createHmac("sha256", secret).update(data).digest();
  return {
    issue(userId, now = Date.now()) {
      const payload = b64(JSON.stringify({ uid: userId, exp: now + TOKEN_DAYS * 86400000 }));
      return `${payload}.${b64(sign(payload))}`;
    },
    // → user id, or null for anything wrong, forged or expired
    verify(token, now = Date.now()) {
      const [payload, sig] = String(token || "").split(".");
      if (!payload || !sig) return null;
      const want = sign(payload);
      let got;
      try { got = Buffer.from(sig, "base64url"); } catch { return null; }
      if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
      try {
        const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
        return Number.isInteger(uid) && exp > now ? uid : null;
      } catch { return null; }
    },
  };
}
