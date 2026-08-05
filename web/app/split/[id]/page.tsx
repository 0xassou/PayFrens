import type {Metadata} from "next";
import {formatUsdc} from "@/lib/format";
import {APP_NAME, absoluteUrl, splitUrl} from "@/lib/env";
import {readSplit} from "@/lib/server/client";
import {isFullyPaid, SplitStatus} from "@/lib/splits";
import {SplitScreen} from "./split-screen";

type Props = {params: Promise<{id: string}>};

/**
 * Embed metadata, so a shared split renders as an interactive card in
 * Farcaster / Base App feeds rather than a bare link.
 *
 * The image URL carries the split's mutable state as query parameters. They
 * change whenever someone pays, whenever the split is cancelled, and whenever
 * the creator edits it, which is what forces feed clients to fetch a fresh card
 * instead of serving the snapshot they cached when the split was first posted.
 *
 * `r` — the edit revision — is not redundant with the other two. Editing is
 * only legal while nothing has been paid and the split is still open, so an
 * edit is precisely the case where `p` and `s` cannot move: without it, a title
 * or amount correction would leave every already-posted card showing the old
 * numbers for good.
 */
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {id} = await params;

  let split = null;
  try {
    split = await readSplit(BigInt(id));
  } catch {
    // Fall through to the generic copy below.
  }

  const title = split?.title || `Split #${id}`;
  const url = splitUrl(id);

  const description = split
    ? split.status === SplitStatus.Cancelled
      ? `${title} — cancelled.`
      : isFullyPaid(split)
        ? `${title} — fully paid, ${formatUsdc(split.totalAmount)}.`
        : `${title} — ${split.paidCount}/${split.participantCount} paid of ${formatUsdc(split.totalAmount)}.`
    : "Split a bill in USDC on Base.";

  const imageUrl = absoluteUrl(
    `/api/og/split/${id}${split ? `?p=${split.paidCount}&s=${split.status}&r=${split.revision}` : ""}`,
  );

  const buttonTitle = split && isFullyPaid(split) ? "View split" : "Pay my share";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{url: imageUrl, width: 1200, height: 800}],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl,
        button: {
          title: buttonTitle,
          action: {
            type: "launch_miniapp",
            name: APP_NAME,
            url,
            splashImageUrl: absoluteUrl("/splash.png"),
            splashBackgroundColor: "#0A0E1A",
          },
        },
      }),
    },
  };
}

export default async function SplitPage({params}: Props) {
  const {id} = await params;
  return <SplitScreen id={id} />;
}
