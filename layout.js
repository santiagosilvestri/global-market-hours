(() => {
  "use strict";

  const STORAGE_KEY = "gmh:layout:v4";
  const STATE_VERSION = 9;
  const DRAG_THRESHOLD = 7;

  const PANEL_META = {
    local: { label: "Tu hora local" },
    summary: { label: "Resumen" },
    timeline: { label: "Línea global de sesiones" },
    map: { label: "Mapa de mercados" },
    worldclock: { label: "Horas globales" },
    calendar: { label: "Calendario bursátil" },
  };

  const DEFAULT_ORDER = ["local", "summary", "timeline", "map", "worldclock", "calendar"];
  const DEFAULT_HIDDEN = [];
  const DEFAULT_ROW_STARTS = [];
  const DEFAULT_SPANS = {
    local: 4,
    summary: 6,
    timeline: 6,
    map: 4,
    worldclock: 10,
    calendar: 10,
  };
  const LAYOUT_PRESETS = {
    compact: {
      label: "Compacta",
      description: "Vista equilibrada y de baja altura para consultar todo rápidamente.",
      order: ["local", "summary", "timeline", "map", "worldclock", "calendar"],
      hidden: [],
      sizes: { local: 4, summary: 6, timeline: 5, map: 5, worldclock: 10, calendar: 10 },
      rowHeights: [184, 320, 236, 300],
    },
    intraday: {
      label: "Intradía",
      description: "Prioriza mercados activos, sesiones y próximos eventos para operar durante el día.",
      order: ["local", "worldclock", "summary", "timeline", "calendar", "map"],
      hidden: [],
      sizes: { local: 2, worldclock: 3, summary: 5, timeline: 10, calendar: 7, map: 3 },
      rowHeights: [248, 332, 430],
    },
    macro: {
      label: "Macro",
      description: "Da máxima presencia al calendario y conecta los eventos con las sesiones globales.",
      order: ["local", "worldclock", "summary", "calendar", "timeline", "map"],
      hidden: [],
      sizes: { local: 2, worldclock: 3, summary: 5, calendar: 10, timeline: 6, map: 4 },
      rowHeights: [248, 470, 344],
    },
    global: {
      label: "Global",
      description: "Organiza la jornada por zonas horarias, mercados y continuidad entre sesiones.",
      order: ["worldclock", "summary", "local", "timeline", "map", "calendar"],
      hidden: [],
      sizes: { worldclock: 4, summary: 3, local: 3, timeline: 10, map: 5, calendar: 5 },
      rowHeights: [264, 332, 430],
    },
    focus: {
      label: "Focus",
      description: "Elimina distracciones y conserva únicamente los módulos críticos para una decisión rápida.",
      order: ["summary", "local", "worldclock", "timeline", "calendar", "map"],
      hidden: ["map"],
      sizes: { summary: 5, local: 2, worldclock: 3, timeline: 10, calendar: 10, map: 4 },
      rowHeights: [248, 326, 470],
    },
    desk: {
      label: "Desk",
      description: "Aprovecha monitores anchos con una cabecera operativa y una zona analítica amplia.",
      order: ["local", "summary", "worldclock", "timeline", "map", "calendar"],
      hidden: [],
      sizes: { local: 2, summary: 3, worldclock: 5, timeline: 7, map: 3, calendar: 10 },
      rowHeights: [264, 360, 470],
    },
  };
  const MIN_SPAN = 2;
  const MAX_SPAN = 10;
  const MIN_PANEL_SPANS = {
    local: 2,
    summary: 2,
    timeline: 3,
    map: 3,
    worldclock: 2,
    calendar: 2,
  };
  const RESPONSIVE_STACK_QUERY = "(max-width: 760px)";
  const MIN_ROW_HEIGHT = 96;
  const MAX_ROW_HEIGHT = 720;
  const ROW_HEIGHT_STEP = 12;

  function minimumSpanFor(panelId) {
    return MIN_PANEL_SPANS[panelId] ?? MIN_SPAN;
  }

  function clampSpanForPanel(panelId, value) {
    return Math.min(
      MAX_SPAN,
      Math.max(minimumSpanFor(panelId), Math.round(Number(value) || MAX_SPAN)),
    );
  }

  // Cada panel conserva un ancho propio. El empaquetado de filas se resuelve
  // después, por orden, de modo que cambiar un panel no recalcula de forma
  // inesperada el ancho de todos los demás.
  function computeSpans(visibleIds, sizeOverrides) {
    const result = new Map();
    visibleIds.forEach((id) => {
      const requested = sizeOverrides[id] ?? DEFAULT_SPANS[id] ?? 6;
      result.set(id, clampSpanForPanel(id, requested));
    });
    return result;
  }

  const dashboard = document.querySelector(".dashboard");
  const toggleBtn = document.getElementById("customize-toggle");
  const drawer = document.getElementById("customize-drawer");
  const presetWrap = document.getElementById("layout-presets");
  const list = document.getElementById("customize-list");
  const resetBtn = document.getElementById("customize-reset");

  if (!dashboard || !toggleBtn || !drawer || !list) return;

  const panels = new Map();
  dashboard.querySelectorAll(".panel[data-panel-id]").forEach((el) => {
    panels.set(el.dataset.panelId, el);
  });

  const splitterLayer = document.createElement("div");
  splitterLayer.className = "layout-splitter-layer";
  splitterLayer.setAttribute("aria-hidden", "false");
  dashboard.appendChild(splitterLayer);

  const dropPreview = document.createElement("div");
  dropPreview.className = "layout-drop-preview";
  dropPreview.setAttribute("aria-hidden", "true");
  dashboard.appendChild(dropPreview);

  let dashboardDropState = null;
  let dashboardPreviewKey = "";

  function cloneSizes(sizes) {
    return { ...sizes };
  }

  function rowSignatureFromIds(ids) {
    return ids.join("|");
  }

  function rowSignatureFromModel(row) {
    return rowSignatureFromIds(row.items.map((item) => item.id));
  }

  function rowSignatureFromDom(row) {
    return rowSignatureFromIds(row.map(({ panel }) => panel.dataset.panelId));
  }

  function rowHeightMapFromArray(values, order, sizes, hidden, rowStarts = DEFAULT_ROW_STARTS) {
    const result = {};
    if (!Array.isArray(values)) return result;
    const rows = rowModelFor(order, sizes, hidden, rowStarts);
    values.forEach((value, index) => {
      const height = Math.round(Number(value));
      const row = rows[index];
      if (!row || height < MIN_ROW_HEIGHT || height > MAX_ROW_HEIGHT) return;
      result[rowSignatureFromModel(row)] = height;
    });
    return result;
  }

  function presetRowHeights(preset) {
    return rowHeightMapFromArray(
      preset.rowHeights,
      preset.order || DEFAULT_ORDER,
      preset.sizes || {},
      preset.hidden || DEFAULT_HIDDEN,
      preset.rowStarts || DEFAULT_ROW_STARTS,
    );
  }

  function sameNumberMap(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => left[key] === right[key]);
  }

  function sameStringList(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }

  function sameStringSet(left, right) {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((value) => rightSet.has(value));
  }

  function currentPresetName() {
    return Object.entries(LAYOUT_PRESETS).find(([, preset]) => {
      const presetOrder = preset.order || DEFAULT_ORDER;
      const presetHidden = preset.hidden || DEFAULT_HIDDEN;
      return (
        sameNumberMap(state.sizes, preset.sizes || {}) &&
        sameNumberMap(state.rowHeights, presetRowHeights(preset)) &&
        sameStringList(state.order, presetOrder) &&
        sameStringSet(state.hidden, presetHidden) &&
        sameStringSet(state.rowStarts, preset.rowStarts || DEFAULT_ROW_STARTS)
      );
    })?.[0] || null;
  }

  function sanitizeState(parsed) {
    let order = Array.isArray(parsed?.order)
      ? [...new Set(parsed.order.filter((id) => DEFAULT_ORDER.includes(id)))]
      : [];
    // Si viene de una versión anterior con menos paneles (ej. sin
    // "worldclock"), lo agregamos al final en vez de descartar todo el
    // resto de la personalización ya guardada.
    for (const id of DEFAULT_ORDER) {
      if (!order.includes(id)) order.push(id);
    }
    if (order.length !== DEFAULT_ORDER.length) order = DEFAULT_ORDER.slice();

    const hidden = Array.isArray(parsed?.hidden)
      ? [...new Set(parsed.hidden.filter((id) => DEFAULT_ORDER.includes(id)))]
      : DEFAULT_HIDDEN.slice();
    // nunca ocultar todos los paneles a la vez
    const safeHidden = hidden.length >= DEFAULT_ORDER.length ? [] : hidden;

    const sizes = {};
    if (parsed?.sizes && typeof parsed.sizes === "object") {
      // Los estados actuales ya usan una grilla de 10 columnas. La versión
      // anterior multiplicaba cualquier valor entre 2 y 5 al recargar, por
      // lo que 4 terminaba convertido en 8 y 5 en 10. Solo migramos los
      // nombres antiguos; los valores numéricos se conservan tal como fueron
      // guardados.
      const legacyMap = { large: 10, full: 10, standard: 6, compact: 4 };
      for (const id of DEFAULT_ORDER) {
        const raw = parsed.sizes[id];
        const value = typeof raw === "string" ? legacyMap[raw] : raw;
        const num = Math.round(Number(value));
        if (Number.isInteger(num) && num >= MIN_SPAN && num <= MAX_SPAN) {
          sizes[id] = clampSpanForPanel(id, num);
        }
      }
    }

    const worldClockHidden = Array.isArray(parsed?.worldClockHidden)
      ? [...new Set(parsed.worldClockHidden.filter((id) => typeof id === "string"))]
      : [];

    const rowStarts = Array.isArray(parsed?.rowStarts)
      ? [...new Set(parsed.rowStarts.filter((id) => DEFAULT_ORDER.includes(id)))]
      : DEFAULT_ROW_STARTS.slice();

    let rowHeights = {};
    if (Array.isArray(parsed?.rowHeights)) {
      rowHeights = rowHeightMapFromArray(
        parsed.rowHeights,
        order,
        sizes,
        safeHidden,
        rowStarts,
      );
    } else if (parsed?.rowHeights && typeof parsed.rowHeights === "object") {
      for (const [key, rawHeight] of Object.entries(parsed.rowHeights)) {
        const height = Math.round(Number(rawHeight));
        if (key && height >= MIN_ROW_HEIGHT && height <= MAX_ROW_HEIGHT) {
          rowHeights[key] = height;
        }
      }
    }

    return {
      version: STATE_VERSION,
      order,
      hidden: safeHidden,
      sizes,
      worldClockHidden,
      rowStarts,
      rowHeights,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return sanitizeState(null);
      return sanitizeState(JSON.parse(raw));
    } catch {
      return sanitizeState(null);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage puede fallar en modo privado o con el almacenamiento
      // lleno; en ese caso el layout simplemente no persiste entre visitas.
    }
  }

  let state = loadState();
  rebalanceState();
  saveState();

  function applyLayout() {
    const hiddenSet = new Set(state.hidden);
    const visible = state.order.filter((id) => !hiddenSet.has(id));
    const spanById = computeSpans(visible, state.sizes);

    state.order.forEach((id, fullIndex) => {
      const el = panels.get(id);
      if (!el) return;
      el.style.setProperty("--panel-order", fullIndex);
      el.classList.toggle("is-row-start", state.rowStarts.includes(id));
      if (hiddenSet.has(id)) {
        el.classList.add("is-hidden-panel");
        el.setAttribute("aria-hidden", "true");
      } else {
        el.classList.remove("is-hidden-panel");
        el.removeAttribute("aria-hidden");
        const span = spanById.get(id) ?? MAX_SPAN;
        el.style.setProperty("--panel-span", String(span));
      }
    });

    applyWorldClockVisibility();
    window.requestAnimationFrame(() => {
      updateResponsivePanelClasses();
      applyRowHeights();
    });
    scheduleSplitterRefresh();
    renderPresetControls();
    renderList();
    syncExpandButtons();
  }

  function visiblePanelElements() {
    return [...panels.values()].filter(
      (panel) => !panel.classList.contains("is-hidden-panel"),
    );
  }

  function getRows() {
    const rows = [];
    for (const panel of visiblePanelElements()) {
      const rect = panel.getBoundingClientRect();
      let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 8);
      if (!row) {
        row = { top: rect.top, panels: [] };
        rows.push(row);
      }
      row.panels.push({ panel, rect });
    }

    return rows
      .sort((first, second) => first.top - second.top)
      .map((row) =>
        row.panels.sort((first, second) => first.rect.left - second.rect.left),
      );
  }

  function isStackedLayout() {
    return window.matchMedia(RESPONSIVE_STACK_QUERY).matches;
  }

  function applyRowHeights() {
    const rows = getRows();

    for (const panel of panels.values()) {
      panel.style.removeProperty("--custom-row-height");
      panel.classList.remove("has-custom-row-height");
    }

    // En móvil y pantallas angostas la altura vuelve a ser automática: el
    // contenido manda y nunca queda recortado por una medida de escritorio.
    if (isStackedLayout()) return;

    rows.forEach((row) => {
      const savedHeight = state.rowHeights[rowSignatureFromDom(row)];
      if (!savedHeight) return;
      const height = Math.max(savedHeight, minimumHeightForRow(row));
      row.forEach(({ panel }) => {
        panel.style.setProperty("--custom-row-height", `${height}px`);
        panel.classList.add("has-custom-row-height");
      });
    });
  }

  function updateResponsivePanelClasses() {
    for (const panel of panels.values()) {
      if (panel.classList.contains("is-hidden-panel")) continue;
      const width = panel.getBoundingClientRect().width;
      panel.classList.toggle("is-panel-narrow", width > 0 && width < 520);
      panel.classList.toggle("is-panel-compact", width > 0 && width < 340);
      panel.classList.toggle("is-panel-wide", width >= 760);
      if (panel.dataset.panelId === "summary") {
        panel.classList.toggle("is-compact", width > 0 && width < 690);
      }
    }
  }

  // Muestra u oculta tarjetas individuales dentro del panel "Horas
  // globales" según state.worldClockHidden. Las tarjetas ya existen en el
  // DOM (las crea app.js en el primer render) con un data-market-id; acá
  // solo se les agrega/quita una clase, sin duplicar la lista de mercados.
  function applyWorldClockVisibility() {
    const hiddenSet = new Set(state.worldClockHidden);
    document.querySelectorAll(".world-clock-card[data-market-id]").forEach((card) => {
      card.classList.toggle("is-hidden-market", hiddenSet.has(card.dataset.marketId));
    });
  }

  function moveInOrder(id, delta) {
    const idx = state.order.indexOf(id);
    const newIdx = idx + delta;
    if (idx === -1 || newIdx < 0 || newIdx >= state.order.length) return;
    const next = state.order.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    state.order = next;
    rebalanceState();
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function orderWithInsertion(draggedId, targetId, placement) {
    if (draggedId === targetId) return state.order.slice();
    const next = state.order.filter((id) => id !== draggedId);
    const targetIndex = next.indexOf(targetId);
    if (targetIndex === -1) return state.order.slice();
    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    next.splice(insertIndex, 0, draggedId);
    return next;
  }

  function setPanelOrder(nextOrder) {
    if (!Array.isArray(nextOrder)) return;
    const normalized = [...new Set(nextOrder.filter((id) => DEFAULT_ORDER.includes(id)))];
    if (normalized.length !== DEFAULT_ORDER.length) return;
    state.order = normalized;
    state.rowStarts = normalizeRowStarts(state.rowStarts, normalized);
    rebalanceState();
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function rowModelFor(
    order,
    sizeOverrides,
    hiddenList = state.hidden,
    rowStartList = state.rowStarts,
  ) {
    const hiddenSet = new Set(hiddenList);
    const rowStartSet = new Set(rowStartList || []);
    const visible = order.filter((id) => !hiddenSet.has(id));
    const spanById = computeSpans(visible, sizeOverrides);
    const rows = [];
    let current = { items: [], total: 0 };

    function closeRow() {
      if (!current.items.length) return;
      rows.push(current);
      current = { items: [], total: 0 };
    }

    for (const id of visible) {
      const span = spanById.get(id) ?? MAX_SPAN;
      if (current.items.length && rowStartSet.has(id)) closeRow();
      if (current.items.length && current.total + span > MAX_SPAN) closeRow();
      current.items.push({ id, span });
      current.total += span;
      if (current.total >= MAX_SPAN) closeRow();
    }
    closeRow();

    return rows;
  }

  function allocateBalancedSpans(items, total = MAX_SPAN, sizeOverrides = {}) {
    if (!items.length) return new Map();

    const entries = items.map((item, index) => {
      const span = clampSpanForPanel(item.id, sizeOverrides[item.id] ?? item.span);
      return {
        id: item.id,
        index,
        span,
        minimum: minimumSpanFor(item.id),
        ideal: 0,
        allocated: 0,
      };
    });

    const minimumTotal = entries.reduce((sum, entry) => sum + entry.minimum, 0);
    if (minimumTotal > total) {
      return new Map(entries.map((entry) => [entry.id, entry.span]));
    }

    const weightTotal = entries.reduce((sum, entry) => sum + entry.span, 0) || entries.length;
    entries.forEach((entry) => {
      entry.ideal = (total * entry.span) / weightTotal;
      entry.allocated = Math.max(entry.minimum, Math.floor(entry.ideal));
    });

    let allocatedTotal = entries.reduce((sum, entry) => sum + entry.allocated, 0);

    while (allocatedTotal > total) {
      const candidate = entries
        .filter((entry) => entry.allocated > entry.minimum)
        .sort((left, right) =>
          (right.allocated - right.ideal) - (left.allocated - left.ideal) ||
          right.allocated - left.allocated ||
          right.index - left.index,
        )[0];
      if (!candidate) break;
      candidate.allocated -= 1;
      allocatedTotal -= 1;
    }

    while (allocatedTotal < total) {
      const candidate = entries
        .filter((entry) => entry.allocated < MAX_SPAN)
        .sort((left, right) =>
          (right.ideal - right.allocated) - (left.ideal - left.allocated) ||
          left.allocated - right.allocated ||
          left.index - right.index,
        )[0];
      if (!candidate) break;
      candidate.allocated += 1;
      allocatedTotal += 1;
    }

    return new Map(entries.map((entry) => [entry.id, entry.allocated]));
  }

  // Mantiene cada fila completa. Si se oculta o se mueve una tarjeta, el
  // espacio sobrante se reparte proporcionalmente entre las tarjetas que
  // permanecen en esa fila, conservando tanto como sea posible la relación
  // de anchos elegida por el usuario.
  function balanceSizesForLayout(order, sizes, hidden, rowStarts) {
    const nextSizes = { ...sizes };
    const rows = rowModelFor(order, nextSizes, hidden, rowStarts);

    rows.forEach((row) => {
      const balanced = allocateBalancedSpans(row.items, MAX_SPAN, nextSizes);
      balanced.forEach((span, id) => {
        nextSizes[id] = span;
      });
    });

    return nextSizes;
  }

  function rebalanceState() {
    state.rowStarts = normalizeRowStarts(state.rowStarts, state.order, state.hidden);
    state.sizes = balanceSizesForLayout(
      state.order,
      state.sizes,
      state.hidden,
      state.rowStarts,
    );
  }

  function visibleIdsFor(order = state.order, hidden = state.hidden) {
    const hiddenSet = new Set(hidden);
    return order.filter((id) => !hiddenSet.has(id));
  }

  function normalizeRowStarts(rowStarts, order = state.order, hidden = state.hidden) {
    const visible = visibleIdsFor(order, hidden);
    const firstVisible = visible[0];
    return [...new Set((rowStarts || []).filter((id) => visible.includes(id) && id !== firstVisible))];
  }

  function rowStartsAfterRemovingDragged(draggedId) {
    const next = new Set(state.rowStarts || []);
    const visible = visibleIdsFor();
    const draggedIndex = visible.indexOf(draggedId);

    if (next.delete(draggedId) && draggedIndex >= 0) {
      const successor = visible[draggedIndex + 1];
      if (successor) next.add(successor);
    }

    return normalizeRowStarts([...next], state.order.filter((id) => id !== draggedId));
  }

  function pruneRowStarts() {
    state.rowStarts = normalizeRowStarts(state.rowStarts);
  }

  function pruneRowHeights() {
    pruneRowStarts();
    const validKeys = new Set(
      rowModelFor(state.order, state.sizes, state.hidden, state.rowStarts).map(rowSignatureFromModel),
    );
    const next = {};
    for (const [key, height] of Object.entries(state.rowHeights)) {
      if (validKeys.has(key)) next[key] = height;
    }
    state.rowHeights = next;
  }

  function configuredSpanFor(panelId) {
    return clampSpanForPanel(
      panelId,
      state.sizes[panelId] ?? DEFAULT_SPANS[panelId] ?? MAX_SPAN,
    );
  }

  function setPanelSpan(panelId, span) {
    if (!DEFAULT_ORDER.includes(panelId)) return;

    const rows = rowModelFor(state.order, state.sizes, state.hidden, state.rowStarts);
    const row = rows.find((candidate) => candidate.items.some((item) => item.id === panelId));
    if (!row) return;

    const otherItems = row.items.filter((item) => item.id !== panelId);
    const minimumForOthers = otherItems.reduce(
      (sum, item) => sum + minimumSpanFor(item.id),
      0,
    );
    const requested = clampSpanForPanel(panelId, span);
    const nextPanelSpan = Math.min(requested, MAX_SPAN - minimumForOthers);
    const nextSizes = { ...state.sizes, [panelId]: nextPanelSpan };

    if (otherItems.length) {
      const balancedOthers = allocateBalancedSpans(
        otherItems,
        MAX_SPAN - nextPanelSpan,
        nextSizes,
      );
      balancedOthers.forEach((value, id) => {
        nextSizes[id] = value;
      });
    }

    state.sizes = nextSizes;
    rebalanceState();
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function expandPanelIntoFreeSpace(panelId) {
    const rows = rowModelFor(state.order, state.sizes, state.hidden, state.rowStarts);
    const row = rows.find((candidate) => candidate.items.at(-1)?.id === panelId);
    if (!row) return;
    const freeSpace = MAX_SPAN - row.total;
    const item = row.items.at(-1);
    if (!item || freeSpace <= 0) return;

    state.sizes = {
      ...state.sizes,
      [panelId]: clampSpanForPanel(panelId, item.span + freeSpace),
    };
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function syncExpandButtons() {
    dashboard.querySelectorAll(".panel-expand-button").forEach((button) => button.remove());
    if (!dashboard.classList.contains("is-customizing")) return;
    if (isStackedLayout()) return;

    const rows = rowModelFor(state.order, state.sizes, state.hidden, state.rowStarts);
    for (const row of rows) {
      const freeSpace = MAX_SPAN - row.total;
      const item = row.items.at(-1);
      if (!item || freeSpace <= 0 || item.span >= MAX_SPAN) continue;

      const panel = panels.get(item.id);
      if (!panel) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "panel-expand-button";
      button.setAttribute(
        "aria-label",
        `Ampliar ${PANEL_META[item.id]?.label || "panel"} para ocupar el espacio libre`,
      );
      button.title = "Ocupar el ancho libre de esta fila";
      button.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3"/><path d="M9 9 5 5M15 9l4-4M9 15l-4 4M15 15l4 4"/></svg>';
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        expandPanelIntoFreeSpace(item.id);
      });
      panel.appendChild(button);
    }
  }

  function captureLayoutRects() {
    const rects = new Map();
    visiblePanelElements().forEach((el) => {
      if (!el.isConnected) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) rects.set(el, rect);
    });
    return rects;
  }

  function animateLayoutFrom(previousRects) {
    window.requestAnimationFrame(() => {
      previousRects.forEach((previousRect, el) => {
        if (!el.isConnected) return;
        const rect = el.getBoundingClientRect();
        const dx = previousRect.left - rect.left;
        const dy = previousRect.top - rect.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          {
            duration: 170,
            easing: "cubic-bezier(.2, .8, .2, 1)",
          },
        );
      });
    });
  }

  function shrinkRowToFit(row, nextSizes, requiredSpace) {
    let remaining = Math.max(0, requiredSpace);
    const candidates = row.items
      .map((item) => ({
        id: item.id,
        span: clampSpanForPanel(item.id, nextSizes[item.id] ?? item.span),
        minimum: minimumSpanFor(item.id),
      }))
      .sort((left, right) => (right.span - right.minimum) - (left.span - left.minimum));

    while (remaining > 0) {
      const candidate = candidates.find((item) => item.span > item.minimum);
      if (!candidate) break;
      candidate.span -= 1;
      nextSizes[candidate.id] = candidate.span;
      remaining -= 1;
      candidates.sort((left, right) => (right.span - right.minimum) - (left.span - left.minimum));
    }

    return remaining === 0;
  }

  function forcePairIntoOwnRow(
    draggedId,
    targetId,
    placement,
    nextOrder,
    nextSizes,
    nextRowStarts,
  ) {
    const firstId = placement === "before" ? draggedId : targetId;
    const secondId = placement === "before" ? targetId : draggedId;
    const firstMinimum = minimumSpanFor(firstId);
    const secondMinimum = minimumSpanFor(secondId);
    const firstPreferred = configuredSpanFor(firstId);
    const secondPreferred = configuredSpanFor(secondId);

    let firstSpan = Math.min(firstPreferred, MAX_SPAN - secondMinimum);
    let secondSpan = Math.min(secondPreferred, MAX_SPAN - firstSpan);
    if (secondSpan < secondMinimum) {
      secondSpan = secondMinimum;
      firstSpan = Math.max(firstMinimum, MAX_SPAN - secondSpan);
    }

    nextSizes[firstId] = clampSpanForPanel(firstId, firstSpan);
    nextSizes[secondId] = clampSpanForPanel(secondId, secondSpan);

    const starts = new Set(nextRowStarts);
    starts.delete(secondId);
    starts.add(firstId);

    const visible = visibleIdsFor(nextOrder);
    const secondIndex = visible.indexOf(secondId);
    const afterPair = visible[secondIndex + 1];
    if (afterPair) starts.add(afterPair);

    return normalizeRowStarts([...starts], nextOrder);
  }

  function layoutForDashboardInsertion(draggedId, targetId, placement, intent) {
    const nextOrder = orderWithInsertion(draggedId, targetId, placement);
    const nextSizes = { ...state.sizes };
    let nextRowStarts = rowStartsAfterRemovingDragged(draggedId);

    if (isStackedLayout()) {
      return {
        order: nextOrder,
        sizes: nextSizes,
        rowStarts: normalizeRowStarts(nextRowStarts, nextOrder),
        joined: intent === "side",
        rowInsert: intent === "row",
      };
    }

    if (intent === "row") {
      const starts = new Set(nextRowStarts);
      starts.add(draggedId);
      starts.add(targetId);
      nextRowStarts = normalizeRowStarts([...starts], nextOrder);
      return {
        order: nextOrder,
        sizes: nextSizes,
        rowStarts: nextRowStarts,
        joined: false,
        rowInsert: true,
      };
    }

    const orderWithoutDragged = nextOrder.filter((id) => id !== draggedId);
    const rows = rowModelFor(
      orderWithoutDragged,
      nextSizes,
      state.hidden,
      nextRowStarts,
    );
    const targetRow = rows.find((row) => row.items.some((item) => item.id === targetId));
    if (!targetRow) {
      return {
        order: nextOrder,
        sizes: nextSizes,
        rowStarts: normalizeRowStarts(nextRowStarts, nextOrder),
        joined: false,
        rowInsert: false,
      };
    }

    const starts = new Set(nextRowStarts);
    const visibleWithoutDragged = visibleIdsFor(orderWithoutDragged);
    const targetWasFirst =
      visibleWithoutDragged[0] === targetId ||
      starts.has(targetId) ||
      targetRow.items[0]?.id === targetId;
    if (placement === "before" && targetWasFirst) {
      starts.delete(targetId);
      starts.add(draggedId);
    } else {
      starts.delete(draggedId);
    }
    nextRowStarts = normalizeRowStarts([...starts], nextOrder);

    const currentSpan = configuredSpanFor(draggedId);
    const minimumSpan = minimumSpanFor(draggedId);
    let freeSpace = MAX_SPAN - targetRow.total;

    if (freeSpace < minimumSpan) {
      const fitted = shrinkRowToFit(targetRow, nextSizes, minimumSpan - freeSpace);
      if (fitted) {
        const adjustedRows = rowModelFor(
          orderWithoutDragged,
          nextSizes,
          state.hidden,
          nextRowStarts,
        );
        const adjustedTargetRow = adjustedRows.find((row) =>
          row.items.some((item) => item.id === targetId),
        );
        freeSpace = adjustedTargetRow ? MAX_SPAN - adjustedTargetRow.total : minimumSpan;
      } else {
        nextRowStarts = forcePairIntoOwnRow(
          draggedId,
          targetId,
          placement,
          nextOrder,
          nextSizes,
          nextRowStarts,
        );
        return {
          order: nextOrder,
          sizes: nextSizes,
          rowStarts: nextRowStarts,
          joined: true,
          rowInsert: false,
        };
      }
    }

    nextSizes[draggedId] = clampSpanForPanel(
      draggedId,
      Math.min(currentSpan, Math.max(minimumSpan, freeSpace)),
    );

    return {
      order: nextOrder,
      sizes: nextSizes,
      rowStarts: normalizeRowStarts(nextRowStarts, nextOrder),
      joined: true,
      rowInsert: false,
    };
  }

  function renderDashboardDropPreview(draggedId, targetId, placement, intent = "side") {
    if (!targetId || draggedId === targetId) return;

    const nextLayout = layoutForDashboardInsertion(
      draggedId,
      targetId,
      placement,
      intent,
    );
    const previewSizes = balanceSizesForLayout(
      nextLayout.order,
      nextLayout.sizes,
      state.hidden,
      nextLayout.rowStarts,
    );
    const previewSpan = previewSizes[draggedId] ?? configuredSpanFor(draggedId);
    const nextKey = `${draggedId}:${targetId}:${placement}:${intent}:${previewSpan}:${nextLayout.rowStarts.join(",")}`;

    dashboardDropState = {
      order: nextLayout.order,
      sizes: previewSizes,
      rowStarts: nextLayout.rowStarts,
      targetId,
      placement,
      intent,
      joined: nextLayout.joined,
    };

    if (nextKey === dashboardPreviewKey) return;
    dashboardPreviewKey = nextKey;

    const dashboardRect = dashboard.getBoundingClientRect();
    const target = panels.get(targetId);
    const targetRect = target?.getBoundingClientRect();
    if (!targetRect) return;

    dropPreview.classList.add("is-visible");
    dropPreview.classList.toggle("is-expanded", intent === "side");
    dropPreview.classList.toggle("is-row-insert", intent === "row");
    dropPreview.classList.toggle("is-side-insert", intent !== "row");

    if (intent === "row") {
      const contentLeft = 16;
      const contentWidth = Math.max(0, dashboardRect.width - 32);
      const guideTop = targetRect.top - dashboardRect.top - 7;
      dropPreview.style.left = `${contentLeft}px`;
      dropPreview.style.top = `${guideTop}px`;
      dropPreview.style.width = `${contentWidth}px`;
      dropPreview.style.height = "42px";
      dropPreview.textContent = `Nueva fila · ${PANEL_META[draggedId]?.label || "panel"}`;
    } else {
      const halfWidth = Math.max(96, targetRect.width / 2);
      const left = placement === "before"
        ? targetRect.left - dashboardRect.left
        : targetRect.right - dashboardRect.left - halfWidth;
      dropPreview.style.left = `${left}px`;
      dropPreview.style.top = `${targetRect.top - dashboardRect.top}px`;
      dropPreview.style.width = `${halfWidth}px`;
      dropPreview.style.height = `${targetRect.height}px`;
      dropPreview.textContent =
        `Misma fila · ${PANEL_META[draggedId]?.label || "panel"} · ${previewSpan}/${MAX_SPAN}`;
    }
  }

  function clearDashboardDropPreview() {
    dashboardDropState = null;
    dashboardPreviewKey = "";
    dropPreview.classList.remove(
      "is-visible",
      "is-expanded",
      "is-row-insert",
      "is-side-insert",
      "is-row-start",
    );
    dropPreview.textContent = "";
    dropPreview.removeAttribute("style");
  }

  function placementForTarget(targetEl, x, y, mode) {
    const rect = targetEl.getBoundingClientRect();
    if (mode === "list") return y < rect.top + rect.height / 2 ? "before" : "after";
    return x < rect.left + rect.width / 2 ? "before" : "after";
  }

  function distanceToRect(rect, x, y) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return Math.hypot(dx, dy);
  }

  function dashboardRowsFromCandidates(candidates) {
    const rows = [];
    for (const candidate of [...candidates].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)) {
      let row = rows.find((entry) => Math.abs(entry.top - candidate.rect.top) < 8);
      if (!row) {
        row = { top: candidate.rect.top, items: [] };
        rows.push(row);
      }
      row.items.push(candidate);
    }
    return rows
      .sort((a, b) => a.top - b.top)
      .map((row) => ({
        items: row.items.sort((a, b) => a.rect.left - b.rect.left),
        top: Math.min(...row.items.map((item) => item.rect.top)),
        bottom: Math.max(...row.items.map((item) => item.rect.bottom)),
      }));
  }

  function findHorizontalRowTarget(candidates, x, y) {
    const rows = dashboardRowsFromCandidates(candidates);
    const boardRect = dashboard.getBoundingClientRect();
    if (x < boardRect.left || x > boardRect.right) return null;

    for (let index = 0; index < rows.length - 1; index += 1) {
      const upperRow = rows[index];
      const lowerRow = rows[index + 1];
      const center = (upperRow.bottom + lowerRow.top) / 2;
      const gap = Math.max(0, lowerRow.top - upperRow.bottom);
      const hitRadius = Math.max(12, Math.min(26, gap / 2 + 8));
      if (Math.abs(y - center) > hitRadius) continue;

      return {
        el: lowerRow.items[0].el,
        placement: "before",
        intent: "row",
      };
    }

    return null;
  }

  function findDropTarget(itemEl, items, x, y, mode) {
    const candidates = items
      .filter((el) => el !== itemEl && !el.classList.contains("is-hidden-panel"))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);

    if (!candidates.length) return null;

    if (mode === "dashboard") {
      const boardRect = dashboard.getBoundingClientRect();
      const insideDashboard =
        x >= boardRect.left && x <= boardRect.right && y >= boardRect.top && y <= boardRect.bottom;
      if (!insideDashboard) return null;

      const rowTarget = findHorizontalRowTarget(candidates, x, y);
      if (rowTarget) return rowTarget;
    }

    let best = candidates[0];
    let bestDistance = distanceToRect(best.rect, x, y);
    for (const candidate of candidates.slice(1)) {
      const distance = distanceToRect(candidate.rect, x, y);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return {
      el: best.el,
      placement: placementForTarget(best.el, x, y, mode),
      intent: "side",
    };
  }

  function updateDropTargetClasses(previousTarget, nextTarget) {
    const classes = [
      "is-drop-target",
      "is-drop-before",
      "is-drop-after",
      "is-drop-row-before",
    ];
    if (previousTarget?.el && previousTarget.el !== nextTarget?.el) {
      previousTarget.el.classList.remove(...classes);
    }
    if (!nextTarget?.el) return;
    nextTarget.el.classList.add("is-drop-target");
    nextTarget.el.classList.toggle(
      "is-drop-before",
      nextTarget.intent !== "row" && nextTarget.placement === "before",
    );
    nextTarget.el.classList.toggle(
      "is-drop-after",
      nextTarget.intent !== "row" && nextTarget.placement === "after",
    );
    nextTarget.el.classList.toggle("is-drop-row-before", nextTarget.intent === "row");
  }

  function clearDropTarget(target) {
    target?.el?.classList.remove(
      "is-drop-target",
      "is-drop-before",
      "is-drop-after",
      "is-drop-row-before",
    );
  }

  function makeDragGhost(label, x, y) {
    const ghost = document.createElement("div");
    ghost.className = "layout-drag-ghost";
    ghost.textContent = label;
    document.body.appendChild(ghost);
    moveDragGhost(ghost, x, y);
    return ghost;
  }

  function moveDragGhost(ghost, x, y) {
    ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  }

  function toggleHidden(id) {
    const hiddenSet = new Set(state.hidden);
    const visibleBefore = visibleIdsFor();
    const hiddenIndex = visibleBefore.indexOf(id);
    const wasRowStart = state.rowStarts.includes(id);

    if (hiddenSet.has(id)) {
      hiddenSet.delete(id);
    } else {
      const visibleCount = state.order.length - hiddenSet.size;
      if (visibleCount <= 1) return; // siempre queda al menos 1 panel visible
      hiddenSet.add(id);
      if (wasRowStart) {
        const successor = visibleBefore[hiddenIndex + 1];
        if (successor) state.rowStarts = [...state.rowStarts, successor];
      }
    }

    state.hidden = Array.from(hiddenSet);
    rebalanceState();
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function applyPreset(presetName) {
    const preset = LAYOUT_PRESETS[presetName];
    if (!preset) return;
    state.version = STATE_VERSION;
    state.order = (preset.order || DEFAULT_ORDER).slice();
    state.hidden = (preset.hidden || DEFAULT_HIDDEN).slice();
    state.sizes = cloneSizes(preset.sizes || {});
    state.rowStarts = (preset.rowStarts || DEFAULT_ROW_STARTS).slice();
    rebalanceState();
    state.rowHeights = presetRowHeights(preset);
    saveState();
    applyLayout();
  }

  function renderPresetControls() {
    if (!presetWrap) return;
    presetWrap.innerHTML = "";
    const activePreset = currentPresetName();

    Object.entries(LAYOUT_PRESETS).forEach(([name, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "customize-preset";
      if (name === activePreset) button.classList.add("is-active");
      button.textContent = preset.label;
      button.title = preset.description;
      button.setAttribute("aria-pressed", String(name === activePreset));
      button.addEventListener("click", () => applyPreset(name));
      presetWrap.appendChild(button);
    });
  }

  function toggleWorldClockMarket(marketId) {
    const hiddenSet = new Set(state.worldClockHidden);
    if (hiddenSet.has(marketId)) {
      hiddenSet.delete(marketId);
    } else {
      hiddenSet.add(marketId);
    }
    state.worldClockHidden = Array.from(hiddenSet);
    saveState();
    applyWorldClockVisibility();
    renderList();
  }

  function svgHandle() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>' +
      "</svg>"
    );
  }

  function renderList() {
    list.innerHTML = "";
    const hiddenSet = new Set(state.hidden);
    const visibleCount = state.order.length - hiddenSet.size;

    state.order.forEach((id, index) => {
      const meta = PANEL_META[id];
      if (!meta) return;
      const isHidden = hiddenSet.has(id);

      const li = document.createElement("li");
      li.className = "customize-row";
      li.dataset.panelId = id;

      const handle = document.createElement("span");
      handle.className = "customize-row-handle";
      handle.setAttribute("role", "presentation");
      handle.innerHTML = svgHandle();

      const name = document.createElement("span");
      name.className = "customize-row-name";
      name.textContent = meta.label;

      const moveWrap = document.createElement("span");
      moveWrap.className = "customize-row-move";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "customize-icon-btn";
      upBtn.setAttribute("aria-label", "Subir " + meta.label);
      upBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", () => moveInOrder(id, -1));

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "customize-icon-btn";
      downBtn.setAttribute("aria-label", "Bajar " + meta.label);
      downBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      downBtn.disabled = index === state.order.length - 1;
      downBtn.addEventListener("click", () => moveInOrder(id, 1));

      moveWrap.append(upBtn, downBtn);

      const visBtn = document.createElement("button");
      visBtn.type = "button";
      visBtn.className = "customize-icon-btn customize-visibility-btn";
      if (isHidden) visBtn.classList.add("is-hidden");
      visBtn.setAttribute(
        "aria-label",
        (isHidden ? "Mostrar " : "Ocultar ") + meta.label,
      );
      visBtn.disabled = !isHidden && visibleCount <= 1;
      visBtn.innerHTML = isHidden
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.4 9.4 0 0 1 12 5c5 0 8.5 4 9.9 7-.5 1-1.2 2.1-2.2 3.1M6.3 6.3C4.4 7.6 3 9.4 2.1 12c1 2.4 2.8 4.4 5.1 5.7"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.1 12S5.6 5 12 5s9.9 7 9.9 7-3.5 7-9.9 7-9.9-7-9.9-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      visBtn.addEventListener("click", () => toggleHidden(id));

      const sizeWrap = document.createElement("span");
      sizeWrap.className = "customize-size-control";
      sizeWrap.setAttribute("aria-label", `Ancho de ${meta.label}`);

      const sizeMinus = document.createElement("button");
      sizeMinus.type = "button";
      sizeMinus.className = "customize-icon-btn customize-size-btn";
      sizeMinus.setAttribute("aria-label", `Reducir ancho de ${meta.label}`);
      sizeMinus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';

      const sizeValue = document.createElement("output");
      sizeValue.className = "customize-size-value";
      sizeValue.value = `${configuredSpanFor(id)}/${MAX_SPAN}`;
      sizeValue.textContent = sizeValue.value;
      sizeValue.title = "Columnas ocupadas en escritorio";

      const sizePlus = document.createElement("button");
      sizePlus.type = "button";
      sizePlus.className = "customize-icon-btn customize-size-btn";
      sizePlus.setAttribute("aria-label", `Aumentar ancho de ${meta.label}`);
      sizePlus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';

      const currentSize = configuredSpanFor(id);
      sizeMinus.disabled = isHidden || currentSize <= minimumSpanFor(id);
      sizePlus.disabled = isHidden || currentSize >= MAX_SPAN;
      sizeMinus.addEventListener("click", () => setPanelSpan(id, currentSize - 1));
      sizePlus.addEventListener("click", () => setPanelSpan(id, currentSize + 1));
      sizeWrap.append(sizeMinus, sizeValue, sizePlus);

      const controlsWrap = document.createElement("span");
      controlsWrap.className = "customize-row-controls";
      controlsWrap.append(sizeWrap, moveWrap, visBtn);

      li.append(handle, name, controlsWrap);
      list.appendChild(li);

      setupDragging(
        handle,
        () => Array.from(list.querySelectorAll("li[data-panel-id]")),
        { mode: "list" },
      );

      if (id === "worldclock") {
        list.appendChild(renderWorldClockSublist());
      }
    });
  }

  // Sub-listado con un toggle de mostrar/ocultar por cada bolsa dentro del
  // panel "Horas globales". Descubre los mercados leyendo las tarjetas ya
  // renderizadas por app.js (data-market-id + el nombre en .wc-name) en
  // vez de duplicar la lista de mercados acá.
  function renderWorldClockSublist() {
    const wrapper = document.createElement("li");
    wrapper.className = "customize-submarkets";

    const cards = Array.from(
      document.querySelectorAll(".world-clock-card[data-market-id]"),
    );
    const hiddenSet = new Set(state.worldClockHidden);

    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "customize-hint";
      empty.textContent = "El panel de Horas globales todavía no cargó.";
      wrapper.appendChild(empty);
      return wrapper;
    }

    const title = document.createElement("p");
    title.className = "customize-submarkets-title";
    title.textContent = "Bolsas visibles en Horas globales";
    wrapper.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "customize-submarkets-grid";

    for (const card of cards) {
      const marketId = card.dataset.marketId;
      const label = card.querySelector(".wc-name")?.textContent || marketId;
      const isHidden = hiddenSet.has(marketId);

      const row = document.createElement("label");
      row.className = "customize-switch customize-submarket-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !isHidden;
      input.addEventListener("change", () => toggleWorldClockMarket(marketId));

      const track = document.createElement("span");
      track.className = "customize-switch-track";
      track.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.textContent = label;

      row.append(input, track, text);
      grid.appendChild(row);
    }

    wrapper.appendChild(grid);
    return wrapper;
  }

  // Drag-and-drop genérico basado en Pointer Events (funciona con mouse,
  // trackpad y touch por igual, a diferencia del HTML5 Drag and Drop API
  // que no dispara en touch). En el dashboard muestra un destino real en
  // la grilla antes de soltar; en la lista usa una guía antes/después.
  function setupDragging(handle, resolveItems, options = {}) {
    const mode = options.mode || "list";

    handle.addEventListener("pointerdown", (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (mode === "dashboard" && !dashboard.classList.contains("is-customizing")) return;

      const itemEl = handle.closest("[data-panel-id]");
      if (!itemEl) return;

      if (mode === "dashboard") {
        const explicitHandle = ev.target.closest("[data-drag-handle]");
        const interactive = ev.target.closest(
          "button, a, input, select, textarea, summary, [contenteditable='true'], " +
            ".layout-splitter, .panel-expand-button",
        );
        if (interactive && !explicitHandle) return;
      }

      const draggedId = itemEl.dataset.panelId;
      const label = PANEL_META[draggedId]?.label || draggedId;
      const pointerId = ev.pointerId;
      const startX = ev.clientX;
      const startY = ev.clientY;
      let currentTarget = null;
      let ghost = null;
      let dragging = false;
      let finished = false;
      let moveFrame = 0;
      let pendingPoint = null;

      ev.preventDefault();
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // Los listeners globales mantienen activo el gesto.
      }

      function beginDrag(x, y) {
        dragging = true;
        itemEl.classList.add("is-dragging");
        if (mode === "dashboard") dashboard.classList.add("is-layout-dragging");
        ghost = makeDragGhost(label, x, y);
      }

      function processMove(x, y) {
        moveFrame = 0;
        if (finished) return;

        moveDragGhost(ghost, x, y);
        const items = resolveItems();
        const nextTarget = findDropTarget(itemEl, items, x, y, mode);
        updateDropTargetClasses(currentTarget, nextTarget);
        currentTarget = nextTarget;

        if (mode === "dashboard" && currentTarget) {
          renderDashboardDropPreview(
            draggedId,
            currentTarget.el.dataset.panelId,
            currentTarget.placement,
            currentTarget.intent || "side",
          );
        } else if (mode === "dashboard") {
          clearDashboardDropPreview();
        }
      }

      function onMove(moveEv) {
        if (moveEv.pointerId !== pointerId || finished) return;
        const x = moveEv.clientX;
        const y = moveEv.clientY;

        if (!dragging) {
          const distance = Math.hypot(x - startX, y - startY);
          if (distance < DRAG_THRESHOLD) return;
          beginDrag(x, y);
        }

        moveEv.preventDefault();
        pendingPoint = { x, y };
        if (moveFrame) return;
        moveFrame = window.requestAnimationFrame(() => {
          if (!pendingPoint) {
            moveFrame = 0;
            return;
          }
          const point = pendingPoint;
          pendingPoint = null;
          processMove(point.x, point.y);
        });
      }

      function finish(cancelled = false) {
        if (finished) return;
        finished = true;
        if (moveFrame) window.cancelAnimationFrame(moveFrame);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        document.removeEventListener("keydown", onKeyDown);

        try {
          if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        } catch {
          // No hay captura activa.
        }

        if (!dragging) return;

        itemEl.classList.remove("is-dragging");
        dashboard.classList.remove("is-layout-dragging");
        ghost?.remove();
        clearDropTarget(currentTarget);

        if (cancelled) {
          if (mode === "dashboard") clearDashboardDropPreview();
          return;
        }

        if (currentTarget) {
          if (mode === "dashboard" && dashboardDropState) {
            const previousRects = captureLayoutRects();
            state.order = dashboardDropState.order;
            state.sizes = dashboardDropState.sizes;
            state.rowStarts = dashboardDropState.rowStarts;
            clearDashboardDropPreview();
            rebalanceState();
            pruneRowHeights();
            saveState();
            applyLayout();
            animateLayoutFrom(previousRects);
          } else {
            setPanelOrder(
              orderWithInsertion(
                draggedId,
                currentTarget.el.dataset.panelId,
                currentTarget.placement,
              ),
            );
          }
        } else if (mode === "dashboard") {
          clearDashboardDropPreview();
        }
      }

      function onUp(upEv) {
        if (upEv.pointerId !== pointerId) return;
        if (pendingPoint && dragging) {
          processMove(pendingPoint.x, pendingPoint.y);
          pendingPoint = null;
        }
        finish(false);
      }

      function onCancel(cancelEv) {
        if (cancelEv.pointerId !== pointerId) return;
        finish(true);
      }

      function onKeyDown(keyEv) {
        if (keyEv.key !== "Escape") return;
        keyEv.preventDefault();
        finish(true);
      }

      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      document.addEventListener("keydown", onKeyDown);
    });
  }

  // En el tablero toda la superficie no interactiva de una tarjeta funciona
  // como zona de agarre. Los botones, enlaces y campos conservan su acción.
  panels.forEach((panel) => {
    setupDragging(
      panel,
      () =>
        Array.from(dashboard.querySelectorAll(".panel[data-panel-id]")).filter(
          (el) => !el.classList.contains("is-hidden-panel"),
        ),
      { mode: "dashboard" },
    );
  });

  // Ancho, en píxeles, de una unidad del grid de 10 columnas. Los divisores
  // se mueven por pasos enteros para que el gesto se parezca más a ajustar
  // ventanas divididas que a estirar tarjetas libremente.
  function getColumnStep() {
    const rect = dashboard.getBoundingClientRect();
    const cs = getComputedStyle(dashboard);
    const paddingX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 0;
    const contentWidth = rect.width - paddingX;
    const columnWidth = (contentWidth - gap * (MAX_SPAN - 1)) / MAX_SPAN;
    return { columnWidth, gap, step: columnWidth + gap };
  }

  function currentSpanOf(panelEl) {
    const fromStyle = parseInt(panelEl.style.getPropertyValue("--panel-span"), 10);
    return Number.isInteger(fromStyle) ? fromStyle : 6;
  }

  function commitPanelSpans(leftPanel, leftSpan, rightPanel, rightSpan) {
    const next = { ...state.sizes };
    next[leftPanel.dataset.panelId] = clampSpanForPanel(
      leftPanel.dataset.panelId,
      leftSpan,
    );
    next[rightPanel.dataset.panelId] = clampSpanForPanel(
      rightPanel.dataset.panelId,
      rightSpan,
    );
    state.sizes = next;
    rebalanceState();
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function measurePanelMinimumHeight(panel) {
    const previousHeight = panel.style.getPropertyValue("--custom-row-height");
    const hadCustomClass = panel.classList.contains("has-custom-row-height");
    panel.style.removeProperty("--custom-row-height");
    panel.classList.remove("has-custom-row-height");
    panel.classList.add("is-measuring-height");

    const measured = Math.ceil(panel.scrollHeight + 2);

    panel.classList.remove("is-measuring-height");
    if (previousHeight) panel.style.setProperty("--custom-row-height", previousHeight);
    if (hadCustomClass) panel.classList.add("has-custom-row-height");
    return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, measured));
  }

  function minimumHeightForRow(row) {
    if (!row?.length) return MIN_ROW_HEIGHT;
    return Math.max(...row.map(({ panel }) => measurePanelMinimumHeight(panel)));
  }

  function setRowHeight(rowIndex, height) {
    const row = getRows()[rowIndex];
    if (!row) return;
    const next = { ...state.rowHeights };
    const minimumHeight = minimumHeightForRow(row);
    next[rowSignatureFromDom(row)] = Math.min(
      MAX_ROW_HEIGHT,
      Math.max(minimumHeight, Math.round(height)),
    );
    state.rowHeights = next;
    saveState();
    applyRowHeights();
    scheduleSplitterRefresh();
  }

  function makeSplitterBadge(text) {
    const badge = document.createElement("span");
    badge.className = "layout-splitter-badge";
    badge.textContent = text;
    return badge;
  }

  function addVerticalSplitter(leftItem, rightItem) {
    const splitter = document.createElement("button");
    splitter.type = "button";
    splitter.className = "layout-splitter layout-splitter-vertical";
    splitter.dataset.leftPanelId = leftItem.panel.dataset.panelId;
    splitter.dataset.rightPanelId = rightItem.panel.dataset.panelId;
    splitter.setAttribute(
      "aria-label",
      `Ajustar columnas entre ${PANEL_META[leftItem.panel.dataset.panelId]?.label || "panel"} y ` +
        `${PANEL_META[rightItem.panel.dataset.panelId]?.label || "panel"}`,
    );
    splitter.title = "Arrastrá horizontalmente. Paso: 1 columna.";
    splitter.dataset.tooltip = "Columnas: paso 1";

    const dashboardRect = dashboard.getBoundingClientRect();
    const left = (leftItem.rect.right + rightItem.rect.left) / 2 - dashboardRect.left;
    const top = Math.min(leftItem.rect.top, rightItem.rect.top) - dashboardRect.top;
    const height =
      Math.max(leftItem.rect.bottom, rightItem.rect.bottom) -
      Math.min(leftItem.rect.top, rightItem.rect.top);

    splitter.style.left = `${left}px`;
    splitter.style.top = `${top}px`;
    splitter.style.height = `${height}px`;

    setupVerticalSplitter(splitter, leftItem.panel, rightItem.panel);
    splitterLayer.appendChild(splitter);
  }

  function addHorizontalSplitter(rowIndex, upperRow, lowerRow = null) {
    const splitter = document.createElement("button");
    splitter.type = "button";
    splitter.className = "layout-splitter layout-splitter-horizontal";
    splitter.dataset.rowIndex = String(rowIndex);
    splitter.setAttribute("aria-label", `Ajustar altura de fila ${rowIndex + 1}`);
    splitter.title = "Arrastrá verticalmente. Doble clic para altura automática.";
    splitter.dataset.tooltip = "Altura · doble clic: automático";

    const dashboardRect = dashboard.getBoundingClientRect();
    const upperBottom = Math.max(...upperRow.map(({ rect }) => rect.bottom));
    const y = lowerRow
      ? (upperBottom + Math.min(...lowerRow.map(({ rect }) => rect.top))) / 2 - dashboardRect.top
      : upperBottom - dashboardRect.top;

    splitter.style.left = "16px";
    splitter.style.right = "16px";
    splitter.style.top = `${y}px`;

    setupHorizontalSplitter(splitter, rowIndex, upperRow);
    splitterLayer.appendChild(splitter);
  }

  function refreshSplitters() {
    splitterLayer.innerHTML = "";
    if (!dashboard.classList.contains("is-customizing")) return;
    if (isStackedLayout()) return;

    const rows = getRows();
    rows.forEach((row, rowIndex) => {
      for (let index = 0; index < row.length - 1; index += 1) {
        addVerticalSplitter(row[index], row[index + 1]);
      }
      addHorizontalSplitter(rowIndex, row, rows[rowIndex + 1] || null);
    });
  }

  let splitterFrame = 0;
  function scheduleSplitterRefresh() {
    if (splitterFrame) window.cancelAnimationFrame(splitterFrame);
    splitterFrame = window.requestAnimationFrame(() => {
      splitterFrame = 0;
      refreshSplitters();
    });
  }

  function setupVerticalSplitter(splitter, leftPanel, rightPanel) {
    function preview(leftSpan, rightSpan) {
      leftPanel.style.setProperty("--panel-span", String(leftSpan));
      rightPanel.style.setProperty("--panel-span", String(rightSpan));
    }

    function commitDelta(delta) {
      const leftStart = currentSpanOf(leftPanel);
      const rightStart = currentSpanOf(rightPanel);
      const maxDelta = rightStart - minimumSpanFor(rightPanel.dataset.panelId);
      const minDelta = minimumSpanFor(leftPanel.dataset.panelId) - leftStart;
      const clampedDelta = Math.min(maxDelta, Math.max(minDelta, delta));
      if (!clampedDelta) return;
      commitPanelSpans(
        leftPanel,
        leftStart + clampedDelta,
        rightPanel,
        rightStart - clampedDelta,
      );
    }

    splitter.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      commitDelta(ev.key === "ArrowRight" ? 1 : -1);
    });

    splitter.addEventListener("pointerdown", (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();

      const pointerId = ev.pointerId;
      const startX = ev.clientX;
      const leftStart = currentSpanOf(leftPanel);
      const rightStart = currentSpanOf(rightPanel);
      const { step } = getColumnStep();
      const splitterStartLeft = parseFloat(splitter.style.left) || 0;
      const badge = makeSplitterBadge(`${leftStart}/${MAX_SPAN}`);
      splitter.appendChild(badge);
      splitter.classList.add("is-active");
      leftPanel.classList.add("is-resizing");
      rightPanel.classList.add("is-resizing-partner");

      try {
        splitter.setPointerCapture(pointerId);
      } catch {
        // Los listeners del documento mantienen el gesto activo.
      }

      let finalLeft = leftStart;
      let finalRight = rightStart;
      let finished = false;

      function onMove(moveEv) {
        if (moveEv.pointerId !== pointerId || finished) return;
        const rawDelta = step > 0 ? Math.round((moveEv.clientX - startX) / step) : 0;
        const maxDelta = rightStart - minimumSpanFor(rightPanel.dataset.panelId);
        const minDelta = minimumSpanFor(leftPanel.dataset.panelId) - leftStart;
        const clampedDelta = Math.min(maxDelta, Math.max(minDelta, rawDelta));
        finalLeft = leftStart + clampedDelta;
        finalRight = rightStart - clampedDelta;
        preview(finalLeft, finalRight);
        splitter.style.left = `${splitterStartLeft + clampedDelta * step}px`;
        badge.textContent = `${finalLeft}/${MAX_SPAN}`;
      }

      function finish(commit) {
        if (finished) return;
        finished = true;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        splitter.classList.remove("is-active");
        leftPanel.classList.remove("is-resizing");
        rightPanel.classList.remove("is-resizing-partner");
        badge.remove();
        try {
          if (splitter.hasPointerCapture(pointerId)) splitter.releasePointerCapture(pointerId);
        } catch {
          // No hay captura activa.
        }

        if (commit && (finalLeft !== leftStart || finalRight !== rightStart)) {
          commitPanelSpans(leftPanel, finalLeft, rightPanel, finalRight);
        } else {
          applyLayout();
        }
      }

      function onUp(upEv) {
        if (upEv.pointerId === pointerId) finish(true);
      }

      function onCancel(cancelEv) {
        if (cancelEv.pointerId === pointerId) finish(false);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
    });
  }

  function setupHorizontalSplitter(splitter, rowIndex, upperRow) {
    function currentHeight() {
      return state.rowHeights[rowSignatureFromDom(upperRow)] ||
        Math.max(...upperRow.map(({ rect }) => Math.round(rect.height)));
    }

    function preview(height) {
      upperRow.forEach(({ panel }) => {
        panel.style.setProperty("--custom-row-height", `${height}px`);
        panel.classList.add("has-custom-row-height");
      });
    }

    splitter.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const next = { ...state.rowHeights };
      delete next[rowSignatureFromDom(upperRow)];
      state.rowHeights = next;
      saveState();
      applyLayout();
    });

    splitter.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
      ev.preventDefault();
      const delta = ev.key === "ArrowDown" ? ROW_HEIGHT_STEP : -ROW_HEIGHT_STEP;
      setRowHeight(rowIndex, currentHeight() + delta);
    });

    splitter.addEventListener("pointerdown", (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();

      const pointerId = ev.pointerId;
      const startY = ev.clientY;
      const startHeight = currentHeight();
      const minimumHeight = minimumHeightForRow(upperRow);
      const splitterStartTop = parseFloat(splitter.style.top) || 0;
      const badge = makeSplitterBadge(`${Math.round(startHeight)}px`);
      splitter.appendChild(badge);
      splitter.classList.add("is-active");
      upperRow.forEach(({ panel }) => panel.classList.add("is-row-resizing"));

      try {
        splitter.setPointerCapture(pointerId);
      } catch {
        // Los listeners del documento mantienen el gesto activo.
      }

      let finalHeight = startHeight;
      let finished = false;

      function onMove(moveEv) {
        if (moveEv.pointerId !== pointerId || finished) return;
        const steppedDelta =
          Math.round((moveEv.clientY - startY) / ROW_HEIGHT_STEP) * ROW_HEIGHT_STEP;
        finalHeight = Math.min(
          MAX_ROW_HEIGHT,
          Math.max(minimumHeight, Math.round(startHeight + steppedDelta)),
        );
        preview(finalHeight);
        const appliedDelta = finalHeight - startHeight;
        splitter.style.top = `${splitterStartTop + appliedDelta}px`;
        badge.textContent = finalHeight <= minimumHeight
          ? `${finalHeight}px · mínimo`
          : `${finalHeight}px`;
      }

      function finish(commit) {
        if (finished) return;
        finished = true;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        splitter.classList.remove("is-active");
        upperRow.forEach(({ panel }) => panel.classList.remove("is-row-resizing"));
        badge.remove();
        try {
          if (splitter.hasPointerCapture(pointerId)) splitter.releasePointerCapture(pointerId);
        } catch {
          // No hay captura activa.
        }

        if (commit && finalHeight !== startHeight) {
          setRowHeight(rowIndex, finalHeight);
        } else {
          applyLayout();
        }
      }

      function onUp(upEv) {
        if (upEv.pointerId === pointerId) finish(true);
      }

      function onCancel(cancelEv) {
        if (cancelEv.pointerId === pointerId) finish(false);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
    });
  }

  function setDrawerOpen(open) {
    drawer.classList.toggle("is-open", open);
    dashboard.classList.toggle("is-customizing", open);
    toggleBtn.classList.toggle("is-active", open);
    toggleBtn.setAttribute("aria-expanded", String(open));
    syncExpandButtons();
    scheduleSplitterRefresh();
  }

  toggleBtn.addEventListener("click", () => {
    setDrawerOpen(!drawer.classList.contains("is-open"));
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state = {
        version: STATE_VERSION,
        order: DEFAULT_ORDER.slice(),
        hidden: DEFAULT_HIDDEN.slice(),
        sizes: {},
        worldClockHidden: [],
        rowStarts: DEFAULT_ROW_STARTS.slice(),
        rowHeights: {},
      };
      rebalanceState();
      saveState();
      applyLayout();
    });
  }

  const panelResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
        updateResponsivePanelClasses();
        scheduleSplitterRefresh();
      })
    : null;
  panels.forEach((panel) => panelResizeObserver?.observe(panel));

  // Vigila el tamaño del contenido interno, no sus cambios de texto. Así una
  // lista que gana una fila vuelve a validar la altura guardada, sin medir el
  // tablero cada segundo cuando solo cambia un reloj.
  const contentResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
        window.requestAnimationFrame(() => {
          applyRowHeights();
          scheduleSplitterRefresh();
        });
      })
    : null;
  document
    .querySelectorAll(
      ".local-content, .summary-card, .timeline-scroll, .market-map, " +
        ".world-clock-grid, .holiday-list",
    )
    .forEach((element) => contentResizeObserver?.observe(element));

  window.addEventListener("resize", () => {
    updateResponsivePanelClasses();
    applyRowHeights();
    syncExpandButtons();
    scheduleSplitterRefresh();
  });
  applyLayout();
})();
