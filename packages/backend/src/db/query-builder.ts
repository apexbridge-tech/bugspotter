/**
 * Query Builder Utility
 * Consolidates WHERE clause, UPDATE clause, and pagination logic
 */

export interface WhereClause {
  clause: string;
  values: unknown[];
  paramCount: number;
}

export interface UpdateClause {
  clause: string;
  values: unknown[];
  paramCount: number;
}

export interface PaginationClause {
  clause: string;
  values: unknown[];
}

/**
 * Build WHERE clause from filters
 */
export function buildWhereClause(
  filters: Record<string, unknown>,
  startParamCount: number = 1
): WhereClause {
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramCount = startParamCount;

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      whereClauses.push(`${key} = $${paramCount++}`);
      values.push(value);
    }
  }

  const clause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return { clause, values, paramCount };
}

/**
 * Build WHERE clause with custom operators
 */
export function buildWhereClauseWithOperators(
  filters: Record<string, { value: unknown; operator?: string }>,
  startParamCount: number = 1
): WhereClause {
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramCount = startParamCount;

  for (const [key, filter] of Object.entries(filters)) {
    if (filter.value !== undefined && filter.value !== null) {
      const operator = filter.operator ?? '=';
      whereClauses.push(`${key} ${operator} $${paramCount++}`);
      values.push(filter.value);
    }
  }

  const clause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return { clause, values, paramCount };
}

/**
 * Build UPDATE SET clause from data
 */
export function buildUpdateClause(
  data: Record<string, unknown>,
  startParamCount: number = 1
): UpdateClause {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramCount = startParamCount;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updates.push(`${key} = $${paramCount++}`);
      values.push(value);
    }
  }

  const clause = updates.join(', ');

  return { clause, values, paramCount };
}

/**
 * Build LIMIT and OFFSET clause
 */
export function buildPaginationClause(
  page: number = 1,
  limit: number = 20,
  startParamCount: number = 1
): PaginationClause {
  const offset = (page - 1) * limit;
  const clause = `LIMIT $${startParamCount} OFFSET $${startParamCount + 1}`;
  const values = [limit, offset];

  return { clause, values };
}

/**
 * Build ORDER BY clause
 */
export function buildOrderByClause(
  sortBy: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): string {
  return `ORDER BY ${sortBy} ${order.toUpperCase()}`;
}

/**
 * Serialize JSON fields for database storage
 */
export function serializeJsonField(data: unknown): string {
  return JSON.stringify(data ?? {});
}

/**
 * Deserialize JSON fields from database
 */
export function deserializeJsonField<T = Record<string, unknown>>(data: unknown): T {
  if (typeof data === 'string') {
    return JSON.parse(data) as T;
  }
  return data as T;
}

/**
 * Deserialize multiple JSON fields in a row
 */
export function deserializeRow<T>(row: unknown, jsonFields: string[]): T {
  const r = row as Record<string, unknown>;
  const result = { ...r };

  for (const field of jsonFields) {
    if (r[field] !== undefined && r[field] !== null) {
      result[field] = deserializeJsonField(r[field]);
    }
  }

  return result as T;
}
