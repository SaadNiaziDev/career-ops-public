export class RequestTooLargeError extends Error {
  readonly maxBytes: number;
  constructor(maxBytes: number) {
    super(`Request body exceeds the ${Math.ceil(maxBytes / 1024)} KB limit.`);
    this.name = "RequestTooLargeError";
    this.maxBytes = maxBytes;
  }
}

/** Read a request body with a hard byte ceiling, including chunked requests. */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw new RequestTooLargeError(maxBytes);
  }
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestTooLargeError(maxBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function readBoundedJson<T>(request: Request, maxBytes: number): Promise<T> {
  const bytes = await readBoundedBody(request, maxBytes);
  return JSON.parse(bytes.toString("utf8")) as T;
}

export async function readBoundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readBoundedBody(request, maxBytes);
  const contentType = request.headers.get("content-type") || "";
  return new Response(bytes as unknown as BodyInit, { headers: { "content-type": contentType } }).formData();
}
