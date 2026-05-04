package com.tempofocus.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

public final class NotificationHelper {
    private static final String CHANNEL_ID = "tempo_focus_reminders";

    private NotificationHelper() {
    }

    public static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "TempoFocus reminders",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Hourly activity logging and focus reset reminders.");

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    public static void showHourlyReminder(Context context, int completedHour) {
        String title = "Log your hour";
        String body = "Add what you did from " + formatHour(completedHour) + " to " + formatHour(completedHour + 1) + ".";
        show(context, 1000 + completedHour, title, body);
    }

    public static void showFocusAlert(Context context, int wasteHours) {
        show(context, 3000 + wasteHours, "Focus reset", wasteHours + " wasted hours logged today. Make the next block count.");
    }

    private static void show(Context context, int id, String title, String body) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                id,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);

        Notification notification = builder
                .setSmallIcon(R.drawable.ic_stat_tempofocus)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setShowWhen(true)
                .build();

        manager.notify(id, notification);
    }

    private static String formatHour(int hour) {
        int safeHour = ((hour % 24) + 24) % 24;
        int value = safeHour % 12 == 0 ? 12 : safeHour % 12;
        String period = safeHour >= 12 ? "PM" : "AM";
        return value + " " + period;
    }
}
