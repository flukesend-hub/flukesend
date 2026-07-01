/*
  The instant response to a click: a pulsing outline of the page shown by each
  route's loading.tsx while the real data loads. Static markup only, so Next
  can paint it the moment navigation starts.
*/

export function PageSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <>
      <div style={navBar}>
        <div className="fl-skeleton" style={{ width: "110px", height: "20px" }} />
        <div className="fl-skeleton" style={{ width: "260px", height: "20px" }} />
      </div>
      <main style={{ padding: "16px 28px 80px" }}>
        <div className="fl-skeleton" style={{ width: "180px", height: "34px", marginBottom: "10px" }} />
        <div className="fl-skeleton" style={{ width: "320px", height: "15px", marginBottom: "26px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "880px" }}>
          {Array.from({ length: blocks }, (_, i) => (
            <div
              key={i}
              className="fl-skeleton"
              style={{ height: i === 0 ? "150px" : "96px", borderRadius: "16px" }}
            />
          ))}
        </div>
      </main>
    </>
  );
}

const navBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 28px",
  borderBottom: "1px solid var(--line)",
};
