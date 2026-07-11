/**
 * Auth Service — Google Sign-In gate for Impulse.
 * OAuth 2.0 Authorization Code + PKCE with a loopback redirect (the standard
 * flow for desktop apps). The system browser handles credentials; Impulse only
 * ever sees the authorization code on 127.0.0.1.
 *
 * Config: userData/google-oauth.json  →  { "clientId": "...", "clientSecret": "..." }
 * (Create an OAuth client of type "Desktop app" in Google Cloud Console.)
 * Optional "trackingWebhook": a URL that receives a POST {email,name,ts,event}
 * on each sign-in, for centralized usage tracking.
 *
 * State: userData/auth.json → { user, signIns: [...] }. No Google tokens are
 * persisted — we only need identity, so tokens stay in memory for the session.
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { app, shell } = require('electron');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Bad token response')); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function getJson(url, accessToken) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname, headers: { Authorization: `Bearer ${accessToken}` } }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Bad userinfo response')); }
      });
    }).on('error', reject);
  });
}

class AuthService {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'google-oauth.json');
    this.statePath = path.join(app.getPath('userData'), 'auth.json');
    this.config = this._loadJson(this.configPath);
    this.state = this._loadJson(this.statePath) || { user: null, signIns: [] };
  }

  _loadJson(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  }

  async _saveState() {
    await fsp.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  isConfigured() {
    return !!(this.config && this.config.clientId);
  }

  getUser() {
    return this.state.user || null;
  }

  async signOut() {
    this.state.user = null;
    await this._saveState();
    return { success: true };
  }

  /** Full interactive sign-in. Resolves with the user profile. */
  async signIn() {
    if (!this.isConfigured()) throw new Error('Google OAuth is not configured (google-oauth.json missing).');

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const csrf = crypto.randomBytes(16).toString('hex');

    const { code, redirectUri } = await this._waitForCode(challenge, csrf);

    const token = await postForm(TOKEN_URL, {
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    });
    if (!token.access_token) throw new Error(token.error_description || token.error || 'Token exchange failed');

    const info = await getJson(USERINFO_URL, token.access_token);
    if (!info.email) throw new Error('Could not read Google profile');

    this.state.user = {
      email: info.email,
      name: info.name || info.email,
      picture: info.picture || null,
      sub: info.sub,
      lastSignIn: Date.now()
    };
    this.state.signIns.push({ email: info.email, name: this.state.user.name, ts: Date.now() });
    if (this.state.signIns.length > 500) this.state.signIns = this.state.signIns.slice(-500);
    await this._saveState();
    this._track('sign-in');
    return this.state.user;
  }

  /** Spin up a loopback server, open the browser, resolve with the auth code. */
  _waitForCode(challenge, csrf) {
    return new Promise((resolve, reject) => {
      const server = http.createServer();
      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        setTimeout(() => { try { server.close(); } catch (_) {} }, 500);
        fn(arg);
      };
      const timer = setTimeout(() => finish(reject, new Error('Sign-in timed out (5 min).')), 5 * 60 * 1000);

      server.on('request', (req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
        const err = u.searchParams.get('error');
        const code = u.searchParams.get('code');
        const gotState = u.searchParams.get('state');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:sans-serif;display:flex;height:90vh;align-items:center;justify-content:center"><div><h2>' +
          (code && gotState === csrf ? 'Signed in — you can return to Impulse.' : 'Sign-in failed. Return to Impulse and retry.') +
          '</h2></div></body></html>');
        if (err) return finish(reject, new Error(`Google returned: ${err}`));
        if (gotState !== csrf) return finish(reject, new Error('State mismatch — possible CSRF, aborted.'));
        if (!code) return finish(reject, new Error('No authorization code received.'));
        finish(resolve, { code, redirectUri: `http://127.0.0.1:${server.address().port}/callback` });
      });

      server.listen(0, '127.0.0.1', () => {
        const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
        const params = new URLSearchParams({
          client_id: this.config.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: csrf,
          prompt: 'select_account'
        });
        shell.openExternal(`${AUTH_URL}?${params}`);
      });
      server.on('error', (e) => finish(reject, e));
    });
  }

  /** Optional centralized tracking: POST sign-in events to a configured webhook. */
  _track(event) {
    const hook = this.config && this.config.trackingWebhook;
    if (!hook || !this.state.user) return;
    try {
      const u = new URL(hook);
      const body = JSON.stringify({
        event,
        email: this.state.user.email,
        name: this.state.user.name,
        ts: new Date().toISOString(),
        appVersion: app.getVersion()
      });
      const req = (u.protocol === 'https:' ? https : http).request({
        hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      });
      req.on('error', () => {}); // tracking must never break the app
      req.end(body);
    } catch (_) {}
  }
}

module.exports = AuthService;
