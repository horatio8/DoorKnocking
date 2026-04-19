"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Undo2, CheckCircle2, AlertTriangle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeAssignments } from "@/lib/walkbooks/assign";
import { walkbookColor } from "@/lib/walkbooks/color";
import {
  WalkbookOverviewMap,
  type WalkbookViz,
} from "@/components/admin/walkbook-overview-map";
import { StepBadge } from "@/components/admin/step-badge";

export interface AssignVolunteer {
  id: string;
  full_name: string | null;
  email: string;
  availability: string;
  total_time_budget_minutes: number;
  speed_rating: "slow" | "medium" | "fast";
  currentLoadMinutes: number;
  currentWalkbookCount: number;
  currentDoors: number;
}

export interface AssignWalkbook {
  id: string;
  name: string;
  district_id: string;
  household_count: number;
  estimated_duration_minutes: number | null;
  target_duration_minutes: number | null;
  status: string;
  kind: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

interface Props {
  userId: string;
  districts: Array<{ id: string; name: string; slug: string }>;
  initialDistrictId: string | null;
  walkbooks: AssignWalkbook[];
  stopsByWalkbook: Record<string, Array<{ lat: number; lng: number }>>;
  unassignedWalkbookIds: string[];
  activeAssignmentByWalkbook: Record<string, { user_id: string }>;
  volunteers: AssignVolunteer[];
}

const SPEED_FACTOR: Record<AssignVolunteer["speed_rating"], number> = {
  slow: 0.85,
  medium: 1.0,
  fast: 1.2,
};

interface PendingChange {
  walkbookId: string;
  userId: string | null;
  previousUserId: string | null;
}

export function AssignWalkbooksView(props: Props) {
  const router = useRouter();
  const [districtId, setDistrictId] = useState(props.initialDistrictId ?? "");
  const [filter, setFilter] = useState<"unassigned" | "all">("unassigned");
  const [sort, setSort] = useState<"duration" | "doors" | "name">("duration");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedVolunteers, setSelectedVolunteers] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Map<string, string | null>>(new Map());
  const [undoStack, setUndoStack] = useState<PendingChange[][]>([]);
  const [lockState, setLockState] = useState<"checking" | "held" | "blocked" | "released">("checking");
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoOptions, setAutoOptions] = useState<{
    optimizeFor: "time" | "doors";
    preferClustering: boolean;
    selectedVolunteerIds: Set<string>;
  }>(() => ({
    optimizeFor: "time",
    preferClustering: true,
    selectedVolunteerIds: new Set(
      props.volunteers.filter((v) => v.availability === "available").map((v) => v.id),
    ),
  }));

  // Initial lock claim + heartbeat every 5 minutes.
  useEffect(() => {
    if (!districtId) return;
    let alive = true;
    async function claim(force = false) {
      try {
        const res = await fetch("/api/walkbooks/assign/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ districtId, force }),
        });
        const body = await res.json();
        if (!alive) return;
        if (res.status === 409) {
          setLockState("blocked");
          setLockHolder(body.heldBy);
          return;
        }
        if (!res.ok) {
          setLockState("released");
          setError(body.error ?? `${res.status}`);
          return;
        }
        setLockState("held");
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }
    claim();
    const handle = window.setInterval(() => claim(), 5 * 60_000);
    const unload = () => {
      navigator.sendBeacon?.(
        `/api/walkbooks/assign/session?districtId=${encodeURIComponent(districtId)}`,
      );
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      alive = false;
      window.clearInterval(handle);
      window.removeEventListener("beforeunload", unload);
      fetch(
        `/api/walkbooks/assign/session?districtId=${encodeURIComponent(districtId)}`,
        { method: "DELETE" },
      ).catch(() => undefined);
    };
  }, [districtId]);

  async function takeOver() {
    setLockState("checking");
    const res = await fetch("/api/walkbooks/assign/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtId, force: true }),
    });
    if (res.ok) setLockState("held");
    else setLockState("blocked");
  }

  // Filter + sort walkbooks for display.
  // Map payload — every walkbook in the active district with its stops.
  const mapWalkbooks: WalkbookViz[] = useMemo(
    () =>
      props.walkbooks
        .filter((w) => w.district_id === districtId)
        .map((w) => ({
          id: w.id,
          name: w.name,
          stops: props.stopsByWalkbook[w.id] ?? [],
        }))
        .filter((w) => w.stops.length > 0),
    [props.walkbooks, props.stopsByWalkbook, districtId],
  );

  const filteredWalkbooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = props.walkbooks.filter((w) => w.district_id === districtId);
    if (filter === "unassigned") {
      list = list.filter((w) => {
        const pendingFor = pending.get(w.id);
        if (pendingFor !== undefined) return pendingFor === null;
        return !props.activeAssignmentByWalkbook[w.id];
      });
    }
    if (q) list = list.filter((w) => w.name.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "doors") return b.household_count - a.household_count;
      // duration desc
      return (
        (b.estimated_duration_minutes ?? b.target_duration_minutes ?? 0) -
        (a.estimated_duration_minutes ?? a.target_duration_minutes ?? 0)
      );
    });
    return list;
  }, [props.walkbooks, props.activeAssignmentByWalkbook, filter, sort, search, districtId, pending]);

  // Effective user on a walkbook: pending > original active > null.
  function assigneeFor(wbId: string): string | null {
    if (pending.has(wbId)) return pending.get(wbId) ?? null;
    return props.activeAssignmentByWalkbook[wbId]?.user_id ?? null;
  }

  // Live volunteer load including pending changes.
  const liveVolunteerLoad = useMemo(() => {
    const base = new Map(
      props.volunteers.map((v) => [v.id, { minutes: v.currentLoadMinutes, count: v.currentWalkbookCount, doors: v.currentDoors }]),
    );
    for (const w of props.walkbooks) {
      const original = props.activeAssignmentByWalkbook[w.id]?.user_id ?? null;
      const next = pending.has(w.id) ? pending.get(w.id) ?? null : original;
      if (original === next) continue;
      const minutes = w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0;
      if (original) {
        const e = base.get(original);
        if (e) {
          e.minutes -= minutes;
          e.count -= 1;
          e.doors -= w.household_count;
        }
      }
      if (next) {
        const e = base.get(next);
        if (e) {
          e.minutes += minutes;
          e.count += 1;
          e.doors += w.household_count;
        }
      }
    }
    return base;
  }, [props.volunteers, props.walkbooks, props.activeAssignmentByWalkbook, pending]);

  const selectedMinutes = useMemo(() => {
    let total = 0;
    let doors = 0;
    for (const id of selected) {
      const w = props.walkbooks.find((x) => x.id === id);
      if (!w) continue;
      total += w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0;
      doors += w.household_count;
    }
    return { total, doors };
  }, [selected, props.walkbooks]);

  function toggleSelected(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleVolunteer(id: string) {
    const next = new Set(selectedVolunteers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedVolunteers(next);
  }

  // Assigns every currently-selected walkbook across every currently-selected
  // volunteer. One volunteer → all walkbooks to them. Multiple volunteers →
  // LPT bin-pack among the selected ones.
  function assignSelectedToSelectedVolunteers() {
    if (selected.size === 0 || selectedVolunteers.size === 0) return;

    const selectedVolList = props.volunteers.filter((v) => selectedVolunteers.has(v.id));
    const selectedWbList = props.walkbooks.filter(
      (w) => selected.has(w.id) && w.district_id === districtId,
    );
    if (selectedVolList.length === 0 || selectedWbList.length === 0) return;

    // Overload warning on single-volunteer path.
    if (selectedVolList.length === 1) {
      const vol = selectedVolList[0];
      const factor = SPEED_FACTOR[vol.speed_rating];
      const capacity = vol.total_time_budget_minutes * factor;
      const currentMinutes = liveVolunteerLoad.get(vol.id)?.minutes ?? 0;
      const newMinutes = currentMinutes + selectedMinutes.total;
      if (newMinutes > capacity * 1.1) {
        const pct = Math.round((newMinutes / capacity) * 100);
        const msg =
          `This puts ${vol.full_name ?? vol.email} at ${Math.round(newMinutes / 60)}h ${newMinutes % 60}m` +
          ` (${pct}% of their ${Math.round(capacity / 60)}h effective budget, rating=${vol.speed_rating}). Assign anyway?`;
        if (!confirm(msg)) return;
      }
    }

    // Compute assignments. One-volunteer case is trivial; multi uses LPT.
    const assignments =
      selectedVolList.length === 1
        ? selectedWbList.map((w) => ({ walkbookId: w.id, userId: selectedVolList[0].id }))
        : computeAssignments(
            selectedWbList.map((w) => ({
              id: w.id,
              durationMinutes: w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0,
              doors: w.household_count,
              centroidLat: w.centroid_lat,
              centroidLng: w.centroid_lng,
            })),
            selectedVolList.map((v) => ({
              id: v.id,
              totalBudgetMinutes: v.total_time_budget_minutes,
              speedFactor: SPEED_FACTOR[v.speed_rating],
            })),
            { optimizeFor: "time", preferClustering: true },
          ).assignments;

    const changes: PendingChange[] = [];
    const next = new Map(pending);
    for (const a of assignments) {
      const prev = assigneeFor(a.walkbookId);
      if (prev === a.userId) continue;
      changes.push({ walkbookId: a.walkbookId, userId: a.userId, previousUserId: prev });
      next.set(a.walkbookId, a.userId);
    }
    if (changes.length === 0) return;
    setPending(next);
    setUndoStack([...undoStack, changes]);
    setSelected(new Set());
    // Keep the volunteer selection so the admin can immediately load a
    // second batch onto the same people.
  }

  function unassignSelected() {
    if (selected.size === 0) return;
    const changes: PendingChange[] = [];
    const next = new Map(pending);
    for (const id of selected) {
      const prev = assigneeFor(id);
      if (prev === null) continue;
      changes.push({ walkbookId: id, userId: null, previousUserId: prev });
      next.set(id, null);
    }
    if (changes.length === 0) return;
    setPending(next);
    setUndoStack([...undoStack, changes]);
    setSelected(new Set());
  }

  function undo() {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const next = new Map(pending);
    for (const c of last) {
      // Revert to previousUserId; if that's the original (active row), delete pending entry.
      const original = props.activeAssignmentByWalkbook[c.walkbookId]?.user_id ?? null;
      if (c.previousUserId === original) next.delete(c.walkbookId);
      else next.set(c.walkbookId, c.previousUserId);
    }
    setPending(next);
    setUndoStack(undoStack.slice(0, -1));
  }

  function runAutoAssign() {
    const eligibleVolunteers = props.volunteers
      .filter((v) => autoOptions.selectedVolunteerIds.has(v.id))
      .map((v) => ({
        id: v.id,
        totalBudgetMinutes: v.total_time_budget_minutes,
        speedFactor: SPEED_FACTOR[v.speed_rating],
      }));
    if (eligibleVolunteers.length === 0) {
      setError("Pick at least one volunteer to auto-assign to.");
      return;
    }
    // Target: walkbooks that are currently unassigned (no pending + no active).
    const targetWalkbooks = props.walkbooks
      .filter((w) => w.district_id === districtId)
      .filter((w) => assigneeFor(w.id) === null)
      .map((w) => ({
        id: w.id,
        durationMinutes: w.estimated_duration_minutes ?? w.target_duration_minutes ?? 0,
        doors: w.household_count,
        centroidLat: w.centroid_lat,
        centroidLng: w.centroid_lng,
      }));
    if (targetWalkbooks.length === 0) {
      setError("No unassigned walkbooks to auto-assign.");
      return;
    }
    const result = computeAssignments(targetWalkbooks, eligibleVolunteers, {
      optimizeFor: autoOptions.optimizeFor,
      preferClustering: autoOptions.preferClustering,
    });

    // Merge into pending changes.
    const next = new Map(pending);
    const batch: PendingChange[] = [];
    for (const a of result.assignments) {
      const prev = assigneeFor(a.walkbookId);
      if (prev === a.userId) continue;
      next.set(a.walkbookId, a.userId);
      batch.push({ walkbookId: a.walkbookId, userId: a.userId, previousUserId: prev });
    }
    setPending(next);
    setUndoStack([...undoStack, batch]);
    setAutoOpen(false);
    if (result.unassigned.length > 0) {
      setError(
        `Auto-assigned ${result.assignments.length}/${targetWalkbooks.length}. ${result.unassigned.length} walkbook(s) didn't fit any volunteer's capacity — increase budgets or add volunteers.`,
      );
    } else {
      setError(null);
    }
  }

  async function confirmAll() {
    if (pending.size === 0) {
      setError("No pending changes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const assignments: Array<{ walkbookId: string; userId: string | null }> = [];
      for (const [walkbookId, userId] of pending) {
        assignments.push({ walkbookId, userId });
      }
      // Method = auto if every pending change came from the most recent
      // auto-assign run (approximated by: was autoOpen used this session?).
      // Tracked implicitly as 'hybrid' for now when any manual + auto mix.
      const method: "manual" | "auto" | "hybrid" = "manual";
      const res = await fetch("/api/walkbooks/assign/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId,
          method,
          notes: notes.trim() || undefined,
          assignments,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      router.push(`/admin/walkbooks?assigned=${body.walkbookCount}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (props.districts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
        No districts under the active client. Create a district first.
      </div>
    );
  }

  if (lockState === "blocked") {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-lg border border-crimson/30 bg-crimson/5 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-crimson">
          <Lock className="h-4 w-4" /> Another admin is currently assigning walkbooks for this district
        </div>
        <p className="text-sm text-muted-foreground">
          Only one admin can hold the assignment lock at a time. You can take over — their pending
          draft will be discarded.
        </p>
        <div className="flex gap-2">
          <Button onClick={takeOver} variant="accent">
            Take over
          </Button>
          <Link href="/admin/walkbooks" className="inline-flex items-center rounded-md border border-navy-200 bg-white px-3 py-1.5 text-sm">
            Back to walkbooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/walkbooks"
          className="inline-flex items-center gap-1 text-sm text-navy-700"
        >
          <ArrowLeft className="h-4 w-4" /> Walkbooks
        </Link>
        {props.districts.length > 1 ? (
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="rounded-md border border-navy-200 bg-white px-2 py-1 text-sm"
          >
            {props.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Assign walkbooks</h1>
        <p className="text-sm text-muted-foreground">
          <strong>1.</strong> Select volunteers to assign. <strong>2.</strong> Select walkbooks to
          assign. <strong>3.</strong> Hit Assign — one volunteer gets them all, multiple share them
          via automatic distribution. Session-locked — only one admin at a time.
        </p>
      </div>

      <WalkbookOverviewMap
        walkbooks={mapWalkbooks}
        greyedIds={selected}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1">
        {/* Column 2 on desktop — walkbook checklist */}
        <div
          className={`flex max-h-[70vh] flex-col rounded-lg border bg-white transition ${
            selectedVolunteers.size === 0 ? "border-border opacity-60" : "border-navy-200"
          }`}
        >
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <StepBadge number={2} active={selectedVolunteers.size > 0} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900">Select walkbooks</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedVolunteers.size === 0
                    ? "Pick volunteers first — walkbooks unlock once step 1 is done."
                    : `Check the walkbooks to hand to the ${selectedVolunteers.size} selected volunteer${selectedVolunteers.size === 1 ? "" : "s"}.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search walkbooks"
                className="flex-1 rounded border border-navy-200 px-2 py-1 text-sm"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded border border-navy-200 px-2 py-1 text-sm"
              >
                <option value="duration">By duration</option>
                <option value="doors">By doors</option>
                <option value="name">By name</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFilter("unassigned")}
                className={`rounded-full border px-2 py-0.5 ${filter === "unassigned" ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-700"}`}
              >
                Unassigned
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full border px-2 py-0.5 ${filter === "all" ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-700"}`}
              >
                All
              </button>
            </div>
          </div>
          <ul className="flex-1 divide-y divide-border overflow-auto">
            {filteredWalkbooks.map((w) => {
              const checked = selected.has(w.id);
              const assignee = assigneeFor(w.id);
              const pendingMarker = pending.has(w.id);
              const color = checked ? "#9ca3af" : walkbookColor(w.id);
              return (
                <li
                  key={w.id}
                  className={`flex items-center gap-2 border-l-4 p-2 text-sm transition ${
                    checked ? "bg-navy-50/60" : ""
                  }`}
                  style={{ borderLeftColor: color }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(w.id)}
                    className="flex-none"
                  />
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${checked ? "text-navy-500" : "text-navy-900"}`}>
                      {w.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {w.household_count} doors · ~
                      {w.estimated_duration_minutes ?? w.target_duration_minutes ?? "?"}m
                      {assignee ? (
                        <>
                          {" · "}
                          <span className={pendingMarker ? "text-amber-700" : ""}>
                            → {props.volunteers.find((v) => v.id === assignee)?.full_name ?? "knocker"}
                            {pendingMarker ? " (pending)" : ""}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
            {filteredWalkbooks.length === 0 ? (
              <li className="p-6 text-center text-xs text-muted-foreground">
                No walkbooks match.
              </li>
            ) : null}
          </ul>
          <div className="border-t border-border bg-navy-50/40 p-2 text-xs">
            {selected.size > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span>
                  <strong>{selected.size}</strong> selected · {selectedMinutes.doors} doors ·{" "}
                  {Math.floor(selectedMinutes.total / 60)}h {selectedMinutes.total % 60}m
                </span>
                <button
                  type="button"
                  onClick={unassignSelected}
                  className="text-navy-700 underline"
                >
                  Unassign
                </button>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {selectedVolunteers.size === 0
                  ? "Pick volunteers first, then check walkbooks"
                  : `Check walkbooks to assign to the ${selectedVolunteers.size} selected volunteer${selectedVolunteers.size === 1 ? "" : "s"}`}
              </span>
            )}
          </div>
        </div>

        {/* Column 1 on desktop — volunteer roster (checkbox-selectable) */}
        <div className="flex max-h-[70vh] flex-col rounded-lg border border-navy-200 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-border p-3">
            <div className="flex items-start gap-2">
              <StepBadge number={1} active />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900">Select volunteers</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedVolunteers.size > 0
                    ? `${selectedVolunteers.size} picked · ${props.volunteers.length} total`
                    : `Tick one or more — ${props.volunteers.length} available for this client.`}
                </p>
              </div>
            </div>
            {selectedVolunteers.size > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedVolunteers(new Set())}
                className="text-[11px] text-navy-600 underline"
              >
                Clear
              </button>
            ) : null}
          </div>
          <ul className="flex-1 divide-y divide-border overflow-auto">
            {props.volunteers.map((v) => {
              const load = liveVolunteerLoad.get(v.id) ?? {
                minutes: v.currentLoadMinutes,
                count: v.currentWalkbookCount,
                doors: v.currentDoors,
              };
              const capacity = v.total_time_budget_minutes * SPEED_FACTOR[v.speed_rating];
              const pct = capacity > 0 ? (load.minutes / capacity) * 100 : 0;
              const barColor = pct > 110 ? "bg-crimson" : pct > 90 ? "bg-amber-500" : "bg-emerald-500";
              const eligible =
                (v.availability === "available" || v.availability === "out_in_field") &&
                lockState === "held";
              const checked = selectedVolunteers.has(v.id);
              return (
                <li key={v.id} className="p-3">
                  <label
                    className={`flex w-full cursor-pointer items-start gap-2 rounded-md border p-2 transition ${
                      checked
                        ? "border-navy-900 bg-navy-50"
                        : eligible
                          ? "border-navy-200 bg-white hover:border-navy-400"
                          : "border-border bg-navy-50/30 opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!eligible}
                      onChange={() => toggleVolunteer(v.id)}
                      className="mt-0.5 flex-none"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-navy-900">
                          {v.full_name ?? v.email}
                        </p>
                        <Badge variant={v.availability === "available" ? "success" : "secondary"}>
                          {v.availability}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {Math.floor(load.minutes / 60)}h {load.minutes % 60}m of{" "}
                            {Math.round(capacity / 60)}h
                          </span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
                          <div
                            className={`h-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(130, pct)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {load.count} walkbooks · {load.doors} doors · pace {v.speed_rating}
                        </p>
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
            {props.volunteers.length === 0 ? (
              <li className="p-6 text-center text-xs text-muted-foreground">
                No knockers for this client yet. Invite them at <Link href="/admin/users" className="underline">/admin/users</Link>.
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={assignSelectedToSelectedVolunteers}
            disabled={
              selected.size === 0 ||
              selectedVolunteers.size === 0 ||
              busy ||
              lockState !== "held"
            }
            variant="accent"
          >
            {selectedVolunteers.size === 1
              ? `Assign ${selected.size || ""} → 1 volunteer`
              : selectedVolunteers.size > 1
                ? `Distribute ${selected.size || ""} across ${selectedVolunteers.size} volunteers`
                : "Assign"}
          </Button>
          <button
            type="button"
            onClick={unassignSelected}
            disabled={selected.size === 0 || busy}
            className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-3 py-1.5 text-xs text-navy-700 hover:bg-navy-50 disabled:opacity-40"
          >
            Unassign
          </button>
          <button
            type="button"
            onClick={() => setAutoOpen(true)}
            disabled={busy || lockState !== "held"}
            className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-3 py-1.5 text-xs text-navy-700 hover:bg-navy-50 disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3" /> Auto-assign all
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0 || busy}
            className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-3 py-1.5 text-xs text-navy-700 hover:bg-navy-50 disabled:opacity-40"
          >
            <Undo2 className="h-3 w-3" /> Undo ({undoStack.length})
          </button>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Batch notes (optional)"
            className="rounded border border-navy-200 px-2 py-1 text-xs"
            style={{ width: 220 }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {pending.size > 0 ? (
            <span className="flex items-center gap-1 text-navy-900">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              {pending.size} pending change{pending.size === 1 ? "" : "s"}
            </span>
          ) : null}
          <Button onClick={confirmAll} disabled={pending.size === 0 || busy} variant="accent">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {busy ? "Confirming…" : "Confirm & Notify"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded bg-crimson/10 px-3 py-2 text-xs text-crimson">{error}</p>
      ) : null}

      {autoOpen ? (
        <AutoAssignModal
          volunteers={props.volunteers}
          options={autoOptions}
          setOptions={setAutoOptions}
          onRun={runAutoAssign}
          onClose={() => setAutoOpen(false)}
          unassignedCount={
            props.walkbooks.filter(
              (w) => w.district_id === districtId && assigneeFor(w.id) === null,
            ).length
          }
        />
      ) : null}
    </div>
  );
}

function AutoAssignModal({
  volunteers,
  options,
  setOptions,
  onRun,
  onClose,
  unassignedCount,
}: {
  volunteers: AssignVolunteer[];
  options: {
    optimizeFor: "time" | "doors";
    preferClustering: boolean;
    selectedVolunteerIds: Set<string>;
  };
  setOptions: (
    o: {
      optimizeFor: "time" | "doors";
      preferClustering: boolean;
      selectedVolunteerIds: Set<string>;
    } | ((prev: typeof options) => typeof options),
  ) => void;
  onRun: () => void;
  onClose: () => void;
  unassignedCount: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
              <Sparkles className="h-4 w-4" /> Auto-assign walkbooks
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Distributes {unassignedCount} unassigned walkbook{unassignedCount === 1 ? "" : "s"}{" "}
              across selected volunteers using LPT bin-packing.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-navy-400 hover:text-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-500">
              Optimize for
            </p>
            <div className="mt-1 flex gap-2">
              {[
                { key: "time" as const, label: "Equal time" },
                { key: "doors" as const, label: "Equal doors" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setOptions({ ...options, optimizeFor: opt.key })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    options.optimizeFor === opt.key
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-navy-200 bg-white text-navy-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-navy-700">
            <input
              type="checkbox"
              checked={options.preferClustering}
              onChange={(e) =>
                setOptions({ ...options, preferClustering: e.target.checked })
              }
              className="mt-0.5"
            />
            <span>
              Prefer geographic clustering
              <span className="block text-[11px] text-muted-foreground">
                Group nearby walkbooks to the same volunteer so they aren&apos;t driving across
                the district between walkbooks.
              </span>
            </span>
          </label>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-500">
              Volunteers to include ({options.selectedVolunteerIds.size})
            </p>
            <div className="mt-1 max-h-48 space-y-1 overflow-auto rounded-md border border-border bg-navy-50/30 p-2 text-xs">
              {volunteers.map((v) => {
                const picked = options.selectedVolunteerIds.has(v.id);
                return (
                  <label key={v.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => {
                        const next = new Set(options.selectedVolunteerIds);
                        if (picked) next.delete(v.id);
                        else next.add(v.id);
                        setOptions({ ...options, selectedVolunteerIds: next });
                      }}
                    />
                    <span className="flex-1">
                      {v.full_name ?? v.email}{" "}
                      <span className="text-muted-foreground">
                        · {v.speed_rating} · {Math.round(v.total_time_budget_minutes / 60)}h
                      </span>
                    </span>
                    {v.availability !== "available" ? (
                      <span className="text-[11px] text-amber-700">{v.availability}</span>
                    ) : null}
                  </label>
                );
              })}
              {volunteers.length === 0 ? (
                <p className="text-muted-foreground">No volunteers found.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={onRun}
            disabled={options.selectedVolunteerIds.size === 0}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Distribute to pending
          </Button>
        </div>
      </div>
    </div>
  );
}
