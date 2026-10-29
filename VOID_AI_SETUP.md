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

## Architecture for a future hosted provider

`aiService.js` defines the boundary for generation. A future hosted implementation should preserve the same `{ question, modelPath }`-style UI contract and call a backend endpoint. Do not embed hosted provider API keys in the app. Hosted mode should be opt-in, disclose that prompts leave the phone, and only send the minimum context required.

## Validation status

The source files have been integrated into the ZIP, but an Android Gradle build has not been run in this environment. The LiteRT-LM native dependency and Kotlin API therefore still need to be verified by building on your development machine. If Gradle reports a version or API mismatch, follow the official Android guide and pin the compatible LiteRT-LM release: https://developers.google.com/edge/litert-lm/android
