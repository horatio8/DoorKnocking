"use client";

import { useState } from "react";
import { EditUserModal, type EditableUser } from "@/components/admin/edit-user-modal";

export function UserRowActions({
  user,
  districts,
  clientId,
}: {
  user: EditableUser;
  districts: Array<{ id: string; name: string }>;
  clientId: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-navy-200 bg-white px-2 py-0.5 text-xs font-medium text-navy-700 hover:bg-navy-50"
      >
        Edit
      </button>
      {open ? (
        <EditUserModal
          user={user}
          districts={districts}
          clientId={clientId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
