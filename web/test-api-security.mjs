import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { proxy } from './src/proxy.ts';

const token = 'test-session-token-for-api-security';

before(() => {
  process.env.CAREER_OPS_SESSION_TOKEN = token;
});

function request(path, { method = 'GET', host = 'localhost:3000', headers = {} } = {}) {
  return new NextRequest(`http://${host}${path}`, { method, headers: { host, ...headers } });
}

function authenticatedHeaders(extra = {}) {
  return {
    cookie: `career_ops_session=${token}`,
    ...extra,
  };
}

test('API requests without the launch session token are rejected', async () => {
  const response = await proxy(request('/api/cv'));
  assert.equal(response.status, 401);
});

test('non-loopback and DNS-rebinding Host values are rejected', async () => {
  const lan = await proxy(request('/api/cv', {
    host: '192.168.1.25:3000',
    headers: authenticatedHeaders(),
  }));
  const rebound = await proxy(request('/api/cv', {
    host: 'attacker.example:3000',
    headers: authenticatedHeaders(),
  }));
  assert.equal(lan.status, 403);
  assert.equal(rebound.status, 403);
});

test('remote Host access requires an explicit exact-host opt-in', async () => {
  const previousAllow = process.env.CAREER_OPS_ALLOW_REMOTE;
  const previousHosts = process.env.CAREER_OPS_ALLOWED_HOSTS;
  delete process.env.CAREER_OPS_ALLOW_REMOTE;
  process.env.CAREER_OPS_ALLOWED_HOSTS = 'career.example.com';
  const blocked = await proxy(request('/api/cv', {
    host: 'career.example.com:3000',
    headers: authenticatedHeaders(),
  }));

  process.env.CAREER_OPS_ALLOW_REMOTE = '1';
  const allowed = await proxy(request('/api/cv', {
    host: 'career.example.com:3000',
    headers: authenticatedHeaders(),
  }));

  if (previousAllow === undefined) delete process.env.CAREER_OPS_ALLOW_REMOTE;
  else process.env.CAREER_OPS_ALLOW_REMOTE = previousAllow;
  if (previousHosts === undefined) delete process.env.CAREER_OPS_ALLOWED_HOSTS;
  else process.env.CAREER_OPS_ALLOWED_HOSTS = previousHosts;

  assert.equal(blocked.status, 403);
  assert.equal(allowed.status, 200);
});

test('cross-origin state changes are rejected even with a valid session', async () => {
  const response = await proxy(request('/api/status', {
    method: 'POST',
    headers: authenticatedHeaders({
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
      'content-type': 'application/json',
    }),
  }));
  assert.equal(response.status, 403);
});

test('simple text/plain writes are rejected before route handling', async () => {
  const response = await proxy(request('/api/status', {
    method: 'POST',
    headers: authenticatedHeaders({
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'text/plain',
      'content-length': '2',
    }),
  }));
  assert.equal(response.status, 415);
});

test('declared oversized worker bodies are rejected before route body parsing', async () => {
  const response = await proxy(request('/api/run', {
    method: 'POST',
    headers: authenticatedHeaders({
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'content-length': '300000',
    }),
  }));
  assert.equal(response.status, 413);
});

test('same-origin JSON writes pass the shared request boundary', async () => {
  const response = await proxy(request('/api/status', {
    method: 'POST',
    headers: authenticatedHeaders({
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    }),
  }));
  assert.equal(response.status, 200);
});

test('the first local page response establishes an HttpOnly session cookie', async () => {
  const response = await proxy(request('/', {
    headers: { accept: 'text/html' },
  }));
  const cookie = response.headers.get('set-cookie') || '';
  assert.match(cookie, /career_ops_session=test-session-token-for-api-security/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
});
