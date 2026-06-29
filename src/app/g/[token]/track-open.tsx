"use client";

/*
  Fires once when a guest actually views their gallery, recording an opened
  event. Done from the client so it counts a real view, not a prefetch or a
  server render. The opened event is a soft signal; the downloaded event is the
  one that triggers the review ask.
*/
import { useEffect, useRef } from "react";

export function TrackOpen({ token }: { token: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }
    fired.current = true;
    fetch(`/g/${token}/open`, { method: "POST" }).catch(() => {
      // A missed open event is not worth bothering the guest about.
    });
  }, [token]);

  return null;
}
