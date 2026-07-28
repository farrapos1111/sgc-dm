import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as formatDateTimeBR, t as formatBRL } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
import { n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { _ as Search, rt as CirclePlus, u as Ticket, v as ScanLine, vt as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CCJRliUM.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { t as Route } from "./eventos._id-Cg9Vj5Dt.mjs";
import { a as createTicketType, c as sellTicket, i as createTable, n as checkinTicket, o as getEvent, t as assignSeat } from "./events.functions-CSdsJ1ax.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as Progress } from "./progress-DOIEKRJF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/eventos._id-OkNb8IVz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Camera-based QR scanner using html5-qrcode. Dynamically imported after mount
* so the SSR/build never pulls the browser-only library.
*/
function QrScanner({ onScan, paused }) {
	const containerId = "qr-scanner-region";
	const scannerRef = (0, import_react.useRef)(null);
	const startedRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			const { Html5Qrcode } = await import("../_libs/html5-qrcode.mjs").then((n) => n.t);
			if (cancelled) return;
			const scanner = new Html5Qrcode(containerId);
			scannerRef.current = scanner;
			try {
				await scanner.start({ facingMode: "environment" }, {
					fps: 10,
					qrbox: {
						width: 220,
						height: 220
					}
				}, (decodedText) => {
					if (!paused) onScan(decodedText);
				}, () => {});
				startedRef.current = true;
			} catch (err) {
				console.error("QR scanner error", err);
			}
		})();
		return () => {
			cancelled = true;
			const s = scannerRef.current;
			if (s && startedRef.current) s.stop().catch(() => {}).finally(() => s.clear());
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-hidden rounded-[12px] border border-border bg-black",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			id: containerId,
			className: "min-h-[280px] w-full"
		})
	});
}
var eventQO = (id) => queryOptions({
	queryKey: ["event", id],
	queryFn: () => getEvent({ data: { id } })
});
function EventoDetalhe() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { active } = useActiveChapter();
	const { data } = useSuspenseQuery(eventQO(id));
	const raised = (0, import_react.useMemo)(() => data.tickets.filter((t) => t.status !== "cancelado").reduce((s, t) => s + Number(t.price_paid ?? 0), 0), [data.tickets]);
	const pct = data.event.goal_amount > 0 ? Math.min(100, raised / Number(data.event.goal_amount) * 100) : 0;
	const [tab, setTab] = (0, import_react.useState)("resumo");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: data.event.name,
		subtitle: `${formatDateTimeBR(data.event.starts_at)}${data.event.location ? ` · ${data.event.location}` : ""}`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			onClick: () => navigate({ to: "/eventos" }),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		value: tab,
		onValueChange: setTab,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "resumo",
						children: "Resumo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "ingressos",
						children: "Ingressos"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "mesas",
						children: "Mapa de mesas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "checkin",
						children: "Check-in"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "resumo",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 gap-4 md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm text-muted-foreground",
									children: "Arrecadação"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-2xl font-bold",
									children: formatBRL(raised)
								}),
								data.event.goal_amount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-1 flex justify-between text-xs text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [pct.toFixed(0), "% da meta"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Meta: ", formatBRL(Number(data.event.goal_amount))] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, {
										value: pct,
										className: "h-1.5"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm text-muted-foreground",
									children: "Ingressos"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-2xl font-bold",
									children: data.tickets.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [data.checkins.length, " check-ins realizados"]
								})
							]
						}),
						data.event.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							className: "rounded-[12px] p-5 md:col-span-2 text-sm text-muted-foreground whitespace-pre-wrap",
							children: data.event.description
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "ingressos",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TicketsList, {
						tickets: data.tickets,
						types: data.ticketTypes
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TicketTypesCard, {
							eventId: id,
							types: data.ticketTypes,
							onChanged: () => qc.invalidateQueries({ queryKey: ["event", id] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SellTicketCard, {
							eventId: id,
							types: data.ticketTypes,
							primary: active?.chapter.primary_color,
							onSold: () => qc.invalidateQueries({ queryKey: ["event", id] })
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "mesas",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TablesMap, {
					eventId: id,
					tables: data.tables,
					seats: data.seats,
					tickets: data.tickets,
					primary: active?.chapter.primary_color,
					onChanged: () => qc.invalidateQueries({ queryKey: ["event", id] })
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "checkin",
				children: tab === "checkin" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckinPanel, {
					eventId: id,
					tickets: data.tickets,
					checkins: data.checkins,
					primary: active?.chapter.primary_color,
					onChanged: () => qc.invalidateQueries({ queryKey: ["event", id] })
				})
			})
		]
	})] });
}
function TicketsList({ tickets, types }) {
	const typeMap = new Map(types.map((t) => [t.id, t.name]));
	const [qrImg, setQrImg] = (0, import_react.useState)(null);
	async function showQr(ticket) {
		const url = await (await import("../_libs/qrcode.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()))).default.toDataURL(ticket.qr_code, {
			width: 260,
			margin: 1
		});
		setQrImg({
			ticketId: ticket.id,
			url
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-0",
		children: [tickets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-6 text-sm text-muted-foreground",
			children: "Nenhum ingresso vendido ainda."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-border",
			children: tickets.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between gap-3 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate font-medium",
						children: t.buyer_name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs text-muted-foreground",
						children: [
							typeMap.get(t.ticket_type_id) ?? "Avulso",
							" · ",
							formatBRL(Number(t.price_paid))
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "secondary",
						className: "capitalize",
						children: t.status
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => showQr(t),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "mr-1 h-4 w-4" }), " QR"]
					})]
				})]
			}, t.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!qrImg,
			onOpenChange: (o) => !o && setQrImg(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "QR Code do ingresso" }) }), qrImg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: qrImg.url,
				alt: "QR",
				className: "mx-auto"
			})] })
		})]
	});
}
function TicketTypesCard({ eventId, types, onChanged }) {
	const [name, setName] = (0, import_react.useState)("");
	const [price, setPrice] = (0, import_react.useState)(0);
	const [qty, setQty] = (0, import_react.useState)(0);
	const m = useMutation({
		mutationFn: () => createTicketType({ data: {
			event_id: eventId,
			name,
			price: Number(price),
			quantity_total: Number(qty)
		} }),
		onSuccess: () => {
			toast.success("Tipo de ingresso criado");
			setName("");
			setPrice(0);
			setQty(0);
			onChanged();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mb-3 text-sm font-semibold",
				children: "Tipos de ingresso"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mb-3 space-y-1 text-sm",
				children: [types.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "text-muted-foreground",
					children: "Nenhum tipo cadastrado."
				}), types.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: formatBRL(Number(t.price))
					})]
				}, t.id))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Nome (ex: Pista)",
						value: name,
						onChange: (e) => setName(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							placeholder: "Preço",
							value: price,
							onChange: (e) => setPrice(Number(e.target.value))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							placeholder: "Qtde",
							value: qty,
							onChange: (e) => setQty(Number(e.target.value))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							if (!name.trim()) {
								toast.error("Informe o nome");
								return;
							}
							m.mutate();
						},
						disabled: m.isPending,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Adicionar tipo"]
					})
				]
			})
		]
	});
}
function SellTicketCard({ eventId, types, primary, onSold }) {
	const [buyer, setBuyer] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [typeId, setTypeId] = (0, import_react.useState)("");
	const [price, setPrice] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		if (typeId) {
			const t = types.find((x) => x.id === typeId);
			if (t) setPrice(Number(t.price));
		}
	}, [typeId, types]);
	const m = useMutation({
		mutationFn: () => sellTicket({ data: {
			event_id: eventId,
			ticket_type_id: typeId || null,
			buyer_name: buyer,
			buyer_email: email,
			price_paid: Number(price)
		} }),
		onSuccess: () => {
			toast.success("Ingresso vendido");
			setBuyer("");
			setEmail("");
			onSold();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5 space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold",
				children: "Vender ingresso"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1 block text-xs",
				children: "Comprador *"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: buyer,
				onChange: (e) => setBuyer(e.target.value)
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1 block text-xs",
				children: "Email"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				type: "email",
				value: email,
				onChange: (e) => setEmail(e.target.value)
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Tipo"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: typeId,
					onValueChange: setTypeId,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Avulso" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: types.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: t.id,
						children: t.name
					}, t.id)) })]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Valor pago"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "number",
					min: 0,
					step: "0.01",
					value: price,
					onChange: (e) => setPrice(Number(e.target.value))
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				style: { backgroundColor: primary },
				disabled: m.isPending,
				onClick: () => {
					if (!buyer.trim()) {
						toast.error("Informe o comprador");
						return;
					}
					m.mutate();
				},
				children: m.isPending ? "Vendendo…" : "Registrar venda"
			})
		]
	});
}
function TablesMap({ eventId, tables, seats, tickets, primary, onChanged }) {
	const [label, setLabel] = (0, import_react.useState)("");
	const [cap, setCap] = (0, import_react.useState)(8);
	const createM = useMutation({
		mutationFn: () => createTable({ data: {
			event_id: eventId,
			label,
			capacity: Number(cap)
		} }),
		onSuccess: () => {
			toast.success("Mesa criada");
			setLabel("");
			onChanged();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const assignM = useMutation({
		mutationFn: (v) => assignSeat({ data: v }),
		onSuccess: () => onChanged(),
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const seatsByTable = /* @__PURE__ */ new Map();
	for (const s of seats) {
		const arr = seatsByTable.get(s.table_id) ?? [];
		arr.push(s);
		seatsByTable.set(s.table_id, arr);
	}
	const assignedTicketIds = new Set(seats.filter((s) => s.ticket_id).map((s) => s.ticket_id));
	const freeTickets = tickets.filter((t) => t.status !== "cancelado" && !assignedTicketIds.has(t.id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [tables.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-6 text-sm text-muted-foreground",
				children: "Nenhuma mesa criada. Adicione a primeira ao lado."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-4 md:grid-cols-2",
				children: tables.map((t) => {
					const ts = (seatsByTable.get(t.id) ?? []).sort((a, b) => a.seat_number - b.seat_number);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "rounded-[12px] p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-semibold",
								children: t.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs text-muted-foreground",
								children: [
									ts.filter((s) => s.ticket_id).length,
									"/",
									t.capacity,
									" ocupados"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-4 gap-2",
							children: ts.map((s) => {
								const ticket = tickets.find((tk) => tk.id === s.ticket_id);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col items-center gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "grid h-10 w-10 place-items-center rounded-full text-xs font-semibold",
											style: {
												backgroundColor: s.ticket_id ? primary : "var(--muted)",
												color: s.ticket_id ? "#fff" : "var(--muted-foreground)"
											},
											children: s.seat_number
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-full text-center text-[10px] text-muted-foreground truncate",
											children: ticket?.buyer_name ?? "Livre"
										}),
										s.ticket_id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "text-[10px] underline text-muted-foreground",
											onClick: () => assignM.mutate({
												seat_id: s.id,
												ticket_id: null
											}),
											children: "Liberar"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
											onValueChange: (v) => assignM.mutate({
												seat_id: s.id,
												ticket_id: v
											}),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
												className: "h-6 px-2 text-[10px]",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Atribuir" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [freeTickets.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "px-3 py-2 text-xs text-muted-foreground",
												children: "Sem ingressos livres"
											}), freeTickets.map((tk) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: tk.id,
												children: tk.buyer_name
											}, tk.id))] })]
										})
									]
								}, s.id);
							})
						})]
					}, t.id);
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "rounded-[12px] p-5 space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Nova mesa"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Nome"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: label,
					onChange: (e) => setLabel(e.target.value),
					placeholder: "Ex: Mesa 1"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Capacidade"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "number",
					min: 1,
					max: 30,
					value: cap,
					onChange: (e) => setCap(Number(e.target.value))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					style: { backgroundColor: primary },
					onClick: () => {
						if (!label.trim()) {
							toast.error("Informe o nome");
							return;
						}
						createM.mutate();
					},
					disabled: createM.isPending,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Criar mesa"]
				})
			]
		})]
	});
}
function CheckinPanel({ eventId, tickets, checkins, primary, onChanged }) {
	const [useCamera, setUseCamera] = (0, import_react.useState)(false);
	const [search, setSearch] = (0, import_react.useState)("");
	const [liveCount, setLiveCount] = (0, import_react.useState)(checkins.length);
	const [lastScanned, setLastScanned] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setLiveCount(checkins.length);
	}, [checkins.length]);
	(0, import_react.useEffect)(() => {
		const channel = supabase.channel(`checkins-${eventId}`).on("postgres_changes", {
			event: "INSERT",
			schema: "public",
			table: "checkins",
			filter: `event_id=eq.${eventId}`
		}, () => setLiveCount((c) => c + 1)).subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [eventId]);
	const m = useMutation({
		mutationFn: (v) => checkinTicket({ data: {
			event_id: eventId,
			...v
		} }),
		onSuccess: (res) => {
			if (res.alreadyCheckedIn) toast.info("Ingresso já havia entrado");
			else toast.success("Check-in realizado");
			onChanged();
		},
		onError: (e) => toast.error(e?.message ?? "Erro no check-in")
	});
	const filtered = tickets.filter((t) => t.buyer_name.toLowerCase().includes(search.toLowerCase()));
	const checkedTicketIds = new Set(checkins.map((c) => c.ticket_id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "rounded-[12px] p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: "Check-ins realizados"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-3xl font-bold",
						style: { color: primary },
						children: liveCount
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs text-muted-foreground",
						children: [
							"de ",
							tickets.length,
							" ingressos"
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: useCamera ? "default" : "outline",
					onClick: () => setUseCamera((v) => !v),
					style: useCamera ? { backgroundColor: primary } : void 0,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanLine, { className: "mr-2 h-4 w-4" }),
						" ",
						useCamera ? "Parar câmera" : "Ler QR"
					]
				})]
			}), useCamera && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrScanner, { onScan: (text) => {
				if (text === lastScanned) return;
				setLastScanned(text);
				m.mutate({
					qr: text,
					method: "qr"
				});
				setTimeout(() => setLastScanned(null), 2e3);
			} })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "rounded-[12px] p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mb-3 text-sm font-semibold",
					children: "Buscar por nome"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Nome do participante",
						className: "pl-9",
						value: search,
						onChange: (e) => setSearch(e.target.value)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "max-h-[420px] space-y-2 overflow-y-auto",
					children: [filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted-foreground",
						children: "Nenhum resultado."
					}), filtered.map((t) => {
						const already = checkedTicketIds.has(t.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 truncate text-sm",
								children: t.buyer_name
							}), already ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								children: "Presente"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => m.mutate({
									ticket_id: t.id,
									method: "nome"
								}),
								disabled: m.isPending,
								children: "Registrar"
							})]
						}, t.id);
					})]
				})
			]
		})]
	});
}
//#endregion
export { EventoDetalhe as component };
