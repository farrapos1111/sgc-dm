import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  applyMandatoryMention,
  detectMandatoryMention,
  filterMandatoryMentions,
  type MandatoryMentionOption,
} from "@/lib/calendar-mandatory-mentions";

type BalloonPos = { top: number; left: number };

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
  const top = marker.offsetTop - ta.scrollTop + Number.parseFloat(style.borderTopWidth || "0");
  const left =
    marker.offsetLeft -
    ta.scrollLeft +
    Number.parseFloat(style.borderLeftWidth || "0");
  document.body.removeChild(mirror);
  return { top, left };
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: MandatoryMentionOption[];
  rows?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

/** Descrição de item do calendário com autocomplete de `@data_obrigatoria`. */
export function CalendarDescriptionField({
  value,
  onChange,
  options,
  rows = 5,
  className,
  placeholder,
  disabled,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [balloon, setBalloon] = useState<BalloonPos | null>(null);

  const mention = useMemo(
    () => detectMandatoryMention(value.slice(0, caret)),
    [value, caret],
  );
  const mentionKey = mention
    ? `${mention.startIndex}:${mention.query}`
    : null;

  const suggestions = useMemo(() => {
    if (!mention || (mentionKey && mentionKey === dismissedKey)) return [];
    return filterMandatoryMentions(options, mention.query);
  }, [mention, mentionKey, dismissedKey, options]);

  const showPanel =
    Boolean(mention) &&
    mentionKey !== dismissedKey &&
    suggestions.length > 0;

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
    setBalloon(getCaretOffsetInTextarea(ta, caret));
  }, [showPanel, mention, caret, value, suggestions.length]);

  function syncCaret() {
    const ta = taRef.current;
    if (!ta) return;
    setCaret(ta.selectionStart);
  }

  function accept(opt: MandatoryMentionOption) {
    if (!mention) return;
    const next = applyMandatoryMention(value, caret, mention, opt);
    onChange(next.text);
    setDismissedKey(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(next.caret, next.caret);
      setCaret(next.caret);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!showPanel || !mention) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      accept(suggestions[activeIdx] ?? suggestions[0]!);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (mentionKey) setDismissedKey(mentionKey);
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={cn(className)}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
      />
      {showPanel && mention && balloon ? (
        <div
          className="absolute z-50 w-[min(100%,18rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          style={{
            top: Math.min(balloon.top + 22, 220),
            left: Math.min(Math.max(balloon.left, 0), 40),
          }}
          role="listbox"
          aria-label="Sugestões de data obrigatória"
        >
          <div className="border-b border-border px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            @data_obrigatoria · ↑↓ · Enter
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIdx}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left text-sm",
                    i === activeIdx ? "bg-muted" : "hover:bg-muted/70",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    accept(s);
                  }}
                >
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {s.prazo_label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {options.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              Nenhuma data obrigatória neste mês/período.
            </p>
          ) : null}
        </div>
      ) : null}
      {mention && options.length === 0 ? (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
          Não há datas obrigatórias para o mês desta atividade.
        </p>
      ) : null}
    </div>
  );
}
