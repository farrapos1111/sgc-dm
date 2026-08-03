import { CalendarDays, MapPin, Mail } from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import type { TicketPassData } from "@/lib/ticket-pass";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type TicketPassProps = {
  pass: TicketPassData;
  qrDataUrl: string;
  className?: string;
  /** Preparado para e-mail: mostra ação quando há e-mail do comprador. */
  onSendEmail?: () => void;
  sendEmailPending?: boolean;
  sendEmailLabel?: string;
};

export function TicketPass({
  pass,
  qrDataUrl,
  className,
  onSendEmail,
  sendEmailPending,
  sendEmailLabel = "Enviar por e-mail",
}: TicketPassProps) {
  const accent = pass.primaryColor || "hsl(var(--primary))";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[16px] border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div
        className="relative min-h-[140px] bg-cover bg-center"
        style={{
          backgroundImage: pass.artworkUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 100%), url(${pass.artworkUrl})`
            : `linear-gradient(145deg, ${accent} 0%, color-mix(in srgb, ${accent} 55%, #111) 100%)`,
        }}
      >
        <div className="flex min-h-[140px] flex-col justify-end gap-2 p-4 text-white">
          <h2 className="text-lg font-semibold leading-tight tracking-tight drop-shadow-sm">
            {pass.eventName}
          </h2>
          <div className="space-y-1 text-xs text-white/90">
            <div className="flex items-start gap-1.5">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{formatDateTimeBR(pass.startsAt)}</span>
            </div>
            {pass.location ? (
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{pass.location}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Linha de destaque tipo ingresso */}
      <div
        className="relative h-3 border-y border-dashed border-border bg-muted/40"
        aria-hidden
      >
        <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background border border-border" />
        <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background border border-border" />
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Participante
            </div>
            <div className="truncate text-base font-semibold">{pass.buyerName}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {pass.ticketTypeName}
              {pass.pricePaid > 0 ? ` · ${formatBRL(pass.pricePaid)}` : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-[12px] bg-muted/40 px-4 py-4">
          <img
            src={qrDataUrl}
            alt={`QR do ingresso ${pass.qrCode}`}
            className="h-[180px] w-[180px] rounded-[8px] bg-white p-2"
          />
          <div className="font-mono text-xs text-muted-foreground">{pass.qrCode}</div>
        </div>

        {onSendEmail ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={sendEmailPending || !pass.buyerEmail}
            onClick={onSendEmail}
            title={
              pass.buyerEmail
                ? undefined
                : "Informe o e-mail do comprador na venda para enviar"
            }
          >
            <Mail className="mr-2 h-4 w-4" />
            {sendEmailLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
