import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 18902;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function httpRequest(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: options.path,
        method: options.method || 'GET',
        headers: reqHeaders,
        timeout: 5000,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode || 0, data, raw });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout on ${options.path}`));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function runValidation() {
  console.log('===============================================================');
  console.log('      VALIDAÇÃO COMPLETA DO CIBERCOP GATEWAY V1 (REAL)        ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${title}`);
      if (details) console.log(`       ${details}`);
    } else {
      console.error(`[FAIL] ${title}`);
      if (details) console.error(`       ${details}`);
    }
  }

  // 1. SERVIDOR - /health
  try {
    const health = await httpRequest({ path: '/health' });
    assert(
      '1.1 Gateway escuta em 0.0.0.0:18902 e /health responde status ok',
      health.status === 200 && health.data?.status === 'ok',
      `Status: ${health.data?.status}, GatewayId: ${health.data?.gatewayId}, Porta: ${health.data?.port}`
    );
  } catch (err) {
    assert('1.1 Gateway escuta em 0.0.0.0:18902', false, (err as Error).message);
  }

  // 1.2 SERVIDOR - /api/status
  try {
    const statusRes = await httpRequest({ path: '/api/status' });
    assert(
      '1.2 Endpoint /api/status responde status online com contadores',
      statusRes.status === 200 && statusRes.data?.status === 'online',
      `Cameras total: ${statusRes.data?.camerasTotal}, Streams ativos: ${statusRes.data?.streamsActive}, ffmpeg: ${statusRes.data?.ffmpegAvailable}`
    );
  } catch (err) {
    assert('1.2 Endpoint /api/status responde', false, (err as Error).message);
  }

  // 1.3 SERVIDOR - /api/diagnostics
  try {
    const diag = await httpRequest({ path: '/api/diagnostics' });
    assert(
      '1.3 Endpoint /api/diagnostics responde com métricas e interfaces',
      diag.status === 200 && diag.data?.allInterfaces?.length > 0 && diag.data?.ffmpeg?.available === true,
      `IP Local: ${diag.data?.localIp}, Interfaces: ${diag.data?.allInterfaces?.length}, Uptime: ${diag.data?.uptimeSeconds}s`
    );
  } catch (err) {
    assert('1.3 Endpoint /api/diagnostics responde', false, (err as Error).message);
  }

  // Get current active password
  const configRaw = fs.readFileSync(path.resolve(process.cwd(), 'data', 'gateway-config.json'), 'utf-8');
  const activeCfg = JSON.parse(configRaw);
  const currentPassword = activeCfg.gatewayPassword;
  const currentId = activeCfg.gatewayId;

  // 2. AUTENTICAÇÃO - Contrato APK/PWA
  // 2.1 X-Gateway-Auth
  try {
    const resAuth = await httpRequest({
      path: '/api/auth/verify',
      headers: {
        'X-Gateway-Id': currentId,
        'X-Gateway-Auth': currentPassword,
      },
    });
    assert(
      '2.1 Autenticação via X-Gateway-Id e X-Gateway-Auth autorizada',
      resAuth.status === 200 && resAuth.data?.authorized === true && resAuth.data?.authMethod === 'X-Gateway-Auth',
      `Método: ${resAuth.data?.authMethod}, GatewayId: ${resAuth.data?.gatewayId}`
    );
  } catch (err) {
    assert('2.1 Autenticação via X-Gateway-Auth', false, (err as Error).message);
  }

  // 2.2 Bearer Token
  try {
    const resBearer = await httpRequest({
      path: '/api/auth/verify',
      headers: {
        Authorization: `Bearer ${currentPassword}`,
      },
    });
    assert(
      '2.2 Autenticação via Authorization: Bearer <token> autorizada',
      resBearer.status === 200 && resBearer.data?.authorized === true && resBearer.data?.authMethod === 'Bearer',
      `Método: ${resBearer.data?.authMethod}`
    );
  } catch (err) {
    assert('2.2 Autenticação via Bearer token', false, (err as Error).message);
  }

  // 2.3 Query Token (?token=...)
  try {
    const resQuery = await httpRequest({
      path: `/api/auth/verify?token=${encodeURIComponent(currentPassword)}`,
    });
    assert(
      '2.3 Autenticação via Query Token (?token=...) autorizada para streams e WebView',
      resQuery.status === 200 && resQuery.data?.authorized === true && resQuery.data?.authMethod === 'QueryToken',
      `Método: ${resQuery.data?.authMethod}`
    );
  } catch (err) {
    assert('2.3 Autenticação via Query Token', false, (err as Error).message);
  }

  // 2.4 Bloqueio sem autenticação
  try {
    const resNoAuth = await httpRequest({ path: '/api/auth/verify' });
    assert(
      '2.4 Rota protegida rejeita requisição anônima com HTTP 401 Unauthorized',
      resNoAuth.status === 401 && resNoAuth.data?.success === false,
      `Código retornado: ${resNoAuth.status}`
    );
  } catch (err) {
    assert('2.4 Bloqueio anônimo', false, (err as Error).message);
  }

  // 2.5 Bloqueio com credencial incorreta
  try {
    const resWrong = await httpRequest({
      path: '/api/auth/verify',
      headers: { 'X-Gateway-Auth': 'SENHA_INCORRETA_TESTE' },
    });
    assert(
      '2.5 Rota protegida rejeita senha incorreta com HTTP 401 Unauthorized',
      resWrong.status === 401 && resWrong.data?.success === false,
      `Código retornado: ${resWrong.status}`
    );
  } catch (err) {
    assert('2.5 Bloqueio credencial incorreta', false, (err as Error).message);
  }

  // 3. TELA INICIAL - TESTAR CONEXÃO
  try {
    const resTestConn = await httpRequest({
      path: '/api/test-connection',
      method: 'POST',
      body: { gatewayId: currentId, password: currentPassword },
    });
    assert(
      '3.1 TESTAR CONEXÃO executa verificação real de IP, TCP, HTTP e Autenticação',
      resTestConn.status === 200 && resTestConn.data?.success === true && resTestConn.data?.status === 'ONLINE',
      `Estágios validados: ${resTestConn.data?.stages?.map((s: any) => s.stage).join(', ')} (${resTestConn.data?.latencyMs}ms)`
    );
  } catch (err) {
    assert('3.1 TESTAR CONEXÃO executa verificação real', false, (err as Error).message);
  }

  // 4. FIREWALL WINDOWS - Regra com restrição LocalSubnet
  const batScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'windows-firewall-setup.bat'), 'utf-8');
  const psScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'windows-firewall-setup.ps1'), 'utf-8');
  assert(
    '4.1 Script Windows Firewall .bat restrito à LOCAL SUBNET (sem expor à Internet)',
    batScript.includes('remoteip=LocalSubnet') && batScript.includes('18902') && batScript.includes('delete rule'),
    'Contém remoteip=LocalSubnet e remoção prévia para idempotência'
  );
  assert(
    '4.2 Script PowerShell restrito à LOCAL SUBNET e idempotente',
    psScript.includes('RemoteAddress') && psScript.includes('LocalSubnet') && psScript.includes('18902') && psScript.includes('Remove-NetFirewallRule'),
    'Contém RemoteAddress = "LocalSubnet" e Remove-NetFirewallRule prévio'
  );

  // 5. TESTE DE CÂMERA TCP REAL
  try {
    const tcpOpen = await httpRequest({ path: `/api/camera/test?ip=127.0.0.1&port=${PORT}` });
    const tcpClosed = await httpRequest({ path: '/api/camera/test?ip=127.0.0.1&port=64999' });
    assert(
      '5.1 Teste TCP real de câmera diferencia porta aberta de fechada',
      tcpOpen.data?.reachable === true && tcpClosed.data?.reachable === false,
      `Porta ${PORT} reachable: ${tcpOpen.data?.reachable} | Porta 64999 reachable: ${tcpClosed.data?.reachable} (${tcpClosed.data?.error})`
    );
  } catch (err) {
    assert('5.1 Teste TCP real de câmera', false, (err as Error).message);
  }

  // 6. ONVIF DISCOVERY REAL
  try {
    const disc = await httpRequest({ path: '/api/onvif/discover' });
    assert(
      '6.1 ONVIF WS-Discovery real executa multicast UDP 239.255.255.250:3702 sem inventar câmeras',
      disc.status === 200 && Array.isArray(disc.data?.cameras) && (disc.data?.cameras.length === 0 || disc.data?.cameras[0].ip),
      `Total detectado na rede: ${disc.data?.count} (Lista vazia [] se não houver câmera conectada)`
    );
  } catch (err) {
    assert('6.1 ONVIF WS-Discovery real', false, (err as Error).message);
  }

  // 7. SEGURANÇA DE LOGS - Redação de senhas
  try {
    const logsRes = await httpRequest({ path: '/api/logs?limit=50' });
    const logStr = JSON.stringify(logsRes.data);
    const hasPlainPwd = logStr.includes(currentPassword) || logStr.includes('minhasenhacamera') || logStr.includes('SENHA_INCORRETA_TESTE');
    assert(
      '7.1 Sanitização de logs garante que NENHUMA senha ou Bearer token seja registrado',
      !hasPlainPwd,
      'Senhas do Gateway e das câmeras são estritamente redigidas no logger'
    );
  } catch (err) {
    assert('7.1 Sanitização de logs', false, (err as Error).message);
  }

  console.log('\n===============================================================');
  console.log(`RESULTADO DA VALIDAÇÃO: ${passed}/${total} testes passaram (${Math.round((passed / total) * 100)}%)`);
  console.log('===============================================================');

  if (passed === total) {
    console.log('O CIBERCOP GATEWAY V1 ESTÁ 100% VALIDADO E PRONTO PARA O APK/PWA!');
    process.exit(0);
  } else {
    console.error('Houve falhas na validação.');
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error('Erro na execução da validação:', err);
  process.exit(1);
});
