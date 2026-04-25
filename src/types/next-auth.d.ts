import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
      roleId: string | null;
      roleName: string;
      permissions: string[];
      tenantId: string;
      tenant: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        status: string;
      };
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    roleId: string | null;
    roleName: string;
    permissions: string[];
    tenantId: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
      plan: string;
      status: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    roleId: string | null;
    roleName: string;
    permissions: string[];
    tenantId: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
      plan: string;
      status: string;
    };
  }
}
