package com.echotune.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaPlugin")
public class MediaPlugin extends Plugin {

    private BroadcastReceiver receiver;

    @PluginMethod
    public void updateNotification(PluginCall call) {
        String title    = call.getString("title", "EchoTune");
        String artist   = call.getString("artist", "");
        String artwork  = call.getString("artwork", "");   // album art URL
        Boolean playing = call.getBoolean("isPlaying", false);
        Long position   = call.getLong("position", 0L);
        Long duration   = call.getLong("duration", 0L);

        Intent i = new Intent(getContext(), MediaPlaybackService.class);
        i.putExtra(MediaPlaybackService.EXTRA_TITLE,      title);
        i.putExtra(MediaPlaybackService.EXTRA_ARTIST,     artist);
        i.putExtra(MediaPlaybackService.EXTRA_ARTWORK,    artwork);
        i.putExtra(MediaPlaybackService.EXTRA_IS_PLAYING, playing);
        i.putExtra(MediaPlaybackService.EXTRA_POSITION,   position);
        i.putExtra(MediaPlaybackService.EXTRA_DURATION,   duration);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(i);
        } else {
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopNotification(PluginCall call) {
        Intent i = new Intent(getContext(), MediaPlaybackService.class);
        i.setAction(MediaPlaybackService.ACTION_STOP);
        getContext().startService(i);
        call.resolve();
    }

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String action = intent.getStringExtra("action");
                JSObject data = new JSObject();
                data.put("action", action);
                if (intent.hasExtra("position")) {
                    data.put("position", intent.getLongExtra("position", 0L));
                }
                notifyListeners("mediaAction", data);
            }
        };
        IntentFilter filter = new IntentFilter("ECHOTUNE_MEDIA_ACTION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) getContext().unregisterReceiver(receiver);
    }
}
