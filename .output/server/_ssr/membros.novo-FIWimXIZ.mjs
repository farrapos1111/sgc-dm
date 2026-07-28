import { a as __toESM } from "../_runtime.mjs";
import { it as stringType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { l as isUnder21 } from "./format-BWFXNFqE.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { T as Plus, _t as ArrowRight, t as X, ut as Check, vt as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { n as CheckboxIndicator, t as Checkbox$1 } from "../_libs/@radix-ui/react-checkbox+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as createMember } from "./members.functions-DeZwihqx.mjs";
import { i as emptyMember, n as MemberDataFields, r as emptyGuardian, t as GuardianFields } from "./MemberFields-CEzZqSYO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/membros.novo-FIWimXIZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Checkbox = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox$1, {
	ref,
	className: cn("grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckboxIndicator, {
		className: cn("grid place-content-center text-current"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" })
	})
}));
Checkbox.displayName = Checkbox$1.displayName;
var stepDadosSchema = objectType({
	full_name: stringType().trim().min(2, "Informe o nome completo").max(120),
	email: stringType().email("Email inválido").optional().or(literalType("")).default("")
});
var CONSENT_VERSION = "v1-2026-07";
var CONSENT_TEXT = `Autorizo o tratamento dos dados pessoais do membro sob minha responsabilidade pelo Capítulo, exclusivamente para fins administrativos, de comunicação e de participação em atividades da Ordem DeMolay, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Este consentimento pode ser revogado a qualquer momento junto ao Encarregado de Dados do Capítulo.`;
function NovoMembro() {
	const { active } = useActiveChapter();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [step, setStep] = (0, import_react.useState)(1);
	const [dados, setDados] = (0, import_react.useState)(emptyMember);
	const [guardian1, setGuardian1] = (0, import_react.useState)(emptyGuardian);
	const [guardian2, setGuardian2] = (0, import_react.useState)(null);
	const [consent, setConsent] = (0, import_react.useState)(false);
	const menor = isUnder21(dados.birth_date);
	const mutation = useMutation({
		mutationFn: async () => {
			if (!active) throw new Error("Sem capítulo ativo");
			const guardians = menor ? [guardian1, ...guardian2 && guardian2.full_name.trim() ? [guardian2] : []] : [];
			return createMember({ data: {
				chapter_id: active.chapter_id,
				full_name: dados.full_name.trim(),
				birth_date: dados.birth_date || null,
				exam_grau_iniciatico: dados.exam_grau_iniciatico || null,
				exam_grau_demolay: dados.exam_grau_demolay || null,
				iniciacao_ordem: dados.iniciacao_ordem || null,
				iniciacao_grau_demolay: dados.iniciacao_grau_demolay || null,
				cpf: dados.cpf,
				rg: dados.rg,
				phone: dados.phone,
				email: dados.email,
				address: {
					street: dados.address_street,
					city: dados.address_city,
					state: dados.address_state,
					zip: dados.address_zip
				},
				status: dados.status,
				guardians,
				consent_text_version: menor ? CONSENT_VERSION : ""
			} });
		},
		onSuccess: async () => {
			toast.success("Membro cadastrado");
			await qc.invalidateQueries({ queryKey: ["members"] });
			navigate({ to: "/membros" });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao cadastrar")
	});
	function nextFromDados() {
		const parsed = stepDadosSchema.safeParse(dados);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios");
			return;
		}
		setStep(menor ? 2 : 3);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Novo membro",
		subtitle: `Etapa ${step} de ${menor ? 3 : 2}`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			onClick: () => navigate({ to: "/membros" }),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-6",
		children: [
			step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemberDataFields, {
					value: dados,
					onChange: (p) => setDados((d) => ({
						...d,
						...p
					}))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-end pt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: nextFromDados,
						style: { backgroundColor: active?.chapter.primary_color },
						children: ["Próximo ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-2 h-4 w-4" })]
					})
				})]
			}),
			step === 2 && menor && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Como o membro tem menos de 21 anos, é obrigatório informar ao menos um responsável legal. É possível cadastrar até dois responsáveis."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuardianFields, {
						title: "Responsável 1 (principal)",
						value: guardian1,
						onChange: (p) => setGuardian1((g) => ({
							...g,
							...p
						})),
						required: true
					}),
					guardian2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuardianFields, {
							title: "Responsável 2",
							value: guardian2,
							onChange: (p) => setGuardian2((g) => ({
								...g ?? emptyGuardian,
								...p
							}))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setGuardian2(null),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mr-2 h-4 w-4" }), " Remover segundo responsável"]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						onClick: () => setGuardian2({ ...emptyGuardian }),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), " Adicionar segundo responsável"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between pt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							onClick: () => setStep(1),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							onClick: () => {
								if (!guardian1.full_name.trim()) {
									toast.error("Informe o nome do responsável");
									return;
								}
								setStep(3);
							},
							style: { backgroundColor: active?.chapter.primary_color },
							children: ["Próximo ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-2 h-4 w-4" })]
						})]
					})
				]
			}),
			step === 3 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [menor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-base font-semibold",
						children: "Consentimento LGPD do responsável"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-[8px] border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground",
						children: CONSENT_TEXT
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-start gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
							checked: consent,
							onCheckedChange: (v) => setConsent(Boolean(v)),
							className: "mt-0.5"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"Eu, ",
							guardian1.full_name || "responsável",
							", li e concordo com o tratamento dos dados pessoais conforme descrito acima (versão ",
							CONSENT_VERSION,
							")."
						] })]
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-base font-semibold",
					children: "Revisão"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Confira os dados na etapa anterior. O membro tem 21 anos ou mais — o consentimento LGPD do responsável não é necessário."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between pt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: () => setStep(menor ? 2 : 1),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => {
							if (menor && !consent) {
								toast.error("O responsável precisa assinalar o consentimento LGPD");
								return;
							}
							mutation.mutate();
						},
						disabled: mutation.isPending,
						style: { backgroundColor: active?.chapter.primary_color },
						children: mutation.isPending ? "Salvando…" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-2 h-4 w-4" }), " Concluir cadastro"] })
					})]
				})]
			})
		]
	})] });
}
//#endregion
export { NovoMembro as component };
