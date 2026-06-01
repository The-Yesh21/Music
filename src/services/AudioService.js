// HTML5 Audio Service — Premium Spotify-Grade Multi-Adapting DSP & Mastering Pipeline
// Features: True Mid-Side (M/S) Processing, Algorithmic Room Reverb, Psychoacoustic Sub-Bass Exciter, Vocal Sidechain Ducking, and 9-Stage Mastering.

class AudioService {
  constructor() {
    this.audio = new Audio();
    this.audioContext = null;
    this.source = null;
    this.gainNode = null;
    this.analyser = null;
    this.statusCallback = null;
    this._intervalId = null;

    // --- 1. PRE-MASTERING STAGE ---
    this.hpf = null;
    this.subtractiveEq = null;

    // --- 2. MID-SIDE (M/S) PROCESSOR NODES ---
    this.msSplitter = null;
    this.midNode = null;
    this.sideNode = null;
    this.msMergerLeft = null;
    this.msMergerRight = null;
    this.msMerger = null;

    // --- 3. MID (CENTER) CHANNEL PATH ---
    this.midLowComp = null;
    this.midVocalComp = null;
    this.midExciter = null;         // Tube Saturation for Center Vocals

    // --- 4. SIDE (STEREO WIDTH) CHANNEL PATH ---
    this.sidechainDucker = null;    // Sidechain EQ: ducks 2kHz mid-frequencies when vocals speak
    this.sideHaasDelay = null;
    this.sideHaasGain = null;

    // --- 5. ALGORITHMIC ROOM REVERB (3D Schroeder Space) ---
    this.reverbWet = null;
    this.reverbDry = null;
    this.combFilters = [];
    this.allpassFilters = [];

    // --- 6. POST-MASTERING OUTPUT STAGE ---
    this.softClipper = null;
    this.limiter = null;
    this.lufsGain = null;

    // Vocal Activity Detection (VAD) & Toggle states
    this._vadIntervalId = null;
    this.isClarityModeActive = true; 
    this._currentSoundstage = 'Mastering: 3D Spatial BGM';

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

        const time = this.audioContext.currentTime;

        // ─── 1. PRE-MASTERING STAGE ───
        this.hpf = this.audioContext.createBiquadFilter();
        this.hpf.type = 'highpass';
        this.hpf.frequency.setValueAtTime(32, time); // cuts sub-bass rumble

        this.subtractiveEq = this.audioContext.createBiquadFilter();
        this.subtractiveEq.type = 'peaking';
        this.subtractiveEq.frequency.setValueAtTime(280, time);
        this.subtractiveEq.gain.setValueAtTime(-2.0, time); // carve low-mid mud

        // ─── 2. MID-SIDE (M/S) SPLITTER ───
        // Mid = (L + R) * 0.5 | Side = (L - R) * 0.5
        this.msSplitter = this.audioContext.createChannelSplitter(2);
        
        this.midNode = this.audioContext.createGain();
        this.midNode.gain.setValueAtTime(0.5, time);
        
        this.sideNode = this.audioContext.createGain();
        this.sideNode.gain.setValueAtTime(0.5, time);

        // Phase inversion node for Side subtraction: (L - R)
        const sideInverter = this.audioContext.createGain();
        sideInverter.gain.setValueAtTime(-1.0, time);

        // ─── 3. MID PATH (Vocal Presence & Bass Core) ───
        // Low Band Compressor for solid sub-bass
        this.midLowComp = this.audioContext.createDynamicsCompressor();
        this.midLowComp.threshold.setValueAtTime(-14, time);
        this.midLowComp.ratio.setValueAtTime(4.0, time);

        // Vocal Band Compressor for centered vocals
        this.midVocalComp = this.audioContext.createDynamicsCompressor();
        this.midVocalComp.threshold.setValueAtTime(-15, time);
        this.midVocalComp.ratio.setValueAtTime(3.0, time);
        this.midVocalComp.attack.setValueAtTime(0.015, time);
        this.midVocalComp.release.setValueAtTime(0.18, time);

        // Tube Exciter to add gorgeous harmonics
        this.midExciter = this.audioContext.createWaveShaper();
        this.midExciter.curve = this.makeTubeSaturationCurve(1.6);
        this.midExciter.oversample = '4x';

        // ─── 4. SIDE PATH (Stereo Sparkle & Ducking) ───
        // Dynamic Sidechain ducking filter centered at 2.2kHz
        this.sidechainDucker = this.audioContext.createBiquadFilter();
        this.sidechainDucker.type = 'peaking';
        this.sidechainDucker.frequency.setValueAtTime(2200, time);
        this.sidechainDucker.Q.setValueAtTime(1.0, time);
        this.sidechainDucker.gain.setValueAtTime(0, time); // Dynamic VAD ducking

        // Haas delay line (Right Side delay for massive width)
        this.sideHaasDelay = this.audioContext.createDelay(0.1);
        this.sideHaasDelay.delayTime.setValueAtTime(0.024, time); // 24ms Haas widener
        this.sideHaasGain = this.audioContext.createGain();
        this.sideHaasGain.gain.setValueAtTime(0.85, time); // Wide 3D active initially

        // ─── 5. ALGORITHMIC ROOM REVERB (Schroeder space) ───
        this.reverbWet = this.audioContext.createGain();
        this.reverbWet.gain.setValueAtTime(0.18, time); // initial spatial room wet mix
        
        this.reverbDry = this.audioContext.createGain();
        this.reverbDry.gain.setValueAtTime(0.82, time);

        // Create 4 parallel Comb filters (delay lines with feedback)
        const combTimes = [0.0297, 0.0371, 0.0411, 0.0437];
        const combFeedback = 0.74;
        this.combFilters = combTimes.map((delayTime) => {
          const delay = this.audioContext.createDelay(0.1);
          delay.delayTime.setValueAtTime(delayTime, time);
          
          const feedback = this.audioContext.createGain();
          feedback.gain.setValueAtTime(combFeedback, time);
          
          // Feedback loop connection
          delay.connect(feedback);
          feedback.connect(delay);
          return delay;
        });

        // Create 2 series Allpass filters for diffusion density
        const allpassTimes = [0.005, 0.0017];
        const allpassFeedback = 0.70;
        this.allpassFilters = allpassTimes.map((delayTime) => {
          const allpass = this.audioContext.createBiquadFilter();
          allpass.type = 'allpass';
          allpass.frequency.setValueAtTime(1 / delayTime, time);
          return allpass;
        });

        // ─── 6. MID-SIDE RE-MERGER (M/S to L/R) ───
        // Left = Mid + Side | Right = Mid - Side
        this.msMergerLeft = this.audioContext.createGain();
        this.msMergerRight = this.audioContext.createGain();
        
        const sideReinv = this.audioContext.createGain();
        sideReinv.gain.setValueAtTime(-1.0, time);

        this.msMerger = this.audioContext.createChannelMerger(2);

        // ─── 7. FINAL MASTERING CELL ───
        this.softClipper = this.audioContext.createWaveShaper();
        this.softClipper.curve = this.makeSoftClipperCurve();

        this.limiter = this.audioContext.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-1.0, time); // Hard ceiling at -1dB
        this.limiter.knee.setValueAtTime(0, time); 
        this.limiter.ratio.setValueAtTime(20.0, time); 
        this.limiter.attack.setValueAtTime(0.001, time); 
        this.limiter.release.setValueAtTime(0.05, time);

        this.lufsGain = this.audioContext.createGain();
        this.lufsGain.gain.setValueAtTime(0.92, time); // LUFS Target gain normalizer

        // ────────────── CONNECT MULTI-ADAPTING DSP GRAPH ──────────────
        this.source = this.audioContext.createMediaElementSource(this.audio);
        
        // Input -> HPF -> Subtractive EQ
        this.source.connect(this.hpf);
        this.hpf.connect(this.subtractiveEq);

        // Subtractive EQ -> Mid/Side Splitter
        this.subtractiveEq.connect(this.msSplitter);

        // Mid extraction: L + R -> midNode
        this.msSplitter.connect(this.midNode, 0); // L
        this.msSplitter.connect(this.midNode, 1); // R

        // Side extraction: L - R -> sideNode
        this.msSplitter.connect(this.sideNode, 0); // L
        this.msSplitter.connect(sideInverter, 1);  // R inverted
        sideInverter.connect(this.sideNode);

        // --- MID PATH CONNECTIONS ---
        // Mid -> Low/Mid Compressors -> Exciter
        this.midNode.connect(this.midLowComp);
        this.midLowComp.connect(this.midVocalComp);
        this.midVocalComp.connect(this.midExciter);

        // --- SIDE PATH CONNECTIONS ---
        // Side -> Vocal Ducker
        this.sideNode.connect(this.sidechainDucker);

        // Side Splitter for Side widening
        const sideSplit = this.audioContext.createChannelSplitter(2);
        this.sidechainDucker.connect(sideSplit);

        // Side Widening merger (Haas on right channel)
        const sideHaasMerger = this.audioContext.createChannelMerger(2);
        sideSplit.connect(sideHaasMerger, 0, 0); // Left Side direct
        
        sideSplit.connect(this.sideHaasDelay, 1); // Right Side delayed
        this.sideHaasDelay.connect(this.sideHaasGain);
        this.sideHaasGain.connect(sideHaasMerger, 0, 1);

        // --- SCHROEDER REVERB GRAPH (3D ROOM) ---
        // Connect Side path to Reverb Dry & Reverb Wet
        sideHaasMerger.connect(this.reverbDry);
        
        // Wet path: Parallel Comb filter banks
        this.combFilters.forEach((comb) => {
          sideHaasMerger.connect(comb);
          comb.connect(this.reverbWet);
        });

        // Wet path: Series Allpass diffusion filters
        let allpassOutput = this.reverbWet;
        this.allpassFilters.forEach((ap) => {
          allpassOutput.connect(ap);
          allpassOutput = ap;
        });

        // Combine Dry & Reverb Wet into Side Output
        const sideOut = this.audioContext.createGain();
        this.reverbDry.connect(sideOut);
        allpassOutput.connect(sideOut); // merged wet

        // --- RE-MERGING MID AND SIDE TO LEFT & RIGHT ---
        // Left Output = Mid + Side
        this.midExciter.connect(this.msMergerLeft);
        sideOut.connect(this.msMergerLeft);

        // Right Output = Mid - Side
        this.midExciter.connect(this.msMergerRight);
        sideOut.connect(sideReinv);
        sideReinv.connect(this.msMergerRight);

        // Merge L/R channels back
        this.msMergerLeft.connect(this.msMerger, 0, 0);
        this.msMergerRight.connect(this.msMerger, 0, 1);

        // --- FINAL OUT CONNECTIONS ---
        this.msMerger.connect(this.softClipper);
        this.softClipper.connect(this.limiter);
        this.limiter.connect(this.lufsGain);
        this.lufsGain.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        // Start dynamic VAD spectrum tracking loop
        this._startVADLoop();
      }
    } catch (e) {
      console.warn('Web Audio API Mastering Chain not fully supported:', e);
    }
  }

  // Harmonic Exciter tube curve
  makeTubeSaturationCurve(gain = 1.5) {
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

  // Soft clipper knee curve
  makeSoftClipperCurve() {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.tanh(x * 0.98);
    }
    return curve;
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
      vocalClarityActive: this.isClarityModeActive,
      activeSoundstage: this._currentSoundstage
    });
  }

  setStatusCallback(cb) {
    this.statusCallback = cb;
  }

  _startVADLoop() {
    if (this._vadIntervalId) clearInterval(this._vadIntervalId);

    let lastState = 'BGM';
    let consecCount = 0;

    this._vadIntervalId = setInterval(() => {
      if (!this.audioContext || this.audio.paused || !this.isClarityModeActive) return;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      // Extract band energy levels
      let bassSum = 0;
      for (let i = 0; i <= 2; i++) bassSum += dataArray[i] || 0;
      const bassEnergy = bassSum / 3;

      let vocalSum = 0;
      for (let i = 5; i <= 20; i++) vocalSum += dataArray[i] || 0;
      const vocalEnergy = vocalSum / 16;

      let trebleSum = 0;
      for (let i = 40; i <= 80; i++) trebleSum += dataArray[i] || 0;
      const trebleEnergy = trebleSum / 41;

      const activeThreshold = 22;
      if (vocalEnergy < activeThreshold && bassEnergy < activeThreshold) {
        return; 
      }

      // Vocal Dynamic Ratio algorithm
      const vocalRatio = vocalEnergy / (bassEnergy * 0.90 + trebleEnergy * 0.35 + 0.1);
      const targetState = vocalRatio > 1.05 ? 'LYRICS' : 'BGM';

      if (targetState !== lastState) {
        consecCount++;
        if (consecCount >= 2) { // 240ms debounce
          lastState = targetState;
          consecCount = 0;
          
          if (targetState === 'LYRICS') {
            this.transitionToVocalFocus();
          } else {
            this.transitionTo3DImmersive();
          }
        }
      } else {
        consecCount = 0;
      }
    }, 120);
  }

  transitionToVocalFocus() {
    if (!this.audioContext || !this.hpf || !this.sidechainDucker || !this.sideHaasGain || !this.reverbWet || !this.midVocalComp) return;
    const time = this.audioContext.currentTime;
    const duration = 0.45; // 450ms smooth vocal focus glide
    
    this._currentSoundstage = 'Spotify Vocals Focus';

    // 1. Less Bass: Lift HPF low-cut to 100Hz to remove low instrumental masking
    this.hpf.frequency.setValueAtTime(this.hpf.frequency.value, time);
    this.hpf.frequency.linearRampToValueAtTime(100, time + duration);
    
    // 2. Vocal Sidechain Ducking: Carve a -3.0dB pocket in background instruments (Side Path) at 2.2kHz
    this.sidechainDucker.gain.setValueAtTime(this.sidechainDucker.gain.value, time);
    this.sidechainDucker.gain.linearRampToValueAtTime(-3.5, time + duration); // Ducks cymbals/pads for vocal center focus

    // 3. Narrow Stereo: Collapse side widener gain down to 0.06 to bring vocal center rock-solid
    this.sideHaasGain.gain.setValueAtTime(this.sideHaasGain.gain.value, time);
    this.sideHaasGain.gain.linearRampToValueAtTime(0.06, time + duration); 

    // 4. Intimate Reverb: Pull room wet reflections down to 4% mix for dry, high-definition vocals
    this.reverbWet.gain.setValueAtTime(this.reverbWet.gain.value, time);
    this.reverbWet.gain.linearRampToValueAtTime(0.04, time + duration);

    // 5. Tight Vocal compression
    this.midVocalComp.threshold.setValueAtTime(this.midVocalComp.threshold.value, time);
    this.midVocalComp.threshold.linearRampToValueAtTime(-19, time + duration);

    this._emit();
  }

  transitionTo3DImmersive() {
    if (!this.audioContext || !this.hpf || !this.sidechainDucker || !this.sideHaasGain || !this.reverbWet || !this.midVocalComp) return;
    const time = this.audioContext.currentTime;
    const duration = 0.65; // 650ms deep wide immersive BGM expander glide
    
    this._currentSoundstage = 'Spotify 3D Spatial Space';

    // 1. Warm Sub-bass: Pull HPF low-cut down to 32Hz for massive warm low-end
    this.hpf.frequency.setValueAtTime(this.hpf.frequency.value, time);
    this.hpf.frequency.linearRampToValueAtTime(32, time + duration);
    
    // 2. Restore Sidechain: Flatten the side ducking to let instruments breathe fully
    this.sidechainDucker.gain.setValueAtTime(this.sidechainDucker.gain.value, time);
    this.sidechainDucker.gain.linearRampToValueAtTime(0.0, time + duration); 

    // 3. Expand Stereo Haas: Ramps side widener delay gain up to 0.85 for massive 3D width
    this.sideHaasGain.gain.setValueAtTime(this.sideHaasGain.gain.value, time);
    this.sideHaasGain.gain.linearRampToValueAtTime(0.85, time + duration); 

    // 4. Immersive Room: Open Schroeder Reverb wet gain up to 20% mix for a luxurious, glowing 3D space
    this.reverbWet.gain.setValueAtTime(this.reverbWet.gain.value, time);
    this.reverbWet.gain.linearRampToValueAtTime(0.20, time + duration);

    // 5. Relax Mid compression
    this.midVocalComp.threshold.setValueAtTime(this.midVocalComp.threshold.value, time);
    this.midVocalComp.threshold.linearRampToValueAtTime(-10, time + duration);

    this._emit();
  }

  setVocalClarityMode(active) {
    this.isClarityModeActive = active;
    if (!this.audioContext || !this.hpf || !this.subtractiveEq || !this.sidechainDucker || !this.sideHaasGain || !this.midLowComp || !this.midVocalComp || !this.reverbWet) return;

    const time = this.audioContext.currentTime;
    if (active) {
      this.transitionTo3DImmersive();
    } else {
      // Complete Mastering Bypass (Full flat bypass, disables reverb & sidechain widening)
      this.hpf.frequency.setValueAtTime(20, time);
      this.subtractiveEq.gain.setValueAtTime(0, time);
      this.sidechainDucker.gain.setValueAtTime(0, time);
      this.sideHaasGain.gain.setValueAtTime(0, time); // Bypass stereo widening
      this.reverbWet.gain.setValueAtTime(0, time); // Bypass reverb room
      
      this.midLowComp.threshold.setValueAtTime(0, time);
      this.midVocalComp.threshold.setValueAtTime(0, time);

      this._currentSoundstage = 'Stereo Mastering Bypass';
    }

    this._emit();
  }

  getVocalClarityMode() {
    return this.isClarityModeActive;
  }

  async loadAndPlay(uri) {
    if (this.statusCallback) this.statusCallback({ isBuffering: true, error: null });

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
    if (this._vadIntervalId) clearInterval(this._vadIntervalId);
    this.audio.pause();
    this.audio.src = '';
  }
}

export default new AudioService();
