package com.tempofocus.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

public class TempoFocusBridge {
    private static final String PREFS = "tempo_focus_native";
    private final Context context;

    public TempoFocusBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public String loginWithEmail(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        if (!normalized.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return "{\"ok\":false,\"error\":\"Enter a valid email ID.\"}";
        }
        return "{\"ok\":true,\"email\":\"" + normalized.replace("\"", "") + "\"}";
    }

    @JavascriptInterface
    public void syncSummary(String json) {
        try {
            JSONObject payload = new JSONObject(json);
            String date = payload.optString("date");
            int wasteHours = payload.optInt("wasteHours", 0);
            int threshold = payload.optInt("threshold", 3);
            boolean focusAlerts = payload.optBoolean("focusAlerts", false);

            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString("last_summary", json)
                    .putString("last_date", date)
                    .putInt("waste_hours", wasteHours)
                    .putInt("threshold", threshold)
                    .putBoolean("focus_alerts", focusAlerts)
                    .apply();

            String alertKey = date + ":" + wasteHours;
            String previousAlertKey = prefs.getString("last_focus_alert_key", "");
            if (focusAlerts && wasteHours >= threshold && !alertKey.equals(previousAlertKey)) {
                prefs.edit().putString("last_focus_alert_key", alertKey).apply();
                NotificationHelper.showFocusAlert(context, wasteHours);
            }
        } catch (Exception ignored) {
            // Invalid payloads should not break the WebView.
        }
    }
}
