# Auth Debugging

## Common Issues

### Session not persisting
1. Check `better-auth.session_token` cookie in browser DevTools
2. Verify `BETTER_AUTH_URL` matches the app URL
3. Check `BETTER_AUTH_SECRET` is set and consistent across deploys

### GitHub OAuth not working
1. Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
2. Check GitHub OAuth app callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`
3. Check Sentry for auth errors

### MFA/Passkey issues
1. Passkeys require HTTPS in production
2. Check WebAuthn RP ID matches the domain
3. TOTP secret is tied to the user -- re-setup if device changed

### 401 on API routes
1. Check session exists: call `auth.api.getSession()` with request headers
2. Session may have expired -- check `maxAge` in auth config
3. Cookie domain mismatch between frontend and API
