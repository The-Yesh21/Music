import 'package:flutter/material.dart';

/// Cream, Ink Black & Orange editorial palette supporting both Dark and Light themes.
class SpotifyColors {
  SpotifyColors._();

  static bool _isDark = true;
  static bool get isDark => _isDark;

  static void setDarkMode(bool dark) {
    _isDark = dark;
  }

  // Core Brand Palette: Cream, Ink Black & Orange
  static const Color inkBlack = Color(0xFF0E0D0C);
  static const Color inkSurface = Color(0xFF171513);
  static const Color inkElevated = Color(0xFF23201C);
  static const Color cream = Color(0xFFFAF4E8);
  static const Color creamSurface = Color(0xFFF1E7D5);
  static const Color creamElevated = Color(0xFFE6D8C0);
  static const Color orangeDark = Color(0xFFFF6B2C);
  static const Color orangeLight = Color(0xFFE05216);

  static Color get scaffoldBackground => _isDark ? inkBlack : cream;
  static Color get surface => _isDark ? inkSurface : creamSurface;
  static Color get elevated => _isDark ? inkElevated : creamElevated;
  static Color get spotifyGreen => _isDark ? orangeDark : orangeLight;
  static Color get orangeAccent => spotifyGreen;
  static Color get textPrimary => _isDark ? cream : inkBlack;
  static Color get textSecondary =>
      _isDark ? const Color(0xFFB9AFA1) : const Color(0xFF5D544B);
  static Color get divider =>
      _isDark ? const Color(0xFF2D2924) : const Color(0xFFD8CBB5);
  static Color get navBarBackground =>
      _isDark ? const Color(0xF20E0D0C) : const Color(0xF2FAF4E8);
  static Color get onAccent => _isDark ? inkBlack : cream;

  // Mood Accents harmonized with Cream / Ink Black / Orange
  static const Color happy = Color(0xFFF59E0B);
  static const Color lonely = Color(0xFF6366F1);
  static const Color enjoyment = Color(0xFFFF6B2C);
}

Color moodColor(String category) {
  switch (category.trim().toLowerCase()) {
    case 'happy':
      return SpotifyColors.happy;
    case 'lonely':
      return SpotifyColors.lonely;
    case 'enjoyment':
      return SpotifyColors.enjoyment;
    default:
      return SpotifyColors.orangeAccent;
  }
}

LinearGradient moodGradient(String category) {
  final accent = moodColor(category);
  return LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      accent.withValues(alpha: SpotifyColors.isDark ? 0.55 : 0.35),
      SpotifyColors.surface,
      SpotifyColors.scaffoldBackground,
    ],
    stops: const [0.0, 0.45, 1.0],
  );
}

ThemeData buildSpotifyTheme({bool isDark = true}) {
  SpotifyColors.setDarkMode(isDark);

  final colorScheme = isDark
      ? ColorScheme.dark(
          primary: SpotifyColors.orangeAccent,
          onPrimary: SpotifyColors.onAccent,
          secondary: SpotifyColors.orangeAccent,
          onSecondary: SpotifyColors.onAccent,
          surface: SpotifyColors.surface,
          onSurface: SpotifyColors.textPrimary,
          surfaceContainerHighest: SpotifyColors.elevated,
        )
      : ColorScheme.light(
          primary: SpotifyColors.orangeAccent,
          onPrimary: SpotifyColors.onAccent,
          secondary: SpotifyColors.orangeAccent,
          onSecondary: SpotifyColors.onAccent,
          surface: SpotifyColors.surface,
          onSurface: SpotifyColors.textPrimary,
          surfaceContainerHighest: SpotifyColors.elevated,
        );

  return ThemeData(
    useMaterial3: true,
    brightness: isDark ? Brightness.dark : Brightness.light,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: SpotifyColors.scaffoldBackground,
    canvasColor: SpotifyColors.scaffoldBackground,
    cardColor: SpotifyColors.surface,
    dividerColor: SpotifyColors.divider,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      foregroundColor: SpotifyColors.textPrimary,
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: SpotifyColors.navBarBackground,
      selectedItemColor: SpotifyColors.orangeAccent,
      unselectedItemColor: SpotifyColors.textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
      ),
      unselectedLabelStyle: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w500,
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: SpotifyColors.elevated,
      contentTextStyle: TextStyle(color: SpotifyColors.textPrimary),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: SpotifyColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: SpotifyColors.orangeAccent,
      inactiveTrackColor: SpotifyColors.textSecondary.withValues(alpha: 0.3),
      thumbColor: SpotifyColors.orangeAccent,
      overlayColor: SpotifyColors.orangeAccent.withValues(alpha: 0.16),
      trackHeight: 3,
      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: SpotifyColors.elevated,
      selectedColor: SpotifyColors.orangeAccent,
      labelStyle: TextStyle(
        color: SpotifyColors.textPrimary,
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
      secondaryLabelStyle: TextStyle(
        color: SpotifyColors.onAccent,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
      side: BorderSide.none,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );
}
