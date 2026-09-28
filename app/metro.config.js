// Metro config. Expo (SDK 52+) configures monorepo workspaces automatically,
// so @voidation/shared resolves from the repo root with no extra setup.
//
// DEMO MODE (`npm run demo`, sets EXPO_PUBLIC_VOIDATION_DEMO=1): swaps the
// on-device storage and the AniList client for the versions in shared/demo, so
// the app runs offline on a sample library (handy for presentations). Screens
// and the shared data layer are the real code; only what sits underneath is replaced.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_PUBLIC_VOIDATION_DEMO === "1") {
  const shared = path.resolve(__dirname, "../shared");
  const demoDir = path.join(shared, "demo") + path.sep;
  const demo = (f) => path.join(shared, "demo", f);

  // matched on the RESOLVED file, so both "@voidation/shared/api/anilist" and a
  // relative "../api/anilist.js" inside shared get swapped
  const byFile = {
    [path.join(shared, "api", "anilist.js")]: demo("api-anilist.js"),
    [path.join(shared, "backend", "storage.js")]: demo("storage.js"),
  };

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const fromDemo = (context.originModulePath || "").startsWith(demoDir);
    const result = context.resolveRequest(context, moduleName, platform);
    if (!fromDemo && result.type === "sourceFile" && byFile[result.filePath]) {
      return { type: "sourceFile", filePath: byFile[result.filePath] };
    }
    return result;
  };
}

module.exports = config;
