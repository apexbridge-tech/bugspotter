# Security - SQL Injection Protection

## Overview

The BugSpotter backend implements comprehensive SQL injection protection across all database operations.

## Protection Mechanisms

### 1. Parameterized Queries (Primary Defense)

All user-supplied **values** use PostgreSQL parameterized queries with `$1`, `$2`, etc. placeholders:

```typescript
// ✅ SAFE - Value is parameterized
const query = `SELECT * FROM users WHERE email = $1`;
await client.query(query, [userEmail]);
```

**Protected Operations:**

- All WHERE clause values
- INSERT values
- UPDATE values
- LIMIT/OFFSET pagination values

### 2. SQL Identifier Validation (Column/Table Names)

All dynamic **column names** are validated using a whitelist pattern that only allows:

- Letters (a-z, A-Z)
- Numbers (0-9)
- Underscores (\_)

```typescript
function validateSqlIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
}
```

**Protected Operations:**

- `ORDER BY` column names
- `INSERT` column names
- `UPDATE` column names
- `WHERE` column names in generic helpers
- Batch insert column names

### 3. Protected Methods

#### BaseRepository

| Method             | Protection             | Notes                                        |
| ------------------ | ---------------------- | -------------------------------------------- |
| `findById()`       | ✅ Value parameterized | ID passed as `$1`                            |
| `create()`         | ✅ Columns validated   | All column names validated before query      |
| `update()`         | ✅ Columns validated   | Column names validated, values parameterized |
| `delete()`         | ✅ Value parameterized | ID passed as `$1`                            |
| `findBy()`         | ✅ Column validated    | Column name validated before query           |
| `findManyBy()`     | ✅ Column validated    | Column name validated before query           |
| `findByMultiple()` | ✅ Columns validated   | All column names validated                   |

#### BugReportRepository

| Method          | Protection           | Notes                                                |
| --------------- | -------------------- | ---------------------------------------------------- |
| `list()`        | ✅ Full protection   | Uses `buildWhereClause()` and `buildOrderByClause()` |
| `createBatch()` | ✅ Columns validated | All column names validated before bulk insert        |

#### Query Builder

| Function                     | Protection           | Notes                                                       |
| ---------------------------- | -------------------- | ----------------------------------------------------------- |
| `buildWhereClause()`         | ✅ Columns validated | All column names validated via `buildParameterizedClause()` |
| `buildUpdateClause()`        | ✅ Columns validated | All column names validated via `buildParameterizedClause()` |
| `buildOrderByClause()`       | ✅ Column validated  | Uses `validateSqlIdentifier()`                              |
| `buildPaginationClause()`    | ✅ Input validated   | Validates page >= 1, limit 1-1000, integers only            |
| `buildParameterizedClause()` | ✅ Columns validated | Internal helper - validates all column names                |

## Attack Vectors Prevented

### 1. Value-Based Injection (Classic)

```typescript
// ❌ UNSAFE (hypothetical - not in our code)
const query = `SELECT * FROM users WHERE email = '${userInput}'`;

// ✅ SAFE (our implementation)
const query = `SELECT * FROM users WHERE email = $1`;
await client.query(query, [userInput]);
```

### 2. Pagination Attacks (DoS/Logic Errors)

```typescript
// ❌ Attack attempts
await repo.list({}, {}, { page: -1, limit: 20 }); // Negative values
await repo.list({}, {}, { page: 1, limit: 0 }); // Division by zero
await repo.list({}, {}, { page: 1, limit: 999999 }); // DoS - huge result set
await repo.list({}, {}, { page: 1.5, limit: 20.7 }); // Non-integer values

// ✅ Result: All throw validation errors before reaching database
```

### 3. Column Name Injection

```typescript
// ❌ Attack attempt
await repo.findBy('id = 1 OR 1=1 --', 'anything');

// ✅ Result: Throws "Invalid SQL identifier: id = 1 OR 1=1 --"
```

### 4. ORDER BY Injection

```typescript
// ❌ Attack attempt
await repo.list({}, { sort_by: 'created_at; DROP TABLE users--' });

// ✅ Result: Throws "Invalid SQL identifier"
```

### 5. Batch Insert Injection

```typescript
// ❌ Attack attempt through serialization override
serializeForInsert() {
  return { "id; DROP TABLE bug_reports--": value };
}

// ✅ Result: Throws "Invalid SQL identifier" before query execution
```

### 6. Batch Size DoS Attack

```typescript
// ❌ Attack attempts
const hugeArray = new Array(100000).fill({ title: 'Bug' });
await repo.createBatch(hugeArray); // Would crash database

// ✅ Result: Throws "Batch size 100000 exceeds maximum allowed (1000)"

// ✅ For large batches, use auto-splitting
await repo.createBatchAuto(hugeArray, 500); // Safely processes in chunks
```

### 7. Non-Idempotent Retry (Data Corruption)

```typescript
// ❌ DANGEROUS: Auto-retry on write operations
await db.bugReports.create(data);
// If it succeeds but connection drops before response
// Retry would insert duplicate record (data corruption)

// ✅ SAFE: Only read operations are auto-retried
await db.bugReports.findById(id); // ✓ Retried automatically
await db.bugReports.list(filters); // ✓ Retried automatically

// Write operations are NOT auto-retried
await db.bugReports.create(data); // ✗ NOT retried
await db.bugReports.update(id, data); // ✗ NOT retried
await db.bugReports.delete(id); // ✗ NOT retried
await db.bugReports.createBatch(data); // ✗ NOT retried

// Manual retry with idempotency (if needed)
import { executeWithRetry } from '@bugspotter/backend';
await executeWithRetry(() =>
  db.bugReports.create({
    ...data,
    idempotency_key: uniqueKey, // Prevent duplicates
  })
);
```

## Test Coverage

We have comprehensive test coverage for SQL injection protection:

### Repository Level Tests

```typescript
describe('SQL Injection Protection', () => {
  it('should prevent SQL injection in ORDER BY clause');
  it('should prevent SQL injection in column names via update()');
  it('should prevent SQL injection in column names via create()');
  it('should prevent SQL injection via findBy() column parameter');
  it('should prevent SQL injection via findByMultiple() columns');
  it('should prevent SQL injection in batch insert column names');
});
```

### Query Builder Level Tests

```typescript
describe('SQL Injection Protection', () => {
  it('should prevent SQL injection in buildWhereClause with malicious column names');
  it('should prevent SQL injection in buildWhereClause with OR statement');
  it('should prevent SQL injection in buildWhereClause with spaces');
  it('should prevent SQL injection in buildWhereClause with special characters');
  it('should prevent SQL injection in buildUpdateClause with malicious column names');
  it('should prevent SQL injection in buildUpdateClause with OR statement');
  it('should prevent SQL injection in buildUpdateClause with parentheses');
  it('should prevent SQL injection with custom operators in buildWhereClause');
});
```

### Pagination Validation Tests

```typescript
describe('Pagination Validation', () => {
  it('should reject negative page numbers');
  it('should reject zero page numbers');
  it('should reject decimal page numbers');
  it('should reject negative limit');
  it('should reject zero limit');
  it('should reject decimal limit');
  it('should reject limit exceeding maximum (1000)');
  it('should reject excessively large limit (DoS protection)');
  it('should accept maximum allowed limit (1000)');
  // Additional tests at query-builder and repository levels
});
```

**Test Results:** ✅ 134/134 tests passing

- 11 SQL injection specific tests
- 25 pagination validation tests (query-builder + repository level)

## Safe Patterns

### ✅ Use These Patterns

```typescript
// 1. Parameterized values
const user = await repo.findBy('email', userInput);

// 2. Validated column names from code (not user input)
const columns = ['id', 'email', 'created_at']; // Hardcoded, safe
columns.forEach(validateSqlIdentifier);

// 3. Use repository methods (automatically protected)
await db.bugReports.list({ status: userInput }); // Value is parameterized
await db.bugReports.list({}, { sort_by: 'created_at' }); // Column is validated
```

### ❌ Avoid These Patterns

```typescript
// 1. Never interpolate user input into SQL
const query = `SELECT * FROM users WHERE email = '${userInput}'`; // ❌ DANGEROUS

// 2. Never use user input as column names without validation
const query = `SELECT * FROM users ORDER BY ${userColumn}`; // ❌ DANGEROUS

// 3. Never disable validation for "convenience"
// validateSqlIdentifier(column); // Don't comment this out!
```

## Table Names

Table names (`tableName`) are set in repository constructors and are **not** user-controlled:

```typescript
constructor(pool: Pool) {
  super(pool, 'bug_reports', ['metadata']); // ✅ Hardcoded, safe
}
```

This is safe because:

1. Table names are defined at application startup
2. They come from trusted code, not user input
3. They cannot be modified at runtime

## Migration Security

Database migrations use hardcoded SQL scripts and are executed by administrators, not end users. They are not exposed to SQL injection risks from user input.

## Additional Security Measures

1. **Principle of Least Privilege**: Database users should have minimal required permissions
2. **Connection String Security**: Store `DATABASE_URL` in environment variables, never in code
3. **Audit Logging**: All database operations are logged for security auditing
4. **Error Messages**: Errors don't expose SQL query details to end users
5. **Pagination Limits**: Maximum 1000 items per page to prevent DoS attacks
6. **Input Validation**: All numeric inputs validated as positive integers
7. **Batch Size Limits**: Maximum 1000 records per batch to prevent memory exhaustion and PostgreSQL parameter limit (65,535)
8. **Selective Retry Logic**: Only idempotent read operations are auto-retried; write operations must implement retry with proper idempotency to prevent data corruption

## Security Checklist

When adding new database operations:

- [ ] Are all user-supplied **values** using parameterized queries (`$1`, `$2`)?
- [ ] Are all dynamic **column names** validated with `validateSqlIdentifier()`?
- [ ] Are **table names** hardcoded in repository constructors?
- [ ] Are **pagination parameters** validated (positive integers, reasonable limits)?
- [ ] Have you added tests for potential SQL injection vectors?
- [ ] Have you added tests for invalid inputs (negative, zero, non-integer, excessive)?
- [ ] Does the error handling avoid exposing SQL details to users?

## Reporting Security Issues

If you discover a security vulnerability, please email security@bugspotter.dev instead of opening a public issue.

## References

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
- [Node.js pg Library Documentation](https://node-postgres.com/features/queries)
