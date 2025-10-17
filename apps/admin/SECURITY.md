# Admin Panel Security

## Authentication Token Storage

### Previous Implementation (INSECURE ❌)

```typescript
// Stored tokens in localStorage - vulnerable to XSS attacks
localStorage.setItem('access_token', accessToken);
localStorage.setItem('refresh_token', refreshToken);
```

**Security Issues:**

1. **XSS Vulnerability** - Any malicious JavaScript can steal tokens via `localStorage.getItem()`
2. **No HttpOnly Protection** - Tokens accessible to all JavaScript code
3. **Persistent Storage** - Tokens remain even after browser closes
4. **No Automatic Expiration** - Manual cleanup required

### Current Implementation (SECURE ✅)

```typescript
// Access token stored in memory only (React state)
const [accessToken, setAccessToken] = useState<string | null>(null);

// User data in sessionStorage (cleared on tab close)
sessionStorage.setItem('user', JSON.stringify(userData));
```

**Security Improvements:**

1. **Memory-only Access Token**
   - Stored in React component state
   - Cleared automatically on page reload
   - Not accessible via `localStorage.getItem()`
   - Protected from XSS token theft

2. **SessionStorage for Non-Sensitive Data**
   - User profile data only (no tokens)
   - Cleared when browser tab closes
   - Shorter persistence window reduces risk

3. **Token Accessor Pattern**
   - API client uses callback functions to get tokens
   - No direct coupling between auth context and HTTP client
   - Enables testing and mocking

4. **Automatic Token Refresh**
   - Interceptor handles 401 responses
   - Refreshes access token automatically
   - Updates memory state via accessor function

### Recommended Next Steps (Full Security)

**Backend Changes Required:**

```typescript
// Backend should set refresh token in httpOnly cookie
res.cookie('refresh_token', refreshToken, {
  httpOnly: true, // Not accessible to JavaScript
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

**Frontend Changes:**

```typescript
// Remove refresh token from sessionStorage entirely
// Backend sends it automatically in httpOnly cookie
const login = (accessToken: string, userData: User) => {
  setAccessToken(accessToken); // Memory only
  setUser(userData);
  // No refresh token handling needed
};
```

## Current Security Status

### ✅ Implemented

- [x] Access tokens in memory only
- [x] SessionStorage instead of localStorage
- [x] Token accessor pattern for API client
- [x] Automatic token refresh on 401
- [x] CORS credentials enabled (`withCredentials: true`)
- [x] Legacy localStorage cleanup on logout

### ✅ httpOnly Cookie Implementation (Completed)

- [x] Backend sets refresh token in httpOnly cookie (`@fastify/cookie`)
- [x] Backend refresh endpoint reads from cookie (not request body)
- [x] Backend logout endpoint clears httpOnly cookie
- [x] `secure: true` flag enabled (HTTPS only in production)
- [x] `sameSite: 'strict'` enabled (CSRF protection)
- [x] Frontend removed sessionStorage refresh token
- [x] Frontend logout calls backend to clear cookie

## Testing Security

### XSS Attack Simulation

Open browser console and try:

```javascript
// Before fix (INSECURE):
localStorage.getItem('access_token'); // ❌ Returns token
localStorage.getItem('refresh_token'); // ❌ Returns token

// After fix (SECURE):
localStorage.getItem('access_token'); // ✅ Returns null
sessionStorage.getItem('refresh_token'); // ✅ Returns null
document.cookie; // ✅ Cannot see httpOnly refresh_token cookie
```

### Verify Token in Memory

```javascript
// Tokens should NOT be accessible from console
// This should return null:
Object.keys(window).filter((k) => k.includes('token'));
```

### Verify Session Cleanup

1. Login to admin panel
2. Close browser tab
3. Reopen admin panel
4. Should require login (sessionStorage cleared)

## Security Best Practices

### Do ✅

- Store access tokens in memory (React state)
- Use httpOnly cookies for refresh tokens (backend)
- Clear tokens on logout
- Implement automatic token refresh
- Use HTTPS in production
- Enable CORS credentials for cookie support

### Don't ❌

- Store tokens in localStorage
- Store tokens in sessionStorage (except temporary user data)
- Log tokens to console
- Send tokens in URL parameters
- Expose tokens in error messages
- Share tokens across origins

## Content Security Policy (CSP)

### Current CSP Headers (nginx.conf)

```nginx
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';  # Allows inline styles for Vite CSS injection
  img-src 'self' data:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
```

### Why 'unsafe-inline' for styles?

Vite's production build uses CSS injection techniques that require inline styles. This is a **calculated trade-off**:

- ✅ **Scripts remain strict** - No `'unsafe-inline'` for JavaScript execution
- ✅ **XSS protection maintained** - Inline scripts blocked completely
- ⚠️ **Styles allow inline** - Required for React component styling
- ✅ **No unsafe-eval** - Code evaluation blocked

**Alternative Solutions (Future):**

1. **CSS Nonce** - Generate unique nonce per request (requires server-side rendering)
2. **CSS Hash** - Use `'sha256-...'` for specific inline styles (complex to maintain)
3. **External CSS Only** - Extract all styles to external files (limits dynamic styling)

For production-grade security, consider implementing CSS nonces with SSR or migrating to a CSS-in-JS solution that generates external stylesheets.

## Resources

- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Auth0: Token Storage Best Practices](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSP Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
