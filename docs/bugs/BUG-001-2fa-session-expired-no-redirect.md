# BUG-001: Session-expired error on 2FA page doesn't redirect back to login

**Status:** `open`
**Reported:** 2026-06-27
**Severity:** `medium`
**Area:** auth — backstage 2FA flow

---

## Description

When a user reaches the backstage 2FA code entry page but lets the pre-auth session expire (5-minute window) before submitting a code, the API returns "Session expired. Please log in again." The error message is correct, but the page stays on the 2FA digit-entry panel. This misleads the user into thinking they just need to wait for a fresh TOTP code and enter it — when in fact the pre-auth token is gone and they must restart with their email and password. The only escape is the small "← Back to login" link at the bottom, which most users won't notice.

---

## Reproduction Steps

1. Navigate to `/admin/login` and enter valid credentials.
2. When the 2FA code entry page appears, wait more than 5 minutes without entering a code.
3. Enter any 6-digit code and submit.
4. **Observed:** Red error banner reads "Session expired. Please log in again." Page remains on the 2FA entry panel; code inputs are cleared and focus returns to the first digit.
5. **Expected:** The error is briefly shown (or shown on the login page as a flash message), then the user is automatically redirected to `/admin/login` so they can re-enter credentials.

---

## Root Cause

In `TwoFactorClient.tsx`, the `catch` block on `submitCode` (line 77–82) handles all API errors the same way: display the message, clear the digits, and refocus the first input. There is no check to distinguish a session-expiry error (which requires restarting the full login flow) from a wrong-code error (which should stay on the 2FA page and let the user try again).

The backend (`auth.service.ts` line 275) throws `UnauthorizedException('Session expired. Please log in again.')` when the pre-auth JWT is expired. The frontend receives this as an error message string but takes no special action on it.

Relevant files:
- `frontend/app/admin/login/2fa/TwoFactorClient.tsx` — catch block lines 77–82
- `backend/src/auth/auth.service.ts` — line 275 (pre-auth token expiry check)

---

## Fix Plan

The fix is entirely in the frontend. The backend behavior is correct.

### `frontend/app/admin/login/2fa/TwoFactorClient.tsx`

In the `catch` block, inspect the error message. If it contains "Session expired" (or the HTTP status is 401), clear the pre-auth token from `sessionStorage` and redirect to `/admin/login` rather than staying on the page. The error message can be passed as a query param so the login page can surface it as a flash notice, or simply dropped — the login page's presence is itself sufficient feedback that credentials need to be re-entered.

```typescript
} catch (err) {
  const message = getErrorMessage(err);
  const isSessionExpired =
    message.toLowerCase().includes('session expired') ||
    (err as any)?.response?.status === 401;

  if (isSessionExpired) {
    sessionStorage.removeItem('admin_pre_auth_token');
    router.replace('/admin/login?error=session_expired');
    return;
  }

  setError(message);
  setDigits(['', '', '', '', '', '']);
  setIsLoading(false);
  setTimeout(() => inputRefs.current[0]?.focus(), 50);
}
```

### `frontend/app/admin/login/AdminLoginClient.tsx`

Read the `?error=session_expired` query param on mount and display a contextual message (e.g. "Your session expired. Please log in again.") so the user understands why they were redirected.

### Key considerations

- The `useEffect` on mount already redirects to login if `admin_pre_auth_token` is absent — so clearing it before `router.replace()` ensures the login page's own guard doesn't interfere.
- A wrong TOTP code returns a different error message ("Invalid code" or similar) and should continue to stay on the 2FA page as today. Only session-expiry triggers the redirect.
- No backend changes needed.
- No new tests strictly required, but the existing auth flow E2E test should be checked to confirm it doesn't rely on the current (incorrect) stay-on-page behavior.

---

## Completion Report

> _Fill in after fix is deployed._

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | open | Reported during manual QA of backstage login flow |
