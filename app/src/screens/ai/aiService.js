import { requireOptionalNativeModule } from "expo-modules-core";
import { getLibraryAll } from "@voidpop/shared/backend/store";
import { buildModelPrompt, makeLocalReply } from "./localAssistant";

const nativeRuntime = requireOptionalNativeModule("VoidAiRuntime");

export function getOnDeviceRuntime() {
  return nativeRuntime;
}

export async function createLibraryContext(maxEntries = 80) {
  const all = await getLibraryAll().catch(() => ({}));
  return Object.values(all).filter((entry) => entry?.item).slice(0, maxEntries).map((entry) => {
    const item = entry.item || {};
    const title = (typeof item.title === "string" ? item.title : null) ||
      item.title?.english || item.title?.romaji || item.title?.userPreferred || item.name || "Unknown title";
    return `${title} | ${entry.status || "unknown"} | ${item.segment || "anime"}`;
  }).join("\n");
}

export async function generateVoidAIReply({ question, modelPath }) {
  if (!modelPath || !nativeRuntime) return makeLocalReply(question);
  const context = await createLibraryContext();
  const prompt = buildModelPrompt(question, context || "The local library is empty.");
  const reply = await nativeRuntime.generate(modelPath, prompt);
  if (!reply || !String(reply).trim()) throw new Error("The model returned an empty response.");
  return String(reply).trim();
}

// Future hosted inference should implement the same input/output contract and
// be called through a backend. Never put a provider API key in the Android app.
export async function generateHostedVoidAIReply() {
  throw new Error("Hosted Void AI is not configured yet. The current version runs locally.");
}
