# Familietipsklubben — Superliga Prediction App (Expo)

Expo SDK 56, React Native 0.85, React 19, TypeScript strict, npm.
Navigation: React Navigation 7 (drawer + bottom tabs + native stack). Backend: Firebase Auth + Cloud Firestore (client SDK, no custom server). Notifications: `expo-notifications` + Expo Push API. Animations: Reanimated 4. Release: EAS Build / Submit / Update.
The UI language is Danish. Keep all user-facing text in Danish.

Expo has breaking changes compared to older SDKs. Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before using any Expo API.

## Project Structure

```
App.tsx                  # Root: version gate (ForceUpdateScreen) → auth gate (LoginScreen / AppNavigator)
src/
├── config/firebase.ts   # Firebase init; config comes from EXPO_PUBLIC_FIREBASE_* env vars
├── contexts/            # AuthContext: Firebase user + Firestore profile (isAdmin), runs login side effects
├── navigation/          # AppNavigator: drawer with custom content; Admin is shown only when user.isAdmin
├── screens/             # One file per screen (Home, Tips, Rounds, Standings, Stats, Top6, Chat, Pool, Rules, Admin, Login, ForceUpdate)
├── services/
│   ├── firestoreService.ts    # ALL Firestore reads/writes + scoring (calculateStandings, calculateTop6Points)
│   ├── notificationService.ts # Push token registration, broadcast via Expo Push, local deadline reminders
│   └── superligaService.ts    # Scrapes superliga.dk/kampprogram and maps team names to app names
├── components/          # Shared UI (Confetti, DrawerToggle)
├── constants/           # Colors (theme), Teams (SUPERLIGA_TEAMS)
└── types/index.ts       # Domain types: User, Round, Match, Tip, Prediction, RoundResult, Top6*
```

## Commands

- `npm start` / `npm run dev-client`: start Metro (Expo Go / development build)
- `npx tsc --noEmit`: type check (there is no lint script)
- `npm run build:android` / `npm run build:ios` / `npm run submit:ios`: EAS build and submit
- `npm run clean`: `expo prebuild --clean`. `/android` and `/ios` are generated, so never edit them by hand.

## Domain

- **Round lifecycle**: `open` → `closed` → `finished`. Phases: `regular`, `championship` and `relegation`, because the Superliga splits into two groups after the regular season.
- **Tips**: one document per user per round in `tips`, containing a 1/X/2 `Prediction` per `matchId`. Tips cannot be changed after they are submitted.
- **Missed deadline**: `autoFillMissedTips()` runs on login and fills in `x` (draw) for every user without tips in an expired open round. Don't break this. Players rely on it.
- **Scoring**: 1 point per correct 1/X/2, counted only for results with `status: 'final'`. Top 6: 3 points for an exact position, 1 point for the right team in the wrong position. All scoring lives in `firestoreService.ts`.
- **Forced update**: `App.tsx` compares the app version with the minimum version in Firestore (`config` collection) and blocks outdated clients.
- **Accounts** are created outside the app. There is no sign-up flow, only login.

## Key Patterns

- All Firestore access goes through `src/services/firestoreService.ts`. Don't call `collection()`/`doc()` from screens.
- Use the `subscribeTo*` helpers (`onSnapshot`) for live data (rounds, tips, chat), and always return the unsubscribe function from `useEffect`.
- Deadlines can be a Firestore `Timestamp`, a `Date` or a string. Normalize them the way the existing code does before comparing.
- Admin-only UI is gated on `user.isAdmin` from `useAuth()`. Admin actions (create a round, enter results, send push, set the final Top 6) live in `AdminScreen`.
- Login side effects (push registration, reminders, auto-fill) belong in `AuthContext`, not in screens.
- The superliga.dk scraper depends on the site's HTML structure. If imports break, check `superligaService.ts` and `TEAM_NAME_MAP` first.

## Rules

### Code Style

- All code must pass `npx tsc --noEmit`.
- Colors come from `src/constants/Colors.ts`. Don't add new inline hex values.
- Shared types go in `src/types/index.ts`.
- Use team names from `SUPERLIGA_TEAMS`. Never hardcode team strings in screens.
- Search for an existing service function or component before creating a new one.

### Secrets & Config

- Never commit secrets: `google-services.json`, `GoogleService-Info.plist`, Firebase Admin SDK keys, App Store Connect `.p8` keys, `.env`. They are all gitignored.
- Runtime config is read from `EXPO_PUBLIC_*` env vars. Document new variables in `.env.example` with empty values.
- No personal data in source: names, phone numbers, emails and store links go in env vars.

### Releases

- Bump `version` in `app.json` for native changes. JS-only changes can ship through EAS Update (`runtimeVersion` policy is `appVersion`).
- Raise the minimum version in Firestore only after the new build is live in both stores.

### Safety

- Flag any change to scoring, deadlines or `autoFillMissedTips` before making it, because it changes the standings for real players.
- Flag any change to auth or to who counts as admin.
- Don't add, remove or upgrade dependencies unless asked. Use `npx expo install` so the versions match the SDK.
