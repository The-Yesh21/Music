import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../screens/now_playing_screen.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

class MiniPlayer extends StatelessWidget {
  const MiniPlayer({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final handler = controller.audioHandler;

    return ValueListenableBuilder<Song?>(
      valueListenable: handler.currentSongNotifier,
      builder: (context, currentSong, _) {
        if (currentSong == null) return const SizedBox.shrink();

        return ListenableBuilder(
          listenable: controller,
          builder: (context, _) {
            final liveSong = controller.songs
                    .where((s) => s.songKey == currentSong.songKey)
                    .firstOrNull ??
                currentSong;
            final accent = moodColor(liveSong.category);

            return Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Material(
                color: SpotifyColors.elevated,
                borderRadius: BorderRadius.circular(10),
                clipBehavior: Clip.antiAlias,
                elevation: 6,
                child: InkWell(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        fullscreenDialog: true,
                        builder: (_) => NowPlayingScreen(controller: controller),
                      ),
                    );
                  },
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
                        child: Row(
                          children: [
                            _ArtworkThumb(
                              imageUrl: liveSong.imageUrl,
                              accent: accent,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    liveSong.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: SpotifyColors.textPrimary,
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  StreamBuilder<Duration>(
                                    stream: handler.positionStream,
                                    initialData: Duration.zero,
                                    builder: (context, posSnap) {
                                      return StreamBuilder<Duration?>(
                                        stream: handler.durationStream,
                                        builder: (context, durSnap) {
                                          final pos = posSnap.data ?? Duration.zero;
                                          final dur = durSnap.data;
                                          final timeText = dur != null && dur > Duration.zero
                                              ? ' • ${_fmt(pos)} / ${_fmt(dur)}'
                                              : '';
                                          return Text(
                                            '${liveSong.artist}$timeText',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: SpotifyColors.textSecondary,
                                              fontSize: 12,
                                            ),
                                          );
                                        },
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () => controller.toggleLike(liveSong),
                              icon: Icon(
                                liveSong.isLiked
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                color: liveSong.isLiked
                                    ? SpotifyColors.spotifyGreen
                                    : SpotifyColors.textSecondary,
                                size: 22,
                              ),
                              tooltip:
                                  liveSong.isLiked ? 'Unlike' : 'Save to Liked',
                            ),
                            ValueListenableBuilder<bool>(
                              valueListenable: handler.isResolvingNotifier,
                              builder: (context, isResolving, _) {
                                if (isResolving) {
                                  return Padding(
                                    padding: EdgeInsets.all(12),
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.2,
                                        color: SpotifyColors.textPrimary,
                                      ),
                                    ),
                                  );
                                }
                                return StreamBuilder<bool>(
                                  stream: handler.playingStream,
                                  initialData: handler.isPlaying,
                                  builder: (context, snapshot) {
                                    final isPlaying = snapshot.data ?? false;
                                    return IconButton(
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
                                        color: SpotifyColors.textPrimary,
                                        size: 28,
                                      ),
                                      tooltip: isPlaying ? 'Pause' : 'Play',
                                    );
                                  },
                                );
                              },
                            ),
                            IconButton(
                              onPressed: handler.skipToNext,
                              icon: Icon(
                                Icons.skip_next_rounded,
                                color: SpotifyColors.textPrimary,
                                size: 26,
                              ),
                              tooltip: 'Next',
                            ),
                          ],
                        ),
                      ),
                      StreamBuilder<Duration>(
                        stream: handler.positionStream,
                        initialData: Duration.zero,
                        builder: (context, posSnap) {
                          return StreamBuilder<Duration?>(
                            stream: handler.durationStream,
                            builder: (context, durSnap) {
                              final pos = posSnap.data?.inMilliseconds ?? 0;
                              final dur = durSnap.data?.inMilliseconds ?? 0;
                              final progress = dur > 0
                                  ? (pos / dur).clamp(0.0, 1.0)
                                  : 0.0;
                              return LinearProgressIndicator(
                                value: progress,
                                minHeight: 2.2,
                                backgroundColor:
                                    Colors.white.withValues(alpha: 0.12),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  accent,
                                ),
                              );
                            },
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

String _fmt(Duration d) {
  final totalSeconds = d.inSeconds < 0 ? 0 : d.inSeconds;
  final mins = totalSeconds ~/ 60;
  final secs = totalSeconds % 60;
  return '$mins:${secs.toString().padLeft(2, '0')}';
}

class _ArtworkThumb extends StatelessWidget {
  const _ArtworkThumb({
    required this.imageUrl,
    required this.accent,
  });

  final String? imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: SizedBox(
        width: 44,
        height: 44,
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
      color: accent.withValues(alpha: 0.25),
      child: Icon(
        Icons.music_note_rounded,
        color: accent,
        size: 22,
      ),
    );
  }
}
