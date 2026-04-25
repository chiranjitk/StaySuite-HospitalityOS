import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/auth/sso/connections - List SSO connections
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'settings.view') && !hasPermission(user, 'settings.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const where: {
      tenantId: string;
      type?: string;
      status?: string;
    } = {
      tenantId: user.tenantId,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const connections = await db.sSOConnection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        samlEntityId: true,
        samlSsoUrl: true,
        ldapUrl: true,
        ldapBaseDn: true,
        oidcClientId: true,
        oidcDiscoveryUrl: true,
        emailAttribute: true,
        nameAttribute: true,
        roleAttribute: true,
        autoProvision: true,
        autoProvisionRole: true,
        syncRoles: true,
        allowedDomains: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        testConnectionAt: true,
        testConnectionStatus: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      connections: connections.map(c => ({
        ...c,
        sessionCount: c._count.sessions,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error('Error fetching SSO connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SSO connections' },
      { status: 500 }
    );
  }
}

// POST /api/auth/sso/connections - Create SSO connection
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'settings.manage') && !hasPermission(user, 'settings.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      type,
      // SAML fields
      samlEntityId,
      samlSsoUrl,
      samlSloUrl,
      samlCertificate,
      samlPrivateKey,
      samlNameIdFormat,
      samlSignRequest,
      samlWantAssertionSigned,
      // LDAP fields
      ldapUrl,
      ldapBaseDn,
      ldapBindDn,
      ldapBindPassword,
      ldapSearchFilter,
      ldapUseStartTls,
      ldapUseSsl,
      ldapTimeout,
      // OIDC fields
      oidcClientId,
      oidcClientSecret,
      oidcDiscoveryUrl,
      oidcAuthorizationUrl,
      oidcTokenUrl,
      oidcUserInfoUrl,
      oidcJwksUrl,
      oidcScopes,
      oidcUsePkce,
      // Attribute mapping
      emailAttribute,
      firstNameAttribute,
      lastNameAttribute,
      nameAttribute,
      roleAttribute,
      departmentAttribute,
      phoneAttribute,
      // Provisioning
      autoProvision,
      autoProvisionRole,
      syncRoles,
      syncOnLogin,
      // Domain restriction
      allowedDomains,
    } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    if (!['saml', 'ldap', 'oidc'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid SSO type. Must be saml, ldap, or oidc' },
        { status: 400 }
      );
    }

    // Validate type-specific fields
    if (type === 'saml' && !samlSsoUrl) {
      return NextResponse.json(
        { error: 'SAML SSO URL is required for SAML connections' },
        { status: 400 }
      );
    }

    if (type === 'ldap' && (!ldapUrl || !ldapBaseDn)) {
      return NextResponse.json(
        { error: 'LDAP URL and Base DN are required for LDAP connections' },
        { status: 400 }
      );
    }

    if (type === 'oidc' && !oidcClientId) {
      return NextResponse.json(
        { error: 'OIDC Client ID is required for OIDC connections' },
        { status: 400 }
      );
    }

    // Create connection
    const connection = await db.sSOConnection.create({
      data: {
        tenantId: user.tenantId,
        name,
        type,
        status: 'active',
        // SAML fields
        samlEntityId,
        samlSsoUrl,
        samlSloUrl,
        samlCertificate,
        samlPrivateKey,
        samlNameIdFormat: samlNameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        samlSignRequest: samlSignRequest !== false,
        samlWantAssertionSigned: samlWantAssertionSigned !== false,
        // LDAP fields
        ldapUrl,
        ldapBaseDn,
        ldapBindDn,
        ldapBindPassword,
        ldapSearchFilter: ldapSearchFilter || '(mail={email})',
        ldapUseStartTls: ldapUseStartTls || false,
        ldapUseSsl: ldapUseSsl !== false,
        ldapTimeout: ldapTimeout || 30,
        // OIDC fields
        oidcClientId,
        oidcClientSecret,
        oidcDiscoveryUrl,
        oidcAuthorizationUrl,
        oidcTokenUrl,
        oidcUserInfoUrl,
        oidcJwksUrl,
        oidcScopes: oidcScopes || 'openid profile email',
        oidcUsePkce: oidcUsePkce !== false,
        // Attribute mapping
        emailAttribute: emailAttribute || 'email',
        firstNameAttribute: firstNameAttribute || 'givenName',
        lastNameAttribute: lastNameAttribute || 'sn',
        nameAttribute: nameAttribute || 'name',
        roleAttribute,
        departmentAttribute,
        phoneAttribute: phoneAttribute || 'telephoneNumber',
        // Provisioning
        autoProvision: autoProvision !== false,
        autoProvisionRole,
        syncRoles: syncRoles || false,
        syncOnLogin: syncOnLogin !== false,
        // Domain restriction
        allowedDomains: allowedDomains ? JSON.stringify(allowedDomains) : null,
      },
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        type: connection.type,
        status: connection.status,
      },
    });
  } catch (error) {
    console.error('Error creating SSO connection:', error);
    return NextResponse.json(
      { error: 'Failed to create SSO connection' },
      { status: 500 }
    );
  }
}

// PUT /api/auth/sso/connections - Update SSO connection
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'settings.manage') && !hasPermission(user, 'settings.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 });
    }

    // Verify connection belongs to tenant
    const existing = await db.sSOConnection.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    // Handle allowed domains
    if (updates.allowedDomains !== undefined) {
      updateData.allowedDomains = Array.isArray(updates.allowedDomains)
        ? JSON.stringify(updates.allowedDomains)
        : updates.allowedDomains;
    }

    // Copy allowed fields
    const allowedFields = [
      'name', 'status',
      // SAML
      'samlEntityId', 'samlSsoUrl', 'samlSloUrl', 'samlCertificate', 'samlPrivateKey',
      'samlNameIdFormat', 'samlSignRequest', 'samlWantAssertionSigned',
      // LDAP
      'ldapUrl', 'ldapBaseDn', 'ldapBindDn', 'ldapBindPassword', 'ldapSearchFilter',
      'ldapUseStartTls', 'ldapUseSsl', 'ldapTimeout',
      // OIDC
      'oidcClientId', 'oidcClientSecret', 'oidcDiscoveryUrl', 'oidcAuthorizationUrl',
      'oidcTokenUrl', 'oidcUserInfoUrl', 'oidcJwksUrl', 'oidcScopes', 'oidcUsePkce',
      // Attributes
      'emailAttribute', 'firstNameAttribute', 'lastNameAttribute', 'nameAttribute',
      'roleAttribute', 'departmentAttribute', 'phoneAttribute',
      // Provisioning
      'autoProvision', 'autoProvisionRole', 'syncRoles', 'syncOnLogin',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    const connection = await db.sSOConnection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        type: connection.type,
        status: connection.status,
      },
    });
  } catch (error) {
    console.error('Error updating SSO connection:', error);
    return NextResponse.json(
      { error: 'Failed to update SSO connection' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sso/connections - Delete SSO connection
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'settings.manage') && !hasPermission(user, 'settings.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 });
    }

    // Verify connection belongs to tenant
    const existing = await db.sSOConnection.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Delete connection (cascade will delete sessions)
    await db.sSOConnection.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'SSO connection deleted',
    });
  } catch (error) {
    console.error('Error deleting SSO connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete SSO connection' },
      { status: 500 }
    );
  }
}
