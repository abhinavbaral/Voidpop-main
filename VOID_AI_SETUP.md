# Void AI: Android on-device assistant

Void AI has been added as a new screen in the existing VoidPop/Voidation Android app. It is deliberately separate from the app's existing library implementation.

## What is included

- `app/src/screens/ai/VoidAIScreen.js`: chat UI, local conversation history, model import and error handling.
- `app/src/screens/ai/aiService.js`: provider boundary; uses local quick replies until a native model is loaded.
- `app/src/screens/ai/localAssistant.js`: offline, library-aware basic answers and model prompt.
- `app/modules/void-ai-runtime/`: Android Expo native module using Google's LiteRT-LM Kotlin runtime.
- A `Void AI` row in the More tab and a new stack screen route.
- Chat history and selected model path are stored on-device. The model is copied to the app's private document directory.

## Important distinction

Without a compatible `.litertlm` model loaded, the app uses **Local Quick Mode**. This is a small deterministic offline helper for basic library questions, not a generative language model. Generative responses require the Android native module and a compatible model file.

## Build on Windows

1. Extract the project and open a terminal in the repository root.
2. From the `app` folder, install dependencies if needed: `npm install`.
3. Back up any existing generated `android/` directory before regenerating native files.
4. Run `npx expo prebuild --platform android`.
5. Build and install a custom app: `npx expo run:android`.

The app uses Expo SDK 54 / React Native 0.81.5. Do not use Expo Go for the native model runtime. This module is Android-only; on iOS, the basic local quick-answer fallback remains available.

## Load a model

1. Obtain a compatible `.litertlm` model from a trusted source, checking the model's licence and usage terms.
2. Open **More → Void AI**, then tap **Load model**.
3. Select the model file. Void AI copies it to app-private storage and asks LiteRT-LM to initialize it.

Model files can be large and inference can use substantial RAM and battery. Performance varies by device. The app does not bundle a model in the APK, and it does not automatically download one.

## If the build fails with "was compiled with an incompatible version of Kotlin"

This is what an EAS build showed at `:void-ai-runtime:compileReleaseKotlin`:

- Expo SDK 54 compiles with Kotlin **2.1.20**, which reads libraries built with Kotlin 2.1 or 2.2.
- LiteRT-LM **0.18.0** was built with Kotlin **2.4** and also pulls `kotlin-stdlib` and `kotlin-reflect` 2.4.0, which the compiler can't read ("The actual metadata version is 2.4.0, but the compiler version 2.1.0 can read versions up to 2.2.0").
- The `Unresolved reference 'require'` / `'extension'` / `'isNotBlank'` lines in that log are a side effect: the standard library itself was unreadable.
- A second, separate error was in the same log: `Suspend function 'withContext' can only be called from a coroutine`. The module's functions now use `AsyncFunction(...) Coroutine { }`, which is how Expo modules call suspend code.

What the module does now (see `android/build.gradle`):

1. Its own compile classpath is forced onto the app's Kotlin libraries, so the 2.4.0 libraries are no longer on it. (The app itself still receives the newer ones at run time; a newer standard library runs older code.)
2. The compiler gets `-Xskip-metadata-version-check`, so it reads LiteRT-LM's newer metadata.
3. The LiteRT-LM version comes from the `LITERTLM_VERSION` environment variable (default `0.18.0`), so you can try another release without changing code.

If it still fails, find a release built with Kotlin 2.2 or older (needs internet):

```sh
node tools/find-litertlm-version.mjs
```

It lists each release, the Kotlin it was built with and which ones your compiler can read, and prints the one to use. Then build with `LITERTLM_VERSION=<that version>` (an EAS environment variable, or `"env"` in the profile in `eas.json`). An older release can have a slightly different Kotlin API; if `VoidAiRuntimeModule.kt` then shows errors about `Engine`, `EngineConfig` or `sendMessageAsync`, send the first few lines.

Upgrading Kotlin for the whole app to 2.4 is not recommended on Expo SDK 54: Expo's Gradle plugins and KSP are pinned to 2.1.20.

None of this could be compiled in the environment where it was written (no Android SDK or Google/Maven access), so treat the first build as the test.

## Architecture for a future hosted provider

`aiService.js` defines the boundary for generation. A future hosted implementation should preserve the same `{ question, modelPath }`-style UI contract and call a backend endpoint. Do not embed hosted provider API keys in the app. Hosted mode should be opt-in, disclose that prompts leave the phone, and only send the minimum context required.

## Validation status

The source files have been integrated into the ZIP, but an Android Gradle build has not been run in this environment. The LiteRT-LM native dependency and Kotlin API therefore still need to be verified by building on your development machine. If Gradle reports a version or API mismatch, follow the official Android guide and pin the compatible LiteRT-LM release: https://developers.google.com/edge/litert-lm/android
