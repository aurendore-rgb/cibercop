import { buildWsSecurityHeader } from '../src/server/onvif/onvifClient';

console.log('--- VALIDATING ONVIF WS-SECURITY USERNAME TOKEN ---');
const header = buildWsSecurityHeader('admin', 'intelbras123');

console.log('Generated WS-Security Header:');
console.log(header);

if (
  header.includes('<wsse:Username>admin</wsse:Username>') &&
  header.includes('PasswordDigest') &&
  header.includes('<wsse:Nonce') &&
  header.includes('<wsu:Created>')
) {
  console.log('SUCCESS: WS-Security UsernameToken header with PasswordDigest generated correctly.');
  process.exit(0);
} else {
  console.error('FAILED: Invalid WS-Security header structure');
  process.exit(1);
}
