import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  fetchConfig,
  fetchServerHealth,
  fetchServices,
  saveConfig as apiSaveConfig,
} from '../api.js';

export function useFleet() {
  const [services, setServices] = useState([]);
  const [serverHealth, setServerHealth] = useState([]);
  const [config, setConfig] = useState({ raw: '', parsed: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConfig = useCallback(async () => {
    try {
      const data = await fetchConfig();
      setConfig({ raw: data.raw ?? '', parsed: data.parsed ?? null });
      setError(null);
    } catch (e) {
      const msg = e.response?.data?.errors?.[0] || e.response?.data?.message || e.message;
      setError(String(msg));
    }
  }, []);

  const refreshServices = useCallback(async () => {
    try {
      const data = await fetchServices();
      setServices(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e.response?.data?.errors?.[0] || e.response?.data?.message || e.message;
      setError(String(msg));
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const data = await fetchServerHealth();
      setServerHealth(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e.response?.data?.errors?.[0] || e.response?.data?.message || e.message;
      setError(String(msg));
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadConfig(), refreshServices(), refreshHealth()]);
    setLoading(false);
  }, [loadConfig, refreshServices, refreshHealth]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadConfig(), refreshServices(), refreshHealth()]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadConfig, refreshServices, refreshHealth]);

  const svcTimer = useRef(null);
  useEffect(() => {
    svcTimer.current = setInterval(() => {
      refreshServices();
    }, 15000);
    return () => clearInterval(svcTimer.current);
  }, [refreshServices]);

  const healthTimer = useRef(null);
  useEffect(() => {
    healthTimer.current = setInterval(() => {
      refreshHealth();
    }, 20000);
    return () => clearInterval(healthTimer.current);
  }, [refreshHealth]);

  const saveConfig = useCallback(async (yamlString) => {
    const res = await apiSaveConfig(yamlString);
    if (res.success) {
      await loadConfig();
    }
    return res;
  }, [loadConfig]);

  return {
    services,
    serverHealth,
    config,
    loading,
    error,
    refetch,
    saveConfig,
    setError,
  };
}

export const FleetContext = createContext(null);

export function useFleetContext() {
  const v = useContext(FleetContext);
  if (!v) {
    throw new Error('useFleetContext must be used within FleetProvider');
  }
  return v;
}
