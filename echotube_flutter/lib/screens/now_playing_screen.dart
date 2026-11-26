import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

class NowPlayingScreen extends StatelessWidget {
  const NowPlayingScreen({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final handler = controller.audioHandler;

    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        return ValueListenableBuilder<Song?>(
          valueListenable: handler.currentSongNotifier,
          builder: (context, currentSong, _) {
            if (currentSong == null) {
              return const Scaffold(
                body: Center(
                  child: Text('Nothing playing right now'),
                ),
              );
            }

            final liveSong = controller.songs
                    .where((s) => s.songKey == currentSong.songKey)
                    .firstOrNull ??
                currentSong;
            final accent = moodColor(liveSong.category);
            final progress = controller.downloadProgress[liveSong.songKey];

            return Stack(
              children: [
                Scaffold(
                  body: Container(
                    decoration: BoxDecoration(
                      gradient: moodGradient(liveSong.category),
                    ),
                    child: SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 8,
                        ),
                        child: Column(
                          children: [
                            _TopBar(
                              song: liveSong,
                              controller: controller,
                            ),
                            const Spacer(),
                            _AlbumArtwork(
                              imageUrl: liveSong.imageUrl,
                              accent: accent,
                            ),
                            const Spacer(),
                            _TrackHeader(
                              song: liveSong,
                              controller: controller,
                            ),
                            const SizedBox(height: 14),
                            _SeekBar(controller: controller),
                            const SizedBox(height: 8),
                            _PlaybackControls(controller: controller),
                            const SizedBox(height: 16),
                            _BottomActions(
                              song: liveSong,
                              controller: controller,
                              downloadProgress: progress,
                            ),
                            const SizedBox(height: 12),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                if (controller.isBatterySaver)
                  BatterySaverOverlay(
                    onWake: controller.toggleBatterySaver,
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.song,
    required this.controller,
  });

  final Song song;
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 30),
          tooltip: 'Close',
        ),
        Expanded(
          child: Column(
            children: [
              Text(
                'PLAYING FROM ${song.category.toUpperCase()}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: SpotifyColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                song.isDownloaded ? 'Offline Cached' : 'EchoTube Stream',
                style: const TextStyle(
                  color: SpotifyColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        ValueListenableBuilder<AudioQuality>(
          valueListenable: controller.audioHandler.qualityNotifier,
          builder: (context, quality, _) {
            final label =
                song.isDownloaded ? 'Offline' : audioQualityLabel(quality);
            return PopupMenuButton<AudioQuality>(
              tooltip: 'Audio Quality',
              color: SpotifyColors.elevated,
              onSelected: controller.setAudioQuality,
              itemBuilder: (_) => AudioQuality.values
                  .map(
                    (q) => PopupMenuItem<AudioQuality>(
                      value: q,
                      child: Row(
                        children: [
                          Icon(
                            q == quality
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            size: 18,
                            color: q == quality
                                ? SpotifyColors.spotifyGreen
                                : SpotifyColors.textSecondary,
                          ),
                          const SizedBox(width: 10),
                          Text(audioQualityLabel(q)),
                        ],
                      ),
                    ),
                  )
                  .toList(),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.16),
                  ),
                ),
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: SpotifyColors.textPrimary,
                  ),
                ),
              ),
            );
          },
        ),
        IconButton(
          onPressed: controller.toggleBatterySaver,
          icon: Icon(
            controller.isBatterySaver
                ? Icons.battery_saver
                : Icons.dark_mode_outlined,
            size: 22,
          ),
          tooltip: 'OLED Battery Saver',
        ),
      ],
    );
  }
}

class _AlbumArtwork extends StatelessWidget {
  const _AlbumArtwork({
    required this.imageUrl,
    required this.accent,
  });

  final String? imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size.width - 56;
    final clampedSize = size.clamp(220.0, 340.0);
    final url = imageUrl?.trim() ?? '';

    return Container(
      width: clampedSize,
      height: clampedSize,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.55),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: url.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (_, _) => _fallback(),
                errorWidget: (_, _, _) => _fallback(),
              )
            : _fallback(),
      ),
    );
  }

  Widget _fallback() {
    return Container(
      color: SpotifyColors.elevated,
      child: Icon(
        Icons.music_note_rounded,
        size: 84,
        color: accent,
      ),
    );
  }
}

class _TrackHeader extends StatelessWidget {
  const _TrackHeader({
    required this.song,
    required this.controller,
  });

  final Song song;
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                song.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: SpotifyColors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                song.artist,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: SpotifyColors.textSecondary,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: () => controller.toggleLike(song),
          icon: Icon(
            song.isLiked ? Icons.favorite : Icons.favorite_border,
            color: song.isLiked
                ? SpotifyColors.spotifyGreen
                : SpotifyColors.textPrimary,
            size: 28,
          ),
          tooltip: song.isLiked ? 'Unlike' : 'Like',
        ),
      ],
    );
  }
}

class _SeekBar extends StatefulWidget {
  const _SeekBar({required this.controller});

  final AppController controller;

  @override
  State<_SeekBar> createState() => _SeekBarState();
}

class _SeekBarState extends State<_SeekBar> {
  double? _dragValue;

  String _format(Duration d) {
    final totalSeconds = d.inSeconds;
    final minutes = (totalSeconds ~/ 60).toString();
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final handler = widget.controller.audioHandler;

    return StreamBuilder<Duration>(
      stream: handler.positionStream,
      initialData: Duration.zero,
      builder: (context, posSnap) {
        return StreamBuilder<Duration?>(
          stream: handler.durationStream,
          builder: (context, durSnap) {
            final position = posSnap.data ?? Duration.zero;
            final duration = durSnap.data ?? Duration.zero;
            final maxMs = duration.inMilliseconds.toDouble();
            final currentMs = _dragValue ??
                position.inMilliseconds
                    .toDouble()
                    .clamp(0.0, maxMs > 0 ? maxMs : 1.0);

            return Column(
              children: [
                Slider(
                  value: maxMs > 0 ? currentMs.clamp(0.0, maxMs) : 0.0,
                  max: maxMs > 0 ? maxMs : 1.0,
                  onChanged: maxMs > 0
                      ? (v) => setState(() => _dragValue = v)
                      : null,
                  onChangeEnd: maxMs > 0
                      ? (v) {
                          setState(() => _dragValue = null);
                          handler.seek(Duration(milliseconds: v.round()));
                        }
                      : null,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _format(
                          _dragValue != null
                              ? Duration(milliseconds: _dragValue!.round())
                              : position,
                        ),
                        style: const TextStyle(
                          color: SpotifyColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        _format(duration),
                        style: const TextStyle(
                          color: SpotifyColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _PlaybackControls extends StatelessWidget {
  const _PlaybackControls({required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final handler = controller.audioHandler;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        ValueListenableBuilder<bool>(
          valueListenable: handler.isShuffleNotifier,
          builder: (context, isShuffle, _) {
            return IconButton(
              onPressed: handler.toggleShuffle,
              icon: Icon(
                Icons.shuffle_rounded,
                color: isShuffle
                    ? SpotifyColors.spotifyGreen
                    : SpotifyColors.textSecondary,
                size: 24,
              ),
              tooltip: 'Shuffle',
            );
          },
        ),
        IconButton(
          onPressed: handler.skipToPrevious,
          icon: const Icon(
            Icons.skip_previous_rounded,
            color: SpotifyColors.textPrimary,
            size: 38,
          ),
          tooltip: 'Previous',
        ),
        ValueListenableBuilder<bool>(
          valueListenable: handler.isResolvingNotifier,
          builder: (context, isResolving, _) {
            return StreamBuilder<bool>(
              stream: handler.playingStream,
              initialData: handler.isPlaying,
              builder: (context, snap) {
                final isPlaying = snap.data ?? false;
                return Container(
                  width: 66,
                  height: 66,
                  decoration: const BoxDecoration(
                    color: SpotifyColors.textPrimary,
                    shape: BoxShape.circle,
                  ),
                  child: isResolving
                      ? const Padding(
                          padding: EdgeInsets.all(18),
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: Colors.black,
                          ),
                        )
                      : IconButton(
                          onPressed: () {
                            if (isPlaying) {
                              handler.pause();
                            } else {
                              handler.play();
                            }
                          },
                          icon: Icon(
                            isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: Colors.black,
                            size: 38,
                          ),
                          tooltip: isPlaying ? 'Pause' : 'Play',
                        ),
                );
              },
            );
          },
        ),
        IconButton(
          onPressed: handler.skipToNext,
          icon: const Icon(
            Icons.skip_next_rounded,
            color: SpotifyColors.textPrimary,
            size: 38,
          ),
          tooltip: 'Next',
        ),
        ValueListenableBuilder<bool>(
          valueListenable: handler.isAutoplayNotifier,
          builder: (context, isAutoplay, _) {
            return IconButton(
              onPressed: handler.toggleAutoplay,
              icon: Icon(
                Icons.all_inclusive_rounded,
                color: isAutoplay
                    ? SpotifyColors.spotifyGreen
                    : SpotifyColors.textSecondary,
                size: 24,
              ),
              tooltip: 'Autoplay',
            );
          },
        ),
      ],
    );
  }
}

class _BottomActions extends StatelessWidget {
  const _BottomActions({
    required this.song,
    required this.controller,
    required this.downloadProgress,
  });

  final Song song;
  final AppController controller;
  final double? downloadProgress;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        if (downloadProgress != null)
          SizedBox(
            width: 44,
            height: 44,
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  value: downloadProgress! > 0 ? downloadProgress : null,
                  strokeWidth: 2.5,
                  color: SpotifyColors.spotifyGreen,
                ),
              ),
            ),
          )
        else
          IconButton(
            onPressed: () async {
              if (song.isDownloaded) {
                await controller.deleteDownload(song);
              } else {
                await controller.downloadSong(song);
              }
            },
            icon: Icon(
              song.isDownloaded
                  ? Icons.download_done_rounded
                  : Icons.download_for_offline_outlined,
              color: song.isDownloaded
                  ? SpotifyColors.spotifyGreen
                  : SpotifyColors.textSecondary,
            ),
            tooltip:
                song.isDownloaded ? 'Remove offline download' : 'Download',
          ),
        IconButton(
          onPressed: () => _showQueueSheet(context),
          icon: const Icon(
            Icons.queue_music_rounded,
            color: SpotifyColors.textSecondary,
          ),
          tooltip: 'Queue',
        ),
        IconButton(
          onPressed: controller.toggleBatterySaver,
          icon: Icon(
            Icons.battery_saver_rounded,
            color: controller.isBatterySaver
                ? SpotifyColors.spotifyGreen
                : SpotifyColors.textSecondary,
          ),
          tooltip: 'OLED Battery Saver',
        ),
      ],
    );
  }

  void _showQueueSheet(BuildContext context) {
    final handler = controller.audioHandler;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.55,
          maxChildSize: 0.85,
          minChildSize: 0.35,
          builder: (_, scrollController) {
            return ValueListenableBuilder<List<Song>>(
              valueListenable: handler.queueNotifier,
              builder: (_, queue, _) {
                final currentKey = handler.currentSongNotifier.value?.songKey;
                return Column(
                  children: [
                    const SizedBox(height: 12),
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: SpotifyColors.textSecondary.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Text(
                            'Up Next',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${queue.length} tracks',
                            style: const TextStyle(
                              color: SpotifyColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: queue.isEmpty
                          ? const Center(
                              child: Text(
                                'Queue is empty',
                                style: TextStyle(
                                  color: SpotifyColors.textSecondary,
                                ),
                              ),
                            )
                          : ListView.builder(
                              controller: scrollController,
                              itemCount: queue.length,
                              itemBuilder: (_, index) {
                                final item = queue[index];
                                final isCurrent = item.songKey == currentKey;
                                return ListTile(
                                  leading: Icon(
                                    isCurrent
                                        ? Icons.graphic_eq_rounded
                                        : Icons.music_note_rounded,
                                    color: isCurrent
                                        ? SpotifyColors.spotifyGreen
                                        : SpotifyColors.textSecondary,
                                  ),
                                  title: Text(
                                    item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: isCurrent
                                          ? SpotifyColors.spotifyGreen
                                          : SpotifyColors.textPrimary,
                                      fontWeight: isCurrent
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                    ),
                                  ),
                                  subtitle: Text(
                                    item.artist,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: SpotifyColors.textSecondary,
                                    ),
                                  ),
                                  onTap: () {
                                    controller.playSong(item, queue: queue);
                                    Navigator.of(ctx).pop();
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }
}

class BatterySaverOverlay extends StatelessWidget {
  const BatterySaverOverlay({
    super.key,
    required this.onWake,
  });

  final VoidCallback onWake;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onWake,
        child: Container(
          color: Colors.black,
          alignment: Alignment.center,
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.nights_stay_outlined,
                color: Colors.white.withValues(alpha: 0.35),
                size: 40,
              ),
              const SizedBox(height: 16),
              Text(
                'Music keeps playing.\nTap anywhere to wake.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  height: 1.5,
                  decoration: TextDecoration.none,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
