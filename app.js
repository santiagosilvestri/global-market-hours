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

const SECOND_MS = 1_000;
const formatterCache = new Map();
const hasDOM = typeof document !== "undefined";
const userZone = hasDOM ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") : "UTC";

const ui = hasDOM ? {
  localCity: document.querySelector("#localCity"),
  localZone: document.querySelector("#localZone"),
  localTime: document.querySelector("#localTime"),
  localDate: document.querySelector("#localDate"),
  detectLocationButton: document.querySelector("#detectLocationButton"),
  detectLocationLabel: document.querySelector("#detectLocationLabel"),
  topbarTime: document.querySelector("#topbarTime"),
  clockZoneSelect: document.querySelector("#clockZoneSelect"),
  openCount: document.querySelector("#openCount"),
  openMarketsList: document.querySelector("#openMarketsList"),
  nextOpenName: document.querySelector("#nextOpenName"),
  nextOpenCountdown: document.querySelector("#nextOpenCountdown"),
  nextCloseName: document.querySelector("#nextCloseName"),
  nextCloseCountdown: document.querySelector("#nextCloseCountdown"),
  timelineChart: document.querySelector("#timelineChart"),
  marketsGrid: document.querySelector("#marketsGrid"),
  cardTemplate: document.querySelector("#marketCardTemplate"),
  footerZone: document.querySelector("#footerZone")
} : null;

let activeFilter = "all";
let selectedClockZone = userZone;
let marketState = [];
let nextStateRefreshAt = 0;
let timelineDateKey = "";
let timelineBounds = null;
let timelineNowLine = null;
let clockTimer = null;
const marketCards = new Map();

function getFormatter(zone, options) {
  const key = `${zone}:${JSON.stringify(options)}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...options }));
  }
  return formatterCache.get(key);
}

function partsAt(date, zone) {
  const parts = getFormatter(zone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  }).formatToParts(date);

  const output = {};
  for (const part of parts) {
    if (part.type !== "literal") output[part.type] = part.value;
  }

  return {
    year: Number(output.year),
    month: Number(output.month),
    day: Number(output.day),
    hour: Number(output.hour),
    minute: Number(output.minute),
    second: Number(output.second),
    weekday: output.weekday
  };
}

function zonedDateToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, zone) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const current = partsAt(new Date(guess), zone);
    const represented = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second
    );
    const delta = target - represented;
    guess += delta;
    if (Math.abs(delta) < SECOND_MS) break;
  }

  return new Date(guess);
}

function addCalendarDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
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
  if (!isWeekday(partsAt(dayStart, market.zone))) return [];

  return market.sessions.map(([start, end], sessionIndex) => ({
    market,
    sessionIndex,
    start: zonedDateToUtc({ ...baseParts, ...parseClock(start) }, market.zone),
    end: zonedDateToUtc({ ...baseParts, ...parseClock(end) }, market.zone)
  }));
}

function getRelevantEvents(market, now) {
  const marketToday = partsAt(now, market.zone);
  const events = [];

  for (let offset = -1; offset <= 8; offset += 1) {
    events.push(...marketDayEvents(market, addCalendarDays(marketToday, offset)));
  }

  return events.sort((first, second) => first.start - second.start);
}

function getMarketState(market, now) {
  const events = getRelevantEvents(market, now);
  const activeEvent = events.find(event => now >= event.start && now < event.end);
  const nextEvent = events.find(event => event.start > now);
  const todayEvents = marketDayEvents(market, partsAt(now, market.zone));

  if (activeEvent) {
    return {
      market,
      status: "open",
      transition: activeEvent.end,
      activeEvent
    };
  }

  const previousToday = todayEvents.filter(event => event.end <= now).at(-1);
  const nextToday = todayEvents.find(event => event.start > now);
  const isBreak = Boolean(previousToday && nextToday);

  return {
    market,
    status: isBreak ? "break" : "closed",
    transition: isBreak ? nextToday.start : nextEvent?.start || null,
    activeEvent: null
  };
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";

  const totalSeconds = Math.max(0, Math.ceil(milliseconds / SECOND_MS));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");

  return days > 0 ? `${days}d ${clock}` : clock;
}

function formatMarketTime(date, zone, includeSeconds = false) {
  return getFormatter(zone, {
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hourCycle: "h23"
  }).format(date);
}

function getTimeZoneLabel(zone, date) {
  return getFormatter(zone, { timeZoneName: "short" })
    .formatToParts(date)
    .find(part => part.type === "timeZoneName")?.value || zone;
}

function getZoneCity(zone) {
  return zone.split("/").at(-1).replaceAll("_", " ");
}

function statusText(item) {
  if (item.status === "open") return "Open";
  if (item.status === "break") return "Break";
  return "Closed";
}

function transitionText(item, now) {
  if (!item.transition) return "Schedule unavailable";
  const remaining = formatDuration(item.transition - now);
  if (item.status === "open") return `Closes in ${remaining}`;
  if (item.status === "break") return `Resumes in ${remaining}`;
  return `Opens in ${remaining}`;
}

function refreshMarketState(now) {
  marketState = MARKETS.map(market => getMarketState(market, now));
  const futureTransitions = marketState
    .map(item => item.transition?.getTime())
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > now.getTime());

  nextStateRefreshAt = futureTransitions.length
    ? Math.min(...futureTransitions) + 250
    : now.getTime() + 60_000;
}

function createSparkPath(seed) {
  const points = [];

  for (let x = 0; x <= 28; x += 1) {
    const wave = Math.sin((x + seed) * 0.8) * 3;
    const drift = x * 0.4;
    const jitter = ((x * seed * 17) % 9) - 4;
    const value = Math.max(6, Math.min(44, 22 + wave + drift + jitter * 0.42));
    points.push([x * 10, 48 - value]);
  }

  const line = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x},${y.toFixed(1)}`)
    .join(" ");

  return { line, area: `${line} L280,50 L0,50 Z` };
}

function buildMarketCards() {
  for (const market of MARKETS) {
    const fragment = ui.cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".market-card");
    const seed = market.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const spark = createSparkPath(seed);

    card.dataset.marketId = market.id;
    fragment.querySelector(".exchange-logo").textContent = market.id;
    fragment.querySelector(".exchange-name").textContent = market.name;
    fragment.querySelector(".exchange-meta").textContent = market.city;
    fragment.querySelector(".session-hours").textContent = market.sessions
      .map(([start, end]) => `${start}–${end}`)
      .join(" · ");
    fragment.querySelector(".spark-line").setAttribute("d", spark.line);
    fragment.querySelector(".spark-area").setAttribute("d", spark.area);

    ui.marketsGrid.appendChild(fragment);
    marketCards.set(market.id, card);
  }
}

function updateLocalClock(now) {
  const zoneName = getTimeZoneLabel(userZone, now);
  ui.localTime.textContent = formatMarketTime(now, userZone, true);
  ui.localTime.dateTime = now.toISOString();
  ui.localDate.textContent = getFormatter(userZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(now);
  ui.localZone.textContent = `${userZone} · ${zoneName}`;
  ui.localCity.textContent = getZoneCity(userZone);
  ui.footerZone.textContent = `${userZone} (${zoneName})`;
}

function updateTopbarClock(now) {
  ui.topbarTime.textContent = formatMarketTime(now, selectedClockZone, true);
  ui.topbarTime.dateTime = now.toISOString();
}

function updateMarketCards(now) {
  for (const item of marketState) {
    const card = marketCards.get(item.market.id);
    if (!card) continue;

    card.classList.remove("open", "closed", "break");
    card.classList.add(item.status);

    const pill = card.querySelector(".status-pill");
    pill.className = `status-pill ${item.status}`;
    pill.textContent = statusText(item);
    card.querySelector(".market-local-time").textContent = formatMarketTime(now, item.market.zone, true);
    card.querySelector(".countdown-label").textContent = transitionText(item, now);
    card.querySelector(".timezone-label").textContent = `${getTimeZoneLabel(item.market.zone, now)} · ${item.market.zone}`;

    const hiddenByFilter = activeFilter !== "all"
      && (activeFilter === "open" ? item.status !== "open" : item.status === "open");
    card.classList.toggle("is-hidden", hiddenByFilter);
  }
}

function updateOpenMarketsList(openMarkets) {
  const fragment = document.createDocumentFragment();

  if (!openMarkets.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No major market is open";
    fragment.appendChild(item);
  } else {
    for (const { market } of openMarkets) {
      const item = document.createElement("li");
      const code = document.createElement("strong");
      code.textContent = market.id;
      item.append(code, ` — ${market.city}`);
      fragment.appendChild(item);
    }
  }

  ui.openMarketsList.replaceChildren(fragment);
}

function updateSummary(now) {
  const openMarkets = marketState.filter(item => item.status === "open");
  const nextOpen = marketState
    .filter(item => item.status !== "open" && item.transition)
    .sort((first, second) => first.transition - second.transition)[0];
  const nextClose = openMarkets
    .filter(item => item.transition)
    .sort((first, second) => first.transition - second.transition)[0];

  ui.openCount.textContent = String(openMarkets.length);
  updateOpenMarketsList(openMarkets);
  ui.nextOpenName.textContent = nextOpen ? `${nextOpen.market.city} (${nextOpen.market.id})` : "—";
  ui.nextOpenCountdown.textContent = nextOpen ? formatDuration(nextOpen.transition - now) : "—";
  ui.nextCloseName.textContent = nextClose ? `${nextClose.market.city} (${nextClose.market.id})` : "—";
  ui.nextCloseCountdown.textContent = nextClose ? formatDuration(nextClose.transition - now) : "—";

  for (const point of document.querySelectorAll(".map-point")) {
    const item = marketState.find(entry => entry.market.id === point.dataset.market);
    point.classList.toggle("is-open", item?.status === "open");
  }
}

function userDayBounds(now) {
  const local = partsAt(now, userZone);
  const start = zonedDateToUtc({
    year: local.year,
    month: local.month,
    day: local.day,
    hour: 0,
    minute: 0
  }, userZone);
  const tomorrow = addCalendarDays(local, 1);
  const end = zonedDateToUtc({ ...tomorrow, hour: 0, minute: 0 }, userZone);

  return { start, end };
}

function getTimelineDateKey(now) {
  const local = partsAt(now, userZone);
  return `${local.year}-${local.month}-${local.day}`;
}

function renderTimelineSessions(now) {
  ui.timelineChart.replaceChildren();
  timelineBounds = userDayBounds(now);
  timelineDateKey = getTimelineDateKey(now);

  timelineNowLine = document.createElement("div");
  timelineNowLine.className = "timeline-now";
  ui.timelineChart.appendChild(timelineNowLine);

  const duration = timelineBounds.end - timelineBounds.start;
  const timelineMarketIds = ["ASX", "TSE", "HKEX", "LSE", "NYSE"];

  for (const id of timelineMarketIds) {
    const market = MARKETS.find(entry => entry.id === id);
    const row = document.createElement("div");
    const label = document.createElement("span");
    row.className = "timeline-row";
    label.className = "timeline-label";
    label.textContent = market.city;
    row.appendChild(label);

    const marketToday = partsAt(timelineBounds.start, market.zone);
    const events = [-1, 0, 1]
      .map(offset => addCalendarDays(marketToday, offset))
      .flatMap(date => marketDayEvents(market, date));

    for (const event of events) {
      const visibleStart = Math.max(event.start.getTime(), timelineBounds.start.getTime());
      const visibleEnd = Math.min(event.end.getTime(), timelineBounds.end.getTime());
      if (visibleStart >= visibleEnd) continue;

      const bar = document.createElement("span");
      bar.className = "timeline-bar";
      bar.style.left = `${((visibleStart - timelineBounds.start) / duration) * 100}%`;
      bar.style.width = `${((visibleEnd - visibleStart) / duration) * 100}%`;
      bar.style.background = `linear-gradient(90deg, color-mix(in srgb, ${market.color} 75%, #0b1421), color-mix(in srgb, ${market.color} 42%, transparent))`;
      bar.title = `${market.name}: ${formatMarketTime(event.start, userZone)}–${formatMarketTime(event.end, userZone)} (${userZone})`;
      row.appendChild(bar);
    }

    ui.timelineChart.appendChild(row);
  }
}

function updateTimelineMarker(now) {
  if (!timelineBounds || getTimelineDateKey(now) !== timelineDateKey) {
    renderTimelineSessions(now);
  }

  const duration = timelineBounds.end - timelineBounds.start;
  const percentage = ((now - timelineBounds.start) / duration) * 100;
  timelineNowLine.style.left = `${Math.min(100, Math.max(0, percentage))}%`;
  timelineNowLine.dataset.label = formatMarketTime(now, userZone, true);
}

function populateClockSelector() {
  const marketsByZone = new Map();

  for (const market of MARKETS) {
    if (!marketsByZone.has(market.zone)) {
      marketsByZone.set(market.zone, { city: market.city, ids: [] });
    }
    marketsByZone.get(market.zone).ids.push(market.id);
  }

  ui.clockZoneSelect.options[0].textContent = `My local time · ${getZoneCity(userZone)}`;

  for (const [zone, details] of marketsByZone) {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = `${details.city} · ${details.ids.join(" / ")}`;
    ui.clockZoneSelect.appendChild(option);
  }
}

function setLocationButtonState(stateName, label) {
  ui.detectLocationButton.classList.remove("is-loading", "is-success", "is-error");
  if (stateName) ui.detectLocationButton.classList.add(stateName);
  ui.detectLocationLabel.textContent = label;
}

function detectLocation() {
  if (!navigator.geolocation) {
    setLocationButtonState("is-error", "Unavailable");
    return;
  }

  setLocationButtonState("is-loading", "Detecting…");
  ui.detectLocationButton.disabled = true;

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      ui.detectLocationButton.title = `Detected at ${latitude.toFixed(3)}, ${longitude.toFixed(3)}. Timezone is read from this device.`;
      setLocationButtonState("is-success", "Location detected");
      ui.detectLocationButton.disabled = false;
    },
    error => {
      const label = error.code === error.PERMISSION_DENIED ? "Permission denied" : "Try again";
      setLocationButtonState("is-error", label);
      ui.detectLocationButton.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
  );
}

function updatePage(now) {
  if (!marketState.length || now.getTime() >= nextStateRefreshAt) {
    refreshMarketState(now);
  }

  updateLocalClock(now);
  updateTopbarClock(now);
  updateSummary(now);
  updateMarketCards(now);
  updateTimelineMarker(now);
}

function scheduleClockTick() {
  window.clearTimeout(clockTimer);
  updatePage(new Date());
  const delay = SECOND_MS - (Date.now() % SECOND_MS) + 20;
  clockTimer = window.setTimeout(scheduleClockTick, delay);
}

function initialise() {
  populateClockSelector();
  buildMarketCards();
  refreshMarketState(new Date());
  renderTimelineSessions(new Date());

  ui.clockZoneSelect.addEventListener("change", event => {
    selectedClockZone = event.target.value === "local" ? userZone : event.target.value;
    updateTopbarClock(new Date());
  });

  ui.detectLocationButton.addEventListener("click", detectLocation);

  for (const button of document.querySelectorAll(".filter-button")) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      updateMarketCards(new Date());
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleClockTick();
  });

  scheduleClockTick();
}

if (hasDOM) initialise();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MARKETS,
    partsAt,
    zonedDateToUtc,
    marketDayEvents,
    getMarketState,
    formatDuration,
    userDayBounds
  };
}
