import 'package:flutter/material.dart';

class SpotifyColors {
  SpotifyColors._();

  static const Color scaffoldBackground = Color(0xFF121212);
  static const Color surface = Color(0xFF181818);
  static const Color elevated = Color(0xFF282828);
  static const Color spotifyGreen = Color(0xFF1DB954);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFB3B3B3);
  static const Color divider = Color(0xFF2A2A2A);

  static const Color happy = Color(0xFFF59E0B);
  static const Color lonely = Color(0xFF6366F1);
  static const Color enjoyment = Color(0xFFEC4899);
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
      return SpotifyColors.spotifyGreen;
  }
}

LinearGradient moodGradient(String category) {
  final accent = moodColor(category);
  return LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      accent.withValues(alpha: 0.55),
      SpotifyColors.surface,
      SpotifyColors.scaffoldBackground,
    ],
    stops: const [0.0, 0.45, 1.0],
  );
}

ThemeData buildSpotifyTheme() {
  const colorScheme = ColorScheme.dark(
    primary: SpotifyColors.spotifyGreen,
    onPrimary: Colors.black,
    secondary: SpotifyColors.spotifyGreen,
    onSecondary: Colors.black,
    surface: SpotifyColors.surface,
    onSurface: SpotifyColors.textPrimary,
    surfaceContainerHighest: SpotifyColors.elevated,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: SpotifyColors.scaffoldBackground,
    canvasColor: SpotifyColors.scaffoldBackground,
    cardColor: SpotifyColors.surface,
    dividerColor: SpotifyColors.divider,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      foregroundColor: SpotifyColors.textPrimary,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xEE121212),
      selectedItemColor: SpotifyColors.textPrimary,
      unselectedItemColor: SpotifyColors.textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      unselectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: SpotifyColors.elevated,
      contentTextStyle: const TextStyle(color: SpotifyColors.textPrimary),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: SpotifyColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: SpotifyColors.textPrimary,
      inactiveTrackColor: SpotifyColors.textSecondary.withValues(alpha: 0.3),
      thumbColor: SpotifyColors.textPrimary,
      overlayColor: SpotifyColors.textPrimary.withValues(alpha: 0.15),
      trackHeight: 3,
      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: SpotifyColors.elevated,
      selectedColor: SpotifyColors.spotifyGreen,
      labelStyle: const TextStyle(
        color: SpotifyColors.textPrimary,
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
      secondaryLabelStyle: const TextStyle(
        color: Colors.black,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
      side: BorderSide.none,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );
}
