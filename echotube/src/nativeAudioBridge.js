// Bridge between the web player and the native audio engine used inside the
// Capacitor wrapper (android/ + ios/). In a plain web browser (including the
// Vercel-hosted PWA) every function here is a no-op / returns false so the
// existing <audio> based player keeps working untouched.
//
// Native engine: @mediagrid/capacitor-native-audio v3.
// The plugin plays one "primary" audio source per audioId
// (useForNotification = true), which is what shows in the OS lock-screen /
// notification. Switching tracks reuses the same audioId via changeAudioSource.

let pluginPromise = null;
let nativeReady = false;
let listenersReady = Promise.resolve();

const AUDIO_ID = 'echotube-main';

export const isNative =
  typeof window !== 'undefined' &&
  !!window.Capacitor &&
  typeof window.Capacitor.isNativePlatform === 'function' &&
  window.Capacitor.isNativePlatform();

function loadPlugin() {
  if (!isNative) return Promise.resolve(null);
  if (!pluginPromise) {
    pluginPromise = import('@mediagrid/capacitor-native-audio')
      .then((mod) => mod.AudioPlayer)
      .catch((err) => {
        console.error('Failed to load native audio plugin', err);
        pluginPromise = null;
        return null;
      });
  }
  return pluginPromise;
}

function metadataFor(song) {
  return {
    friendlyTitle: song.Title || 'Unknown',
    artistName: song.Artist || 'Unknown artist',
    albumTitle: song.Category || '',
    artworkSource: song.image || undefined,
  };
}

// Registers all native callbacks (idempotent). Must run before the first
// nativePlay so that onAudioReady is wired before initialize(). Returns an
// unsubscribe function.
export async function registerNativeEvents({ onEnded, onPlaying, onPaused, onReady }) {
  if (!isNative) return () => {};

  listenersReady = loadPlugin().then((NativeAudio) => {
    if (!NativeAudio) return null;
    const handlers = [
      NativeAudio.onAudioEnd({ audioId: AUDIO_ID }, () => onEnded && onEnded()),
      NativeAudio.onPlaybackStatusChange({ audioId: AUDIO_ID }, (result) => {
        if (result.status === 'playing') {
          if (onPlaying) onPlaying();
        } else if (result.status === 'paused' || result.status === 'stopped') {
          if (onPaused) onPaused();
        }
      }),
      NativeAudio.onAudioReady({ audioId: AUDIO_ID }, () => {
        nativeReady = true;
        if (onReady) onReady();
      }),
    ];
    return () => {
      handlers.forEach((h) => {
        if (h && typeof h.remove === 'function') h.remove();
      });
    };
  });

  return async () => {
    const unsub = await listenersReady;
    if (typeof unsub === 'function') unsub();
  };
}

export async function nativePlay(song, streamUrl) {
  if (!isNative) return false;
  await listenersReady.catch(() => {});
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return false;

  const meta = metadataFor(song);

  try {
    if (!nativeReady) {
      // First use: create the primary source, then buffer it.
      await NativeAudio.create({
        audioId: AUDIO_ID,
        audioSource: streamUrl,
        useForNotification: true,
        showSeekForward: false,
        showSeekBackward: false,
        ...meta,
      });
      await NativeAudio.initialize({ audioId: AUDIO_ID });
      nativeReady = true;
    } else {
      // Subsequent tracks: swap the source on the existing player.
      await NativeAudio.changeAudioSource({ audioId: AUDIO_ID, source: streamUrl });
      await NativeAudio.changeMetadata({ audioId: AUDIO_ID, ...meta });
    }
    await NativeAudio.play({ audioId: AUDIO_ID });
    return true;
  } catch (err) {
    console.error('nativePlay failed for', song.Title, err);
    return false;
  }
}

export async function nativePause() {
  if (!isNative) return;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return;
  await NativeAudio.pause({ audioId: AUDIO_ID }).catch(() => {});
}

export async function nativeResume() {
  if (!isNative) return;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return;
  await NativeAudio.play({ audioId: AUDIO_ID }).catch(() => {});
}

export async function nativeStop() {
  if (!isNative) return;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return;
  await NativeAudio.stop({ audioId: AUDIO_ID }).catch(() => {});
}

export async function nativeSeek(seconds) {
  if (!isNative) return;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return;
  await NativeAudio.seek({ audioId: AUDIO_ID, timeInSeconds: seconds }).catch(() => {});
}

export async function nativeGetCurrentTime() {
  if (!isNative) return 0;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return 0;
  try {
    const res = await NativeAudio.getCurrentTime({ audioId: AUDIO_ID });
    return res.currentTime || 0;
  } catch {
    return 0;
  }
}

export async function nativeGetDuration() {
  if (!isNative) return 0;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return 0;
  try {
    const res = await NativeAudio.getDuration({ audioId: AUDIO_ID });
    return res.duration || 0;
  } catch {
    return 0;
  }
}

export async function nativeDestroy() {
  if (!isNative) return;
  const NativeAudio = await loadPlugin();
  if (!NativeAudio) return;
  await NativeAudio.destroy({ audioId: AUDIO_ID }).catch(() => {});
  nativeReady = false;
}
