# Impulse — Google Sign-In Setup

Impulse can gate the IDE behind Google sign-in and record who uses it.
**Without configuration, the wall is disabled** (dev mode) and the app opens normally.

## 1. Create an OAuth client

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create (or pick) a project → **Create Credentials → OAuth client ID**
3. Application type: **Desktop app** (this allows the `http://127.0.0.1` loopback redirect Impulse uses)
4. Configure the consent screen if prompted (scopes needed: `openid`, `email`, `profile`)
5. Copy the **Client ID** and **Client Secret**

## 2. Configure Impulse

Create `google-oauth.json` in Impulse's user-data folder:

- Windows: `%APPDATA%/arduino-ide-cursor/google-oauth.json`
- macOS: `~/Library/Application Support/arduino-ide-cursor/google-oauth.json`
- Linux: `~/.config/arduino-ide-cursor/google-oauth.json`

```json
{
  "clientId": "1234567890-abc.apps.googleusercontent.com",
  "clientSecret": "GOCSPX-...",
  "trackingWebhook": "https://example.com/impulse-signins"
}
```

`trackingWebhook` is **optional**: if set, every successful sign-in POSTs
`{ "event": "sign-in", "email", "name", "ts", "appVersion" }` as JSON to that URL —
point it at a Google Apps Script, Zapier hook, or your own endpoint for
centralized usage tracking. Without it, sign-ins are still recorded locally in
`auth.json` (last 500 events) in the same folder.

## 3. How it works

- On launch, if configured and not signed in, a full-screen sign-in wall blocks the IDE.
- "Continue with Google" opens the **system browser** (OAuth 2.0 + PKCE, loopback
  redirect on `127.0.0.1`) — Impulse never sees the user's password.
- Identity (name, email, avatar) is stored locally; **no Google tokens are persisted**.
- The signed-in user shows as an avatar badge in the Agent panel header; click it to sign out.
