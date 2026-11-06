import { TRIPS_API } from "./config.js";

const COPY = {
  es: {
    kicker: "Viajes  \u00b7  reservas",
    title: "Viajes",
    lede: "Conect\u00e1s Gmail con tu autorizaci\u00f3n y, cada tanto, se leen solo los correos de reservas. Eleg\u00eds qu\u00e9 guardar: vuelos, hospedaje, transporte, planes y, si quer\u00e9s, eventos.",
    sample: "Datos de ejemplo",
    sampleBody: "Todav\u00eda no hay una cuenta de Gmail vinculada. Estas tarjetas muestran c\u00f3mo se ve una reserva le\u00edda del correo.",
    connect: "Vincular Gmail",
    disconnect: "Desvincular",
    sync: "Leer ahora",
    save: "Guardar perfil",
    readonly: "El acceso es de solo lectura. No se env\u00edan, borran ni reenv\u00edan correos.",
    needGoogle: "Para vincular Gmail hace falta publicar el servicio y un cliente OAuth de Google. Hasta entonces pod\u00e9s ver el ejemplo.",
    what: "Qu\u00e9 leer",
    account: "Cuenta",
    when: "Cada cu\u00e1nto",
    lookback: "Desde cu\u00e1ndo",
    upcoming: "Pr\u00f3ximo",
    empty: "No hay reservas en las categor\u00edas que elegiste.",
    categories: { flight: "Vuelos", lodging: "Hospedaje", transport: "Transporte", plan: "Planes", event: "Eventos" },
    hints: {
      flight: "Pasajes y tarjetas de embarque.",
      lodging: "Hoteles, departamentos y hostales.",
      transport: "Trenes, micros, autos y traslados.",
      plan: "Tours, actividades y mesas.",
      event: "Conciertos, conferencias y entradas.",
    },
    intervals: [["15", "15 minutos"], ["60", "1 hora"], ["180", "3 horas"], ["360", "6 horas"], ["720", "12 horas"], ["1440", "1 d\u00eda"], ["10080", "7 d\u00edas"]],
    days: [["30", "30 d\u00edas"], ["90", "90 d\u00edas"], ["180", "6 meses"], ["365", "1 a\u00f1o"]],
  },
  en: {
    kicker: "Trips  \u00b7  reservations",
    title: "Trips",
    lede: "You authorize Gmail, and every so often only reservation mail is read. You choose what to keep: flights, lodging, transport, plans, and events if you want them.",
    sample: "Sample data",
    sampleBody: "No Gmail account is linked yet. These cards show how a reservation read from mail looks.",
    connect: "Link Gmail",
    disconnect: "Unlink",
    sync: "Read now",
    save: "Save profile",
    readonly: "Access is read-only. Mail is never sent, deleted, or forwarded.",
    needGoogle: "Linking Gmail needs the published service and a Google OAuth client. Until then you can review the sample.",
    what: "What to read",
    account: "Account",
    when: "How often",
    lookback: "How far back",
    upcoming: "Upcoming",
    empty: "No reservations in the categories you chose.",
    categories: { flight: "Flights", lodging: "Lodging", transport: "Transport", plan: "Plans", event: "Events" },
    hints: {
      flight: "Tickets and boarding passes.",
      lodging: "Hotels, apartments, and hostels.",
      transport: "Trains, buses, cars, and transfers.",
      plan: "Tours, activities, and tables.",
      event: "Concerts, conferences, and tickets.",
    },
    intervals: [["15", "15 minutes"], ["60", "1 hour"], ["180", "3 hours"], ["360", "6 hours"], ["720", "12 hours"], ["1440", "1 day"], ["10080", "7 days"]],
    days: [["30", "30 days"], ["90", "90 days"], ["180", "6 months"], ["365", "1 year"]],
  },
};

const KEYS = ["flight", "lodging", "transport", "plan", "event"];
const PREF_KEY = { flight: "trackFlight", lodging: "trackLodging", transport: "trackTransport", plan: "trackPlan", event: "trackEvent" };

function lang() {
  return document.documentElement.lang === "es" ? "es" : "en";
}

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem("it-trips-prefs") || "null");
    if (raw && typeof raw.syncIntervalMinutes === "number") return raw;
  } catch { /* ignore */ }
  return { trackFlight: true, trackLodging: true, trackTransport: true, trackPlan: true, trackEvent: false, syncIntervalMinutes: 360, lookbackDays: 180 };
}

function sessionToken() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const fromHash = hash.get("session");
  if (fromHash) {
    sessionStorage.setItem("tt_session", fromHash);
    history.replaceState(null, "", location.pathname + location.search);
  }
  return sessionStorage.getItem("tt_session") || "";
}

function sampleItems() {
  const day = (offset, hour, minute) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    date.setUTCHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  return [
    { id: "sample-flight", category: "flight", title: "Aerol\u00edneas Argentinas AR1520 C\u00f3rdoba (COR) \u2192 Buenos Aires (AEP)", line: "Aerol\u00edneas Argentinas \u00b7 CORAEP \u00b7 C\u00f3rdoba (COR) \u2192 Aeroparque (AEP)", startsAt: day(18, 11, 5) },
    { id: "sample-lodging", category: "lodging", title: "Hotel de ejemplo \u00b7 San Telmo", line: "Hotel de ejemplo \u00b7 STELMO \u00b7 San Telmo, Buenos Aires", startsAt: day(18, 18, 0) },
    { id: "sample-transport", category: "transport", title: "Transfer Aeroparque \u2192 San Telmo", line: "Transfer de ejemplo \u00b7 TRN01 \u00b7 Aeroparque \u2192 San Telmo", startsAt: day(18, 13, 0) },
    { id: "sample-plan", category: "plan", title: "Recorrido a pie por San Telmo", line: "Gu\u00eda de ejemplo \u00b7 WALK1 \u00b7 Plaza Dorrego", startsAt: day(19, 16, 0) },
    { id: "sample-event", category: "event", title: "Concierto de ejemplo", line: "Sala de ejemplo \u00b7 SHOW1 \u00b7 Buenos Aires", startsAt: day(20, 21, 0) },
  ];
}

function when(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return "";
  return lang() === "es" ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}` : `${match[2]}/${match[3]}/${match[1]} ${match[4]}`;
}

const state = { prefs: loadPrefs(), me: null, reservations: sampleItems(), sample: true, error: "" };

async function api(path, init) {
  if (!TRIPS_API) throw new Error("no-api");
  const headers = new Headers(init?.headers);
  const token = sessionToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(`${TRIPS_API}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "request");
  return data;
}

async function refresh() {
  if (!TRIPS_API || !sessionToken()) return;
  try {
    state.me = await api("/api/me");
    if (state.me.profile) state.prefs = state.me.profile.preferences;
    const list = await api("/api/reservations");
    state.sample = Boolean(list.sample);
    state.reservations = (list.reservations || []).map((item) => ({
      ...item,
      line: [item.provider, item.confirmationCode, item.location, item.origin && item.destination ? `${item.origin} \u2192 ${item.destination}` : ""].filter(Boolean).join(" \u00b7 "),
    }));
  } catch (error) {
    state.error = error.message;
  }
}

function render() {
  const copy = COPY[lang()];
  const root = document.getElementById("trips-root");
  root.replaceChildren();
  const kicker = el("p", "kicker", copy.kicker);
  const title = el("h1", "", copy.title);
  const lede = el("p", "trips-lede", copy.lede);
  root.append(kicker, title, lede);
  if (state.sample) {
    const notice = el("div", "trips-notice");
    notice.append(el("strong", "", copy.sample), el("p", "", copy.sampleBody));
    root.append(notice);
  }
  if (state.error) root.append(el("p", "trips-banner", state.error));

  const grid = el("div", "trips-grid");
  const setup = el("section", "trips-panel");
  const linked = Boolean(state.me?.profile?.gmailLinked);
  setup.append(el("h2", "", linked ? copy.account : copy.what));
  if (linked) setup.append(el("p", "trips-meta", `${state.me.profile.name || ""} ${state.me.profile.email}`.trim()));
  else setup.append(el("p", "trips-lede", copy.readonly));
  for (const key of KEYS) {
    const label = el("label", "trips-choice");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(state.prefs[PREF_KEY[key]]);
    input.addEventListener("change", () => {
      state.prefs[PREF_KEY[key]] = input.checked;
      localStorage.setItem("it-trips-prefs", JSON.stringify(state.prefs));
      render();
    });
    const span = document.createElement("span");
    span.append(document.createTextNode(copy.categories[key]), el("small", "", copy.hints[key]));
    label.append(input, span);
    setup.append(label);
  }
  setup.append(selectField(copy.when, copy.intervals, state.prefs.syncIntervalMinutes, (value) => { state.prefs.syncIntervalMinutes = Number(value); }));
  setup.append(selectField(copy.lookback, copy.days, state.prefs.lookbackDays, (value) => { state.prefs.lookbackDays = Number(value); }));
  const actions = el("div", "trips-actions");
  if (linked) {
    actions.append(button(copy.save, true, () => save(true)), button(copy.sync, false, readNow), button(copy.disconnect, false, logout));
  } else if (TRIPS_API) {
    const link = el("a", "trips-action primary", copy.connect);
    link.href = `${TRIPS_API}/api/auth/google?return_to=${encodeURIComponent(location.href.split("#")[0])}`;
    actions.append(link);
  } else {
    const link = button(copy.connect, true, () => {});
    link.disabled = true;
    actions.append(link);
    setup.append(el("p", "trips-meta", copy.needGoogle));
  }
  setup.append(actions);

  const list = el("section", "trips-panel");
  list.append(el("h2", "", copy.upcoming));
  const visible = state.reservations.filter((item) => state.prefs[PREF_KEY[item.category]]);
  if (visible.length === 0) list.append(el("p", "trips-lede", copy.empty));
  for (const item of visible) {
    const card = el("article", "trips-card");
    const side = el("div");
    side.append(el("div", "trips-tag", copy.categories[item.category]), el("p", "trips-meta", when(item.startsAt)));
    const body = el("div");
    body.append(el("h3", "", item.title), el("p", "", item.line || ""));
    card.append(side, body);
    list.append(card);
  }
  grid.append(setup, list);
  root.append(grid);
}

function selectField(label, options, value, onChange) {
  const field = el("label", "trips-field", label);
  const select = document.createElement("select");
  for (const [optionValue, text] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = text;
    option.selected = Number(optionValue) === Number(value);
    select.append(option);
  }
  select.addEventListener("change", () => {
    onChange(select.value);
    localStorage.setItem("it-trips-prefs", JSON.stringify(state.prefs));
  });
  field.append(select);
  return field;
}

function button(text, primary, onClick) {
  const node = el("button", `trips-action${primary ? " primary" : ""}`, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

async function save(setupComplete) {
  localStorage.setItem("it-trips-prefs", JSON.stringify(state.prefs));
  if (!TRIPS_API || !state.me?.authenticated) return;
  await api("/api/preferences", { method: "PUT", body: JSON.stringify({ ...state.prefs, setupComplete }) });
  await refresh();
  render();
}

async function readNow() {
  await api("/api/sync", { method: "POST", body: JSON.stringify({ manual: true }) });
  await refresh();
  render();
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  sessionStorage.removeItem("tt_session");
  state.me = null;
  state.sample = true;
  state.reservations = sampleItems();
  render();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

sessionToken();
render();
document.addEventListener("it-lang", render);
refresh().then(render);
