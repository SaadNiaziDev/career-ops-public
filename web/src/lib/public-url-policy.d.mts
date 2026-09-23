export type DnsRecord = { address: string; family?: number };
export type UrlPolicyOptions = { lookup?: (hostname: string) => Promise<DnsRecord[]> };
export function isPublicAddress(address: string): boolean;
export function resolvePublicUrl(raw: string, options?: UrlPolicyOptions): Promise<{ url: URL; addresses: DnsRecord[] }>;
export function validatePublicUrl(raw: string, options?: UrlPolicyOptions): Promise<URL>;
export function fetchPublicUrl(raw: string | URL, init?: RequestInit, options?: UrlPolicyOptions & { fetcher?: (url: URL, init?: RequestInit) => Promise<Response>; maxRedirects?: number; maxBytes?: number; timeoutMs?: number }): Promise<Response>;
export function installPublicUrlPolicy(context: { route: (pattern: string, handler: (route: any) => Promise<unknown>) => Promise<unknown> }, options?: UrlPolicyOptions): Promise<void>;
export function startPublicUrlProxy(options?: UrlPolicyOptions): Promise<{ server: string; close: () => Promise<void> }>;
export function launchPublicBrowser(chromium: { launch: (options?: Record<string, unknown>) => Promise<any> }, options?: Record<string, unknown>): Promise<any>;
