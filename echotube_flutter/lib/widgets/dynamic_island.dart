import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../screens/now_playing_screen.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

/// Animated Dynamic Island capsule at the top of the app that morphs between
/// a compact live-activity pill and an expanded quick-control card.
class DynamicIslandBar extends StatefulWidget {
  const DynamicIslandBar({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  State<DynamicIslandBar> createState() => _DynamicIslandBarState();
}

class _DynamicIslandBarState extends State<DynamicIslandBar>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  late final AnimationController _waveCtrl;
  StreamSubscription<bool>? _playingSub;

  @override
  void initState() {
    super.initState();
    _waveCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.controller.audioHandler.isPlaying) {
      _waveCtrl.repeat();
    }
    _playingSub =
        widget.controller.audioHandler.playingStream.listen((playing) {
      if (!mounted) return;
      if (playing && !_waveCtrl.isAnimating) {
        _waveCtrl.repeat();
      } else if (!playing && _waveCtrl.isAnimating) {
        _waveCtrl.stop();
      }
    });
  }

  @override
  void dispose() {
    _playingSub?.cancel();
    _waveCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final handler = widget.controller.audioHandler;

    return ValueListenableBuilder<Song?>(
      valueListenable: handler.currentSongNotifier,
      builder: (context, currentSong, _) {
        if (currentSong == null) return const SizedBox.shrink();

        return ListenableBuilder(
          listenable: widget.controller,
          builder: (context, _) {
            final liveSong = widget.controller.songs
                    .where((s) => s.songKey == currentSong.songKey)
                    .firstOrNull ??
                currentSong;
            final accent = moodColor(liveSong.category);

            return StreamBuilder<bool>(
              stream: handler.playingStream,
              initialData: handler.isPlaying,
              builder: (context, playSnap) {
                final isPlaying = playSnap.data ?? false;

                return SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 4),
                    child: Center(
                      child: GestureDetector(
                        onTap: () => setState(() => _expanded = !_expanded),
                        onLongPress: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              fullscreenDialog: true,
                              builder: (_) => NowPlayingScreen(
                                controller: widget.controller,
                              ),
                            ),
                          );
                        },
                        child: RepaintBoundary(
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 240),
                            curve: Curves.easeOutCubic,
                            width: _expanded
                                ? MediaQuery.sizeOf(context).width - 28
                                : 256,
                            padding: EdgeInsets.symmetric(
                              horizontal: _expanded ? 14 : 10,
                              vertical: _expanded ? 12 : 7,
                            ),
                            decoration: BoxDecoration(
                              color: SpotifyColors.inkBlack,
                              borderRadius:
                                  BorderRadius.circular(_expanded ? 24 : 999),
                              border: Border.all(
                                color: accent.withValues(
                                  alpha: isPlaying ? 0.85 : 0.4,
                                ),
                                width: 1.2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: AnimatedSize(
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOutCubic,
                              alignment: Alignment.topCenter,
                              child: _expanded
                                  ? _buildExpanded(
                                      context,
                                      liveSong,
                                      accent,
                                      isPlaying,
                                    )
                                  : _buildCompact(liveSong, accent, isPlaying),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildCompact(Song song, Color accent, bool isPlaying) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _IslandArt(
          imageUrl: song.imageUrl,
          accent: accent,
          size: 26,
          radius: 13,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            song.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: SpotifyColors.cream,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 8),
        RepaintBoundary(
          child: _LiveWaveform(
            controller: _waveCtrl,
            isPlaying: isPlaying,
            color: SpotifyColors.orangeDark,
          ),
        ),
      ],
    );
  }

  Widget _buildExpanded(
    BuildContext context,
    Song song,
    Color accent,
    bool isPlaying,
  ) {
    final handler = widget.controller.audioHandler;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            _IslandArt(
              imageUrl: song.imageUrl,
              accent: accent,
              size: 46,
              radius: 12,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    song.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: SpotifyColors.cream,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${song.artist} • ${song.category}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: SpotifyColors.cream.withValues(alpha: 0.72),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    fullscreenDialog: true,
                    builder: (_) =>
                        NowPlayingScreen(controller: widget.controller),
                  ),
                );
              },
              icon: const Icon(
                Icons.open_in_full_rounded,
                color: SpotifyColors.cream,
                size: 18,
              ),
              tooltip: 'Open Full Player',
            ),
          ],
        ),
        const SizedBox(height: 8),
        StreamBuilder<Duration>(
          stream: handler.positionStream,
          initialData: Duration.zero,
          builder: (context, posSnap) {
            return StreamBuilder<Duration?>(
              stream: handler.durationStream,
              builder: (context, durSnap) {
                final pos = posSnap.data ?? Duration.zero;
                final dur = durSnap.data ?? Duration.zero;
                final progress = dur.inMilliseconds > 0
                    ? (pos.inMilliseconds / dur.inMilliseconds).clamp(0.0, 1.0)
                    : 0.0;

                return Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 4,
                        backgroundColor:
                            SpotifyColors.cream.withValues(alpha: 0.16),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          SpotifyColors.orangeDark,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _fmtTime(pos),
                          style: TextStyle(
                            color: SpotifyColors.cream.withValues(alpha: 0.65),
                            fontSize: 10.5,
                          ),
                        ),
                        Text(
                          _fmtTime(dur),
                          style: TextStyle(
                            color: SpotifyColors.cream.withValues(alpha: 0.65),
                            fontSize: 10.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              },
            );
          },
        ),
        const SizedBox(height: 2),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            IconButton(
              onPressed: () => widget.controller.toggleLike(song),
              icon: Icon(
                song.isLiked
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: song.isLiked
                    ? SpotifyColors.orangeDark
                    : SpotifyColors.cream,
                size: 20,
              ),
            ),
            IconButton(
              onPressed: handler.skipToPrevious,
              icon: const Icon(
                Icons.skip_previous_rounded,
                color: SpotifyColors.cream,
                size: 26,
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                color: SpotifyColors.orangeDark,
                shape: BoxShape.circle,
              ),
              child: IconButton(
                onPressed: isPlaying ? handler.pause : handler.play,
                icon: Icon(
                  isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: SpotifyColors.inkBlack,
                  size: 24,
                ),
              ),
            ),
            IconButton(
              onPressed: handler.skipToNext,
              icon: const Icon(
                Icons.skip_next_rounded,
                color: SpotifyColors.cream,
                size: 26,
              ),
            ),
            IconButton(
              onPressed: () => setState(() => _expanded = false),
              icon: Icon(
                Icons.keyboard_arrow_up_rounded,
                color: SpotifyColors.cream.withValues(alpha: 0.75),
                size: 22,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _IslandArt extends StatelessWidget {
  const _IslandArt({
    required this.imageUrl,
    required this.accent,
    required this.size,
    required this.radius,
  });

  final String? imageUrl;
  final Color accent;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: size,
        height: size,
        child: url.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                errorWidget: (_, _, _) => _fallback(),
              )
            : _fallback(),
      ),
    );
  }

  Widget _fallback() {
    return Container(
      color: accent.withValues(alpha: 0.25),
      child: Icon(Icons.music_note_rounded, color: accent, size: size * 0.6),
    );
  }
}

class _LiveWaveform extends StatelessWidget {
  const _LiveWaveform({
    required this.controller,
    required this.isPlaying,
    required this.color,
  });

  final Animation<double> controller;
  final bool isPlaying;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final t = controller.value * 2 * math.pi;
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(4, (i) {
            final h = isPlaying
                ? 5.0 + 9.0 * (0.5 + 0.5 * math.sin(t + i * 1.3))
                : 4.0;
            return Container(
              width: 2.5,
              height: h,
              margin: const EdgeInsets.symmetric(horizontal: 1.2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            );
          }),
        );
      },
    );
  }
}

String _fmtTime(Duration d) {
  final secs = d.inSeconds < 0 ? 0 : d.inSeconds;
  final m = secs ~/ 60;
  final s = secs % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}
