import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'data/database_helper.dart';
import 'screens/home_screen.dart';
import 'screens/library_screen.dart';
import 'screens/now_playing_screen.dart';
import 'screens/search_screen.dart';
import 'services/audio_player_service.dart';
import 'services/jiosaavn_service.dart';
import 'state/app_controller.dart';
import 'theme/spotify_theme.dart';
import 'widgets/dynamic_island.dart';
import 'widgets/echo_dock.dart';
import 'widgets/mini_player.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  final audioHandler = await AudioService.init(
    builder: () => EchoTubeAudioHandler(
      DatabaseHelper.instance,
      JioSaavnService.instance,
    ),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.echotube.channel.audio',
      androidNotificationChannelName: 'EchoTube Playback',
      androidNotificationIcon: 'mipmap/ic_launcher',
      notificationColor: Color(0xFFFF6B2C),
      artDownscaleWidth: 512,
      artDownscaleHeight: 512,
      fastForwardInterval: Duration(seconds: 10),
      rewindInterval: Duration(seconds: 10),
      androidNotificationOngoing: false,
      androidStopForegroundOnPause: false,
      androidShowNotificationBadge: true,
    ),
  );

  final controller = AppController(
    db: DatabaseHelper.instance,
    audioHandler: audioHandler,
  );
  await controller.init();

  runApp(EchoTubeApp(controller: controller));
}

class EchoTubeApp extends StatelessWidget {
  const EchoTubeApp({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        return MaterialApp(
          title: 'EchoTube',
          debugShowCheckedModeBanner: false,
          theme: buildSpotifyTheme(isDark: controller.isDarkMode),
          home: _EchoTubeShell(controller: controller),
        );
      },
    );
  }
}

class _EchoTubeShell extends StatefulWidget {
  const _EchoTubeShell({required this.controller});

  final AppController controller;

  @override
  State<_EchoTubeShell> createState() => _EchoTubeShellState();
}

class _EchoTubeShellState extends State<_EchoTubeShell> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    widget.controller.audioHandler.errorNotifier.addListener(_onAudioError);
  }

  @override
  void dispose() {
    widget.controller.audioHandler.errorNotifier.removeListener(_onAudioError);
    super.dispose();
  }

  void _onAudioError() {
    final message = widget.controller.audioHandler.errorNotifier.value;
    if (message == null || message.trim().isEmpty || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      HomeScreen(controller: widget.controller),
      SearchScreen(controller: widget.controller),
      LibraryScreen(controller: widget.controller),
    ];

    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        return Stack(
          children: [
            Scaffold(
              body: Column(
                children: [
                  DynamicIslandBar(controller: widget.controller),
                  Expanded(
                    child: IndexedStack(
                      index: _currentIndex,
                      children: pages,
                    ),
                  ),
                ],
              ),
              bottomNavigationBar: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MiniPlayer(controller: widget.controller),
                  EchoDock(
                    items: [
                      EchoDockItem(
                        icon: Icons.home_outlined,
                        activeIcon: Icons.home_rounded,
                        label: 'Home',
                        isActive: _currentIndex == 0,
                        onTap: () => setState(() => _currentIndex = 0),
                      ),
                      EchoDockItem(
                        icon: Icons.search_rounded,
                        activeIcon: Icons.search_rounded,
                        label: 'Search',
                        isActive: _currentIndex == 1,
                        onTap: () => setState(() => _currentIndex = 1),
                      ),
                      EchoDockItem(
                        icon: Icons.library_music_outlined,
                        activeIcon: Icons.library_music_rounded,
                        label: 'Your Library',
                        isActive: _currentIndex == 2,
                        badge: widget.controller.downloadedSongs.isNotEmpty
                            ? '${widget.controller.downloadedSongs.length}'
                            : null,
                        onTap: () => setState(() => _currentIndex = 2),
                      ),
                    ],
                    trailingItem: EchoDockItem(
                      icon: Icons.shuffle_rounded,
                      activeIcon: Icons.shuffle_rounded,
                      label: 'Shuffle Mix',
                      onTap: () => widget.controller.playSongsList(
                        widget.controller.walkInStackSongs,
                        shuffle: true,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (widget.controller.isBatterySaver)
              BatterySaverOverlay(
                onWake: widget.controller.toggleBatterySaver,
              ),
          ],
        );
      },
    );
  }
}
