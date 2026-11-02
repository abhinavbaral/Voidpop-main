// Which LiteRT-LM Android release can the app's Kotlin compiler read?
// A Kotlin compiler reads libraries built with its own Kotlin version and one minor version newer
// (2.1.x reads up to 2.2), so we need a release built with Kotlin 2.2 or older.
// Pure functions (tested in shared/test/litertlm.test.js); the network part is tools/find-litertlm-version.mjs.

export const parseVersions = (xml) => [...String(xml).matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1].trim());

// the Kotlin a release was built with, from the kotlin-stdlib version in its POM (null if the POM names none)
export function kotlinOf(pom) {
  const deps = [...String(pom).matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map((m) => m[1]);
  for (const d of deps) {
    if (/<groupId>\s*org\.jetbrains\.kotlin\s*<\/groupId>/.test(d) && /<artifactId>\s*kotlin-stdlib[^<]*<\/artifactId>/.test(d)) {
      const v = /<version>\s*([^<\s]+)\s*<\/version>/.exec(d);
      if (v) return v[1];
    }
  }
  return null;
}

const minor = (v) => { const m = /^(\d+)\.(\d+)/.exec(v || ""); return m ? [Number(m[1]), Number(m[2])] : null; };

// can a compiler of version `compiler` read a library built with `lib`? (same minor or one newer)
export function canRead(compiler, lib) {
  const c = minor(compiler), l = minor(lib);
  if (!c || !l) return null; // unknown
  return l[0] < c[0] || (l[0] === c[0] && l[1] <= c[1] + 1);
}

// versions compare numerically ("0.9.0" < "0.18.0")
export const compareVersions = (a, b) => {
  const pa = a.split(/[.-]/), pb = b.split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number(pa[i] ?? 0), y = Number(pb[i] ?? 0);
    if (Number.isNaN(x) || Number.isNaN(y)) { const s = String(pa[i]).localeCompare(String(pb[i])); if (s) return s; } else if (x !== y) return x - y;
  }
  return 0;
};

// rows: [{ version, kotlin }] → the newest release the compiler can read, or null
export function newestReadable(rows, compiler) {
  return rows.filter((r) => canRead(compiler, r.kotlin) === true).sort((a, b) => compareVersions(b.version, a.version))[0] || null;
}
