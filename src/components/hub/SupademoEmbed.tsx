import { useState } from "react";
import {
  getSupademoDemoId,
  supademoEmbedUrl,
  type SupademoSlotId,
} from "@/lib/supademo";
import { cn } from "@/lib/utils";

type Props = {
  slot: SupademoSlotId;
  title: string;
  caption?: string;
  className?: string;
};

const SLOT_LABEL: Record<SupademoSlotId, string> = {
  overview: "Visão geral",
  secretaria: "Secretaria",
  tesouraria: "Tesouraria",
  gestao: "Gestão",
  comissoes: "Comissões",
};

/** Opcional: coloque PNGs/JPGs em `public/shots/{slot}.png` para usar captura real. */
function shotImageSrc(slot: SupademoSlotId): string {
  return `/shots/${slot}.png`;
}

function ScreenThumb({ slot }: { slot: SupademoSlotId }) {
  return (
    <div className={cn("tv-shot", `tv-shot--${slot}`)} aria-hidden>
      <div className="tv-shot-bar">
        <i />
        <i />
        <i />
        <span>{SLOT_LABEL[slot]}</span>
      </div>
      <div className="tv-shot-body">
        <aside className="tv-shot-side">
          <span />
          <span className="on" />
          <span />
          <span />
          <span />
        </aside>
        <div className="tv-shot-main">
          <div className="tv-shot-t" />
          {slot === "secretaria" ? (
            <>
              <div className="tv-shot-row">
                <span />
                <em className="ok" />
              </div>
              <div className="tv-shot-row">
                <span />
              </div>
              <div className="tv-shot-row">
                <span />
              </div>
              <div className="tv-shot-row">
                <span />
                <em className="warn" />
              </div>
              <div className="tv-shot-row">
                <span />
              </div>
            </>
          ) : null}
          {slot === "tesouraria" ? (
            <>
              <div className="tv-shot-row chips">
                <em className="ok" />
                <em className="ok" />
                <em className="warn" />
                <em className="bad" />
                <span />
              </div>
              <div className="tv-shot-row chips">
                <em className="ok" />
                <em className="warn" />
                <em className="ok" />
                <em className="ok" />
                <span />
              </div>
              <div className="tv-shot-row chips">
                <em className="bad" />
                <em className="ok" />
                <em className="ok" />
                <em className="warn" />
                <span />
              </div>
              <div className="tv-shot-row chips">
                <em className="ok" />
                <em className="ok" />
                <em className="ok" />
                <em className="ok" />
                <span />
              </div>
            </>
          ) : null}
          {slot === "gestao" ? (
            <>
              <div className="tv-shot-row chips">
                <em />
                <em />
                <em className="ok" />
                <em />
                <em className="warn" />
              </div>
              <div className="tv-shot-row chips">
                <em />
                <em className="ok" />
                <em />
                <em />
                <em />
              </div>
              <div className="tv-shot-row chips">
                <em className="warn" />
                <em />
                <em />
                <em className="ok" />
                <em />
              </div>
              <div className="tv-shot-row chips">
                <em />
                <em />
                <em className="ok" />
                <em />
                <em />
              </div>
            </>
          ) : null}
          {slot === "comissoes" ? (
            <>
              <div className="tv-shot-row">
                <span />
                <em className="ok" />
              </div>
              <div className="tv-shot-row">
                <span />
                <em className="warn" />
              </div>
              <div className="tv-shot-row">
                <span />
              </div>
              <div className="tv-shot-cards">
                <div />
                <div />
              </div>
            </>
          ) : null}
          {slot === "overview" ? (
            <>
              <div className="tv-shot-kpis">
                <div />
                <div />
                <div />
              </div>
              <div className="tv-shot-row">
                <span />
              </div>
              <div className="tv-shot-row chips">
                <em className="ok" />
                <em className="ok" />
                <em className="warn" />
                <span />
              </div>
              <div className="tv-shot-row">
                <span />
                <em className="ok" />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlaceholderShot({ slot, title }: { slot: SupademoSlotId; title: string }) {
  const [useImage, setUseImage] = useState(true);

  return (
    <div
      className="tv-demo-placeholder tv-demo-placeholder--shot"
      role="img"
      aria-label={`${title} — prévia da tela (Supademo em breve)`}
    >
      {useImage ? (
        <img
          className="tv-shot-photo"
          src={shotImageSrc(slot)}
          alt=""
          onError={() => setUseImage(false)}
        />
      ) : (
        <ScreenThumb slot={slot} />
      )}
      <div className="tv-demo-overlay">
        <p className="tv-demo-kicker">Prévia da tela</p>
        <p className="tv-demo-title">{title}</p>
        <p className="tv-demo-hint">Demonstração interativa em breve</p>
      </div>
    </div>
  );
}

export function SupademoEmbed({ slot, title, caption, className }: Props) {
  const demoId = getSupademoDemoId(slot);

  return (
    <figure className={cn("tv-demo", className)}>
      <div className="tv-demo-frame">
        {demoId ? (
          <iframe
            src={supademoEmbedUrl(demoId)}
            title={title}
            loading="lazy"
            allow="clipboard-write; fullscreen"
            allowFullScreen
          />
        ) : (
          <PlaceholderShot slot={slot} title={title} />
        )}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
