# Authentication Flexibility Integration - Demo

## 🎯 What Was Integrated

The BugSpotter demo app now showcases **all four authentication methods** with interactive testing capabilities.

## ✅ Changes Made

### 1. New UI Section (HTML)
Added a dedicated "Authentication Flexibility" section with 5 interactive buttons:
- **Use API Key Auth** - Switch to legacy API key authentication
- **Use Bearer Token** - Switch to modern Bearer token with auto-refresh
- **Use OAuth** - Test OAuth 2.0 authentication flow
- **Test Token Refresh** - Simulate 401 error → refresh → retry flow
- **Show Current Auth** - Display current authentication configuration

### 2. SDK Initialization Update
Changed from simple API key to Bearer Token with refresh capability:

**Before:**
```javascript
BugSpotter.init({
  apiKey: 'demo-api-key-12345',
  endpoint: 'http://localhost:4000/api/bugs'
});
```

**After:**
```javascript
BugSpotter.init({
  endpoint: 'http://localhost:4000/api/bugs',
  auth: {
    type: 'bearer',
    token: 'demo-access-token-12345',
    refreshToken: 'demo-refresh-token-67890',
    onRefresh: async (refreshToken) => {
      console.log('🔄 Refreshing access token...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        accessToken: 'new-access-token-' + Date.now(),
        refreshToken: 'new-refresh-token-' + Date.now(),
        expiresIn: 3600
      };
    }
  }
});
```

### 3. Interactive Demo Functions
Added 5 new JavaScript functions:

#### `switchToApiKey()`
- Destroys current SDK instance
- Reinitializes with API Key auth (backward compatible)
- Shows configuration details in output panel

#### `switchToBearerToken()`
- Switches to Bearer Token authentication
- Implements token refresh callback
- Displays Bearer token configuration

#### `switchToOAuth()`
- Demonstrates OAuth 2.0 setup
- Includes clientId and clientSecret
- Shows OAuth-specific configuration

#### `testTokenRefresh()`
- Simulates 401 Unauthorized error
- Triggers automatic token refresh
- Shows step-by-step refresh flow
- Displays before/after token states

#### `showAuthConfig()`
- Inspects current SDK configuration
- Shows active auth method
- Displays headers being sent
- Lists all supported auth methods

### 4. Updated Documentation
Enhanced `README.md` with:
- Authentication methods section
- Code examples for each auth type
- Interactive testing workflows
- Token refresh flow explanation
- Headers comparison table

## 🎨 Visual Features

### Output Panel
The demo includes a styled output panel (`#auth-output`) that displays:
- Current authentication method
- Token values (truncated for security)
- Headers being sent
- Refresh token availability
- Step-by-step flow for token refresh

### Color Coding
- **Blue (Primary)**: API Key switch
- **Green (Success)**: Bearer Token switch
- **Cyan (Info)**: OAuth switch
- **Orange (Warning)**: Token refresh test
- **Red (Danger)**: Show configuration

## 🧪 Testing Capabilities

### 1. Runtime Auth Switching
Users can switch between auth methods **without page reload**:
```javascript
// Switch from Bearer → API Key
bugSpotter.destroy();
BugSpotter.init({ apiKey: 'key', endpoint: '...' });

// Switch from API Key → OAuth
bugSpotter.destroy();
BugSpotter.init({ auth: { type: 'oauth', ... }, endpoint: '...' });
```

### 2. Token Refresh Flow Visualization
The "Test Token Refresh" button shows:
1. Initial request with expired token
2. 401 Unauthorized detected
3. `onRefresh()` callback triggered
4. New access token obtained
5. Original request retried
6. Success confirmation

### 3. Configuration Inspection
The "Show Current Auth" button reveals:
- Active auth type
- Current tokens (masked)
- Headers being sent
- Endpoint URL
- Available auth methods

## 📊 Educational Value

The demo teaches developers:

### For API Key Users
- How to migrate from deprecated API key to modern auth
- Backward compatibility support
- Simple header-based authentication

### For Bearer Token Users
- Modern authentication best practices
- Automatic token refresh implementation
- Handling 401 errors gracefully
- `onRefresh` callback pattern

### For OAuth Users
- OAuth 2.0 integration
- Client credentials management
- OAuth-specific token refresh

### For Custom Auth Users
- Using `getAuthHeaders()` for custom logic
- Dynamic header generation
- Flexible authentication patterns

## 🚀 Usage Examples

### Example 1: Switch to Bearer Token
```javascript
// User clicks "Use Bearer Token"
switchToBearerToken();

// Output shows:
// ✅ Switched to Bearer Token Authentication
// • Auth Type: Bearer Token
// • Access Token: demo-access-token-1234567890
// • Refresh Token: Available
// • Header: Authorization: Bearer [token]
// • Auto-Refresh: ✅ Enabled
```

### Example 2: Test Token Refresh
```javascript
// User clicks "Test Token Refresh"
testTokenRefresh();

// Console shows:
// 🔄 Token expired! Refreshing...
// ✅ New token obtained
// Request retried with refreshed token

// Output shows step-by-step flow:
// 1️⃣ Initial request sent with expired token
// 2️⃣ Server returns 401 Unauthorized
// 3️⃣ SDK detects 401 and calls onRefresh()
// 4️⃣ New access token obtained
// 5️⃣ Original request retried with new token
// 6️⃣ Request succeeds ✅
```

### Example 3: Switch to OAuth
```javascript
// User clicks "Use OAuth"
switchToOAuth();

// Output shows:
// ✅ Switched to OAuth Authentication
// • Auth Type: OAuth 2.0
// • Client ID: demo-client-id
// • Access Token: oauth-access-token-1234567890
// • Refresh Token: Available
// • Auto-Refresh: ✅ Enabled
```

## 🔍 Implementation Details

### SDK Reinitialization Pattern
```javascript
function switchAuth(newConfig) {
  // Clean up current instance
  bugSpotter.destroy();
  
  // Create new instance with new auth
  window.bugSpotterInstance = BugSpotter.init(newConfig);
  
  // Update UI
  displayAuthConfig(newConfig.auth);
}
```

### Token Refresh Simulation
```javascript
onRefresh: async (refreshToken) => {
  console.log('🔄 Refreshing access token...');
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return new tokens
  return {
    accessToken: 'new-token-' + Date.now(),
    refreshToken: 'new-refresh-' + Date.now(),
    expiresIn: 3600 // 1 hour
  };
}
```

### Configuration Display
```javascript
function showAuthConfig() {
  const config = bugSpotter.getConfig();
  const auth = config.auth || { type: 'apiKey' };
  
  // Format and display auth details
  const details = formatAuthDetails(auth);
  displayInOutputPanel(details);
}
```

## 📚 Documentation Updates

### README.md Enhancements
- Added "Authentication Flexibility" section
- Code examples for all 4 auth methods
- Interactive demo actions list
- Authentication testing workflow
- Headers comparison table

### Comments in Code
- Each auth function has descriptive comments
- Token refresh flow is documented inline
- Output panel shows helpful tooltips
- Console logs explain each step

## 🎓 Learning Outcomes

After using the demo, developers will understand:

1. **Multiple Auth Patterns** - How to implement different auth methods
2. **Token Refresh** - Automatic handling of expired tokens
3. **Backward Compatibility** - Supporting legacy API key auth
4. **Runtime Switching** - Changing auth without page reload
5. **Error Handling** - Graceful 401 error recovery
6. **Best Practices** - Modern authentication patterns

## 🔗 Related Files

- `/apps/demo/index.html` - Main demo page with auth UI
- `/apps/demo/README.md` - Updated documentation
- `/packages/sdk/src/core/transport.ts` - Auth implementation
- `/packages/sdk/src/index.ts` - SDK initialization
- `/docs/API_TESTING.md` - Full API testing guide

## ✨ Next Steps

To run the demo:

```bash
# 1. Build the SDK
cd packages/sdk
pnpm build

# 2. Copy bundle to demo
cp dist/bugspotter.min.js ../../apps/demo/

# 3. Start backend (optional)
cd ../../packages/backend-mock
node server.js

# 4. Open demo
cd ../../apps/demo
npx browser-sync start --server --files "*.html" --port 3002 --no-open
```

Then visit `http://localhost:3002` and test the authentication features!

---

**Status**: ✅ Authentication flexibility fully integrated into demo
**Date**: 2024-10-06
**SDK Version**: 0.1.0
