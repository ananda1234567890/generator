"use client";

import { useRef, useState } from "react";
import { filterByName, findTagAt, parseTags, spaceAfterTag, unknownTags, type TagAt } from "@/lib/tags";
import type { ClientHeadshot } from "@/lib/client/store";

// A prompt box that lists your headshots when you type "@" or click on an existing @tag.
export function PromptBox({
  value,
  onChange,
  headshots,
  textareaRef,
  maxLength = 1500,
}: {
  value: string;
  onChange: (v: string) => void;
  headshots: ClientHeadshot[];
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  maxLength?: number;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? own;
  const [sug, setSug] = useState<{ tag: TagAt; mode: "type" | "click" } | null>(null);
  const [active, setActive] = useState(0);

  // Typing filters by what follows the "@"; clicking an existing tag shows everything so you can swap it.
  const items = sug ? filterByName(headshots, sug.mode === "type" ? sug.tag.query : "") : [];

  function detect(mode: "type" | "click") {
    const el = ref.current;
    if (!el) return;
    const tag = findTagAt(el.value, el.selectionStart);
    setSug(tag ? { tag, mode } : null);
    setActive(0);
  }

  function pick(h: ClientHeadshot) {
    if (!sug) return;
    const { start, end } = sug.tag;
    const sep = spaceAfterTag(value.slice(end));
    const insert = `@${h.name}${sep}`;
    onChange(value.slice(0, start) + insert + value.slice(end));
    setSug(null);
    const caret = start + insert.length;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(caret, caret);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!sug) return;
    if (e.key === "Escape") return setSug(null);
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[active]);
    }
  }

  const names = headshots.map((h) => h.name);
  const used = parseTags(value, names).names.map((n) => headshots.find((h) => h.name === n)!);
  const unknown = unknownTags(value, names);

  return (
    <div className="relative space-y-2">
      <textarea
        ref={ref}
        rows={6}
        value={value}
        maxLength={maxLength}
        placeholder="Describe the shot… type @ to pick a headshot"
        onChange={(e) => {
          onChange(e.target.value);
          detect("type");
        }}
        onClick={() => detect("click")}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) detect("click");
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setSug(null)}
      />

      {sug && (
        <div
          role="listbox"
          aria-label="Headshots"
          onMouseDown={(e) => e.preventDefault()} // keep focus in the textarea
          className="absolute left-0 right-0 z-20 max-h-60 overflow-auto rounded-xl border border-line bg-panel p-1 shadow-xl"
          style={{ top: "calc(100% - 2.25rem)" }}
        >
          {headshots.length === 0 ? (
            <p className="p-3 text-xs text-muted">No headshots saved yet. Add one in the Headshots tab.</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-xs text-muted">No headshot matches @{sug.tag.query}</p>
          ) : (
            items.map((h, i) => (
              <button
                key={h.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${i === active ? "bg-accent/25" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.preview} alt="" className="h-8 w-8 rounded-full object-cover" />
                <span>@{h.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {used.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          Using:
          {used.map((h) => (
            <span key={h.id} className="flex items-center gap-1 rounded-full border border-line py-0.5 pl-0.5 pr-2 text-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.preview} alt="" className="h-5 w-5 rounded-full object-cover" />@{h.name}
            </span>
          ))}
        </div>
      )}
      {unknown.length > 0 && (
        <p className="text-xs text-amber-400">
          No headshot named {unknown.map((n) => `@${n}`).join(", ")}. Check the spelling, or add it in Headshots. It will be sent as plain text.
        </p>
      )}
    </div>
  );
}
