/**
 * Resource utilities
 * Common resource operations and checks
 */

import { AppError } from '../middleware/error.js';

/**
 * Find a resource or throw 404 error
 */
export async function findOrThrow<T>(
  findFn: () => Promise<T | null>,
  resourceName: string
): Promise<T> {
  const resource = await findFn();

  if (!resource) {
    throw new AppError(`${resourceName} not found`, 404, 'NotFound');
  }

  return resource;
}

/**
 * Check if user has access to a resource
 */
export function checkAccess(
  resourceProjectId: string,
  authProjectId: string | undefined,
  _resourceName: string
): void {
  if (authProjectId && resourceProjectId !== authProjectId) {
    throw new AppError('Access denied', 403, 'Forbidden');
  }
}

/**
 * Remove sensitive fields from an object
 */
export function omitFields<T, K extends keyof T>(obj: T, ...fields: K[]): Omit<T, K> {
  const result = { ...obj } as T;
  for (const field of fields) {
    delete (result as Record<string, unknown>)[field as string];
  }
  return result as Omit<T, K>;
}
