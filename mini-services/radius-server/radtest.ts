/**
 * radtest equivalent (Bun native UDP)
 * Usage: bun run radtest.ts <username> <password> <server> <port> <secret>
 */

import { randomBytes } from "node:crypto";
import {
  PacketType,
  AttributeType,
  decodePacket,
  encodePacket,
  encryptPassword,
  getAttributeString,
  VENDOR_WISPR,
  VENDOR_CHILLISPOT,
  type RadiusPacket,
} from "./radius-protocol";

function usage() {
  console.log("Usage: bun run radtest.ts <username> <password> <server> <port> <secret>");
  console.log("Example: bun run radtest.ts teste 123456 127.0.0.1 1812 testing123");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 5) usage();

const [username, password, server, portStr, secret] = args;
const port = parseInt(portStr, 10);

console.log(`Sending Access-Request to ${server}:${port}`);
console.log(`User-Name = "${username}"`);
console.log(`User-Password = "${password}"`);
console.log(`Shared Secret = "${secret}"`);
console.log("---");

const packet: RadiusPacket = {
  code: PacketType.ACCESS_REQUEST,
  identifier: Math.floor(Math.random() * 256),
  authenticator: Buffer.from(randomBytes(16)),
  attributes: [
    { type: AttributeType.USER_NAME, value: username, rawType: "User-Name" },
    { type: AttributeType.USER_PASSWORD, value: encryptPassword(password, secret, Buffer.alloc(16)), rawType: "User-Password" },
    { type: AttributeType.NAS_IP_ADDRESS, value: "127.0.0.1", rawType: "NAS-IP-Address" },
    { type: AttributeType.NAS_PORT, value: 0, rawType: "NAS-Port" },
    { type: AttributeType.CALLED_STATION_ID, value: "00:11:22:33:44:55", rawType: "Called-Station-Id" },
  ],
  secret,
};

const encoded = encodePacket(packet, secret);

// Bun UDP client with data callback
let responded = false;
const client = Bun.udpSocket({
  hostname: "0.0.0.0",
  port: 0,
  data(socket, buffer) {
    if (responded) return;
    responded = true;
    try {
      const response = decodePacket(buffer, secret);
      const typeName = response.code === PacketType.ACCESS_ACCEPT ? "Access-Accept" :
                       response.code === PacketType.ACCESS_REJECT ? "Access-Reject" :
                       response.code === PacketType.ACCESS_CHALLENGE ? "Access-Challenge" :
                       `Unknown(${response.code})`;

      console.log(`\nReceived: ${typeName}`);
      console.log(`ID: ${response.identifier}`);

      if (response.code === PacketType.ACCESS_ACCEPT) {
        console.log("\nReply Attributes:");
        for (const attr of response.attributes) {
          const name = attr.rawType || `Attr-${attr.type}`;
          if (attr.vendor) {
            const vendorName = attr.vendor === VENDOR_WISPR ? "WISPr" : attr.vendor === VENDOR_CHILLISPOT ? "ChilliSpot" : `Vendor-${attr.vendor}`;
            const val = typeof attr.value === "number" ? formatBandwidth(attr.value) : attr.value;
            console.log(`  ${vendorName}#${attr.vendorType} ${name} = ${val}`);
          } else {
            const val = typeof attr.value === "number" ?
              (attr.type === AttributeType.SESSION_TIMEOUT ? formatDuration(attr.value) : attr.value) :
              attr.value;
            console.log(`  ${name} = ${val}`);
          }
        }
        console.log("\n✅ Authentication successful!");
      } else {
        console.log("\n❌ Authentication rejected!");
        const replyMsg = getAttributeString(response, AttributeType.REPLY_MESSAGE);
        if (replyMsg) console.log(`Reply-Message: ${replyMsg}`);
      }
    } catch (err: any) {
      console.error(`Error decoding response: ${err.message}`);
    }
    socket.close();
    setTimeout(() => process.exit(0), 100);
  },
  error(socket, error) {
    console.error(`Socket error: ${error.message}`);
    socket.close();
    process.exit(1);
  },
});

client.send(encoded, port, server);

// Timeout
setTimeout(() => {
  if (!responded) {
    console.error("Timeout waiting for response (5s)");
    client.close();
    process.exit(1);
  }
}, 5000);

function formatBandwidth(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
