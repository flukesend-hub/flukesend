/*
  Public self capture page. Reached by scanning a boat's QR. Operator branded
  with the same warm surface and brand colored header as the guest gallery, so a
  guest sees the operator, never Flukesend. No photos here, just the ask: leave
  your email so the crew can send your trip photos.
*/
import { notFound } from "next/navigation";
import { getCaptureByToken } from "@/lib/capture";
import { CaptureForm } from "./capture-form";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await getCaptureByToken(token);
  if (!ctx) {
    notFound();
  }
  const { operator, branding, boats } = ctx;
  const brand = branding?.brand_color ?? "#0b5563";
  // A boat scoped code fixes the boat, so the guest only picks a time. The boat
  // picker copy is only for the operator wide code with more than one boat.
  const lockedBoatName = ctx.boatName;
  const multiBoat = boats.length > 1 && !lockedBoatName;

  return (
    <main style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--paper-ink)", padding: "0 0 60px" }}>
      <div style={{ maxWidth: "460px", margin: "0 auto" }}>
        <div style={{ background: brand, color: "#fff", padding: "34px 26px 30px" }}>
          {/* Logo centered at the top, so the operator's mark reads as the
              header of the page a guest lands on after scanning. */}
          <div style={{ textAlign: "center", marginBottom: "4px" }}>
            {branding?.logo_url ? (
              // The logo already carries the operator name, so no text title.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt={operator.name} style={{ height: "40px" }} />
            ) : (
              <div className="fl-display" style={{ fontSize: "20px", letterSpacing: ".02em", opacity: 0.96 }}>
                {operator.name}
              </div>
            )}
          </div>
          <div className="fl-display" style={{ fontWeight: 500, fontSize: "25px", lineHeight: 1.2, margin: "16px 0 8px", maxWidth: "20ch" }}>
            Get your trip photos
          </div>
          <div style={{ fontSize: "13.5px", opacity: 0.85, lineHeight: 1.5 }}>
            {multiBoat
              ? "Choose your boat and trip time, drop your email, and we will send your photos after the trip."
              : "Choose your trip time, drop your email, and we will send your photos after the trip."}
          </div>
        </div>

        <div style={{ padding: "24px 22px" }}>
          <CaptureForm
            token={token}
            brand={brand}
            operatorName={operator.name}
            boats={boats}
            tripTimes={ctx.tripTimes}
            social={ctx.social}
            defaultBoatId={ctx.link.boat_id ?? ""}
            lockedBoatName={lockedBoatName}
          />
        </div>
      </div>
    </main>
  );
}
