/**
 * WiFi Credential Generation Engine
 * 
 * Generates username and password based on configurable format policies.
 * Hotels use many different credential flows depending on their brand,
 * security requirements, and guest experience preferences.
 * 
 * Supported Username Formats:
 *   room_random          → room101_a3f2       (Room + random suffix)
 *   room_only            → 101                (Just room number)
 *   lastname_room        → smith101           (Last name + room)
 *   firstinitial_lastname → jsmith            (First initial + last name)
 *   firstinitial_lastname_room → jsmith101    (First initial + last name + room)
 *   lastname_firstinitial_room → smithj101    (Last name + first initial + room)
 *   mobile               → 9876543210         (Mobile number)
 *   email_prefix         → john.doe           (Email before @)
 *   booking_id           → bk-x7k9m2          (Booking ID prefix)
 *   custom_prefix        → hotel_a3f2         (Custom prefix + random)
 *   passport             → AB1234567          (Passport/ID number)
 *   last4_mobile         → 5432               (Last 4 digits of mobile)
 *   mobile_random        → 9876_a3f2          (Last 4 mobile + random)
 *   lastname_random      → smith_a3f2         (Last name + random)
 * 
 * Supported Password Formats:
 *   random_alphanumeric  → Gx7nPq2k           (Random alpha+numbers)
 *   random_numeric       → 847293             (Random digits only, OTP-style)
 *   room_number          → 101                (Room number)
 *   last4_mobile         → 5432               (Last 4 of mobile)
 *   lastname             → smith              (Guest last name)
 *   lastname_room        → smith101           (Last name + room)
 *   fixed                → welcome123         (Same password for all)
 *   checkin_date         → 15012024           (Check-in date DDMMYYYY)
 *   passport             → AB1234567          (Passport/ID number)
 *   mobile_last4         → 5432               (Last 4 digits of mobile)
 *   firstinitial_lastname → jsmith            (First initial + last name)
 * 
 * DO: Validate format inputs before generation
 * DO: Handle missing guest data gracefully with fallbacks
 * DO: Enforce min/max length constraints
 * DO: Avoid confusing characters (0/O, 1/l/I) in random passwords
 */

import { randomBytes } from 'crypto';

// ─── Type Definitions ────────────────────────────────────────────────

export interface GuestContext {
  firstName?: string | null;
  lastName?: string | null;
  mobile?: string | null;
  email?: string | null;
  passport?: string | null;
  roomNumber?: string | null;
  bookingId?: string | null;
  checkIn?: Date | null;
  checkOut?: Date | null;
}

export interface CredentialPolicy {
  // Username
  usernameFormat: string;
  usernamePrefix?: string | null;
  usernameCase: 'lowercase' | 'uppercase' | 'as_is';
  usernameMinLength: number;
  usernameMaxLength: number;
  // Password
  passwordFormat: string;
  passwordFixedValue?: string | null;
  passwordLength: number;
  passwordIncludeUppercase: boolean;
  passwordIncludeNumbers: boolean;
  passwordIncludeSymbols: boolean;
  // Advanced
  credentialSeparator: string;
  duplicateUsernameAction: 'append_random' | 'reject' | 'overwrite';
}

export interface GeneratedCredentials {
  username: string;
  password: string;
}

// ─── Format Catalog ──────────────────────────────────────────────────

export const USERNAME_FORMATS = [
  {
    value: 'room_random',
    label: 'Room + Random',
    description: 'room101_a3f2',
    example: 'room101_x7k9',
    requiresRoom: true,
  },
  {
    value: 'room_only',
    label: 'Room Number Only',
    description: 'Just the room number',
    example: '101',
    requiresRoom: true,
  },
  {
    value: 'lastname_room',
    label: 'Last Name + Room',
    description: 'Guest surname + room number',
    example: 'smith101',
    requiresName: true,
    requiresRoom: true,
  },
  {
    value: 'firstinitial_lastname',
    label: 'First Initial + Last Name',
    description: 'John Smith → jsmith',
    example: 'jsmith',
    requiresName: true,
  },
  {
    value: 'firstinitial_lastname_room',
    label: 'Initial + Surname + Room',
    description: 'John Smith Room 101 → jsmith101',
    example: 'jsmith101',
    requiresName: true,
    requiresRoom: true,
  },
  {
    value: 'lastname_firstinitial_room',
    label: 'Surname + Initial + Room',
    description: 'John Smith Room 101 → smithj101',
    example: 'smithj101',
    requiresName: true,
    requiresRoom: true,
  },
  {
    value: 'mobile',
    label: 'Mobile Number',
    description: 'Full mobile number as username',
    example: '9876543210',
    requiresMobile: true,
  },
  {
    value: 'last4_mobile',
    label: 'Last 4 Digits of Mobile',
    description: 'Last 4 digits of phone number',
    example: '5432',
    requiresMobile: true,
  },
  {
    value: 'mobile_random',
    label: 'Last 4 Mobile + Random',
    description: 'Last 4 mobile digits + random suffix',
    example: '5432_a3f2',
    requiresMobile: true,
  },
  {
    value: 'email_prefix',
    label: 'Email Prefix',
    description: 'Part before @ in email',
    example: 'john.doe',
    requiresEmail: true,
  },
  {
    value: 'booking_id',
    label: 'Booking ID',
    description: 'Booking ID prefix',
    example: 'bk-x7k9m2',
    requiresBooking: true,
  },
  {
    value: 'custom_prefix',
    label: 'Custom Prefix + Random',
    description: 'Your prefix + random suffix',
    example: 'hotel_a3f2',
    requiresPrefix: true,
  },
  {
    value: 'passport',
    label: 'Passport / ID Number',
    description: 'Guest passport or national ID',
    example: 'AB1234567',
    requiresPassport: true,
  },
  {
    value: 'lastname_random',
    label: 'Last Name + Random',
    description: 'Surname + random suffix',
    example: 'smith_a3f2',
    requiresName: true,
  },
] as const;

export const PASSWORD_FORMATS = [
  {
    value: 'random_alphanumeric',
    label: 'Random Alphanumeric',
    description: '8 random letters & numbers (no confusing chars)',
    example: 'Gx7nPq2k',
  },
  {
    value: 'random_numeric',
    label: 'Random PIN (OTP-style)',
    description: 'Random digits only, easy to type',
    example: '847293',
  },
  {
    value: 'room_number',
    label: 'Room Number',
    description: 'Room number as password',
    example: '101',
    requiresRoom: true,
  },
  {
    value: 'last4_mobile',
    label: 'Last 4 of Mobile',
    description: 'Last 4 digits of phone',
    example: '5432',
    requiresMobile: true,
  },
  {
    value: 'lastname',
    label: 'Last Name',
    description: 'Guest surname as password',
    example: 'smith',
    requiresName: true,
  },
  {
    value: 'lastname_room',
    label: 'Last Name + Room',
    description: 'Surname + room number',
    example: 'smith101',
    requiresName: true,
    requiresRoom: true,
  },
  {
    value: 'fixed',
    label: 'Fixed Password',
    description: 'Same password for all guests',
    example: 'welcome123',
    requiresFixed: true,
  },
  {
    value: 'checkin_date',
    label: 'Check-in Date',
    description: 'Date in DDMMYYYY format',
    example: '15012024',
    requiresCheckIn: true,
  },
  {
    value: 'passport',
    label: 'Passport / ID',
    description: 'Passport or national ID number',
    example: 'AB1234567',
    requiresPassport: true,
  },
  {
    value: 'firstinitial_lastname',
    label: 'Initial + Last Name',
    description: 'John Smith → jsmith',
    example: 'jsmith',
    requiresName: true,
  },
] as const;

// ─── Utility Functions ───────────────────────────────────────────────

/**
 * Generate a random alphanumeric string (no confusing characters)
 */
function randomAlphanumeric(length: number, options?: {
  uppercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}): string {
  let chars = 'abcdefghjkmnpqrstuvwxyz'; // lowercase base (no confusing chars)
  
  if (options?.uppercase !== false) {
    chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  }
  if (options?.numbers !== false) {
    chars += '23456789';
  }
  if (options?.symbols) {
    chars += '@#$%&*!?';
  }

  if (chars.length === 0) chars = 'abcdefghjkmnpqrstuvwxyz23456789';

  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate a random numeric string (digits only)
 */
function randomNumeric(length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String(bytes[i] % 10);
  }
  // Ensure first digit is not 0
  if (result.length > 1 && result[0] === '0') {
    result = String(1 + (parseInt(result, 10) % 9)) + result.slice(1);
  }
  return result;
}

/**
 * Sanitize a string for use in username
 * - Remove spaces and special characters
 * - Keep only alphanumeric and hyphens/dots
 */
function sanitize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, '')
    .replace(/\.+/g, '.')
    .replace(/-+/g, '-');
}

/**
 * Apply case transformation
 */
function applyCase(value: string, casing: 'lowercase' | 'uppercase' | 'as_is'): string {
  switch (casing) {
    case 'lowercase': return value.toLowerCase();
    case 'uppercase': return value.toUpperCase();
    default: return value;
  }
}

/**
 * Enforce length constraints
 * - If too short, pad with random chars
 * - If too long, truncate
 */
function enforceLength(value: string, min: number, max: number): string {
  let result = value;
  if (result.length < min) {
    const padding = randomAlphanumeric(min - result.length, { uppercase: false, numbers: true });
    result = result + padding;
  }
  if (result.length > max) {
    result = result.slice(0, max);
  }
  return result;
}

/**
 * Get last N digits from a string of digits
 */
function lastNDigits(value: string, n: number): string {
  const digits = value.replace(/\D/g, '');
  return digits.slice(-n);
}

// ─── Username Generator ──────────────────────────────────────────────

export function generateUsername(
  policy: CredentialPolicy,
  guest: GuestContext,
  fallbackBookingId?: string,
): string {
  const sep = policy.credentialSeparator === 'none' ? '' : (policy.credentialSeparator ?? '_');
  let username = '';

  switch (policy.usernameFormat) {
    // ── Room-based ──
    case 'room_random': {
      const room = guest.roomNumber || '???';
      username = `room${sep}${room}${sep}${randomAlphanumeric(4)}`;
      break;
    }
    case 'room_only': {
      username = guest.roomNumber || '???';
      break;
    }

    // ── Name-based ──
    case 'lastname_room': {
      const last = sanitize(guest.lastName || 'guest');
      const room = guest.roomNumber || '';
      username = last + (room ? sep + room : '');
      break;
    }
    case 'firstinitial_lastname': {
      const first = sanitize(guest.firstName || 'g');
      const last = sanitize(guest.lastName || 'guest');
      username = first[0] + last;
      break;
    }
    case 'firstinitial_lastname_room': {
      const first = sanitize(guest.firstName || 'g');
      const last = sanitize(guest.lastName || 'guest');
      const room = guest.roomNumber || '';
      username = first[0] + last + (room ? sep + room : '');
      break;
    }
    case 'lastname_firstinitial_room': {
      const last = sanitize(guest.lastName || 'guest');
      const first = sanitize(guest.firstName || 'g');
      const room = guest.roomNumber || '';
      username = last + first[0] + (room ? sep + room : '');
      break;
    }
    case 'lastname_random': {
      const last = sanitize(guest.lastName || 'guest');
      username = last + sep + randomAlphanumeric(4);
      break;
    }

    // ── Mobile-based ──
    case 'mobile': {
      username = (guest.mobile || '').replace(/\D/g, '');
      break;
    }
    case 'last4_mobile': {
      username = lastNDigits(guest.mobile || '', 4);
      break;
    }
    case 'mobile_random': {
      const mobile = lastNDigits(guest.mobile || '', 4);
      username = mobile + sep + randomAlphanumeric(4);
      break;
    }

    // ── Email-based ──
    case 'email_prefix': {
      const email = guest.email || '';
      username = sanitize(email.split('@')[0] || 'guest');
      break;
    }

    // ── Booking-based ──
    case 'booking_id': {
      const id = (guest.bookingId || fallbackBookingId || '').replace(/[^a-zA-Z0-9]/g, '');
      username = 'bk' + sep + id.slice(-8);
      break;
    }

    // ── Custom prefix ──
    case 'custom_prefix': {
      const prefix = sanitize(policy.usernamePrefix || 'guest');
      username = prefix + sep + randomAlphanumeric(4);
      break;
    }

    // ── Passport ──
    case 'passport': {
      username = sanitize(guest.passport || 'id' + randomAlphanumeric(4));
      break;
    }

    // ── Fallback: room_random (original behavior) ──
    default: {
      const room = guest.roomNumber || '???';
      username = `room${room}${sep}${randomAlphanumeric(4)}`;
      break;
    }
  }

  // Apply case transformation
  username = applyCase(username, policy.usernameCase);

  // Enforce length constraints
  username = enforceLength(username, policy.usernameMinLength, policy.usernameMaxLength);

  return username;
}

// ─── Password Generator ──────────────────────────────────────────────

export function generatePassword(
  policy: CredentialPolicy,
  guest: GuestContext,
): string {
  const sep = policy.credentialSeparator === 'none' ? '' : (policy.credentialSeparator ?? '_');
  let password = '';

  switch (policy.passwordFormat) {
    // ── Random formats ──
    case 'random_alphanumeric': {
      password = randomAlphanumeric(policy.passwordLength, {
        uppercase: policy.passwordIncludeUppercase,
        numbers: policy.passwordIncludeNumbers,
        symbols: policy.passwordIncludeSymbols,
      });
      break;
    }
    case 'random_numeric': {
      password = randomNumeric(Math.max(4, policy.passwordLength));
      break;
    }

    // ── Guest data-based ──
    case 'room_number': {
      password = guest.roomNumber || randomNumeric(4);
      break;
    }
    case 'last4_mobile': {
      const digits = lastNDigits(guest.mobile || '', 4);
      password = digits || randomNumeric(4);
      break;
    }
    case 'lastname': {
      password = sanitize(guest.lastName || 'guest');
      break;
    }
    case 'lastname_room': {
      const last = sanitize(guest.lastName || 'guest');
      const room = guest.roomNumber || '';
      password = last + (room ? sep + room : '');
      break;
    }
    case 'firstinitial_lastname': {
      const first = sanitize(guest.firstName || 'g');
      const last = sanitize(guest.lastName || 'guest');
      password = first[0] + last;
      break;
    }
    case 'checkin_date': {
      if (guest.checkIn) {
        const d = guest.checkIn;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        password = `${dd}${mm}${yyyy}`;
      } else {
        password = randomNumeric(8);
      }
      break;
    }
    case 'passport': {
      password = sanitize(guest.passport || 'id' + randomAlphanumeric(4));
      break;
    }

    // ── Fixed password ──
    case 'fixed': {
      password = policy.passwordFixedValue || 'welcome';
      break;
    }

    // ── Fallback: random_alphanumeric (original behavior) ──
    default: {
      password = randomAlphanumeric(policy.passwordLength, {
        uppercase: policy.passwordIncludeUppercase,
        numbers: policy.passwordIncludeNumbers,
        symbols: policy.passwordIncludeSymbols,
      });
      break;
    }
  }

  // Ensure password is never empty
  if (!password || password.length === 0) {
    password = randomAlphanumeric(8);
  }

  return password;
}

// ─── Main Generator ──────────────────────────────────────────────────

/**
 * Generate both username and password based on the credential policy
 */
export function generateCredentials(
  policy: CredentialPolicy,
  guest: GuestContext,
  fallbackBookingId?: string,
): GeneratedCredentials {
  const username = generateUsername(policy, guest, fallbackBookingId);
  const password = generatePassword(policy, guest);
  return { username, password };
}

/**
 * Generate a preview of credentials (for the settings UI)
 * Shows what the credentials would look like with sample data
 */
export function generatePreview(
  policy: CredentialPolicy,
): { usernamePreview: string; passwordPreview: string } {
  const sampleGuest: GuestContext = {
    firstName: 'John',
    lastName: 'Smith',
    mobile: '9876543210',
    email: 'john.smith@email.com',
    passport: 'AB1234567',
    roomNumber: '101',
    bookingId: 'booking-x7k9m2p3',
    checkIn: new Date(2024, 0, 15), // Jan 15, 2024
    checkOut: new Date(2024, 0, 17),
  };

  const { username, password } = generateCredentials(policy, sampleGuest);
  return { usernamePreview: username, passwordPreview: password };
}

/**
 * Get the default credential policy
 */
export function getDefaultCredentialPolicy(): CredentialPolicy {
  return {
    usernameFormat: 'room_random',
    usernamePrefix: 'guest',
    usernameCase: 'lowercase',
    usernameMinLength: 4,
    usernameMaxLength: 32,
    passwordFormat: 'random_alphanumeric',
    passwordFixedValue: null,
    passwordLength: 8,
    passwordIncludeUppercase: true,
    passwordIncludeNumbers: true,
    passwordIncludeSymbols: false,
    credentialSeparator: '_',  // options: '_', '-', '.', 'none'
    duplicateUsernameAction: 'append_random',
  };
}
