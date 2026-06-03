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

  makeTubeSaturationCurve(gain = 1.3) {
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
    if (this.context) return; // already initialized
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    this.source = this.context.createMediaElementSource(audioElement);

    // 1. Pre-Mastering Stage
    this.hpf = this.context.createBiquadFilter();
    this.hpf.type = 'highpass';
    this.hpf.frequency.value = 32; // Default starting frequency

    this.subtractiveEq = this.context.createBiquadFilter();
    this.subtractiveEq.type = 'peaking';
    this.subtractiveEq.frequency.value = 250;
    this.subtractiveEq.Q.value = 0.5;
    this.subtractiveEq.gain.value = 0.0; // flat by default

    // Connect source to pre-mastering EQ
    this.source.connect(this.hpf);
    this.hpf.connect(this.subtractiveEq);

    // 2. Mid-Side Splitter (Split Stereo to Left/Right channels)
    this.msSplitter = this.context.createChannelSplitter(2);
    this.subtractiveEq.connect(this.msSplitter);

    // Reconstruct Mid Channel (M = 0.5 * L + 0.5 * R)
    const midL = this.context.createGain();
    midL.gain.value = 0.5;
    const midR = this.context.createGain();
    midR.gain.value = 0.5;

    this.msSplitter.connect(midL, 0); // Left channel to midL
    this.msSplitter.connect(midR, 1); // Right channel to midR

    const midSignal = this.context.createGain();
    midL.connect(midSignal);
    midR.connect(midSignal);

    // 3. Mid Channel Processing
    this.midLowComp = this.context.createDynamicsCompressor();
    this.midLowComp.threshold.value = -12;
    this.midLowComp.knee.value = 6;
    this.midLowComp.ratio.value = 2;
    this.midLowComp.attack.value = 0.05;
    this.midLowComp.release.value = 0.1;

    this.midVocalComp = this.context.createDynamicsCompressor();
    this.midVocalComp.threshold.value = -10;
    this.midVocalComp.knee.value = 4;
    this.midVocalComp.ratio.value = 3;
    this.midVocalComp.attack.value = 0.005; // fast attack for vocals
    this.midVocalComp.release.value = 0.08;

    this.midExciter = this.context.createWaveShaper();
    this.midExciter.curve = this.makeTubeSaturationCurve(1.3);
    this.midExciter.oversample = '4x';

    this.midNode = this.context.createGain();
    this.midNode.gain.value = 0.55; // default immersive spatial gain

    midSignal.connect(this.midLowComp);
    this.midLowComp.connect(this.midVocalComp);
    this.midVocalComp.connect(this.midExciter);
    this.midExciter.connect(this.midNode);

    // 4. Reconstruct Side Channel (S = 0.5 * L - 0.5 * R)
    const sideL = this.context.createGain();
    sideL.gain.value = 0.5;
    const sideRInvert = this.context.createGain();
    sideRInvert.gain.value = -0.5; // Phase invert the Right channel

    this.msSplitter.connect(sideL, 0); // Left channel to sideL
    this.msSplitter.connect(sideRInvert, 1); // Right channel to sideRInvert

    const sideSignal = this.context.createGain();
    sideL.connect(sideSignal);
    sideRInvert.connect(sideSignal);

    // 5. Side Channel Processing
    this.sidechainDucker = this.context.createBiquadFilter();
    this.sidechainDucker.type = 'peaking';
    this.sidechainDucker.frequency.value = 2000; // ducking upper mid frequency pocket
    this.sidechainDucker.Q.value = 1.0;
    this.sidechainDucker.gain.value = 0.0; // flat initially

    this.sideHaasDelay = this.context.createDelay(0.1);
    this.sideHaasDelay.delayTime.value = 0.018; // 18ms Haas widening delay

    this.sideHaasGain = this.context.createGain();
    this.sideHaasGain.gain.value = 0.85; // spatial default

    this.sideNode = this.context.createGain();
    this.sideNode.gain.value = 1.15; // default side gain

    sideSignal.connect(this.sidechainDucker);

    // Wide stereo / Haas widening parallel routing
    this.sidechainDucker.connect(this.sideNode);
    this.sidechainDucker.connect(this.sideHaasDelay);
    this.sideHaasDelay.connect(this.sideHaasGain);
    this.sideHaasGain.connect(this.sideNode);

    // 6. Schroeder Reverb stage (Algorithmic Room Reverb)
    this.reverbWet = this.context.createGain();
    this.reverbWet.gain.value = 0.22; // default immersive reverb mix

    this.reverbDry = this.context.createGain();
    this.reverbDry.gain.value = 1.0;

    // Connect midSignal to reverb dry path
    midSignal.connect(this.reverbDry);

    // Schroeder Comb Filters (Parallel feedback delay lines)
    const combDelays = [0.0297, 0.0371, 0.0411, 0.0437];
    const combFeedback = 0.72;
    this.combFilters = combDelays.map(delayTime => {
      const delay = this.context.createDelay(1.0);
      delay.delayTime.value = delayTime;
      const gain = this.context.createGain();
      gain.gain.value = combFeedback;
      
      delay.connect(gain);
      gain.connect(delay);
      return { input: delay, output: delay };
    });

    // Schroeder Allpass Filters (Series phase diffusers)
    const allpassFreqs = [347, 113];
    this.allpassFilters = allpassFreqs.map(freq => {
      const filter = this.context.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = freq;
      return filter;
    });

    const combMerger = this.context.createGain();
    combMerger.gain.value = 0.25; // Scale comb output to prevent clipping

    this.combFilters.forEach(cf => {
      midSignal.connect(cf.input);
      cf.output.connect(combMerger);
    });

    // Chain allpass filters in series
    let lastFilter = combMerger;
    this.allpassFilters.forEach(ap => {
      lastFilter.connect(ap);
      lastFilter = ap;
    });

    lastFilter.connect(this.reverbWet);

    // 7. Reconstruction (Mid-Side Merger)
    this.msMergerLeft = this.context.createGain();
    this.msMergerRight = this.context.createGain();

    // Left channel = M + S + ReverbDry + ReverbWet
    this.midNode.connect(this.msMergerLeft);
    this.sideNode.connect(this.msMergerLeft);
    this.reverbDry.connect(this.msMergerLeft);
    this.reverbWet.connect(this.msMergerLeft);

    // Right channel = M - S + ReverbDry + ReverbWet
    this.midNode.connect(this.msMergerRight);
    this.reverbDry.connect(this.msMergerRight);
    this.reverbWet.connect(this.msMergerRight);

    const sideInvert = this.context.createGain();
    sideInvert.gain.value = -1.0; // Invert side channel phase
    this.sideNode.connect(sideInvert);
    sideInvert.connect(this.msMergerRight);

    this.msMerger = this.context.createChannelMerger(2);
    this.msMergerLeft.connect(this.msMerger, 0, 0); // Left channel
    this.msMergerRight.connect(this.msMerger, 0, 1); // Right channel

    // 8. Post-Mastering Output Stage
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
    this.lufsGain.gain.value = 1.15; // Boost perceived loudness

    // 9. Analyser Stage
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;

    // Connect final mastering chain
    this.msMerger.connect(this.softClipper);
    this.softClipper.connect(this.limiter);
    this.limiter.connect(this.lufsGain);
    this.lufsGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  resume() {
    if (this.context?.state === 'suspended') this.context.resume();
  }

  setVolume(val) {
    if (this.lufsGain) {
      // Scale LUFS gain node based on user volume slider
      this.lufsGain.gain.value = val * 1.15;
    }
  }
}

export const audioEngine = new AudioEngine();

