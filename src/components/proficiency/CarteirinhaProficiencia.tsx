import "./carteirinha.css";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CarteirinhaDados } from "@/components/proficiency/types";

export type { CarteirinhaDados };

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return null;
  return `${d}/${m}/${a}`;
}

export function dataExtenso(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return "";
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`;
}

export function classeNome(nome: string): string {
  const n = String(nome || "").length;
  if (n > 34) return "muito-longo";
  if (n > 22) return "longo";
  return "";
}

function textoCertificacao(d: CarteirinhaDados): {
  before: string;
  graus: string;
  after: string;
  nome: string;
} {
  const i = Boolean(d.proficiencia.iniciatico);
  const m = Boolean(d.proficiencia.demolay);
  let graus: string;
  if (i && m) graus = "os juramentos do Grau Iniciático e do Grau DeMolay";
  else if (i) graus = "o juramento do Grau Iniciático";
  else if (m) graus = "o juramento do Grau DeMolay";
  else graus = "os juramentos exigidos";

  return {
    before: "Este cartão certifica que o irmão ",
    nome: d.nome,
    graus,
    after:
      ", cuja assinatura consta neste cartão, é membro deste Capítulo e foi considerado proficiente, pois apresentou de memória ",
  };
}

function Selo({ rotulo, iso }: { rotulo: string; iso: string | null }) {
  const data = dataCurta(iso);
  return (
    <div className={cn("selo", !data && "pendente")}>
      <div className="selo-rot">{rotulo}</div>
      <div className="selo-data">{data || "—/—/—"}</div>
    </div>
  );
}

function FaceFrente({ d }: { d: CarteirinhaDados }) {
  return (
    <div className="face-frente">
      <header className="topo">
        <img
          className="logo"
          src="/carteirinha/logo-demolay.png"
          alt="DeMolay Brasil"
        />
        <div className="eyebrow">Cartão de Proficiência</div>
      </header>
      <div className="regua" />

      <div className="corpo">
        <div className="foto">
          {d.foto ? (
            <img src={d.foto} alt={`Fotografia de ${d.nome}`} />
          ) : (
            <div className="foto-vazia">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 12.6a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Zm0 1.9c-4 0-7.4 2.3-7.4 5.1V21h14.8v-1.4c0-2.8-3.4-5.1-7.4-5.1Z" />
              </svg>
              <span>FOTO 3×4</span>
            </div>
          )}
        </div>
        <div className={cn("nome", classeNome(d.nome))}>{d.nome}</div>
        <div className="origem">
          Capítulo{" "}
          <b>
            {d.capitulo} nº {d.numero}
          </b>
        </div>
        <div className="origem-sub">
          {d.cidade} — {d.uf}
        </div>

        <div className="selos">
          <Selo rotulo="Grau Iniciático" iso={d.proficiencia.iniciatico} />
          <Selo rotulo="Grau DeMolay" iso={d.proficiencia.demolay} />
        </div>
      </div>

      <footer className="rodape">
        <div>
          <div className="rodape-rot">Registro SCDB</div>
          <div className="rodape-val">{d.registro || "—"}</div>
          <div className="rodape-sub">
            {d.validade
              ? `Válido até ${dataCurta(d.validade)}`
              : "Validade não definida"}
          </div>
        </div>
        <div className="qr">
          {d.qr ? (
            <img src={d.qr} alt="Código de verificação" />
          ) : (
            <div className="qr-vazio">QR</div>
          )}
        </div>
      </footer>
    </div>
  );
}

function FaceVerso({ d }: { d: CarteirinhaDados }) {
  const cert = textoCertificacao(d);
  return (
    <div className="face-verso">
      <img className="verso-marca" src="/carteirinha/marca-verso.png" alt="" />
      <div className="verso-inner">
        <div className="verso-eyebrow">Proficiência</div>
        <div className="verso-cap">
          Capítulo {d.capitulo} nº {d.numero}
        </div>
        <div className="verso-hr" />

        <p className="verso-texto">
          {cert.before}
          <b>{cert.nome}</b>
          {cert.after}
          <b>{cert.graus}</b>.
        </p>
        <div className="verso-local">
          {d.cidade}, {dataExtenso(d.emissao) || "___ de _________ de ____"}.
        </div>

        <div className="assinaturas">
          <div className="assin">
            <div className="assin-linha">
              {d.assinaturaMembro ? (
                <img src={d.assinaturaMembro} alt="Assinatura do membro" />
              ) : null}
            </div>
            <div className="assin-rot">Assinatura do membro</div>
          </div>
          <div className="assin">
            <div className="assin-linha">
              {d.assinaturaConsultor ? (
                <img src={d.assinaturaConsultor} alt="Assinatura do consultor" />
              ) : null}
            </div>
            <div className="assin-rot">Consultor do Capítulo</div>
          </div>
        </div>

        <div className="verso-rodape">
          <div className="cod">{d.codigo || ""}</div>
          <div>
            {(d.endereco || []).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Classes do dialog estilo carteira (fundo escuro, full-bleed no mobile). */
export const carteirinhaDialogClassName =
  "carteirinha-dialog flex max-h-[100dvh] w-[calc(100%-2rem)] max-w-none flex-col gap-0 overflow-y-auto border-0 bg-[#17090B] p-0 text-[#F0E4D6] shadow-none sm:w-full sm:max-h-[92dvh] sm:max-w-md sm:rounded-2xl sm:border sm:border-white/10";

type Props = {
  dados: CarteirinhaDados;
  showPrintButton?: boolean;
  className?: string;
};

export function CarteirinhaProficiencia({
  dados,
  showPrintButton = true,
  className,
}: Props) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [dados.codigo, dados.nome, dados.registro]);

  return (
    <div className={cn("carteirinha-viewer", className)}>
      {/* Screen: wallet flip */}
      <div className="carteirinha-wallet carteirinha-no-print">
        <button
          type="button"
          className={cn("carteirinha-flip", flipped && "is-flipped")}
          onClick={() => setFlipped((v) => !v)}
          aria-label={
            flipped
              ? "Virar carteirinha para a frente"
              : "Virar carteirinha para o verso"
          }
        >
          <div className="carteirinha-flip-inner">
            <div className="carteirinha-flip-face is-frente">
              <div className="cartao">
                <FaceFrente d={dados} />
              </div>
            </div>
            <div className="carteirinha-flip-face is-verso">
              <div className="cartao">
                <FaceVerso d={dados} />
              </div>
            </div>
          </div>
        </button>

        <p className="carteirinha-hint" aria-hidden="true">
          <RotateCcw className="h-3.5 w-3.5" />
          Toque na carteirinha para virar
        </p>

        {showPrintButton ? (
          <div className="carteirinha-actions">
            <Button
              type="button"
              variant="secondary"
              className="bg-[#F5C422] text-[#3A0A0E] hover:bg-[#FFE28A]"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir / salvar PDF
            </Button>
          </div>
        ) : null}
      </div>

      {/* Print: ambas as faces, uma por página */}
      <div className="carteirinha-print-only" aria-hidden="true">
        <div className="carteirinha-slot">
          <div className="cartao">
            <FaceFrente d={dados} />
          </div>
        </div>
        <div className="carteirinha-slot">
          <div className="cartao">
            <FaceVerso d={dados} />
          </div>
        </div>
      </div>
    </div>
  );
}
