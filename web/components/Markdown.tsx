"use client";

import React from "react";

// Minimal, dependency-free renderer for the GitHub-flavored-markdown subset the
// analyst drafts produce: headings, bold/italic/code, links, bullet & numbered
// lists, paragraphs. No dangerouslySetInnerHTML. External links open in a new
// tab; internal /t/… deep links stay same-tab.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[1] !== undefined) {
      const href = m[2];
      const internal = href.startsWith("/");
      nodes.push(
        <a
          key={key}
          href={href}
          {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="text-[#1f4e79] underline hover:text-[#0b0b3b] break-words"
        >
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(
        <code key={key} className="font-mono text-[0.85em] bg-black/5 px-1 rounded">
          {m[4]}
        </code>,
      );
    } else if (m[5] !== undefined) {
      nodes.push(<em key={key}>{m[5]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const special = /^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s)/;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level <= 1
          ? "headline text-lg mt-3 mb-1"
          : level === 2
            ? "font-bold text-sm mt-3 mb-1"
            : "font-bold text-xs uppercase tracking-wide text-black/70 mt-2 mb-1";
      blocks.push(
        React.createElement(level <= 2 ? "h3" : "h4", { key: key++, className: cls }, renderInline(h[2], `h${key}`)),
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(
          <li key={items.length} className="ml-4 list-disc">
            {renderInline(lines[i].replace(/^\s*[-*]\s+/, ""), `li${key}-${items.length}`)}
          </li>,
        );
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1 space-y-0.5">
          {items}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(
          <li key={items.length} className="ml-5 list-decimal">
            {renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""), `ol${key}-${items.length}`)}
          </li>,
        );
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-1 space-y-0.5">
          {items}
        </ol>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !special.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1 leading-relaxed">
        {renderInline(para.join(" "), `p${key}`)}
      </p>,
    );
  }
  return <div className="text-sm">{blocks}</div>;
}
