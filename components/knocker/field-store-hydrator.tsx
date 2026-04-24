"use client";

import { useEffect } from "react";
import { useFieldStore } from "@/lib/offline/store";

// Mounts invisibly inside the knocker shell and seeds the offline field
// store's userId + districtId the moment the layout loads, so routes
// that never mount the map (household detail, survey runner, hard-
// refreshes, deep links) still have a hydrated user when recordKnock
// fires. The full hydrate() from map-view.tsx still runs when the map
// is active — it overrides households/voters/tags but leaves identity
// alone since setIdentity is a no-op when nothing changed.

export function FieldStoreHydrator({
  userId,
  districtId,
}: {
  userId: string;
  districtId: string | null;
}) {
  const setIdentity = useFieldStore((s) => s.setIdentity);
  useEffect(() => {
    if (!districtId) return;
    setIdentity(userId, districtId);
  }, [userId, districtId, setIdentity]);
  return null;
}
