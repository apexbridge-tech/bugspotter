# Testing Scripts

## ⚠️ Security Warning

**NEVER commit real credentials to the repository!**

These test scripts use environment variables for credentials. Always set them externally:

```bash
export ADMIN_EMAIL="your-admin@email.com"
export ADMIN_PASSWORD="your-secure-password"
```

## Available Scripts

### 1. `setup-admin.sh` - Initialize Admin Account

Creates the initial admin account using the setup API.

**Usage:**
```bash
# Set credentials via environment variables (REQUIRED)
export ADMIN_EMAIL="admin@yourcompany.com"
export ADMIN_PASSWORD="your-very-secure-password-123"

# Run setup
./setup-admin.sh
```

**Security Notes:**
- Use a strong password (minimum 12 characters, mixed case, numbers, special characters)
- Change the default password immediately after first login
- Never use simple passwords like "admin123" or "password"

### 2. `test-api-simple.sh` - API Integration Tests

Tests all User Management and Analytics endpoints without requiring `jq`.

**Usage:**
```bash
# Set credentials via environment variables
export ADMIN_EMAIL="admin@yourcompany.com"
export ADMIN_PASSWORD="your-secure-password"

# Run tests
./test-api-simple.sh
```

**What it tests:**
- Authentication (JWT token generation)
- User CRUD operations (create, list, update, delete)
- User search and filtering
- Analytics dashboard metrics
- Report trend analysis
- Project statistics

### 3. `test-user-management.sh` - User Management Tests

Comprehensive test suite for user management API with `jq` for JSON parsing.

**Usage:**
```bash
# Install jq if not already installed
sudo apt-get install jq

# Set credentials
export ADMIN_EMAIL="admin@yourcompany.com"
export ADMIN_PASSWORD="your-secure-password"

# Run tests
./test-user-management.sh
```

## Best Practices

### For Development

1. **Use `.env` file locally** (never commit it):
   ```bash
   # .env (in your local development environment)
   ADMIN_EMAIL=dev-admin@localhost
   ADMIN_PASSWORD=local-dev-password-123
   ```

2. **Source environment variables**:
   ```bash
   source .env
   ./test-api-simple.sh
   ```

### For CI/CD

Store credentials as encrypted secrets in your CI/CD platform:

- **GitHub Actions**: Use repository secrets
- **GitLab CI**: Use protected variables
- **Jenkins**: Use credentials plugin
- **CircleCI**: Use environment variables in project settings

Example GitHub Actions:
```yaml
env:
  ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
  ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
```

### For Production

1. **Never use default credentials** - Always set strong, unique passwords
2. **Use password managers** - Store credentials in 1Password, LastPass, etc.
3. **Rotate credentials regularly** - Change passwords every 90 days
4. **Use secret management** - HashiCorp Vault, AWS Secrets Manager, etc.
5. **Enable MFA** - Add two-factor authentication when available

## Credential Requirements

### Strong Password Checklist

- ✅ Minimum 12 characters
- ✅ Mix of uppercase and lowercase letters
- ✅ Numbers and special characters
- ✅ No dictionary words
- ✅ No personal information
- ✅ Unique (not used elsewhere)

### Example of Strong Password Generation

```bash
# Generate a secure random password
openssl rand -base64 32

# Or use a password manager to generate one
```

## Common Mistakes to Avoid

❌ **DON'T:**
- Commit credentials to git
- Use "admin123" or similar weak passwords
- Share credentials in Slack/email
- Store passwords in plain text files
- Use the same password across environments

✅ **DO:**
- Use environment variables
- Generate strong random passwords
- Store in secure password managers
- Use different credentials per environment
- Rotate credentials regularly

## Troubleshooting

### "Invalid credentials" error

1. Verify environment variables are set:
   ```bash
   echo $ADMIN_EMAIL
   echo $ADMIN_PASSWORD
   ```

2. Check if admin account exists:
   ```bash
   curl http://localhost:3000/api/v1/setup/status
   ```

3. Reset admin password via database if needed (development only):
   ```bash
   docker-compose exec postgres psql -U bugspotter -d bugspotter
   # Then use SQL to update password_hash
   ```

### "401 Unauthorized" error

- JWT token may have expired (24h lifetime)
- Re-run the login step to get a fresh token
- Check that the API server is running

### "403 Forbidden" error

- User role doesn't have permission for that endpoint
- Analytics and User Management require `admin` role
- Check user role: `SELECT role FROM users WHERE email = 'your-email';`

## Additional Resources

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Security Best Practices](./SECURITY.md)
- [Role-Based Access Control](./ROLES_AND_PERMISSIONS.md)
