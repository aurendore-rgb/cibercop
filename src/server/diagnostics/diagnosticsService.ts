import os from 'os';
import { loadGatewayConfig, detectNetworkInterfaces, GatewayConfig } from '../config/gatewayConfig';
import { checkFfmpegAvailability, getAllActiveStreams } from '../media/mediaEngine';
import { loadCameras } from '../cameras/cameraManager';

export interface DiagnosticsReport {
  gatewayId: string;
  version: string;
  status: 'online' | 'degraded';
  localIp: string;
  allInterfaces: Array<{ name: string; address: string; isPrimary: boolean }>;
  port: number;
  onvifAvailable: boolean;
  ffmpeg: {
    available: boolean;
    version?: string;
    binaryPath: string;
  };
  mediaEngine: 'ffmpeg' | 'mediamtx';
  camerasTotal: number;
  camerasOnline: number;
  streamsActive: number;
  uptimeSeconds: number;
  system: {
    platform: string;
    hostname: string;
    arch: string;
    totalMemMb: number;
    freeMemMb: number;
    cpuCores: number;
  };
  firewall: {
    recommendedPort: number;
    protocol: 'TCP';
    ruleName: string;
    netshCommand: string;
  };
}

const startTime = Date.now();

export function getDiagnosticsReport(): DiagnosticsReport {
  const config = loadGatewayConfig();
  const { primaryIp, allInterfaces } = detectNetworkInterfaces();
  const ffmpeg = checkFfmpegAvailability();
  const cameras = loadCameras();
  const activeStreams = getAllActiveStreams();

  const camerasOnline = cameras.filter(c => c.status === 'online').length;
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return {
    gatewayId: config.gatewayId,
    version: '1.0.0',
    status: ffmpeg.available ? 'online' : 'degraded',
    localIp: primaryIp,
    allInterfaces: allInterfaces.map(i => ({ name: i.name, address: i.address, isPrimary: i.isPrimary })),
    port: config.port,
    onvifAvailable: true,
    ffmpeg,
    mediaEngine: config.mediaEngine,
    camerasTotal: cameras.length,
    camerasOnline,
    streamsActive: activeStreams.length,
    uptimeSeconds,
    system: {
      platform: os.platform(),
      hostname: os.hostname(),
      arch: os.arch(),
      totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
      cpuCores: os.cpus().length,
    },
    firewall: {
      recommendedPort: 18902,
      protocol: 'TCP',
      ruleName: 'CIBERCOP Gateway 18902 (Rede Local)',
      netshCommand: `netsh advfirewall firewall add rule name="CIBERCOP Gateway 18902 (Rede Local)" dir=in action=allow protocol=TCP localport=18902 remoteip=LocalSubnet profile=private,domain`,
    },
  };
}
