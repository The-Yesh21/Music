// HTML5 Audio Service — web equivalent of expo-av

class AudioService {
  constructor() {
    this.audio = new Audio();
    this.statusCallback = null;
    this._intervalId = null;
    this._setupListeners();
  }

  _setupListeners() {
    this.audio.addEventListener('timeupdate', () => this._emit());
    this.audio.addEventListener('ended', () => {
      if (this.statusCallback) this.statusCallback({ didJustFinish: true, isPlaying: false });
    });
    this.audio.addEventListener('play', () => this._emit());
    this.audio.addEventListener('pause', () => this._emit());
    this.audio.addEventListener('waiting', () => {
      if (this.statusCallback) this.statusCallback({ isBuffering: true });
    });
    this.audio.addEventListener('playing', () => {
      if (this.statusCallback) this.statusCallback({ isBuffering: false, isPlaying: true });
    });
    this.audio.addEventListener('error', (e) => {
      if (this.statusCallback) this.statusCallback({ error: 'Failed to load audio stream.' });
    });
  }

  _emit() {
    if (!this.statusCallback) return;
    this.statusCallback({
      isLoaded: true,
      isPlaying: !this.audio.paused,
      positionMillis: Math.floor(this.audio.currentTime * 1000),
      durationMillis: isNaN(this.audio.duration) ? 0 : Math.floor(this.audio.duration * 1000),
      didJustFinish: false,
    });
  }

  setStatusCallback(cb) {
    this.statusCallback = cb;
  }

  async loadAndPlay(uri) {
    if (this.statusCallback) this.statusCallback({ isBuffering: true, error: null });
    this.audio.src = uri;
    this.audio.load();
    try {
      await this.audio.play();
    } catch (e) {
      console.warn('AudioService.loadAndPlay:', e);
      if (this.statusCallback) this.statusCallback({ error: 'Playback failed. Please check your connection.', isBuffering: false });
    }
  }

  async play() {
    try { 
      await this.audio.play(); 
    } catch (e) {
      if (this.statusCallback) this.statusCallback({ error: 'Playback failed.' });
    }
  }

  async pause() {
    this.audio.pause();
  }

  async seekTo(millis) {
    this.audio.currentTime = millis / 1000;
  }

  async unload() {
    this.audio.pause();
    this.audio.src = '';
  }
}

export default new AudioService();
