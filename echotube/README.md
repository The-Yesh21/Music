# EchoTube

Music player web app (React + Vite + PWA) with a native wrapper (Capacitor)
for reliable background/lock-screen playback on Android and iOS.

## Web / PWA

```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run preview    # preview the production build
npx oxlint src     # lint
```

Deployed to Vercel (serverless API lives in `api/`).

## Native build (background audio)

The app ships with a Capacitor wrapper (`android/` and `ios/`) that uses
[`@mediagrid/capacitor-native-audio`](https://github.com/mediagrid/capacitor-native-audio)
as the native audio engine. When running inside the wrapper, `src/nativeAudioBridge.js`
drives playback natively instead of the browser `<audio>` element, so audio keeps
playing when the screen is locked and the next track auto-advances.

The web `<audio>` player is untouched for the normal PWA/browser build.

### Add/update the native project

```bash
npm run build
npx cap sync
```

### Android (build with Android Studio on any OS)

Requirements: Android Studio (bundles the Android SDK), Java 17+.

1. Open the `android/` folder in Android Studio.
2. Wait for Gradle sync to finish (auto-downloads the SDK bits it needs).
3. Run ▶ on a device/emulator, or use Build > Build App Bundle(s) / APK(s).

Background playback needs: the `AudioPlayerService`
(`us.mediagrid.capacitorjs.plugins.nativeaudio.AudioPlayerService`,
`foregroundServiceType="mediaPlayback"`) in `AndroidManifest.xml`, plus the
`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, and `WAKE_LOCK`
permissions — all already configured.

### iOS (requires macOS + Xcode)

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Set your Apple team under target Signing & Capabilities.
3. Run on a device. `UIBackgroundModes: audio` is already configured in `Info.plist`.
