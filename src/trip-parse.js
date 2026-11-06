const MONTHS = {
  enero: 1,
  ene: 1,
  january: 1,
  jan: 1,
  febrero: 2,
  feb: 2,
  february: 2,
  marzo: 3,
  mar: 3,
  march: 3,
  abril: 4,
  abr: 4,
  april: 4,
  apr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  june: 6,
  julio: 7,
  jul: 7,
  july: 7,
  agosto: 8,
  ago: 8,
  august: 8,
  aug: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  sept: 9,
  september: 9,
  octubre: 10,
  oct: 10,
  october: 10,
  noviembre: 11,
  nov: 11,
  november: 11,
  diciembre: 12,
  dic: 12,
  december: 12,
  dec: 12,
};

const AIRLINES =
  /\b(latam|aerol[ií]neas|jetsmart|flybondi|iberia|avianca|lufthansa|emirates|qatar|copa airlines|american airlines|united airlines|delta|air france|klm|volaris|british airways|gol linhas|sky airline)\b/i;

const AIRLINE_CODES = new Set([
  "LA", "AR", "WJ", "FO", "IB", "G3", "AV", "AA", "UA", "DL", "LH", "AF", "KL",
  "CM", "H2", "Y4", "VB", "EK", "QR", "BA", "AM", "UX", "TP", "AZ", "LX", "JA",
]);

const LODGING =
  /\b(airbnb|booking\.com|hotel|hostel|hospedaje|alojamiento|check-in|check-out|checkout|hotels\.com|despegar|hostelworld)\b/i;

const TRANSPORT =
  /\b(uber|cabify|didi|taxi|remis|transfer|tren|train|ómnibus|omnibus|colectivo|andesmar|flechabus|plataforma 10|renfe|amtrak|hertz|avis|alquiler de auto|car rental|butaca)\b/i;

const PLANS =
  /\b(restaurante|restaurant|mesa para|getyourguide|viator|museo|museum|tour\b|actividad|experiencia)\b/i;

const EVENTS =
  /\b(concierto|concert|conferencia|conference|webinar|ticketmaster|passline|festival|meetup|show|evento|entradas?)\b/i;

const MONTH_NAMES = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function iso(year, month, day, hour, minute, hasTime) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (!hasTime) return date;
  if (hour > 23 || minute > 59) return null;
  return `${date}T${pad(hour)}:${pad(minute)}`;
}

function monthNumber(name) {
  return MONTHS[String(name || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")] || null;
}

function pushDate(found, value, index) {
  if (!value) return;
  found.push({ value, index });
}

export function findDates(text) {
  const found = [];
  const used = [];
  const claim = (index, length, value) => {
    if (!value) return;
    if (used.some((span) => index < span.end && index + length > span.start)) return;
    used.push({ start: index, end: index + length });
    pushDate(found, value, index);
  };

  const source = String(text || "");
  for (const match of source.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/g)) {
    claim(
      match.index,
      match[0].length,
      iso(+match[1], +match[2], +match[3], +(match[4] || 0), +(match[5] || 0), Boolean(match[4])),
    );
  }
  for (const match of source.matchAll(
    /\b(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+de\s+(20\d{2})(?:,?\s+(\d{1,2}):(\d{2}))?/gi,
  )) {
    claim(
      match.index,
      match[0].length,
      iso(+match[3], monthNumber(match[2]), +match[1], +(match[4] || 0), +(match[5] || 0), Boolean(match[4])),
    );
  }
  for (const match of source.matchAll(
    /\b(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]{3,10})\.?\s+(20\d{2})(?:[,\s]+(\d{1,2}):(\d{2}))?/gi,
  )) {
    claim(
      match.index,
      match[0].length,
      iso(+match[3], monthNumber(match[2]), +match[1], +(match[4] || 0), +(match[5] || 0), Boolean(match[4])),
    );
  }
  for (const match of source.matchAll(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Lun|Mar|Mi[eé]|Jue|Vie|S[aá]b|Dom)[a-z]*\.?,?\s+([A-Za-z]{3,9})\s+(\d{1,2}),\s+(20\d{2})(?:\s+(\d{1,2}):(\d{2})(?:\s*([AP]M))?)?/gi,
  )) {
    let hour = match[4] == null ? 0 : +match[4];
    const ampm = (match[6] || "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    claim(
      match.index,
      match[0].length,
      iso(+match[3], monthNumber(match[1]), +match[2], hour, +(match[5] || 0), Boolean(match[4])),
    );
  }
  for (const match of source.matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2}),\s+(20\d{2})(?:\s+(\d{1,2}):(\d{2})(?:\s*([AP]M))?)?/g)) {
    let hour = match[4] == null ? 0 : +match[4];
    const ampm = (match[6] || "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    claim(
      match.index,
      match[0].length,
      iso(+match[3], monthNumber(match[1]), +match[2], hour, +(match[5] || 0), Boolean(match[4])),
    );
  }
  for (const match of source.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})(?:\s+(\d{1,2}):(\d{2}))?/g)) {
    claim(
      match.index,
      match[0].length,
      iso(+match[3], +match[2], +match[1], +(match[4] || 0), +(match[5] || 0), Boolean(match[4])),
    );
  }

  found.sort((a, b) => a.index - b.index);
  const unique = [];
  for (const item of found) {
    if (!unique.includes(item.value)) unique.push(item.value);
  }
  return unique;
}

export function formatWhen(value, lang) {
  if (!value) return "";
  const [date, time] = String(value).split("T");
  const [year, month, day] = date.split("-");
  const names = MONTH_NAMES[lang === "en" ? "en" : "es"];
  const label = `${Number(day)} ${names[Number(month) - 1]} ${year}`;
  return time ? `${label} ${time}` : label;
}
