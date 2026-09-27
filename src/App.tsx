import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { InitialConnectionCard } from './components/InitialConnectionCard';
import { OnvifCameraPanel } from './components/OnvifCameraPanel';
import { StreamPlayerPanel } from './components/StreamPlayerPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { LogsPanel } from './components/LogsPanel';
import { WindowsSetupGuide } from './components/WindowsSetupGuide';
import {
  CameraClientRecord,
  ConnectionTestResult,
  DiscoveredCamera,
  GatewayConfigData,
} from './types/gateway';

export default function App() {
  const [activeTab, setActiveTab] = useState<'connection' | 'cameras' | 'streaming' | 'diagnostics' | 'logs' | 'guide'>('connection');

  // Gateway Identity & State
  const [gatewayId, setGatewayId] = useState('CIBERCOP-GW01');
  const [password, setPassword] = useState('cibercop2026');
  const [port, setPort] = useState(18902);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [status, setStatus] = useState<'ONLINE' | 'OFFLINE' | 'TESTING'>('OFFLINE');

  // Test connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Cameras state
  const [cameras, setCameras] = useState<CameraClientRecord[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraClientRecord | null>(null);

  // Initial load
  useEffect(() => {
    fetchConfig();
    fetchCameras();
    // Run an initial quick health check
    checkInitialStatus();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data: GatewayConfigData = await res.json();
        setGatewayId(data.gatewayId);
        setPort(data.port || 18902);
        setLocalIp(data.primaryIp);
        if (data.gatewayPassword) {
          setPassword(data.gatewayPassword);
        }
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  const fetchCameras = async () => {
    try {
      const res = await fetch('/api/cameras');
      if (res.ok) {
        const data: CameraClientRecord[] = await res.json();
        setCameras(data);
        if (data.length > 0 && !selectedCamera) {
          setSelectedCamera(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
    }
  };

  const checkInitialStatus = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok') {
          setStatus('ONLINE');
        }
      }
    } catch {
      setStatus('OFFLINE');
    }
  };

  const handleRunTest = async () => {
    setTesting(true);
    setStatus('TESTING');
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayId,
          password,
        }),
      });

      const result: ConnectionTestResult = await res.json();
      setTestResult(result);
      setStatus(result.success ? 'ONLINE' : 'OFFLINE');
    } catch (err) {
      setStatus('OFFLINE');
      setTestResult({
        success: false,
        status: 'OFFLINE',
        latencyMs: 0,
        stages: [
          { stage: 'HTTP_HEALTH', status: 'failed', details: (err as Error).message },
        ],
        gateway: { id: gatewayId, port, primaryIp: localIp },
        error: (err as Error).message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayId,
          gatewayPassword: password,
          port,
        }),
      });
      if (res.ok) {
        await fetchConfig();
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDiscoverOnvif = async (): Promise<DiscoveredCamera[]> => {
    const res = await fetch('/api/onvif/discover');
    const data = await res.json();
    return data.cameras || [];
  };

  const handleAddCamera = async (cam: {
    name: string;
    ip: string;
    port: number;
    username: string;
    password?: string;
    rtspPort?: number;
    manufacturer?: string;
  }) => {
    await fetch('/api/cameras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Id': gatewayId,
        'X-Gateway-Auth': password,
      },
      body: JSON.stringify(cam),
    });
    await fetchCameras();
  };

  const handleDeleteCamera = async (id: string) => {
    await fetch(`/api/cameras/${id}`, {
      method: 'DELETE',
      headers: {
        'X-Gateway-Id': gatewayId,
        'X-Gateway-Auth': password,
      },
    });
    await fetchCameras();
  };

  const handleSelectCameraForStream = (cam: CameraClientRecord) => {
    setSelectedCamera(cam);
    setActiveTab('streaming');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        gatewayId={gatewayId}
        localIp={localIp}
        port={port}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'connection' && (
          <InitialConnectionCard
            gatewayId={gatewayId}
            setGatewayId={setGatewayId}
            password={password}
            setPassword={setPassword}
            port={port}
            setPort={setPort}
            localIp={localIp}
            status={status}
            onRunTest={handleRunTest}
            testResult={testResult}
            onSaveConfig={handleSaveConfig}
            savingConfig={savingConfig}
            testing={testing}
          />
        )}

        {activeTab === 'cameras' && (
          <OnvifCameraPanel
            cameras={cameras}
            onRefreshCameras={fetchCameras}
            onDiscoverOnvif={handleDiscoverOnvif}
            onAddCamera={handleAddCamera}
            onDeleteCamera={handleDeleteCamera}
            onSelectCameraForStream={handleSelectCameraForStream}
            gatewayId={gatewayId}
            gatewayPassword={password}
          />
        )}

        {activeTab === 'streaming' && (
          <StreamPlayerPanel
            cameras={cameras}
            selectedCamera={selectedCamera}
            onSelectCamera={setSelectedCamera}
            localIp={localIp}
            port={port}
            gatewayId={gatewayId}
            gatewayPassword={password}
          />
        )}

        {activeTab === 'diagnostics' && <DiagnosticsPanel />}

        {activeTab === 'logs' && <LogsPanel />}

        {activeTab === 'guide' && (
          <WindowsSetupGuide
            localIp={localIp}
            port={port}
            gatewayId={gatewayId}
            password={password}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 text-slate-500 text-xs py-4 px-6 text-center">
        <span>CIBERCOP GATEWAY V1.0 · Comunicação IP & ONVIF para APK/PWA · Porta 18902 · Windows x64</span>
      </footer>
    </div>
  );
}
