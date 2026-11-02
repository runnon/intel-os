"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Markdown from "./Markdown";
import { requestAnalystDraft, type AnalystMessage } from "@/lib/analyst-client";

// "30 Oct 2026, 12:01 UTC" — a plain date for a general reader (no DTG).
function asOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

// Plain-language Q&A over the theater on screen (signed-in users; each question is a
// model call). Answers cite events as /t/<aor>?ev=<id> links, which select the event
// on this map instead of reloading the page.
export default function AskPanel({
  aor,
  cutoffIso,
  onSelectEvent,
}: {
  aor: string;
  cutoffIso: string;
  onSelectEvent: (id: string) => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/entitlement", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => live && setSignedIn(!!d.signedIn))
      .catch(() => live && setSignedIn(false));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = [
    `What's happening in ${aor} right now?`,
    "What changed in the last 24 hours?",
    "Is anything directly affecting US forces?",
  ];

  async function ask(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: AnalystMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const answer = await requestAnalystDraft(next, { mode: "explain", aor });
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setMessages(messages);
      setInput(content);
    } finally {
      setBusy(false);
    }
  }

  // Event links in answers select the event on this map.
  function onAnswerClick(ev: MouseEvent<HTMLDivElement>) {
    const a = (ev.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href") ?? "";
    const m = href.match(/^\/t\/[a-z]+\?ev=([\w-]+)/);
    if (m?.[1]) {
      ev.preventDefault();
      onSelectEvent(m[1]);
    }
  }

  const next = typeof window !== "undefined" ? window.location.pathname : `/t/${aor.toLowerCase()}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <p className="px-4 py-2 text-[11px] leading-snug text-[#6b675c] border-b border-[#e3ddcc] shrink-0">
        AI answers from this page&apos;s published reporting (as of {asOf(cutoffIso)}). Facts only, no predictions or assessment;
        check the linked sources.
      </p>

      {signedIn === false ? (
        <div className="p-4 space-y-3">
          <p className="text-sm leading-snug">
            Ask questions about {aor} in plain language and get answers linked to the events on the map.
          </p>
          <a
            href={`/signin?next=${encodeURIComponent(next + "?tab=ask")}`}
            className="inline-block font-mono text-[11px] px-3 py-1.5 bg-[#171712] text-[#f5f2ea] hover:bg-[#3a382e]"
          >
            SIGN IN FREE TO ASK
          </a>
          <p className="text-[11px] text-[#6b675c]">Email link, no password. Takes about a minute.</p>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3" onClick={onAnswerClick}>
            {messages.length === 0 && (
              <div className="space-y-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    disabled={busy || signedIn === null}
                    className="block w-full text-left text-[12px] px-3 py-2 border border-[#c9c2ac] hover:border-[#171712] hover:bg-[#eae4d2] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="text-[12px] font-medium bg-[#eae4d2] px-3 py-2">
                  {m.content}
                </p>
              ) : (
                <div key={i} className="text-[12px] leading-relaxed">
                  <Markdown text={m.content} />
                </div>
              ),
            )}
            {busy && <p className="font-mono text-[10px] text-[#6b675c]">Reading the latest reporting…</p>}
            {error && <p className="text-[12px] text-[#a02c2c]">{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form
            className="flex border-t border-[#c9c2ac] shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${aor}…`}
              aria-label={`Ask a question about ${aor}`}
              maxLength={2000}
              className="flex-1 min-w-0 px-3 py-2 text-[13px] bg-transparent outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="font-mono text-[10px] px-3 bg-[#171712] text-[#f5f2ea] disabled:opacity-40"
            >
              ASK
            </button>
          </form>
        </>
      )}
    </div>
  );
}
