// Finds a LiteRT-LM Android release your app's Kotlin can compile against.
//   node tools/find-litertlm-version.mjs                # Expo SDK 54's Kotlin (2.1.20)
//   node tools/find-litertlm-version.mjs --kotlin 2.1.20 --last 30
// Needs internet. Reads the list of releases from Maven Central (or Google Maven), then each release's POM to see
// which Kotlin it was built with. Then build with:  LITERTLM_VERSION=<version printed at the end>
import { parseVersions, kotlinOf, canRead, newestReadable, compareVersions } from "./lib/litertlm.mjs";

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const compiler = arg("kotlin", "2.1.20");
const last = Number(arg("last", 25));
const REPOS = ["https://repo1.maven.org/maven2", "https://dl.google.com/dl/android/maven2"];
const PATH = "com/google/ai/edge/litertlm/litertlm-android";

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

let base = null, versions = [];
for (const repo of REPOS) {
  try { versions = parseVersions(await get(`${repo}/${PATH}/maven-metadata.xml`)); base = repo; break; } catch { /* try the next one */ }
}
if (!base) { console.error("Couldn't read the release list from Maven Central or Google Maven. Check your internet connection."); process.exit(1); }

versions = versions.filter((v) => !/(alpha|beta|rc|snapshot)/i.test(v)).sort(compareVersions).slice(-last);
console.log(`Releases from ${base} (newest ${versions.length}), checked against Kotlin ${compiler}:\n`);
const rows = [];
for (const version of versions) {
  let kotlin = null;
  try { kotlin = kotlinOf(await get(`${base}/${PATH}/${version}/litertlm-android-${version}.pom`)); } catch { /* no POM: unknown */ }
  rows.push({ version, kotlin });
  const ok = canRead(compiler, kotlin);
  console.log(`  ${version.padEnd(12)} built with Kotlin ${(kotlin || "?").padEnd(8)} ${ok === true ? "OK" : ok === false ? "too new" : "unknown"}`);
}
const pick = newestReadable(rows, compiler);
console.log(pick
  ? `\nUse ${pick.version} (the newest your compiler can read).\nBuild with the environment variable:  LITERTLM_VERSION=${pick.version}\n(EAS: add it under Environment variables for the profile, or in eas.json: "env": { "LITERTLM_VERSION": "${pick.version}" })`
  : `\nNone of these were built with Kotlin ${compiler} or older. Keep the default version and rely on the -Xskip-metadata-version-check setting in app/modules/void-ai-runtime/android/build.gradle, or upgrade Kotlin for the whole app (not recommended on Expo SDK 54).`);
console.log("\nNote: an older release may have a different Kotlin API (class or parameter names). If compile errors appear in VoidAiRuntimeModule.kt, tell me the first few lines.");
