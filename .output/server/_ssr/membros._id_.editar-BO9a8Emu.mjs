import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { l as isUnder21 } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { T as Plus, t as X, ut as Check, vt as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as updateMember, n as getMember } from "./members.functions-DeZwihqx.mjs";
import { t as Route } from "./membros._id_.editar-DNck63eM.mjs";
import { n as MemberDataFields, r as emptyGuardian, t as GuardianFields } from "./MemberFields-CEzZqSYO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/membros._id_.editar-BO9a8Emu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var memberQO = (id) => queryOptions({
	queryKey: ["member", id],
	queryFn: () => getMember({ data: { id } })
});
function EditarMembro() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { active } = useActiveChapter();
	const { data } = useSuspenseQuery(memberQO(id));
	const addr = data.member.address ?? {};
	const [dados, setDados] = (0, import_react.useState)({
		full_name: data.member.full_name ?? "",
		birth_date: data.member.birth_date ?? "",
		exam_grau_iniciatico: data.member.exam_grau_iniciatico ?? "",
		exam_grau_demolay: data.member.exam_grau_demolay ?? "",
		iniciacao_ordem: data.member.iniciacao_ordem ?? "",
		iniciacao_grau_demolay: data.member.iniciacao_grau_demolay ?? "",
		status: data.member.status ?? "ativo",
		cpf: "",
		rg: "",
		phone: data.member.phone ?? "",
		email: data.member.email ?? "",
		address_street: addr.street ?? "",
		address_city: addr.city ?? "",
		address_state: addr.state ?? "",
		address_zip: addr.zip ?? ""
	});
	const existing = data.guardians ?? [];
	const [guardian1, setGuardian1] = (0, import_react.useState)({
		...emptyGuardian,
		full_name: existing[0]?.full_name ?? "",
		relationship: existing[0]?.relationship ?? "",
		phone: existing[0]?.phone ?? "",
		email: existing[0]?.email ?? ""
	});
	const [guardian2, setGuardian2] = (0, import_react.useState)(existing[1] ? {
		...emptyGuardian,
		full_name: existing[1].full_name ?? "",
		relationship: existing[1].relationship ?? "",
		phone: existing[1].phone ?? "",
		email: existing[1].email ?? ""
	} : null);
	const menor = isUnder21(dados.birth_date);
	const mutation = useMutation({
		mutationFn: async () => {
			const guardians = [...guardian1.full_name.trim() ? [guardian1] : [], ...guardian2?.full_name.trim() ? [guardian2] : []];
			if (menor && guardians.length === 0) throw new Error("Membros com menos de 21 anos precisam de ao menos um responsável");
			return updateMember({ data: {
				id,
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
				guardians
			} });
		},
		onSuccess: async () => {
			toast.success("Cadastro atualizado");
			await qc.invalidateQueries({ queryKey: ["member", id] });
			await qc.invalidateQueries({ queryKey: ["members"] });
			navigate({
				to: "/membros/$id",
				params: { id }
			});
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Editar membro",
		subtitle: data.member.full_name,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			onClick: () => navigate({
				to: "/membros/$id",
				params: { id }
			}),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "space-y-6 rounded-[12px] p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemberDataFields, {
				value: dados,
				onChange: (p) => setDados((d) => ({
					...d,
					...p
				})),
				showPiiHint: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "text-base font-semibold",
						children: ["Responsáveis ", menor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-muted-foreground",
							children: "(obrigatório)"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuardianFields, {
						title: "Responsável 1 (principal)",
						value: guardian1,
						onChange: (p) => setGuardian1((g) => ({
							...g,
							...p
						})),
						required: menor
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
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => mutation.mutate(),
					disabled: mutation.isPending,
					style: { backgroundColor: active?.chapter.primary_color },
					children: mutation.isPending ? "Salvando…" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-2 h-4 w-4" }), " Salvar alterações"] })
				})
			})
		]
	})] });
}
//#endregion
export { EditarMembro as component };
