import {saveTarget} from "@/lib/server/notification-store";

/**
 * Stores the notification token Base App returns from `addMiniApp`, so the
 * server can push to this user later — after they have closed the app, which is
 * exactly when "someone paid your split" matters.
 */
export async function POST(request: Request) {
  let body: {fid?: number; token?: string; url?: string};

  try {
    body = await request.json();
  } catch {
    return Response.json({error: "Invalid JSON"}, {status: 400});
  }

  const {fid, token, url} = body;

  if (typeof fid !== "number" || !token || !url) {
    return Response.json({error: "fid, token and url are required"}, {status: 400});
  }

  await saveTarget(fid, {token, url});
  return Response.json({ok: true});
}
