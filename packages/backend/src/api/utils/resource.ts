/**
 * Resource utilities
 * Common resource operations and checks
 */

import { AppError } from '../middleware/error.js';
import type { User, Project } from '../../db/types.js';
import type { DatabaseClient } from '../../db/client.js';

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
 * Check if user has access to a project resource
 * For JWT authenticated users, verifies project ownership or membership
 */
export async function checkProjectAccess(
  projectId: string,
  authUser: User | undefined,
  authProject: Project | undefined,
  db: DatabaseClient,
  resourceName: string = 'Resource'
): Promise<void> {
  // API key authentication - project must match
  if (authProject) {
    if (authProject.id !== projectId) {
      throw new AppError(`Access denied to ${resourceName}`, 403, 'Forbidden');
    }
    return;
  }

  // JWT authentication - check user access
  if (authUser) {
    // Admins have access to everything
    if (authUser.role === 'admin') {
      return;
    }

    // Check if user has access to this project
    const hasAccess = await db.projects.hasAccess(projectId, authUser.id);
    if (!hasAccess) {
      throw new AppError(`Access denied to ${resourceName}`, 403, 'Forbidden');
    }
    return;
  }

  // No authentication provided
  throw new AppError('Authentication required', 401, 'Unauthorized');
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
