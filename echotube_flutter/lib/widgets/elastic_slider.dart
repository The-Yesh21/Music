import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../theme/spotify_theme.dart';

/// A spring-physics elastic slider inspired by React Bits' ElasticSlider.
/// Grows in thickness on touch, stretches with rubber-band resistance past
/// either end, and displays a floating value bubble while scrubbing.
class ElasticSlider extends StatefulWidget {
  const ElasticSlider({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
    this.onChangeStart,
    this.onChangeEnd,
    this.formatValue,
    this.thickness = 6.0,
    this.activeThickness = 12.0,
    this.maxStretch = 28.0,
    this.trackColor,
    this.rangeColor,
    this.bubbleTextColor,
  });

  final double value;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;
  final ValueChanged<double>? onChangeStart;
  final ValueChanged<double>? onChangeEnd;
  final String Function(double value)? formatValue;
  final double thickness;
  final double activeThickness;
  final double maxStretch;
  final Color? trackColor;
  final Color? rangeColor;
  final Color? bubbleTextColor;

  @override
  State<ElasticSlider> createState() => _ElasticSliderState();
}

class _ElasticSliderState extends State<ElasticSlider>
    with TickerProviderStateMixin {
  late final AnimationController _activeCtrl;
  late final AnimationController _stretchCtrl;

  bool _dragging = false;
  double _stretchPx = 0.0;
  double _stretchSide = 1.0; // -1 left, +1 right

  @override
  void initState() {
    super.initState();
    _activeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _stretchCtrl = AnimationController.unbounded(vsync: this)
      ..addListener(() {
        setState(() {
          _stretchPx = _stretchCtrl.value;
        });
      });
  }

  @override
  void dispose() {
    _activeCtrl.dispose();
    _stretchCtrl.dispose();
    super.dispose();
  }

  double _rubber(double distance, double limit) {
    if (limit <= 0) return 0;
    return 2.0 * (1.0 / (1.0 + math.exp(-distance / limit)) - 0.5) * limit;
  }

  void _springBackStretch() {
    final simulation = SpringSimulation(
      const SpringDescription(mass: 1.0, stiffness: 260.0, damping: 14.0),
      _stretchPx,
      0.0,
      0.0,
    );
    _stretchCtrl.animateWith(simulation);
  }

  double _fractionFor(double value) {
    final span = widget.max - widget.min;
    if (span <= 0) return 0;
    return ((value - widget.min) / span).clamp(0.0, 1.0);
  }

  void _handleDrag(Offset localPos, double width) {
    if (width <= 0) return;
    final rawFraction = localPos.dx / width;
    final overPx = rawFraction < 0
        ? -rawFraction * width
        : rawFraction > 1
            ? (rawFraction - 1.0) * width
            : 0.0;

    if (overPx > 0 && widget.maxStretch > 0) {
      _stretchCtrl.stop();
      setState(() {
        _stretchSide = rawFraction < 0 ? -1.0 : 1.0;
        _stretchPx = _rubber(overPx, widget.maxStretch);
      });
    } else if (_stretchPx != 0) {
      setState(() => _stretchPx = 0);
    }

    final clamped = rawFraction.clamp(0.0, 1.0);
    final nextVal = widget.min + clamped * (widget.max - widget.min);
    widget.onChanged(nextVal);
  }

  @override
  Widget build(BuildContext context) {
    final trackColor = widget.trackColor ??
        SpotifyColors.textSecondary.withValues(alpha: 0.28);
    final rangeColor = widget.rangeColor ?? SpotifyColors.orangeAccent;
    final bubbleTextColor = widget.bubbleTextColor ?? SpotifyColors.onAccent;
    final fraction = _fractionFor(widget.value);
    final label = widget.formatValue != null
        ? widget.formatValue!(widget.value)
        : widget.value.round().toString();

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.isFinite && constraints.maxWidth > 0
            ? constraints.maxWidth
            : 240.0;

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onHorizontalDragStart: (details) {
            setState(() => _dragging = true);
            _activeCtrl.forward();
            widget.onChangeStart?.call(widget.value);
            _handleDrag(details.localPosition, width);
          },
          onHorizontalDragUpdate: (details) {
            _handleDrag(details.localPosition, width);
          },
          onHorizontalDragEnd: (_) {
            setState(() => _dragging = false);
            _activeCtrl.reverse();
            _springBackStretch();
            widget.onChangeEnd?.call(widget.value);
          },
          onHorizontalDragCancel: () {
            setState(() => _dragging = false);
            _activeCtrl.reverse();
            _springBackStretch();
          },
          onTapDown: (details) {
            _activeCtrl.forward();
            widget.onChangeStart?.call(widget.value);
            _handleDrag(details.localPosition, width);
          },
          onTapUp: (_) {
            _activeCtrl.reverse();
            _springBackStretch();
            widget.onChangeEnd?.call(widget.value);
          },
          child: SizedBox(
            height: 36,
            child: AnimatedBuilder(
              animation: _activeCtrl,
              builder: (context, _) {
                final t = Curves.easeOutCubic.transform(_activeCtrl.value);
                final thick = widget.thickness +
                    (widget.activeThickness - widget.thickness) * t;
                final along = 1.0 + (_stretchPx / math.max(1.0, width));
                final across = 1.0 -
                    0.22 *
                        (_stretchPx / math.max(1.0, widget.maxStretch))
                            .clamp(-1.0, 1.0);
                final align = _stretchSide > 0
                    ? Alignment.centerLeft
                    : Alignment.centerRight;

                final fillWidth = (width * fraction).clamp(0.0, width);
                final bubbleX =
                    (fillWidth * along).clamp(20.0, math.max(20.0, width - 20.0));

                return Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.centerLeft,
                  children: [
                    Transform(
                      alignment: align,
                      transform: Matrix4.diagonal3Values(along, across, 1.0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(thick / 2),
                        child: Container(
                          width: width,
                          height: thick,
                          color: trackColor,
                          alignment: Alignment.centerLeft,
                          child: FractionallySizedBox(
                            widthFactor: fraction,
                            heightFactor: 1.0,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: rangeColor,
                                borderRadius: BorderRadius.circular(thick / 2),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (_dragging)
                      Positioned(
                        left: bubbleX - 24,
                        bottom: 24,
                        child: Opacity(
                          opacity: t.clamp(0.0, 1.0),
                          child: Container(
                            width: 48,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: rangeColor,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.25),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              label,
                              style: TextStyle(
                                color: bubbleTextColor,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }
}
