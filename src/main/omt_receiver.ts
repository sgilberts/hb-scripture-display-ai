import net from 'net';
import { BrowserWindow } from 'electron';
import { NETWORK_BIND_ADDRESS, OMT_PORT } from './network_constants';

export interface OmtStreamInfo {
  id: string;
  name: string;
  ip: string;
  status: 'ONLINE' | 'OFFLINE' | 'IN-USE';
  protocol: 'OMT';
}

interface OmtHandshakePayload {
  name?: string;
  role?: string;
  protocol?: string;
}

let server: net.Server | null = null;
const activeConnections = new Map<string, net.Socket>();
export const discoveredOmtStreams: OmtStreamInfo[] = [];

// To notify the UI of changes
let updateCallback: (() => void) | null = null;

export function setOmtUpdateCallback(cb: () => void) {
  updateCallback = cb;
}

function handleHandshake(payload: Buffer, streamId: string, remoteAddress: string) {
  try {
    const handshake = JSON.parse(payload.toString('utf8')) as OmtHandshakePayload;
    const stream = discoveredOmtStreams.find(s => s.id === streamId || s.ip === remoteAddress);
    if (stream && handshake.name) {
      stream.name = handshake.name;
    }
    console.log(`[OMT] Handshake accepted from ${remoteAddress}: ${handshake.name ?? 'unnamed sender'}`);
    if (updateCallback) updateCallback();
  } catch (error) {
    console.warn(`[OMT] Invalid handshake payload from ${remoteAddress}:`, error);
  }
}

export function startOmtReceiver(port: number = OMT_PORT) {
  if (server) return;

  server = net.createServer((socket) => {
    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;
    const streamId = `omt-${remoteAddress}:${remotePort}`;
    
    console.log(`[OMT] Incoming connection from ${remoteAddress}:${remotePort}`);
    
    socket.setNoDelay(true); // Disable Nagle's algorithm for low latency
    activeConnections.set(streamId, socket);
    
    // Register stream for UI
    const existing = discoveredOmtStreams.find(s => s.ip === remoteAddress);
    if (!existing) {
      discoveredOmtStreams.push({
        id: streamId,
        name: `Mobile Cam (${remoteAddress})`,
        ip: remoteAddress,
        status: 'IN-USE',
        protocol: 'OMT'
      });
      if (updateCallback) updateCallback();
    } else {
      existing.status = 'IN-USE';
      if (updateCallback) updateCallback();
    }

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      
      // Parse OMT protocol: 4-byte magic, 1-byte type, 4-byte length, 8-byte timestamp
      while (buffer.length >= 17) {
        const magic = buffer.toString('ascii', 0, 4);
        if (magic !== 'OMTX') {
          console.warn(`[OMT] Invalid magic bytes received: ${magic}, dropping buffer`);
          buffer = Buffer.alloc(0); // Reset on error
          break;
        }

        const type = buffer.readUInt8(4);
        const length = buffer.readUInt32BE(5);
        // timestamp is at 9 (8 bytes), we skip parsing it as BigInt for now to save CPU if not needed for sync

        if (buffer.length >= 17 + length) {
          const payload = buffer.subarray(17, 17 + length);
          
          if (type === 0) {
            handleHandshake(payload, streamId, remoteAddress);
          } else {
            // Emit to renderer windows
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
              if (!win.isDestroyed()) {
                if (type === 1) {
                  // Video frame
                  win.webContents.send('omt-video-frame', streamId, payload);
                } else if (type === 2) {
                  // Audio chunk
                  win.webContents.send('omt-audio-chunk', streamId, payload);
                }
              }
            }
          }

          // Advance buffer
          buffer = buffer.subarray(17 + length);
        } else {
          // Wait for more data
          break;
        }
      }
    });

    socket.on('close', () => {
      console.log(`[OMT] Connection closed from ${remoteAddress}`);
      activeConnections.delete(streamId);
      
      const existing = discoveredOmtStreams.find(s => s.ip === remoteAddress);
      if (existing) {
        existing.status = 'OFFLINE';
        if (updateCallback) updateCallback();
      }
    });

    socket.on('error', (err) => {
      console.error(`[OMT] Socket error on ${remoteAddress}:`, err);
    });
  });

  server.listen(port, NETWORK_BIND_ADDRESS, () => {
    console.log(`[OMT] Receiver listening on ${NETWORK_BIND_ADDRESS}:${port}`);
  });

  server.on('error', (err) => {
    console.error(`[OMT] Server error:`, err);
  });
}

export function stopOmtReceiver() {
  for (const socket of activeConnections.values()) {
    socket.destroy();
  }
  activeConnections.clear();
  
  if (server) {
    server.close(() => {
      console.log(`[OMT] Server closed`);
      server = null;
    });
  }
}
