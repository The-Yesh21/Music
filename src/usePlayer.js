/**
 * @deprecated This hook (usePlayer.js) is NOT used anywhere in the application.
 * The actual player logic lives in MusicContext.jsx + AudioService.js.
 * This file is kept for reference only. Do NOT import or use it.
 *
 * Bugs that were here (now documented for reference):
 * - BUG-03: Called saavn.dev directly (CORS blocked in browser) instead of proxy
 * - BUG-04: Called audioEngine.resume() before audio.play() resolved
 * - BUG-09: Stale closure on canplay captured old song metadata
 * - BUG-23: This file was never imported by any component
 */

// This file is intentionally left as a stub.
// See src/context/MusicContext.jsx and src/services/AudioService.js for the real player logic.
export default function usePlayer() {
  // No-op — not in use
}
