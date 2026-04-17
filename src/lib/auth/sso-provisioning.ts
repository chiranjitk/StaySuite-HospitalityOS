/**
 * SSO User Provisioning Service
 * 
 * This service handles user provisioning and de-provisioning including:
 * - Automatic user creation from SSO attributes
 * - User attribute synchronization
 * - Role mapping and assignment
 * - User deactivation/deletion on SSO changes
 */

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';

// Provisioning types
export interface ProvisioningContext {
  connectionId: string;
  tenantId: string;
  ssoProviderId?: string;
  attributes: Record<string, string | string[]>;
}

export interface ProvisioningResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isNewUser: boolean;
  };
  error?: string;
}

export interface DeprovisioningResult {
  success: boolean;
  action: 'deactivated' | 'deleted' | 'none';
  error?: string;
}

export interface RoleMapping {
  ssoGroup: string;
  roleId: string;
  roleName: string;
}

export class SSOProvisioningService {
  /**
   * Provision or update user from SSO attributes
   */
  static async provisionUser(context: ProvisioningContext): Promise<ProvisioningResult> {
    const { connectionId, tenantId, ssoProviderId, attributes } = context;

    try {
      // Get connection configuration
      const connection = await db.sSOConnection.findFirst({
        where: { id: connectionId, tenantId },
      });

      if (!connection) {
        return { success: false, error: 'SSO connection not found' };
      }

      // Extract email from attributes
      const email = this.getAttribute(attributes, connection.emailAttribute);
      if (!email) {
        return { success: false, error: 'Email attribute not found in SSO response' };
      }

      // Check domain restrictions
      if (connection.allowedDomains) {
        const domains = JSON.parse(connection.allowedDomains) as string[];
        const emailDomain = email.split('@')[1];
        if (!domains.includes(emailDomain)) {
          return { success: false, error: 'Email domain not allowed' };
        }
      }

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: { email },
        include: { role: true },
      });

      // Extract user attributes
      const firstName = this.getAttribute(attributes, connection.firstNameAttribute) || '';
      const lastName = this.getAttribute(attributes, connection.lastNameAttribute) || '';
      const name = this.getAttribute(attributes, connection.nameAttribute) ||
        `${firstName} ${lastName}`.trim();
      const phone = connection.phoneAttribute
        ? this.getAttribute(attributes, connection.phoneAttribute)
        : undefined;
      const department = connection.departmentAttribute
        ? this.getAttribute(attributes, connection.departmentAttribute)
        : undefined;

      if (existingUser) {
        // Update existing user if sync is enabled
        if (connection.syncOnLogin) {
          await this.updateUser(existingUser.id, {
            firstName: firstName || existingUser.firstName,
            lastName: lastName || existingUser.lastName,
            phone: (phone || existingUser.phone) ?? undefined,
            department: (department || existingUser.department) ?? undefined,
            lastLoginAt: new Date(),
          }, connection, {
            attributes,
            roleAttribute: connection.roleAttribute,
            roleMappings: connection.roleMappings ? JSON.parse(connection.roleMappings as string) : [],
            userId: existingUser.id,
            tenantId,
          });
        } else {
          // Just update last login
          await db.user.update({
            where: { id: existingUser.id },
            data: { lastLoginAt: new Date() },
          });
        }

        return {
          success: true,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            isNewUser: false,
          },
        };
      }

      // Auto-provision new user
      if (!connection.autoProvision) {
        return { success: false, error: 'User not found and auto-provisioning is disabled' };
      }

      // Create new user
      const newUser = await this.createUser({
        tenantId,
        email,
        firstName,
        lastName,
        phone,
        department,
        ssoProviderId,
        connection,
      });

      return {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isNewUser: true,
        },
      };
    } catch (error) {
      console.error('User provisioning error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Provisioning failed',
      };
    }
  }

  /**
   * Create a new user from SSO attributes
   */
  private static async createUser(params: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    department?: string;
    ssoProviderId?: string;
    connection: {
      id: string;
      tenantId: string;
      autoProvisionRole?: string | null;
      syncRoles?: boolean;
      roleAttribute?: string | null;
    };
  }): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }> {
    const { tenantId, email, firstName, lastName, phone, department, ssoProviderId, connection } = params;

    // Generate a random password (user won't need it for SSO login)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(randomPassword);

    // Determine role
    let roleId: string | null = null;
    if (connection.autoProvisionRole) {
      const defaultRole = await db.role.findFirst({
        where: { tenantId, id: connection.autoProvisionRole },
      });
      if (defaultRole) {
        roleId = defaultRole.id;
      }
    }

    // If no default role, try to find 'staff' role
    if (!roleId) {
      const staffRole = await db.role.findFirst({
        where: { tenantId, name: 'staff' },
      });
      if (staffRole) {
        roleId = staffRole.id;
      }
    }

    // Create user
    const user = await db.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName: firstName || 'User',
        lastName: lastName || '',
        phone,
        department,
        roleId,
        status: 'active',
        isVerified: true, // SSO users are pre-verified
        verifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Create SSO session record
    if (ssoProviderId) {
      await db.sSOSession.create({
        data: {
          connectionId: connection.id,
          userId: user.id,
          ssoProviderId,
          authenticatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          attributes: JSON.stringify(params),
        },
      });
    }

    return user;
  }

  /**
   * Update existing user
   */
  private static async updateUser(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      department?: string;
      lastLoginAt: Date;
    },
    connection: {
      syncRoles?: boolean;
      roleAttribute?: string | null;
    },
    syncOptions?: {
      attributes: Record<string, string | string[]>;
      roleAttribute?: string | null;
      roleMappings: RoleMapping[];
      userId: string;
      tenantId: string;
    }
  ): Promise<void> {
    // Update user attributes
    await db.user.update({
      where: { id: userId },
      data: updates,
    });

    // Sync roles if enabled
    if (connection.syncRoles && syncOptions?.roleAttribute) {
      const groupsValue = syncOptions.attributes[syncOptions.roleAttribute];
      let groups: string[] = [];
      if (Array.isArray(groupsValue)) {
        groups = groupsValue;
      } else if (groupsValue) {
        groups = groupsValue.split(',').map(g => g.trim()).filter(Boolean);
      }

      if (groups.length > 0 && syncOptions.roleMappings.length > 0) {
        await this.syncUserRoles(
          syncOptions.userId,
          syncOptions.tenantId,
          groups,
          syncOptions.roleMappings
        );
      }
    }
  }

  /**
   * Deprovision user
   */
  static async deprovisionUser(
    userId: string,
    connectionId: string,
    action: 'deactivate' | 'delete' | 'anonymize' = 'deactivate'
  ): Promise<DeprovisioningResult> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { ssoSessions: true },
      });

      if (!user) {
        return { success: false, action: 'none', error: 'User not found' };
      }

      // Check if user has active SSO sessions from this connection
      const ssoSessions = await db.sSOSession.findMany({
        where: { userId, connectionId },
      });

      // Terminate all SSO sessions
      await db.sSOSession.updateMany({
        where: { userId, connectionId },
        data: {
          terminatedAt: new Date(),
          terminatedReason: `User deprovisioned: ${action}`,
        },
      });

      switch (action) {
        case 'deactivate':
          await db.user.update({
            where: { id: userId },
            data: { status: 'inactive' },
          });
          return { success: true, action: 'deactivated' };

        case 'delete':
          // Soft delete
          await db.user.update({
            where: { id: userId },
            data: {
              deletedAt: new Date(),
              status: 'deleted',
            },
          });
          return { success: true, action: 'deleted' };

        case 'anonymize':
          // Anonymize user data
          await db.user.update({
            where: { id: userId },
            data: {
              email: `anonymized-${userId}@deleted.local`,
              firstName: 'Anonymized',
              lastName: 'User',
              phone: null,
              department: null,
              avatar: null,
              status: 'deleted',
              deletedAt: new Date(),
            },
          });
          return { success: true, action: 'deleted' };

        default:
          return { success: false, action: 'none', error: 'Invalid action' };
      }
    } catch (error) {
      console.error('User deprovisioning error:', error);
      return {
        success: false,
        action: 'none',
        error: error instanceof Error ? error.message : 'Deprovisioning failed',
      };
    }
  }

  /**
   * Sync user roles from SSO groups
   */
  static async syncUserRoles(
    userId: string,
    tenantId: string,
    groups: string[],
    roleMappings: RoleMapping[]
  ): Promise<{
    success: boolean;
    assignedRoles: string[];
    error?: string;
  }> {
    try {
      // Find matching roles
      const assignedRoles: string[] = [];
      
      for (const group of groups) {
        const mapping = roleMappings.find(m => 
          m.ssoGroup.toLowerCase() === group.toLowerCase()
        );
        if (mapping) {
          assignedRoles.push(mapping.roleId);
        }
      }

      if (assignedRoles.length === 0) {
        return { success: true, assignedRoles: [] };
      }

      // Get first valid role
      const role = await db.role.findFirst({
        where: {
          id: { in: assignedRoles },
          tenantId,
        },
      });

      if (role) {
        await db.user.update({
          where: { id: userId },
          data: { roleId: role.id },
        });
      }

      return { success: true, assignedRoles: [role?.id || ''].filter(Boolean) };
    } catch (error) {
      console.error('Role sync error:', error);
      return {
        success: false,
        assignedRoles: [],
        error: error instanceof Error ? error.message : 'Role sync failed',
      };
    }
  }

  /**
   * Get attribute from SSO attributes
   */
  private static getAttribute(
    attributes: Record<string, string | string[]>,
    attributeName: string
  ): string {
    if (!attributeName) return '';
    
    const value = attributes[attributeName];
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value || '';
  }

  /**
   * Create SSO session for authenticated user
   */
  static async createSsoSession(params: {
    connectionId: string;
    userId: string;
    ssoProviderId?: string;
    attributes: Record<string, string | string[]>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<string> {
    const session = await db.sSOSession.create({
      data: {
        connectionId: params.connectionId,
        userId: params.userId,
        ssoProviderId: params.ssoProviderId,
        attributes: JSON.stringify(params.attributes),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        authenticatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return session.id;
  }

  /**
   * Terminate SSO session
   */
  static async terminateSsoSession(sessionId: string, reason?: string): Promise<void> {
    await db.sSOSession.update({
      where: { id: sessionId },
      data: {
        terminatedAt: new Date(),
        terminatedReason: reason || 'User logout',
      },
    });
  }

  /**
   * Terminate all sessions for a user from a connection
   */
  static async terminateAllSessions(
    userId: string,
    connectionId?: string,
    reason?: string
  ): Promise<number> {
    const where: { userId: string; connectionId?: string; terminatedAt: null } = {
      userId,
      terminatedAt: null as unknown as null, // TypeScript hack for null filter
    };

    if (connectionId) {
      where.connectionId = connectionId;
    }

    const result = await db.sSOSession.updateMany({
      where,
      data: {
        terminatedAt: new Date(),
        terminatedReason: reason || 'Session terminated',
      },
    });

    return result.count;
  }

  /**
   * Get active SSO sessions for a user
   */
  static async getActiveSessions(userId: string): Promise<{
    id: string;
    connectionName: string;
    connectionType: string;
    authenticatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }[]> {
    const sessions = await db.sSOSession.findMany({
      where: {
        userId,
        terminatedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        connection: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: { authenticatedAt: 'desc' },
    });

    return sessions.map(s => ({
      id: s.id,
      connectionName: s.connection.name,
      connectionType: s.connection.type,
      authenticatedAt: s.authenticatedAt || s.createdAt,
      ipAddress: s.ipAddress || undefined,
      userAgent: s.userAgent || undefined,
    }));
  }

  /**
   * Check if user is provisioned from SSO
   */
  static async isSsoUser(userId: string): Promise<boolean> {
    const session = await db.sSOSession.findFirst({
      where: { userId },
    });
    return !!session;
  }

  /**
   * Get user's SSO connections
   */
  static async getUserSsoConnections(userId: string): Promise<{
    id: string;
    name: string;
    type: string;
    lastLoginAt?: Date;
  }[]> {
    const sessions = await db.sSOSession.findMany({
      where: { userId },
      include: {
        connection: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { authenticatedAt: 'desc' },
    });

    // Get unique connections
    const connectionMap = new Map<string, { id: string; name: string; type: string; lastLoginAt?: Date }>();
    
    for (const session of sessions) {
      if (!connectionMap.has(session.connection.id)) {
        connectionMap.set(session.connection.id, {
          id: session.connection.id,
          name: session.connection.name,
          type: session.connection.type,
          lastLoginAt: session.authenticatedAt || undefined,
        });
      }
    }

    return Array.from(connectionMap.values());
  }

  /**
   * Bulk provision users
   */
  static async bulkProvision(
    connectionId: string,
    tenantId: string,
    users: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      attributes: Record<string, string | string[]>;
    }>
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    const result = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

    for (const user of users) {
      const provisionResult = await this.provisionUser({
        connectionId,
        tenantId,
        attributes: {
          ...user.attributes,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
        },
      });

      if (provisionResult.success) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push({ email: user.email, error: provisionResult.error || 'Unknown error' });
      }
    }

    return result;
  }
}

export default SSOProvisioningService;
