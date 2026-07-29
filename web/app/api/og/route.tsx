import {ImageResponse} from "next/og";

export const runtime = "edge";

/** The app's own share card, used when the root URL is unfurled. */
export function GET() {
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
    {width: 1200, height: 800},
  );
}
