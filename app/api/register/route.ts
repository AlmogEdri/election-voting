import { Prisma } from "@prisma/client";
import { generateDeviceToken, hashDeviceToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorJson, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { takenNameMessage, validateName } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!rateLimit(`register:${clientIp(request.headers)}`)) {
    return json({ error: "יותר מדי ניסיונות רישום. נסו שוב בעוד דקה." }, 429, { "Retry-After": "60" });
  }

  const body = await readJson(request);
  const name = validateName((body as { name?: unknown } | undefined)?.name);
  if (!name.ok) return errorJson(name.error, 400);

  const deviceToken = generateDeviceToken();
  try {
    // The UNIQUE index on name_norm decides races between concurrent registrations.
    const user = await prisma.user.create({
      data: { name: name.value.name, nameNorm: name.value.nameNorm, deviceToken: hashDeviceToken(deviceToken) },
    });
    return json({ userId: user.id, deviceToken, name: user.name }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorJson(takenNameMessage(name.value.name), 409);
    }
    throw error;
  }
}
