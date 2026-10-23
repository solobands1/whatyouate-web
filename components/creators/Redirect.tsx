"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sends visitors of a retired address on to its replacement. */
export default function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return null;
}
