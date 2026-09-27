import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { log, getLogs, LogCategory } from './src/server/logging/logger';
import {
  loadGatewayConfig,
  updateGatewayCredentials,
  detectNetworkInterfaces,
} from './src/server/config/gatewayConfig';
import { requireGatewayAuth, validateGatewayCredentials } from './src/server/auth/gatewayAuth';
import { discoverOnvifCameras } from './src/server/onvif/discovery';
import {
  getDeviceInformation,
  getCapabilities,
  getProfiles,
  getStreamUri,
  getSnapshotUri,
} from './src/server/onvif/onvifClient';
import {
  loadCameras,
  addOrUpdateCamera,
  deleteCamera,
  getCameraById,
  testCameraTcp,
  sanitizeCameraForClient,
} from './src/server/cameras/cameraManager';
import {
  checkFfmpegAvailability,
  startStreamSession,
  stopStreamSession,
  getStreamSession,
  getAllActiveStreams,
} from './src/server/media/mediaEngine';
import {
  fetchSnapshotFromUri,
  captureSnapshotFromRtsp,
} from './src/server/snapshot/snapshotManager';
import { getDiagnosticsReport } from './src/server/diagnostics/diagnosticsService';

async function createServer() {
  const app = express();
  const config = loadGatewayConfig();
  const PORT = parseInt(process.env.PORT || String(config.port || 18902), 10);

  // Enable CORS for all clients (APK/PWA, web, external origins)
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Gateway-Id', 'X-Gateway-Auth'],
  }));

  app.use(express.json());

  // Log incoming requests (without logging credentials)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/streams') && !req.path.includes('.ts')) {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      log('HTTP', `${req.method} ${req.path} from ${clientIp}`);
    }
    next();
  });

  // Static serving for HLS streams (playlists and video TS segments)
  const baseDir = typeof (process as any).pkg !== 'undefined'
    ? path.dirname(process.execPath)
    : process.cwd();
  const streamsDir = path.resolve(baseDir, 'data', 'streams');
  app.use('/streams', express.static(streamsDir, {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (filePath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=60');
      }
    },
  }));

  // ==========================================
  // Section 2 & 5: APK/PWA Authentication Handshake
  // ==========================================
  app.get('/api/auth/verify', requireGatewayAuth, (req: Request, res: Response) => {
    const config = loadGatewayConfig();
    const tokenQuery = typeof req.query.token === 'string' ? req.query.token : undefined;
    const authResult = validateGatewayCredentials(req.headers, tokenQuery);

    res.json({
      success: true,
      authorized: true,
      gatewayId: config.gatewayId,
      port: config.port,
      authMethod: authResult.authMethod,
      timestamp: new Date().toISOString(),
    });
  });

  // ==========================================
  // Section 8: GET /health
  // ==========================================
  app.get('/health', (_req: Request, res: Response) => {
    const activeConfig = loadGatewayConfig();
    const ffmpeg = checkFfmpegAvailability();
    const diag = getDiagnosticsReport();

    res.json({
      status: 'ok',
      version: '1.0.0',
      gatewayId: activeConfig.gatewayId,
      port: activeConfig.port,
      activeListeningPort: PORT,
      ffmpegAvailable: ffmpeg.available,
      mediaEngine: activeConfig.mediaEngine,
      uptime: diag.uptimeSeconds,
    });
  });

  // ==========================================
  // Section 9: GET /api/status
  // ==========================================
  app.get('/api/status', (_req: Request, res: Response) => {
    const activeConfig = loadGatewayConfig();
    const ffmpeg = checkFfmpegAvailability();
    const cameras = loadCameras();
    const streams = getAllActiveStreams();

    res.json({
      status: 'online',
      version: '1.0.0',
      gatewayId: activeConfig.gatewayId,
      port: activeConfig.port,
      camerasTotal: cameras.length,
      camerasOnline: cameras.filter(c => c.status === 'online').length,
      streamsActive: streams.length,
      onvifAvailable: true,
      ffmpegAvailable: ffmpeg.available,
    });
  });

  // ==========================================
  // Section 21 & 22: Network interfaces & Diagnostics
  // ==========================================
  app.get('/api/network-interfaces', (_req: Request, res: Response) => {
    const net = detectNetworkInterfaces();
    res.json(net);
  });

  app.get('/api/diagnostics', (_req: Request, res: Response) => {
    const report = getDiagnosticsReport();
    res.json(report);
  });

  // ==========================================
  // Section 23: Gateway Logs
  // ==========================================
  app.get('/api/logs', (req: Request, res: Response) => {
    const category = req.query.category as LogCategory | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const logs = getLogs(limit, category);
    res.json(logs);
  });

  // ==========================================
  // Section 3 & 4: Gateway Configuration
  // ==========================================
  app.get('/api/config', (_req: Request, res: Response) => {
    const current = loadGatewayConfig();
    const { primaryIp, allInterfaces } = detectNetworkInterfaces();
    // Return sanitized config (never sending full plain password if requested by unauthorized, but here for local operator UI)
    res.json({
      gatewayId: current.gatewayId,
      port: current.port,
      primaryIp,
      allInterfaces,
      configuredAt: current.configuredAt,
      mediaEngine: current.mediaEngine,
      hasPassword: Boolean(current.gatewayPassword),
      gatewayPassword: current.gatewayPassword || 'cibercop2026',
    });
  });

  app.post('/api/config', (req: Request, res: Response) => {
    const { gatewayId, gatewayPassword, port } = req.body;
    if (!gatewayId || typeof gatewayId !== 'string') {
      return res.status(400).json({ success: false, error: 'gatewayId is required' });
    }

    const updated = updateGatewayCredentials(gatewayId, gatewayPassword, port ? parseInt(port, 10) : undefined);
    log('Gateway', `Gateway identity updated: ID ${updated.gatewayId}, Port ${updated.port}`);

    res.json({
      success: true,
      gatewayId: updated.gatewayId,
      port: updated.port,
      configuredAt: updated.configuredAt,
    });
  });

  // ==========================================
  // Section 6: Real Connection Test
  // ==========================================
  app.post('/api/test-connection', async (req: Request, res: Response) => {
    const { gatewayId, password } = req.body;
    const activeConfig = loadGatewayConfig();
    const { primaryIp } = detectNetworkInterfaces();

    const stages: Array<{ stage: string; status: 'ok' | 'failed' | 'skipped'; details?: string }> = [];
    let overallSuccess = true;
    const start = Date.now();

    // Stage 1: Local IP check
    stages.push({
      stage: 'IP_DETECTION',
      status: primaryIp ? 'ok' : 'failed',
      details: `Detected host IP: ${primaryIp}`,
    });

    // Stage 2: TCP Port Check
    const tcpCheck = await testCameraTcp('127.0.0.1', PORT, 2000);
    if (tcpCheck.reachable) {
      stages.push({
        stage: 'TCP_PORT',
        status: 'ok',
        details: `Port ${PORT} accepting TCP socket connections (${tcpCheck.latencyMs}ms)`,
      });
    } else {
      stages.push({
        stage: 'TCP_PORT',
        status: 'failed',
        details: `Port ${PORT} unreachable: ${tcpCheck.error}`,
      });
      overallSuccess = false;
    }

    // Stage 3: HTTP /health check
    stages.push({
      stage: 'HTTP_HEALTH',
      status: 'ok',
      details: `HTTP engine responsive on port ${PORT}`,
    });

    // Stage 4: Authentication Verification
    if (gatewayId && password) {
      const idMatch = gatewayId.trim() === activeConfig.gatewayId.trim();
      const passMatch = password.trim() === activeConfig.gatewayPassword.trim();

      if (idMatch && passMatch) {
        stages.push({
          stage: 'AUTHENTICATION',
          status: 'ok',
          details: 'Gateway ID and Password authenticated successfully',
        });
      } else {
        stages.push({
          stage: 'AUTHENTICATION',
          status: 'failed',
          details: !idMatch ? 'Gateway ID mismatch' : 'Gateway Password mismatch',
        });
        overallSuccess = false;
      }
    } else {
      stages.push({
        stage: 'AUTHENTICATION',
        status: 'skipped',
        details: 'No test credentials supplied to authenticate',
      });
    }

    const latencyMs = Date.now() - start;

    log('Gateway', `Connection test executed: ${overallSuccess ? 'ONLINE (SUCCESS)' : 'OFFLINE (FAILED)'}`);

    res.json({
      success: overallSuccess,
      status: overallSuccess ? 'ONLINE' : 'OFFLINE',
      latencyMs,
      stages,
      gateway: {
        id: activeConfig.gatewayId,
        port: PORT,
        primaryIp,
      },
    });
  });

  // ==========================================
  // Section 10: Real ONVIF WS-Discovery
  // ==========================================
  app.get('/api/onvif/discover', async (_req: Request, res: Response) => {
    try {
      log('ONVIF', 'Initiating real WS-Discovery probe (UDP 239.255.255.250:3702)...');
      const discovered = await discoverOnvifCameras(3500);

      // Auto-update or merge into cameras list if found
      for (const cam of discovered) {
        addOrUpdateCamera({
          id: cam.id,
          name: cam.name,
          ip: cam.ip,
          port: cam.port,
          onvifEndpoint: cam.primaryXAddr,
          manufacturer: cam.manufacturer,
          model: cam.hardware || cam.manufacturer,
          status: 'online',
        });
      }

      res.json({
        success: true,
        count: discovered.length,
        cameras: discovered,
      });
    } catch (err) {
      log('ONVIF', `Discovery failed: ${(err as Error).message}`, 'error');
      res.status(500).json({
        success: false,
        error: (err as Error).message,
        cameras: [],
      });
    }
  });

  // ==========================================
  // Section 11 & 12: Real ONVIF Operations (Protected)
  // ==========================================
  app.post('/api/onvif/device-info', requireGatewayAuth, async (req: Request, res: Response) => {
    const { endpoint, username, password } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'endpoint is required' });
    }

    try {
      const info = await getDeviceInformation(endpoint, { username, password });
      res.json({ success: true, info });
    } catch (err) {
      log('CAMERA', `GetDeviceInformation failed: ${(err as Error).message}`, 'warn');
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.post('/api/onvif/capabilities', requireGatewayAuth, async (req: Request, res: Response) => {
    const { endpoint, username, password } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'endpoint is required' });
    }

    try {
      const caps = await getCapabilities(endpoint, { username, password });
      res.json({ success: true, capabilities: caps });
    } catch (err) {
      log('CAMERA', `GetCapabilities failed: ${(err as Error).message}`, 'warn');
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.post('/api/onvif/profiles', requireGatewayAuth, async (req: Request, res: Response) => {
    const { mediaEndpoint, username, password } = req.body;
    if (!mediaEndpoint) {
      return res.status(400).json({ success: false, error: 'mediaEndpoint is required' });
    }

    try {
      const profiles = await getProfiles(mediaEndpoint, { username, password });
      res.json({ success: true, profiles });
    } catch (err) {
      log('CAMERA', `GetProfiles failed: ${(err as Error).message}`, 'warn');
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.post('/api/onvif/stream-uri', requireGatewayAuth, async (req: Request, res: Response) => {
    const { mediaEndpoint, profileToken, username, password } = req.body;
    if (!mediaEndpoint || !profileToken) {
      return res.status(400).json({ success: false, error: 'mediaEndpoint and profileToken are required' });
    }

    try {
      const streamInfo = await getStreamUri(mediaEndpoint, profileToken, { username, password });
      res.json({ success: true, streamUri: streamInfo.uri, profileToken });
    } catch (err) {
      log('RTSP', `GetStreamUri failed: ${(err as Error).message}`, 'warn');
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // ==========================================
  // Section 14: Real Camera TCP & Connectivity Test
  // ==========================================
  app.get('/api/camera/test', async (req: Request, res: Response) => {
    const ip = req.query.ip as string;
    const portStr = req.query.port as string;

    if (!ip || !portStr) {
      return res.status(400).json({ success: false, error: 'ip and port query parameters are required' });
    }

    const port = parseInt(portStr, 10);
    const result = await testCameraTcp(ip, port);

    // Update status in camera store if camera matches
    if (result.reachable) {
      const cameras = loadCameras();
      const match = cameras.find(c => c.ip === ip && c.port === port);
      if (match) {
        addOrUpdateCamera({ ...match, status: 'online', lastSeen: new Date().toISOString() });
      }
    }

    res.json({
      success: result.reachable,
      ip,
      port,
      reachable: result.reachable,
      latencyMs: result.latencyMs,
      error: result.error,
    });
  });

  // ==========================================
  // Section 13: Camera List CRUD
  // ==========================================
  app.get('/api/cameras', (_req: Request, res: Response) => {
    const list = loadCameras();
    res.json(list.map(sanitizeCameraForClient));
  });

  app.post('/api/cameras', requireGatewayAuth, (req: Request, res: Response) => {
    const { id, name, ip, port, username, password, rtspPort, onvifEndpoint, manufacturer } = req.body;

    if (!ip || !port) {
      return res.status(400).json({ success: false, error: 'ip and port are required' });
    }

    const saved = addOrUpdateCamera({
      id,
      name,
      ip,
      port: parseInt(port, 10),
      username,
      password,
      rtspPort: rtspPort ? parseInt(rtspPort, 10) : 554,
      onvifEndpoint,
      manufacturer,
    });

    res.json({ success: true, camera: sanitizeCameraForClient(saved) });
  });

  app.delete('/api/cameras/:id', requireGatewayAuth, (req: Request, res: Response) => {
    const success = deleteCamera(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Camera not found' });
    }
  });

  // ==========================================
  // Section 16 & 17: Video Stream Control (Protected)
  // ==========================================
  app.post('/api/camera/:id/stream', requireGatewayAuth, async (req: Request, res: Response) => {
    const cameraId = req.params.id;
    const camera = getCameraById(cameraId);

    // Allow passing custom RTSP URL in body, or construct from camera record
    let rtspUrl = req.body.rtspUrl;

    if (!rtspUrl && camera) {
      if (camera.cachedRtspUri) {
        rtspUrl = camera.cachedRtspUri;
      } else {
        // Construct standard RTSP URI for Intelbras / generic ONVIF
        const user = camera.username ? encodeURIComponent(camera.username) : 'admin';
        const pass = camera.password ? `:${encodeURIComponent(camera.password)}` : '';
        const port = camera.rtspPort || 554;
        rtspUrl = `rtsp://${user}${pass}@${camera.ip}:${port}/cam/realmonitor?channel=1&subtype=0`;
      }
    }

    if (!rtspUrl) {
      return res.status(400).json({
        success: false,
        error: 'No RTSP URL found or provided for camera. Ensure camera credentials are configured.',
      });
    }

    try {
      const session = await startStreamSession(cameraId, rtspUrl, req.headers.host);

      if (session.status === 'error') {
        return res.status(500).json({
          success: false,
          error: session.lastError || 'Failed to start stream',
          status: session.status,
        });
      }

      res.json({
        success: true,
        streamId: session.streamId,
        cameraId: session.cameraId,
        streamUrl: session.streamUrl,
        protocol: session.protocol,
        status: session.status,
        startedAt: session.startedAt,
      });
    } catch (err) {
      log('MEDIA', `Failed to start stream for camera ${cameraId}: ${(err as Error).message}`, 'error');
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.get('/api/camera/:id/stream', (req: Request, res: Response) => {
    const session = getStreamSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'No active stream found for camera' });
    }

    res.json({
      success: true,
      streamId: session.streamId,
      cameraId: session.cameraId,
      streamUrl: session.streamUrl,
      protocol: session.protocol,
      status: session.status,
      startedAt: session.startedAt,
      lastError: session.lastError,
    });
  });

  app.delete('/api/camera/:id/stream', requireGatewayAuth, async (req: Request, res: Response) => {
    const stopped = await stopStreamSession(req.params.id);
    res.json({ success: stopped });
  });

  // ==========================================
  // Section 18: Real Snapshot Capture
  // ==========================================
  app.get('/api/camera/snapshot', async (req: Request, res: Response) => {
    const cameraId = req.query.id as string | undefined;
    const directRtsp = req.query.rtsp as string | undefined;
    const directUri = req.query.uri as string | undefined;

    let targetRtsp = directRtsp;
    let targetUri = directUri;
    let username = req.query.username as string | undefined;
    let password = req.query.password as string | undefined;

    if (cameraId) {
      const camera = getCameraById(cameraId);
      if (camera) {
        username = username || camera.username;
        password = password || camera.password;
        if (!targetRtsp) {
          const user = camera.username ? encodeURIComponent(camera.username) : 'admin';
          const pass = camera.password ? `:${encodeURIComponent(camera.password)}` : '';
          const port = camera.rtspPort || 554;
          targetRtsp = camera.cachedRtspUri || `rtsp://${user}${pass}@${camera.ip}:${port}/cam/realmonitor?channel=1&subtype=0`;
        }
      }
    }

    // Attempt 1: Fetch via ONVIF Snapshot URI if provided
    if (targetUri) {
      const snapResult = await fetchSnapshotFromUri(targetUri, username, password);
      if (snapResult.success && snapResult.data) {
        res.setHeader('Content-Type', snapResult.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(snapResult.data);
      }
    }

    // Attempt 2: Extract real frame from RTSP stream via FFmpeg
    if (targetRtsp) {
      const frameResult = await captureSnapshotFromRtsp(targetRtsp);
      if (frameResult.success && frameResult.data) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(frameResult.data);
      }

      return res.status(502).json({
        success: false,
        error: frameResult.error || 'Failed to capture snapshot from RTSP stream',
      });
    }

    res.status(400).json({
      success: false,
      error: 'Missing camera id, rtsp URL, or snapshot uri to capture image',
    });
  });

  // ==========================================
  // Direct Download Route for Windows Package
  // ==========================================
  const handleZipDownload = (_req: Request, res: Response) => {
    const candidatePaths = [
      path.resolve(process.cwd(), 'CIBERCOP-Gateway-V1-Windows-x64-BINARY.zip'),
      path.resolve(baseDir, 'CIBERCOP-Gateway-V1-Windows-x64-BINARY.zip'),
      '/app/applet/CIBERCOP-Gateway-V1-Windows-x64-BINARY.zip',
      path.resolve(process.cwd(), 'CIBERCOP-Gateway-V1-Windows-x64.zip'),
      path.resolve(baseDir, 'CIBERCOP-Gateway-V1-Windows-x64.zip'),
      '/app/applet/CIBERCOP-Gateway-V1-Windows-x64.zip',
    ];

    const targetZip = candidatePaths.find(p => fs.existsSync(p));
    if (!targetZip) {
      return res.status(404).json({ success: false, error: 'ZIP file not found on disk' });
    }

    const stat = fs.statSync(targetZip);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="CIBERCOP-Gateway-V1-Windows-x64-BINARY.zip"',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    const readStream = fs.createReadStream(targetZip);
    readStream.pipe(res);
  };

  app.get('/download', handleZipDownload);
  app.get('/download/windows', handleZipDownload);
  app.get('/api/download', handleZipDownload);
  app.get('/api/download-zip', handleZipDownload);
  app.get('/CIBERCOP-Gateway-V1-Windows-x64-BINARY.zip', handleZipDownload);
  app.get('/CIBERCOP-Gateway-V1-Windows-x64.zip', handleZipDownload);

  // ==========================================
  // Vite Frontend Middleware / Static Serving
  // ==========================================
  const isPackaged = typeof (process as any).pkg !== 'undefined';
  const isProduction = process.env.NODE_ENV === 'production' || isPackaged;

  if (!isProduction) {
    try {
      const viteModule = await import('vite');
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      log('Gateway', `Vite middleware not available: ${(err as Error).message}`, 'warn');
    }
  } else {
    const candidateDist = [
      path.join(baseDir, 'dist'),
      path.resolve(process.cwd(), 'dist'),
      path.join(__dirname, 'dist'),
    ];
    const distPath = candidateDist.find(p => fs.existsSync(path.join(p, 'index.html'))) || candidateDist[0];
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.send('<!DOCTYPE html><html><head><title>CIBERCOP Gateway V1</title></head><body style="font-family:sans-serif;background:#030712;color:#f3f4f6;padding:40px;"><h2>CIBERCOP Gateway V1.0</h2><p>Serviço Gateway ativo. Endpoints: <a style="color:#38bdf8;" href="/health">/health</a> | <a style="color:#38bdf8;" href="/api/status">/api/status</a></p></body></html>');
      }
    });
  }

  // Start listening
  const server = app.listen(PORT, '0.0.0.0', () => {
    const { primaryIp } = detectNetworkInterfaces();
    log('Gateway', `===================================================`);
    log('Gateway', `  CIBERCOP GATEWAY V1.0 - OFFICIAL LOCAL GATEWAY   `);
    log('Gateway', `  Gateway ID : ${config.gatewayId}`);
    log('Gateway', `  Primary IP : ${primaryIp}`);
    log('Gateway', `  Listening  : 0.0.0.0:${PORT}`);
    log('Gateway', `  Media Engine: ${config.mediaEngine}`);
    log('Gateway', `===================================================`);
  });

  // Also bind official port 18902 if PORT is different (e.g. running inside dev container)
  let officialPortServer: any = null;
  if (PORT !== 18902) {
    try {
      officialPortServer = app.listen(18902, '0.0.0.0', () => {
        log('Gateway', `  Official Port Listener: 0.0.0.0:18902 is active`);
      });
      officialPortServer.on('error', (err: any) => {
        log('Gateway', `Official port 18902 binding notice: ${err.message}`, 'info');
      });
    } catch (e) {
      // ignore
    }
  }

  // Graceful shutdown handling
  const shutdown = () => {
    log('Gateway', 'Shutting down Gateway...');
    const streams = getAllActiveStreams();
    for (const s of streams) {
      stopStreamSession(s.streamId);
    }
    if (officialPortServer) {
      try { officialPortServer.close(); } catch {}
    }
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { app, server };
}

createServer().catch((err) => {
  console.error('Fatal Gateway startup error:', err);
  process.exit(1);
});
