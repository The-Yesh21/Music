import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../models/song.dart';
import '../theme/spotify_theme.dart';

/// Interactive fanned card stack inspired by React Bits `<Stack />`.
/// Displays up to [visibleCount] stacked cards from a 15-20 song list,
/// supporting 3D-tilted drag/flick to cycle cards and play the top track.
class SongCardStack extends StatefulWidget {
  const SongCardStack({
    super.key,
    required this.songs,
    required this.currentSong,
    required this.isPlaying,
    required this.onPlaySong,
    required this.onTogglePlay,
    this.visibleCount = 4,
  });

  final List<Song> songs;
  final Song? currentSong;
  final bool isPlaying;
  final void Function(Song song, List<Song> queue) onPlaySong;
  final VoidCallback onTogglePlay;
  final int visibleCount;

  @override
  State<SongCardStack> createState() => _SongCardStackState();
}

class _SongCardStackState extends State<SongCardStack>
    with SingleTickerProviderStateMixin {
  late List<int> _order;
  late final AnimationController _springCtrl;

  Offset _dragOffset = Offset.zero;
  Offset _animStartOffset = Offset.zero;
  Offset _animEndOffset = Offset.zero;
  bool _isDragging = false;
  bool _isFlinging = false;

  @override
  void initState() {
    super.initState();
    _syncOrder(reset: true);
    _springCtrl = AnimationController.unbounded(vsync: this)
      ..addListener(() {
        setState(() {
          _dragOffset = Offset.lerp(
                _animStartOffset,
                _animEndOffset,
                _springCtrl.value.clamp(0.0, 1.5),
              ) ??
              Offset.zero;
        });
      });
  }

  @override
  void didUpdateWidget(covariant SongCardStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.songs.length != widget.songs.length) {
      _syncOrder(reset: true);
    } else if (widget.currentSong != null && !_isDragging && !_isFlinging) {
      // Keep the currently playing song on top if it belongs to this stack.
      final idx = widget.songs
          .indexWhere((s) => s.songKey == widget.currentSong!.songKey);
      if (idx >= 0 && _order.isNotEmpty && _order.first != idx) {
        final next = List<int>.from(_order)..remove(idx)..insert(0, idx);
        _order = next;
      }
    }
  }

  void _syncOrder({bool reset = false}) {
    final count = widget.songs.length;
    if (reset || _order.length != count) {
      _order = List<int>.generate(count, (i) => i);
      if (widget.currentSong != null) {
        final idx = widget.songs
            .indexWhere((s) => s.songKey == widget.currentSong!.songKey);
        if (idx > 0) {
          _order.remove(idx);
          _order.insert(0, idx);
        }
      }
    }
  }

  @override
  void dispose() {
    _springCtrl.dispose();
    super.dispose();
  }

  void _springTo(Offset target, {bool sendToBackAfter = false, Offset velocity = Offset.zero}) {
    _animStartOffset = _dragOffset;
    _animEndOffset = target;
    _isFlinging = sendToBackAfter;

    final sim = SpringSimulation(
      const SpringDescription(mass: 1.0, stiffness: 320.0, damping: 24.0),
      0.0,
      1.0,
      (velocity.distance / 800.0).clamp(0.0, 4.0),
    );
    _springCtrl.animateWith(sim).whenComplete(() {
      if (!mounted) return;
      if (sendToBackAfter && _order.length > 1) {
        setState(() {
          final top = _order.removeAt(0);
          _order.add(top);
          _dragOffset = Offset.zero;
          _isFlinging = false;
        });
        final newTopSong = widget.songs[_order.first];
        final reorderedQueue = _order.map((i) => widget.songs[i]).toList();
        widget.onPlaySong(newTopSong, reorderedQueue);
      } else {
        setState(() {
          _dragOffset = Offset.zero;
          _isFlinging = false;
        });
      }
    });
  }

  void _cycleNext() {
    if (_order.length < 2 || _isFlinging) return;
    _springTo(const Offset(340, -60), sendToBackAfter: true);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.songs.isEmpty) return const SizedBox.shrink();

    final visible = math.min(widget.visibleCount, _order.length);
    final dragProgress = (_dragOffset.distance / 110.0).clamp(0.0, 1.0);
    final topSong = widget.songs[_order.first];
    final isTopActive =
        widget.currentSong?.songKey == topSong.songKey && widget.isPlaying;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Walk-In Stack',
                      style: TextStyle(
                        color: SpotifyColors.textPrimary,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                      ),
                    ),
                    Text(
                      '${widget.songs.length} tracks • Swipe card to skip',
                      style: TextStyle(
                        color: SpotifyColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: _cycleNext,
                icon: Icon(
                  Icons.skip_next_rounded,
                  size: 18,
                  color: SpotifyColors.orangeAccent,
                ),
                label: Text(
                  'Next Card',
                  style: TextStyle(
                    color: SpotifyColors.orangeAccent,
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ],
          ),
        ),
        Center(
          child: SizedBox(
            width: 248,
            height: 248,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                for (var pos = visible - 1; pos >= 0; pos--)
                  _buildCardAtPosition(pos, dragProgress, isTopActive),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCardAtPosition(int pos, double dragProgress, bool isTopActive) {
    final songIndex = _order[pos];
    final song = widget.songs[songIndex];
    final isTop = pos == 0;
    final accent = moodColor(song.category);

    // Fan placement: cards behind rotate & scale down, lifting as top card is dragged.
    final lift = isTop ? 0.0 : dragProgress * 0.45;
    final effectivePos = (pos - lift).clamp(0.0, visibleCountFloat);
    final fanAngle = effectivePos * 0.085; // ~5 deg per card
    final fanScale = 1.0 - effectivePos * 0.065;
    final fanDx = effectivePos * 10.0;
    final fanDy = effectivePos * 6.0;

    final tx = isTop ? _dragOffset.dx : fanDx;
    final ty = isTop ? _dragOffset.dy : fanDy;
    final tiltY = isTop ? (_dragOffset.dx / 240.0).clamp(-0.45, 0.45) : 0.0;
    final tiltX = isTop ? (-_dragOffset.dy / 240.0).clamp(-0.35, 0.35) : 0.0;
    final spin = isTop ? (_dragOffset.dx / 300.0).clamp(-0.2, 0.2) : fanAngle;
    final scale = isTop ? (_isDragging ? 1.03 : 1.0) : fanScale;

    final matrix = Matrix4.identity()
      ..setEntry(3, 2, 0.0012)
      ..translateByDouble(tx, ty, 0.0, 1.0)
      ..rotateX(tiltX)
      ..rotateY(tiltY)
      ..rotateZ(spin)
      ..scaleByDouble(scale, scale, 1.0, 1.0);

    final cardWidget = Transform(
      alignment: const Alignment(0.75, 0.85),
      transform: matrix,
      child: _StackCardFace(
        song: song,
        accent: accent,
        shadeOpacity: isTop ? 0.0 : (effectivePos * 0.14).clamp(0.0, 0.48),
        isTop: isTop,
        isPlaying: isTop && isTopActive,
      ),
    );

    if (!isTop) return cardWidget;

    return GestureDetector(
      onTap: () {
        if (widget.currentSong?.songKey == song.songKey) {
          widget.onTogglePlay();
        } else {
          final queue = _order.map((i) => widget.songs[i]).toList();
          widget.onPlaySong(song, queue);
        }
      },
      onPanStart: (_) {
        _springCtrl.stop();
        setState(() => _isDragging = true);
      },
      onPanUpdate: (details) {
        setState(() {
          _dragOffset += details.delta;
        });
      },
      onPanEnd: (details) {
        setState(() => _isDragging = false);
        final v = details.velocity.pixelsPerSecond;
        final flick = v.distance > 550 && _dragOffset.distance > 18;
        if (_dragOffset.distance > 85 || flick) {
          final dir = v.distance > 250 ? v : _dragOffset;
          final norm = dir.distance > 0 ? dir / dir.distance : const Offset(1, -0.3);
          _springTo(norm * 360.0, sendToBackAfter: true, velocity: v);
        } else {
          _springTo(Offset.zero, velocity: v);
        }
      },
      child: cardWidget,
    );
  }

  double get visibleCountFloat => widget.visibleCount.toDouble();
}

class _StackCardFace extends StatelessWidget {
  const _StackCardFace({
    required this.song,
    required this.accent,
    required this.shadeOpacity,
    required this.isTop,
    required this.isPlaying,
  });

  final Song song;
  final Color accent;
  final double shadeOpacity;
  final bool isTop;
  final bool isPlaying;

  @override
  Widget build(BuildContext context) {
    final url = song.imageUrl?.trim() ?? '';

    return RepaintBoundary(
      child: Container(
        width: 224,
        height: 224,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isTop
                ? accent.withValues(alpha: 0.75)
                : SpotifyColors.divider,
            width: isTop ? 1.5 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isTop ? 0.35 : 0.2),
              blurRadius: isTop ? 12 : 6,
              offset: const Offset(0, 6),
            ),
          ],
        ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (url.isNotEmpty)
            CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              errorWidget: (_, _, _) => _fallback(),
            )
          else
            _fallback(),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.84),
                ],
                stops: const [0.35, 1.0],
              ),
            ),
          ),
          if (shadeOpacity > 0)
            Container(color: Colors.black.withValues(alpha: shadeOpacity)),
          Positioned(
            top: 10,
            left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: accent.withValues(alpha: 0.85)),
              ),
              child: Text(
                song.category,
                style: TextStyle(
                  color: accent,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          if (isTop)
            Positioned(
              top: 10,
              right: 10,
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: SpotifyColors.orangeAccent,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: SpotifyColors.onAccent,
                  size: 20,
                ),
              ),
            ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  song.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: SpotifyColors.cream,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  song.artist,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: SpotifyColors.cream.withValues(alpha: 0.78),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _fallback() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: 0.85),
            SpotifyColors.inkElevated,
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.music_note_rounded,
          color: SpotifyColors.cream.withValues(alpha: 0.85),
          size: 56,
        ),
      ),
    );
  }
}
