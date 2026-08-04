import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { listMembers } from "@/lib/members.functions";
import {
  applyMinuteMention,
  detectMinuteMention,
  filterMembersForMention,
  type MinuteMentionMatch,
  type MinuteMentionMember,
} from "@/lib/minute-mentions";
import { kindLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const AUTOCOMPLETE_STORAGE_KEY = "sgc-dm:minute-autocomplete";

export function readAutocompletePref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(AUTOCOMPLETE_STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

export function writeAutocompletePref(next: boolean) {
  try {
    window.localStorage.setItem(AUTOCOMPLETE_STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type Props = {
  chapterId: string;
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
  rows?: number;
  className?: string;
  placeholder?: string;
  /** Se false, o switch fica no painel pai. Default true. */
  showAutocompleteToggle?: boolean;
  autocompleteOn?: boolean;
  onAutocompleteOnChange?: (on: boolean) => void;
};

type BalloonPos = { top: number; left: number };

/** Espelha estilos do textarea para medir a posição do caret. */
function getCaretOffsetInTextarea(
  ta: HTMLTextAreaElement,
  caretPos: number,
): BalloonPos {
  const style = window.getComputedStyle(ta);
  const mirror = document.createElement("div");
  const props = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "whiteSpace",
    "wordWrap",
    "wordBreak",
  ] as const;

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  for (const p of props) {
    mirror.style[p] = style[p];
  }
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${ta.clientWidth}px`;
  mirror.style.height = "auto";

  const before = ta.value.slice(0, caretPos);
  mirror.textContent = before;
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const top =
    marker.offsetTop - ta.scrollTop + parseFloat(style.borderTopWidth || "0");
  const left =
    marker.offsetLeft -
    ta.scrollLeft +
    parseFloat(style.borderLeftWidth || "0");

  document.body.removeChild(mirror);
  return { top, left };
}

/** Textarea da ata com sugestões após "Irmão …" / "Tio …". */
export function MinuteBodyEditor({
  chapterId,
  value,
  onChange,
  editable,
  rows = 18,
  className,
  placeholder,
  showAutocompleteToggle = true,
  autocompleteOn: autocompleteOnProp,
  onAutocompleteOnChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const balloonRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [balloon, setBalloon] = useState<BalloonPos | null>(null);
  const [autocompleteInternal, setAutocompleteInternal] = useState(true);

  const autocompleteOn = autocompleteOnProp ?? autocompleteInternal;

  useEffect(() => {
    if (autocompleteOnProp == null) {
      setAutocompleteInternal(readAutocompletePref());
    }
  }, [autocompleteOnProp]);

  function setAutocomplete(next: boolean) {
    if (onAutocompleteOnChange) onAutocompleteOnChange(next);
    else {
      setAutocompleteInternal(next);
      writeAutocompletePref(next);
    }
  }

  const membersQ = useQuery({
    queryKey: ["members-minute-mentions", chapterId],
    queryFn: () =>
      listMembers({
        data: { chapterId, status: "all", kind: "all", search: "" },
      }),
    enabled: editable && autocompleteOn && Boolean(chapterId),
    staleTime: 60_000,
  });

  const members = (membersQ.data ?? []) as MinuteMentionMember[];

  const mention = useMemo(() => {
    if (!editable || !autocompleteOn) return null;
    return detectMinuteMention(value.slice(0, caret));
  }, [value, caret, editable, autocompleteOn]);

  const mentionKey = mention
    ? `${mention.titleIndex}:${mention.title}:${mention.query}`
    : null;

  const suggestions = useMemo(() => {
    if (!mention || (mentionKey && mentionKey === dismissedKey)) {
      return [] as MinuteMentionMember[];
    }
    return filterMembersForMention(members, mention.title, mention.query);
  }, [mention, members, mentionKey, dismissedKey]);

  const showPanel =
    Boolean(mention) &&
    mentionKey !== dismissedKey &&
    (suggestions.length > 0 || membersQ.isSuccess);

  useEffect(() => {
    setActiveIdx(0);
  }, [mentionKey]);

  useLayoutEffect(() => {
    if (!showPanel || !mention) {
      setBalloon(null);
      return;
    }
    const ta = taRef.current;
    if (!ta) return;

    const pos = getCaretOffsetInTextarea(ta, caret);
    const lineH = parseFloat(window.getComputedStyle(ta).lineHeight) || 20;
    let top = pos.top + lineH + 4;
    let left = Math.max(8, pos.left);

    // Mantém o balão dentro da área do textarea
    const maxW = ta.clientWidth;
    const balloonW = balloonRef.current?.offsetWidth ?? 280;
    if (left + balloonW > maxW - 8) {
      left = Math.max(8, maxW - balloonW - 8);
    }
    const maxH = ta.clientHeight;
    const balloonH = balloonRef.current?.offsetHeight ?? 160;
    if (top + balloonH > maxH - 4) {
      top = Math.max(8, pos.top - balloonH - 4);
    }

    setBalloon({ top, left });
  }, [showPanel, mention, caret, value, suggestions.length]);

  function updateCaretFromEl(el: HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function accept(member: MinuteMentionMember, match: MinuteMentionMatch) {
    const el = taRef.current;
    const at = el?.selectionStart ?? caret;
    const { text, caret: nextCaret } = applyMinuteMention(
      value,
      at,
      match,
      member.full_name,
    );
    onChange(text);
    setDismissedKey(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || mentionKey === dismissedKey) return;
    if (suggestions.length === 0 && e.key !== "Escape") return;

    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if ((e.key === "Enter" || e.key === "Tab") && suggestions.length > 0) {
      e.preventDefault();
      accept(suggestions[activeIdx] ?? suggestions[0], mention);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (mentionKey) setDismissedKey(mentionKey);
    }
  }

  const balloonStyle: CSSProperties | undefined = balloon
    ? { top: balloon.top, left: balloon.left }
    : { top: 12, left: 12, visibility: "hidden" };

  return (
    <div>
      {editable && showAutocompleteToggle ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          <Label
            htmlFor="minute-autocomplete"
            className="cursor-pointer text-xs font-normal text-muted-foreground"
          >
            Autocomplete de nomes
          </Label>
          <Switch
            id="minute-autocomplete"
            checked={autocompleteOn}
            onCheckedChange={setAutocomplete}
            aria-label="Autocomplete de nomes na ata"
          />
        </div>
      ) : null}

      <div ref={wrapRef} className="relative">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateCaretFromEl(e.target);
          }}
          onClick={(e) => updateCaretFromEl(e.currentTarget)}
          onKeyUp={(e) => updateCaretFromEl(e.currentTarget)}
          onSelect={(e) => updateCaretFromEl(e.currentTarget)}
          onScroll={() => {
            if (!showPanel || !taRef.current) return;
            const ta = taRef.current;
            const pos = getCaretOffsetInTextarea(ta, caret);
            const lineH =
              parseFloat(window.getComputedStyle(ta).lineHeight) || 20;
            setBalloon({
              top: pos.top + lineH + 4,
              left: Math.max(8, pos.left),
            });
          }}
          onKeyDown={onKeyDown}
          rows={rows}
          readOnly={!editable}
          className={className}
          placeholder={placeholder}
        />

        {showPanel && mention ? (
          <div
            ref={balloonRef}
            role="listbox"
            aria-label={`Sugestões de ${mention.title}`}
            className={cn(
              "pointer-events-auto absolute z-30 w-[min(18rem,calc(100%-1rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-black/5",
              "animate-in fade-in-0 zoom-in-95 duration-150",
            )}
            style={balloonStyle}
          >
            <div className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {mention.title} · ↑↓ · Enter
            </div>

            {suggestions.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto p-1">
                {suggestions.map((m, i) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activeIdx}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        i === activeIdx ? "bg-muted" : "hover:bg-muted/60",
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        accept(m, mention);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                    >
                      <span className="truncate font-medium">{m.full_name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {kindLabel(m.kind)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                Nenhum {mention.title === "Tio" ? "maçom" : "DeMolay/sênior"}{" "}
                parecido com “{mention.query}”.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
