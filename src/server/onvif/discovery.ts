import dgram from 'dgram';
import crypto from 'crypto';
import { log } from '../logging/logger';

export interface DiscoveredCamera {
  id: string;
  ip: string;
  port: number;
  xaddrs: string[];
  primaryXAddr: string;
  types: string[];
  scopes: string[];
  name: string;
  hardware: string;
  manufacturer: string;
  discoveredAt: string;
}

const MULTICAST_ADDRESS = '239.255.255.250';
const MULTICAST_PORT = 3702;

/**
 * Parses WS-Discovery ProbeMatch XML response
 */
export function parseProbeMatch(xml: string, senderIp: string): DiscoveredCamera | null {
  try {
    // Check if it's a ProbeMatch response
    if (!xml.includes('ProbeMatches') && !xml.includes('ProbeMatch')) {
      return null;
    }

    // Extract XAddrs (e.g. http://192.168.1.108:80/onvif/device_service)
    const xaddrMatches = xml.match(/<[^:]*:?XAddrs[^>]*>([\s\S]*?)<\/[^:]*:?XAddrs>/i);
    const rawXAddrs = xaddrMatches ? xaddrMatches[1].trim() : '';
    const xaddrs = rawXAddrs.split(/\s+/).filter(Boolean);

    // Primary XAddr
    const primaryXAddr = xaddrs[0] || `http://${senderIp}:80/onvif/device_service`;

    // Extract port from XAddr if possible
    let detectedPort = 80;
    try {
      const parsedUrl = new URL(primaryXAddr);
      detectedPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 80;
    } catch {
      // fallback
    }

    // Extract Scopes
    const scopesMatches = xml.match(/<[^:]*:?Scopes[^>]*>([\s\S]*?)<\/[^:]*:?Scopes>/i);
    const rawScopes = scopesMatches ? scopesMatches[1].trim() : '';
    const scopes = rawScopes.split(/\s+/).filter(Boolean);

    // Extract Types
    const typesMatches = xml.match(/<[^:]*:?Types[^>]*>([\s\S]*?)<\/[^:]*:?Types>/i);
    const rawTypes = typesMatches ? typesMatches[1].trim() : '';
    const types = rawTypes.split(/\s+/).filter(Boolean);

    // Parse hardware, name, manufacturer from scopes
    let hardware = '';
    let name = '';
    let manufacturer = 'ONVIF Device';

    for (const scope of scopes) {
      const decoded = decodeURIComponent(scope);
      if (decoded.includes('/hardware/')) {
        hardware = decoded.split('/hardware/')[1] || '';
      } else if (decoded.includes('/name/')) {
        name = decoded.split('/name/')[1] || '';
      } else if (decoded.includes('/manufacturer/') || decoded.includes('/org/')) {
        const parts = decoded.split('/');
        manufacturer = parts[parts.length - 1] || manufacturer;
      }
    }

    // Intelbras identification
    const allText = (xml + ' ' + rawScopes).toLowerCase();
    if (allText.includes('intelbras')) {
      manufacturer = 'Intelbras';
    } else if (allText.includes('dahua')) {
      manufacturer = 'Dahua';
    } else if (allText.includes('hikvision')) {
      manufacturer = 'Hikvision';
    }

    if (!name) {
      name = hardware ? `${manufacturer} ${hardware}` : `${manufacturer} (${senderIp})`;
    }

    const id = `cam_${senderIp.replace(/\./g, '_')}_${detectedPort}`;

    return {
      id,
      ip: senderIp,
      port: detectedPort,
      xaddrs,
      primaryXAddr,
      types,
      scopes,
      name,
      hardware,
      manufacturer,
      discoveredAt: new Date().toISOString(),
    };
  } catch (err) {
    log('ONVIF', `Error parsing probe match from ${senderIp}: ${(err as Error).message}`, 'warn');
    return null;
  }
}

/**
 * Executes a REAL ONVIF WS-Discovery probe across the local network
 */
export async function discoverOnvifCameras(timeoutMs = 3500): Promise<DiscoveredCamera[]> {
  return new Promise((resolve) => {
    const discoveredMap = new Map<string, DiscoveredCamera>();
    const messageId = `urn:uuid:${crypto.randomUUID()}`;

    const probeEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
          xmlns="http://www.w3.org/2003/05/soap-envelope"
          xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
          xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
          xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <Header>
    <wsa:MessageID>${messageId}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter tds:Device</d:Types>
    </d:Probe>
  </Body>
</Envelope>`;

    const probeBuffer = Buffer.from(probeEnvelope, 'utf-8');
    let socket: dgram.Socket | null = null;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (socket) {
        try {
          socket.close();
        } catch {
          // ignore
        }
        socket = null;
      }
    };

    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      socket.on('error', (err) => {
        log('ONVIF', `WS-Discovery socket error: ${err.message}`, 'warn');
        cleanup();
        resolve(Array.from(discoveredMap.values()));
      });

      socket.on('message', (msg, rinfo) => {
        const xml = msg.toString('utf-8');
        const parsed = parseProbeMatch(xml, rinfo.address);
        if (parsed) {
          log('ONVIF', `Real camera found at ${parsed.ip}:${parsed.port} (${parsed.manufacturer} - ${parsed.name})`);
          discoveredMap.set(parsed.id, parsed);
        }
      });

      socket.bind(0, () => {
        if (!socket) return;
        try {
          socket.setBroadcast(true);
          socket.setMulticastTTL(2);

          log('ONVIF', `Broadcasting WS-Discovery Probe to ${MULTICAST_ADDRESS}:${MULTICAST_PORT} (timeout ${timeoutMs}ms)`);
          socket.send(probeBuffer, 0, probeBuffer.length, MULTICAST_PORT, MULTICAST_ADDRESS, (err) => {
            if (err) {
              log('ONVIF', `Failed to send multicast probe: ${err.message}`, 'warn');
            }
          });
        } catch (err) {
          log('ONVIF', `Multicast configuration error: ${(err as Error).message}`, 'warn');
        }
      });

      timer = setTimeout(() => {
        const cameras = Array.from(discoveredMap.values());
        log('ONVIF', `WS-Discovery scan completed. Total real cameras discovered: ${cameras.length}`);
        cleanup();
        resolve(cameras);
      }, timeoutMs);

    } catch (err) {
      log('ONVIF', `Failed to initialize WS-Discovery socket: ${(err as Error).message}`, 'warn');
      cleanup();
      resolve([]);
    }
  });
}
