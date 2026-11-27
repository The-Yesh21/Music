import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../data/database_helper.dart';
import '../models/song.dart';
import 'jiosaavn_service.dart';

class EchoTubeAudioHandler extends BaseAudioHandler
    with SeekHandler, QueueHandler {
  static const int _maxAutoSkipFailures = 5;

  final DatabaseHelper db;
  final JioSaavnService jiosaavn;
  final AudioPlayer _player = AudioPlayer(androidApplyAudioAttributes: true);
  final Random _random = Random();

  final ValueNotifier<Song?> currentSongNotifier = ValueNotifier<Song?>(null);
  final ValueNotifier<List<Song>> queueNotifier = ValueNotifier<List<Song>>([]);
  final ValueNotifier<bool> isShuffleNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<bool> isAutoplayNotifier = ValueNotifier<bool>(true);
  final ValueNotifier<AudioQuality> qualityNotifier =
      ValueNotifier<AudioQuality>(AudioQuality.high);
  final ValueNotifier<bool> isResolvingNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<String?> errorNotifier = ValueNotifier<String?>(null);

  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Stream<bool> get playingStream => _player.playingStream;
  bool get isPlaying => _player.playing;

  List<Song> _originalQueue = const [];
  int _currentIndex = -1;
  int _autoSkipCount = 0;
  bool _isAdvancing = false;
  final Set<String> _preResolvingKeys = <String>{};

  late final StreamSubscription<PlaybackEvent> _playbackEventSub;
  late final StreamSubscription<PlayerState> _playerStateSub;
  late final StreamSubscription<Duration?> _durationSub;

  EchoTubeAudioHandler(this.db, this.jiosaavn) {
    _initAudioSession();
    _playbackEventSub = _player.playbackEventStream.listen(
      (_) => _broadcastPlaybackState(),
      onError: (Object error, StackTrace _) {
        errorNotifier.value = error.toString();
      },
    );
    _playerStateSub = _player.playerStateStream.listen(_handlePlayerState);
    _durationSub = _player.durationStream.listen((duration) {
      final current = mediaItem.value;
      if (current != null && duration != null && current.duration != duration) {
        mediaItem.add(current.copyWith(duration: duration));
        _broadcastPlaybackState();
      }
    });
  }

  Future<void> _initAudioSession() async {
    final session = await AudioSession.instance;
    await session.configure(
      const AudioSessionConfiguration.music().copyWith(
        androidAudioAttributes: const AndroidAudioAttributes(
          contentType: AndroidAudioContentType.music,
          usage: AndroidAudioUsage.media,
        ),
      ),
    );
  }

  Future<void> playQueue(
    List<Song> songs, {
    int startIndex = 0,
    bool shuffle = false,
  }) async {
    if (songs.isEmpty) return;

    _originalQueue = List<Song>.unmodifiable(songs);
    isShuffleNotifier.value = shuffle;

    List<Song> activeQueue;
    int targetIndex;
    if (shuffle) {
      final clampedStart = startIndex.clamp(0, songs.length - 1);
      final chosen = songs[clampedStart];
      final rest = List<Song>.from(songs)..removeAt(clampedStart);
      rest.shuffle(_random);
      activeQueue = <Song>[chosen, ...rest];
      targetIndex = 0;
    } else {
      activeQueue = List<Song>.from(songs);
      targetIndex = startIndex.clamp(0, activeQueue.length - 1);
    }

    _setQueue(activeQueue);
    _autoSkipCount = 0;
    await _loadAndPlayAtIndex(targetIndex);
  }

  Future<void> playSong(Song song, {List<Song>? contextQueue}) async {
    if (contextQueue != null && contextQueue.isNotEmpty) {
      final idx = contextQueue.indexWhere((s) => s.songKey == song.songKey);
      if (idx >= 0) {
        await playQueue(
          contextQueue,
          startIndex: idx,
          shuffle: isShuffleNotifier.value,
        );
        return;
      }
    }

    final existingIdx =
        queueNotifier.value.indexWhere((s) => s.songKey == song.songKey);
    if (existingIdx >= 0) {
      _autoSkipCount = 0;
      await _loadAndPlayAtIndex(existingIdx);
      return;
    }

    await playQueue(<Song>[song], startIndex: 0, shuffle: false);
  }

  Future<void> setQuality(AudioQuality quality) async {
    if (qualityNotifier.value == quality) return;
    qualityNotifier.value = quality;

    final current = currentSongNotifier.value;
    if (current == null) return;

    // Downloaded files are already stored locally.
    final localPath = current.localAudioPath;
    if (localPath != null &&
        localPath.isNotEmpty &&
        File(localPath).existsSync()) {
      return;
    }

    final position = _player.position;
    final wasPlaying = _player.playing;
    isResolvingNotifier.value = true;
    try {
      final track = await jiosaavn.resolveTrackForSong(current);
      final url = track?.bestUrlForQuality(quality);
      if (url == null || url.isEmpty) return;

      final updated = current.copyWith(
        streamUrl: url,
        imageUrl: (current.imageUrl == null || current.imageUrl!.isEmpty)
            ? track?.imageUrl
            : current.imageUrl,
      );
      _updateSongInQueue(updated);
      await db.upsertSong(updated);

      await _player.setAudioSource(
        AudioSource.uri(Uri.parse(url)),
        initialPosition: position,
      );
      if (wasPlaying) {
        await _player.play();
      }
    } catch (e) {
      errorNotifier.value = e.toString();
    } finally {
      isResolvingNotifier.value = false;
    }
  }

  void toggleShuffle() {
    final nextShuffle = !isShuffleNotifier.value;
    isShuffleNotifier.value = nextShuffle;

    final current = currentSongNotifier.value;
    if (_originalQueue.isEmpty) return;

    if (nextShuffle) {
      final rest = _originalQueue
          .where((s) => current == null || s.songKey != current.songKey)
          .toList()
        ..shuffle(_random);
      final nextQueue = current != null ? <Song>[current, ...rest] : rest;
      _setQueue(nextQueue);
      _currentIndex = current != null ? 0 : -1;
    } else {
      final restored = List<Song>.from(_originalQueue);
      _setQueue(restored);
      _currentIndex = current != null
          ? restored.indexWhere((s) => s.songKey == current.songKey)
          : -1;
    }
    _broadcastPlaybackState();
  }

  void toggleAutoplay() {
    isAutoplayNotifier.value = !isAutoplayNotifier.value;
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> skipToNext() async {
    final q = queueNotifier.value;
    if (q.isEmpty) return;

    final nextIndex = (_currentIndex + 1) % q.length;
    await _loadAndPlayAtIndex(nextIndex);
  }

  @override
  Future<void> skipToPrevious() async {
    final q = queueNotifier.value;
    if (q.isEmpty) return;

    if (_player.position > const Duration(seconds: 3)) {
      await _player.seek(Duration.zero);
      return;
    }

    final prevIndex = (_currentIndex - 1 + q.length) % q.length;
    await _loadAndPlayAtIndex(prevIndex);
  }

  @override
  Future<void> stop() async {
    await _player.stop();
    _broadcastPlaybackState();
    await super.stop();
  }

  @override
  Future<void> onTaskRemoved() async {
    // Stop playback and tear down the foreground service when the user
    // swipes the app away from Recents, while keeping background playback
    // active when the screen is locked or another app is opened.
    await stop();
    await super.onTaskRemoved();
  }

  void _handlePlayerState(PlayerState state) {
    _broadcastPlaybackState();
    if (state.processingState == ProcessingState.completed &&
        isAutoplayNotifier.value &&
        !_isAdvancing) {
      _isAdvancing = true;
      unawaited(
        skipToNext().whenComplete(() {
          _isAdvancing = false;
        }),
      );
    }
  }

  Future<void> _loadAndPlayAtIndex(int index) async {
    final q = queueNotifier.value;
    if (index < 0 || index >= q.length) return;

    _currentIndex = index;
    var song = q[index];
    currentSongNotifier.value = song;
    errorNotifier.value = null;
    mediaItem.add(_toMediaItem(song));
    _broadcastPlaybackState();

    try {
      final localPath = song.localAudioPath;
      if (localPath != null &&
          localPath.isNotEmpty &&
          File(localPath).existsSync()) {
        await _player.setAudioSource(AudioSource.file(localPath));
      } else {
        var streamUrl = song.streamUrl;
        if (streamUrl == null ||
            streamUrl.isEmpty ||
            qualityNotifier.value != AudioQuality.high) {
          isResolvingNotifier.value = true;
          final track = await jiosaavn.resolveTrackForSong(song);
          final resolvedUrl = track?.bestUrlForQuality(qualityNotifier.value);
          if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
            streamUrl = resolvedUrl;
            final resolvedImage =
                (song.imageUrl == null || song.imageUrl!.isEmpty)
                    ? track?.imageUrl
                    : song.imageUrl;
            song = song.copyWith(
              streamUrl: streamUrl,
              imageUrl: resolvedImage,
            );
            _updateSongInQueue(song);
            await db.upsertSong(song);
          }
          isResolvingNotifier.value = false;
        }

        if (streamUrl == null || streamUrl.isEmpty) {
          throw StateError('No playable stream found for ${song.title}');
        }

        await _player.setAudioSource(AudioSource.uri(Uri.parse(streamUrl)));
      }

      _autoSkipCount = 0;
      mediaItem.add(_toMediaItem(song, duration: _player.duration));
      await db.recordPlay(song.songKey);
      await _player.play();
      _preResolveUpcoming();
    } catch (e) {
      isResolvingNotifier.value = false;
      _autoSkipCount += 1;
      if (_autoSkipCount <= _maxAutoSkipFailures && q.length > 1) {
        final nextIndex = (_currentIndex + 1) % q.length;
        await _loadAndPlayAtIndex(nextIndex);
      } else {
        errorNotifier.value = 'Playback failed: $e';
        _broadcastPlaybackState();
      }
    }
  }

  void _preResolveUpcoming() {
    final q = queueNotifier.value;
    if (q.length <= 1) return;

    for (var offset = 1; offset <= 2; offset++) {
      final idx = (_currentIndex + offset) % q.length;
      if (idx == _currentIndex) continue;
      final candidate = q[idx];
      if ((candidate.streamUrl != null && candidate.streamUrl!.isNotEmpty) &&
          (candidate.imageUrl != null && candidate.imageUrl!.isNotEmpty)) {
        continue;
      }
      if (_preResolvingKeys.contains(candidate.songKey)) continue;

      _preResolvingKeys.add(candidate.songKey);
      unawaited(
        jiosaavn.resolveTrackForSong(candidate).then((track) async {
          if (track == null) return;
          final url = track.bestUrlForQuality(qualityNotifier.value);
          final image = (candidate.imageUrl == null ||
                  candidate.imageUrl!.isEmpty)
              ? track.imageUrl
              : candidate.imageUrl;
          if ((url != null && url.isNotEmpty) ||
              (image != null && image.isNotEmpty)) {
            final updated = candidate.copyWith(
              streamUrl: (candidate.streamUrl == null ||
                      candidate.streamUrl!.isEmpty)
                  ? url
                  : candidate.streamUrl,
              imageUrl: image,
            );
            _updateSongInQueue(updated);
            await db.upsertSong(updated);
          }
        }).catchError((_) {
          // Ignore background pre-resolution failures.
        }).whenComplete(() {
          _preResolvingKeys.remove(candidate.songKey);
        }),
      );
    }
  }

  void _setQueue(List<Song> songs) {
    queueNotifier.value = List<Song>.unmodifiable(songs);
    queue.add(songs.map(_toMediaItem).toList());
  }

  void _updateSongInQueue(Song updated) {
    final q = List<Song>.from(queueNotifier.value);
    final idx = q.indexWhere((s) => s.songKey == updated.songKey);
    if (idx >= 0) {
      q[idx] = updated;
      _setQueue(q);
    }
    if (currentSongNotifier.value?.songKey == updated.songKey) {
      currentSongNotifier.value = updated;
      mediaItem.add(_toMediaItem(updated, duration: _player.duration));
    }
    final origIdx =
        _originalQueue.indexWhere((s) => s.songKey == updated.songKey);
    if (origIdx >= 0) {
      final origCopy = List<Song>.from(_originalQueue);
      origCopy[origIdx] = updated;
      _originalQueue = List<Song>.unmodifiable(origCopy);
    }
  }

  MediaItem _toMediaItem(Song song, {Duration? duration}) {
    final art = song.imageUrl;
    return MediaItem(
      id: song.songKey,
      title: song.title,
      artist: song.artist,
      album: song.category,
      genre: song.genre.isNotEmpty ? song.genre : song.category,
      displayTitle: song.title,
      displaySubtitle: '${song.artist} • ${song.category}',
      duration: duration,
      artUri: (art != null && art.isNotEmpty) ? Uri.tryParse(art) : null,
    );
  }

  void _broadcastPlaybackState() {
    final playing = _player.playing;
    playbackState.add(
      PlaybackState(
        controls: <MediaControl>[
          MediaControl.skipToPrevious,
          if (playing) MediaControl.pause else MediaControl.play,
          MediaControl.skipToNext,
          MediaControl.stop,
        ],
        systemActions: const <MediaAction>{
          MediaAction.play,
          MediaAction.pause,
          MediaAction.playPause,
          MediaAction.stop,
          MediaAction.skipToNext,
          MediaAction.skipToPrevious,
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
        },
        androidCompactActionIndices: const <int>[0, 1, 2],
        processingState: switch (_player.processingState) {
          ProcessingState.idle => AudioProcessingState.idle,
          ProcessingState.loading => AudioProcessingState.loading,
          ProcessingState.buffering => AudioProcessingState.buffering,
          ProcessingState.ready => AudioProcessingState.ready,
          ProcessingState.completed => AudioProcessingState.completed,
        },
        playing: playing,
        updatePosition: _player.position,
        bufferedPosition: _player.bufferedPosition,
        speed: _player.speed,
        queueIndex: _currentIndex >= 0 ? _currentIndex : null,
      ),
    );
  }

  Future<void> dispose() async {
    await _playbackEventSub.cancel();
    await _playerStateSub.cancel();
    await _durationSub.cancel();
    await _player.dispose();
    currentSongNotifier.dispose();
    queueNotifier.dispose();
    isShuffleNotifier.dispose();
    isAutoplayNotifier.dispose();
    qualityNotifier.dispose();
    isResolvingNotifier.dispose();
    errorNotifier.dispose();
  }
}
