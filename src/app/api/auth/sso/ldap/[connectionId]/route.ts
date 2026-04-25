import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import LDAPService, { LDAPConfig } from '@/lib/auth/ldap-service';
import SSOProvisioningService from '@/lib/auth/sso-provisioning';
import crypto from 'crypto';

// POST /api/auth/sso/ldap/[connectionId] - LDAP authentication
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const body = await request.json();
    const { username, password, tenantId: bodyTenantId, action } = body;

    // Handle test connection action
    if (action === 'test') {
      const session = await getServerSession(authOptions);
      const tenantId = session?.user?.tenantId || bodyTenantId;

      if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const result = await LDAPService.testConnectionById(connectionId, tenantId);
      return NextResponse.json(result);
    }

    // Handle authentication
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get tenant ID from session or body
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId || bodyTenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Get connection
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, tenantId, type: 'ldap', status: 'active' },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'LDAP connection not found or inactive' },
        { status: 404 }
      );
    }

    // Authenticate against LDAP
    const authResult = await LDAPService.authenticate(
      connectionId,
      username,
      password,
      tenantId
    );

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    // Map LDAP attributes to application attributes
    const mappedUser = LDAPService.mapUserAttributes(authResult.user, {
      emailAttribute: connection.emailAttribute,
      firstNameAttribute: connection.firstNameAttribute,
      lastNameAttribute: connection.lastNameAttribute,
      nameAttribute: connection.nameAttribute,
      roleAttribute: connection.roleAttribute,
      departmentAttribute: connection.departmentAttribute,
      phoneAttribute: connection.phoneAttribute,
    });

    // Build attributes for provisioning
    const attributes: Record<string, string | string[]> = {
      email: mappedUser.email,
      firstName: mappedUser.firstName,
      lastName: mappedUser.lastName,
      name: mappedUser.name,
      phone: mappedUser.phone || '',
      department: mappedUser.department || '',
      dn: authResult.user.dn,
      cn: authResult.user.cn,
      sAMAccountName: authResult.user.sAMAccountName || '',
      userPrincipalName: authResult.user.userPrincipalName || '',
    };

    if (authResult.user.memberOf && authResult.user.memberOf.length > 0) {
      attributes.groups = authResult.user.memberOf;
    }

    // Provision or update user
    const provisionResult = await SSOProvisioningService.provisionUser({
      connectionId: connection.id,
      tenantId: connection.tenantId,
      ssoProviderId: authResult.user.dn,
      attributes,
    });

    if (!provisionResult.success || !provisionResult.user) {
      return NextResponse.json(
        { error: provisionResult.error || 'User provisioning failed' },
        { status: 500 }
      );
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create SSO session
    const ssoSessionId = await SSOProvisioningService.createSsoSession({
      connectionId: connection.id,
      userId: provisionResult.user.id,
      ssoProviderId: authResult.user.dn,
      attributes,
      ipAddress,
      userAgent,
    });

    // Create app session
    await db.session.create({
      data: {
        userId: provisionResult.user.id,
        token: sessionToken,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Update SSO session with app session reference
    await db.sSOSession.update({
      where: { id: ssoSessionId },
      data: { sessionId: sessionToken },
    });

    // Get user with role
    const userWithRole = await db.user.findUnique({
      where: { id: provisionResult.user.id },
      include: {
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    if (!userWithRole) {
      return NextResponse.json({ error: 'User not found' }, { status: 500 });
    }

    // Parse permissions
    let permissions: string[] = [];
    if (userWithRole.role?.permissions) {
      try {
        permissions = JSON.parse(userWithRole.role.permissions);
      } catch {
        permissions = [];
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        firstName: userWithRole.firstName,
        lastName: userWithRole.lastName,
        name: `${userWithRole.firstName} ${userWithRole.lastName}`,
        avatar: userWithRole.avatar,
        roleId: userWithRole.roleId,
        roleName: userWithRole.role?.name || 'staff',
        permissions,
        tenantId: userWithRole.tenantId,
        tenant: userWithRole.tenant,
        isNewUser: provisionResult.user.isNewUser,
      },
    });

    // Set session cookies
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    response.cookies.set('refresh-token', refreshToken, {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('LDAP authentication error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    );
  }
}

// GET /api/auth/sso/ldap/[connectionId] - Search LDAP users
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || undefined;
    const action = searchParams.get('action');

    if (action === 'sync') {
      // Sync users from LDAP
      const result = await LDAPService.syncUsers(
        connectionId,
        session.user.tenantId
      );
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // Search users
    const users = await LDAPService.searchUsers(
      connectionId,
      session.user.tenantId,
      searchTerm
    );

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        dn: u.dn,
        cn: u.cn,
        email: u.mail,
        displayName: u.displayName,
        department: u.department,
      })),
    });
  } catch (error) {
    console.error('LDAP search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
