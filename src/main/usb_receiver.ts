import { SerialPort } from 'serialport';
import { BrowserWindow } from 'electron';

export interface UsbStreamInfo {
  id: string;
  name: string;
  port: string;
  status: 'ONLINE' | 'OFFLINE' | 'IN-USE';
  protocol: 'USB';
}

export const discoveredUsbStreams: UsbStreamInfo[] = [];

let activePort: SerialPort | null = null;
let updateCallback: (() => void) | null = null;

export function setUsbUpdateCallback(cb: () => void) {
  updateCallback = cb;
}

export async function scanUsbDevices() {
  try {
    const ports = await SerialPort.list();
    // clear and update discovered
    discoveredUsbStreams.length = 0;
    
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

export function startUsbReceiver(path: string, baudRate: number = 115200) {
  if (activePort) {
    stopUsbReceiver();
  }

  activePort = new SerialPort({ path, baudRate });

  activePort.on('open', () => {
    console.log(`[USB] Connected to ${path}`);
    const stream = discoveredUsbStreams.find(s => s.port === path);
    if (stream) {
      stream.status = 'IN-USE';
      if (updateCallback) updateCallback();
    }
  });

  let buffer = Buffer.alloc(0);

  activePort.on('data', (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    
    while (buffer.length >= 17) {
      const magic = buffer.toString('ascii', 0, 4);
      if (magic !== 'OMTX') {
        buffer = buffer.subarray(1); // Seek forward 1 byte if invalid
        continue;
      }

      const type = buffer.readUInt8(4);
      const length = buffer.readUInt32BE(5);

      if (buffer.length >= 17 + length) {
        const payload = buffer.subarray(17, 17 + length);
        
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            if (type === 1) {
              win.webContents.send('omt-video-frame', `usb-${path}`, payload);
            } else if (type === 2) {
              win.webContents.send('omt-audio-chunk', `usb-${path}`, payload);
            }
          }
        }

        buffer = buffer.subarray(17 + length);
      } else {
        break;
      }
    }
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
  if (activePort) {
    activePort.close();
    activePort = null;
  }
}
