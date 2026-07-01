/*
  Public pricing page. Free trial, then per operator pricing by number of boats,
  with a monthly / yearly toggle. Display only: billing and trial enforcement
  live in the app, this page just shows the plans.
*/
import { Faq, type QA } from "@/app/_ui/faq";
import { PricingTable } from "./pricing-table";

export const metadata = { title: "Pricing - Flukesend" };

const FAQ: QA[] = [
  {
    q: "Is there a free trial?",
    a: "Yes. Your first 3 transfers or 30 guest emails are free, whichever comes first. No card required to start.",
  },
  {
    q: "What do I need to use Flukesend?",
    a: "A laptop, a camera, and an internet connection at home. You edit and send from home after the trip, so nothing has to happen on the boat beyond shooting photos and collecting emails.",
  },
  {
    q: "What counts as a transfer?",
    a: "One send to a trip's guests, however many photos or people are on it. A family of five booked under one name is one transfer.",
  },
  {
    q: "Do my guests need an account?",
    a: "No. Each guest opens a private link, views their gallery, and downloads. No login, no app to install.",
  },
  {
    q: "Who owns the guest emails?",
    a: "You do. Every email is yours to keep and export at any time. You are the sender of record; Flukesend is the processor.",
  },
  {
    q: "When does the review email go out?",
    a: "Automatically, a few hours after a guest downloads their photos. The download is the trigger, so the ask always lands warm.",
  },
  {
    q: "Can I pay yearly?",
    a: "Yes. Yearly billing is two months free, so you pay for ten months and get twelve.",
  },
  {
    q: "Can I use my own branding?",
    a: "Yes. Your logo, brand color, and message flow into every gallery and every email your guests receive.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "56px 24px 20px", textAlign: "center" }}>
        <h1 style={hero}>Simple pricing, per operator</h1>
        <p style={lede}>
          Start free, then pick the plan that fits your fleet. Every plan
          includes the full review engine.
        </p>
        <div style={trial}>
          Free trial: your first <strong>3 transfers or 30 guest emails</strong>,
          on us. No card required.
        </div>
      </section>

      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 40px", textAlign: "center" }}>
        <PricingTable />
      </section>

      <section style={{ maxWidth: "780px", margin: "0 auto", padding: "30px 24px 70px" }}>
        <h2 style={{ ...hero, fontSize: "30px", textAlign: "center", marginBottom: "26px" }}>
          Questions and answers
        </h2>
        <Faq items={FAQ} />
      </section>
    </main>
  );
}

const hero: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "clamp(30px, 5vw, 46px)",
  letterSpacing: "-0.02em",
  color: "#10221f",
  margin: 0,
};
const lede: React.CSSProperties = {
  fontSize: "16.5px",
  lineHeight: 1.6,
  color: "#3a4744",
  maxWidth: "52ch",
  margin: "16px auto 0",
};
const trial: React.CSSProperties = {
  display: "inline-block",
  marginTop: "22px",
  background: "#ffffff",
  border: "1px solid #ecdcb4",
  borderRadius: "999px",
  padding: "10px 18px",
  fontSize: "14px",
  color: "#33502a",
};
