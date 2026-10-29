# Void AI native runtime (Android)

This local Expo module connects the Void AI screen to Google's LiteRT-LM Kotlin runtime. It is intentionally Android-only. iOS and Expo Go use Void AI's local quick-answer fallback.

## Model requirements

- Supply a compatible `.litertlm` model file from a source you trust.
- The app copies the selected model into its private app storage. It is not bundled in the APK.
- Model files can be large. Check free storage and the model's licence/usage conditions before importing.
- This module initializes the engine for each request for a conservative first implementation. Once verified on target devices, engine reuse can be added to improve response latency and memory use.

## Build

From `app/`:

```powershell
npx expo prebuild --platform android
npx expo run:android
```

Use a custom development build or a rebuilt APK, not Expo Go. The native module and LiteRT-LM dependency are compiled into the Android app. If you already have an `android/` directory with local changes, back it up before running prebuild.

LiteRT-LM Android documentation: https://developers.google.com/edge/litert-lm/android
