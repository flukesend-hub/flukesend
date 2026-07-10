/*
  The link share (Open Graph) image for the marketing site, served at /og. This
  is what unfurls when someone pastes www.flukesend.com into a text, Slack, or
  social post. A clean branded card on the ocean brand color: the white wordmark
  over a deep ocean gradient with the product's one line promise, instead of a
  stock whale photo. Rendered with next/og (same engine as the story cards) and
  static, so it renders once and every scraper gets the cached PNG.

  The wordmark is embedded as a data URI (see wordmark.ts) so this has no
  runtime file or network dependency.
*/
import { ImageResponse } from "next/og";
import { WORDMARK_WHITE } from "./wordmark";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "linear-gradient(135deg, #0b2430 0%, #164f6e 52%, #1f6f9c 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* The white Flukesend wordmark carries the brand type. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={WORDMARK_WHITE} width={452} height={70} style={{ display: "block" }} alt="" />

        <div
          style={{
            display: "flex",
            marginTop: 38,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -0.5,
            textAlign: "center",
            maxWidth: 860,
            lineHeight: 1.22,
            color: "rgba(255,255,255,0.94)",
          }}
        >
          Photo galleries that turn into reviews
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 48,
            fontSize: 25,
            letterSpacing: 7,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          flukesend.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
