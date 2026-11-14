# Nadir Android Health Connect Companion

A lightweight, zero-rate-limit Android background service that reads sleep sessions and stages from native **Google Health Connect** and pushes incremental delta updates to your Nadir PWA on Vercel.

---

## How It Eliminates Rate Limits
Instead of requesting full date ranges (which triggers Android's `"Rate limited request quota has been exceeded"` error), this companion stores a `changesToken` in `SharedPreferences` and calls:
```kotlin
healthConnectClient.getChanges(GetChangesRequest(changesToken))
```
Android returns only newly inserted or deleted sleep logs since your last check, which consumes minimal quota.

---

## Pre-Configured Endpoints
- **Target Endpoint:** `https://circadian-sleep-app.vercel.app/api/ingest/health-connect`
- **Auth Header:** `Authorization: Bearer ak_live_circadian_92b8d0e74f1`

---

## Option 1: Build & Install with Android Studio
1. Open the `android-companion` directory in Android Studio.
2. Connect your phone via USB or Wi-Fi (USB Debugging enabled).
3. Click **Run** or run:
   ```bash
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
4. Open the **Nadir Sync** app on your phone and tap **"Grant Health Connect Permission"**.
5. Done! `WorkManager` will automatically sync every 6 hours and whenever you wake up.

---

## Option 2: No-Code Automation (MacroDroid / Tasker / HTTP Shortcuts)

If you use an automation app on your phone:
1. **Trigger:** At Alarm dismissal OR at 07:30 AM every morning.
2. **Action:** Send HTTP POST to `https://circadian-sleep-app.vercel.app/api/ingest/health-connect`
   - Header: `Authorization: Bearer ak_live_circadian_92b8d0e74f1`
   - Content-Type: `application/json`
