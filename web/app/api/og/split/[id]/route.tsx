import {ImageResponse} from "next/og";
import {formatUsdc, percentOf} from "@/lib/format";
import {readSplit} from "@/lib/server/client";
import {isFullyPaid, SplitStatus} from "@/lib/splits";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 800; // 3:2, the aspect ratio Farcaster embeds render at.

/**
 * The share card. This is the image that appears when a split URL is pasted
 * into a Farcaster or Base App feed, and it re-renders per request so the
 * progress it shows is live — a cast from yesterday shows today's `2/3 paid`.
 *
 * Colours are inlined rather than pulled from the design tokens: Satori has no
 * CSS custom property support, and this always renders on the dark surface.
 */
export async function GET(_request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;

  let split = null;
  try {
    split = await readSplit(BigInt(id));
  } catch {
    // Malformed id — fall through to the generic card.
  }

  if (!split) return genericCard();

  const percent = percentOf(split.amountPaid, split.totalAmount);
  const complete = isFullyPaid(split);
  const cancelled = split.status === SplitStatus.Cancelled;

  const accent = cancelled ? "#FF6B7A" : complete ? "#3DDC97" : "#0052FF";
  const status = cancelled
    ? "Cancelled"
    : complete
      ? "Fully paid"
      : `${split.paidCount}/${split.participantCount} paid`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0E1A",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: 16}}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#0052FF",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            P
          </div>
          <div style={{color: "#A3AECB", fontSize: 30, fontWeight: 600}}>PayFrens</div>
        </div>

        <div style={{display: "flex", flexDirection: "column", gap: 20}}>
          <div
            style={{
              color: "#F2F5FF",
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.1,
              // Satori has no ellipsis, so cap the string instead.
              display: "flex",
            }}
          >
            {truncate(split.title || `Split #${split.id}`, 42)}
          </div>

          <div style={{display: "flex", alignItems: "baseline", gap: 20}}>
            <span style={{color: "#FFFFFF", fontSize: 92, fontWeight: 900}}>
              {formatUsdc(split.totalAmount)}
            </span>
            <span style={{color: "#6D7899", fontSize: 34, fontWeight: 600}}>USDC</span>
          </div>
        </div>

        <div style={{display: "flex", flexDirection: "column", gap: 22}}>
          <div
            style={{
              width: "100%",
              height: 20,
              borderRadius: 999,
              background: "#1A2137",
              display: "flex",
            }}
          >
            <div
              style={{
                width: `${Math.max(percent, percent > 0 ? 3 : 0)}%`,
                height: "100%",
                borderRadius: 999,
                background: accent,
              }}
            />
          </div>

          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span style={{color: accent, fontSize: 38, fontWeight: 700}}>{status}</span>
            <span style={{color: "#6D7899", fontSize: 34, fontWeight: 600}}>
              {formatUsdc(split.amountPaid)} of {formatUsdc(split.totalAmount)}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Short cache: the whole point is that the number is current, but a feed
        // scroll should not hammer an RPC either.
        "Cache-Control": "public, max-age=10, stale-while-revalidate=60",
      },
    },
  );
}

function genericCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#0A0E1A",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 116,
            height: 116,
            borderRadius: 32,
            background: "#0052FF",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 68,
            fontWeight: 900,
          }}
        >
          P
        </div>
        <div style={{color: "#F2F5FF", fontSize: 76, fontWeight: 800}}>PayFrens</div>
        <div style={{color: "#A3AECB", fontSize: 36}}>Split bills in USDC on Base</div>
      </div>
    ),
    {width: WIDTH, height: HEIGHT},
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
