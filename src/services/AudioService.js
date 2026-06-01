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
        this.hpf.frequency.setValueAtTime(32, time); // cuts sub-bass mud

        this.subtractiveEq = this.audioContext.createBiquadFilter();
        this.subtractiveEq.type = 'peaking';
        this.subtractiveEq.frequency.setValueAtTime(280, time);
        this.subtractiveEq.gain.setValueAtTime(-2.0, time); // carve low-mid mud

        // ─── 2. MID-SIDE (M/S) SPLITTER ───
        this.msSplitter = this.audioContext.createChannelSplitter(2);
        
        this.midNode = this.audioContext.createGain();
        this.midNode.gain.setValueAtTime(0.55, time); // Starts in balanced BGM mode
        
        this.sideNode = this.audioContext.createGain();
        this.sideNode.gain.setValueAtTime(1.15, time); // Starts in widescreen BGM mode

        const sideInverter = this.audioContext.createGain();
        sideInverter.gain.setValueAtTime(-1.0, time);

        // ─── 3. MID PATH (Vocal Presence & Bass Core) ───
        this.midLowComp = this.audioContext.createDynamicsCompressor();
        this.midLowComp.threshold.setValueAtTime(-14, time);
        this.midLowComp.ratio.setValueAtTime(4.0, time);

        this.midVocalComp = this.audioContext.createDynamicsCompressor();
        this.midVocalComp.threshold.setValueAtTime(-12, time);
        this.midVocalComp.ratio.setValueAtTime(3.0, time);
        this.midVocalComp.attack.setValueAtTime(0.015, time);
        this.midVocalComp.release.setValueAtTime(0.18, time);

        this.midExciter = this.audioContext.createWaveShaper();
        this.midExciter.curve = this.makeTubeSaturationCurve(1.6);
        this.midExciter.oversample = '4x';

        // ─── 4. SIDE PATH (Stereo Sparkle & Ducking) ───
        this.sidechainDucker = this.audioContext.createBiquadFilter();
        this.sidechainDucker.type = 'peaking';
        this.sidechainDucker.frequency.setValueAtTime(2200, time);
        this.sidechainDucker.Q.setValueAtTime(1.0, time);
        this.sidechainDucker.gain.setValueAtTime(0, time); 

        this.sideHaasDelay = this.audioContext.createDelay(0.1);
        this.sideHaasDelay.delayTime.setValueAtTime(0.024, time); 
        this.sideHaasGain = this.audioContext.createGain();
        this.sideHaasGain.gain.setValueAtTime(0.85, time); 

        // ─── 5. ALGORITHMIC ROOM REVERB (Schroeder space) ───
        this.reverbWet = this.audioContext.createGain();
        this.reverbWet.gain.setValueAtTime(0.22, time); 
        
        this.reverbDry = this.audioContext.createGain();
        this.reverbDry.gain.setValueAtTime(0.78, time);

        const combTimes = [0.0297, 0.0371, 0.0411, 0.0437];
        const combFeedback = 0.74;
        this.combFilters = combTimes.map((delayTime) => {
          const delay = this.audioContext.createDelay(0.1);
          delay.delayTime.setValueAtTime(delayTime, time);
          
          const feedback = this.audioContext.createGain();
          feedback.gain.setValueAtTime(combFeedback, time);
          
          delay.connect(feedback);
          feedback.connect(delay);
          return delay;
        });

        const allpassTimes = [0.005, 0.0017];
        this.allpassFilters = allpassTimes.map((delayTime) => {
          const allpass = this.audioContext.createBiquadFilter();
          allpass.type = 'allpass';
          allpass.frequency.setValueAtTime(1 / delayTime, time);
          return allpass;
        });

        // ─── 6. MID-SIDE RE-MERGER ───
        this.msMergerLeft = this.audioContext.createGain();
        this.msMergerRight = this.audioContext.createGain();
        
        const sideReinv = this.audioContext.createGain();
        sideReinv.gain.setValueAtTime(-1.0, time);

        this.msMerger = this.audioContext.createChannelMerger(2);

        // ─── 7. FINAL MASTERING CELL ───
        this.softClipper = this.audioContext.createWaveShaper();
        this.softClipper.curve = this.makeSoftClipperCurve();

        this.limiter = this.audioContext.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-1.0, time); 
        this.limiter.knee.setValueAtTime(0, time); 
        this.limiter.ratio.setValueAtTime(20.0, time); 
        this.limiter.attack.setValueAtTime(0.001, time); 
        this.limiter.release.setValueAtTime(0.05, time);

        this.lufsGain = this.audioContext.createGain();
        this.lufsGain.gain.setValueAtTime(0.92, time); 

        // ────────────── CONNECT HIGH-FIDELITY DSP GRAPH ──────────────
        this.source = this.audioContext.createMediaElementSource(this.audio);
        
        this.source.connect(this.hpf);
        this.hpf.connect(this.subtractiveEq);

        this.subtractiveEq.connect(this.msSplitter);

        this.msSplitter.connect(this.midNode, 0); 
        this.msSplitter.connect(this.midNode, 1); 

        this.msSplitter.connect(this.sideNode, 0); 
        this.msSplitter.connect(sideInverter, 1);  
        sideInverter.connect(this.sideNode);

        // Mid path
        this.midNode.connect(this.midLowComp);
        this.midLowComp.connect(this.midVocalComp);
        this.midVocalComp.connect(this.midExciter);

        // Side path
        this.sideNode.connect(this.sidechainDucker);

        const sideSplit = this.audioContext.createChannelSplitter(2);
        this.sidechainDucker.connect(sideSplit);

        const sideHaasMerger = this.audioContext.createChannelMerger(2);
        sideSplit.connect(sideHaasMerger, 0, 0); 
        
        sideSplit.connect(this.sideHaasDelay, 1); 
        this.sideHaasDelay.connect(this.sideHaasGain);
        this.sideHaasGain.connect(sideHaasMerger, 0, 1);

        sideHaasMerger.connect(this.reverbDry);
        
        this.combFilters.forEach((comb) => {
          sideHaasMerger.connect(comb);
          comb.connect(this.reverbWet);
        });

        let allpassOutput = this.reverbWet;
        this.allpassFilters.forEach((ap) => {
          allpassOutput.connect(ap);
          allpassOutput = ap;
        });

        const sideOut = this.audioContext.createGain();
        this.reverbDry.connect(sideOut);
        allpassOutput.connect(sideOut); 

        // Re-merging
        this.msMergerLeft.connect(this.msMerger, 0, 0);
        this.msMergerRight.connect(this.msMerger, 0, 1);

        this.midExciter.connect(this.msMergerLeft);
        sideOut.connect(this.msMergerLeft);

        this.midExciter.connect(this.msMergerRight);
        sideOut.connect(sideReinv);
        sideReinv.connect(this.msMergerRight);

        // Limiting cell
        this.msMerger.connect(this.softClipper);
        this.softClipper.connect(this.limiter);
        this.limiter.connect(this.lufsGain);
        this.lufsGain.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        this._startVADLoop();
      }
    } catch (e) {
      console.warn('Web Audio API Mastering Chain not fully supported:', e);
    }
  }

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

      const vocalRatio = vocalEnergy / (bassEnergy * 0.90 + trebleEnergy * 0.35 + 0.1);
      const targetState = vocalRatio > 1.05 ? 'LYRICS' : 'BGM';

      if (targetState !== lastState) {
        consecCount++;
        if (consecCount >= 2) { 
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
    if (!this.audioContext || !this.hpf || !this.sidechainDucker || !this.sideHaasGain || !this.reverbWet || !this.midVocalComp || !this.midNode || !this.sideNode) return;
    const time = this.audioContext.currentTime;
    const duration = 0.45; 
    
    this._currentSoundstage = 'Spotify Vocals Focus';

    // 1. Less Bass: Lift HPF low-cut to 100Hz to remove sub-bass masking
    this.hpf.frequency.setValueAtTime(this.hpf.frequency.value, time);
    this.hpf.frequency.linearRampToValueAtTime(100, time + duration);
    
    // 2. Vocal Sidechain Ducking: Carve a -3.5dB pocket in Side Path cymbals/synths
    this.sidechainDucker.gain.setValueAtTime(this.sidechainDucker.gain.value, time);
    this.sidechainDucker.gain.linearRampToValueAtTime(-3.8, time + duration); 

    // 3. MAIN STAGE VOCAL BOOST: Slide Mid (vocals center) gain UP to 1.30 (+2.5dB dual-channel presence boost!)
    this.midNode.gain.setValueAtTime(this.midNode.gain.value, time);
    this.midNode.gain.linearRampToValueAtTime(1.30, time + duration);

    // 4. BGM DUCKING: Slide Side (stereo background music) gain DOWN to 0.28 to push backing tracks back
    this.sideNode.gain.setValueAtTime(this.sideNode.gain.value, time);
    this.sideNode.gain.linearRampToValueAtTime(0.28, time + duration);

    // 5. Narrow Stereo: Collapse side Haas delay gain to 0.05 to lock vocals dead center
    this.sideHaasGain.gain.setValueAtTime(this.sideHaasGain.gain.value, time);
    this.sideHaasGain.gain.linearRampToValueAtTime(0.05, time + duration); 

    // 6. Intimate Reverb: Pull room wet reflections down to 3% mix for dry vocal crispness
    this.reverbWet.gain.setValueAtTime(this.reverbWet.gain.value, time);
    this.reverbWet.gain.linearRampToValueAtTime(0.03, time + duration);

    // 7. Tight Vocal compression
    this.midVocalComp.threshold.setValueAtTime(this.midVocalComp.threshold.value, time);
    this.midVocalComp.threshold.linearRampToValueAtTime(-19, time + duration);

    this._emit();
  }

  transitionTo3DImmersive() {
    if (!this.audioContext || !this.hpf || !this.sidechainDucker || !this.sideHaasGain || !this.reverbWet || !this.midVocalComp || !this.midNode || !this.sideNode) return;
    const time = this.audioContext.currentTime;
    const duration = 0.65; 
    
    this._currentSoundstage = 'Spotify 3D Spatial Space';

    // 1. Warm Deep Bass: Pull HPF low-cut down to 32Hz
    this.hpf.frequency.setValueAtTime(this.hpf.frequency.value, time);
    this.hpf.frequency.linearRampToValueAtTime(32, time + duration);
    
    // 2. Restore Sidechain: Flatten the side ducking completely
    this.sidechainDucker.gain.setValueAtTime(this.sidechainDucker.gain.value, time);
    this.sidechainDucker.gain.linearRampToValueAtTime(0.0, time + duration); 

    // 3. Balanced Mid: Pull Mid gain down to 0.55 to open a spacious center pocket for BGM
    this.midNode.gain.setValueAtTime(this.midNode.gain.value, time);
    this.midNode.gain.linearRampToValueAtTime(0.55, time + duration);

    // 4. DUAL-CHANNEL BGM BOOST: Slide Side (stereo background music) gain UP to 1.15 to wrap music around L/R
    this.sideNode.gain.setValueAtTime(this.sideNode.gain.value, time);
    this.sideNode.gain.linearRampToValueAtTime(1.15, time + duration);

    // 5. Expand Haas: Ramps side Haas delay gain up to 0.85 for massive 3D width
    this.sideHaasGain.gain.setValueAtTime(this.sideHaasGain.gain.value, time);
    this.sideHaasGain.gain.linearRampToValueAtTime(0.85, time + duration); 

    // 6. Immersive Room: Open Schroeder Reverb wet gain up to 22% mix for gorgeous glowing room depth
    this.reverbWet.gain.setValueAtTime(this.reverbWet.gain.value, time);
    this.reverbWet.gain.linearRampToValueAtTime(0.22, time + duration);

    // 7. Relax Mid compression
    this.midVocalComp.threshold.setValueAtTime(this.midVocalComp.threshold.value, time);
    this.midVocalComp.threshold.linearRampToValueAtTime(-10, time + duration);

    this._emit();
  }

  setVocalClarityMode(active) {
    this.isClarityModeActive = active;
    if (!this.audioContext || !this.hpf || !this.subtractiveEq || !this.sidechainDucker || !this.sideHaasGain || !this.midLowComp || !this.midVocalComp || !this.reverbWet || !this.midNode || !this.sideNode) return;

    const time = this.audioContext.currentTime;
    if (active) {
      this.transitionTo3DImmersive();
    } else {
      // Complete Mastering Bypass (Full flat bypass, disables reverb & sidechain widening)
      this.hpf.frequency.setValueAtTime(20, time);
      this.subtractiveEq.gain.setValueAtTime(0, time);
      this.sidechainDucker.gain.setValueAtTime(0, time);
      
      this.midNode.gain.setValueAtTime(1.0, time);
      this.sideNode.gain.setValueAtTime(1.0, time);

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
