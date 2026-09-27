import crypto from 'crypto';
import http from 'http';
import { log } from '../logging/logger';

export interface OnvifCredentials {
  username?: string;
  password?: string;
}

export interface OnvifDeviceInformation {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  hardwareId: string;
}

export interface OnvifProfile {
  token: string;
  name: string;
  videoEncoderConfiguration?: {
    encoding: string;
    resolution: {
      width: number;
      height: number;
    };
    frameRateLimit: number;
  };
}

export interface StreamUriResult {
  uri: string;
  invalidAfter?: string;
  profileToken: string;
}

/**
 * Builds standard ONVIF WS-Security Header with PasswordDigest
 */
export function buildWsSecurityHeader(username?: string, password?: string): string {
  if (!username) return '';

  const pwd = password || '';
  const created = new Date().toISOString();
  // 16 random bytes
  const nonceBytes = crypto.randomBytes(16);
  const nonceBase64 = nonceBytes.toString('base64');

  // PasswordDigest = Base64( SHA-1( nonce + created + password ) )
  const createdBytes = Buffer.from(created, 'utf-8');
  const passwordBytes = Buffer.from(pwd, 'utf-8');
  const combined = Buffer.concat([nonceBytes, createdBytes, passwordBytes]);
  const digest = crypto.createHash('sha1').update(combined).digest('base64');

  return `<s:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
                   xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken wsu:Id="UsernameToken-1">
        <wsse:Username>${escapeXml(username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceBase64}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Sends a raw SOAP request to an ONVIF endpoint
 */
export async function sendOnvifSoap(urlStr: string, bodyXml: string, credentials?: OnvifCredentials, timeoutMs = 6000): Promise<string> {
  const securityHeader = buildWsSecurityHeader(credentials?.username, credentials?.password);

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  ${securityHeader}
  <s:Body>
    ${bodyXml}
  </s:Body>
</s:Envelope>`;

  return new Promise((resolve, reject) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch (err) {
      return reject(new Error(`Invalid ONVIF URL: ${urlStr}`));
    }

    const payload = Buffer.from(envelope, 'utf-8');

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': payload.length,
        'User-Agent': 'CIBERCOP-Gateway/1.0',
      },
      timeout: timeoutMs,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else if (res.statusCode === 401 || (data.includes('Fault') && data.includes('NotAuthorized'))) {
          reject(new Error(`ONVIF Authentication failed (Status: ${res.statusCode}). Check camera username and password.`));
        } else {
          // Some cameras return SOAP Fault in HTTP 500
          if (data.includes('Fault')) {
            const faultReason = extractXmlTag(data, 'Reason') || extractXmlTag(data, 'faultstring') || data.slice(0, 200);
            reject(new Error(`ONVIF SOAP Fault: ${faultReason}`));
          } else {
            reject(new Error(`HTTP error ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Connection to ${parsedUrl.hostname}:${parsedUrl.port || 80} timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(new Error(`Network error contacting camera at ${parsedUrl.hostname}: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

function extractXmlTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<[^:]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:]*:?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Executes GetDeviceInformation
 */
export async function getDeviceInformation(deviceServiceUrl: string, credentials?: OnvifCredentials): Promise<OnvifDeviceInformation> {
  const bodyXml = `<tds:GetDeviceInformation/>`;
  const response = await sendOnvifSoap(deviceServiceUrl, bodyXml, credentials);

  const manufacturer = extractXmlTag(response, 'Manufacturer') || 'Unknown';
  const model = extractXmlTag(response, 'Model') || 'Unknown';
  const firmwareVersion = extractXmlTag(response, 'FirmwareVersion') || 'Unknown';
  const serialNumber = extractXmlTag(response, 'SerialNumber') || 'Unknown';
  const hardwareId = extractXmlTag(response, 'HardwareId') || 'Unknown';

  log('CAMERA', `GetDeviceInformation success: ${manufacturer} ${model} (Firmware: ${firmwareVersion})`);

  return {
    manufacturer,
    model,
    firmwareVersion,
    serialNumber,
    hardwareId,
  };
}

/**
 * Executes GetCapabilities to discover media service endpoint
 */
export async function getCapabilities(deviceServiceUrl: string, credentials?: OnvifCredentials): Promise<{ mediaXAddr: string; ptzXAddr?: string }> {
  const bodyXml = `<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>`;
  const response = await sendOnvifSoap(deviceServiceUrl, bodyXml, credentials);

  // Extract Media XAddr
  let mediaXAddr = '';
  const mediaMatch = response.match(/<[^:]*:?Media[^>]*>[\s\S]*?<[^:]*:?XAddr[^>]*>([\s\S]*?)<\/[^:]*:?XAddr>/i);
  if (mediaMatch) {
    mediaXAddr = mediaMatch[1].trim();
  }

  if (!mediaXAddr) {
    // Standard fallback to /onvif/media_service or /onvif/Media
    const parsed = new URL(deviceServiceUrl);
    mediaXAddr = `${parsed.protocol}//${parsed.host}/onvif/media_service`;
  }

  let ptzXAddr: string | undefined;
  const ptzMatch = response.match(/<[^:]*:?PTZ[^>]*>[\s\S]*?<[^:]*:?XAddr[^>]*>([\s\S]*?)<\/[^:]*:?XAddr>/i);
  if (ptzMatch) {
    ptzXAddr = ptzMatch[1].trim();
  }

  return { mediaXAddr, ptzXAddr };
}

/**
 * Executes GetProfiles to list camera streams/profiles
 */
export async function getProfiles(mediaServiceUrl: string, credentials?: OnvifCredentials): Promise<OnvifProfile[]> {
  const bodyXml = `<trt:GetProfiles/>`;
  const response = await sendOnvifSoap(mediaServiceUrl, bodyXml, credentials);

  const profiles: OnvifProfile[] = [];
  const profileMatches = response.matchAll(/<[^:]*:?Profiles[^>]*token="([^"]+)"[^>]*>([\s\S]*?)<\/[^:]*:?Profiles>/gi);

  for (const match of profileMatches) {
    const token = match[1];
    const profileContent = match[2];
    const name = extractXmlTag(profileContent, 'Name') || token;

    const encoding = extractXmlTag(profileContent, 'Encoding') || 'H264';
    const widthStr = extractXmlTag(profileContent, 'Width');
    const heightStr = extractXmlTag(profileContent, 'Height');
    const frameRateStr = extractXmlTag(profileContent, 'FrameRateLimit');

    profiles.push({
      token,
      name,
      videoEncoderConfiguration: {
        encoding,
        resolution: {
          width: widthStr ? parseInt(widthStr, 10) : 1920,
          height: heightStr ? parseInt(heightStr, 10) : 1080,
        },
        frameRateLimit: frameRateStr ? parseInt(frameRateStr, 10) : 30,
      },
    });
  }

  // Fallback if regex pattern with attributes didn't catch nested elements
  if (profiles.length === 0) {
    const tokenMatches = response.match(/token="([^"]+)"/g);
    if (tokenMatches) {
      tokenMatches.forEach((tm, idx) => {
        const token = tm.replace(/token="([^"]+)"/, '$1');
        profiles.push({
          token,
          name: `Profile_${idx + 1}`,
        });
      });
    }
  }

  log('CAMERA', `GetProfiles found ${profiles.length} profiles for media endpoint ${mediaServiceUrl}`);
  return profiles;
}

/**
 * Executes GetStreamUri to retrieve real RTSP stream URL
 */
export async function getStreamUri(mediaServiceUrl: string, profileToken: string, credentials?: OnvifCredentials): Promise<StreamUriResult> {
  const bodyXml = `<trt:GetStreamUri>
    <trt:StreamSetup>
      <tt:Stream>RTP-Unicast</tt:Stream>
      <tt:Transport>
        <tt:Protocol>RTSP</tt:Protocol>
      </tt:Transport>
    </trt:StreamSetup>
    <trt:ProfileToken>${escapeXml(profileToken)}</trt:ProfileToken>
  </trt:GetStreamUri>`;

  const response = await sendOnvifSoap(mediaServiceUrl, bodyXml, credentials);
  const rawUri = extractXmlTag(response, 'Uri');

  if (!rawUri) {
    throw new Error('GetStreamUri: No RTSP URI returned by camera');
  }

  let finalUri = rawUri;
  // If credentials provided and URI does not contain user/password, embed them for RTSP authentication
  if (credentials?.username && credentials?.password && !finalUri.includes('@')) {
    try {
      const u = new URL(finalUri);
      u.username = encodeURIComponent(credentials.username);
      u.password = encodeURIComponent(credentials.password);
      finalUri = u.toString();
    } catch {
      // If URL parsing fails for RTSP protocol, inject manually
      const cleanPass = encodeURIComponent(credentials.password);
      const cleanUser = encodeURIComponent(credentials.username);
      finalUri = finalUri.replace(/^rtsp:\/\//i, `rtsp://${cleanUser}:${cleanPass}@`);
    }
  }

  log('RTSP', `Real RTSP stream URI retrieved for profile ${profileToken}`);

  return {
    uri: finalUri,
    profileToken,
  };
}

/**
 * Executes GetSnapshotUri
 */
export async function getSnapshotUri(mediaServiceUrl: string, profileToken: string, credentials?: OnvifCredentials): Promise<string> {
  const bodyXml = `<trt:GetSnapshotUri>
    <trt:ProfileToken>${escapeXml(profileToken)}</trt:ProfileToken>
  </trt:GetSnapshotUri>`;

  const response = await sendOnvifSoap(mediaServiceUrl, bodyXml, credentials);
  const rawUri = extractXmlTag(response, 'Uri');

  if (!rawUri) {
    throw new Error('GetSnapshotUri: No snapshot URI returned by camera');
  }

  return rawUri;
}
