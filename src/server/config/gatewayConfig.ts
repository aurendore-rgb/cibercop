import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { log } from '../logging/logger';

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  mac: string;
  isPrimary: boolean;
}

export interface GatewayConfig {
  gatewayId: string;
  gatewayPassword: string; // Plain or hashed password
  port: number;
  allowedOrigins: string[];
  ffmpegPath: string;
  mediaEngine: 'ffmpeg' | 'mediamtx';
  configuredAt: string;
}

const baseDir = typeof (process as any).pkg !== 'undefined'
  ? path.dirname(process.execPath)
  : process.cwd();
const DATA_DIR = path.resolve(baseDir, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'gateway-config.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function generateDefaultGatewayId(): string {
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CIBERCOP-${randomSuffix}`;
}

export function detectNetworkInterfaces(): { primaryIp: string; allInterfaces: NetworkInterfaceInfo[] } {
  const interfaces = os.networkInterfaces();
  const list: NetworkInterfaceInfo[] = [];
  let primaryIp = '127.0.0.1';

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const item of netList) {
      if (item.family === 'IPv4' || item.family === (4 as unknown as string)) {
        const isInternal = item.internal;
        const isLan = !isInternal && (
          item.address.startsWith('192.168.') ||
          item.address.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(item.address)
        );

        list.push({
          name,
          address: item.address,
          family: 'IPv4',
          internal: isInternal,
          mac: item.mac,
          isPrimary: false,
        });

        if (isLan && primaryIp === '127.0.0.1') {
          primaryIp = item.address;
        }
      }
    }
  }

  // If no standard private range found, pick first non-internal
  if (primaryIp === '127.0.0.1') {
    const nonInternal = list.find(i => !i.internal);
    if (nonInternal) {
      primaryIp = nonInternal.address;
    }
  }

  // Mark primary
  for (const item of list) {
    if (item.address === primaryIp) {
      item.isPrimary = true;
    }
  }

  return { primaryIp, allInterfaces: list };
}

let activeConfig: GatewayConfig | null = null;

export function loadGatewayConfig(): GatewayConfig {
  if (activeConfig) return activeConfig;

  ensureDataDir();

  const defaultPort = parseInt(process.env.PORT || '18902', 10);
  const envId = process.env.CIBERCOP_GATEWAY_ID?.trim();
  const envPassword = process.env.CIBERCOP_GATEWAY_TOKEN?.trim();

  let loaded: Partial<GatewayConfig> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      loaded = JSON.parse(raw);
    } catch (err) {
      log('Gateway', `Failed to parse gateway-config.json, generating defaults: ${(err as Error).message}`, 'warn');
    }
  }

  const gatewayId = loaded.gatewayId || envId || generateDefaultGatewayId();
  // If no password set yet, default to an initial operator password that can be changed
  const gatewayPassword = loaded.gatewayPassword || envPassword || 'cibercop2026';
  const port = loaded.port || 18902;
  const allowedOrigins = loaded.allowedOrigins || ['*'];
  const ffmpegPath = loaded.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  const mediaEngine = (loaded.mediaEngine || process.env.MEDIA_ENGINE || 'ffmpeg') as 'ffmpeg' | 'mediamtx';

  activeConfig = {
    gatewayId,
    gatewayPassword,
    port,
    allowedOrigins,
    ffmpegPath,
    mediaEngine,
    configuredAt: loaded.configuredAt || new Date().toISOString(),
  };

  saveGatewayConfig(activeConfig);
  log('Gateway', `Config loaded. Gateway ID: ${activeConfig.gatewayId}, Port: ${activeConfig.port}`);
  return activeConfig;
}

export function saveGatewayConfig(config: GatewayConfig): void {
  ensureDataDir();
  activeConfig = { ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(activeConfig, null, 2), 'utf-8');
  log('Gateway', `Configuration saved successfully to ${CONFIG_FILE}`);
}

export function updateGatewayCredentials(gatewayId: string, gatewayPassword?: string, port?: number): GatewayConfig {
  const current = loadGatewayConfig();
  const updated: GatewayConfig = {
    ...current,
    gatewayId: gatewayId.trim() || current.gatewayId,
    port: port && port > 0 && port < 65536 ? port : current.port,
    configuredAt: new Date().toISOString(),
  };

  if (gatewayPassword && gatewayPassword.trim()) {
    updated.gatewayPassword = gatewayPassword.trim();
  }

  saveGatewayConfig(updated);
  return updated;
}
