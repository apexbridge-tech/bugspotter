/**
 * User Management Routes
 * Admin-only endpoints for managing users
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import bcrypt from 'bcrypt';
import type { UserRepository } from '../../db/repositories.js';
import type { User } from '../../db/types.js';
import {
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
} from '../schemas/user-schema.js';

const SALT_ROUNDS = 10;

export function userRoutes(fastify: FastifyInstance, userRepo: UserRepository) {
  // List users with pagination and filtering
  fastify.get(
    '/api/v1/admin/users',
    {
      preHandler: requireRole('admin'),
      schema: listUsersSchema,
    },
    async (request, reply) => {
      const {
        page = 1,
        limit = 20,
        role,
        email,
      } = request.query as {
        page?: number;
        limit?: number;
        role?: 'admin' | 'user' | 'viewer';
        email?: string;
      };

      const { users, total } = await userRepo.listWithFilters({ page, limit, role, email });

      return reply.send({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }
  );

  // Create new user
  fastify.post(
    '/api/v1/admin/users',
    {
      preHandler: requireRole('admin'),
      schema: createUserSchema,
    },
    async (request, reply) => {
      const { email, name, password, role, oauth_provider } = request.body as {
        email: string;
        name: string;
        password?: string;
        role: 'admin' | 'user' | 'viewer';
        oauth_provider?: string;
      };

      // Check if user already exists
      const existingUser = await userRepo.findByEmail(email);
      if (existingUser) {
        throw new AppError('User with this email already exists', 409, 'Conflict');
      }

      // Hash password if provided (for non-OAuth users)
      let passwordHash: string | undefined;
      if (password) {
        passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      } else if (!oauth_provider) {
        throw new AppError('Password is required for non-OAuth users', 400, 'BadRequest');
      }

      // Create user
      const user = await userRepo.create({
        email,
        name,
        password_hash: passwordHash,
        role,
        oauth_provider,
      });

      // Remove password hash from response
      const { password_hash: _password_hash, ...userWithoutPassword } = user;

      return reply.code(201).send({
        success: true,
        data: userWithoutPassword,
      });
    }
  );

  // Update user
  fastify.patch(
    '/api/v1/admin/users/:id',
    {
      preHandler: requireRole('admin'),
      schema: updateUserSchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, role, email } = request.body as {
        name?: string;
        role?: 'admin' | 'user' | 'viewer';
        email?: string;
      };

      // Check if user exists
      const user = await userRepo.findById(id);
      if (!user) {
        throw new AppError('User not found', 404, 'NotFound');
      }

      // Prevent users from changing their own role
      if (role && user.id === request.authUser?.id && user.role !== role) {
        throw new AppError('Cannot change your own role', 400, 'BadRequest');
      }

      // Check email uniqueness if being updated
      if (email && email !== user.email) {
        const existingUser = await userRepo.findByEmail(email);
        if (existingUser) {
          throw new AppError('Email already in use', 409, 'Conflict');
        }
      }

      // Update user
      const updates: { name?: string; role?: string; email?: string } = {};
      if (name) {
        updates.name = name;
      }
      if (role) {
        updates.role = role;
      }
      if (email) {
        updates.email = email;
      }

      const updated = await userRepo.update(id, updates as Partial<User>);
      if (!updated) {
        throw new AppError('User not found', 404, 'NotFound');
      }

      // Remove password hash from response
      const { password_hash: _password_hash2, ...userWithoutPassword } = updated;

      return reply.send({
        success: true,
        data: userWithoutPassword,
      });
    }
  );

  // Delete user
  fastify.delete(
    '/api/v1/admin/users/:id',
    {
      preHandler: requireRole('admin'),
      schema: deleteUserSchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Check if user exists
      const user = await userRepo.findById(id);
      if (!user) {
        throw new AppError('User not found', 404, 'NotFound');
      }

      // Prevent users from deleting themselves
      if (user.id === request.authUser?.id) {
        throw new AppError('Cannot delete your own account', 400, 'BadRequest');
      }

      // Delete user
      await userRepo.delete(id);

      return reply.send({
        success: true,
        message: 'User deleted successfully',
      });
    }
  );
}
