# Security

## SQL Injection Protection

### Defense Mechanisms

**1. Parameterized Queries** - All user values use `$1`, `$2` placeholders:

```typescript
await client.query('SELECT * FROM users WHERE email = $1', [email]);
```

**2. Identifier Validation** - Column names validated with `^[a-zA-Z0-9_]+$`:

```typescript
validateSqlIdentifier(column); // Throws on malicious input
```

**3. Input Validation** - Pagination limits (1-1000), batch size limits (max 1000)

### Protected Operations

All repository methods are protected:

- `findById()`, `create()`, `update()`, `delete()` - Values parameterized
- `list()` - Column names validated, values parameterized
- `createBatch()` - Column names and batch size validated

### Attack Prevention

| Attack Type        | Prevention               |
| ------------------ | ------------------------ |
| Value injection    | Parameterized queries    |
| Column injection   | Identifier validation    |
| ORDER BY injection | Whitelist validation     |
| DoS (pagination)   | Limits: 1-1000 per page  |
| DoS (batch)        | Limits: max 1000 records |

### Safe Patterns

✅ **Do:**

```typescript
await db.bugReports.findBy('email', userInput); // Value parameterized
await db.bugReports.list({ status: input }); // Safe
await db.bugReports.list({}, { sort_by: 'status' }); // Validated
```

❌ **Don't:**

```typescript
await query(`WHERE email = '${input}'`); // NEVER interpolate
await query(`ORDER BY ${userColumn}`); // NEVER use user input
```

### Additional Security

- Database users: Minimal privileges
- Credentials: Environment variables only
- Errors: No SQL details exposed
- Retry logic: Only idempotent reads (prevents data corruption)
- Audit logging: All operations logged

### Testing

✅ 304/304 tests passing including:

- 11 SQL injection tests
- 25 pagination validation tests
- DoS protection tests

## Reporting Issues

Email: security@bugspotter.dev (do not open public issues)

## References

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax-lexical.html)
