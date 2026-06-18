// Type stub for bonjour-service – allows TypeScript to compile without the npm package.
// The real package must be installed via `npm install bonjour-service` before running.
declare module 'bonjour-service' {
  export interface BonjourOptions {
    multicast?: boolean;
    interface?: string;
    port?: number;
    ip?: string;
    ttl?: number;
    loopback?: boolean;
    reuseAddr?: boolean;
  }

  export interface ServiceRecord {
    name: string;
    type: string;
    subtypes?: string[];
    protocol?: 'tcp' | 'udp';
    host?: string;
    port: number;
    fqdn?: string;
    txt?: Record<string, string | boolean | number>;
    addresses?: string[];
  }

  export interface BonjourService {
    name: string;
    type: string;
    port: number;
    host: string;
    addresses?: string[];
    referer?: { address: string };
  }

  export interface Browser {
    on(event: 'up', listener: (service: BonjourService) => void): this;
    on(event: 'down', listener: (service: BonjourService) => void): this;
    start(): void;
    stop(): void;
  }

  export interface PublishedService {
    stop(cb?: () => void): void;
  }

  export class Bonjour {
    constructor(opts?: BonjourOptions);
    publish(opts: ServiceRecord): PublishedService;
    find(opts: Partial<ServiceRecord>, onUp?: (service: BonjourService) => void): Browser;
    findOne(opts: Partial<ServiceRecord>, cb?: (service: BonjourService) => void): Browser;
    unpublishAll(cb?: () => void): void;
    destroy(): void;
  }

  export default Bonjour;
}
