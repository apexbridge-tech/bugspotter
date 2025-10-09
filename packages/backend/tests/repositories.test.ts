/**
 * Repository-specific method tests
 * Tests for custom repository methods beyond base CRUD operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseClient } from '../src/db/client.js';
import type { User, Project } from '../src/db/types.js';

const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

describe('Repository Specific Methods', () => {
  let db: DatabaseClient;
  let testUser1: User;
  let testUser2: User;
  let testUser3: User;
  let testProject: Project;

  beforeAll(async () => {
    db = DatabaseClient.create({
      connectionString: TEST_DATABASE_URL,
    });

    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to test database');
    }

    // Create test users
    testUser1 = await db.users.create({
      email: `owner-${Date.now()}@test.com`,
      password_hash: 'hash1',
      role: 'user',
    });

    testUser2 = await db.users.create({
      email: `member-${Date.now()}@test.com`,
      password_hash: 'hash2',
      role: 'user',
    });

    testUser3 = await db.users.create({
      email: `nonmember-${Date.now()}@test.com`,
      password_hash: 'hash3',
      role: 'user',
    });

    // Create test project with owner
    testProject = await db.projects.create({
      name: 'Test Project for Access Control',
      api_key: `bgs_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      created_by: testUser1.id,
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testProject?.id) {
      await db.projects.delete(testProject.id);
    }
    if (testUser1?.id) await db.users.delete(testUser1.id);
    if (testUser2?.id) await db.users.delete(testUser2.id);
    if (testUser3?.id) await db.users.delete(testUser3.id);

    await db.close();
  });

  describe('ProjectRepository', () => {
    describe('hasAccess()', () => {
      it('should return true for project owner', async () => {
        const hasAccess = await db.projects.hasAccess(testProject.id, testUser1.id);
        expect(hasAccess).toBe(true);
      });

      it('should return true for project member', async () => {
        // Add user2 as member
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'member');

        const hasAccess = await db.projects.hasAccess(testProject.id, testUser2.id);
        expect(hasAccess).toBe(true);

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });

      it('should return false for non-member', async () => {
        const hasAccess = await db.projects.hasAccess(testProject.id, testUser3.id);
        expect(hasAccess).toBe(false);
      });

      it('should return false for invalid project ID', async () => {
        const fakeProjectId = '00000000-0000-0000-0000-000000000000';
        const hasAccess = await db.projects.hasAccess(fakeProjectId, testUser1.id);
        expect(hasAccess).toBe(false);
      });

      it('should return false for invalid user ID', async () => {
        const fakeUserId = '00000000-0000-0000-0000-000000000000';
        const hasAccess = await db.projects.hasAccess(testProject.id, fakeUserId);
        expect(hasAccess).toBe(false);
      });
    });

    describe('getUserRole()', () => {
      it('should return "owner" for project owner', async () => {
        const role = await db.projects.getUserRole(testProject.id, testUser1.id);
        expect(role).toBe('owner');
      });

      it('should return member role for project member', async () => {
        // Add user2 as admin
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'admin');

        const role = await db.projects.getUserRole(testProject.id, testUser2.id);
        expect(role).toBe('admin');

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });

      it('should return null for non-member', async () => {
        const role = await db.projects.getUserRole(testProject.id, testUser3.id);
        expect(role).toBeNull();
      });

      it('should return null for invalid project ID', async () => {
        const fakeProjectId = '00000000-0000-0000-0000-000000000000';
        const role = await db.projects.getUserRole(fakeProjectId, testUser1.id);
        expect(role).toBeNull();
      });

      it('should prioritize owner role over member role', async () => {
        // Try to add owner as member (shouldn't happen in practice, but test the logic)
        await db.projectMembers.addMember(testProject.id, testUser1.id, 'member');

        const role = await db.projects.getUserRole(testProject.id, testUser1.id);
        expect(role).toBe('owner'); // Should return owner, not member

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser1.id);
      });
    });
  });

  describe('ProjectMemberRepository', () => {
    describe('addMember()', () => {
      it('should add member with default role', async () => {
        const member = await db.projectMembers.addMember(testProject.id, testUser2.id);

        expect(member).toBeDefined();
        expect(member.project_id).toBe(testProject.id);
        expect(member.user_id).toBe(testUser2.id);
        expect(member.role).toBe('member'); // Default role

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });

      it('should add member with specific role', async () => {
        const member = await db.projectMembers.addMember(testProject.id, testUser2.id, 'admin');

        expect(member.role).toBe('admin');

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });

      it('should add member with viewer role', async () => {
        const member = await db.projectMembers.addMember(testProject.id, testUser2.id, 'viewer');

        expect(member.role).toBe('viewer');

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });

      it('should prevent duplicate member entries', async () => {
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'member');

        // Try to add same member again
        await expect(
          db.projectMembers.addMember(testProject.id, testUser2.id, 'admin')
        ).rejects.toThrow();

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });
    });

    describe('removeMember()', () => {
      it('should remove member from project', async () => {
        // Add member
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'member');

        // Verify member exists
        let hasAccess = await db.projects.hasAccess(testProject.id, testUser2.id);
        expect(hasAccess).toBe(true);

        // Remove member
        await db.projectMembers.removeMember(testProject.id, testUser2.id);

        // Verify member removed
        hasAccess = await db.projects.hasAccess(testProject.id, testUser2.id);
        expect(hasAccess).toBe(false);
      });

      it('should handle removing non-existent member gracefully', async () => {
        // Should not throw error when removing non-existent member
        await expect(
          db.projectMembers.removeMember(testProject.id, testUser3.id)
        ).resolves.not.toThrow();
      });
    });

    describe('getProjectMembers()', () => {
      it('should return all members of a project', async () => {
        // Add multiple members
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'admin');
        await db.projectMembers.addMember(testProject.id, testUser3.id, 'viewer');

        const members = await db.projectMembers.getProjectMembers(testProject.id);

        expect(members).toHaveLength(2);
        expect(members.some((m) => m.user_id === testUser2.id && m.role === 'admin')).toBe(true);
        expect(members.some((m) => m.user_id === testUser3.id && m.role === 'viewer')).toBe(true);

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
        await db.projectMembers.removeMember(testProject.id, testUser3.id);
      });

      it('should return empty array for project with no members', async () => {
        const members = await db.projectMembers.getProjectMembers(testProject.id);
        expect(members).toEqual([]);
      });

      it('should return empty array for non-existent project', async () => {
        const fakeProjectId = '00000000-0000-0000-0000-000000000000';
        const members = await db.projectMembers.getProjectMembers(fakeProjectId);
        expect(members).toEqual([]);
      });
    });

    describe('getUserProjects()', () => {
      it('should return all projects for a user', async () => {
        // Add user2 to the test project
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'member');

        const projects = await db.projectMembers.getUserProjects(testUser2.id);

        expect(projects).toHaveLength(1);
        expect(projects[0].project_id).toBe(testProject.id);
        expect(projects[0].user_id).toBe(testUser2.id);

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
      });

      it('should return empty array for user with no projects', async () => {
        const projects = await db.projectMembers.getUserProjects(testUser3.id);
        expect(projects).toEqual([]);
      });

      it('should return multiple projects if user is member of multiple', async () => {
        // Create another project
        const project2 = await db.projects.create({
          name: 'Second Test Project',
          api_key: `bgs_test2_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_by: testUser1.id,
        });

        // Add user2 to both projects
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'admin');
        await db.projectMembers.addMember(project2.id, testUser2.id, 'viewer');

        const projects = await db.projectMembers.getUserProjects(testUser2.id);

        expect(projects).toHaveLength(2);
        expect(projects.some((p) => p.project_id === testProject.id)).toBe(true);
        expect(projects.some((p) => p.project_id === project2.id)).toBe(true);

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
        await db.projectMembers.removeMember(project2.id, testUser2.id);
        await db.projects.delete(project2.id);
      });
    });

    describe('Access Control Integration', () => {
      it('should properly integrate with hasAccess after adding member', async () => {
        // User3 should not have access initially
        let hasAccess = await db.projects.hasAccess(testProject.id, testUser3.id);
        expect(hasAccess).toBe(false);

        // Add user3 as member
        await db.projectMembers.addMember(testProject.id, testUser3.id, 'viewer');

        // Now user3 should have access
        hasAccess = await db.projects.hasAccess(testProject.id, testUser3.id);
        expect(hasAccess).toBe(true);

        // Check role
        const role = await db.projects.getUserRole(testProject.id, testUser3.id);
        expect(role).toBe('viewer');

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser3.id);
      });

      it('should properly integrate with getUserRole for different roles', async () => {
        // Add members with different roles
        await db.projectMembers.addMember(testProject.id, testUser2.id, 'admin');
        await db.projectMembers.addMember(testProject.id, testUser3.id, 'viewer');

        const role2 = await db.projects.getUserRole(testProject.id, testUser2.id);
        const role3 = await db.projects.getUserRole(testProject.id, testUser3.id);

        expect(role2).toBe('admin');
        expect(role3).toBe('viewer');

        // Cleanup
        await db.projectMembers.removeMember(testProject.id, testUser2.id);
        await db.projectMembers.removeMember(testProject.id, testUser3.id);
      });
    });
  });
});
