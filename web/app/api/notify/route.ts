import {absoluteUrl} from "@/lib/env";
import {sendNotification} from "@/lib/server/notification-store";

/**
 * The proxy MiniKit posts to. Takes a title and body from the client and
 * forwards them to the caller's stored notification token.
 *
 * Note the deliberate limitation: this only reaches the person who triggered
 * it. The interesting notifications — "Alice paid her share", "your split is
 * fully funded" — are about *someone else's* action and must be sent from a
 * trusted context, which is what `/api/webhook` and `notifySplitEvent` are for.
 * A client cannot be allowed to push to arbitrary fids, or anyone could spam
 * every user of the app.
 */
export async function POST(request: Request) {
  let body: {fid?: number; title?: string; body?: string; targetUrl?: string};

  try {
    body = await request.json();
  } catch {
    return Response.json({error: "Invalid JSON"}, {status: 400});
  }

  const {fid, title, body: text, targetUrl} = body;

  if (typeof fid !== "number" || !title || !text) {
    return Response.json({error: "fid, title and body are required"}, {status: 400});
  }

  const result = await sendNotification({
    fid,
    title,
    body: text,
    targetUrl: targetUrl ?? absoluteUrl("/"),
    notificationId: crypto.randomUUID(),
  });

  return Response.json({result}, {status: result === "sent" ? 200 : 202});
}
