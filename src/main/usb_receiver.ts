import net from 'net';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { SerialPort } from 'serialport';
import { BrowserWindow } from 'electron';
import { NETWORK_BIND_ADDRESS, USB_PORT } from './network_constants';

export interface UsbStreamInfo {
  id: string;
  name: string;
  port: string;
  ip?: string;
  status: 'ONLINE' | 'OFFLINE' | 'IN-USE';
  protocol: 'USB';
}

export const discoveredUsbStreams: UsbStreamInfo[] = [];

let activePort: SerialPort | null = null;
let tcpServer: net.Server | null = null;
const activeTetherSockets = new Map<string, net.Socket>();
let updateCallback: (() => void) | null = null;

export function setUsbUpdateCallback(cb: () => void) {
  updateCallback = cb;
}

export async function scanUsbDevices() {
  try {
    const ports = await SerialPort.list();
    const tetherStreams = discoveredUsbStreams.filter(stream => stream.port.startsWith('tcp:'));
    discoveredUsbStreams.length = 0;
    discoveredUsbStreams.push(...tetherStreams);
    
    for (const port of ports) {
      if (port.vendorId || port.productId) {
        discoveredUsbStreams.push({
          id: `usb-${port.path}`,
          name: `USB Device (${port.manufacturer || 'Unknown'})`,
          port: port.path,
          status: activePort?.path === port.path ? 'IN-USE' : 'ONLINE',
          protocol: 'USB'
        });
      }
    }
    
    if (updateCallback) updateCallback();
  } catch (e) {
    console.error(`[USB] Failed to scan devices:`, e);
  }
}

function normalizeRemoteAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address;
}

function adbCandidates(): string[] {
  const home = os.homedir();
  return [
    'adb',
    path.join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
    path.join(home, 'Android', 'Sdk', 'platform-tools', 'adb'),
  ];
}

function configureAdbReverse(port: number, index = 0) {
  const candidate = adbCandidates()[index];
  if (!candidate) {
    console.warn(
      `[USB] ADB reverse unavailable for tcp:${port}. Install Android Platform Tools and enable USB debugging for cable streaming.`,
    );
    return;
  }

  execFile(candidate, ['reverse', `tcp:${port}`, `tcp:${port}`], (error, stdout) => {
    if (error) {
      configureAdbReverse(port, index + 1);
      return;
    }
    console.log(`[USB] ADB reverse active for tcp:${port}. ${stdout.trim()}`);
  });
}

function emitUsbPayload(streamId: string, payloadType: number, payload: Buffer) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      if (payloadType === 1) {
        win.webContents.send('omt-video-frame', streamId, payload);
      } else if (payloadType === 2) {
        win.webContents.send('omt-audio-chunk', streamId, payload);
      }
    }
  }
}

function consumeUsbChunks(chunks: Buffer[], chunksLength: number, streamId: string): { chunks: Buffer[], chunksLength: number } {
  while (chunksLength >= 17) {
    let header = Buffer.alloc(17);
    let offset = 0;
    for (const chunk of chunks) {
      const toCopy = Math.min(17 - offset, chunk.length);
      chunk.copy(header, offset, 0, toCopy);
      offset += toCopy;
      if (offset >= 17) break;
    }

    const magic = header.toString('ascii', 0, 4);
    if (magic !== 'USBT' && magic !== 'OMTX') {
      chunks[0] = chunks[0].subarray(1);
      if (chunks[0].length === 0) chunks.shift();
      chunksLength--;
      continue;
    }

    const type = header.readUInt8(4);
    const length = header.readUInt32BE(5);

    const MAX_PAYLOAD_SIZE = 50 * 1024 * 1024; // 50MB
    if (length > MAX_PAYLOAD_SIZE) {
      console.warn(`[USB] Unreasonably large payload size: ${length}, skipping frame`);
      chunks[0] = chunks[0].subarray(1);
      if (chunks[0].length === 0) chunks.shift();
      chunksLength--;
      continue;
    }

    if (chunksLength >= 17 + length) {
      const fullBuffer = Buffer.concat(chunks, chunksLength);
      const payload = fullBuffer.subarray(17, 17 + length);
      
      emitUsbPayload(streamId, type, payload);
      
      const remaining = fullBuffer.subarray(17 + length);
      chunks = remaining.length > 0 ? [remaining] : [];
      chunksLength = remaining.length;
    } else {
      break;
    }
  }

  return { chunks, chunksLength };
}

export function startUsbTetherReceiver(port: number = USB_PORT) {
  if (tcpServer) return;
  configureAdbReverse(port);

  tcpServer = net.createServer((socket) => {
    const remoteAddress = normalizeRemoteAddress(socket.remoteAddress || 'unknown');
    const streamId = `usb-tether-${remoteAddress}`;

    socket.setNoDelay(true);
    activeTetherSockets.set(streamId, socket);

    const existing = discoveredUsbStreams.find(s => s.ip === remoteAddress);
    if (!existing) {
      discoveredUsbStreams.push({
        id: streamId,
        name: `USB Tether Camera (${remoteAddress})`,
        port: `tcp:${port}`,
        ip: remoteAddress,
        status: 'IN-USE',
        protocol: 'USB'
      });
      if (updateCallback) updateCallback();
    } else {
      existing.id = streamId;
      existing.status = 'IN-USE';
      if (updateCallback) updateCallback();
    }

    let chunks: Buffer[] = [];
    let chunksLength = 0;
    
    socket.on('data', (data) => {
      chunks.push(data);
      chunksLength += data.length;
      const result = consumeUsbChunks(chunks, chunksLength, streamId);
      chunks = result.chunks;
      chunksLength = result.chunksLength;
    });

    socket.on('close', () => {
      activeTetherSockets.delete(streamId);
      const stream = discoveredUsbStreams.find(s => s.id === streamId);
      if (stream) {
        stream.status = 'OFFLINE';
        if (updateCallback) updateCallback();
      }
    });

    socket.on('error', (err) => {
      console.error(`[USB] Tether socket error from ${remoteAddress}:`, err);
    });
  });

  tcpServer.listen(port, NETWORK_BIND_ADDRESS, () => {
    console.log(`[USB] Tether receiver listening on ${NETWORK_BIND_ADDRESS}:${port}`);
  });

  tcpServer.on('error', (err) => {
    console.error(`[USB] Tether receiver error:`, err);
  });
}

function stopSerialReceiver() {
  if (activePort) {
    activePort.close();
    activePort = null;
  }
}

export function startUsbReceiver(path: string, baudRate: number = 115200) {
  stopSerialReceiver();

  activePort = new SerialPort({ path, baudRate });

  activePort.on('open', () => {
    console.log(`[USB] Connected to ${path}`);
    const stream = discoveredUsbStreams.find(s => s.port === path);
    if (stream) {
      stream.status = 'IN-USE';
      if (updateCallback) updateCallback();
    }
  });

  let chunks: Buffer[] = [];
  let chunksLength = 0;

  activePort.on('data', (data: Buffer) => {
    chunks.push(data);
    chunksLength += data.length;
    const result = consumeUsbChunks(chunks, chunksLength, `usb-${path}`);
    chunks = result.chunks;
    chunksLength = result.chunksLength;
  });

  activePort.on('error', (err: Error) => {
    console.error(`[USB] Error:`, err);
  });

  activePort.on('close', () => {
    console.log(`[USB] Disconnected from ${path}`);
    activePort = null;
    const stream = discoveredUsbStreams.find(s => s.port === path);
    if (stream) {
      stream.status = 'ONLINE';
      if (updateCallback) updateCallback();
    }
  });
}

export function stopUsbReceiver() {
  stopSerialReceiver();

  for (const socket of activeTetherSockets.values()) {
    socket.destroy();
  }
  activeTetherSockets.clear();

  if (tcpServer) {
    tcpServer.close(() => {
      console.log('[USB] Tether receiver stopped.');
      tcpServer = null;
    });
  }
}
