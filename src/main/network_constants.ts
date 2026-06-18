export const NETWORK_BIND_ADDRESS = "0.0.0.0";

export const OMT_PORT = 5000;
export const NDI_PORT = 5960;
export const USB_PORT = 9001;
export const CONTROL_PORT = 7000;

export const DISCOVERY_PROBE_TYPE = "hb_discovery_probe";
export const DISCOVERY_ANNOUNCEMENT_TYPE = "hb_discovery_announcement";
export const HALLELUJAHBEAMER_SERVICE_TYPE = "hallelujahbeamer";
export const HALLELUJAHBEAMER_SERVICES = ["omt", "ndi", "usb"] as const;

export const NETWORK_PORTS = {
  omt: OMT_PORT,
  ndi: NDI_PORT,
  usb: USB_PORT,
  control: CONTROL_PORT,
} as const;
