import { requireOptionalNativeModule } from "expo-modules-core";
import { libraryContext, buildModelPrompt, localReply } from "@voidpop/shared/features/voidAi";
import { loadEntries } from "./localAssistant";

const nativeRuntime = requireOptionalNativeModule("VoidAiRuntime");

export function getOnDeviceRuntime() {
  return nativeRuntime;
}

export async function createLibraryContext(maxLines = 60) {
  return libraryContext(await loadEntries(), { maxLines });
}

// → { text, local }  local: true = answered without a model (Local Quick Mode), so it isn't kept in the chat the model sees.
// history: the chat so far, for a model (it remembers nothing between questions).
export async function generateVoidAIReply({ question, modelPath, history = [] }) {
  const entries = await loadEntries();
  if (!modelPath || !nativeRuntime) return { text: localReply(question, entries), local: true };
  const prompt = buildModelPrompt(question, libraryContext(entries) || "The library is empty.", history);
  const reply = await nativeRuntime.generate(modelPath, prompt);
  if (!reply || !String(reply).trim()) throw new Error("The model returned an empty response.");
  return { text: String(reply).trim(), local: false };
}

// Future hosted inference should implement the same input/output contract and
// be called through a backend. Never put a provider API key in the Android app.
export async function generateHostedVoidAIReply() {
  throw new Error("Hosted Void AI is not configured yet. The current version runs locally.");
}
