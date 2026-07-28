import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate, v as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-Bu8GAd_T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AuthPage() {
	const router = useRouter();
	const navigate = useNavigate();
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [submitting, setSubmitting] = (0, import_react.useState)(false);
	async function handleSubmit(e) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password
		});
		setSubmitting(false);
		if (error) {
			setError("E-mail ou senha inválidos.");
			return;
		}
		await router.invalidate();
		navigate({ to: "/" });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen flex items-center justify-center p-6 bg-[#E9E8E3] dark:bg-background",
		style: { fontFamily: "Inter, system-ui, sans-serif" },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center mb-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-20 h-20 rounded-3xl flex items-center justify-center mb-4",
							style: { backgroundColor: "#9E1B32" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white font-bold text-2xl tracking-wider",
								children: "SG"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-2xl font-bold text-foreground",
							children: "SG-CDM"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground mt-1",
							children: "Sistema Gerenciador de Capítulos DeMolay"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-card rounded-2xl shadow-sm border border-border p-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-semibold text-foreground mb-1",
							children: "Entrar"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground mb-6",
							children: "Acesse com seu e-mail e senha."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleSubmit,
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-sm font-medium text-foreground mb-1.5",
									children: "E-mail"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "email",
									required: true,
									autoComplete: "email",
									value: email,
									onChange: (e) => setEmail(e.target.value),
									className: "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background",
									style: { ["--tw-ring-color"]: "#9E1B32" },
									placeholder: "voce@exemplo.com"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-sm font-medium text-foreground mb-1.5",
									children: "Senha"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									required: true,
									autoComplete: "current-password",
									value: password,
									onChange: (e) => setPassword(e.target.value),
									className: "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background",
									style: { ["--tw-ring-color"]: "#9E1B32" },
									placeholder: "••••••••"
								})] }),
								error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2",
									children: error
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: submitting,
									className: "w-full py-2.5 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60",
									style: { backgroundColor: "#9E1B32" },
									children: submitting ? "Entrando..." : "Entrar"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-center text-xs text-muted-foreground mt-6",
					children: [
						"Contas de teste: ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-foreground",
							children: "usuario.duplo@sgcdm.test"
						}),
						" ·",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-foreground",
							children: "usuario.solo@sgcdm.test"
						}),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"senha: ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-foreground",
							children: "Teste@1234"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-center text-xs text-muted-foreground mt-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/documentacao",
						className: "underline underline-offset-2 hover:text-foreground",
						children: "Documentação"
					})
				})
			]
		})
	});
}
//#endregion
export { AuthPage as component };
