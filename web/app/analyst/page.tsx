"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import { requestAnalystDraft, type AnalystMessage } from "@/lib/analyst-client";

const SUGGESTIONS = [
  "Draft a report on threats to US basing in CENTCOM over the issue window.",
  "Summarize maritime and chokepoint events, with sourcing caveats.",
  "What changed since the previous issue? Facts only.",
];

export default function AnalystPage() {
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: AnalystMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setElapsedSeconds(0);
    setBusy(true);
    try {
      const draft = await requestAnalystDraft(next);
      setMessages([...next, { role: "assistant", content: draft }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠ ${e instanceof Error ? e.message : "Drafting failed. Try again."}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="border-b border-[#c9c2ac] px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 bg-[#efeadb] shrink-0">
        <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">
          // THEATER PICTURE
        </a>
        <span className="headline text-xl">ANALYST DRAFTING</span>
        <span className="font-mono text-[10px] text-[#8a2f2f] ml-auto">
          MACHINE-GENERATED DRAFTS · REPORTED FACTS ONLY · NOT A PUBLISHED PRODUCT
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="border border-[#c9c2ac] rounded-md p-5 bg-[#efeadb]">
              <p className="text-sm text-black/70 leading-relaxed">
                Ask for report text over the published theater data. Drafts summarize reported
                facts with sourcing caveats and cite event numbers — they carry no analytic
                judgement (that publishes only over a named analyst&apos;s signature) and are
                never part of the published record.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left font-mono text-xs px-3 py-2 rounded-md border border-[#c9c2ac] hover:border-[#8f8a7c] hover:bg-[#eae4d2]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-md bg-[#171712] text-white px-4 py-2.5 text-sm whitespace-pre-wrap"
                    : "max-w-full rounded-md border border-[#c9c2ac] bg-[#f5f2ea] px-4 py-3"
                }
              >
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {busy && (
            <p className="font-mono text-xs text-[#6b675c]" role="status" aria-live="polite">
              Drafting from published issues… {elapsedSeconds}s
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[#c9c2ac] bg-[#efeadb] shrink-0">
        <form
          className="max-w-3xl mx-auto px-4 py-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for a facts-only draft covering the theaters you care about…"
            className="flex-1 border border-black/20 rounded-md px-3 py-2 text-sm bg-[#f5f2ea] focus:outline-none focus:border-[#171712]"
          />
          <button
            type="submit"
            disabled={busy}
            className="font-mono text-xs px-4 py-2 rounded-md bg-[#171712] text-white disabled:opacity-50 hover:bg-[#3a382e]"
          >
            DRAFT
          </button>
        </form>
      </div>
    </div>
  );
}
