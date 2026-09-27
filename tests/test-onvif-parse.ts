import { parseProbeMatch } from '../src/server/onvif/discovery';

const intelbrasXmlSample = `<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Header>
    <MessageID xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:uuid:8b456201-9876-4321-abcd-0123456789ab</MessageID>
    <RelatesTo xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:uuid:probe-123</RelatesTo>
    <To xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</To>
    <Action xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</Action>
  </Header>
  <Body>
    <ProbeMatches xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <ProbeMatch>
        <EndpointReference xmlns="http://schemas.xmlsoap.org/ws/2004/08/addressing">
          <Address>urn:uuid:4a5b6c7d-8e9f-0123-4567-89abcdef0123</Address>
        </EndpointReference>
        <Types>dn:NetworkVideoTransmitter tds:Device</Types>
        <Scopes>
          onvif://www.onvif.org/type/video_encoder
          onvif://www.onvif.org/Profile/Streaming
          onvif://www.onvif.org/hardware/VIP_1230_D_G4
          onvif://www.onvif.org/name/Intelbras_VIP_Camera
          onvif://www.onvif.org/location/Portaria_Norte
        </Scopes>
        <XAddrs>http://192.168.1.108:80/onvif/device_service</XAddrs>
        <MetadataVersion>1</MetadataVersion>
      </ProbeMatch>
    </ProbeMatches>
  </Body>
</Envelope>`;

const result = parseProbeMatch(intelbrasXmlSample, '192.168.1.108');

if (!result) {
  console.error('FAILED: parseProbeMatch returned null');
  process.exit(1);
}

console.log('--- ONVIF PROBE MATCH PARSE VALIDATION ---');
console.log('IP:', result.ip);
console.log('Port:', result.port);
console.log('Manufacturer:', result.manufacturer);
console.log('Hardware:', result.hardware);
console.log('Name:', result.name);
console.log('Primary XAddr:', result.primaryXAddr);
console.log('Scopes count:', result.scopes.length);

if (
  result.ip === '192.168.1.108' &&
  result.port === 80 &&
  result.manufacturer.toLowerCase().includes('intelbras') &&
  result.hardware === 'VIP_1230_D_G4' &&
  result.primaryXAddr === 'http://192.168.1.108:80/onvif/device_service'
) {
  console.log('SUCCESS: All Intelbras ONVIF fields parsed accurately!');
  process.exit(0);
} else {
  console.error('FAILED: Output mismatch');
  process.exit(1);
}
