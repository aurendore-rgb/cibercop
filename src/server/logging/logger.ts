/**
 * CIBERCOP Gateway - Structured Logger
 * Enforces security redaction: NEVER logs passwords, tokens, or auth headers.
 */

export type LogCategory = 'Gateway' | 'HTTP' | 'AUTH' | 'ONVIF' | 'CAMERA' | 'RTSP' | 'MEDIA';

export interface LogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const MAX_LOG_HISTORY = 300;
const logHistory: LogEntry[] = [];

/**
 * Redacts sensitive credentials from log text
 */
function redactSensitiveData(text: string): string {
  if (!text) return '';
  return text
    .replace(/(password|passwd|pass|pwd|token|auth|secret|authorization)["':=\s]+([^\s,;}"']+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/rtsp:\/\/([^:]+):([^@]+)@/gi, 'rtsp://$1:[REDACTED]@');
}

export function log(category: LogCategory, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const cleanMsg = redactSensitiveData(message);
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    category,
    level,
    message: cleanMsg,
  };

  logHistory.unshift(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.pop();
  }

  const prefix = `[${category}]`;
  if (level === 'error') {
    console.error(`${entry.timestamp} ${prefix} [ERROR] ${cleanMsg}`);
  } else if (level === 'warn') {
    console.warn(`${entry.timestamp} ${prefix} [WARN] ${cleanMsg}`);
  } else {
    console.log(`${entry.timestamp} ${prefix} ${cleanMsg}`);
  }
}

export function getLogs(limit = 100, category?: LogCategory): LogEntry[] {
  let filtered = logHistory;
  if (category) {
    filtered = filtered.filter(l => l.category === category);
  }
  return filtered.slice(0, limit);
}

export function clearLogs(): void {
  logHistory.length = 0;
}
