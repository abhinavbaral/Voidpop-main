# Shipping updates

Two ways a change reaches phones.

| | What it changes | How | Phones |
|---|---|---|---|
| Update (EAS Update) | JavaScript and images | the Publish update button (below) | download it in the app, tap Restart now |
| New build | anything, including native code | build the APK by hand, bump `version` in `app/app.json` | install the APK |

An update only reaches phones whose installed `version` equals the one in `app/app.json` (runtime version policy `appVersion`).
Anything that adds or upgrades a package with native code needs a new build and a new `version`; publishing it as an
update would crash phones on the old version, and with a new `version` they never receive it.

## One-time setup

1. expo.dev > Account settings > Access tokens > create a token. On GitHub, repo `abhinavbaral/voidation` > Settings > Secrets and
   variables > Actions > new repository secret `EXPO_TOKEN`.
2. Push `.github/workflows/publish-update.yml` to `main`.
3. For the button inside the app: GitHub > Settings > Developer settings > Fine-grained tokens > only this repository,
   permission Actions: Read and write, nothing else. The app asks for it the first time and keeps it on your phone only.

## Publishing

- In the app: More > About, tap the version 7 times, write what's new, pick `preview` (your APK copies) or `production`, Publish update.
  The card then shows the run's progress.
- Or on GitHub: Actions > Publish update > Run workflow.
- Or in a terminal: `gh workflow run publish-update.yml -f notes="Fix countdowns" -f channel=preview`.

The workflow lints, runs the tests and bundles the Android app first. If any of that fails nothing is published.
It publishes the code that is pushed to `main`, so push (or merge) before pressing the button.

## On phones

VoidPop looks for an update when it opens and when it returns to the front (at most every 6 hours), downloads it quietly and
shows the update sheet with your notes and Restart now. Later applies it the next time the app opens.
More > About > Check for updates does it on demand; Settings > Check for updates automatically turns the quiet check off.

## Caveats

- The button holds a GitHub token on the phone. Keep it to Actions: read and write on this one repository, so losing the phone
  loses nothing more than the ability to start this workflow.
- Production and preview are separate channels. Check which one your installed APK was built with (`eas.json`: preview builds use `preview`).
