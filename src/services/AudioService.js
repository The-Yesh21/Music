import { registerPlugin } from '@capacitor/core';
import { audioEngine } from './audioEngine';

const MediaPlugin = registerPlugin('MediaPlugin');
const isNative = () => !!window.Capacitor?.isNativePlatform?.();

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

    this.currentTrack = null;
    this.nextTrack = null;
    this._mediaSessionRegistered = false;

    this._setupListeners();
  }

  _initAudioContext() {
    // Defer Web Audio context initialization to user gesture
  }


  makeTubeSaturationCurve(gain = 0.4) {
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
    if (isNative()) {
      MediaPlugin.addListener('mediaAction', ({ action, position }) => {
        if (action === 'ACTION_NEXT') {
          if (this.statusCallback) this.statusCallback({ userRequestedNext: true });
        } else if (action === 'ACTION_PREV') {
          if (this.statusCallback) this.statusCallback({ userRequestedPrev: true });
        } else if (action === 'ACTION_PLAY') {
          this.play().catch(console.error);
        } else if (action === 'ACTION_PAUSE') {
          this.pause().catch(console.error);
        } else if (action === 'ACTION_STOP') {
          this.unload().catch(console.error);
        } else if (action === 'ACTION_SEEK_TO') {
          if (position !== undefined) {
            this.seekTo(position).catch(console.error);
          }
        }
      });
    }

    this.audio.addEventListener('timeupdate', () => {
      this._updateMediaSessionPosition();
      this._emit();
    });
    this.audio.addEventListener('ended', () => {
      if (this.nextTrack) {
        const next = this.nextTrack;
        this.nextTrack = null;
        this.currentTrack = next;
        
        // Start next track synchronously in the 'ended' event callback
        this.audio.src = next.uri;
        this.audio.play().catch(e => {
          console.warn('Sync transition play failed in ended listener:', e);
        });

        // Notify context that song finished and next has started
        if (this.statusCallback) {
          this.statusCallback({ 
            didJustFinish: true, 
            nextSongStarted: next 
          });
        }
        this._updateMediaSession();
      } else {
        if (this.statusCallback) this.statusCallback({ didJustFinish: true, isPlaying: false });
      }
    });
    this.audio.addEventListener('play', () => {
      audioEngine.init(this.audio);
      audioEngine.resume();
      this.analyser = audioEngine.analyser;
      this.audioContext = audioEngine.context;

      // Copy node references from audioEngine
      if (!this.hpf && audioEngine.hpf) {
        this.hpf = audioEngine.hpf;
        this.subtractiveEq = audioEngine.subtractiveEq;
        this.msSplitter = audioEngine.msSplitter;
        this.midNode = audioEngine.midNode;
        this.sideNode = audioEngine.sideNode;
        this.midLowComp = audioEngine.midLowComp;
        this.midVocalComp = audioEngine.midVocalComp;
        this.midExciter = audioEngine.midExciter;
        this.sidechainDucker = audioEngine.sidechainDucker;
        this.sideHaasDelay = audioEngine.sideHaasDelay;
        this.sideHaasGain = audioEngine.sideHaasGain;
        this.reverbWet = audioEngine.reverbWet;
        this.reverbDry = audioEngine.reverbDry;
        this.combFilters = audioEngine.combFilters;
        this.allpassFilters = audioEngine.allpassFilters;
        this.softClipper = audioEngine.softClipper;
        this.limiter = audioEngine.limiter;
        this.lufsGain = audioEngine.lufsGain;
      }

      if (this.isClarityModeActive) {
        this.transitionTo3DImmersive();
        this._startVADLoop();
      } else {
        this.setVocalClarityMode(false);
      }
      this._updateMediaSession();
      this._emit();
    });
    this.audio.addEventListener('pause', () => {
      this._updateMediaSession();
      this._emit();
    });
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

    // 4. DUAL-CHANNEL BGM BOOST: Slide Side (stereo background music) gain UP to 0.9 to wrap music around L/R
    this.sideNode.gain.setValueAtTime(this.sideNode.gain.value, time);
    this.sideNode.gain.linearRampToValueAtTime(0.9, time + duration);

    // 5. Expand Haas: Ramps side Haas delay gain up to 0.45 for moderate width
    this.sideHaasGain.gain.setValueAtTime(this.sideHaasGain.gain.value, time);
    this.sideHaasGain.gain.linearRampToValueAtTime(0.45, time + duration); 

    // 6. Immersive Room: Open Schroeder Reverb wet gain up to 8% mix for gorgeous glowing room depth
    this.reverbWet.gain.setValueAtTime(this.reverbWet.gain.value, time);
    this.reverbWet.gain.linearRampToValueAtTime(0.08, time + duration);

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

  setVolume(val) {
    this.audio.volume = val;
    audioEngine.setVolume(val);
  }

  setNextTrack(song) {
    this.nextTrack = song;
  }

  _setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator) || this._mediaSessionRegistered) return;
    this._mediaSessionRegistered = true;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.play().catch(console.error);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause().catch(console.error);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.statusCallback) this.statusCallback({ userRequestedPrev: true });
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.statusCallback) this.statusCallback({ userRequestedNext: true });
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seekTo(details.seekTime * 1000);
        }
      });
    } catch (e) {
      console.warn('Failed to register mediaSession handlers:', e);
    }
  }

  _updateNativeNotification() {
    if (!isNative() || !this.currentTrack) return;
    
    const duration = isNaN(this.audio.duration) || this.audio.duration === Infinity ? 0 : Math.floor(this.audio.duration * 1000);
    const position = isNaN(this.audio.currentTime) ? 0 : Math.floor(this.audio.currentTime * 1000);

    MediaPlugin.updateNotification({
      title: this.currentTrack.title || 'EchoTune',
      artist: this.currentTrack.artist || '',
      isPlaying: !this.audio.paused,
      position: position,
      duration: duration
    }).catch((e) => console.warn('Failed to update native notification:', e));
  }

  _updateMediaSession() {
    this._updateNativeNotification();
    if (!('mediaSession' in navigator) || !this.currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title,
        artist: this.currentTrack.artist,
        album: this.currentTrack.album || 'EchoTune AI',
        artwork: [
          { src: this.currentTrack.artwork || 'https://picsum.photos/seed/default/512/512', sizes: '512x512', type: 'image/png' }
        ]
      });
      
      navigator.mediaSession.playbackState = this.audio.paused ? 'paused' : 'playing';
      this._updateMediaSessionPosition();
    } catch (e) {
      console.warn('Failed to update mediaSession metadata:', e);
    }
  }

  _updateMediaSessionPosition() {
    if (!('mediaSession' in navigator) || !this.currentTrack || !('setPositionState' in navigator.mediaSession)) return;
    try {
      const duration = isNaN(this.audio.duration) || this.audio.duration === Infinity ? 0 : this.audio.duration;
      const position = isNaN(this.audio.currentTime) ? 0 : this.audio.currentTime;
      if (duration > 0 && position >= 0 && position <= duration) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: this.audio.playbackRate || 1.0,
          position: position
        });
      }
    } catch (e) {
      // Ignore occasional validation errors
    }
  }

  async loadAndPlay(uri, track = null) {
    if (this.statusCallback) this.statusCallback({ isBuffering: true, error: null });

    this.currentTrack = track;
    this.nextTrack = null;

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.audio.crossOrigin = 'anonymous';
    this.audio.src = uri;
    this.audio.preload = 'auto';

    this._setupMediaSessionHandlers();
    this._updateMediaSession();

    // Wait until browser has enough data or an error occurs
    await new Promise((resolve) => {
      const cleanup = () => {
        this.audio.removeEventListener('canplaythrough', onCanPlayThrough);
        this.audio.removeEventListener('error', onError);
      };
      const onCanPlayThrough = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        resolve();
      };
      this.audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
      this.audio.addEventListener('error', onError, { once: true });
      this.audio.load();
    });

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
    if (isNative()) {
      MediaPlugin.stopNotification().catch((e) => console.warn('Failed to stop native notification:', e));
    }
  }
}

export default new AudioService();
