// Type stub for serialport – allows TypeScript to compile without the npm package.
// The real package must be installed via `npm install serialport` before running.
declare module 'serialport' {
  export interface OpenOptions {
    path: string;
    baudRate: number;
    dataBits?: 8 | 7 | 6 | 5;
    highWaterMark?: number;
    lock?: boolean;
    stopBits?: 1 | 2;
    parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
    rtscts?: boolean;
    xon?: boolean;
    xoff?: boolean;
    xany?: boolean;
    autoOpen?: boolean;
    endOnClose?: boolean;
    hupcl?: boolean;
  }

  export interface PortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    pnpId?: string;
    locationId?: string;
    productId?: string;
    vendorId?: string;
  }

  export class SerialPort {
    readonly path: string;
    readonly baudRate: number;
    constructor(options: OpenOptions);
    static list(): Promise<PortInfo[]>;
    open(cb?: (err: Error | null) => void): void;
    close(cb?: (err: Error | null) => void): void;
    write(data: Buffer | string, cb?: (err: Error | null) => void): boolean;
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'data', listener: (data: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    removeAllListeners(event?: string): this;
  }
}
