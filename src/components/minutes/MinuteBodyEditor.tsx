import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
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
import {
  AVAILABLE_VARS,
  applyMinuteVar,
  detectMinuteVar,
  filterMinuteVars,
  type MinuteVarMatch,
} from "@/lib/minute-vars";
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
  id?: string;
  /** Se false, o switch fica no painel pai. Default true. */
  showAutocompleteToggle?: boolean;
  autocompleteOn?: boolean;
  onAutocompleteOnChange?: (on: boolean) => void;
  /** Autocomplete de Irmão/Tio. Default true. */
  enableMentions?: boolean;
  /** Autocomplete de [variáveis] ao digitar `[`. Default true. */
  enableVars?: boolean;
  /** Lista de tokens `[…]` sugeridos (default: AVAILABLE_VARS de atas/ofícios). */
  varTokens?: readonly string[];
  /** Ref opcional para o textarea (ex.: inserir variável por clique). */
  textareaRef?: Ref<HTMLTextAreaElement>;
};

type BalloonPos = { top: number; left: number };

type ActiveSuggest =
  | { kind: "mention"; match: MinuteMentionMatch }
  | { kind: "var"; match: MinuteVarMatch };

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

function assignRef(
  ref: Ref<HTMLTextAreaElement> | undefined,
  el: HTMLTextAreaElement | null,
) {
  if (!ref) return;
  if (typeof ref === "function") ref(el);
  else (ref as { current: HTMLTextAreaElement | null }).current = el;
}

/** Textarea da ata com sugestões após "Irmão …" / "Tio …" e `[variáveis]`. */
export function MinuteBodyEditor({
  chapterId,
  value,
  onChange,
  editable,
  rows = 18,
  className,
  placeholder,
  id,
  showAutocompleteToggle = true,
  autocompleteOn: autocompleteOnProp,
  onAutocompleteOnChange,
  enableMentions = true,
  enableVars = true,
  varTokens = AVAILABLE_VARS,
  textareaRef,
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
    enabled:
      editable &&
      autocompleteOn &&
      enableMentions &&
      Boolean(chapterId),
    staleTime: 60_000,
  });

  const members = (membersQ.data ?? []) as MinuteMentionMember[];

  const before = value.slice(0, caret);

  const active = useMemo((): ActiveSuggest | null => {
    if (!editable || !autocompleteOn) return null;
    if (enableVars) {
      const varMatch = detectMinuteVar(before);
      if (varMatch) return { kind: "var", match: varMatch };
    }
    if (enableMentions) {
      const mention = detectMinuteMention(before);
      if (mention) return { kind: "mention", match: mention };
    }
    return null;
  }, [before, editable, autocompleteOn, enableVars, enableMentions]);

  const suggestKey = active
    ? active.kind === "var"
      ? `var:${active.match.start}:${active.match.query}`
      : `mention:${active.match.titleIndex}:${active.match.title}:${active.match.query}`
    : null;

  const mentionSuggestions = useMemo(() => {
    if (
      !active ||
      active.kind !== "mention" ||
      (suggestKey && suggestKey === dismissedKey)
    ) {
      return [] as MinuteMentionMember[];
    }
    return filterMembersForMention(
      members,
      active.match.title,
      active.match.query,
    );
  }, [active, members, suggestKey, dismissedKey]);

  const varSuggestions = useMemo(() => {
    if (
      !active ||
      active.kind !== "var" ||
      (suggestKey && suggestKey === dismissedKey)
    ) {
      return [] as string[];
    }
    return filterMinuteVars(active.match.query, varTokens);
  }, [active, suggestKey, dismissedKey, varTokens]);

  const showPanel =
    Boolean(active) &&
    suggestKey !== dismissedKey &&
    (active?.kind === "var"
      ? true
      : mentionSuggestions.length > 0 || membersQ.isSuccess);

  useEffect(() => {
    setActiveIdx(0);
  }, [suggestKey]);

  useLayoutEffect(() => {
    if (!showPanel || !active) {
      setBalloon(null);
      return;
    }
    const ta = taRef.current;
    if (!ta) return;

    const pos = getCaretOffsetInTextarea(ta, caret);
    const lineH = parseFloat(window.getComputedStyle(ta).lineHeight) || 20;
    let top = pos.top + lineH + 4;
    let left = Math.max(8, pos.left);

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
  }, [
    showPanel,
    active,
    caret,
    value,
    mentionSuggestions.length,
    varSuggestions.length,
  ]);

  function updateCaretFromEl(el: HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function setTaRef(el: HTMLTextAreaElement | null) {
    taRef.current = el;
    assignRef(textareaRef, el);
  }

  function acceptMention(
    member: MinuteMentionMember,
    match: MinuteMentionMatch,
  ) {
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

  function acceptVar(token: string, match: MinuteVarMatch) {
    const el = taRef.current;
    const at = el?.selectionStart ?? caret;
    const { text, caret: nextCaret } = applyMinuteVar(value, at, match, token);
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
    if (!active || suggestKey === dismissedKey) return;

    if (active.kind === "var") {
      if (varSuggestions.length === 0 && e.key !== "Escape") return;
      if (e.key === "ArrowDown" && varSuggestions.length > 0) {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % varSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp" && varSuggestions.length > 0) {
        e.preventDefault();
        setActiveIdx(
          (i) => (i - 1 + varSuggestions.length) % varSuggestions.length,
        );
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && varSuggestions.length > 0) {
        e.preventDefault();
        acceptVar(varSuggestions[activeIdx] ?? varSuggestions[0], active.match);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (suggestKey) setDismissedKey(suggestKey);
      }
      return;
    }

    if (mentionSuggestions.length === 0 && e.key !== "Escape") return;

    if (e.key === "ArrowDown" && mentionSuggestions.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % mentionSuggestions.length);
      return;
    }
    if (e.key === "ArrowUp" && mentionSuggestions.length > 0) {
      e.preventDefault();
      setActiveIdx(
        (i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length,
      );
      return;
    }
    if (
      (e.key === "Enter" || e.key === "Tab") &&
      mentionSuggestions.length > 0
    ) {
      e.preventDefault();
      acceptMention(
        mentionSuggestions[activeIdx] ?? mentionSuggestions[0],
        active.match,
      );
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (suggestKey) setDismissedKey(suggestKey);
    }
  }

  const balloonStyle: CSSProperties | undefined = balloon
    ? { top: balloon.top, left: balloon.left }
    : { top: 12, left: 12, visibility: "hidden" };

  const showMentionToggle = enableMentions && editable && showAutocompleteToggle;

  return (
    <div>
      {showMentionToggle ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          <Label
            htmlFor={id ? `${id}-autocomplete` : "minute-autocomplete"}
            className="cursor-pointer text-xs font-normal text-muted-foreground"
          >
            Autocomplete de nomes
          </Label>
          <Switch
            id={id ? `${id}-autocomplete` : "minute-autocomplete"}
            checked={autocompleteOn}
            onCheckedChange={setAutocomplete}
            aria-label="Autocomplete de nomes na ata"
          />
        </div>
      ) : null}

      <div ref={wrapRef} className="relative">
        <Textarea
          id={id}
          ref={setTaRef}
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

        {showPanel && active?.kind === "var" ? (
          <div
            ref={balloonRef}
            role="listbox"
            aria-label="Sugestões de variáveis dinâmicas"
            className={cn(
              "pointer-events-auto absolute z-30 w-[min(18rem,calc(100%-1rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-black/5",
              "animate-in fade-in-0 zoom-in-95 duration-150",
            )}
            style={balloonStyle}
          >
            <div className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Variável · ↑↓ · Enter
            </div>
            {varSuggestions.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto p-1">
                {varSuggestions.map((token, i) => (
                  <li key={token}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activeIdx}
                      className={cn(
                        "flex w-full items-center rounded-lg px-2 py-1.5 text-left font-mono text-sm transition-colors",
                        i === activeIdx ? "bg-muted" : "hover:bg-muted/60",
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        acceptVar(token, active.match);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                    >
                      <span className="truncate">{token}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                Nenhuma variável parecida com “[{active.match.query}…]”.
              </p>
            )}
          </div>
        ) : null}

        {showPanel && active?.kind === "mention" ? (
          <div
            ref={balloonRef}
            role="listbox"
            aria-label={`Sugestões de ${active.match.title}`}
            className={cn(
              "pointer-events-auto absolute z-30 w-[min(18rem,calc(100%-1rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-black/5",
              "animate-in fade-in-0 zoom-in-95 duration-150",
            )}
            style={balloonStyle}
          >
            <div className="border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {active.match.title} · ↑↓ · Enter
            </div>

            {mentionSuggestions.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto p-1">
                {mentionSuggestions.map((m, i) => (
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
                        acceptMention(m, active.match);
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
                Nenhum{" "}
                {active.match.title === "Tio" ? "maçom" : "DeMolay/sênior"}{" "}
                parecido com “{active.match.query}”.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
