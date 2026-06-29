/*
  Marketing route group layout. Wraps the public pages ("/", /pricing,
  /operators) in the light, warm marketing theme with the shared nav and footer.
  The app and the dark operator workspace live outside this group.
*/
import { MarketingNav } from "@/app/_ui/marketing-nav";
import { MarketingFooter } from "@/app/_ui/marketing-footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#f8f7f3", color: "#10221f", minHeight: "100dvh" }}>
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
