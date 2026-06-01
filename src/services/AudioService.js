// HTML5 Audio Service — web equivalent of expo-av with advanced dynamic equalizer and vocal clarity filters

class AudioService {
  constructor() {
    this.audio = new Audio();
    this.audioContext = null;
    this.gainNode = null;
    this.source = null;
    this.analyser = null;
    this.statusCallback = null;
    this._intervalId = null;

    // Advanced dynamic equalizing DSP nodes for pristine vocals
    this.highpassFilter = null;
    this.vocalBoostFilter = null;
    this.clarityFilter = null;
    this.compressor = null;
    this.isClarityModeActive = true; // Enabled by default for outstanding lyric crispness

    this._setupListeners();
    this._initAudioContext();
  }

  _initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.gainNode.gain.value = 1.0;

        // 1. Dynamics Compressor: Tightens instrumentation, brings low-volume vocal nuances forward
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-16, this.audioContext.currentTime); // -16dB compression threshold
        this.compressor.knee.setValueAtTime(8, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(3.5, this.audioContext.currentTime);
        this.compressor.attack.setValueAtTime(0.01, this.audioContext.currentTime);
        this.compressor.release.setValueAtTime(0.20, this.audioContext.currentTime);

        // 2. High-Pass Filter (HPF): Cuts sub-bass mud below 85 Hz to prevent bass masking of lower vocals
        this.highpassFilter = this.audioContext.createBiquadFilter();
        this.highpassFilter.type = 'highpass';
        this.highpassFilter.frequency.setValueAtTime(85, this.audioContext.currentTime);
        this.highpassFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);

        // 3. Peaking Presence Filter: Boosts vocal articulation and consonant definition at 2.5 kHz
        this.vocalBoostFilter = this.audioContext.createBiquadFilter();
        this.vocalBoostFilter.type = 'peaking';
        this.vocalBoostFilter.frequency.setValueAtTime(2500, this.audioContext.currentTime);
        this.vocalBoostFilter.Q.setValueAtTime(1.2, this.audioContext.currentTime); 
        this.vocalBoostFilter.gain.setValueAtTime(4.5, this.audioContext.currentTime); // +4.5dB vocal presence boost

        // 4. High Shelf Clarity Filter: Enhances vocal "air", breaths, and sibilance brilliance above 8 kHz
        this.clarityFilter = this.audioContext.createBiquadFilter();
        this.clarityFilter.type = 'highshelf';
        this.clarityFilter.frequency.setValueAtTime(8000, this.audioContext.currentTime);
        this.clarityFilter.gain.setValueAtTime(2.5, this.audioContext.currentTime); // +2.5dB breath air boost

        // Route source through DSP pipeline
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.highpassFilter);
        this.highpassFilter.connect(this.vocalBoostFilter);
        this.vocalBoostFilter.connect(this.clarityFilter);
        this.clarityFilter.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      }
    } catch (e) {
      console.warn('Web Audio API not fully supported:', e);
    }
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
      vocalClarityActive: this.isClarityModeActive
    });
  }

  setStatusCallback(cb) {
    this.statusCallback = cb;
  }

  setVocalClarityMode(active) {
    this.isClarityModeActive = active;
    if (!this.audioContext || !this.highpassFilter || !this.vocalBoostFilter || !this.clarityFilter || !this.compressor) return;

    const time = this.audioContext.currentTime;
    if (active) {
      // Re-enable clarity boosts
      this.highpassFilter.frequency.setValueAtTime(85, time);
      this.vocalBoostFilter.gain.setValueAtTime(4.5, time);
      this.clarityFilter.gain.setValueAtTime(2.5, time);
      this.compressor.threshold.setValueAtTime(-16, time);
    } else {
      // Flat bypass mode
      this.highpassFilter.frequency.setValueAtTime(20, time); // bypass low cut
      this.vocalBoostFilter.gain.setValueAtTime(0, time);     // flat midrange
      this.clarityFilter.gain.setValueAtTime(0, time);     // flat air shelf
      this.compressor.threshold.setValueAtTime(0, time);    // flat compression dynamics
    }

    // Trigger state callbacks immediately
    this._emit();
  }

  getVocalClarityMode() {
    return this.isClarityModeActive;
  }

  async loadAndPlay(uri) {
    if (this.statusCallback) this.statusCallback({ isBuffering: true, error: null });

    // Resume audio context if suspended (browser security policy)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
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
