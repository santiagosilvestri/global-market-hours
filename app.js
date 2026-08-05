(() => {
  "use strict";

  const MINUTE = 60_000;
  const DAY = 86_400_000;
  const WEEKDAYS = new Set([1, 2, 3, 4, 5]);
  const LOCALE = "es-ES";

  // Feriados bursátiles 2026 (cierres de jornada completa) por mercado.
  // Verificado contra los calendarios oficiales de cada bolsa/regulador en
  // agosto de 2026 (ver README para las fuentes). No incluye medias
  // jornadas ni feriados que ya caen en fin de semana. Este dato NO se
  // actualiza solo: hay que revisarlo una vez por año.
  const HOLIDAYS_2026 = {
    sydney: [
      ["2026-01-01", "Año Nuevo"],
      ["2026-01-26", "Día de Australia"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-04-06", "Lunes de Pascua"],
      ["2026-06-08", "Cumpleaños del Rey"],
      ["2026-10-05", "Día del Trabajo (NSW)"],
      ["2026-12-25", "Navidad"],
    ],
    tokyo: [
      ["2026-01-01", "Año Nuevo"],
      ["2026-01-02", "Feriado de mercado"],
      ["2026-01-12", "Día de la Mayoría de Edad"],
      ["2026-02-11", "Día de la Fundación Nacional"],
      ["2026-02-23", "Cumpleaños del Emperador"],
      ["2026-03-20", "Equinoccio de primavera"],
      ["2026-04-29", "Día de Showa"],
      ["2026-05-04", "Día del Verdor"],
      ["2026-05-05", "Día del Niño"],
      ["2026-05-06", "Día de la Constitución (obs.)"],
      ["2026-07-20", "Día del Mar"],
      ["2026-08-11", "Día de la Montaña"],
      ["2026-09-21", "Día del Respeto a los Ancianos"],
      ["2026-09-22", "Feriado de mercado"],
      ["2026-09-23", "Equinoccio de otoño"],
      ["2026-10-12", "Día del Deporte"],
      ["2026-11-03", "Día de la Cultura"],
      ["2026-11-23", "Día de Agradecimiento al Trabajo"],
      ["2026-12-31", "Feriado de mercado"],
    ],
    shanghai: [
      ["2026-01-01", "Año Nuevo"],
      ["2026-01-02", "Año Nuevo (feriado)"],
      ["2026-02-16", "Festival de Primavera"],
      ["2026-02-17", "Festival de Primavera"],
      ["2026-02-18", "Festival de Primavera"],
      ["2026-02-19", "Festival de Primavera"],
      ["2026-02-20", "Festival de Primavera"],
      ["2026-02-23", "Festival de Primavera"],
      ["2026-04-06", "Día de Qingming"],
      ["2026-05-01", "Día del Trabajo"],
      ["2026-05-04", "Día del Trabajo (feriado)"],
      ["2026-05-05", "Día del Trabajo (feriado)"],
      ["2026-06-19", "Festival del Bote del Dragón"],
      ["2026-09-25", "Festival del Medio Otoño"],
      ["2026-10-01", "Día Nacional"],
      ["2026-10-02", "Día Nacional"],
      ["2026-10-05", "Día Nacional"],
      ["2026-10-06", "Día Nacional"],
      ["2026-10-07", "Día Nacional"],
    ],
    "hong-kong": [
      ["2026-01-01", "Año Nuevo"],
      ["2026-02-17", "Año Nuevo Lunar"],
      ["2026-02-18", "Año Nuevo Lunar"],
      ["2026-02-19", "Año Nuevo Lunar"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-04-06", "Festival de Qingming (obs.)"],
      ["2026-04-07", "Lunes de Pascua (obs.)"],
      ["2026-05-01", "Día del Trabajo"],
      ["2026-05-25", "Cumpleaños de Buda (obs.)"],
      ["2026-06-19", "Festival Tuen Ng"],
      ["2026-07-01", "Día de la RAE de Hong Kong"],
      ["2026-10-01", "Día Nacional"],
      ["2026-10-19", "Festival Chung Yeung (obs.)"],
      ["2026-12-25", "Navidad"],
    ],
    mumbai: [
      ["2026-01-15", "Elecciones municipales (Maharashtra)"],
      ["2026-01-26", "Día de la República"],
      ["2026-03-03", "Holi"],
      ["2026-03-26", "Shri Ram Navami"],
      ["2026-03-31", "Shri Mahavir Jayanti"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-04-14", "Ambedkar Jayanti"],
      ["2026-05-01", "Día de Maharashtra"],
      ["2026-05-28", "Bakri Eid"],
      ["2026-06-26", "Muharram"],
      ["2026-09-14", "Ganesh Chaturthi"],
      ["2026-10-02", "Gandhi Jayanti"],
      ["2026-10-20", "Dussehra"],
      ["2026-11-10", "Diwali (Balipratipada)"],
      ["2026-11-24", "Guru Nanak Jayanti"],
      ["2026-12-25", "Navidad"],
    ],
    london: [
      ["2026-01-01", "Año Nuevo"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-04-06", "Lunes de Pascua"],
      ["2026-05-04", "Bank Holiday de primavera"],
      ["2026-05-25", "Spring Bank Holiday"],
      ["2026-08-31", "Summer Bank Holiday"],
      ["2026-12-25", "Navidad"],
      ["2026-12-28", "Boxing Day (obs.)"],
    ],
    frankfurt: [
      ["2026-01-01", "Año Nuevo"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-04-06", "Lunes de Pascua"],
      ["2026-05-01", "Día del Trabajo"],
      ["2026-12-24", "Nochebuena"],
      ["2026-12-25", "Navidad"],
      ["2026-12-31", "Fin de año"],
    ],
    "new-york": [
      ["2026-01-01", "Año Nuevo"],
      ["2026-01-19", "Martin Luther King Jr."],
      ["2026-02-16", "Cumpleaños de Washington"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-05-25", "Memorial Day"],
      ["2026-06-19", "Juneteenth"],
      ["2026-07-03", "Día de la Independencia (obs.)"],
      ["2026-09-07", "Día del Trabajo"],
      ["2026-11-26", "Acción de Gracias"],
      ["2026-12-25", "Navidad"],
    ],
    "sao-paulo": [
      ["2026-01-01", "Año Nuevo"],
      ["2026-02-16", "Carnaval"],
      ["2026-02-17", "Carnaval"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-04-21", "Tiradentes"],
      ["2026-05-01", "Día del Trabajo"],
      ["2026-06-04", "Corpus Christi"],
      ["2026-09-07", "Independencia de Brasil"],
      ["2026-10-12", "Nuestra Señora Aparecida"],
      ["2026-11-02", "Día de los Difuntos"],
      ["2026-11-20", "Consciência Negra"],
      ["2026-12-24", "Nochebuena"],
      ["2026-12-25", "Navidad"],
      ["2026-12-31", "Fin de año"],
    ],
    "buenos-aires": [
      ["2026-01-01", "Año Nuevo"],
      ["2026-02-16", "Carnaval"],
      ["2026-02-17", "Carnaval"],
      ["2026-03-24", "Día de la Memoria"],
      ["2026-04-02", "Día del Veterano (Malvinas)"],
      ["2026-04-03", "Viernes Santo"],
      ["2026-05-01", "Día del Trabajador"],
      ["2026-05-25", "Revolución de Mayo"],
      ["2026-06-15", "Paso a la Inmortalidad de Güemes"],
      ["2026-07-09", "Día de la Independencia"],
      ["2026-08-17", "Paso a la Inmortalidad de San Martín"],
      ["2026-10-12", "Día del Respeto a la Diversidad Cultural"],
      ["2026-11-23", "Día de la Soberanía Nacional"],
      ["2026-12-08", "Inmaculada Concepción"],
      ["2026-12-25", "Navidad"],
    ],
  };

  const MARKETS = [
    {
      id: "sydney",
      name: "Sídney",
      code: "ASX",
      timeZone: "Australia/Sydney",
      latitude: -33.8688,
      longitude: 151.2093,
      color: "#9b6cff",
      sessions: [[600, 960]],
      labelPosition: "left",
    },
    {
      id: "tokyo",
      name: "Tokio",
      code: "TSE",
      timeZone: "Asia/Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      color: "#ff62ad",
      sessions: [
        [540, 690],
        [750, 930],
      ],
      labelPosition: "left",
    },
    {
      id: "shanghai",
      name: "Shanghái",
      code: "SSE",
      timeZone: "Asia/Shanghai",
      latitude: 31.2304,
      longitude: 121.4737,
      color: "#ff6b64",
      sessions: [
        [570, 690],
        [780, 900],
      ],
      labelPosition: "left",
    },
    {
      id: "hong-kong",
      name: "Hong Kong",
      code: "HKEX",
      timeZone: "Asia/Hong_Kong",
      latitude: 22.3193,
      longitude: 114.1694,
      color: "#f3bd4d",
      sessions: [
        [570, 720],
        [780, 960],
      ],
      labelPosition: "bottom",
    },
    {
      id: "mumbai",
      name: "Mumbai",
      code: "NSE",
      timeZone: "Asia/Kolkata",
      latitude: 19.076,
      longitude: 72.8777,
      color: "#ff914d",
      sessions: [[555, 930]],
      labelPosition: "left",
    },
    {
      id: "london",
      name: "Londres",
      code: "LSE",
      timeZone: "Europe/London",
      latitude: 51.5072,
      longitude: -0.1276,
      color: "#638dff",
      sessions: [[480, 990]],
      labelPosition: "left",
    },
    {
      id: "frankfurt",
      name: "Fráncfort",
      code: "XETRA",
      timeZone: "Europe/Berlin",
      latitude: 50.1109,
      longitude: 8.6821,
      color: "#4fc8d4",
      sessions: [[540, 1050]],
      labelPosition: "right",
    },
    {
      id: "new-york",
      name: "Nueva York",
      code: "NYSE",
      timeZone: "America/New_York",
      latitude: 40.7128,
      longitude: -74.006,
      color: "#90cf59",
      sessions: [[570, 960]],
      labelPosition: "right",
    },
    {
      id: "sao-paulo",
      name: "São Paulo",
      code: "B3",
      timeZone: "America/Sao_Paulo",
      latitude: -23.5505,
      longitude: -46.6333,
      color: "#d986df",
      sessions: [[600, 1015]],
      labelPosition: "right",
    },
    {
      id: "buenos-aires",
      name: "Buenos Aires",
      code: "BYMA",
      timeZone: "America/Argentina/Buenos_Aires",
      latitude: -34.6037,
      longitude: -58.3816,
      color: "#72c9ff",
      sessions: [[630, 1020]],
      labelPosition: "left",
    },
  ];

  for (const market of MARKETS) {
    market.holidays = new Map(HOLIDAYS_2026[market.id] || []);
  }

  const elements = {
    localTime: document.querySelector("#local-time"),
    localDate: document.querySelector("#local-date"),
    locationName: document.querySelector("#location-name"),
    locationDetail: document.querySelector("#location-detail"),
    timezoneLabel: document.querySelector("#timezone-label"),
    locationButton: document.querySelector("#location-button"),
    openCount: document.querySelector("#open-count"),
    openList: document.querySelector("#open-list"),
    nextOpenLabel: document.querySelector("#next-open-label"),
    nextOpenName: document.querySelector("#next-open-name"),
    nextOpenCopy: document.querySelector("#next-open-copy"),
    nextOpenCountdown: document.querySelector("#next-open-countdown"),
    nextCloseLabel: document.querySelector("#next-close-label"),
    nextCloseName: document.querySelector("#next-close-name"),
    nextCloseCountdown: document.querySelector("#next-close-countdown"),
    nextCloseCopy: document.querySelector("#next-close-copy"),
    timelineAxis: document.querySelector("#timeline-axis"),
    timelineRows: document.querySelector("#timeline-rows"),
    timelineScroll: document.querySelector("#timeline-scroll"),
    currentLine: document.querySelector("#current-line"),
    currentTimePill: document.querySelector("#current-time-pill"),
    timelineDate: document.querySelector("#timeline-date"),
    mapMarkers: document.querySelector("#map-markers"),
    marketDetail: document.querySelector("#market-detail"),
    worldClockGrid: document.querySelector("#world-clock-grid"),
    worldLand: document.querySelector("#world-land"),
    worldBoundaries: document.querySelector("#world-boundaries"),
    worldGraticule: document.querySelector("#world-graticule"),
    globeLand: document.querySelector("#globe-land"),
    globeGraticule: document.querySelector("#globe-graticule"),
    globeLocationMarker: document.querySelector("#globe-location-marker"),
    holidayMarketFilter: document.querySelector("#holiday-market-filter"),
    holidayList: document.querySelector("#holiday-list"),
  };

  const state = {
    userTimeZone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    selectedMarketId: null,
    timelineDateKey: "",
    hasAutoScrolled: false,
    geography: null,
    boundaries: null,
    mapProjection: null,
    userCoordinates: null,
    holidayMarketFilter: "all",
    worldClockCards: null,
  };

  const formatterCache = new Map();

  function getFormatter(key, options, locale = LOCALE) {
    const cacheKey = `${locale}:${key}:${JSON.stringify(options)}`;
    if (!formatterCache.has(cacheKey)) {
      formatterCache.set(
        cacheKey,
        new Intl.DateTimeFormat(locale, options),
      );
    }
    return formatterCache.get(cacheKey);
  }

  function zonedParts(date, timeZone) {
    const formatter = getFormatter(
      `parts-${timeZone}`,
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
      "en-CA",
    );
    const values = {};

    for (const part of formatter.formatToParts(date)) {
      if (part.type !== "literal") {
        values[part.type] = Number(part.value);
      }
    }

    return {
      year: values.year,
      month: values.month,
      day: values.day,
      hour: values.hour,
      minute: values.minute,
      second: values.second,
    };
  }

  function zonedTimeToEpoch(parts, timeZone) {
    const target = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour || 0,
      parts.minute || 0,
      parts.second || 0,
    );
    let guess = target;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const actual = zonedParts(new Date(guess), timeZone);
      const represented = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
      );
      const difference = target - represented;
      guess += difference;
      if (difference === 0) break;
    }

    return guess;
  }

  function addCalendarDays(parts, amount) {
    const date = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day + amount),
    );
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  function dayOfWeek(parts) {
    return new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day),
    ).getUTCDay();
  }

  const WEEKDAY_LABELS = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];

  function dayOfWeekLabel(parts) {
    return WEEKDAY_LABELS[dayOfWeek(parts)];
  }

  function dateKey(parts) {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
      parts.day,
    ).padStart(2, "0")}`;
  }

  function dayNumber(parts) {
    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY);
  }

  function isHoliday(market, parts) {
    return market.holidays.has(dateKey(parts));
  }

  const nextHolidayCache = new Map();

  function getNextHoliday(market, now = new Date(), parts = zonedParts(now, market.timeZone)) {
    const cacheKey = dateKey(parts);
    const cached = nextHolidayCache.get(market.id);
    if (cached && cached.computedFor === cacheKey) return cached.value;

    let value = null;
    for (let offset = 0; offset <= 120; offset += 1) {
      const candidateDate = addCalendarDays(parts, offset);
      const key = dateKey(candidateDate);
      if (market.holidays.has(key)) {
        value = { dateKey: key, name: market.holidays.get(key), parts: candidateDate };
        break;
      }
    }
    nextHolidayCache.set(market.id, { computedFor: cacheKey, value });
    return value;
  }

  function sessionEpoch(dateParts, minutes, timeZone) {
    return zonedTimeToEpoch(
      {
        ...dateParts,
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
        second: 0,
      },
      timeZone,
    );
  }

  function getMarketStatus(market, now = new Date(), parts = zonedParts(now, market.timeZone)) {
    const minuteOfDay =
      parts.hour * 60 + parts.minute + parts.second / 60;

    if (!WEEKDAYS.has(dayOfWeek(parts))) {
      return { open: false, closeAt: null, isHoliday: false };
    }

    if (isHoliday(market, parts)) {
      return { open: false, closeAt: null, isHoliday: true };
    }

    for (const [start, end] of market.sessions) {
      if (minuteOfDay >= start && minuteOfDay < end) {
        return {
          open: true,
          closeAt: sessionEpoch(parts, end, market.timeZone),
          isHoliday: false,
        };
      }
    }

    return { open: false, closeAt: null, isHoliday: false };
  }

  function getNextOpen(market, now = new Date()) {
    const current = zonedParts(now, market.timeZone);

    for (let offset = 0; offset < 15; offset += 1) {
      const candidateDate = addCalendarDays(current, offset);
      if (!WEEKDAYS.has(dayOfWeek(candidateDate))) continue;
      if (isHoliday(market, candidateDate)) continue;

      for (const [start] of market.sessions) {
        const openAt = sessionEpoch(
          candidateDate,
          start,
          market.timeZone,
        );
        if (openAt > now.getTime()) return openAt;
      }
    }

    return null;
  }

  function getTimelineSegments(market, now = new Date()) {
    const localDate = zonedParts(now, state.userTimeZone);
    const nextLocalDate = addCalendarDays(localDate, 1);
    const localDayStart = zonedTimeToEpoch(
      { ...localDate, hour: 0, minute: 0, second: 0 },
      state.userTimeZone,
    );
    const localDayEnd = zonedTimeToEpoch(
      { ...nextLocalDate, hour: 0, minute: 0, second: 0 },
      state.userTimeZone,
    );
    const dayLength = localDayEnd - localDayStart;
    const marketDates = new Map();

    for (const sample of [
      localDayStart - DAY,
      localDayStart,
      localDayStart + DAY / 2,
      localDayEnd,
      localDayEnd + DAY,
    ]) {
      const marketDate = zonedParts(new Date(sample), market.timeZone);
      marketDates.set(dateKey(marketDate), marketDate);
    }

    const segments = [];
    for (const marketDate of marketDates.values()) {
      if (!WEEKDAYS.has(dayOfWeek(marketDate))) continue;
      if (isHoliday(market, marketDate)) continue;

      for (const [start, end] of market.sessions) {
        const startAt = sessionEpoch(
          marketDate,
          start,
          market.timeZone,
        );
        const endAt = sessionEpoch(marketDate, end, market.timeZone);
        const visibleStart = Math.max(startAt, localDayStart);
        const visibleEnd = Math.min(endAt, localDayEnd);

        if (visibleStart < visibleEnd) {
          segments.push({
            startAt,
            endAt,
            visibleStart,
            visibleEnd,
            left: ((visibleStart - localDayStart) / dayLength) * 100,
            width: ((visibleEnd - visibleStart) / dayLength) * 100,
          });
        }
      }
    }

    return segments.sort((a, b) => a.visibleStart - b.visibleStart);
  }

  function formatTime(date, timeZone, withSeconds = false) {
    return getFormatter(`time-${timeZone}-${withSeconds}`, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      ...(withSeconds ? { second: "2-digit" } : {}),
      hourCycle: "h23",
    }).format(date);
  }

  function formatCountdown(target, now = Date.now()) {
    const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, "0");

    if (days > 0) {
      return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
    }
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function renderClock(now) {
    const fullTime = formatTime(now, state.userTimeZone, true);
    const formattedDate = capitalize(
      getFormatter(`date-${state.userTimeZone}`, {
        timeZone: state.userTimeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now),
    );
    const offsetName =
      getFormatter(`offset-${state.userTimeZone}`, {
        timeZone: state.userTimeZone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value || "UTC";

    elements.localTime.textContent = fullTime;
    elements.localTime.dateTime = now.toISOString();
    elements.localDate.textContent = formattedDate;
    elements.timezoneLabel.textContent = `${offsetName} · ${state.userTimeZone.replaceAll(
      "_",
      " ",
    )}`;
  }

  function renderSummary(now) {
    const statuses = MARKETS.map((market) => ({
      market,
      ...getMarketStatus(market, now),
    }));
    const openMarkets = statuses.filter((item) => item.open);
    const closedMarkets = statuses.filter((item) => !item.open);

    elements.openCount.textContent = String(openMarkets.length);
    renderOpenMarketsList(openMarkets);

    const nextOpen = getSoonestMarkets(
      closedMarkets
        .map(({ market }) => ({
          market,
          opensAt: getNextOpen(market, now),
        }))
        .filter(({ opensAt }) => opensAt !== null),
      "opensAt",
    );

    if (nextOpen) {
      elements.nextOpenName.textContent = formatMarketNames(nextOpen.markets);
      elements.nextOpenCountdown.textContent = formatCountdown(
        nextOpen.at,
        now.getTime(),
      );
      elements.nextOpenLabel.textContent =
        nextOpen.markets.length > 1 ? "Próximos en abrir" : "Próximo en abrir";
      elements.nextOpenCopy.firstChild.textContent =
        nextOpen.markets.length > 1 ? "Abren en " : "Abre en ";
    } else {
      elements.nextOpenName.textContent = "—";
      elements.nextOpenCountdown.textContent = "Sin datos";
      elements.nextOpenLabel.textContent = "Próximo en abrir";
      elements.nextOpenCopy.firstChild.textContent = "Abre en ";
    }

    const nextClose = getSoonestMarkets(
      openMarkets.filter(({ closeAt }) => closeAt),
      "closeAt",
    );

    if (nextClose) {
      elements.nextCloseName.textContent = formatMarketNames(nextClose.markets);
      elements.nextCloseCountdown.textContent = formatCountdown(
        nextClose.at,
        now.getTime(),
      );
      elements.nextCloseLabel.textContent =
        nextClose.markets.length > 1 ? "Próximos en cerrar" : "Próximo en cerrar";
      elements.nextCloseCopy.firstChild.textContent =
        nextClose.markets.length > 1 ? "Cierran en " : "Cierra en ";
    } else {
      elements.nextCloseName.textContent = "Ninguno abierto";
      elements.nextCloseCountdown.textContent = "—";
      elements.nextCloseLabel.textContent = "Próximo en cerrar";
      elements.nextCloseCopy.firstChild.textContent = "Próximo cierre ";
    }

    document.title = `${openMarkets.length} abiertos · Global Market Hours`;
    updateMapStatuses(statuses, now);
    updateTimelineActivity(now);
  }

  function getSoonestMarkets(markets, timeKey) {
    const sorted = [...markets].sort((first, second) =>
      first[timeKey] - second[timeKey],
    );
    const at = sorted[0]?.[timeKey];

    if (typeof at !== "number") return null;

    return {
      at,
      markets: sorted.filter((item) => item[timeKey] === at),
    };
  }

  function formatMarketNames(markets) {
    return markets
      .map(({ market }) => `${market.name} (${market.code})`)
      .join(" · ");
  }

  function renderOpenMarketsList(openMarkets) {
    elements.openList.replaceChildren();
    elements.openList.classList.toggle("is-empty", openMarkets.length === 0);

    if (openMarkets.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No hay sesiones regulares abiertas";
      elements.openList.append(item);
      return;
    }

    const sortedMarkets = [...openMarkets].sort((first, second) =>
      first.market.name.localeCompare(second.market.name, LOCALE),
    );

    for (const { market } of sortedMarkets) {
      const item = document.createElement("li");
      item.textContent = `${market.name} (${market.code})`;
      elements.openList.append(item);
    }
  }

  const MONTH_ABBR = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];

  function formatShortDate(parts) {
    return `${parts.day} ${MONTH_ABBR[parts.month - 1]}`;
  }

  function daysBetween(leftParts, rightParts) {
    return dayNumber(leftParts) - dayNumber(rightParts);
  }

  function holidayBadge(daysAway) {
    if (daysAway === 0) return "Hoy";
    if (daysAway === 1) return "Mañana";
    if (daysAway <= 7) return "Esta semana";
    return "Próximo";
  }

  function getUpcomingHolidays(now, marketFilter = "all", limit = 8) {
    const items = [];

    for (const market of MARKETS) {
      if (marketFilter !== "all" && market.id !== marketFilter) continue;
      const marketToday = zonedParts(now, market.timeZone);

      for (const [holidayDateKey, name] of market.holidays.entries()) {
        const [year, month, day] = holidayDateKey.split("-").map(Number);
        const holidayParts = { year, month, day };
        const daysAway = daysBetween(holidayParts, marketToday);
        if (daysAway < 0 || daysAway > 120) continue;

        items.push({
          at: sessionEpoch(holidayParts, 0, market.timeZone),
          daysAway,
          market,
          name,
          parts: holidayParts,
        });
      }
    }

    return items
      .sort((first, second) => first.at - second.at || first.market.name.localeCompare(
        second.market.name,
        LOCALE,
      ))
      .slice(0, limit);
  }

  function renderHolidayCalendar(now) {
    if (!elements.holidayList) return;

    const upcoming = getUpcomingHolidays(now, state.holidayMarketFilter);
    elements.holidayList.replaceChildren();

    if (upcoming.length === 0) {
      const item = document.createElement("li");
      item.className = "holiday-empty";
      item.textContent = "No hay feriados próximos para este filtro";
      elements.holidayList.append(item);
      return;
    }

    for (const holiday of upcoming) {
      const item = document.createElement("li");
      item.className = "holiday-item";
      item.style.setProperty("--market-color", holiday.market.color);

      const date = document.createElement("time");
      date.className = "holiday-date";
      date.dateTime = dateKey(holiday.parts);
      date.textContent = formatShortDate(holiday.parts);

      const copy = document.createElement("div");
      copy.className = "holiday-copy";

      const market = document.createElement("strong");
      market.textContent = `${holiday.market.name} (${holiday.market.code})`;

      const name = document.createElement("span");
      name.textContent = holiday.name;

      const badge = document.createElement("span");
      badge.className = "holiday-badge";
      badge.textContent = holidayBadge(holiday.daysAway);

      copy.append(market, name);
      item.append(date, copy, badge);
      elements.holidayList.append(item);
    }
  }

  function renderWorldClock(now) {
    if (!elements.worldClockGrid) return;

    const viewerDay = dayNumber(zonedParts(now, state.userTimeZone));

    if (!state.worldClockCards) {
      state.worldClockCards = new Map();
      for (const market of MARKETS) {
        const card = document.createElement("article");
        card.className = "world-clock-card";
        card.dataset.marketId = market.id;
        card.style.setProperty("--market-color", market.color);

        const name = document.createElement("p");
        name.className = "wc-name";
        name.textContent = `${market.name} (${market.code})`;

        const time = document.createElement("p");
        time.className = "wc-time";

        const meta = document.createElement("p");
        meta.className = "wc-meta";

        const status = document.createElement("span");
        status.className = "wc-status";

        const weekday = document.createTextNode("");
        const dayFlag = document.createElement("span");
        dayFlag.className = "wc-dayflag";

        meta.append(status, weekday, dayFlag);

        const holidayNote = document.createElement("p");
        holidayNote.className = "wc-holiday";

        card.append(name, time, meta, holidayNote);
        elements.worldClockGrid.append(card);
        state.worldClockCards.set(market.id, {
          card,
          status,
          time,
          weekday,
          dayFlag,
          holidayNote,
        });
      }
    }

    for (const market of MARKETS) {
      const refs = state.worldClockCards.get(market.id);
      if (!refs) continue;

      const parts = zonedParts(now, market.timeZone);
      const dayOffset = dayNumber(parts) - viewerDay;
      const marketStatus = getMarketStatus(market, now, parts);
      const isNight = parts.hour < 6 || parts.hour >= 20;

      refs.card.classList.toggle("is-open", marketStatus.open);
      refs.card.classList.toggle("is-night", isNight);
      refs.time.textContent = formatTime(now, market.timeZone, true);

      refs.status.classList.toggle("is-open", marketStatus.open);
      refs.status.textContent = marketStatus.isHoliday
        ? "Feriado"
        : marketStatus.open
          ? "Abierto"
          : "Cerrado";
      refs.weekday.textContent = " · " + capitalize(dayOfWeekLabel(parts));

      if (dayOffset !== 0) {
        refs.dayFlag.textContent = dayOffset < 0 ? " · ayer" : " · mañana";
        refs.dayFlag.hidden = false;
      } else {
        refs.dayFlag.hidden = true;
        refs.dayFlag.textContent = "";
      }

      const nextHoliday = getNextHoliday(market, now, parts);
      const daysAway = nextHoliday
        ? dayNumber(nextHoliday.parts) - dayNumber(parts)
        : null;
      if (nextHoliday && daysAway !== null && daysAway <= 21) {
        refs.holidayNote.hidden = false;
        refs.holidayNote.textContent =
          daysAway === 0
            ? `Feriado hoy: ${nextHoliday.name}`
            : `Próximo feriado: ${formatShortDate(nextHoliday.parts)} · ${nextHoliday.name}`;
      } else {
        refs.holidayNote.hidden = true;
        refs.holidayNote.textContent = "";
      }
    }
  }

  function populateHolidayMarketFilter() {
    if (!elements.holidayMarketFilter) return;

    const options = [
      ["all", "Todos"],
      ...MARKETS.map((market) => [
        market.id,
        `${market.name} (${market.code})`,
      ]),
    ];

    elements.holidayMarketFilter.replaceChildren(
      ...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
    elements.holidayMarketFilter.value = state.holidayMarketFilter;
  }

  function renderTimeline(now = new Date()) {
    const localParts = zonedParts(now, state.userTimeZone);
    state.timelineDateKey = dateKey(localParts);
    elements.timelineAxis.replaceChildren();
    elements.timelineRows.replaceChildren();

    for (let hour = 0; hour <= 24; hour += 3) {
      const label = document.createElement("span");
      label.className = "axis-label";
      label.style.left = `${(hour / 24) * 100}%`;
      label.textContent = `${String(hour).padStart(2, "0")}:00`;
      elements.timelineAxis.append(label);
    }

    for (const market of MARKETS) {
      const row = document.createElement("div");
      row.className = "market-row";

      const label = document.createElement("div");
      label.className = "market-row-label";
      const title = document.createElement("strong");
      title.textContent = market.name;
      const subtitle = document.createElement("small");
      subtitle.textContent = market.code;
      label.append(title, subtitle);

      const track = document.createElement("div");
      track.className = "market-track";
      track.dataset.market = market.id;
      const segments = getTimelineSegments(market, now);

      for (const segment of segments) {
        const bar = document.createElement("div");
        const localStart = formatTime(
          new Date(segment.visibleStart),
          state.userTimeZone,
        );
        const localEnd = formatTime(
          new Date(segment.visibleEnd),
          state.userTimeZone,
        );
        bar.className = "session-bar";
        bar.dataset.start = String(segment.startAt);
        bar.dataset.end = String(segment.endAt);
        bar.style.setProperty("--left", `${segment.left}%`);
        bar.style.setProperty("--width", `${segment.width}%`);
        bar.style.setProperty("--market-color", market.color);
        bar.title = `${market.name} (${market.code}): ${localStart}–${localEnd}`;

        const barText = document.createElement("span");
        barText.textContent =
          segment.width > 15
            ? `${market.code} · ${localStart}–${localEnd}`
            : market.code;
        bar.append(barText);
        track.append(bar);
      }

      subtitle.textContent =
        segments.length === 0
          ? `${market.code} · sin sesión hoy`
          : market.code;

      row.append(label, track);
      elements.timelineRows.append(row);
    }

    elements.timelineDate.textContent = capitalize(
      getFormatter(`timeline-day-${state.userTimeZone}`, {
        timeZone: state.userTimeZone,
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(now),
    );

    updateTimelineActivity(now);
    autoScrollTimeline(now);
  }

  function updateTimelineActivity(now) {
    const timestamp = now.getTime();
    document.querySelectorAll(".session-bar").forEach((bar) => {
      const isActive =
        timestamp >= Number(bar.dataset.start) &&
        timestamp < Number(bar.dataset.end);
      bar.classList.toggle("is-active", isActive);
    });
  }

  function autoScrollTimeline(now) {
    if (state.hasAutoScrolled || window.innerWidth > 680) return;
    const parts = zonedParts(now, state.userTimeZone);
    const percent =
      (parts.hour * 3600 + parts.minute * 60 + parts.second) / 86_400;
    const maxScroll =
      elements.timelineScroll.scrollWidth -
      elements.timelineScroll.clientWidth;
    elements.timelineScroll.scrollLeft = Math.max(
      0,
      Math.min(maxScroll, maxScroll * percent),
    );
    state.hasAutoScrolled = true;
  }

  async function loadGeography() {
    if (!window.d3 || !window.topojson) return;

    try {
      const response = await fetch("vendor/world-110m.json", {
        cache: "force-cache",
      });
      if (!response.ok) throw new Error("World geography unavailable");

      const topology = await response.json();
      const countries = topology.objects.countries;
      state.geography = window.topojson.feature(topology, countries);
      state.boundaries = window.topojson.mesh(
        topology,
        countries,
        (first, second) => first !== second,
      );
      renderGeography();
    } catch {
      elements.marketDetail.textContent =
        "No se pudo cargar la capa geográfica del mapa.";
    }
  }

  function renderGeography() {
    if (!state.geography || !window.d3) return;

    const mapProjection = window.d3
      .geoEquirectangular()
      .fitExtent(
        [
          [10, 9],
          [990, 491],
        ],
        state.geography,
      );
    const mapPath = window.d3.geoPath(mapProjection);
    const graticule = window.d3.geoGraticule10();

    state.mapProjection = mapProjection;
    elements.worldLand.setAttribute("d", mapPath(state.geography));
    elements.worldBoundaries.setAttribute("d", mapPath(state.boundaries));
    elements.worldGraticule.setAttribute("d", mapPath(graticule));
    updateMapMarkerPositions();
    renderLocalGlobe();
  }

  function renderLocalGlobe() {
    if (!state.geography || !window.d3) return;

    const center = state.userCoordinates || {
      latitude: 20,
      longitude: -25,
    };
    const projection = window.d3
      .geoOrthographic()
      .translate([160, 160])
      .scale(141)
      .rotate([-center.longitude, -center.latitude])
      .clipAngle(90)
      .precision(0.3);
    const globePath = window.d3.geoPath(projection);

    elements.globeLand.setAttribute("d", globePath(state.geography));
    elements.globeGraticule.setAttribute(
      "d",
      globePath(window.d3.geoGraticule10()),
    );

    if (state.userCoordinates) {
      const pin = projection([
        state.userCoordinates.longitude,
        state.userCoordinates.latitude,
      ]);
      if (pin) {
        elements.globeLocationMarker.setAttribute(
          "transform",
          `translate(${pin[0]}, ${pin[1]})`,
        );
        elements.globeLocationMarker.setAttribute("visibility", "visible");
        return;
      }
    }

    elements.globeLocationMarker.setAttribute("visibility", "hidden");
  }

  function renderMapMarkers() {
    elements.mapMarkers.replaceChildren();

    for (const market of MARKETS) {
      const marker = document.createElement("button");
      marker.className = "map-marker is-closed";
      marker.type = "button";
      marker.dataset.market = market.id;
      marker.dataset.labelPosition = market.labelPosition;
      marker.style.setProperty("--marker-color", market.color);
      marker.setAttribute(
        "aria-label",
        `${market.name}, estado pendiente`,
      );

      const label = document.createElement("span");
      label.className = "marker-label";
      label.textContent = market.name;
      marker.append(label);
      marker.addEventListener("click", () => selectMarket(market.id));
      elements.mapMarkers.append(marker);
    }

    updateMapMarkerPositions();
  }

  function updateMapMarkerPositions() {
    for (const market of MARKETS) {
      const marker = elements.mapMarkers.querySelector(
        `[data-market="${market.id}"]`,
      );
      if (!marker) continue;

      const point = state.mapProjection?.([
        market.longitude,
        market.latitude,
      ]);
      const x = point ? (point[0] / 1000) * 100 : ((market.longitude + 180) / 360) * 100;
      const y = point ? (point[1] / 500) * 100 : ((90 - market.latitude) / 180) * 100;
      marker.style.left = `${x}%`;
      marker.style.top = `${y}%`;
    }
  }

  function updateMapStatuses(statuses, now) {
    for (const status of statuses) {
      const marker = elements.mapMarkers.querySelector(
        `[data-market="${status.market.id}"]`,
      );
      if (!marker) continue;
      marker.classList.toggle("is-open", status.open);
      marker.classList.toggle("is-closed", !status.open);
      marker.setAttribute(
        "aria-label",
        `${status.market.name}, ${status.open ? "abierto" : "cerrado"}`,
      );
      marker.title =
        `${status.market.name} (${status.market.code}) · ` +
        `${status.open ? "Abierto" : "Cerrado"} · ` +
        `${formatTime(now, status.market.timeZone, true)}`;
    }

    if (!state.selectedMarketId) {
      state.selectedMarketId =
        statuses.find(({ open }) => open)?.market.id || "new-york";
    }
    renderMarketDetail(now);
  }

  function selectMarket(marketId) {
    state.selectedMarketId = marketId;
    elements.mapMarkers.querySelectorAll(".map-marker").forEach((marker) => {
      marker.classList.toggle(
        "is-selected",
        marker.dataset.market === marketId,
      );
    });
    renderMarketDetail(new Date());
  }

  function renderMarketDetail(now) {
    const market = MARKETS.find(
      (item) => item.id === state.selectedMarketId,
    );
    if (!market) return;
    const status = getMarketStatus(market, now);
    const statusClass = status.open ? "detail-open" : "detail-closed";
    const statusText = status.open ? "Abierto" : "Cerrado";
    const nextText = status.open
      ? `cierra en ${formatCountdown(status.closeAt, now.getTime())}`
      : `abre en ${formatCountdown(getNextOpen(market, now), now.getTime())}`;

    elements.marketDetail.innerHTML =
      `<strong>${market.name} (${market.code})</strong> · ` +
      `<span class="${statusClass}">${statusText}</span> · ` +
      `${formatTime(now, market.timeZone, true)} · ${nextText}`;

    elements.mapMarkers.querySelectorAll(".map-marker").forEach((marker) => {
      marker.classList.toggle(
        "is-selected",
        marker.dataset.market === market.id,
      );
    });
  }

  function renderMovingLine() {
    const now = new Date();
    const parts = zonedParts(now, state.userTimeZone);
    const milliseconds =
      parts.hour * 3_600_000 +
      parts.minute * MINUTE +
      parts.second * 1000 +
      now.getMilliseconds();
    const percent = (milliseconds / DAY) * 100;

    elements.currentLine.style.left = `${percent}%`;
    elements.currentTimePill.textContent =
      `${String(parts.hour).padStart(2, "0")}:` +
      `${String(parts.minute).padStart(2, "0")}`;
    window.requestAnimationFrame(renderMovingLine);
  }

  async function reverseGeocode(latitude, longitude) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const language = navigator.language || "es";
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({
      format: "jsonv2",
      lat: latitude.toFixed(6),
      lon: longitude.toFixed(6),
      zoom: "10",
      addressdetails: "1",
      "accept-language": language,
    }).toString();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Reverse geocoding unavailable");
      const result = await response.json();
      const address = result.address || {};
      const locality =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        address.state;
      const country = address.country;
      return [locality, country].filter(Boolean).join(", ");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function locationErrorMessage(error) {
    if (error?.code === 1) return "Permiso de ubicación no concedido";
    if (error?.code === 2) return "El dispositivo no pudo determinar la ubicación";
    if (error?.code === 3) return "La detección tardó demasiado";
    return "Ubicación no disponible";
  }

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      elements.locationName.textContent = "Ubicación no disponible";
      elements.locationDetail.textContent =
        "Este navegador no ofrece geolocalización";
      return;
    }

    elements.locationButton.disabled = true;
    elements.locationButton.classList.add("is-loading");
    elements.locationName.textContent = "Detectando ubicación…";
    elements.locationDetail.textContent = "Esperando permiso del navegador";

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        state.userCoordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        renderLocalGlobe();
        const coordinates =
          `${coords.latitude.toFixed(3)}°, ${coords.longitude.toFixed(3)}°`;
        elements.locationName.textContent = coordinates;
        elements.locationDetail.textContent =
          `Precisión aproximada: ${Math.round(coords.accuracy)} m`;

        try {
          const location = await reverseGeocode(
            coords.latitude,
            coords.longitude,
          );
          if (location) elements.locationName.textContent = location;
        } catch {
          elements.locationDetail.textContent =
            `${coordinates} · no se pudo obtener el nombre de la ciudad`;
        } finally {
          elements.locationButton.disabled = false;
          elements.locationButton.classList.remove("is-loading");
        }
      },
      (error) => {
        elements.locationName.textContent = "Hora de tu dispositivo";
        elements.locationDetail.textContent =
          `${locationErrorMessage(error)} · podés reintentarlo`;
        elements.locationButton.disabled = false;
        elements.locationButton.classList.remove("is-loading");
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 600_000,
      },
    );
  }

  function tick() {
    const now = new Date();
    renderClock(now);
    renderSummary(now);
    renderWorldClock(now);
    renderHolidayCalendar(now);

    const localDate = zonedParts(now, state.userTimeZone);
    if (dateKey(localDate) !== state.timelineDateKey) {
      renderTimeline(now);
    }
  }

  function initialize() {
    populateHolidayMarketFilter();
    renderMapMarkers();
    renderTimeline(new Date());
    loadGeography();
    elements.holidayMarketFilter?.addEventListener("change", (event) => {
      state.holidayMarketFilter = event.target.value;
      renderHolidayCalendar(new Date());
    });
    elements.locationButton.addEventListener("click", detectLocation);
    detectLocation();
    tick();
    window.setInterval(tick, 1000);
    window.requestAnimationFrame(renderMovingLine);
  }

  initialize();
})();
