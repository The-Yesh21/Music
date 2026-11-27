import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../theme/spotify_theme.dart';

class EchoDockItem {
  const EchoDockItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    this.isActive = false,
    this.badge,
    this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final String? badge;
  final VoidCallback? onTap;
}

/// Floating frosted-glass Dock footer navbar inspired by React Bits `<Dock />`.
/// Supports spring hop on tap, active indicator dots, badges, and magnification.
class EchoDock extends StatefulWidget {
  const EchoDock({
    super.key,
    required this.items,
    this.trailingItem,
  });

  final List<EchoDockItem> items;
  final EchoDockItem? trailingItem;

  @override
  State<EchoDock> createState() => _EchoDockState();
}

class _EchoDockState extends State<EchoDock> {
  int? _pressedIndex;

  @override
  Widget build(BuildContext context) {
    final isDark = SpotifyColors.isDark;
    final panelColor = isDark
        ? const Color(0xCC171513)
        : const Color(0xDCF1E7D5);
    final edgeColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : Colors.black.withValues(alpha: 0.08);
    final highlightColor = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.white.withValues(alpha: 0.75);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
        child: Center(
          child: RepaintBoundary(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                child: Container(
                height: 66,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: panelColor,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: edgeColor, width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? 0.55 : 0.18),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                    BoxShadow(
                      color: highlightColor,
                      blurRadius: 0,
                      offset: const Offset(0, -0.5),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < widget.items.length; i++) ...[
                      if (i > 0) const SizedBox(width: 10),
                      _DockTile(
                        item: widget.items[i],
                        isPressed: _pressedIndex == i,
                        onPressChanged: (pressed) {
                          setState(() => _pressedIndex = pressed ? i : null);
                        },
                      ),
                    ],
                    if (widget.trailingItem != null) ...[
                      const SizedBox(width: 10),
                      Container(
                        width: 1,
                        height: 32,
                        decoration: BoxDecoration(
                          color: SpotifyColors.divider,
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _DockTile(
                        item: widget.trailingItem!,
                        isPressed: _pressedIndex == 99,
                        onPressChanged: (pressed) {
                          setState(() => _pressedIndex = pressed ? 99 : null);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DockTile extends StatefulWidget {
  const _DockTile({
    required this.item,
    required this.isPressed,
    required this.onPressChanged,
  });

  final EchoDockItem item;
  final bool isPressed;
  final ValueChanged<bool> onPressChanged;

  @override
  State<_DockTile> createState() => _DockTileState();
}

class _DockTileState extends State<_DockTile>
    with SingleTickerProviderStateMixin {
  late final AnimationController _hopCtrl;
  double _hopOffset = 0.0;

  @override
  void initState() {
    super.initState();
    _hopCtrl = AnimationController.unbounded(vsync: this)
      ..addListener(() {
        setState(() {
          _hopOffset = _hopCtrl.value;
        });
      });
  }

  @override
  void dispose() {
    _hopCtrl.dispose();
    super.dispose();
  }

  void _triggerHop() {
    final sim = SpringSimulation(
      const SpringDescription(mass: 0.25, stiffness: 280.0, damping: 10.0),
      -10.0,
      0.0,
      -40.0,
    );
    _hopCtrl.animateWith(sim);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = SpotifyColors.isDark;
    final active = widget.item.isActive;
    final scale = widget.isPressed
        ? 1.24
        : active
            ? 1.08
            : 1.0;

    final tileGradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: active
          ? [
              SpotifyColors.orangeAccent.withValues(alpha: 0.28),
              SpotifyColors.orangeAccent.withValues(alpha: 0.12),
            ]
          : isDark
              ? const [Color(0xFF2B2723), Color(0xFF1C1916)]
              : const [Color(0xFFFFFFFF), Color(0xFFEDE2CE)],
    );

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => widget.onPressChanged(true),
      onTapCancel: () => widget.onPressChanged(false),
      onTapUp: (_) => widget.onPressChanged(false),
      onTap: () {
        _triggerHop();
        widget.item.onTap?.call();
      },
      child: Tooltip(
        message: widget.item.label,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Transform.translate(
              offset: Offset(0, _hopOffset),
              child: AnimatedScale(
                scale: scale,
                duration: const Duration(milliseconds: 140),
                curve: Curves.easeOutCubic,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: tileGradient,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: active
                              ? SpotifyColors.orangeAccent.withValues(alpha: 0.7)
                              : SpotifyColors.divider,
                          width: active ? 1.3 : 0.8,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black
                                .withValues(alpha: isDark ? 0.45 : 0.14),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Icon(
                        active ? widget.item.activeIcon : widget.item.icon,
                        color: active
                            ? SpotifyColors.orangeAccent
                            : SpotifyColors.textPrimary,
                        size: 22,
                      ),
                    ),
                    if (widget.item.badge != null &&
                        widget.item.badge!.isNotEmpty)
                      Positioned(
                        top: -4,
                        right: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1.5,
                          ),
                          decoration: BoxDecoration(
                            color: SpotifyColors.orangeAccent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            widget.item.badge!,
                            style: TextStyle(
                              color: SpotifyColors.onAccent,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 3),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: active ? 5 : 0,
              height: active ? 4 : 0,
              decoration: BoxDecoration(
                color: SpotifyColors.orangeAccent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
