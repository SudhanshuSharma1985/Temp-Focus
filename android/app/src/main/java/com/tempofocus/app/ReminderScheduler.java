package com.tempofocus.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;

public final class ReminderScheduler {
    private static final int REQUEST_CODE = 4173;

    private ReminderScheduler() {
    }

    public static void scheduleHourly(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                new Intent(context, ReminderReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Calendar next = Calendar.getInstance();
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        next.add(Calendar.HOUR_OF_DAY, 1);

        alarmManager.setRepeating(
                AlarmManager.RTC_WAKEUP,
                next.getTimeInMillis(),
                AlarmManager.INTERVAL_HOUR,
                pendingIntent
        );
    }
}
