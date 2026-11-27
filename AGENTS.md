# Repository Guidelines

EchoTube is a mood-based music player (categories: Happy, Lonely, Enjoyment). The React/Vite PWA lives in `echotube/`. Root-level Python scripts train labels and keep the bundled catalog in sync.

## Project Structure & Module Organization

`echotube/src/App.jsx` owns playback, search, likes, and cloud sync. Bundled catalog is `echotube/src/categorized_songs.json`. Stream search goes through `echotube/src/api/jiosaavn.js` (capped concurrency, cache, endpoint fallback). On web, playback uses `<audio>`; inside Capacitor, `echotube/src/nativeAudioBridge.js` drives `@mediagrid/capacitor-native-audio` for lock-screen/background audio. `echotube/src/hooks/useMediaSession.js` handles Media Session + wake lock for the PWA.

`echotube/api/songs.js` is the Vercel serverless API (Supabase `songs` table). Native builds call the deployed URL (`https://music-53zs.vercel.app/api/songs`) via CapacitorHttp (`echotube/capacitor.config.json`) because the WebView origin is `https://localhost`. Local labeling uses Flask `label_server.py` on port 5000 (`LOCAL_FILE_API` in `App.jsx`). `ml_engine.py` trains TF-IDF + Logistic Regression from `Top100Songs_Filled.xlsx` + `labels.json`; `sync_categorized.py` writes the JSON catalog.

Native shells: `echotube/android/` (`com.echotube.app`) and `echotube/ios/`.

## Build, Test, and Development Commands

From `echotube/`:

```bash
npm install
npm run dev          # Vite
npm run build        # dist/
npm run preview
npm run lint         # oxlint
npm run seed         # upload categorized_songs.json to Supabase (needs echotube/.env)
npx cap sync         # after build; copy web assets into native projects
```

Copy `echotube/.env.example` to `echotube/.env` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`). Vercel uses the same vars. From repo root: `python label_server.py` (Flask :5000); `python ml_engine.py` / `python sync_categorized.py` for catalog refresh.

## Coding Style & Naming Conventions

JSX/JS (no TypeScript). Oxlint with React + oxc plugins: `react/rules-of-hooks` is error; `react/only-export-components` is warn. Song identity is `Title::Artist` (lowercase). Keep `VALID_CATEGORIES` / `CATEGORIES` aligned across `App.jsx`, `api/songs.js`, and the Python scripts.

## Commit & Pull Request Guidelines

Recent history mixes conventional prefixes (`feat: …`) with short informal messages. Prefer a specific subject that states why (e.g. native playback, search throttling, cloud sync). There is no PR template.
