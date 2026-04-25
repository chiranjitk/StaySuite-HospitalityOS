/**
 * Pure TypeScript RADIUS Protocol Implementation
 * RFC 2865 (Authentication), RFC 2866 (Accounting), RFC 5176 (CoA/Disconnect)
 * 
 * Supports:
 * - Access-Request, Access-Accept, Access-Reject, Access-Challenge
 * - Accounting-Request (Start, Interim-Update, Stop)
 * - CoA-Request, CoA-ACK, CoA-NAK, Disconnect-Request, Disconnect-ACK, Disconnect-NAK
 */

import { createHash, randomBytes, createHmac } from "node:crypto";

// ── Packet Types ──────────────────────────────────────────────
export const PacketType = {
  ACCESS_REQUEST: 1,
  ACCESS_ACCEPT: 2,
  ACCESS_REJECT: 3,
  ACCOUNTING_REQUEST: 4,
  ACCOUNTING_RESPONSE: 5,
  ACCESS_CHALLENGE: 11,
  COA_REQUEST: 40,
  COA_ACK: 41,
  COA_NAK: 42,
  DISCONNECT_REQUEST: 43,
  DISCONNECT_ACK: 44,
  DISCONNECT_NAK: 45,
} as const;

export type PacketTypeValue = (typeof PacketType)[keyof typeof PacketType];

// ── Attribute Types (common subset) ───────────────────────────
export const AttributeType = {
  // RFC 2865
  USER_NAME: 1,
  USER_PASSWORD: 2,
  CHAP_PASSWORD: 3,
  NAS_IP_ADDRESS: 4,
  NAS_PORT: 5,
  SERVICE_TYPE: 6,
  FRAMED_PROTOCOL: 7,
  FRAMED_IP_ADDRESS: 8,
  FRAMED_IP_NETMASK: 9,
  FRAMED_MTU: 12,
  FRAMED_COMPRESSION: 13,
  LOGIN_IP_HOST: 14,
  REPLY_MESSAGE: 18,
  CALLBACK_NUMBER: 19,
  CALLBACK_ID: 20,
  FRAMED_ROUTE: 22,
  STATE: 24,
  CLASS: 25,
  SESSION_TIMEOUT: 27,
  IDLE_TIMEOUT: 28,
  TERMINATION_ACTION: 29,
  CALLED_STATION_ID: 30,
  CALLING_STATION_ID: 31,
  NAS_IDENTIFIER: 32,
  NAS_PORT_TYPE: 61,
  PORT_LIMIT: 62,
  LOGIN_LAT_PORT: 63,
  // RFC 2866
  ACCT_STATUS_TYPE: 40,
  ACCT_DELAY_TIME: 41,
  ACCT_INPUT_OCTETS: 42,
  ACCT_OUTPUT_OCTETS: 43,
  ACCT_SESSION_ID: 44,
  ACCT_AUTHENTIC: 45,
  ACCT_SESSION_TIME: 46,
  ACCT_INPUT_PACKETS: 47,
  ACCT_OUTPUT_PACKETS: 48,
  ACCT_TERMINATE_CAUSE: 49,
  ACCT_MULTI_SESSION_ID: 50,
  ACCT_LINK_COUNT: 51,
  // RFC 2869
  NAS_PORT_ID: 87,
  NAS_IPV6_ADDRESS: 95,
  FRAMED_INTERFACE_ID: 96,
  FRAMED_IPV6_PREFIX: 97,
  DELEGATED_IPV6_PREFIX: 98,
  // Vendor-Specific
  VENDOR_SPECIFIC: 26,
} as const;

export const AcctStatusType = {
  START: 1,
  INTERIM_UPDATE: 3,
  STOP: 2,
  ACCOUNTING_ON: 7,
  ACCOUNTING_OFF: 8,
} as const;

export const TerminateCause = {
  USER_REQUEST: 1,
  LOST_CARRIER: 2,
  LOST_SERVICE: 3,
  IDLE_TIMEOUT: 4,
  SESSION_TIMEOUT: 5,
  ADMIN_RESET: 6,
  ADMIN_REBOOT: 7,
  PORT_ERROR: 8,
  NAS_ERROR: 9,
  NAS_REQUEST: 10,
  NAS_REBOOT: 11,
  PORT_UNNEEDED: 12,
  PORT_PREEMPTED: 13,
  PORT_SUSPENDED: 14,
  SERVICE_UNAVAILABLE: 15,
  CALLBACK: 16,
  USER_ERROR: 17,
  HOST_REQUEST: 18,
} as const;

// ── Vendor-Specific Constants ─────────────────────────────────
export const VENDOR_WISPR = 14122;
export const VENDOR_CHILLISPOT = 14559;

const WISPR_ATTRS: Record<number, string> = {
  1: "WISPr-Bandwidth-Max-Down",
  2: "WISPr-Bandwidth-Max-Up",
  3: "WISPr-Session-Terminate-Time",
  4: "WISPr-Session-Terminate-End-Of-Day",
  5: "WISPr-Billing-Class",
  6: "WISPr-Redirection-URL",
  7: "WISPr-Redirection-URL-Address",
  8: "WISPr-Redirection-URL-Port",
  9: "WISPr-Redirection-URL-QoS",
  10: "WISPr-Redirection-URL-Original-URL",
  11: "WISPr-Location-ID",
  12: "WISPr-Location-Name",
  13: "WISPr-Logoff-URL",
};

const CHILLISPOT_ATTRS: Record<number, string> = {
  1: "ChilliSpot-Bandwidth-Max-Down",
  2: "ChilliSpot-Bandwidth-Max-Up",
  3: "ChilliSpot-Max-Input-Octets",
  4: "ChilliSpot-Max-Output-Octets",
  5: "ChilliSpot-Max-Total-Octets",
  6: "ChilliSpot-Max-Input-Gigawords",
  7: "ChilliSpot-Max-Output-Gigawords",
  8: "ChilliSpot-Max-Total-Gigawords",
  9: "ChilliSpot-Interval",
  10: "ChilliSpot-First-Max-Octets",
  11: "ChilliSpot-First-Max-Gigawords",
  12: "ChilliSpot-First-Timeout",
  13: "ChilliSpot-Max-Octets",
  14: "ChilliSpot-Max-Gigawords",
  15: "ChilliSpot-Timeout",
};

// ── Packet Structure ──────────────────────────────────────────
export interface RadiusPacket {
  code: PacketTypeValue;
  identifier: number;
  authenticator: Buffer; // 16 bytes Request Authenticator (for Access-Request) or Response Authenticator
  attributes: RadiusAttribute[];
  secret?: string;
  raw?: Buffer;
}

export interface RadiusAttribute {
  type: number;
  vendor?: number;       // For vendor-specific attributes
  vendorType?: number;   // Sub-type within vendor
  value: string | number | Buffer;
  rawType?: string;      // Human-readable name (e.g., "User-Name")
}

// ── Encoding/Decoding ─────────────────────────────────────────

/**
 * Encode a string value for RADIUS (padded to multiple of 4 if needed for some attrs)
 */
function encodeString(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function decodeString(buf: Buffer): string {
  return buf.toString("utf8");
}

function encodeInteger(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

function decodeInteger(buf: Buffer): number {
  if (buf.length === 4) return buf.readUInt32BE();
  if (buf.length === 2) return buf.readUInt16BE();
  if (buf.length === 1) return buf.readUInt8();
  return 0;
}

function encodeIp(value: string): Buffer {
  const parts = value.split(".").map(Number);
  const buf = Buffer.alloc(4);
  parts.forEach((p, i) => buf[i] = p);
  return buf;
}

function decodeIp(buf: Buffer): string {
  if (buf.length !== 4) return "";
  return Array.from(buf).join(".");
}

/**
 * Encode a RADIUS attribute
 */
function encodeAttribute(attr: RadiusAttribute): Buffer {
  if (attr.vendor !== undefined) {
    // Vendor-Specific Attribute (type 26)
    const vendorId = Buffer.alloc(4);
    vendorId.writeUInt32BE(attr.vendor);
    const vendorTypeBuf = Buffer.alloc(1);
    vendorTypeBuf[0] = attr.vendorType!;
    
    let valueBuf: Buffer;
    if (typeof attr.value === "string") {
      valueBuf = encodeString(attr.value);
    } else if (typeof attr.value === "number") {
      valueBuf = encodeInteger(attr.value);
    } else {
      valueBuf = attr.value;
    }
    
    // Vendor-specific value: type(1) + length(1) + value
    const vendorAttrLen = 2 + valueBuf.length;
    const vendorAttr = Buffer.alloc(vendorAttrLen);
    vendorAttr[0] = attr.vendorType!;
    vendorAttr[1] = vendorAttrLen;
    valueBuf.copy(vendorAttr, 2);
    
    // VSA: type(1) + length(1) + vendor-id(4) + vendor-attr
    const totalLen = 2 + 4 + vendorAttrLen;
    const result = Buffer.alloc(totalLen);
    result[0] = AttributeType.VENDOR_SPECIFIC;
    result[1] = totalLen;
    vendorId.copy(result, 2);
    vendorAttr.copy(result, 6);
    
    return result;
  }
  
  const type = attr.type;
  let valueBuf: Buffer;
  
  if (typeof attr.value === "string") {
    valueBuf = encodeString(attr.value);
  } else if (typeof attr.value === "number") {
    // Determine encoding based on attribute type
    if (type === AttributeType.NAS_IP_ADDRESS || type === AttributeType.FRAMED_IP_ADDRESS) {
      valueBuf = encodeIp(attr.value.toString());
    } else {
      valueBuf = encodeInteger(attr.value);
    }
  } else {
    valueBuf = attr.value;
  }
  
  // Standard attribute: type(1) + length(1) + value
  const totalLen = 2 + valueBuf.length;
  const result = Buffer.alloc(totalLen);
  result[0] = type;
  result[1] = totalLen;
  valueBuf.copy(result, 2);
  
  return result;
}

/**
 * Decode a RADIUS attribute from buffer at given offset
 * Returns { attribute, totalBytesConsumed }
 */
function decodeAttribute(buf: Buffer, offset: number): { attr: RadiusAttribute; consumed: number } {
  const type = buf[offset];
  const length = buf[offset + 1];
  const valueBuf = buf.subarray(offset + 2, offset + length);
  
  if (type === AttributeType.VENDOR_SPECIFIC && valueBuf.length >= 4) {
    const vendorId = valueBuf.readUInt32BE(0);
    const vendorData = valueBuf.subarray(4);
    
    if (vendorData.length >= 2) {
      const vendorType = vendorData[0];
      const vendorLen = vendorData[1];
      const vendorValue = vendorData.subarray(2, vendorLen);
      
      let rawType = `Vendor-${vendorId}-${vendorType}`;
      if (vendorId === VENDOR_WISPR && WISPR_ATTRS[vendorType]) {
        rawType = WISPR_ATTRS[vendorType];
      } else if (vendorId === VENDOR_CHILLISPOT && CHILLISPOT_ATTRS[vendorType]) {
        rawType = CHILLISPOT_ATTRS[vendorType];
      }
      
      // Try to decode vendor value
      let decodedValue: string | number | Buffer;
      if ([VENDOR_WISPR, VENDOR_CHILLISPOT].includes(vendorId)) {
        // WISPr and ChilliSpot use string values
        decodedValue = decodeString(vendorValue);
      } else {
        decodedValue = vendorValue;
      }
      
      return {
        attr: {
          type,
          vendor: vendorId,
          vendorType,
          value: decodedValue,
          rawType,
        },
        consumed: length,
      };
    }
  }
  
  let rawType = getAttributeName(type);
  let decodedValue: string | number | Buffer;
  
  switch (type) {
    case AttributeType.USER_PASSWORD:
      decodedValue = valueBuf; // Decrypted later
      rawType = "User-Password";
      break;
    case AttributeType.NAS_IP_ADDRESS:
    case AttributeType.FRAMED_IP_ADDRESS:
      decodedValue = decodeIp(valueBuf);
      rawType = type === AttributeType.NAS_IP_ADDRESS ? "NAS-IP-Address" : "Framed-IP-Address";
      break;
    case AttributeType.SERVICE_TYPE:
    case AttributeType.SESSION_TIMEOUT:
    case AttributeType.IDLE_TIMEOUT:
    case AttributeType.ACCT_STATUS_TYPE:
    case AttributeType.ACCT_DELAY_TIME:
    case AttributeType.ACCT_INPUT_OCTETS:
    case AttributeType.ACCT_OUTPUT_OCTETS:
    case AttributeType.ACCT_SESSION_TIME:
    case AttributeType.ACCT_INPUT_PACKETS:
    case AttributeType.ACCT_OUTPUT_PACKETS:
    case AttributeType.ACCT_TERMINATE_CAUSE:
    case AttributeType.NAS_PORT:
    case AttributeType.PORT_LIMIT:
      decodedValue = decodeInteger(valueBuf);
      break;
    case AttributeType.CHAP_PASSWORD:
      decodedValue = valueBuf;
      rawType = "CHAP-Password";
      break;
    default:
      if (valueBuf.length > 0 && looksLikePrintable(valueBuf)) {
        decodedValue = decodeString(valueBuf);
      } else if (valueBuf.length === 4) {
        decodedValue = decodeInteger(valueBuf);
      } else {
        decodedValue = valueBuf;
      }
      break;
  }
  
  return {
    attr: {
      type,
      value: decodedValue,
      rawType: rawType || `Attr-${type}`,
    },
    consumed: length,
  };
}

function looksLikePrintable(buf: Buffer): boolean {
  let printable = 0;
  for (let i = 0; i < buf.length && i < 20; i++) {
    const c = buf[i];
    if ((c >= 32 && c < 127) || c === 0) printable++;
  }
  return printable / Math.min(buf.length, 20) > 0.7;
}

function getAttributeName(type: number): string {
  const names: Record<number, string> = {
    [AttributeType.USER_NAME]: "User-Name",
    [AttributeType.USER_PASSWORD]: "User-Password",
    [AttributeType.CHAP_PASSWORD]: "CHAP-Password",
    [AttributeType.NAS_IP_ADDRESS]: "NAS-IP-Address",
    [AttributeType.NAS_PORT]: "NAS-Port",
    [AttributeType.SERVICE_TYPE]: "Service-Type",
    [AttributeType.FRAMED_PROTOCOL]: "Framed-Protocol",
    [AttributeType.FRAMED_IP_ADDRESS]: "Framed-IP-Address",
    [AttributeType.FRAMED_IP_NETMASK]: "Framed-IP-Netmask",
    [AttributeType.REPLY_MESSAGE]: "Reply-Message",
    [AttributeType.STATE]: "State",
    [AttributeType.CLASS]: "Class",
    [AttributeType.SESSION_TIMEOUT]: "Session-Timeout",
    [AttributeType.IDLE_TIMEOUT]: "Idle-Timeout",
    [AttributeType.TERMINATION_ACTION]: "Termination-Action",
    [AttributeType.CALLED_STATION_ID]: "Called-Station-Id",
    [AttributeType.CALLING_STATION_ID]: "Calling-Station-Id",
    [AttributeType.NAS_IDENTIFIER]: "NAS-Identifier",
    [AttributeType.NAS_PORT_TYPE]: "NAS-Port-Type",
    [AttributeType.PORT_LIMIT]: "Port-Limit",
    [AttributeType.ACCT_STATUS_TYPE]: "Acct-Status-Type",
    [AttributeType.ACCT_DELAY_TIME]: "Acct-Delay-Time",
    [AttributeType.ACCT_INPUT_OCTETS]: "Acct-Input-Octets",
    [AttributeType.ACCT_OUTPUT_OCTETS]: "Acct-Output-Octets",
    [AttributeType.ACCT_SESSION_ID]: "Acct-Session-Id",
    [AttributeType.ACCT_AUTHENTIC]: "Acct-Authentic",
    [AttributeType.ACCT_SESSION_TIME]: "Acct-Session-Time",
    [AttributeType.ACCT_INPUT_PACKETS]: "Acct-Input-Packets",
    [AttributeType.ACCT_OUTPUT_PACKETS]: "Acct-Output-Packets",
    [AttributeType.ACCT_TERMINATE_CAUSE]: "Acct-Terminate-Cause",
    [AttributeType.ACCT_MULTI_SESSION_ID]: "Acct-Multi-Session-Id",
    [AttributeType.ACCT_LINK_COUNT]: "Acct-Link-Count",
    [AttributeType.NAS_PORT_ID]: "NAS-Port-Id",
    [AttributeType.NAS_IPV6_ADDRESS]: "NAS-IPv6-Address",
    [AttributeType.VENDOR_SPECIFIC]: "Vendor-Specific",
  };
  return names[type] || `Unknown-${type}`;
}

// ── Password Encryption/Decryption (RFC 2865 Section 5.2) ─────

export function encryptPassword(password: string, secret: string, requestAuth: Buffer): Buffer {
  const pwdBuf = Buffer.from(password, "utf8");
  
  // Pad to multiple of 16
  const padLen = (16 - (pwdBuf.length % 16)) % 16;
  const padded = Buffer.alloc(pwdBuf.length + padLen);
  pwdBuf.copy(padded);
  
  const result = Buffer.alloc(padded.length);
  let prev = Buffer.from(requestAuth);
  
  for (let i = 0; i < padded.length; i += 16) {
    const hash = createHash("md5").update(secret).update(prev).digest();
    for (let j = 0; j < 16 && (i + j) < padded.length; j++) {
      result[i + j] = padded[i + j] ^ hash[j];
    }
    prev = Buffer.from(result.subarray(i, i + 16));
  }
  
  return result;
}

export function decryptPassword(encrypted: Buffer, secret: string, requestAuth: Buffer): string {
  const result = Buffer.alloc(encrypted.length);
  let prev = Buffer.from(requestAuth);
  
  for (let i = 0; i < encrypted.length; i += 16) {
    const hash = createHash("md5").update(secret).update(prev).digest();
    const chunk = encrypted.subarray(i, Math.min(i + 16, encrypted.length));
    for (let j = 0; j < chunk.length; j++) {
      result[i + j] = chunk[j] ^ hash[j];
    }
    prev = Buffer.from(encrypted.subarray(i, Math.min(i + 16, encrypted.length)));
  }
  
  // Remove null padding
  let end = result.length;
  while (end > 0 && result[end - 1] === 0) end--;
  
  return result.subarray(0, end).toString("utf8");
}

// ── Packet Encoding/Decoding ──────────────────────────────────

/**
 * Encode a complete RADIUS packet
 */
export function encodePacket(packet: RadiusPacket, secret: string): Buffer {
  // Encode all attributes
  const attrBufs = packet.attributes.map(encodeAttribute);
  const totalAttrLen = attrBufs.reduce((sum, b) => sum + b.length, 0);
  
  // Header: code(1) + identifier(1) + length(2) + authenticator(16) + attributes
  const totalLen = 20 + totalAttrLen;
  const result = Buffer.alloc(totalLen);
  
  result[0] = packet.code;
  result[1] = packet.identifier;
  result.writeUInt16BE(totalLen, 2);
  
  // Copy authenticator
  if (packet.code === PacketType.ACCESS_REQUEST) {
    // Request Authenticator = random 16 bytes
    const reqAuth = packet.authenticator.length === 16 ? packet.authenticator : randomBytes(16);
    reqAuth.copy(result, 4);
  } else {
    // Response Authenticator = MD5(Code + ID + Length + RequestAuth + Attributes + Secret)
    // We'll fill this after copying attributes
    packet.authenticator.copy(result, 4);
  }
  
  // Copy attributes
  let offset = 20;
  for (const buf of attrBufs) {
    buf.copy(result, offset);
    offset += buf.length;
  }
  
  // For non-Access-Request, calculate Response Authenticator
  if (packet.code !== PacketType.ACCESS_REQUEST) {
    const responseAuth = createHash("md5")
      .update(Buffer.from([packet.code, packet.identifier]))
      .update(result.subarray(2, 4)) // Length
      .update(packet.authenticator) // Request Authenticator
      .update(result.subarray(20)) // Attributes
      .update(secret)
      .digest();
    responseAuth.copy(result, 4);
  }
  
  packet.raw = result;
  return result;
}

/**
 * Decode a RADIUS packet from a UDP datagram
 */
export function decodePacket(data: Buffer, secret?: string): RadiusPacket {
  if (data.length < 20) {
    throw new Error(`RADIUS packet too short: ${data.length} bytes (minimum 20)`);
  }
  
  const code = data[0];
  const identifier = data[1];
  const length = data.readUInt16BE(2);
  
  if (length > data.length) {
    throw new Error(`RADIUS packet length ${length} exceeds buffer size ${data.length}`);
  }
  
  const authenticator = Buffer.from(data.subarray(4, 20));
  const attributes: RadiusAttribute[] = [];
  
  let offset = 20;
  while (offset < length) {
    const attrLen = data[offset + 1];
    if (attrLen < 2 || offset + attrLen > length) {
      break;
    }
    
    const { attr } = decodeAttribute(data, offset);
    attributes.push(attr);
    offset += attrLen;
  }
  
  // Decrypt User-Password if present
  if (secret && code === PacketType.ACCESS_REQUEST) {
    for (const attr of attributes) {
      if (attr.type === AttributeType.USER_PASSWORD && Buffer.isBuffer(attr.value)) {
        attr.value = decryptPassword(attr.value, secret, authenticator);
      }
    }
  }
  
  return {
    code,
    identifier,
    authenticator,
    attributes,
    secret,
    raw: data.subarray(0, length),
  };
}

// ── Helper Functions ──────────────────────────────────────────

export function getAttribute(packet: RadiusPacket, type: number): RadiusAttribute | undefined {
  return packet.attributes.find((a) => a.type === type);
}

export function getAttributeString(packet: RadiusPacket, type: number): string {
  const attr = getAttribute(packet, type);
  if (!attr) return "";
  return typeof attr.value === "string" ? attr.value : String(attr.value);
}

export function getAttributeNumber(packet: RadiusPacket, type: number): number {
  const attr = getAttribute(packet, type);
  if (!attr) return 0;
  return typeof attr.value === "number" ? attr.value : parseInt(String(attr.value), 10) || 0;
}

export function getVendorAttribute(packet: RadiusPacket, vendorId: number, vendorType: number): RadiusAttribute | undefined {
  return packet.attributes.find((a) => a.vendor === vendorId && a.vendorType === vendorType);
}

export function getAllVendorAttributes(packet: RadiusPacket, vendorId: number): RadiusAttribute[] {
  return packet.attributes.filter((a) => a.vendor === vendorId);
}

export function getFirstVendorValue(packet: RadiusPacket, vendorId: number, vendorType: number): string {
  const attr = getVendorAttribute(packet, vendorId, vendorType);
  if (!attr) return "";
  return typeof attr.value === "string" ? attr.value : String(attr.value);
}

/**
 * Create a response packet with copied identifier and request authenticator
 */
export function createResponse(
  requestPacket: RadiusPacket,
  responseType: PacketTypeValue,
  attributes: RadiusAttribute[] = [],
  secret: string
): RadiusPacket {
  return {
    code: responseType,
    identifier: requestPacket.identifier,
    authenticator: Buffer.from(requestPacket.authenticator),
    attributes,
    secret,
  };
}

/**
 * Create a CoA or Disconnect packet
 */
export function createCoaPacket(
  secret: string,
  attributes: RadiusAttribute[],
  isDisconnect = false
): RadiusPacket {
  return {
    code: isDisconnect ? PacketType.DISCONNECT_REQUEST : PacketType.COA_REQUEST,
    identifier: Math.floor(Math.random() * 256),
    authenticator: randomBytes(16),
    attributes,
    secret,
  };
}

// Packet type names for logging
export const PacketTypeName: Record<number, string> = {
  [PacketType.ACCESS_REQUEST]: "Access-Request",
  [PacketType.ACCESS_ACCEPT]: "Access-Accept",
  [PacketType.ACCESS_REJECT]: "Access-Reject",
  [PacketType.ACCOUNTING_REQUEST]: "Accounting-Request",
  [PacketType.ACCOUNTING_RESPONSE]: "Accounting-Response",
  [PacketType.ACCESS_CHALLENGE]: "Access-Challenge",
  [PacketType.COA_REQUEST]: "CoA-Request",
  [PacketType.COA_ACK]: "CoA-ACK",
  [PacketType.COA_NAK]: "CoA-NAK",
  [PacketType.DISCONNECT_REQUEST]: "Disconnect-Request",
  [PacketType.DISCONNECT_ACK]: "Disconnect-ACK",
  [PacketType.DISCONNECT_NAK]: "Disconnect-NAK",
};

export const AcctStatusTypeName: Record<number, string> = {
  [AcctStatusType.START]: "Start",
  [AcctStatusType.INTERIM_UPDATE]: "Interim-Update",
  [AcctStatusType.STOP]: "Stop",
  [AcctStatusType.ACCOUNTING_ON]: "Accounting-On",
  [AcctStatusType.ACCOUNTING_OFF]: "Accounting-Off",
};

export function makeAttr(type: number, value: string | number): RadiusAttribute {
  return { type, value, rawType: getAttributeName(type) };
}

export function makeVendorAttr(vendor: number, vendorType: number, value: string | number): RadiusAttribute {
  let rawType = `Vendor-${vendor}-${vendorType}`;
  if (vendor === VENDOR_WISPR) rawType = WISPR_ATTRS[vendorType] || rawType;
  if (vendor === VENDOR_CHILLISPOT) rawType = CHILLISPOT_ATTRS[vendorType] || rawType;
  return { type: AttributeType.VENDOR_SPECIFIC, vendor, vendorType, value, rawType };
}

export function packetSummary(packet: RadiusPacket): string {
  const typeName = PacketTypeName[packet.code] || `Unknown(${packet.code})`;
  const userName = getAttributeString(packet, AttributeType.USER_NAME);
  const sessionId = getAttributeString(packet, AttributeType.ACCT_SESSION_ID);
  
  let summary = `[${typeName}] ID=${packet.identifier}`;
  if (userName) summary += ` User="${userName}"`;
  if (sessionId) summary += ` Session="${sessionId}"`;
  
  const acctStatus = getAttributeNumber(packet, AttributeType.ACCT_STATUS_TYPE);
  if (acctStatus && AcctStatusTypeName[acctStatus]) {
    summary += ` Status=${AcctStatusTypeName[acctStatus]}`;
  }
  
  return summary;
}
