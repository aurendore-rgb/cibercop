import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log } from '../logging/logger';
import { loadGatewayConfig, detectNetworkInterfaces } from '../config/gatewayConfig';

export interface StreamSession {
  streamId: string;
  cameraId: string;
  rtspUrl: string;
  streamDir: string;
  playlistPath: string;
  streamUrl: string;
  protocol: 'hls';
  status: 'starting' | 'active' | 'error' | 'stopped';
  startedAt: string;
  pid?: number;
  lastError?: string;
  process?: ChildProcess;
}

const baseDir = typeof (process as any).pkg !== 'undefined'
  ? path.dirname(process.execPath)
  : process.cwd();
const STREAMS_DIR = path.resolve(baseDir, 'data', 'streams');

function ensureStreamsDir(): void {
  if (!fs.existsSync(STREAMS_DIR)) {
    fs.mkdirSync(STREAMS_DIR, { recursive: true });
  }
}

// Map of active streams by streamId
const activeStreams = new Map<string, StreamSession>();
// Map of cameraId to streamId
const cameraStreamMap = new Map<string, string>();

/**
 * Checks if FFmpeg binary is available on the system
 */
export function checkFfmpegAvailability(): { available: boolean; version?: string; binaryPath: string } {
  const config = loadGatewayConfig();
  const binaryPath = config.ffmpegPath || 'ffmpeg';

  // Check candidate paths, prioritizing packaged binaries in bin/
  const candidates = [
    path.join(baseDir, 'bin', 'ffmpeg.exe'),
    path.join(baseDir, 'ffmpeg.exe'),
    path.join(baseDir, 'bin', 'ffmpeg'),
    path.join(process.cwd(), 'bin', 'ffmpeg.exe'),
    path.join(process.cwd(), 'ffmpeg.exe'),
    binaryPath,
    'ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
  ];

  for (const cand of candidates) {
    if (!cand) continue;
    // If it's a file path, verify it exists before spawning
    if ((cand.includes('/') || cand.includes('\\')) && !fs.existsSync(cand)) {
      continue;
    }
    try {
      const output = execSync(`"${cand}" -version`, { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
      const firstLine = output.split('\n')[0] || '';
      return {
        available: true,
        version: firstLine.trim(),
        binaryPath: cand,
      };
    } catch {
      // continue searching
    }
  }

  return {
    available: false,
    binaryPath,
  };
}

/**
 * Starts a real HLS stream session from an RTSP URL
 */
export async function startStreamSession(cameraId: string, rtspUrl: string, gatewayHostHeader?: string): Promise<StreamSession> {
  ensureStreamsDir();

  // Check if camera already has an active stream
  const existingId = cameraStreamMap.get(cameraId);
  if (existingId) {
    const existing = activeStreams.get(existingId);
    if (existing && existing.status === 'active' && fs.existsSync(existing.playlistPath)) {
      log('MEDIA', `Reusing existing active stream session ${existingId} for camera ${cameraId}`);
      return existing;
    }
    // Clean up dead session
    await stopStreamSession(existingId);
  }

  const streamId = `stream_${cameraId}_${Date.now()}`;
  const streamDir = path.join(STREAMS_DIR, streamId);
  if (!fs.existsSync(streamDir)) {
    fs.mkdirSync(streamDir, { recursive: true });
  }

  const playlistPath = path.join(streamDir, 'index.m3u8');

  // Determine external host/port for URL
  const config = loadGatewayConfig();
  const { primaryIp } = detectNetworkInterfaces();
  const host = gatewayHostHeader || `${primaryIp}:${config.port}`;
  const streamUrl = `/streams/${streamId}/index.m3u8`;

  const session: StreamSession = {
    streamId,
    cameraId,
    rtspUrl,
    streamDir,
    playlistPath,
    streamUrl,
    protocol: 'hls',
    status: 'starting',
    startedAt: new Date().toISOString(),
  };

  activeStreams.set(streamId, session);
  cameraStreamMap.set(cameraId, streamId);

  const ffmpegCheck = checkFfmpegAvailability();
  if (!ffmpegCheck.available) {
    session.status = 'error';
    session.lastError = 'FFmpeg binary not found on Gateway host. Install FFmpeg or configure FFMPEG_PATH.';
    log('MEDIA', `Cannot start stream: ${session.lastError}`, 'error');
    return session;
  }

  // FFmpeg arguments for low-latency HLS
  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-i', rtspUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '4',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(streamDir, 'seg_%03d.ts'),
    playlistPath,
  ];

  log('MEDIA', `Launching FFmpeg pipeline for stream ${streamId} from camera ${cameraId}`);

  const child = spawn(ffmpegCheck.binaryPath, ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  session.pid = child.pid;
  session.process = child;

  let stderrBuffer = '';

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderrBuffer = (stderrBuffer + text).slice(-1000); // keep last 1KB
  });

  child.on('error', (err) => {
    log('MEDIA', `FFmpeg process error for stream ${streamId}: ${err.message}`, 'error');
    session.status = 'error';
    session.lastError = err.message;
  });

  child.on('exit', (code, signal) => {
    log('MEDIA', `FFmpeg process exited for stream ${streamId} (code: ${code}, signal: ${signal})`, code === 0 ? 'info' : 'warn');
    if (session.status !== 'stopped') {
      session.status = 'error';
      session.lastError = `FFmpeg process stopped unexpectedly (exit code ${code}): ${stderrBuffer.slice(-200)}`;
    }
  });

  // Wait briefly for first playlist segment or active status
  return new Promise((resolve) => {
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if (fs.existsSync(playlistPath)) {
        session.status = 'active';
        log('MEDIA', `HLS playlist index.m3u8 successfully generated for stream ${streamId}`);
        clearInterval(interval);
        resolve(session);
      } else if (session.status === 'error' || checks >= 10) {
        // after 5 seconds, resolve current state
        clearInterval(interval);
        if (session.status === 'starting') {
          session.status = 'active'; // optimistic active, client player will retry
        }
        resolve(session);
      }
    }, 500);
  });
}

/**
 * Stops an active stream session
 */
export async function stopStreamSession(streamIdOrCameraId: string): Promise<boolean> {
  let session = activeStreams.get(streamIdOrCameraId);
  if (!session) {
    const streamId = cameraStreamMap.get(streamIdOrCameraId);
    if (streamId) {
      session = activeStreams.get(streamId);
    }
  }

  if (!session) {
    return false;
  }

  log('MEDIA', `Stopping stream session ${session.streamId} for camera ${session.cameraId}`);

  session.status = 'stopped';

  if (session.process && !session.process.killed) {
    try {
      session.process.kill('SIGTERM');
      setTimeout(() => {
        if (session && session.process && !session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }, 1500);
    } catch {
      // ignore
    }
  }

  activeStreams.delete(session.streamId);
  cameraStreamMap.delete(session.cameraId);

  // Clean up directory
  try {
    if (fs.existsSync(session.streamDir)) {
      fs.rmSync(session.streamDir, { recursive: true, force: true });
    }
  } catch (err) {
    log('MEDIA', `Failed to remove stream directory: ${(err as Error).message}`, 'warn');
  }

  return true;
}

export function getStreamSession(streamIdOrCameraId: string): StreamSession | undefined {
  let session = activeStreams.get(streamIdOrCameraId);
  if (!session) {
    const streamId = cameraStreamMap.get(streamIdOrCameraId);
    if (streamId) {
      session = activeStreams.get(streamId);
    }
  }
  return session;
}

export function getAllActiveStreams(): StreamSession[] {
  return Array.from(activeStreams.values());
}
