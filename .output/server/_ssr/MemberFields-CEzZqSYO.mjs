import { d as maskPhoneInput, u as maskCpfInput } from "./format-BWFXNFqE.mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/MemberFields-CEzZqSYO.js
var import_jsx_runtime = require_jsx_runtime();
var emptyMember = {
	full_name: "",
	birth_date: "",
	iniciacao_ordem: "",
	exam_grau_iniciatico: "",
	iniciacao_grau_demolay: "",
	exam_grau_demolay: "",
	status: "ativo",
	cpf: "",
	rg: "",
	phone: "",
	email: "",
	address_street: "",
	address_city: "",
	address_state: "",
	address_zip: ""
};
var emptyGuardian = {
	full_name: "",
	relationship: "",
	cpf: "",
	phone: "",
	email: ""
};
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		className: "mb-1.5 block text-sm",
		children: label
	}), children] });
}
function MemberDataFields({ value, onChange, showPiiHint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Nome completo *",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: value.full_name,
					onChange: (e) => onChange({ full_name: e.target.value }),
					maxLength: 120
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Data de nascimento",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: value.birth_date,
						onChange: (e) => onChange({ birth_date: e.target.value })
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Status",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: value.status,
						onValueChange: (v) => onChange({ status: v }),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "ativo",
								children: "Ativo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "inativo",
								children: "Inativo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "senior",
								children: "Senior DeMolay"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "macom",
								children: "Maçom"
							})
						] })]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Iniciação à Ordem DeMolay",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "date",
							value: value.iniciacao_ordem,
							onChange: (e) => onChange({ iniciacao_ordem: e.target.value })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Exame de Grau Iniciático",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "date",
							value: value.exam_grau_iniciatico,
							onChange: (e) => onChange({ exam_grau_iniciatico: e.target.value })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Iniciação ao Grau DeMolay",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "date",
							value: value.iniciacao_grau_demolay,
							onChange: (e) => onChange({ iniciacao_grau_demolay: e.target.value })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Exame de Grau DeMolay",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "date",
							value: value.exam_grau_demolay,
							onChange: (e) => onChange({ exam_grau_demolay: e.target.value })
						})
					})
				]
			}),
			value.exam_grau_iniciatico && !value.iniciacao_grau_demolay && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium text-primary",
				children: "Apto a G∴D∴ — exame de Grau Iniciático concluído, aguardando iniciação no Grau DeMolay."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Somente membros com grau DM podem assumir cargos do capítulo."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "CPF",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: value.cpf,
						placeholder: "000.000.000-00",
						onChange: (e) => onChange({ cpf: maskCpfInput(e.target.value) })
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "RG",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: value.rg,
						onChange: (e) => onChange({ rg: e.target.value.slice(0, 20) })
					})
				})]
			}),
			showPiiHint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Deixe CPF e RG em branco para manter os valores já criptografados."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Telefone",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: value.phone,
						placeholder: "(00) 00000-0000",
						onChange: (e) => onChange({ phone: maskPhoneInput(e.target.value) })
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Email",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "email",
						value: value.email,
						onChange: (e) => onChange({ email: e.target.value })
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Endereço",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: value.address_street,
					placeholder: "Rua, número, bairro…",
					onChange: (e) => onChange({ address_street: e.target.value })
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Cidade",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: value.address_city,
							onChange: (e) => onChange({ address_city: e.target.value })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "UF",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							maxLength: 2,
							value: value.address_state,
							onChange: (e) => onChange({ address_state: e.target.value.toUpperCase() })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "CEP",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: value.address_zip,
							onChange: (e) => onChange({ address_zip: e.target.value })
						})
					})
				]
			})
		]
	});
}
function GuardianFields({ title, value, onChange, required }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 rounded-[12px] border border-border p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
				className: "text-sm font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: `Nome do responsável${required ? " *" : ""}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: value.full_name,
					onChange: (e) => onChange({ full_name: e.target.value })
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Parentesco",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "Ex: mãe, pai, tutor",
							value: value.relationship,
							onChange: (e) => onChange({ relationship: e.target.value })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "CPF",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "000.000.000-00",
							value: value.cpf,
							onChange: (e) => onChange({ cpf: maskCpfInput(e.target.value) })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Telefone",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "(00) 00000-0000",
							value: value.phone,
							onChange: (e) => onChange({ phone: maskPhoneInput(e.target.value) })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Email",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "email",
							value: value.email,
							onChange: (e) => onChange({ email: e.target.value })
						})
					})
				]
			})
		]
	});
}
//#endregion
export { emptyMember as i, MemberDataFields as n, emptyGuardian as r, GuardianFields as t };
