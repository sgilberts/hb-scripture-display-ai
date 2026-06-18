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

export function startMdnsAdvertiser(port: number = OMT_PORT) {
  if (bonjourInstance) {
    return;
  }

  bonjourInstance = new Bonjour();
  const hostname = os.hostname().split('.')[0];

  try {
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
        omt: String(NETWORK_PORTS.omt),
        ndi: String(NETWORK_PORTS.ndi),
        usb: String(NETWORK_PORTS.usb),
        control: String(NETWORK_PORTS.control),
      }
    });

    currentService.on('up', () => {
      console.log(`[mDNS] Advertising _hallelujahbeamer._tcp on port ${port} as ${currentService.name}`);
    });

    currentService.on('error', (err: any) => {
      console.error(`[mDNS] Advertiser error:`, err);
    });
  } catch (e) {
    console.error(`[mDNS] Failed to start advertiser:`, e);
  }
}

export function stopMdnsAdvertiser() {
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
