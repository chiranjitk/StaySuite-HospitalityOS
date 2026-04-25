/**
 * RADIUS Accounting Simulator (Bun native UDP)
 * Usage: bun run acct-simulate.ts <username> <sessionId> <server> <port> <secret> [action]
 * Actions: start, interim, stop, full (default: full)
 */

import { randomBytes } from "node:crypto";
import {
  PacketType,
  AttributeType,
  AcctStatusType,
  decodePacket,
  encodePacket,
  type RadiusPacket,
} from "./radius-protocol";

function usage() {
  console.log("Usage: bun run acct-simulate.ts <username> <sessionId> <server> <port> <secret> [action]");
  console.log("Actions: start, interim, stop, full (default: full)");
  console.log("Example: bun run acct-simulate.ts teste sess-001 127.0.0.1 1813 testing123 full");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 5) usage();

const [username, sessionId, server, portStr, secret, action = "full"] = args;
const port = parseInt(portStr, 10);

const baseAttrs = [
  { type: AttributeType.USER_NAME, value: username },
  { type: AttributeType.ACCT_SESSION_ID, value: sessionId },
  { type: AttributeType.NAS_IP_ADDRESS, value: "127.0.0.1" },
  { type: AttributeType.NAS_PORT, value: 0 },
  { type: AttributeType.CALLED_STATION_ID, value: "00:11:22:33:44:55" },
  { type: AttributeType.CALLING_STATION_ID, value: "AA:BB:CC:DD:EE:FF" },
  { type: AttributeType.FRAMED_IP_ADDRESS, value: "10.0.0.100" },
  { type: AttributeType.ACCT_AUTHENTIC, value: 1 },
];

function makePacket(statusType: number, extraAttrs: { type: number; value: string | number }[] = []): RadiusPacket {
  return {
    code: PacketType.ACCOUNTING_REQUEST,
    identifier: Math.floor(Math.random() * 256),
    authenticator: Buffer.from(randomBytes(16)),
    attributes: [...baseAttrs, { type: AttributeType.ACCT_STATUS_TYPE, value: statusType }, ...extraAttrs].map((a) => ({ ...a, rawType: `Attr-${a.type}` })),
    secret,
  };
}

async function sendAndWait(client: any, packet: RadiusPacket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout"));
    }, 5000);
    
    const handler = (socket: any, buffer: Buffer) => {
      clearTimeout(timeout);
      try {
        const response = decodePacket(buffer, secret);
        resolve(response.code === PacketType.ACCOUNTING_RESPONSE ? "Accounting-Response" : `Unknown(${response.code})`);
      } catch (e: any) {
        reject(e);
      }
    };
    
    // Temporarily set handler and send
    client.data = handler;
    const encoded = encodePacket(packet, secret);
    client.send(encoded, port, server);
  });
}

// Since Bun UDP data callback is set at creation, use a different approach
// Send packets sequentially using setTimeout
async function run() {
  const client = Bun.udpSocket({
    hostname: "0.0.0.0",
    port: 0,
    data(socket, buffer) {
      try {
        const resp = decodePacket(buffer, secret);
        const typeName = resp.code === PacketType.ACCOUNTING_RESPONSE ? "Accounting-Response" : `Unknown(${resp.code})`;
        // Will be handled by the promise chain below
        (client as any).__lastResolve?.(typeName);
      } catch (e: any) {
        (client as any).__lastReject?.(e);
      }
    },
    error(socket, error) {
      console.error(`Error: ${error.message}`);
    },
  });

  function sendAcct(statusType: number, extraAttrs: { type: number; value: string | number }[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
      (client as any).__lastResolve = (msg: string) => { clearTimeout(timeout); resolve(msg); };
      (client as any).__lastReject = (err: Error) => { clearTimeout(timeout); reject(err); };
      const pkt = makePacket(statusType, extraAttrs);
      const encoded = encodePacket(pkt, secret);
      client.send(encoded, port, server);
    });
  }

  try {
    if (action === "start" || action === "full") {
      console.log(`→ Sending Accounting-Start for "${username}" session="${sessionId}"`);
      const resp = await sendAcct(AcctStatusType.START);
      console.log(`← ${resp}`);
      if (action === "start") { client.close(); process.exit(0); }
    }

    if (action === "interim" || action === "full") {
      await new Promise((r) => setTimeout(r, 300));
      console.log(`→ Sending Interim-Update for "${username}" session="${sessionId}"`);
      const resp = await sendAcct(AcctStatusType.INTERIM_UPDATE, [
        { type: AttributeType.ACCT_SESSION_TIME, value: 300 },
        { type: AttributeType.ACCT_INPUT_OCTETS, value: 52428800 },
        { type: AttributeType.ACCT_OUTPUT_OCTETS, value: 10485760 },
        { type: AttributeType.ACCT_INPUT_PACKETS, value: 34952 },
        { type: AttributeType.ACCT_OUTPUT_PACKETS, value: 6991 },
      ]);
      console.log(`← ${resp}`);
      if (action === "interim") { client.close(); process.exit(0); }
    }

    if (action === "stop" || action === "full") {
      await new Promise((r) => setTimeout(r, 300));
      console.log(`→ Sending Accounting-Stop for "${username}" session="${sessionId}"`);
      const resp = await sendAcct(AcctStatusType.STOP, [
        { type: AttributeType.ACCT_SESSION_TIME, value: 600 },
        { type: AttributeType.ACCT_INPUT_OCTETS, value: 104857600 },
        { type: AttributeType.ACCT_OUTPUT_OCTETS, value: 20971520 },
        { type: AttributeType.ACCT_INPUT_PACKETS, value: 69905 },
        { type: AttributeType.ACCT_OUTPUT_PACKETS, value: 13981 },
        { type: AttributeType.ACCT_TERMINATE_CAUSE, value: 1 },
      ]);
      console.log(`← ${resp}`);
    }

    console.log("\n✅ Full accounting flow completed successfully!");
    console.log(`   Start → Interim-Update → Stop`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  } finally {
    client.close();
    process.exit(0);
  }
}

run();
