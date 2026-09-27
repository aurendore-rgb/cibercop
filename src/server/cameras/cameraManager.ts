import net from 'net';
import fs from 'fs';
import path from 'path';
import { log } from '../logging/logger';

export interface CameraRecord {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  password?: string; // stored securely locally, never exposed in public GET APIs
  rtspPort?: number;
  onvifEndpoint?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  profileToken?: string;
  cachedRtspUri?: string;
  status: 'online' | 'offline' | 'untested';
  lastSeen?: string;
  createdAt: string;
}

const baseDir = typeof (process as any).pkg !== 'undefined'
  ? path.dirname(process.execPath)
  : process.cwd();
const DATA_DIR = path.resolve(baseDir, 'data');
const CAMERAS_FILE = path.join(DATA_DIR, 'cameras.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let camerasCache: CameraRecord[] = [];

export function loadCameras(): CameraRecord[] {
  ensureDataDir();
  if (camerasCache.length > 0) return camerasCache;

  if (fs.existsSync(CAMERAS_FILE)) {
    try {
      const raw = fs.readFileSync(CAMERAS_FILE, 'utf-8');
      camerasCache = JSON.parse(raw);
    } catch (err) {
      log('CAMERA', `Error reading cameras.json: ${(err as Error).message}`, 'warn');
      camerasCache = [];
    }
  }

  return camerasCache;
}

export function saveCameras(cameras: CameraRecord[]): void {
  ensureDataDir();
  camerasCache = [...cameras];
  fs.writeFileSync(CAMERAS_FILE, JSON.stringify(camerasCache, null, 2), 'utf-8');
}

export function getCameraById(id: string): CameraRecord | undefined {
  const list = loadCameras();
  return list.find(c => c.id === id);
}

export function addOrUpdateCamera(camera: Partial<CameraRecord> & { ip: string; port: number }): CameraRecord {
  const list = loadCameras();
  const existingIdx = list.findIndex(c => c.id === camera.id || (c.ip === camera.ip && c.port === camera.port));

  const record: CameraRecord = {
    id: camera.id || `cam_${camera.ip.replace(/\./g, '_')}_${camera.port}`,
    name: camera.name || `Camera ${camera.ip}`,
    ip: camera.ip,
    port: camera.port || 80,
    username: camera.username || 'admin',
    password: camera.password,
    rtspPort: camera.rtspPort || 554,
    onvifEndpoint: camera.onvifEndpoint || `http://${camera.ip}:${camera.port}/onvif/device_service`,
    manufacturer: camera.manufacturer || 'Intelbras / Generic',
    model: camera.model,
    firmware: camera.firmware,
    profileToken: camera.profileToken,
    cachedRtspUri: camera.cachedRtspUri,
    status: camera.status || 'untested',
    lastSeen: camera.lastSeen || new Date().toISOString(),
    createdAt: camera.createdAt || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    // Preserve existing password if not provided
    if (!record.password && list[existingIdx].password) {
      record.password = list[existingIdx].password;
    }
    list[existingIdx] = { ...list[existingIdx], ...record };
  } else {
    list.push(record);
  }

  saveCameras(list);
  log('CAMERA', `Saved camera ${record.name} (${record.ip}:${record.port})`);
  return record;
}

export function deleteCamera(id: string): boolean {
  const list = loadCameras();
  const filtered = list.filter(c => c.id !== id);
  if (filtered.length !== list.length) {
    saveCameras(filtered);
    log('CAMERA', `Deleted camera ${id}`);
    return true;
  }
  return false;
}

/**
 * Sanitizes camera records for client view - NEVER sends camera passwords
 */
export function sanitizeCameraForClient(camera: CameraRecord): Omit<CameraRecord, 'password'> & { hasPassword: boolean } {
  const { password, ...rest } = camera;
  return {
    ...rest,
    hasPassword: Boolean(password && password.length > 0),
  };
}

/**
 * Performs a REAL TCP probe to test IP and Port connectivity
 */
export async function testCameraTcp(ip: string, port: number, timeoutMs = 3000): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    // Validate IP format
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip === 'localhost';
    if (!isIp) {
      return resolve({ reachable: false, error: `Invalid IP address format: ${ip}` });
    }

    if (port <= 0 || port > 65535) {
      return resolve({ reachable: false, error: `Invalid port number: ${port}` });
    }

    const start = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latencyMs = Date.now() - start;
      resolved = true;
      socket.destroy();
      log('CAMERA', `TCP test SUCCESS for ${ip}:${port} (${latencyMs}ms)`);
      resolve({ reachable: true, latencyMs });
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        log('CAMERA', `TCP test TIMEOUT for ${ip}:${port} after ${timeoutMs}ms`, 'warn');
        resolve({ reachable: false, error: `Connection timed out after ${timeoutMs}ms` });
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        log('CAMERA', `TCP test FAILED for ${ip}:${port}: ${err.message}`, 'warn');
        resolve({ reachable: false, error: err.message });
      }
    });

    try {
      socket.connect(port, ip);
    } catch (err) {
      if (!resolved) {
        resolved = true;
        resolve({ reachable: false, error: (err as Error).message });
      }
    }
  });
}
