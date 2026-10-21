export const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorJson(error: string, status: number) {
  return json({ error }, status);
}

/** Parses a JSON body; returns undefined when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
