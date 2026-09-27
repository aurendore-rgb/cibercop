import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { log } from '../logging/logger';
import { checkFfmpegAvailability } from '../media/mediaEngine';

export interface SnapshotResult {
  success: boolean;
  data?: Buffer;
  contentType?: string;
  error?: string;
  source: 'onvif_uri' | 'rtsp_ffmpeg';
}

/**
 * Fetches snapshot image via ONVIF Snapshot URI (HTTP GET)
 */
export async function fetchSnapshotFromUri(uri: string, username?: string, password?: string, timeoutMs = 5000): Promise<SnapshotResult> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(uri);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': 'CIBERCOP-Gateway/1.0',
        'Accept': 'image/jpeg,image/png,*/*',
      };

      if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const req = client.get(uri, { headers, timeout: timeoutMs }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (buffer.length < 100) {
              return resolve({
                success: false,
                source: 'onvif_uri',
                error: 'Received empty or invalid image response from camera',
              });
            }
            log('CAMERA', `Successfully captured snapshot via ONVIF URI (${buffer.length} bytes)`);
            resolve({
              success: true,
              data: buffer,
              contentType: res.headers['content-type'] || 'image/jpeg',
              source: 'onvif_uri',
            });
          });
        } else {
          resolve({
            success: false,
            source: 'onvif_uri',
            error: `Camera HTTP returned status ${res.statusCode}`,
          });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, source: 'onvif_uri', error: 'Snapshot request timed out' });
      });

      req.on('error', (err) => {
        resolve({ success: false, source: 'onvif_uri', error: err.message });
      });
    } catch (err) {
      resolve({ success: false, source: 'onvif_uri', error: (err as Error).message });
    }
  });
}

/**
 * Extracts a real single frame JPEG directly from RTSP using FFmpeg
 */
export async function captureSnapshotFromRtsp(rtspUrl: string, timeoutMs = 8000): Promise<SnapshotResult> {
  const ffmpeg = checkFfmpegAvailability();
  if (!ffmpeg.available) {
    return {
      success: false,
      source: 'rtsp_ffmpeg',
      error: 'FFmpeg not available on Gateway host for RTSP snapshot extraction',
    };
  }

  return new Promise((resolve) => {
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-vframes', '1',
      '-q:v', '2',
      '-f', 'image2',
      'pipe:1',
    ];

    log('MEDIA', `Extracting real snapshot frame from RTSP stream...`);
    const child = spawn(ffmpeg.binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve({
        success: false,
        source: 'rtsp_ffmpeg',
        error: `RTSP snapshot capture timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => { stderr += c.toString(); });

    child.on('close', (code) => {
      if (timedOut) return;
      clearTimeout(timer);

      const buffer = Buffer.concat(chunks);
      // Valid JPEG starts with 0xFFD8
      if (buffer.length > 500 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
        log('MEDIA', `Real RTSP snapshot frame extracted successfully (${buffer.length} bytes)`);
        resolve({
          success: true,
          data: buffer,
          contentType: 'image/jpeg',
          source: 'rtsp_ffmpeg',
        });
      } else {
        log('MEDIA', `Failed to extract snapshot frame from RTSP (exit code ${code}): ${stderr.slice(-200)}`, 'warn');
        resolve({
          success: false,
          source: 'rtsp_ffmpeg',
          error: `Could not extract video frame: ${stderr.slice(-200) || 'Stream inactive or invalid'}`,
        });
      }
    });

    child.on('error', (err) => {
      if (timedOut) return;
      clearTimeout(timer);
      resolve({
        success: false,
        source: 'rtsp_ffmpeg',
        error: `FFmpeg execution error: ${err.message}`,
      });
    });
  });
}
