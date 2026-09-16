"use client";

import { useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Draft a report on threats to US basing in CENTCOM over the issue window.",
  "Summarize maritime and chokepoint events, with sourcing caveats.",
  "What changed since the previous issue? Facts only.",
];

export default function AnalystPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      setMessages([...next, { role: "assistant", content: data.text ?? `⚠ ${data.error ?? "request failed"}` }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠ ${e instanceof Error ? e.message : "request failed"}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="border-b border-black/15 px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 bg-[#fafafc] shrink-0">
        <a href="/" className="font-mono text-xs tracking-widest text-black/55 hover:text-[#8a6100]">
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
            <div className="border border-black/15 rounded-md p-5 bg-[#fafafc]">
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
                    className="text-left font-mono text-xs px-3 py-2 rounded-md border border-black/15 hover:border-black/40 hover:bg-black/5"
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
                    ? "max-w-[85%] rounded-md bg-[#000057] text-white px-4 py-2.5 text-sm"
                    : "max-w-full rounded-md border border-black/15 bg-white px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <p className="font-mono text-xs text-black/40">drafting…</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-black/15 bg-[#fafafc] shrink-0">
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
            className="flex-1 border border-black/20 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#000057]"
          />
          <button
            type="submit"
            disabled={busy}
            className="font-mono text-xs px-4 py-2 rounded-md bg-[#000057] text-white disabled:opacity-50 hover:bg-[#1a1a7a]"
          >
            DRAFT
          </button>
        </form>
      </div>
    </div>
  );
}
