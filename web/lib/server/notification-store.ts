import "server-only";

/**
 * Where a user's notification token lives.
 *
 * Base App hands us a `{token, url}` pair when someone adds the mini-app, and
 * that pair is what lets the server push "someone paid your split" later, while
 * the app is closed. It has to outlive the request that created it.
 *
 * Backed by Upstash Redis when `REDIS_URL` is configured, and by a process-local
 * Map otherwise. The in-memory fallback is for local development only — it dies
 * with the process and is not shared between serverless instances, so
 * notifications will be flaky without Redis in production.
 */

export type NotificationTarget = {token: string; url: string};

const KEY_PREFIX = "payfrens:notify:";

const memory = new Map<string, NotificationTarget>();

const redisUrl = process.env.REDIS_URL;
const redisToken = process.env.REDIS_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);

async function redis(command: unknown[]): Promise<unknown> {
  const response = await fetch(redisUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) throw new Error(`Redis error ${response.status}`);
  const data = (await response.json()) as {result?: unknown};
  return data.result;
}

export async function saveTarget(fid: number, target: NotificationTarget): Promise<void> {
  if (!useRedis) {
    memory.set(String(fid), target);
    return;
  }
  await redis(["SET", `${KEY_PREFIX}${fid}`, JSON.stringify(target)]);
}

export async function getTarget(fid: number): Promise<NotificationTarget | null> {
  if (!useRedis) return memory.get(String(fid)) ?? null;

  const raw = await redis(["GET", `${KEY_PREFIX}${fid}`]);
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(raw) as NotificationTarget;
  } catch {
    return null;
  }
}

export async function deleteTarget(fid: number): Promise<void> {
  if (!useRedis) {
    memory.delete(String(fid));
    return;
  }
  await redis(["DEL", `${KEY_PREFIX}${fid}`]);
}

/**
 * Posts a notification to Base App's notification endpoint for this user.
 *
 * `notificationId` is the idempotency key: sending the same id twice shows the
 * notification once. Callers pass something derived from the event — a split id
 * plus the payer — so a retried webhook cannot buzz someone's phone twice.
 */
export async function sendNotification(input: {
  fid: number;
  title: string;
  body: string;
  targetUrl: string;
  notificationId: string;
}): Promise<"sent" | "no-token" | "rate-limited" | "failed"> {
  const target = await getTarget(input.fid);
  if (!target) return "no-token";

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        notificationId: input.notificationId,
        title: input.title.slice(0, 32),
        body: input.body.slice(0, 128),
        targetUrl: input.targetUrl,
        tokens: [target.token],
      }),
    });

    if (!response.ok) return "failed";

    const result = (await response.json()) as {
      result?: {rateLimitedTokens?: string[]; invalidTokens?: string[]};
    };

    // A token the server rejects will never work again — drop it rather than
    // retrying it forever.
    if (result.result?.invalidTokens?.length) {
      await deleteTarget(input.fid);
      return "failed";
    }

    if (result.result?.rateLimitedTokens?.length) return "rate-limited";
    return "sent";
  } catch {
    return "failed";
  }
}
