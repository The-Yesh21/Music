import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';

import 'data/database_helper.dart';
import 'screens/home_screen.dart';
import 'screens/library_screen.dart';
import 'screens/now_playing_screen.dart';
import 'screens/search_screen.dart';
import 'services/audio_player_service.dart';
import 'services/jiosaavn_service.dart';
import 'state/app_controller.dart';
import 'theme/spotify_theme.dart';
import 'widgets/mini_player.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final audioHandler = await AudioService.init(
    builder: () => EchoTubeAudioHandler(
      DatabaseHelper.instance,
      JioSaavnService.instance,
    ),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.echotube.channel.audio',
      androidNotificationChannelName: 'EchoTube Playback',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
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
    return MaterialApp(
      title: 'EchoTube',
      debugShowCheckedModeBanner: false,
      theme: buildSpotifyTheme(),
      home: _EchoTubeShell(controller: controller),
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
              body: IndexedStack(
                index: _currentIndex,
                children: pages,
              ),
              bottomNavigationBar: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MiniPlayer(controller: widget.controller),
                  BottomNavigationBar(
                    currentIndex: _currentIndex,
                    onTap: (index) => setState(() => _currentIndex = index),
                    items: const [
                      BottomNavigationBarItem(
                        icon: Icon(Icons.home_outlined),
                        activeIcon: Icon(Icons.home_rounded),
                        label: 'Home',
                      ),
                      BottomNavigationBarItem(
                        icon: Icon(Icons.search_rounded),
                        activeIcon: Icon(Icons.search_rounded),
                        label: 'Search',
                      ),
                      BottomNavigationBarItem(
                        icon: Icon(Icons.library_music_outlined),
                        activeIcon: Icon(Icons.library_music_rounded),
                        label: 'Your Library',
                      ),
                    ],
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
