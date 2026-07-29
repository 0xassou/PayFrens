import {deleteTarget, saveTarget} from "@/lib/server/notification-store";

/**
 * Lifecycle webhook declared in the manifest. Base App calls it when someone
 * adds or removes PayFrens, or toggles notifications.
 *
 * Adding is what mints a notification token, so this is the other half of
 * `/api/notify/register` — the client-side path covers the in-app add, this
 * covers adds that happen outside it.
 *
 * The payload is JFS-signed (header/payload/signature, base64url). Verifying it
 * requires resolving the signer's key against the Farcaster hub, which needs a
 * hub URL this scaffold does not assume. Until that is wired up, treat this
 * endpoint as untrusted: it may only store or delete a token for the fid inside
 * its own payload, and can never trigger a send.
 */
export async function POST(request: Request) {
  let envelope: {header?: string; payload?: string; signature?: string};

  try {
    envelope = await request.json();
  } catch {
    return Response.json({error: "Invalid JSON"}, {status: 400});
  }

  if (!envelope.header || !envelope.payload) {
    return Response.json({error: "Malformed webhook envelope"}, {status: 400});
  }

  let fid: number;
  let event: WebhookEvent;

  try {
    const header = decodeSegment<{fid: number}>(envelope.header);
    event = decodeSegment<WebhookEvent>(envelope.payload);
    fid = header.fid;
  } catch {
    return Response.json({error: "Could not decode webhook"}, {status: 400});
  }

  if (typeof fid !== "number") {
    return Response.json({error: "Missing fid"}, {status: 400});
  }

  switch (event.event) {
    case "miniapp_added":
    case "notifications_enabled": {
      const details = event.notificationDetails;
      if (details?.token && details.url) {
        await saveTarget(fid, {token: details.token, url: details.url});
      }
      break;
    }

    case "miniapp_removed":
    case "notifications_disabled":
      await deleteTarget(fid);
      break;
  }

  return Response.json({ok: true});
}

type WebhookEvent = {
  event: "miniapp_added" | "miniapp_removed" | "notifications_enabled" | "notifications_disabled";
  notificationDetails?: {token: string; url: string};
};

function decodeSegment<T>(segment: string): T {
  const normalised = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as T;
}
