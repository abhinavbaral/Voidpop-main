# VoidPop

**Anime, manga, and novel tracker with live episode countdowns, now with Movies & TV discovery.**

VoidPop is a cross-platform tracking application with an Android app and a website built around shared business logic. It combines personal progress tracking, airing schedules, title discovery, and community verdicts in one place.

VoidPop is designed to work without registration or API keys for basic anime and manga tracking. Accounts, AniList synchronization, and cloud features are optional.

## Features

### Anime, Manga, and Novel Tracking

- **Live countdowns:** Track the next episode of every airing anime in the library.
- **Weekly schedule:** View upcoming episodes grouped by day in the local time zone.
- **Progress tracking:** Record episodes watched and chapters read, with limits based on released episodes or available chapter counts where supported.
- **Library statuses:** Track anime as Watching, Completed, Plan to Watch, On Hold, or Dropped. Manga and novels have corresponding reading statuses.
- **Multiple origins and formats:** Explore Japanese, Korean, and Chinese anime, manga, manhwa, manhua, light novels, web novels, and related formats.
- **Watching This Season:** Track aired but unwatched episodes for currently watched anime. New episodes are added automatically.
- **History:** Review episodes that aired during the previous 14 days for followed titles.
- **Delayed episodes:** Identify schedule changes and retain the original release date.
- **AniList import:** Import public lists by username without an API key.
- **Two-way AniList sync:** Optionally synchronize supported list statuses and progress with AniList.
- **Library search and sorting:** Find titles by name and sort by recently updated, alphabetical order, airing time, or episodes to catch up on.

### Movies & TV

VoidPop includes a dedicated Movies & TV section inside Explore for discovering live-action movies and television series.

- Browse and search movies and series independently of the anime, manga, and novel library.
- Open dedicated title pages with Watchlist, Watched, and Void Verdict features.
- Participate in community verdicts and public discussions.
- Keep live-action tracking separate from the existing anime and manga progress system.

Live movie and television metadata is provided through TMDB and requires a TMDB API key.

### Void Verdicts

VoidPop uses four verdicts instead of conventional star ratings:

- **Peak:** An outstanding experience.
- **Dive In:** Worth starting.
- **One Time:** Worth experiencing once.
- **Void It:** Not recommended.

Each verdict can include up to three vibes. Verdicts can also be shared as image cards.

Community verdict distributions remain hidden until a title has received at least 20 verdicts. Recommendations can suggest titles based on existing verdicts, such as "Peak like X," "Dive In like X," and "One Time like X." Titles marked Void It do not generate recommendations.

### Explore and Browse

Explore provides discovery tools for finding new titles by:

- Origin and region.
- Season and year.
- Popularity.
- Genre and studio, where supported.
- Media type and format.

Titles already in the library or marked Excited are excluded from Explore results where supported, keeping discovery focused on new titles.

The Season chart groups anime by format and provides countdowns and one-tap Plan to Watch actions.

### Progress, History, and Statistics

- Update progress directly from the Library.
- Mark episodes watched from History.
- See when new episodes are waiting.
- Receive a verdict prompt after marking the final available episode watched.
- Maintain a dated watch log for progress changes and statistics.
- Progress through 15 completion-based tiers, from Newbie to Addicted.
- Search and sort the library by useful criteria.

Imported progress does not count as watch-log activity.

### Calendar and Sharing

- Add remaining episodes to a calendar.
- Open the phone's native event screen from the mobile app.
- Export schedules to Google Calendar or an `.ics` file from the website.
- Create shareable countdown images.
- Open trailers directly in YouTube.

Calendar exports include weekly events for the remaining episodes. YouTube trailers open externally because embedded playback may fail with Error 153.

### Notifications and Android Features

- Receive episode alerts for followed or Excited titles.
- Use the Android home-screen widget to display upcoming episodes for up to 30 followed shows.
- Run scheduled background tasks for backups, episode alerts, widget updates, and AniList synchronization where supported.

The native widget and certain background features require a built APK and are not available in Expo Go.

### Accounts and Community

Accounts are optional. Core personal tracking remains available without signing in.

The optional backend supports:

- Account registration and authentication.
- Public comments, replies, and likes.
- Community verdicts.
- Private cloud backups.
- Account deletion.

Comments and verdicts are associated with usernames rather than email addresses. The personal library remains local unless a backup is explicitly initiated.

### Offline Support and Backups

- Cache recent AniList responses on the device, subject to a storage limit.
- Reuse cached data when the internet is unavailable.
- Export and restore the library through More → Data and Storage.
- Configure scheduled Android backups every 12 hours, daily, or weekly.
- Keep the newest five automatic backups.
- Restore from a backup file or share a backup manually.

Folder-based automatic backups rely on native Android capabilities and should be tested in a built APK.

### Additional Features

- Appearance and display settings.
- Optional 24-hour clock and countdown badges.
- Genre and studio filters on supported screens.
- Official streaming and reading service links from AniList.
- Help, About, and data management pages.
- Bulk selection to move or remove titles from supported playlists.

## Tech Stack

- **Mobile:** Expo and React Native.
- **Website:** React and Vite.
- **Backend:** Node.js using built-in capabilities.
- **Shared logic:** JavaScript modules used by both platforms.
- **Anime and manga data:** AniList GraphQL API.
- **Movies and TV metadata:** TMDB.
- **Website storage:** `localStorage`.
- **Mobile storage:** AsyncStorage.

AniList's public GraphQL API supports public-data queries without an API key. AniList authentication requires an application client ID. Live TMDB metadata requires a separate TMDB API key.

## Project Structure

```text
voidpop/
├── app/          # Expo / React Native mobile application
├── web/          # React + Vite website
├── server/       # Accounts, comments, verdicts and cloud backup
└── shared/       # Shared application logic
    ├── api/      # AniList, TMDB and VoidPop server APIs
    ├── backend/  # Storage and data access
    ├── features/ # Shared feature rules
    ├── lib/      # Utilities and helpers
    ├── demo/     # Demo data
    └── test/     # Shared tests
```

Shared business rules live in `shared/` to keep the website and mobile app consistent. Storage access, progress calculations, countdown formatting, and other common logic are implemented once and reused wherever possible.

The platform-specific interfaces remain in `app/` and `web/`.

## Requirements

- Node.js 22.5 or later.
- npm with workspace support.
- Expo Go for supported mobile development workflows.
- An Android device or emulator for native testing.
- Optional AniList and TMDB configuration for features that require them.

## Installation and Development

Run commands from the repository root unless otherwise specified.

Install dependencies:

```sh
npm install
```

Start the website:

```sh
npm run web
```

The development website runs at `http://localhost:5173`.

Start the mobile app:

```sh
npm run app
```

Scan the Expo QR code with Expo Go when supported by the configured Expo SDK.

Run the website with demo data:

```sh
npm run web:demo
```

Run the mobile app with demo data:

```sh
npm run app:demo
```

Start the backend:

```sh
npm run server
```

The backend runs at `http://localhost:8787` by default.

These commands assume the corresponding scripts are configured in the root `package.json`.

## Backend Configuration

To test accounts, comments, community verdicts, and cloud backups locally, start the backend:

```sh
npm run server
```

Create `web/.env.local` for website development:

```dotenv
VITE_VOIDPOP_API=http://localhost:8787
```

Configure `app/.env` for mobile development:

```dotenv
EXPO_PUBLIC_VOIDPOP_API=http://YOUR_COMPUTER_IP:8787
```

Replace `YOUR_COMPUTER_IP` with the computer's local network IP address when testing on a physical phone. On the phone, `localhost` refers to the phone itself.

Environment files must remain outside version control. Production deployments should use the environment-variable settings provided by the hosting platform.

## TMDB Configuration

Live movie and television metadata requires a TMDB API key.

Website configuration:

```dotenv
VITE_TMDB_API_KEY=your_tmdb_api_key
```

Mobile configuration:

```dotenv
EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
```

Real credentials must not be committed to Git. If a credential needs to remain private, requests should be routed through a suitable backend rather than exposing the key in client-side code.

## Checks Before Committing

Run the shared and server checks:

```sh
npm run check
```

Run the mobile bundle check:

```sh
npm run check:app
```

The mobile check takes longer because it builds the app's JavaScript bundle.

Both checks should be run before committing significant changes. Changes involving navigation, storage, authentication, or native features should also be tested manually on the website and in an Android build.

For implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Where Data Is Stored

The personal library is stored as a JSON document on the device.

- **Website:** `localStorage`.
- **Mobile app:** AsyncStorage.

The shared storage implementation is in `shared/backend/storage.js`, and `shared/backend/store.js` provides the common library access layer.

The More → Data and Storage section supports library export and restoration.

### Local-First Storage

Personal tracking data stays on the device by default. Creating an account does not automatically upload the entire library.

Cloud backup is optional and begins only when explicitly initiated. Public comments and verdicts are visible to other users, while cloud backups remain private to the account owner.

Account deletion removes associated server-side data according to the backend's deletion behavior. Local backups and previously exported files may need to be removed separately.

### AniList Synchronization

AniList synchronization is independent of the optional VoidPop account system.

When authenticated with AniList, supported list statuses and progress can synchronize between VoidPop and AniList. Verdicts, Excited selections, and the local watch log remain on the device unless a separate feature explicitly handles them.

Public-list imports do not count as watched activity.

## Set Up AniList Sync

AniList authentication uses OAuth. Each deployment needs an AniList application configured with the appropriate redirect URL.

### 1. Create an AniList Client

Sign in at [AniList](https://anilist.co) and open Settings → Developer → Create New Client.

### 2. Configure the Mobile App

Set the application name to `VoidPop` and use this redirect URL:

```text
voidation://auth
```

Add the client ID to `app/.env`:

```dotenv
EXPO_PUBLIC_ANILIST_CLIENT_ID=your_mobile_client_id
```

For EAS builds, configure the variable in the appropriate build profile or EAS environment variables.

Build the APK after configuring the client ID if the installed binary requires it.

### 3. Configure the Website

Create a separate AniList client for the website.

Production redirect URL:

```text
https://YOUR_DOMAIN/auth/anilist
```

Local development redirect URL:

```text
http://localhost:5173/auth/anilist
```

Add the website client ID to `web/.env`:

```dotenv
VITE_ANILIST_CLIENT_ID=your_web_client_id
```

Configure the same variable in the production hosting environment.

### 4. Sign In

Open More → AniList → Sign in with AniList.

Expo Go may use a different redirect URL from a standalone APK. Use the redirect URL displayed by the app when configuring authentication for Expo Go.

Client IDs are not passwords, but environment files should still be excluded from version control.

## Deploy the Website

The website can be deployed to Vercel.

1. Import the repository into Vercel.
2. Leave the Root Directory set to the repository root.
3. Configure the required production environment variables.
4. Deploy the project.

The repository's `vercel.json` is intended to configure the build command, output directory, and rewrite rules for deep links, such as:

```text
/title/anime/16498
```

Verify the current Vercel configuration before deployment.

## Build the Android APK

Expo Application Services (EAS) can generate an installable Android APK.

Install the EAS CLI:

```sh
npm install -g eas-cli
```

Navigate to the app directory:

```sh
cd app
```

Sign in:

```sh
eas login
```

Build the preview APK:

```sh
eas build -p android --profile preview
```

Once the build completes, EAS provides a link to the generated artifact.

Native functionality, including the home-screen widget, scheduled background work, and folder-based backups, must be tested in a suitable development or production build. Expo Go does not support every native feature.

## Updating the App with EAS Update

EAS Update can deliver compatible JavaScript and asset changes without reinstalling the APK.

From `app/`, configure updates:

```sh
npx eas-cli update:configure
```

Build and install an APK configured for the correct update channel:

```sh
npx eas-cli build -p android --profile preview
```

After making compatible changes, publish an update:

```sh
npx eas-cli update --channel preview --message "Describe the changes"
```

Close and reopen VoidPop to check for the update.

A new APK is generally required when native dependencies, native configuration, permissions, or other native components change.

The runtime version and update channel must match the installed APK. Follow the current Expo EAS documentation when changing runtime-version policies or native dependencies.

## Project History

VoidPop began as a broader pop-culture tracking project that included anime, manga, movies, web series, social features, and accounts.

The current codebase brings together personal tracking and discovery for anime, manga, and novels with Movies & TV discovery, public comments, community verdicts, and optional accounts.

The Mesh social feed is no longer part of the project direction. Private title notes were replaced by comments. Existing notes are retained where supported and may still appear in Markdown exports.

The project focuses on a consistent, local-first tracking experience while keeping social and cloud features optional.

## Development Principles

- Implement shared business rules in `shared/`.
- Keep platform-specific interfaces in `app/` and `web/`.
- Preserve offline operation for core tracking features.
- Do not require an account for ordinary library use.
- Keep Movies & TV separate from the anime, manga, and novel library.
- Use Void Verdicts instead of star ratings.
- Hide community verdict distributions until at least 20 verdicts are available.
- Keep environment files and credentials out of version control.
- Test both the website and Android app after changing shared logic.

For additional technical documentation, see [ARCHITECTURE.md](ARCHITECTURE.md) and [server/README.md](server/README.md).
