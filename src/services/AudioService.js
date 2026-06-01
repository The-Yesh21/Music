// HTML5 Audio Service — web equivalent of expo-av with advanced multi-adapting spatial DSP pipeline

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
    this.isClarityModeActive = true; // Enabled by default

    // Haas 3D Stereo Widener nodes
    this.splitter = null;
    this.merger = null;
    this.haasDelay = null;
    this.haasGain = null;

    // Vocal Activity Detection (VAD) state
    this._vadIntervalId = null;
    this._currentSoundstage = '3D Immersive BGM';

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
        this.compressor.threshold.setValueAtTime(-10, this.audioContext.currentTime); // Relaxed initially for BGM
        this.compressor.knee.setValueAtTime(8, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(1.8, this.audioContext.currentTime);
        this.compressor.attack.setValueAtTime(0.01, this.audioContext.currentTime);
        this.compressor.release.setValueAtTime(0.20, this.audioContext.currentTime);

        // 2. High-Pass Filter (HPF): Cuts sub-bass mud below 35Hz for warm deep BGM bass initially
        this.highpassFilter = this.audioContext.createBiquadFilter();
        this.highpassFilter.type = 'highpass';
        this.highpassFilter.frequency.setValueAtTime(35, this.audioContext.currentTime);
        this.highpassFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);

        // 3. Peaking Presence Filter: Boosts vocal consonant articulation around 2.5 kHz (+1dB initially)
        this.vocalBoostFilter = this.audioContext.createBiquadFilter();
        this.vocalBoostFilter.type = 'peaking';
        this.vocalBoostFilter.frequency.setValueAtTime(2500, this.audioContext.currentTime);
        this.vocalBoostFilter.Q.setValueAtTime(1.2, this.audioContext.currentTime); 
        this.vocalBoostFilter.gain.setValueAtTime(1.0, this.audioContext.currentTime);

        // 4. High Shelf Clarity Filter: Enhances vocal air and high cymbals
        this.clarityFilter = this.audioContext.createBiquadFilter();
        this.clarityFilter.type = 'highshelf';
        this.clarityFilter.frequency.setValueAtTime(8000, this.audioContext.currentTime);
        this.clarityFilter.gain.setValueAtTime(1.5, this.audioContext.currentTime); 

        // 5. Haas 3D Stereo Widener routing
        this.splitter = this.audioContext.createChannelSplitter(2);
        this.merger = this.audioContext.createChannelMerger(2);
        
        this.haasDelay = this.audioContext.createDelay(0.1);
        this.haasDelay.delayTime.setValueAtTime(0.024, this.audioContext.currentTime); // 24ms Haas delay
        this.haasGain = this.audioContext.createGain();
        this.haasGain.gain.setValueAtTime(0.75, this.audioContext.currentTime); // Wide 3D effect active

        // Connect media elements in multi-adapting DSP series
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.highpassFilter);
        this.highpassFilter.connect(this.vocalBoostFilter);
        this.vocalBoostFilter.connect(this.clarityFilter);
        this.clarityFilter.connect(this.splitter);

        // Connect Left Channel directly
        this.splitter.connect(this.merger, 0, 0);

        // Connect Right Channel through Haas 3D Widener
        this.splitter.connect(this.haasDelay, 1);
        this.haasDelay.connect(this.haasGain);
        this.haasGain.connect(this.merger, 0, 1);

        // Merger -> Compressor -> Analyser -> GainNode -> Destination
        this.merger.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        // Start real-time Vocal Activity Detection loop
        this._startVADLoop();
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

      // Analyze energy across discrete bands
      // Bin size = 44100 / 256 = 172Hz per bin
      // Bass: bins 0 to 2 (0 - 516Hz)
      // Vocal Presence: bins 5 to 20 (860Hz - 3440Hz)
      // Treble Air: bins 40 to 80 (6880Hz - 13760Hz)
      let bassSum = 0;
      for (let i = 0; i <= 2; i++) bassSum += dataArray[i] || 0;
      const bassEnergy = bassSum / 3;

      let vocalSum = 0;
      for (let i = 5; i <= 20; i++) vocalSum += dataArray[i] || 0;
      const vocalEnergy = vocalSum / 16;

      let trebleSum = 0;
      for (let i = 40; i <= 80; i++) trebleSum += dataArray[i] || 0;
      const trebleEnergy = trebleSum / 41;

      // Active noise floor threshold
      const activeThreshold = 22;
      if (vocalEnergy < activeThreshold && bassEnergy < activeThreshold) {
        return; // Silent/fade passage, skip update
      }

      // Human vocals exhibit high dynamic modulation relative to sub-bass beats or steady treble pads
      const vocalRatio = vocalEnergy / (bassEnergy * 0.88 + trebleEnergy * 0.35 + 0.1);
      const targetState = vocalRatio > 1.05 ? 'LYRICS' : 'BGM';

      if (targetState !== lastState) {
        consecCount++;
        if (consecCount >= 2) { // 240ms debounce to prevent dynamic oscillation
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
    if (!this.audioContext || !this.highpassFilter || !this.vocalBoostFilter || !this.haasGain || !this.compressor) return;
    const time = this.audioContext.currentTime;
    const duration = 0.45; // 450ms smooth transition glide
    
    this._currentSoundstage = 'Studio Vocal Stage';

    // 1. Cut instrumental bass mud up to 105 Hz to unmask vocal frequencies
    this.highpassFilter.frequency.setValueAtTime(this.highpassFilter.frequency.value, time);
    this.highpassFilter.frequency.linearRampToValueAtTime(105, time + duration);
    
    // 2. Substantially boost midrange vocal consonant presence (+6.0dB)
    this.vocalBoostFilter.gain.setValueAtTime(this.vocalBoostFilter.gain.value, time);
    this.vocalBoostFilter.gain.linearRampToValueAtTime(6.0, time + duration);
    
    // 3. Narrow stereo field to lock vocals dead-center
    this.haasGain.gain.setValueAtTime(this.haasGain.gain.value, time);
    this.haasGain.gain.linearRampToValueAtTime(0.08, time + duration); 
    
    // 4. Boost compression for tight dynamic articulation
    this.compressor.threshold.setValueAtTime(this.compressor.threshold.value, time);
    this.compressor.threshold.linearRampToValueAtTime(-19, time + duration);
    this.compressor.ratio.setValueAtTime(this.compressor.ratio.value, time);
    this.compressor.ratio.linearRampToValueAtTime(4.0, time + duration);

    this._emit();
  }

  transitionTo3DImmersive() {
    if (!this.audioContext || !this.highpassFilter || !this.vocalBoostFilter || !this.haasGain || !this.compressor) return;
    const time = this.audioContext.currentTime;
    const duration = 0.65; // 650ms deep, wide expanding glide
    
    this._currentSoundstage = '3D Immersive BGM';

    // 1. Re-open deep, warm instrumental bass down to 35 Hz
    this.highpassFilter.frequency.setValueAtTime(this.highpassFilter.frequency.value, time);
    this.highpassFilter.frequency.linearRampToValueAtTime(35, time + duration);
    
    // 2. Flatten vocal presence to allow background synths/guitars to bloom
    this.vocalBoostFilter.gain.setValueAtTime(this.vocalBoostFilter.gain.value, time);
    this.vocalBoostFilter.gain.linearRampToValueAtTime(1.0, time + duration); 
    
    // 3. Amplify Haas delay reflections to expand stereo soundstage massively (+0.80 gain)
    this.haasGain.gain.setValueAtTime(this.haasGain.gain.value, time);
    this.haasGain.gain.linearRampToValueAtTime(0.80, time + duration); 
    
    // 4. Open up compressor to relax dynamic range for instruments
    this.compressor.threshold.setValueAtTime(this.compressor.threshold.value, time);
    this.compressor.threshold.linearRampToValueAtTime(-9, time + duration);
    this.compressor.ratio.setValueAtTime(this.compressor.ratio.value, time);
    this.compressor.ratio.linearRampToValueAtTime(1.8, time + duration);

    this._emit();
  }

  setVocalClarityMode(active) {
    this.isClarityModeActive = active;
    if (!this.audioContext || !this.highpassFilter || !this.vocalBoostFilter || !this.clarityFilter || !this.haasGain || !this.compressor) return;

    const time = this.audioContext.currentTime;
    if (active) {
      // Re-enable active VAD-based transition system
      this.transitionTo3DImmersive();
    } else {
      // Flat bypass mode: disables Haas 3D and flattens EQs
      this.highpassFilter.frequency.setValueAtTime(20, time);
      this.vocalBoostFilter.gain.setValueAtTime(0, time); 
      this.clarityFilter.gain.setValueAtTime(0, time);
      this.haasGain.gain.setValueAtTime(0, time); // Mono bypass
      this.compressor.threshold.setValueAtTime(0, time);
      this._currentSoundstage = 'Stereo Bypass Stage';
    }

    this._emit();
  }

  getVocalClarityMode() {
    return this.isClarityModeActive;
  }

  async loadAndPlay(uri) {
    if (this.statusCallback) this.statusCallback({ isBuffering: true, error: null });

    // Resume audio context if suspended
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
