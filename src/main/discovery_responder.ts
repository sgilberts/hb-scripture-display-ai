import dgram from "node:dgram";
import os from "node:os";
import {
  CONTROL_PORT,
  DISCOVERY_ANNOUNCEMENT_TYPE,
  DISCOVERY_PROBE_TYPE,
  HALLELUJAHBEAMER_SERVICES,
  NETWORK_BIND_ADDRESS,
  NETWORK_PORTS,
} from "./network_constants";

let socket: dgram.Socket | null = null;
let activePorts = { ...NETWORK_PORTS };
let activeIpRange = "";

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts.reduce((value, part) => ((value << 8) + part) >>> 0, 0);
}

function addressMatchesRange(address: string, range: string): boolean {
  const trimmed = range.trim();
  if (!trimmed) return true;
  if (trimmed.endsWith(".*")) {
    return address.startsWith(trimmed.slice(0, -1));
  }
  if (trimmed.includes("/")) {
    const [base, bitsRaw] = trimmed.split("/");
    const bits = Number.parseInt(bitsRaw, 10);
    const ip = ipToNumber(address);
    const baseIp = ipToNumber(base);
    if (ip === null || baseIp === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false;
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ip & mask) === (baseIp & mask);
  }
  return address.startsWith(trimmed);
}

function findReachableAddress(remoteAddress: string, ipRange = ""): string {
  const remote = ipToNumber(remoteAddress);
  const fallback: string[] = [];
  const rangeFallback: string[] = [];

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue;
      }

      fallback.push(address.address);
      if (addressMatchesRange(address.address, ipRange)) {
        rangeFallback.push(address.address);
      }
      const local = ipToNumber(address.address);
      const mask = ipToNumber(address.netmask);
      if (remote !== null && local !== null && mask !== null && (remote & mask) === (local & mask)) {
        return address.address;
      }
    }
  }

  return rangeFallback[0] ?? fallback[0] ?? NETWORK_BIND_ADDRESS;
}

function buildAnnouncement(remoteAddress: string): Buffer {
  const ipAddress = findReachableAddress(remoteAddress, activeIpRange);

  return Buffer.from(
    JSON.stringify({
      type: DISCOVERY_ANNOUNCEMENT_TYPE,
      name: `HallelujahBeamer-${os.hostname().split(".")[0]}`,
      deviceType: "receiver",
      ip: ipAddress,
      ipAddress,
      services: HALLELUJAHBEAMER_SERVICES,
      ports: activePorts,
      ipRange: activeIpRange,
      timestamp: new Date().toISOString(),
    }),
    "utf8",
  );
}

function isDiscoveryProbe(message: Buffer): boolean {
  try {
    const decoded = JSON.parse(message.toString("utf8")) as unknown;
    return (
      typeof decoded === "object" &&
      decoded !== null &&
      "type" in decoded &&
      String((decoded as { type?: unknown }).type) === DISCOVERY_PROBE_TYPE
    );
  } catch {
    return false;
  }
}

export function startDiscoveryResponder(
  port: number = CONTROL_PORT,
  ports = NETWORK_PORTS,
  ipRange = "",
): void {
  if (socket) {
    return;
  }

  activePorts = { ...ports };
  activeIpRange = ipRange.trim();
  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("message", (message, remote) => {
    if (!isDiscoveryProbe(message)) {
      return;
    }

    const announcement = buildAnnouncement(remote.address);
    socket?.send(announcement, remote.port, remote.address, (error) => {
      if (error) {
        console.error("[Discovery] Failed to answer UDP probe:", error);
      }
    });
  });

  socket.on("listening", () => {
    socket?.setBroadcast(true);
    console.log(`[Discovery] UDP responder listening on ${NETWORK_BIND_ADDRESS}:${port}`);
  });

  socket.on("error", (error) => {
    console.error("[Discovery] UDP responder error:", error);
  });

  socket.bind(port, NETWORK_BIND_ADDRESS);
}

export function stopDiscoveryResponder(): void {
  if (!socket) {
    return;
  }

  socket.close(() => {
    console.log("[Discovery] UDP responder stopped.");
  });
  socket = null;
}
