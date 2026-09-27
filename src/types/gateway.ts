export interface GatewayConfigData {
  gatewayId: string;
  port: number;
  primaryIp: string;
  allInterfaces: Array<{
    name: string;
    address: string;
    family: string;
    internal: boolean;
    mac: string;
    isPrimary: boolean;
  }>;
  configuredAt: string;
  mediaEngine: 'ffmpeg' | 'mediamtx';
  hasPassword: boolean;
  gatewayPassword?: string;
}

export interface ConnectionTestStage {
  stage: string;
  status: 'ok' | 'failed' | 'skipped';
  details?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  status: 'ONLINE' | 'OFFLINE';
  latencyMs: number;
  stages: ConnectionTestStage[];
  gateway: {
    id: string;
    port: number;
    primaryIp: string;
  };
  error?: string;
}

export interface CameraClientRecord {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  rtspPort?: number;
  onvifEndpoint?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  profileToken?: string;
  status: 'online' | 'offline' | 'untested';
  lastSeen?: string;
  createdAt: string;
  hasPassword: boolean;
}

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

export interface StreamSessionClient {
  streamId: string;
  cameraId: string;
  streamUrl: string;
  protocol: 'hls';
  status: 'starting' | 'active' | 'error' | 'stopped';
  startedAt: string;
  lastError?: string;
}

export interface DiagnosticsData {
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

export interface LogEntryClient {
  id: string;
  timestamp: string;
  category: 'Gateway' | 'HTTP' | 'AUTH' | 'ONVIF' | 'CAMERA' | 'RTSP' | 'MEDIA';
  level: 'info' | 'warn' | 'error';
  message: string;
}
