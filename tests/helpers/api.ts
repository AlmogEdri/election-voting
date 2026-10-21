import { POST as register } from "@/app/api/register/route";

export function request(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const { method = "GET", body, headers = {} } = init;
  return new Request(`http://test${url}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function registerUser(name: string, ip = "10.0.0.1") {
  const res = await register(request("/api/register", { method: "POST", body: { name }, headers: { "x-forwarded-for": ip } }));
  const data = await res.json();
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(data)}`);
  return data as { userId: string; deviceToken: string };
}
