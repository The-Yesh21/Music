class AudioEngine {
  constructor() {
    this.context = null;
    this.source = null;
    this.gainNode = null;
    this.compressor = null;
    this.eq = null;
    this.analyser = null;
  }

  init(audioElement) {
    if (this.context) return; // already initialized
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.context.createMediaElementSource(audioElement);

    // === DYNAMICS COMPRESSOR (reduces harsh peaks, like Spotify's loudness normalization) ===
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;  // dB - starts compressing here
    this.compressor.knee.value = 8;         // soft knee
    this.compressor.ratio.value = 3;        // 3:1 compression ratio
    this.compressor.attack.value = 0.003;   // fast attack
    this.compressor.release.value = 0.15;   // smooth release

    // === 3-BAND EQ (presence boost like Spotify's "normalized" sound) ===
    // Low shelf — gentle bass boost
    const bassFilter = this.context.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 120;
    bassFilter.gain.value = 2.5;

    // Mid peak — presence and clarity (+1.5dB at 2.5kHz)
    const midFilter = this.context.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 2500;
    midFilter.Q.value = 0.8;
    midFilter.gain.value = 1.5;

    // High shelf — air and brightness
    const highFilter = this.context.createBiquadFilter();
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 10000;
    highFilter.gain.value = 2;

    // === OUTPUT GAIN (normalize to -1 LUFS headroom) ===
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 0.92;

    // === ANALYSER (for VAD loop and visualizer support) ===
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;

    // Chain: source → bass → mid → high → compressor → gain → analyser → output
    this.source
      .connect(bassFilter)
      .connect(midFilter)
      .connect(highFilter)
      .connect(this.compressor)
      .connect(this.gainNode)
      .connect(this.analyser)
      .connect(this.context.destination);

    // Resume context on user interaction (browser autoplay policy)
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  resume() {
    if (this.context?.state === 'suspended') this.context.resume();
  }

  setVolume(val) {
    if (this.gainNode) this.gainNode.gain.value = val * 0.92;
  }
}

export const audioEngine = new AudioEngine();
