# VoidPop Mobile App

The `app/` directory contains VoidPop's Expo and React Native application for Android and iOS. It uses shared business logic from `../shared` to keep library management, progress tracking, verdicts, and countdown behavior consistent with the website.

The app is designed for local-first use. Core tracking features work without an account, while AniList synchronization, community features, and cloud backups are optional.

## Features

- **Anime, manga, and novel tracking:** Manage library statuses and episode or chapter progress.
- **Live episode countdowns:** Follow airing anime and view upcoming episodes.
- **Movies & TV:** Discover movies and television series through Explore, separately from the anime, manga, and novel library.
- **Void Verdicts:** Rate titles with Peak, Dive In, One Time, or Void It, with optional vibes.
- **History and pending episodes:** Review recent releases and keep track of unwatched episodes.
- **Explore and Browse:** Discover titles using supported media, origin, season, year, genre, and studio filters.
- **AniList integration:** Import public lists and optionally synchronize supported progress and statuses.
- **Offline support:** Store the personal library locally and reuse cached AniList data when offline.
- **Community features:** Access comments, replies, likes, and community verdicts when the backend is configured.
- **Calendar and sharing:** Add episode schedules to the phone's calendar and share countdown images.
- **Notifications and widgets:** Receive episode alerts and display upcoming episodes through supported Android native features.
- **Backup and restore:** Export or restore library data and use scheduled Android backups where supported.
- **Statistics and tiers:** Track progress, completion statistics, and advancement through 15 ranks.

## Requirements

- Node.js 22.5 or later.
- npm and the repository's configured workspaces.
- Expo Go for supported development workflows.
- An Android device or emulator for Android testing.
- An iOS device or simulator with the required Apple development environment for iOS testing.
- Optional AniList and TMDB configuration for features that require them.

## Development

Install dependencies from the repository root:

```sh
npm install
```

Start the mobile development server from `app/`:

```sh
npm run start
```

Alternatively, run the app from the repository root:

```sh
npm run app
```

Run the app with demo data, if the demo script is configured:

```sh
npm run demo
```

Demo mode provides a sample library for offline demonstrations.

## Build an Android APK

Use Expo Application Services (EAS) to create an installable Android APK.

From the `app/` directory:

```sh
eas build -p android --profile preview
```

The `eas.json` configuration defines the preview build profile. EAS provides a download link when the build completes.

Some native capabilities, including the home-screen widget, scheduled background work, and folder-based automatic backups, require a development or production build and cannot be fully tested in Expo Go.

## Project Structure

```text
app/
├── App.js                  # Root component, providers and navigation
├── src/
│   ├── navigation/         # Tab and stack navigation
│   ├── bootstrap/          # Initialization and storage integration
│   ├── screens/            # React Native screens
│   ├── components/         # Reusable UI components
│   └── services/           # Native and device-specific services
├── app.json                # Expo configuration
├── eas.json                # EAS build profiles
└── package.json            # App scripts and dependencies
```

### Main Components

- **`App.js`:** Initializes the root component, providers, and navigation container.
- **`src/navigation/`:** Defines the five-tab interface and navigation stacks for titles, search, welcome, and More pages.
- **`src/bootstrap/init.js`:** Connects the phone's AsyncStorage implementation to the shared data layer.
- **`src/screens/`:** Contains screen-level React Native interfaces.
- **`src/components/`:** Contains reusable mobile UI components.
- **`src/services/`:** Handles device-specific operations such as backups, notifications, calendar integration, and background tasks.

The complete architecture is documented in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Shared Logic

The mobile app imports shared functionality from `@voidpop/shared`, including:

- Library storage and management.
- Progress calculations and watch history.
- Completion tiers and statistics.
- AniList API integration and synchronization logic.
- Countdown formatting and airing schedules.
- Shared feature rules and utilities.

Shared functionality belongs in `../shared` whenever it can be used by both the mobile app and website. Platform-specific interfaces and native integrations remain in `app/`.

## Configuration

Environment variables are configured through `app/.env` for local development and the appropriate EAS environment settings for builds.

Common optional settings include:

```dotenv
EXPO_PUBLIC_VOIDPOP_API=http://YOUR_COMPUTER_IP:8787
EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
EXPO_PUBLIC_ANILIST_CLIENT_ID=your_anilist_client_id
```

Only configure variables required by the features being tested.

When testing on a physical phone, use the computer's local network IP address for a locally running backend. Do not use `localhost` unless the backend runs on the same device.

Keep environment files out of version control.

## AniList Authentication

AniList authentication is optional. Configure an AniList application client with the redirect URL required by the current mobile build.

The standalone app uses the configured redirect URI:

```text
voidation://auth
```

Expo Go may use a different redirect URI. Use the URI displayed by the app during development when configuring the AniList client.

See the root README for the full AniList setup instructions.

## Testing

Run the repository's shared and server checks from the root:

```sh
npm run check
```

Run the mobile bundle check:

```sh
npm run check:app
```

Test native functionality in an appropriate Android build, particularly after changes to notifications, background tasks, calendar integration, storage, widgets, or backup handling.

## Related Documentation

- [Main README](../README.md)
- [Architecture](../ARCHITECTURE.md)
- [Backend README](../server/README.md)

