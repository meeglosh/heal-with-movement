export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function readJSON(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Please send JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new HttpError(413, "The form is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export function checkOrigin(request, origin) {
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== origin
  )
    throw new HttpError(403, "Please return to the website and try again.");
}
