import processModule from "node:process";
//#region node_modules/.nitro/vite/services/ssr/index.js
var lastCapturedError;
var TTL_MS = 5e3;
function record(error) {
	lastCapturedError = {
		error,
		at: Date.now()
	};
}
var CAUSE_DEPTH_LIMIT = 5;
var DESCRIPTION_LENGTH_LIMIT = 8e3;
function describeError(error) {
	const parts = [];
	let current = error;
	for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
		if (!(current instanceof Error)) {
			parts.push(typeof current === "string" ? current : safeStringify(current));
			break;
		}
		const label = depth === 0 ? "" : "caused by: ";
		const status = describeStatus(current);
		parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
		current = current.cause;
	}
	return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}
function describeStatus(error) {
	const { status, statusCode } = error;
	const value = status ?? statusCode;
	return typeof value === "number" ? ` (status ${value})` : "";
}
function safeStringify(value) {
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}
function isErrorLike(value) {
	return value instanceof Error;
}
var originalConsoleError = console.error.bind(console);
console.error = (...args) => {
	originalConsoleError(...args.map((arg) => {
		if (!isErrorLike(arg)) return arg;
		record(arg);
		return describeError(arg);
	}));
};
if (typeof globalThis.addEventListener === "function") {
	globalThis.addEventListener("error", (event) => record(event.error ?? event));
	globalThis.addEventListener("unhandledrejection", (event) => record(event.reason));
}
function consumeLastCapturedError() {
	if (!lastCapturedError) return void 0;
	if (Date.now() - lastCapturedError.at > TTL_MS) {
		lastCapturedError = void 0;
		return;
	}
	const { error } = lastCapturedError;
	lastCapturedError = void 0;
	return error;
}
/** Fuso horário padrão do Rio Grande do Sul (mesmo de Brasília; sem horário de verão). */
var APP_TIMEZONE = "America/Sao_Paulo";
function asDate(value = /* @__PURE__ */ new Date()) {
	return value instanceof Date ? value : new Date(value);
}
/** Partes de calendário/hora no fuso do app. */
function datePartsInAppTz(value = /* @__PURE__ */ new Date()) {
	const d = asDate(value);
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: APP_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23"
	}).formatToParts(d);
	const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
	return {
		year: get("year"),
		month: get("month"),
		day: get("day"),
		hour: get("hour"),
		minute: get("minute"),
		second: get("second")
	};
}
/** Data de hoje (YYYY-MM-DD) no horário do RS — evite `toISOString().slice(0, 10)` (UTC). */
function todayYmd(value = /* @__PURE__ */ new Date()) {
	const { year, month, day } = datePartsInAppTz(asDate(value));
	const pad = (n) => String(n).padStart(2, "0");
	return `${year}-${pad(month)}-${pad(day)}`;
}
function formatTimeInAppTz(value, opts = {
	hour: "2-digit",
	minute: "2-digit"
}) {
	return asDate(value).toLocaleTimeString("pt-BR", {
		timeZone: APP_TIMEZONE,
		...opts
	});
}
/** Ano/mês correntes no fuso do RS (1–12). */
function currentYearMonthInAppTz(value = /* @__PURE__ */ new Date()) {
	const { year, month } = datePartsInAppTz(value);
	return {
		year,
		month
	};
}
/** Relógio: HH:MM:SS - DD/MM/AAAA no fuso do RS. */
function formatClockInAppTz(value = /* @__PURE__ */ new Date()) {
	const { year, month, day, hour, minute, second } = datePartsInAppTz(value);
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(hour)}:${pad(minute)}:${pad(second)} - ${pad(day)}/${pad(month)}/${year}`;
}
/**
* Converte valor de `<input type="datetime-local">` (YYYY-MM-DDTHH:mm)
* interpretado como horário de parede em APP_TIMEZONE → instante UTC.
*/
function fromAppTzDateTimeLocal(local) {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
	if (!m) return /* @__PURE__ */ new Date(NaN);
	const y = Number(m[1]);
	const month = Number(m[2]);
	const day = Number(m[3]);
	const hour = Number(m[4]);
	const minute = Number(m[5]);
	const desiredAsUtc = Date.UTC(y, month - 1, day, hour, minute, 0);
	let utcMs = desiredAsUtc;
	for (let i = 0; i < 3; i++) {
		const parts = datePartsInAppTz(new Date(utcMs));
		const diff = desiredAsUtc - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
		if (diff === 0) break;
		utcMs += diff;
	}
	return new Date(utcMs);
}
/** Formata um instante como valor datetime-local no fuso do app. */
function toAppTzDateTimeLocal(value) {
	const { year, month, day, hour, minute } = datePartsInAppTz(value);
	const pad = (n) => String(n).padStart(2, "0");
	return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
function renderErrorPage() {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
if (typeof processModule !== "undefined" && processModule.env) processModule.env.TZ = APP_TIMEZONE;
var serverEntryPromise;
async function getServerEntry() {
	if (!serverEntryPromise) serverEntryPromise = import("./server-DJ13d3Hb.mjs").then((m) => m.default ?? m);
	return serverEntryPromise;
}
async function normalizeCatastrophicSsrResponse(response) {
	if (response.status < 500) return response;
	if (!(response.headers.get("content-type") ?? "").includes("application/json")) return response;
	const body = await response.clone().text();
	if (!isH3SwallowedErrorBody(body)) return response;
	console.error(consumeLastCapturedError() ?? /* @__PURE__ */ new Error(`h3 swallowed SSR error: ${body}`));
	return new Response(renderErrorPage(), {
		status: 500,
		headers: { "content-type": "text/html; charset=utf-8" }
	});
}
function isH3SwallowedErrorBody(body) {
	try {
		const payload = JSON.parse(body);
		return payload.unhandled === true && payload.message === "HTTPError";
	} catch {
		return false;
	}
}
var server_default = { async fetch(request, env, ctx) {
	try {
		return await normalizeCatastrophicSsrResponse(await (await getServerEntry()).fetch(request, env, ctx));
	} catch (error) {
		console.error(error);
		return new Response(renderErrorPage(), {
			status: 500,
			headers: { "content-type": "text/html; charset=utf-8" }
		});
	}
} };
//#endregion
export { formatClockInAppTz as a, toAppTzDateTimeLocal as c, server_default as default, datePartsInAppTz as i, todayYmd as l, APP_TIMEZONE as n, formatTimeInAppTz as o, currentYearMonthInAppTz as r, fromAppTzDateTimeLocal as s, renderErrorPage as t };
