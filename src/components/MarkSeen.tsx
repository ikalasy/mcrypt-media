"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Marks notifications read once the page has been open for a moment. */
export function MarkSeen({ unread }: { unread: number }) {
  const router = useRouter();
  useEffect(() => {
    if (unread === 0) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/notifications/seen", { method: "POST" }).then(() => router.refresh());
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [unread, router]);
  return null;
}
