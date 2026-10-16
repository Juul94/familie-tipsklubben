# Familietipsklubben

A football prediction app for a family betting pool on the Danish Superliga. Each round, members predict every match as home win, draw or away win (1 / X / 2), and the app tracks points, standings, statistics and a season-long Top 6 prediction. There is also a group chat and push notifications.

The app is published privately on iOS and Android and is used by a small group of family members every week of the season. It requires a login.

> The app's interface is in Danish.

## Background

Our family has run a Superliga betting pool for years, first on paper and then in spreadsheets. Collecting tips, chasing people who forgot, and calculating points by hand took a lot of work every week. I built this app to automate all of it. Everyone submits their own tips on their phone, the deadlines are enforced, points are calculated automatically, and reminders go out before each round closes.

## Features

**For players**
- **Tipping**: submit 1 / X / 2 predictions for every match in the open round before the deadline. Tips are locked once they are submitted.
- **Automatic draw fallback**: if a player misses the deadline, the missing matches are registered as draws, so nobody drops out of a round.
- **Standings**: a live leaderboard with the points from each round and the Top 6 bonus.
- **Top 6 prediction**: predict the final top 6 of the league. You get 3 points for each team in the exact position and 1 point for each team that finishes in the top 6 in a different position.
- **Statistics**: per-round performance and comparisons between players.
- **Rounds overview**: past and current rounds with results and everyone's tips once the round is closed.
- **Group chat** with real-time updates and push notifications.
- **Pool and rules**: the prize distribution and the rules of the game.
- **Confetti** celebration at the end of the season 🎉

**For admins**
- **Create rounds** with deadline and phase: regular season, championship round or relegation round.
- **Import fixtures from superliga.dk**: the app scrapes the official fixture list and fills in a round's matches automatically.
- **Enter results**, which updates the standings for everyone.
- **Send push notifications** to all players.
- **Enter the final Top 6** at the end of the season.

**Platform**
- **Push notifications** through Expo Push, plus local reminders scheduled before each round's deadline for players who haven't tipped yet.
- **Forced updates**: a minimum required version stored in Firestore. Outdated clients are blocked with a screen linking to the relevant store.
- **Over-the-air updates** through EAS Update.
- **Persistent login** with Firebase Auth and AsyncStorage.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | React Native 0.85, Expo SDK 56 |
| Language | TypeScript |
| Navigation | React Navigation (drawer, bottom tabs, native stack) |
| Backend | Firebase Authentication, Cloud Firestore (real-time listeners) |
| Notifications | `expo-notifications`, Expo Push API |
| Animations | `react-native-reanimated` |
| Build and release | EAS Build, EAS Submit, EAS Update |

## Architecture

```
App.tsx                      Version check (forced update) and auth gate
src/
  config/firebase.ts         Firebase initialization (config from env)
  contexts/AuthContext.tsx   Auth state and current user profile
  navigation/                Drawer and tab navigation, custom drawer
  screens/                   Home, Tips, Rounds, Standings, Stats, Top6, Chat, Pool, Rules, Admin, Login, ForceUpdate
  services/
    firestoreService.ts      Data access: users, rounds, tips, results, Top 6, chat, scoring
    notificationService.ts   Push registration, broadcast, deadline reminders
    superligaService.ts      Scraper for the superliga.dk fixture list
  types/                     Shared domain types
  constants/                 Colors and Superliga teams
```

### Data model (Firestore)

| Collection | Contents |
| --- | --- |
| `users` | Name, email, admin flag, push token |
| `rounds` | Round number, deadline, status (`open` → `closed` → `finished`), phase, matches |
| `tips` | One document per user per round with 1/X/2 predictions |
| `results` | Match results per round (`pending` / `partial` / `final`) |
| `top6_predictions` / `top6_results` | Season-long Top 6 predictions and the final table |
| `chat_messages` | Chat messages |
| `config` | App config, e.g. minimum required version |

### Scoring

- 1 point for each correct 1/X/2 prediction, counted only for rounds with final results.
- Top 6: 3 points for an exact position and 1 point for the right team in the wrong position.
- Standings are calculated on the client from tips, results and Top 6 data.

## Getting started

Requirements: Node.js 20+, an Expo account and a Firebase project with Authentication (email/password) and Firestore enabled.

```bash
npm install
cp .env.example .env           # fill in your Firebase config
```

1. Add your own `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) from the Firebase console to the project root. They are gitignored.
2. In `app.json`, set your own `bundleIdentifier`, `package`, `owner` and EAS `projectId`.
3. Start the app:

```bash
npm run dev-client             # with a development build
# or
npm start
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_*` | Firebase web config |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Privacy policy link in the side menu |
| `EXPO_PUBLIC_ADMIN_NAME`, `EXPO_PUBLIC_ADMIN_PHONE` | Contact shown on the rules screen |
| `EXPO_PUBLIC_ANDROID_STORE_URL`, `EXPO_PUBLIC_IOS_STORE_URL` | Store links on the force-update screen |

### Building and releasing

```bash
npm run build:android
npm run build:ios
npm run submit:ios             # needs your App Store Connect API key in ./keys (gitignored)
```

## Security note

This public repository contains no credentials. The Firebase config, service files, signing keys and App Store Connect keys are all supplied locally and gitignored.
