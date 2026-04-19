export function Testimonial() {
  return (
    <section className="relative bg-civic-navy px-8 py-24 text-parchment">
      <span className="absolute right-8 top-[22px] font-mono text-[10px] tracking-[0.2em] text-parchment/35">
        VOL. I · NO. 47
      </span>
      <div className="mx-auto max-w-[880px] text-center">
        <span className="mb-6 block text-sm tracking-[0.4em] text-oxblood">★ ★ ★ ★ ★</span>
        <blockquote className="mb-8 font-serif text-[30px] leading-[1.3] tracking-[-0.005em] text-parchment">
          “We knocked <em className="italic text-oxblood">11,400 doors</em> in six weeks with
          eleven volunteers. Nothing we&rsquo;d used before came close.”
        </blockquote>
        <div className="inline-flex items-center gap-3.5 border-t border-parchment/20 pt-[18px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-parchment font-serif text-base font-semibold text-civic-navy">
            MH
          </div>
          <div className="text-left">
            <div className="text-[13.5px] font-semibold text-parchment">Marcus Hallman</div>
            <div className="text-[11.5px] text-parchment/60">
              Campaign Manager · Pritchett for SC Senate
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
