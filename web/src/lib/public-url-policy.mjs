import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net, { isIP } from 'node:net';

const IPV4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

const IPV6_BLOCKED = [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
];

function ipv4ToBigInt(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
}

function ipv6ToBigInt(address) {
  let source = address.toLowerCase();
  if (source.includes('.')) {
    const lastColon = source.lastIndexOf(':');
    const ipv4 = ipv4ToBigInt(source.slice(lastColon + 1));
    if (ipv4 === null) return null;
    source = `${source.slice(0, lastColon)}:${((ipv4 >> 16n) & 0xffffn).toString(16)}:${(ipv4 & 0xffffn).toString(16)}`;
  }
  const halves = source.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return groups.reduce((value, part) => (value << 16n) | BigInt(`0x${part}`), 0n);
}

function inCidr(address, range, prefix, version) {
  const value = version === 4 ? ipv4ToBigInt(address) : ipv6ToBigInt(address);
  const base = version === 4 ? ipv4ToBigInt(range) : ipv6ToBigInt(range);
  if (value === null || base === null) return false;
  const bits = version === 4 ? 32n : 128n;
  const shift = bits - BigInt(prefix);
  return (value >> shift) === (base >> shift);
}

export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) return !IPV4_BLOCKED.some(([range, prefix]) => inCidr(address, range, prefix, 4));
  if (version !== 6 || !inCidr(address, '2000::', 3, 6)) return false;
  return !IPV6_BLOCKED.some(([range, prefix]) => inCidr(address, range, prefix, 6));
}

function isLocalHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'localhost' || ['.localhost', '.local', '.internal', '.test', '.example', '.invalid'].some((suffix) => host.endsWith(suffix));
}

function pinnedLookup(addresses) {
  const vetted = addresses.map((record) => ({ address: record.address, family: record.family || isIP(record.address) }));
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, vetted);
    else callback(null, vetted[0].address, vetted[0].family);
  };
}

export async function resolvePublicUrl(raw, { lookup = (host) => dnsLookup(host, { all: true, verbatim: true }) } = {}) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error('invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only HTTP and HTTPS URLs are allowed');
  if (url.username || url.password) throw new Error('URL credentials are not allowed');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname || isLocalHostname(hostname)) throw new Error('private or local URL is not allowed');

  const version = isIP(hostname);
  if (version) {
    if (!isPublicAddress(hostname)) throw new Error('private or reserved IP address is not allowed');
    return { url, addresses: [{ address: hostname, family: version }] };
  }

  let records;
  try {
    records = await lookup(hostname);
  } catch {
    throw new Error('URL host could not be resolved');
  }
  if (!Array.isArray(records) || records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
    throw new Error('URL host resolves to a private or reserved IP address');
  }
  return { url, addresses: records };
}

export async function validatePublicUrl(raw, options = {}) {
  return (await resolvePublicUrl(raw, options)).url;
}

function pinnedRequest(raw, init = {}, { lookup, maxBytes = 10 * 1024 * 1024, timeoutMs = 15_000 } = {}) {
  return new Promise(async (resolve, reject) => {
    let target;
    let addresses;
    try {
      ({ url: target, addresses } = await resolvePublicUrl(raw, { lookup }));
    } catch (error) {
      reject(error);
      return;
    }
    const protocol = target.protocol === 'https:' ? https : http;
    const host = target.hostname.replace(/^\[|\]$/g, '');
    const headers = new Headers(init.headers);
    headers.set('accept-encoding', 'identity');
    const requestHeaders = Object.fromEntries(headers.entries());
    const req = protocol.request({
      hostname: host,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      method: String(init.method || 'GET').toUpperCase(),
      headers: requestHeaders,
      servername: isIP(host) ? undefined : host,
      lookup: pinnedLookup(addresses),
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy(new Error('URL response exceeds the size limit'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (value === undefined || ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'].includes(name.toLowerCase())) continue;
          responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        const bodyless = [204, 205, 304].includes(res.statusCode || 0);
        try {
          resolve(new Response(bodyless ? null : Buffer.concat(chunks), {
            status: res.statusCode || 502,
            statusText: res.statusMessage,
            headers: responseHeaders,
          }));
        } catch (error) {
          reject(error);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('URL request timed out')));
    if (init.signal) {
      if (init.signal.aborted) req.destroy(new Error('URL request aborted'));
      else init.signal.addEventListener('abort', () => req.destroy(new Error('URL request aborted')), { once: true });
    }
    if (init.body !== undefined && init.body !== null) {
      if (typeof init.body !== 'string' && !Buffer.isBuffer(init.body) && !(init.body instanceof Uint8Array)) {
        req.destroy(new Error('unsupported URL request body'));
        return;
      }
      req.write(init.body);
    }
    req.end();
  });
}

export async function fetchPublicUrl(raw, init = {}, { lookup, fetcher, maxRedirects = 5, maxBytes, timeoutMs } = {}) {
  let target = new URL(String(raw));
  let requestInit = init;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = fetcher
      ? await (async () => {
          await validatePublicUrl(target, { lookup });
          return fetcher(target, { ...requestInit, redirect: 'manual' });
        })()
      : await pinnedRequest(target, requestInit, { lookup, maxBytes, timeoutMs });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    if (hop === maxRedirects) {
      if (maxRedirects === 0) return response;
      throw new Error('too many URL redirects');
    }
    if (response.status === 303 || ([301, 302].includes(response.status) && String(requestInit.method || 'GET').toUpperCase() === 'POST')) {
      const headers = new Headers(requestInit.headers);
      headers.delete('content-length');
      headers.delete('content-type');
      requestInit = { ...requestInit, method: 'GET', body: undefined, headers };
    }
    target = new URL(location, target);
  }
  throw new Error('too many URL redirects');
}

export async function installPublicUrlPolicy(context, options = {}) {
  await context.route('**/*', async (route) => {
    const raw = route.request().url();
    if (/^(about:blank|data:|blob:)/i.test(raw)) return route.continue();
    try {
      await validatePublicUrl(raw, options);
      return route.continue();
    } catch {
      return route.abort('blockedbyclient');
    }
  });
}

export async function startPublicUrlProxy({ lookup } = {}) {
  const server = http.createServer((incoming, outgoing) => {
    void (async () => {
      let target;
      let addresses;
      try {
        ({ url: target, addresses } = await resolvePublicUrl(incoming.url, { lookup }));
      } catch {
        outgoing.writeHead(403, { 'content-type': 'text/plain' });
        outgoing.end('blocked URL');
        return;
      }
      const headers = { ...incoming.headers };
      delete headers['proxy-connection'];
      headers.host = target.host;
      const host = target.hostname.replace(/^\[|\]$/g, '');
      const transport = target.protocol === 'https:' ? https : http;
      const upstream = transport.request({
        hostname: host,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: incoming.method,
        headers,
        servername: isIP(host) ? undefined : host,
        lookup: pinnedLookup(addresses),
      }, (response) => {
        outgoing.writeHead(response.statusCode || 502, response.headers);
        response.pipe(outgoing);
      });
      upstream.on('error', () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
      });
      incoming.pipe(upstream);
    })();
  });

  server.on('connect', (request, client, head) => {
    void (async () => {
      let addresses;
      try {
        ({ addresses } = await resolvePublicUrl(`https://${request.url}`, { lookup }));
      } catch {
        client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      const authority = new URL(`https://${request.url}`);
      const socket = net.connect({ host: addresses[0].address, port: Number(authority.port) || 443 });
      socket.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) socket.write(head);
        socket.pipe(client);
        client.pipe(socket);
      });
      socket.on('error', () => client.destroy());
      client.on('error', () => socket.destroy());
    })();
  });

  server.on('upgrade', (_request, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('could not bind public URL proxy');
  return {
    server: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export async function launchPublicBrowser(chromium, options = {}) {
  const proxy = await startPublicUrlProxy();
  try {
    const browser = await chromium.launch({
      ...options,
      proxy: { ...(options.proxy || {}), server: proxy.server, bypass: '' },
    });
    browser.once('disconnected', () => { void proxy.close(); });
    return browser;
  } catch (error) {
    await proxy.close();
    throw error;
  }
}
