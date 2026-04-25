"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Mic, Phone, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HOUSEHOLD_PIN_COLORS,
  HOUSEHOLD_STATUS_LABELS,
  type Household,
  type KnockEvent,
  type KnockStatus,
  type Survey,
  type SurveyQuestion,
  type Tag,
  type Voter,
} from "@/lib/types";
import { useFieldStore } from "@/lib/offline/store";
import { formatRelative } from "@/lib/utils";
import { ConversationRecorder } from "./conversation-recorder";
import { TagPicker } from "./tag-picker";
import { VoterOneLiner } from "./voter-one-liner";

export type KnockHistoryEntry = KnockEvent & {
  knocker_name: string | null;
  survey_name: string | null;
};

type SurveyWithQuestions = Survey & { survey_questions: SurveyQuestion[] };

interface Props {
  userId: string;
  household: Household;
  voters: Voter[];
  recentKnocks: KnockHistoryEntry[];
  // Full set of surveys the volunteer can run at this door. Empty
  // = save with notes/tags only; one = auto-launch; 2+ = picker.
  availableSurveys: SurveyWithQuestions[];
  standardTags: Tag[];
  sessionScriptId?: string | null;
  hasVoiceNoteConsent?: boolean;
}

type SelectionStatus = "contacted" | "no_answer" | "come_back_later" | "refused" | "wrong_address";

const SELECTIONS: Array<{ value: SelectionStatus; label: string; helper?: string }> = [
  { value: "contacted", label: "Home (will talk)", helper: "Start survey" },
  { value: "refused", label: "Home (don’t want to talk)" },
  { value: "come_back_later", label: "Come back later" },
  { value: "wrong_address", label: "Wrong person / address" },
];

export function HouseholdDetail({
  household,
  voters,
  recentKnocks,
  availableSurveys,
  standardTags,
  sessionScriptId,
  hasVoiceNoteConsent = false,
}: Props) {
  const router = useRouter();
  const recordKnock = useFieldStore((s) => s.recordKnock);
  // Picker selection. Default to the first option (highest-priority
  // walkbook attachment / active survey); volunteer can switch when
  // 2+ are present. When the list is empty this stays null and the
  // commit path saves a knock without launching the runner.
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(
    availableSurveys[0]?.id ?? null,
  );
  const selectedSurvey =
    availableSurveys.find((s) => s.id === selectedSurveyId) ?? availableSurveys[0] ?? null;
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [activeStatus, setActiveStatus] = useState<SelectionStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const pillColor = HOUSEHOLD_PIN_COLORS[household.status];

  const priorKnocksByVoter = useMemo(() => {
    const out = new Map<string, KnockHistoryEntry[]>();
    for (const k of recentKnocks) {
      if (!k.voter_id) continue;
      const list = out.get(k.voter_id) ?? [];
      list.push(k);
      out.set(k.voter_id, list);
    }
    return out;
  }, [recentKnocks]);

  async function handleNoAnswer() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await recordKnock({
        household,
        voterId: null,
        status: "no_answer",
        walkbookId: null,
        surveyId: null,
      });
      router.push("/app/map");
      router.refresh();
    } catch (err) {
      setSubmitError((err as Error).message || "Could not save knock — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommit() {
    if (!selectedVoter || !activeStatus) return;
    setSubmitting(true);
    setSubmitError(null);
    const knockStatus: KnockStatus = activeStatus;
    // Launch the survey runner only if (a) the volunteer marked the
    // door 'Home', and (b) there's at least one survey to run.
    // Otherwise we still save the knock — notes / tags / voice-note
    // are captured by the surrounding UI without the runner.
    const shouldLaunchSurvey =
      activeStatus === "contacted" && selectedSurvey !== null;
    console.info("[survey:commit] handleCommit", {
      householdId: household.id,
      voterId: selectedVoter.id,
      status: knockStatus,
      availableCount: availableSurveys.length,
      selectedSurveyId: selectedSurvey?.id ?? null,
      shouldLaunchSurvey,
    });
    try {
      const event = await recordKnock({
        household,
        voterId: selectedVoter.id,
        status: knockStatus,
        walkbookId: null,
        surveyId: shouldLaunchSurvey ? selectedSurvey?.id ?? null : null,
        notes: notes.trim() || undefined,
      });
      console.info("[survey:commit] recordKnock returned", {
        eventId: event.id,
        surveyId: event.survey_id,
      });
      if (shouldLaunchSurvey) {
        router.push(`/app/survey/${event.id}`);
      } else {
        router.push("/app/map");
        router.refresh();
      }
    } catch (err) {
      console.error("[survey:commit] recordKnock failed", err);
      setSubmitError((err as Error).message || "Could not save knock — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 p-4 pb-32">
      <header className="space-y-2 rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-lg font-semibold text-navy-900">
              {household.address_line1}
            </p>
            <p className="text-sm text-muted-foreground">
              {[household.city, household.state, household.zip].filter(Boolean).join(", ")}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: pillColor }} />
            {HOUSEHOLD_STATUS_LABELS[household.status]}
          </Badge>
        </div>
        {household.household_party ? (
          <p className="text-xs text-muted-foreground">Household party: {household.household_party}</p>
        ) : null}
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-navy-700">Residents</h2>
        {voters.length === 0 ? (
          <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
            No voters on file for this address.
          </p>
        ) : (
          <ul className="space-y-2">
            {voters.map((v) => {
              const priors = priorKnocksByVoter.get(v.id) ?? [];
              const visible = priors.slice(0, 3);
              const extra = Math.max(0, priors.length - visible.length);
              return (
                <li key={v.id}>
                  <button
                    onClick={() => {
                      setSelectedVoter(v);
                      setActiveStatus(null);
                      setNotes("");
                      setSelectedTagIds([]);
                      setRecording(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-white p-4 text-left shadow-sm transition hover:border-navy-100"
                  >
                    <div className="flex items-start gap-3">
                      <UserCircle2 className="mt-0.5 h-6 w-6 text-navy-500" />
                      <div className="min-w-0">
                        <p className="font-voter text-base font-semibold text-navy-900">
                          {v.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[v.calculated_party, v.primary_phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {visible.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {visible.map((k) => (
                              <li
                                key={k.id}
                                className="text-[11px] leading-tight text-muted-foreground"
                              >
                                <span className="font-medium text-navy-900">
                                  {k.status.replace(/_/g, " ")}
                                </span>{" "}
                                · {formatRelative(k.knocked_at)}
                                {k.knocker_name ? ` · by ${k.knocker_name}` : ""}
                                {k.survey_name ? ` · ${k.survey_name}` : ""}
                              </li>
                            ))}
                            {extra > 0 ? (
                              <li className="text-[10px] italic text-muted-foreground">
                                and {extra} earlier knock{extra === 1 ? "" : "s"}
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-none text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-white/95 p-3 backdrop-blur">
        {submitError && !selectedVoter ? (
          <p className="mb-2 rounded-md border border-crimson/30 bg-crimson/10 px-3 py-2 text-[12px] text-crimson">
            {submitError}
          </p>
        ) : null}
        <Button
          onClick={handleNoAnswer}
          disabled={submitting}
          variant="outline"
          size="lg"
          className="w-full"
        >
          No answer at this house
        </Button>
      </div>

      {selectedVoter ? (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setSelectedVoter(null)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-navy-100" />
            <div className="space-y-1">
              <p className="font-voter text-xl font-semibold text-navy-900">
                {selectedVoter.display_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {[selectedVoter.calculated_party, selectedVoter.primary_phone].filter(Boolean).join(" · ") || "—"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {selectedVoter.primary_phone ? (
                  <a
                    href={`tel:${selectedVoter.primary_phone}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-navy-700"
                  >
                    <Phone className="h-3 w-3" /> Call
                  </a>
                ) : null}
                {!recording ? (
                  <button
                    type="button"
                    onClick={() => setRecording(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-crimson"
                  >
                    <Mic className="h-3 w-3" /> Record conversation
                  </button>
                ) : null}
              </div>
              <VoterOneLiner voterId={selectedVoter.id} />
            </div>

            {recording ? (
              <div className="mt-4">
                <ConversationRecorder
                  voterId={selectedVoter.id}
                  voterName={selectedVoter.display_name}
                  hasConsent={hasVoiceNoteConsent}
                  onCancel={() => setRecording(false)}
                  onUploaded={() => setRecording(false)}
                />
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-navy-700">Status</p>
                  <div className="grid grid-cols-1 gap-2">
                    {SELECTIONS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setActiveStatus(s.value)}
                        className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                          activeStatus === s.value
                            ? "border-navy bg-navy-50 text-navy-900"
                            : "border-border bg-white text-navy-700 hover:border-navy-100"
                        }`}
                      >
                        <div className="font-medium">{s.label}</div>
                        {s.helper ? (
                          <div className="text-xs text-muted-foreground">{s.helper}</div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                {activeStatus ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest text-navy-700">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <TagPicker
                      districtId={household.district_id}
                      voterId={selectedVoter.id}
                      standardTags={standardTags}
                      selected={selectedTagIds}
                      onChange={setSelectedTagIds}
                    />
                  </div>
                ) : null}
                {activeStatus === "contacted" && availableSurveys.length >= 2 ? (
                  <div className="mt-4 rounded-md border border-navy-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
                      Pick a survey
                    </p>
                    <div className="mt-2 grid gap-1.5">
                      {availableSurveys.map((s) => {
                        const checked = s.id === selectedSurveyId;
                        return (
                          <label
                            key={s.id}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${
                              checked
                                ? "border-navy-900 bg-navy-50"
                                : "border-navy-200 bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="door-survey"
                              checked={checked}
                              onChange={() => setSelectedSurveyId(s.id)}
                              className="mt-0.5 accent-navy-900"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-navy-900">{s.name}</span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                {s.survey_questions.length} question
                                {s.survey_questions.length === 1 ? "" : "s"}
                                {s.status !== "active" ? ` · ${s.status}` : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {activeStatus === "contacted" && availableSurveys.length === 0 ? (
                  <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    No survey is live for this district yet — your knock will still log with notes,
                    tags, and any voice recording above. Ask your admin to publish a survey in
                    /admin/surveys.
                  </p>
                ) : null}
                {activeStatus === "contacted" &&
                selectedSurvey &&
                selectedSurvey.status !== "active" ? (
                  <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    Using a {selectedSurvey.status} survey because nothing has been published yet —
                    your answers still save. Tell your admin to publish &ldquo;{selectedSurvey.name}
                    &rdquo; in /admin/surveys for the official version.
                  </p>
                ) : null}
                {submitError ? (
                  <p className="mt-4 rounded-md border border-crimson/30 bg-crimson/10 px-3 py-2 text-[12px] text-crimson">
                    {submitError}
                  </p>
                ) : null}
                <div className="mt-5 flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedVoter(null)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    disabled={!activeStatus || submitting}
                    onClick={handleCommit}
                    className="flex-1"
                    variant={activeStatus === "contacted" ? "accent" : "primary"}
                  >
                    {activeStatus === "contacted" && selectedSurvey
                      ? availableSurveys.length >= 2
                        ? `Start ${selectedSurvey.name}`
                        : "Start survey"
                      : "Save"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
