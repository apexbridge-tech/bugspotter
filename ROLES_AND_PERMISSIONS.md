# BugSpotter Roles & Permissions

## Overview

BugSpotter has a **dual authentication system** with different role hierarchies:

1. **User Roles** (System-wide) - JWT Bearer token authentication
2. **Project Member Roles** (Project-specific) - For multi-user project access

---

## 1. User Roles (System-Wide)

### Role Types

| Role       | Description        | Database Default  |
| ---------- | ------------------ | ----------------- |
| **admin**  | Full system access | No                |
| **user**   | Standard user      | **Yes** (default) |
| **viewer** | Read-only access   | No                |

### Role Hierarchy

```
admin > user > viewer
```

### Permissions by Role

#### 🔴 **Admin** (Highest Privilege)

- ✅ **Full User Management** (`/api/v1/admin/users`)
  - List all users with pagination and filtering
  - Create new users
  - Update any user's details (name, email, role)
  - Delete any user (except themselves)
- ✅ **Full Analytics Access** (`/api/v1/analytics`)
  - View dashboard metrics (bug reports, projects, users)
  - View report trends (custom date ranges)
  - View per-project statistics
- ✅ **Full Project Access**
  - View **all projects** in the system
  - Delete any project
- ✅ **Admin Endpoints**
  - Manage system configuration
  - Manage retention policies
  - Access admin dashboard

#### 🟢 **User** (Standard Privilege)

- ✅ **Project Management** (`/api/v1/projects`)
  - Create new projects
  - View projects they created or are members of
  - Update their own projects
  - Delete their own projects
  - Regenerate API keys
- ✅ **Bug Report Access**
  - View bug reports for their projects
  - Create bug reports via SDK (API key)
- ❌ **Restrictions**
  - Cannot access user management endpoints
  - Cannot access analytics endpoints
  - Cannot view other users' projects (unless added as member)
  - Cannot delete other users

#### 🔵 **Viewer** (Read-Only)

- ✅ **Read-Only Access**
  - Currently defined in type system but **not actively used** in routes
  - Intended for future read-only access patterns
- ❌ **Restrictions**
  - No create/update/delete operations
  - No admin access
  - No analytics access

---

## 2. Project Member Roles (Project-Specific)

Defined in `project_members` table for multi-user project collaboration.

### Member Role Types

| Role       | Description                      |
| ---------- | -------------------------------- |
| **owner**  | Project creator, full control    |
| **admin**  | Project administrator            |
| **member** | Regular project member (default) |
| **viewer** | Read-only project access         |

### Project Member Permissions

#### Project Owner

- Full control over project
- Can add/remove members
- Can change project settings
- Can delete project

#### Project Admin

- Can manage project settings
- Can add/remove members (except owner)
- Cannot delete project

#### Project Member

- Can view and create bug reports
- Can update bug report status
- Cannot manage project settings
- Cannot manage members

#### Project Viewer

- Read-only access to bug reports
- Cannot create or update bug reports
- Cannot manage project

---

## Route Protection

### Middleware Types

```typescript
// 1. No authentication required (public routes)
{
  config: {
    public: true;
  }
}

// 2. User authentication required (any logged-in user)
{
  preHandler: [requireUser];
}

// 3. Role-based authorization (specific roles only)
{
  preHandler: requireRole('admin');
}
{
  preHandler: requireRole('admin', 'user');
}

// 4. Combined authentication
{
  preHandler: [requireUser, requireRole('admin')];
}
```

### Protected Endpoints by Role

#### Admin-Only Endpoints

```text
// User Management
GET    /api/v1/admin/users              // List users
POST   /api/v1/admin/users              // Create user
PATCH  /api/v1/admin/users/:id          // Update user
DELETE /api/v1/admin/users/:id          // Delete user

// Analytics
GET    /api/v1/analytics/dashboard      // Dashboard metrics
GET    /api/v1/analytics/reports/trend  // Trend analysis
GET    /api/v1/analytics/projects/stats // Project statistics

// Admin Operations
POST   /api/v1/admin/...                // Various admin endpoints
DELETE /api/v1/projects/:id             // Delete any project (admin only)
```

#### User + Admin Endpoints

```text
// Project Management (requireUser - any authenticated user)
GET    /api/v1/projects                 // List my projects
POST   /api/v1/projects                 // Create project
GET    /api/v1/projects/:id             // View project details
PATCH  /api/v1/projects/:id             // Update project
POST   /api/v1/projects/:id/regenerate  // Regenerate API key
```

#### Public Endpoints (No Auth)

```text
// Setup
GET    /api/v1/setup/status             // Check setup status
POST   /api/v1/setup/initialize          // Initialize system

// Authentication
POST   /api/v1/auth/login                // User login
POST   /api/v1/auth/refresh              // Refresh token
POST   /api/v1/auth/logout               // Logout

// Health
GET    /health                           // Health check
```

#### API Key Authentication (SDK)

```text
// Bug Reports (X-API-Key header)
GET    /api/v1/bug-reports              // List bug reports
POST   /api/v1/bug-reports              // Create bug report
GET    /api/v1/bug-reports/:id          // Get bug report
PATCH  /api/v1/bug-reports/:id          // Update bug report
DELETE /api/v1/bug-reports/:id          // Delete bug report

// Sessions (X-API-Key header)
POST   /api/v1/sessions                 // Create session
```

---

## Authorization Flow

### 1. Dual Authentication System

```
┌─────────────────┐
│ Incoming Request│
└────────┬────────┘
         │
         ├──→ X-API-Key header?
         │    └──→ Validate API key
         │         └──→ Set request.authProject
         │
         └──→ Authorization: Bearer <token>?
              └──→ Verify JWT
                   └──→ Fetch user from DB
                        └──→ Set request.authUser
```

### 2. Role Authorization Flow

```
┌──────────────────┐
│ requireRole(...) │
└────────┬─────────┘
         │
         ├──→ Check request.authUser exists
         │    └──→ Not found: 401 Unauthorized
         │
         └──→ Check user.role in allowedRoles
              ├──→ Allowed: Continue
              └──→ Not allowed: 403 Forbidden
```

### 3. Project Access Flow (User-based)

```
┌─────────────────┐
│ GET /projects   │
└────────┬────────┘
         │
         ├──→ Admin user?
         │    └──→ Return ALL projects
         │
         └──→ Regular user?
              └──→ Return projects WHERE:
                   - created_by = user.id OR
                   - user in project_members
```

---

## Security Patterns

### 1. Self-Protection Logic

```typescript
// Admin cannot change their own role
if (role && user.id === request.authUser?.id && user.role !== role) {
  throw new AppError('Cannot change your own role', 400, 'ValidationError');
}

// Admin cannot delete themselves
if (userId === request.authUser?.id) {
  throw new AppError('Cannot delete your own account', 400, 'ValidationError');
}
```

### 2. Fresh User Data on Every Request

```typescript
// JWT contains userId, but we always fetch fresh user from DB
// This ensures role changes take effect immediately
const user = await db.users.findById(decoded.userId);
request.authUser = user;
```

### 3. Role-Based Filtering

```typescript
// Admins see everything, users see only their data
if (request.authUser?.role === 'admin') {
  return await db.projects.findAll();
} else {
  return await findProjectsByUser(request.authUser!.id);
}
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',  -- admin | user | viewer
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Project Members Table

```sql
CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) NOT NULL DEFAULT 'member',  -- owner | admin | member | viewer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);
```

---

## TypeScript Types

```typescript
// User roles (system-wide)
type UserRole = 'admin' | 'user' | 'viewer';

// Project member roles (project-specific)
type ProjectMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  password_hash?: string;
  oauth_provider?: string | null;
  oauth_id?: string | null;
  created_at: Date;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  created_at: Date;
}
```

---

## Usage Examples

### Creating Users with Different Roles

```typescript
// Create admin user
const admin = await db.users.create({
  email: 'admin@example.com',
  password_hash: await bcrypt.hash('password', 10),
  role: 'admin',
  name: 'Admin User',
});

// Create regular user (default)
const user = await db.users.create({
  email: 'user@example.com',
  password_hash: await bcrypt.hash('password', 10),
  role: 'user', // or omit, defaults to 'user'
  name: 'Regular User',
});

// Create viewer (read-only)
const viewer = await db.users.create({
  email: 'viewer@example.com',
  password_hash: await bcrypt.hash('password', 10),
  role: 'viewer',
  name: 'Read Only User',
});
```

### Protecting Routes

```typescript
// Admin-only endpoint
fastify.get(
  '/api/v1/admin/users',
  {
    preHandler: requireRole('admin'),
  },
  async (request, reply) => {
    // Only admins can access
  }
);

// Multiple roles allowed
fastify.get(
  '/api/v1/dashboard',
  {
    preHandler: requireRole('admin', 'user'),
  },
  async (request, reply) => {
    // Admins and users can access, viewers cannot
  }
);

// Any authenticated user
fastify.get(
  '/api/v1/projects',
  {
    preHandler: requireUser,
  },
  async (request, reply) => {
    // Any logged-in user can access
  }
);
```

### Adding Project Members

```typescript
// Add user to project as member
await db.projectMembers.create({
  project_id: project.id,
  user_id: user.id,
  role: 'member', // owner | admin | member | viewer
});
```

---

## Current Status

### ✅ Fully Implemented

- Admin role with full system access
- User role with project management
- User management API (admin-only)
- Analytics API (admin-only)
- Role-based route protection
- Self-protection logic (can't change own role/delete self)
- Dual authentication (API keys + JWT)

### 🟡 Partially Implemented

- Viewer role (defined but not actively used in routes)
- Project member roles (table exists but not fully utilized)

### 🔄 Future Enhancements

- Granular project-level permissions
- Custom roles and permissions
- Role hierarchy enforcement
- Audit logging for role changes
- Rate limiting per role
- API usage quotas per role

---

## Security Best Practices

1. **Always fetch fresh user data** from database on auth (not just from JWT)
2. **Implement self-protection** logic (users can't modify/delete themselves)
3. **Use role hierarchies** (admin > user > viewer)
4. **Validate roles** at middleware level before business logic
5. **Log role changes** and administrative actions
6. **Require strong passwords** for admin accounts
7. **Use HTTPS** in production for JWT tokens
8. **Set short token expiry** for admin tokens (24h access, 7d refresh)
9. **Revoke tokens immediately** on role changes
10. **Audit admin actions** regularly

---

**Last Updated:** October 17, 2025  
**Version:** 0.1.0 (Pre-release)
