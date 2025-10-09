/**
 * Access Control Utilities
 * Centralized logic for determining user access to resources
 */

import type { User, Project } from '../../db/types.js';
import type { DatabaseClient } from '../../db/client.js';
import { AppError } from '../middleware/error.js';

/**
 * Resolve which project ID a user can access for filtering/querying
 *
 * @param requestedProjectId - The project ID requested in query params
 * @param authUser - Authenticated user from JWT
 * @param authProject - Authenticated project from API key
 * @param db - Database client
 * @returns Project ID to filter by, or undefined
 * @throws AppError if access is denied or authentication is missing
 */
export async function resolveAccessibleProjectId(
  requestedProjectId: string | undefined,
  authUser: User | undefined,
  authProject: Project | undefined,
  db: DatabaseClient
): Promise<string | undefined> {
  // API key auth - use authenticated project only (project-scoped access)
  if (authProject) {
    return authProject.id;
  }

  // JWT auth
  if (authUser) {
    // Admins can access any project or all projects
    if (authUser.role === 'admin') {
      return requestedProjectId;
    }

    // Regular users need explicit access to the requested project
    if (requestedProjectId) {
      const hasAccess = await db.projects.hasAccess(requestedProjectId, authUser.id);
      if (!hasAccess) {
        throw new AppError('Access denied to project', 403, 'Forbidden');
      }
      return requestedProjectId;
    }

    // No project specified - return undefined
    // Note: In a full implementation, you could query all projects the user has access to
    // and return them as an array, then modify the list() method to handle multi-project queries
    return undefined;
  }

  // No authentication provided
  throw new AppError('Authentication required', 401, 'Unauthorized');
}
