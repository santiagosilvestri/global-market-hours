"use strict";

const MARKETS = [
  { id: "NYSE", name: "New York Stock Exchange", city: "New York", zone: "America/New_York", sessions: [["09:30", "16:00"]], color: "#3c8cff" },
  { id: "NASDAQ", name: "Nasdaq", city: "New York", zone: "America/New_York", sessions: [["09:30", "16:00"]], color: "#2cc7da" },
  { id: "LSE", name: "London Stock Exchange", city: "London", zone: "Europe/London", sessions: [["08:00", "16:30"]], color: "#4b7cff" },
  { id: "EURONEXT", name: "Euronext Paris", city: "Paris", zone: "Europe/Paris", sessions: [["09:00", "17:30"]], color: "#5c90ff" },
  { id: "XETRA", name: "Deutsche Börse Xetra", city: "Frankfurt", zone: "Europe/Berlin", sessions: [["09:00", "17:30"]], color: "#3ed6d0" },
  { id: "BME", name: "Bolsas y Mercados Españoles", city: "Madrid", zone: "Europe/Madrid", sessions: [["09:00", "17:30"]], color: "#39a3ff" },
  { id: "TSE", name: "Tokyo Stock Exchange", city: "Tokyo", zone: "Asia/Tokyo", sessions: [["09:00", "11:30"], ["12:30", "15:30"]], color: "#ef5770" },
  { id: "HKEX", name: "Hong Kong Exchanges", city: "Hong Kong", zone: "Asia/Hong_Kong", sessions: [["09:30", "12:00"], ["13:00", "16:00"]], color: "#d99343" },
  { id: "SSE", name: "Shanghai Stock Exchange", city: "Shanghai", zone: "Asia/Shanghai", sessions: [["09:30", "11:30"], ["13:00", "15:00"]], color: "#e95e65" },
  { id: "B3", name: "B3 Brasil Bolsa Balcão", city: "São Paulo", zone: "America/Sao_Paulo", sessions: [["10:00", "17:55"]], color: "#4ee39a" },
  { id: "ASX", name: "Australian Securities Exchange", city: "Sydney", zone: "Australia/Sydney", sessions: [["10:00", "16:00"]], color: "#8568ff" }
];

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const formatterCache = new Map();
const hasDOM = typeof document !== "undefined";
const ui = hasDOM ? {
  localCity: document.querySelector("#localCity"),
  localZone: document.querySelector("#localZone"),
  localTime: document.querySelector("#localTime"),
  localDate: document.querySelector("#localDate"),
  openCount: document.querySelector("#openCount"),
  openNames: document.querySelector("#openNames"),
  nextOpenName: document.querySelector("#nextOpenName"),
  nextOpenCountdown: document.querySelector("#nextOpenCountdown"),
  nextCloseName: document.querySelector("#nextCloseName"),
  nextCloseCountdown: document.querySelector("#nextCloseCountdown"),
  timelineChart: document.querySelector("#timelineChart"),
  marketsGrid: document.querySelector("#marketsGrid"),
  cardTemplate: document.querySelector("#marketCardTemplate"),
  footerZone: document.querySelector("#footerZone"),
  refreshButton: document.querySelector("#refreshButton")
} : null;

const userZone = hasDOM ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") : "UTC";
let activeFilter = "all";
let state = [];

function getFormatter(zone, options) {
  const key = `${zone}:${JSON.stringify(options)}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...options }));
  }
  return formatterCache.get(key);
}

function partsAt(date, zone) {
  const parts = getFormatter(zone, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23", weekday: "short"
  }).formatToParts(date);

  const out = {};
  for (const part of parts) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return {
    year: Number(out.year), month: Number(out.month), day: Number(out.day),
    hour: Number(out.hour), minute: Number(out.minute), second: Number(out.second),
    weekday: out.weekday
  };
}

function zonedDateToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, zone) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;

  for (let i = 0; i < 4; i += 1) {
    const current = partsAt(new Date(guess), zone);
    const represented = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute, current.second);
    const delta = target - represented;
    guess += delta;
    if (Math.abs(delta) < 1000) break;
  }
  return new Date(guess);
}

function addCalendarDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function isWeekday(dateParts) {
  return !["Sat", "Sun"].includes(dateParts.weekday);
}

function parseClock(clock) {
  const [hour, minute] = clock.split(":").map(Number);
  return { hour, minute };
}

function marketDayEvents(market, baseParts) {
  const dayStart = zonedDateToUtc({ ...baseParts, hour: 0, minute: 0 }, market.zone);
  const dayParts = partsAt(dayStart, market.zone);
  if (!isWeekday(dayParts)) return [];

  return market.sessions.map(([start, end], index) => {
    const startClock = parseClock(start);
    const endClock = parseClock(end);
    return {
      market,
      sessionIndex: index,
      start: zonedDateToUtc({ ...baseParts, ...startClock }, market.zone),
      end: zonedDateToUtc({ ...baseParts, ...endClock }, market.zone)
    };
  });
}

function getRelevantEvents(market, now) {
  const today = partsAt(now, market.zone);
  const events = [];
  for (let offset = -1; offset <= 8; offset += 1) {
    const date = addCalendarDays(today, offset);
    events.push(...marketDayEvents(market, date));
  }
  return events.sort((a, b) => a.start - b.start);
}

function getMarketState(market, now) {
  const events = getRelevantEvents(market, now);
  const active = events.find(event => now >= event.start && now < event.end);
  const next = events.find(event => event.start > now);
  const currentDay = partsAt(now, market.zone);
  const todayEvents = marketDayEvents(market, currentDay);

  if (active) {
    return { market, status: "open", transition: active.end, activeEvent: active, nextOpen: next?.start || null };
  }

  const previousToday = todayEvents.filter(event => event.end <= now).at(-1);
  const nextToday = todayEvents.find(event => event.start > now);
  const isBreak = Boolean(previousToday && nextToday);

  return {
    market,
    status: isBreak ? "break" : "closed",
    transition: isBreak ? nextToday.start : next?.start || null,
    activeEvent: null,
    nextOpen: isBreak ? nextToday.start : next?.start || null
  };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.max(0, Math.ceil(ms / MINUTE_MS));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function formatMarketTime(date, zone, includeSeconds = false) {
  return getFormatter(zone, {
    hour: "2-digit", minute: "2-digit", ...(includeSeconds ? { second: "2-digit" } : {}), hourCycle: "h23"
  }).format(date);
}

function getTimeZoneLabel(zone, date) {
  return getFormatter(zone, { timeZoneName: "short" })
    .formatToParts(date)
    .find(part => part.type === "timeZoneName")?.value || zone;
}

function updateLocalClock(now) {
  ui.localTime.textContent = formatMarketTime(now, userZone, true);
  ui.localDate.textContent = getFormatter(userZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const zoneName = getTimeZoneLabel(userZone, now);
  ui.localZone.textContent = `${userZone} · ${zoneName}`;
  ui.localCity.textContent = userZone.split("/").at(-1).replaceAll("_", " ");
  ui.footerZone.textContent = `${userZone} (${zoneName})`;
}

function statusText(item) {
  if (item.status === "open") return "Open";
  if (item.status === "break") return "Break";
  return "Closed";
}

function transitionText(item, now) {
  if (!item.transition) return "Schedule unavailable";
  if (item.status === "open") return `Closes in ${formatDuration(item.transition - now)}`;
  if (item.status === "break") return `Resumes in ${formatDuration(item.transition - now)}`;
  return `Opens in ${formatDuration(item.transition - now)}`;
}

function createSparkPath(seed, positive) {
  let value = 24 + (seed % 9);
  const points = [];
  for (let x = 0; x <= 28; x += 1) {
    const wave = Math.sin((x + seed) * 0.8) * 3;
    const drift = positive ? x * 0.4 : x * -0.08;
    const jitter = ((x * seed * 17) % 9) - 4;
    value = Math.max(6, Math.min(44, 22 + wave + drift + jitter * 0.42));
    points.push([x * 10, 48 - value]);
  }
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L280,50 L0,50 Z` };
}

function renderCards(now) {
  if (!ui.marketsGrid.children.length) {
    for (const item of state) {
      const fragment = ui.cardTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".market-card");
      card.dataset.marketId = item.market.id;
      fragment.querySelector(".exchange-logo").textContent = item.market.id;
      fragment.querySelector(".exchange-name").textContent = item.market.name;
      fragment.querySelector(".exchange-meta").textContent = item.market.city;
      const hours = item.market.sessions.map(([start, end]) => `${start}–${end}`).join(" · ");
      fragment.querySelector(".session-hours").textContent = hours;
      const spark = createSparkPath(item.market.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0), item.status === "open");
      fragment.querySelector(".spark-line").setAttribute("d", spark.line);
      fragment.querySelector(".spark-area").setAttribute("d", spark.area);
      ui.marketsGrid.appendChild(fragment);
    }
  }

  for (const item of state) {
    const card = ui.marketsGrid.querySelector(`[data-market-id="${item.market.id}"]`);
    card.classList.remove("open", "closed", "break");
    card.classList.add(item.status);
    card.style.setProperty("--market-color", item.market.color);
    const pill = card.querySelector(".status-pill");
    pill.className = `status-pill ${item.status}`;
    pill.textContent = statusText(item);
    card.querySelector(".market-local-time").textContent = formatMarketTime(now, item.market.zone);
    card.querySelector(".countdown-label").textContent = transitionText(item, now);
    card.querySelector(".timezone-label").textContent = `${getTimeZoneLabel(item.market.zone, now)} · ${item.market.zone}`;
    card.classList.toggle("is-hidden", activeFilter !== "all" && (activeFilter === "open" ? item.status !== "open" : item.status === "open"));
  }
}

function updateSummary(now) {
  const open = state.filter(item => item.status === "open");
  const nextOpen = state.filter(item => item.status !== "open" && item.transition).sort((a, b) => a.transition - b.transition)[0];
  const nextClose = open.filter(item => item.transition).sort((a, b) => a.transition - b.transition)[0];

  ui.openCount.textContent = String(open.length);
  ui.openNames.textContent = open.length ? open.slice(0, 4).map(item => item.market.city).join(", ") + (open.length > 4 ? "…" : "") : "No major market is open";
  ui.nextOpenName.textContent = nextOpen ? `${nextOpen.market.city} (${nextOpen.market.id})` : "—";
  ui.nextOpenCountdown.textContent = nextOpen ? formatDuration(nextOpen.transition - now) : "—";
  ui.nextCloseName.textContent = nextClose ? `${nextClose.market.city} (${nextClose.market.id})` : "—";
  ui.nextCloseCountdown.textContent = nextClose ? formatDuration(nextClose.transition - now) : "—";

  for (const point of document.querySelectorAll(".map-point")) {
    const item = state.find(entry => entry.market.id === point.dataset.market);
    point.classList.toggle("is-open", item?.status === "open");
  }
}

function userDayBounds(now) {
  const local = partsAt(now, userZone);
  const start = zonedDateToUtc({ year: local.year, month: local.month, day: local.day, hour: 0, minute: 0 }, userZone);
  const tomorrow = addCalendarDays(local, 1);
  const end = zonedDateToUtc({ ...tomorrow, hour: 0, minute: 0 }, userZone);
  return { start, end };
}

function renderTimeline(now) {
  ui.timelineChart.replaceChildren();
  const { start: dayStart, end: dayEnd } = userDayBounds(now);
  const duration = dayEnd - dayStart;
  const nowLine = document.createElement("div");
  nowLine.className = "timeline-now";
  nowLine.style.left = `${Math.min(100, Math.max(0, ((now - dayStart) / duration) * 100))}%`;
  nowLine.dataset.label = formatMarketTime(now, userZone);
  ui.timelineChart.appendChild(nowLine);

  const timelineMarkets = ["ASX", "TSE", "HKEX", "LSE", "NYSE"];
  for (const id of timelineMarkets) {
    const market = MARKETS.find(entry => entry.id === id);
    const row = document.createElement("div");
    row.className = "timeline-row";
    const label = document.createElement("span");
    label.className = "timeline-label";
    label.textContent = market.city;
    row.appendChild(label);

    const marketToday = partsAt(dayStart, market.zone);
    const candidateDates = [-1, 0, 1].map(offset => addCalendarDays(marketToday, offset));
    const events = candidateDates.flatMap(date => marketDayEvents(market, date));

    for (const event of events) {
      const visibleStart = Math.max(event.start.getTime(), dayStart.getTime());
      const visibleEnd = Math.min(event.end.getTime(), dayEnd.getTime());
      if (visibleStart >= visibleEnd) continue;
      const bar = document.createElement("span");
      bar.className = "timeline-bar";
      bar.style.left = `${((visibleStart - dayStart) / duration) * 100}%`;
      bar.style.width = `${((visibleEnd - visibleStart) / duration) * 100}%`;
      bar.style.background = `linear-gradient(90deg, color-mix(in srgb, ${market.color} 75%, #0b1421), color-mix(in srgb, ${market.color} 42%, transparent))`;
      bar.title = `${market.name}: ${formatMarketTime(event.start, userZone)}–${formatMarketTime(event.end, userZone)} (${userZone})`;
      row.appendChild(bar);
    }
    ui.timelineChart.appendChild(row);
  }
}

function updateAll() {
  const now = new Date();
  updateLocalClock(now);
  state = MARKETS.map(market => getMarketState(market, now));
  updateSummary(now);
  renderCards(now);
  renderTimeline(now);
}

if (hasDOM) {
  for (const button of document.querySelectorAll(".filter-button")) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item === button));
      renderCards(new Date());
    });
  }

  ui.refreshButton.addEventListener("click", updateAll);
  updateAll();
  setInterval(updateAll, 30_000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MARKETS,
    partsAt,
    zonedDateToUtc,
    marketDayEvents,
    getMarketState,
    formatDuration
  };
}
