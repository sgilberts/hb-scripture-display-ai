import Bonjour from 'bonjour-service';
import os from 'os';
import {
  HALLELUJAHBEAMER_SERVICE_TYPE,
  HALLELUJAHBEAMER_SERVICES,
  NETWORK_PORTS,
  OMT_PORT,
} from './network_constants';

let bonjourInstance: Bonjour | null = null;
let currentService: any = null;
let browser: any = null;

export interface DiscoveredStreamInfo {
  id: string;
  name: string;
  ip: string;
  status: 'ONLINE' | 'OFFLINE' | 'IN-USE';
  protocol: 'OMT' | 'NDI';
}

export const mdnsDiscoveredStreams: DiscoveredStreamInfo[] = [];

let updateCallback: (() => void) | null = null;

export function setMdnsUpdateCallback(cb: () => void) {
  updateCallback = cb;
}

export function startMdnsService(
  port: number = OMT_PORT,
  ports = NETWORK_PORTS,
  ipRange = '',
) {
  if (bonjourInstance) {
    return;
  }

  bonjourInstance = new Bonjour();
  const hostname = os.hostname().split('.')[0];

  try {
    // 1. Advertise Desktop Receiver
    currentService = bonjourInstance.publish({
      name: `HallelujahBeamer-${hostname}`,
      type: HALLELUJAHBEAMER_SERVICE_TYPE,
      protocol: 'tcp',
      port: port,
      txt: {
        version: '1.0.0',
        device: 'Desktop',
        type: 'receiver',
        services: HALLELUJAHBEAMER_SERVICES.join(','),
        omt: String(ports.omt),
        ndi: String(ports.ndi),
        usb: String(ports.usb),
        control: String(ports.control),
        ipRange,
      }
    });

    currentService.on('up', () => {
      console.log(`[mDNS] Advertising _hallelujahbeamer._tcp on port ${port} as ${currentService.name}`);
    });

    currentService.on('error', (err: any) => {
      console.error(`[mDNS] Advertiser error:`, err);
    });

    // 2. Discover NDI Streams (as well as OMT streams from other transmitters if any)
    browser = bonjourInstance.find({ type: 'ndi' });
    
    browser.on('up', (service: any) => {
      console.log(`[mDNS] Discovered NDI service:`, service.name);
      const ip = service.addresses?.[0] || service.host;
      if (ip) {
        const id = `ndi-${service.name}`;
        const existing = mdnsDiscoveredStreams.find(s => s.id === id);
        if (existing) {
          existing.ip = ip;
          existing.status = 'ONLINE';
        } else {
          mdnsDiscoveredStreams.push({
            id: id,
            name: service.name,
            ip: ip,
            status: 'ONLINE',
            protocol: 'NDI'
          });
        }
        if (updateCallback) updateCallback();
      }
    });

    browser.on('down', (service: any) => {
      console.log(`[mDNS] NDI service down:`, service.name);
      const index = mdnsDiscoveredStreams.findIndex(s => s.id === `ndi-${service.name}`);
      if (index !== -1) {
        mdnsDiscoveredStreams[index].status = 'OFFLINE';
        if (updateCallback) updateCallback();
      }
    });

    // Also listen for hallelujahbeamer transmitters if they advertise themselves
    const hbBrowser = bonjourInstance.find({ type: HALLELUJAHBEAMER_SERVICE_TYPE });
    hbBrowser.on('up', (service: any) => {
      if (service.name === currentService?.name) return; // ignore self
      const ip = service.addresses?.[0] || service.host;
      if (ip) {
        const id = `omt-${service.name}`;
        const existing = mdnsDiscoveredStreams.find(s => s.id === id);
        if (existing) {
          existing.ip = ip;
          existing.status = 'ONLINE';
        } else {
          mdnsDiscoveredStreams.push({
            id: id,
            name: service.name,
            ip: ip,
            status: 'ONLINE',
            protocol: 'OMT'
          });
        }
        if (updateCallback) updateCallback();
      }
    });
    
  } catch (e) {
    console.error(`[mDNS] Failed to start service:`, e);
  }
}

export function stopMdnsService() {
  if (browser) {
    browser.stop();
    browser = null;
  }
  
  if (currentService) {
    currentService.stop(() => {
      console.log(`[mDNS] Stopped advertising.`);
      currentService = null;
    });
  }
  
  if (bonjourInstance) {
    bonjourInstance.destroy();
    bonjourInstance = null;
  }
}
