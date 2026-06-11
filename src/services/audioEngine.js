class AudioEngine {
  constructor() {
    this.context = null;
    this.source = null;
    this.analyser = null;

    // === PRE-MASTERING STAGE ===
    this.hpf = null;
    this.subtractiveEq = null;

    // === MID-SIDE (M/S) PROCESSOR NODES ===
    this.msSplitter = null;
    this.midNode = null;
    this.sideNode = null;
    this.msMergerLeft = null;
    this.msMergerRight = null;
    this.msMerger = null;

    // === MID (CENTER) CHANNEL PATH ===
    this.midLowComp = null;
    this.midVocalComp = null;
    this.midExciter = null;         // Tube Saturation for Center Vocals

    // === SIDE (STEREO WIDTH) CHANNEL PATH ===
    this.sidechainDucker = null;    // Ducks 2kHz when vocals speak
    this.sideHaasDelay = null;
    this.sideHaasGain = null;

    // === ALGORITHMIC ROOM REVERB (Schroeder Space) ===
    this.reverbWet = null;
    this.reverbDry = null;
    this.combFilters = [];
    this.allpassFilters = [];

    // === POST-MASTERING OUTPUT STAGE ===
    this.softClipper = null;
    this.limiter = null;
    this.lufsGain = null;
  }

  makeTubeSaturationCurve(gain = 0.35) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      if (x < 0) {
        curve[i] = Math.exp(x) - 1;
      } else {
        curve[i] = 1 - Math.exp(-x);
      }
      curve[i] = curve[i] * gain;
    }
    return curve;
  }

  makeSoftClipperCurve() {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.tanh(x * 0.98);
    }
    return curve;
  }

  init(audioElement) {
    if (this.context) {
      this.resume();
      return;
    }

    // Android WebView needs explicit user gesture — check if we're in Capacitor
    const isCapacitor = window.Capacitor !== undefined;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    this.source = this.context.createMediaElementSource(audioElement);

    // === 1. HIGH-FIDELITY MASTERING EQ STAGE ===
    this.hpf = this.context.createBiquadFilter();
    this.hpf.type = 'highpass';
    this.hpf.frequency.value = 30; // Default Starting Highpass Frequency

    this.lowShelf = this.context.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = 100;
    this.lowShelf.gain.value = 0.0; // flat by default

    this.subtractiveEq = this.context.createBiquadFilter();
    this.subtractiveEq.type = 'peaking';
    this.subtractiveEq.frequency.value = 2500;
    this.subtractiveEq.Q.value = 1.0;
    this.subtractiveEq.gain.value = 0.0; // flat by default

    this.highShelf = this.context.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.value = 10000;
    this.highShelf.gain.value = 0.0; // flat by default

    // === 2. DUMMY COMPATIBILITY NODES ===
    // We instantiate these nodes so that existing references and controls in AudioService.js
    // do not throw errors or crashes, but we do NOT route audio through them to prevent phase/clipping issues.
    this.msSplitter = this.context.createChannelSplitter(2);
    this.midNode = this.context.createGain();
    this.midNode.gain.value = 1.0;
    this.sideNode = this.context.createGain();
    this.sideNode.gain.value = 1.0;
    this.msMergerLeft = this.context.createGain();
    this.msMergerRight = this.context.createGain();
    this.msMerger = this.context.createChannelMerger(2);

    this.midLowComp = this.context.createDynamicsCompressor();
    this.midVocalComp = this.context.createDynamicsCompressor();
    this.midExciter = this.context.createWaveShaper();
    this.midExciter.curve = this.makeTubeSaturationCurve(0.1);

    this.sidechainDucker = this.context.createBiquadFilter();
    this.sidechainDucker.type = 'peaking';
    this.sidechainDucker.frequency.value = 2000;
    this.sidechainDucker.gain.value = 0.0;

    this.sideHaasDelay = this.context.createDelay(0.1);
    this.sideHaasGain = this.context.createGain();
    this.sideHaasGain.gain.value = 0.0;

    this.reverbWet = this.context.createGain();
    this.reverbWet.gain.value = 0.0;
    this.reverbDry = this.context.createGain();
    this.reverbDry.gain.value = 1.0;

    // === 3. MASTERING LIMITER STAGE ===
    this.softClipper = this.context.createWaveShaper();
    this.softClipper.curve = this.makeSoftClipperCurve();
    this.softClipper.oversample = '4x';

    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -1.0; // Limit at -1dB to prevent digital clipping
    this.limiter.knee.value = 0; // Hard knee
    this.limiter.ratio.value = 20; // Infinity-like compression
    this.limiter.attack.value = 0.001; // Instant
    this.limiter.release.value = 0.05;

    this.lufsGain = this.context.createGain();
    this.lufsGain.gain.value = 0.85; // pull back to avoid clipping into the destination

    // === 4. ANALYSER STAGE ===
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;

    // === 5. DIRECT HIGH-FIDELITY STEREO SIGNAL PATH ===
    // source -> HPF -> LowShelf -> PeakingEQ (subtractiveEq) -> HighShelf -> Limiter -> LUFSGain -> Analyser -> destination
    this.source.connect(this.hpf);
    this.hpf.connect(this.lowShelf);
    this.lowShelf.connect(this.subtractiveEq);
    this.subtractiveEq.connect(this.highShelf);
    this.highShelf.connect(this.limiter);
    this.limiter.connect(this.lufsGain);
    this.lufsGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    // Android: resume on touch
    document.addEventListener('touchstart', () => this.resume(), { passive: true });
    
    // Capacitor-specific: app resume event
    if (isCapacitor) {
      document.addEventListener('resume', () => {
        this.resume();
        if (audioElement.paused && window.__echotune_was_playing) {
          audioElement.play().catch(() => {});
        }
      });
      
      document.addEventListener('pause', () => {
        window.__echotune_was_playing = !audioElement.paused;
      });
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  resume() {
    if (this.context?.state === 'suspended') this.context.resume();
  }

  setVolume(val) {
    if (this.lufsGain) {
      this.lufsGain.gain.value = val * 0.85; // was 1.15, way too hot
    }
  }
}

export const audioEngine = new AudioEngine();

