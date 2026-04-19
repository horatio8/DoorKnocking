"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EditableUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  active: boolean;
  availability: string | null;
  total_time_budget_minutes: number | null;
  speed_rating: string | null;
  default_district_id: string | null;
}

const HOUR_OPTIONS = [4, 8, 12, 20, 40];
const SPEED_OPTIONS: Array<"slow" | "medium" | "fast"> = ["slow", "medium", "fast"];
const AVAILABILITY: Array<"available" | "out_in_field" | "unavailable"> = [
  "available",
  "out_in_field",
  "unavailable",
];

export function EditUserModal({
  user,
  districts,
  clientId,
  onClose,
}: {
  user: EditableUser;
  districts: Array<{ id: string; name: string }>;
  clientId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState<"knocker" | "admin" | "super_admin">(
    user.role as "knocker" | "admin" | "super_admin",
  );
  const [availability, setAvailability] = useState<"available" | "out_in_field" | "unavailable">(
    (user.availability as "available" | "out_in_field" | "unavailable") ?? "available",
  );
  const [speed, setSpeed] = useState<"slow" | "medium" | "fast">(
    (user.speed_rating as "slow" | "medium" | "fast") ?? "medium",
  );
  const [totalHours, setTotalHours] = useState(
    Math.round(((user.total_time_budget_minutes ?? 480) / 60) * 10) / 10,
  );
  const [districtId, setDistrictId] = useState<string | null>(user.default_district_id);
  const [active, setActive] = useState(user.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim() || null,
        role,
        availability,
        speed_rating: speed,
        total_time_budget_minutes: Math.round(totalHours * 60),
        default_district_id: districtId,
        active,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    onClose();
    router.refresh();
  }

  async function removeFromClient() {
    if (!clientId) return;
    if (
      !confirm(
        `Remove ${user.full_name ?? user.email} from this client? They keep their account and any other client access.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove_client_access: [clientId] }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    onClose();
    router.refresh();
  }

  async function deactivateHard() {
    if (!confirm(`Deactivate ${user.full_name ?? user.email}? Any active walkbooks close.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `${res.status}`);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-navy-900">Edit user</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="text-navy-400 hover:text-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs">
              <span className="block font-semibold uppercase tracking-widest text-navy-500">
                Full name
              </span>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label className="text-xs">
              <span className="block font-semibold uppercase tracking-widest text-navy-500">
                Role
              </span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="mt-1 w-full rounded-md border border-navy-200 bg-white px-2 py-2 text-sm"
              >
                <option value="knocker">Knocker</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
            </label>
          </div>

          {districts.length > 0 ? (
            <label className="text-xs">
              <span className="block font-semibold uppercase tracking-widest text-navy-500">
                Default district
              </span>
              <select
                value={districtId ?? ""}
                onChange={(e) => setDistrictId(e.target.value || null)}
                className="mt-1 w-full rounded-md border border-navy-200 bg-white px-2 py-2 text-sm"
              >
                <option value="">(none)</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {role === "knocker" ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                  Total hours available
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {HOUR_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setTotalHours(h)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        totalHours === h
                          ? "border-navy-900 bg-navy-900 text-white"
                          : "border-navy-200 bg-white text-navy-700"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    className="w-16 rounded-full border border-navy-200 px-2 py-1 text-center text-xs"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
                  Pace
                </p>
                <div className="mt-1 flex gap-1.5">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                        speed === s
                          ? "border-navy-900 bg-navy-900 text-white"
                          : "border-navy-200 bg-white text-navy-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
              Availability
            </p>
            <div className="mt-1 flex gap-1.5">
              {AVAILABILITY.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAvailability(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    availability === s
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-navy-200 bg-white text-navy-700"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active account
          </label>
        </div>

        {error ? (
          <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            {clientId ? (
              <button
                type="button"
                onClick={removeFromClient}
                disabled={busy}
                className="rounded-md px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
              >
                Remove from this client
              </button>
            ) : null}
            <button
              type="button"
              onClick={deactivateHard}
              disabled={busy}
              className="rounded-md px-2 py-1 text-xs text-crimson hover:bg-crimson/10"
            >
              Deactivate
            </button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} variant="accent">
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
