import net from 'net';
import { BrowserWindow } from 'electron';
import { NDI_PORT, NETWORK_BIND_ADDRESS, OMT_PORT } from './network_constants';

export interface OmtStreamInfo {
  id: string;
  name: string;
  ip: string;
  status: 'ONLINE' | 'OFFLINE' | 'IN-USE';
  protocol: 'OMT' | 'NDI';
}

interface OmtHandshakePayload {
  name?: string;
  role?: string;
  protocol?: string;
  transport?: string;
}

const servers = new Map<number, net.Server>();
const activeConnections = new Map<string, net.Socket>();
const latestVideoFrames = new Map<string, Buffer>();
const videoFlushTimers = new Map<string, NodeJS.Timeout>();
export const discoveredOmtStreams: OmtStreamInfo[] = [];

// To notify the UI of changes
let updateCallback: (() => void) | null = null;

export function setOmtUpdateCallback(cb: () => void) {
  updateCallback = cb;
}

function normalizeRemoteAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address;
}

function handleHandshake(payload: Buffer, streamId: string, remoteAddress: string) {
  try {
    const handshake = JSON.parse(payload.toString('utf8')) as OmtHandshakePayload;
    const requestedProtocol = String(handshake.protocol).toLowerCase() === 'ndi' ? 'NDI' : 'OMT';
    const stream =
      discoveredOmtStreams.find(s => s.id === streamId) ??
      discoveredOmtStreams.find(s => s.ip === remoteAddress && s.protocol === requestedProtocol);
    if (stream) {
      if (handshake.name) stream.name = handshake.name;
      if (requestedProtocol === 'NDI') {
        stream.protocol = 'NDI';
        stream.id = stream.id.startsWith('omt-') ? stream.id.replace(/^omt-/, 'ndi-') : stream.id;
      }
    }
    console.log(`[OMT] Handshake accepted from ${remoteAddress}: ${handshake.name ?? 'unnamed sender'}`);
    if (updateCallback) updateCallback();
  } catch (error) {
    console.warn(`[OMT] Invalid handshake payload from ${remoteAddress}:`, error);
  }
}

function streamIdForRemote(remoteAddress: string, fallbackId: string): string {
  const protocol = fallbackId.startsWith('ndi-') ? 'NDI' : 'OMT';
  return discoveredOmtStreams.find(s => s.ip === remoteAddress && s.protocol === protocol)?.id ?? fallbackId;
}

function emitToRenderer(channel: 'omt-video-frame' | 'omt-audio-chunk', streamId: string, payload: Buffer) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, streamId, payload);
    }
  }
}

function queueVideoFrame(streamId: string, payload: Buffer) {
  latestVideoFrames.set(streamId, payload);
  if (videoFlushTimers.has(streamId)) return;

  videoFlushTimers.set(
    streamId,
    setTimeout(() => {
      videoFlushTimers.delete(streamId);
      const latest = latestVideoFrames.get(streamId);
      latestVideoFrames.delete(streamId);
      if (latest) {
        emitToRenderer('omt-video-frame', streamId, latest);
      }
    }, 33),
  );
}

export function startOmtReceiver(port: number = OMT_PORT, protocol?: 'OMT' | 'NDI') {
  if (servers.has(port)) return;

  const defaultProtocol: 'OMT' | 'NDI' = protocol ?? (port === NDI_PORT ? 'NDI' : 'OMT');

  const server = net.createServer((socket) => {
    const remoteAddress = normalizeRemoteAddress(socket.remoteAddress || 'unknown');
    const streamId = `${defaultProtocol.toLowerCase()}-${remoteAddress}`;
    
    console.log(`[${defaultProtocol}] Incoming connection from ${remoteAddress}`);
    
    socket.setNoDelay(true); // Disable Nagle's algorithm for low latency

    const oldSocket = activeConnections.get(streamId);
    if (oldSocket && oldSocket !== socket) {
      oldSocket.destroy();
    }
    activeConnections.set(streamId, socket);
    
    // Register stream for UI
    const existing = discoveredOmtStreams.find(s => s.ip === remoteAddress && s.protocol === defaultProtocol);
    if (!existing) {
      discoveredOmtStreams.push({
        id: streamId,
        name: `Mobile Cam (${remoteAddress})`,
        ip: remoteAddress,
        status: 'IN-USE',
        protocol: defaultProtocol
      });
      if (updateCallback) updateCallback();
    } else {
      existing.id = streamId;
      existing.protocol = defaultProtocol;
      existing.status = 'IN-USE';
      if (updateCallback) updateCallback();
    }

    let chunks: Buffer[] = [];
    let chunksLength = 0;

    socket.on('data', (data) => {
      chunks.push(data);
      chunksLength += data.length;
      
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
        if (magic !== 'OMTX') {
          chunks[0] = chunks[0].subarray(1);
          if (chunks[0].length === 0) chunks.shift();
          chunksLength--;
          continue;
        }

        const type = header.readUInt8(4);
        const length = header.readUInt32BE(5);

        // Safety check to prevent corrupted length from allocating / waiting for huge buffers
        const MAX_PAYLOAD_SIZE = 50 * 1024 * 1024; // 50MB
        if (length > MAX_PAYLOAD_SIZE) {
          console.warn(`[OMT] Unreasonably large payload size: ${length}, skipping frame`);
          chunks[0] = chunks[0].subarray(1);
          if (chunks[0].length === 0) chunks.shift();
          chunksLength--;
          continue;
        }

        if (chunksLength >= 17 + length) {
          const fullBuffer = Buffer.concat(chunks, chunksLength);
          const payload = fullBuffer.subarray(17, 17 + length);
          
          if (type === 0) {
            handleHandshake(payload, streamId, remoteAddress);
          } else {
            const renderStreamId = streamIdForRemote(remoteAddress, streamId);
            if (type === 1) {
              queueVideoFrame(renderStreamId, payload);
            } else if (type === 2) {
              emitToRenderer('omt-audio-chunk', renderStreamId, payload);
            }
          }

          // Advance buffer
          const remaining = fullBuffer.subarray(17 + length);
          chunks = remaining.length > 0 ? [remaining] : [];
          chunksLength = remaining.length;
        } else {
          // Wait for more data
          break;
        }
      }
    });

    socket.on('close', () => {
      console.log(`[${defaultProtocol}] Connection closed from ${remoteAddress}`);
      if (activeConnections.get(streamId) === socket) {
        activeConnections.delete(streamId);
      }
      
      const existing = discoveredOmtStreams.find(s => s.id === streamId);
      if (existing) {
        existing.status = activeConnections.has(streamId) ? 'IN-USE' : 'OFFLINE';
        if (updateCallback) updateCallback();
      }
    });

    socket.on('error', (err) => {
      console.error(`[${defaultProtocol}] Socket error on ${remoteAddress}:`, err);
    });
  });

  server.listen(port, NETWORK_BIND_ADDRESS, () => {
    console.log(`[${defaultProtocol}] Receiver listening on ${NETWORK_BIND_ADDRESS}:${port}`);
  });

  server.on('error', (err) => {
    console.error(`[${defaultProtocol}] Server error:`, err);
  });

  servers.set(port, server);
}

export function stopOmtReceiver() {
  for (const socket of activeConnections.values()) {
    socket.destroy();
  }
  activeConnections.clear();
  for (const timer of videoFlushTimers.values()) {
    clearTimeout(timer);
  }
  videoFlushTimers.clear();
  latestVideoFrames.clear();
  
  for (const [port, server] of servers) {
    server.close(() => {
      console.log(`[OMT] Server on port ${port} closed`);
    });
  }
  servers.clear();
}
