import axios from 'axios';

const BASE = 'http://localhost:8000';

const client = axios.create({
  baseURL: BASE,
  timeout: 120000,
});

export async function fetchConfig() {
  const { data } = await client.get('/api/config');
  return data;
}

export async function saveConfig(yamlString) {
  const { data } = await client.post('/api/config', { yaml_content: yamlString });
  return data;
}

export async function fetchServices() {
  const { data } = await client.get('/api/services');
  return data;
}

export async function deployService(name) {
  const { data } = await client.post(`/api/services/${encodeURIComponent(name)}/deploy`);
  return data;
}

export async function stopService(name) {
  const { data } = await client.post(`/api/services/${encodeURIComponent(name)}/stop`);
  return data;
}

export async function fetchServerHealth() {
  const { data } = await client.get('/api/servers/health');
  return data;
}

export function createDeploySocket() {
  const url = BASE.replace(/^http/, 'ws') + '/ws/deploy';
  return new WebSocket(url);
}
