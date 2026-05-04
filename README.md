# TempoFocus

A local-first time tracking dashboard for a 6 AM-11 PM day.

## Run

```bash
npm start
```

Open `http://localhost:4173/`.

For local UI testing:

```bash
npm run dev
```

Email login accepts any valid email unless `APP_LOGIN_EMAIL` is configured.

To restrict login to one email ID, set this environment variable first:

```bash
export APP_LOGIN_EMAIL=you@example.com
npm start
```

You can also create a local `.env` from `.env.example`; `.env` is ignored by git.

## AI Coach

The dashboard includes an AI coach panel. Click **Suggest** after logging activities to get advice about what to do next and how to avoid wasting the next block.

By default, advice is generated locally from simple rules. For richer AI-generated coaching, configure OpenAI on the local server:

```bash
export OPENAI_API_KEY=your_openai_api_key
export OPENAI_MODEL=gpt-5.2
npm start
```

When OpenAI is configured, the selected day's logged activity summary is sent to the server and then to the OpenAI Responses API only when you click **Suggest**.

## Android App

The `android/` folder is a native Android WebView wrapper around the same TempoFocus website.

Before building after web changes, sync the latest web files into Android assets:

```bash
npm run android:sync
```

If npm is not available but Node is installed:

```bash
node scripts/sync-android-assets.js
```

Build in Android Studio:

1. Open the `android/` folder in Android Studio.
2. Let Gradle sync.
3. Run on a device or emulator.
4. Allow notification permission when prompted.

What the Android app adds:

- Packages the website into the app as local assets.
- Schedules hourly native reminders to log the previous hour from 7 AM through 11 PM.
- Reschedules reminders after phone reboot.
- Sends native focus-reset alerts when the web app reports wasted hours at or above your configured threshold.

## Notes

- Activity data stays in browser `localStorage`.
- Email login uses the local Node server. Configure `APP_LOGIN_EMAIL` to allow only one email ID.
- On Android, hourly reminders use native notifications from the wrapper app.
- Android may batch repeating alarms for battery efficiency, so reminders are hourly but not guaranteed to fire at the exact second.
