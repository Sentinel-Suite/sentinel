"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3500";

interface SystemInfo {
  environment: string;
  version: string;
  uptime: number;
  services: {
    postgres: string;
    redis: string;
  };
  ports: {
    api: number;
    web: number;
    admin: number;
  };
}

type ConnectionStatus = "loading" | "connected" | "disconnected";

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkApiStatus() {
      try {
        const [healthRes, systemRes] = await Promise.all([
          fetch(`${API_URL}/api/health`, { cache: "no-store" }),
          fetch(`${API_URL}/api/system`, { cache: "no-store" }),
        ]);

        if (healthRes.ok) {
          setStatus("connected");
        } else {
          setStatus("disconnected");
          setError(`Health check returned ${healthRes.status}`);
        }

        if (systemRes.ok) {
          const data = (await systemRes.json()) as SystemInfo;
          setSystemInfo(data);
        }
      } catch (err) {
        setStatus("disconnected");
        setError(err instanceof Error ? err.message : "Failed to connect to API");
      }
    }

    checkApiStatus();
    const interval = setInterval(checkApiStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Sentinel Suite - Admin Console</h1>
          <p className="mt-2 text-lg text-gray-600">System Administration</p>
          <span className="mt-3 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
            Admin Dashboard
          </span>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">API Connection</h2>
          <div className="flex items-center gap-3">
            <StatusDot status={status} />
            <span className="text-sm font-medium text-gray-700">
              {status === "loading" && "Checking connection..."}
              {status === "connected" && "Connected"}
              {status === "disconnected" && "Disconnected"}
            </span>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-gray-400">API URL: {API_URL}</p>
        </div>

        {systemInfo && (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Environment</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Environment</dt>
                  <dd className="font-medium text-gray-900">{systemInfo.environment}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Version</dt>
                  <dd className="font-medium text-gray-900">{systemInfo.version}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Uptime</dt>
                  <dd className="font-medium text-gray-900">{formatUptime(systemInfo.uptime)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Connected Services</h2>
              <div className="space-y-3">
                <ServiceRow name="PostgreSQL" status={systemInfo.services.postgres} />
                <ServiceRow name="Redis" status={systemInfo.services.redis} />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Port Assignments</h2>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">API</dt>
                  <dd className="font-mono font-medium text-gray-900">{systemInfo.ports.api}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Web</dt>
                  <dd className="font-mono font-medium text-gray-900">{systemInfo.ports.web}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Admin</dt>
                  <dd className="font-mono font-medium text-gray-900">{systemInfo.ports.admin}</dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colorClass =
    status === "connected"
      ? "bg-green-500"
      : status === "disconnected"
        ? "bg-red-500"
        : "bg-yellow-500";

  return (
    <span className="relative flex h-3 w-3">
      {status === "loading" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${colorClass}`} />
    </span>
  );
}

function ServiceRow({ name, status }: { name: string; status: string }) {
  const isConnected = status === "connected";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{name}</span>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className={`text-sm font-medium ${isConnected ? "text-green-700" : "text-red-700"}`}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
