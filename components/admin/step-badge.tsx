// Small numbered chip used on multi-step admin workflows (generate then
// assign walkbooks, pick volunteers then walkbooks, etc.).

export function StepBadge({ number, active }: { number: number; active: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
        active ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-500"
      }`}
      aria-hidden
    >
      {number}
    </span>
  );
}
