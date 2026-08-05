(() => {
  "use strict";

  const STORAGE_KEY = "gmh:layout:v4";
  const STATE_VERSION = 5;
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
      label: "Compacto",
      description: "Filas más bajas y pares equilibrados para pantallas chicas.",
      sizes: { local: 4, summary: 6, timeline: 5, map: 5, worldclock: 10, calendar: 10 },
      rowHeights: [176, 312, 220, 220],
    },
    balanced: {
      label: "Balanceado",
      description: "Distribución base con foco parejo entre reloj, resumen, mapa y calendario.",
      sizes: {},
      rowHeights: [],
    },
    spacious: {
      label: "Amplio",
      description: "Más aire para timeline y lectura cómoda de paneles largos.",
      sizes: { local: 5, summary: 5, timeline: 7, map: 3, worldclock: 10, calendar: 10 },
      rowHeights: [280, 468, 300, 284],
    },
  };
  const MIN_SPAN = 2;
  const MAX_SPAN = 10;
  const MIN_ROW_HEIGHT = 96;
  const MAX_ROW_HEIGHT = 720;
  const ROW_HEIGHT_STEP = 12;

  // Empaqueta paneles desconocidos de a pares. Los paneles actuales usan
  // DEFAULT_SPANS, pero esto mantiene una salida razonable si se agrega un
  // bloque experimental sin declarar su ancho base.
  function packSpans(n) {
    const spans = [];
    let i = 0;
    let pairIndex = 0;
    while (i < n) {
      const remaining = n - i;
      if (remaining === 1) {
        spans.push(MAX_SPAN);
        i += 1;
      } else {
        const pair = pairIndex % 2 === 0 ? [4, 6] : [6, 4];
        spans.push(pair[0], pair[1]);
        i += 2;
        pairIndex += 1;
      }
    }
    return spans;
  }

  // Empaqueta paneles con tamaños manuales sin forzar que cada fila cierre
  // siempre en 10 unidades. Los divisores verticales ajustan solo paneles
  // vecinos; el resto del tablero conserva su distribución.
  function packRunWithSizes(run, sizeOverrides) {
    const rows = [];
    let current = [];
    let remaining = MAX_SPAN;

    function closeRow() {
      if (!current.length) return;
      rows.push(current);
      current = [];
      remaining = MAX_SPAN;
    }

    for (const id of run) {
      const manualSize = sizeOverrides[id];
      const manual = Number.isInteger(manualSize);
      const span = manual ? manualSize : Math.min(remaining, 6);

      if (span > remaining && current.length) {
        closeRow();
      }

      const finalSpan = manual ? manualSize : Math.min(remaining, 6);
      current.push({ id, span: finalSpan, manual });
      remaining -= finalSpan;

      if (remaining <= 0) closeRow();
    }
    closeRow();

    const result = [];
    for (const row of rows) {
      for (const item of row) result.push(item.span);
    }
    return result;
  }

  // Calcula el span de cada panel visible. Si ninguno tiene tamaño manual,
  // usa packSpans (fiel al diseño original); si al menos uno lo tiene, usa
  // packRunWithSizes para toda la lista visible.
  function computeSpans(visibleIds, sizeOverrides) {
    const hasManual = visibleIds.some((id) => Number.isInteger(sizeOverrides[id]));
    if (!hasManual) {
      const spans = packSpans(visibleIds.length);
      const result = new Map();
      visibleIds.forEach((id, k) => result.set(id, DEFAULT_SPANS[id] ?? spans[k]));
      return result;
    }
    const spans = packRunWithSizes(visibleIds, sizeOverrides);
    const result = new Map();
    visibleIds.forEach((id, k) => result.set(id, spans[k]));
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

  function rowHeightMapFromArray(values, order, sizes, hidden) {
    const result = {};
    if (!Array.isArray(values)) return result;
    const rows = rowModelFor(order, sizes, hidden);
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
      DEFAULT_ORDER,
      preset.sizes,
      DEFAULT_HIDDEN,
    );
  }

  function sameNumberMap(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => left[key] === right[key]);
  }

  function currentPresetName() {
    return Object.entries(LAYOUT_PRESETS).find(([, preset]) =>
      sameNumberMap(state.sizes, preset.sizes) &&
      sameNumberMap(state.rowHeights, presetRowHeights(preset)) &&
      state.order.every((id, index) => id === DEFAULT_ORDER[index]) &&
      state.hidden.length === DEFAULT_HIDDEN.length,
    )?.[0] || null;
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
          sizes[id] = num;
        }
      }
    }

    const worldClockHidden = Array.isArray(parsed?.worldClockHidden)
      ? [...new Set(parsed.worldClockHidden.filter((id) => typeof id === "string"))]
      : [];

    let rowHeights = {};
    if (Array.isArray(parsed?.rowHeights)) {
      rowHeights = rowHeightMapFromArray(
        parsed.rowHeights,
        order,
        sizes,
        safeHidden,
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
  saveState();

  function applyLayout() {
    const hiddenSet = new Set(state.hidden);
    const visible = state.order.filter((id) => !hiddenSet.has(id));
    const spanById = computeSpans(visible, state.sizes);

    state.order.forEach((id, fullIndex) => {
      const el = panels.get(id);
      if (!el) return;
      el.style.setProperty("--panel-order", fullIndex);
      if (hiddenSet.has(id)) {
        el.classList.add("is-hidden-panel");
        el.setAttribute("aria-hidden", "true");
      } else {
        el.classList.remove("is-hidden-panel");
        el.removeAttribute("aria-hidden");
        const span = spanById.get(id) ?? MAX_SPAN;
        el.style.setProperty("--panel-span", String(span));
        if (id === "summary") {
          el.classList.toggle("is-compact", span <= 4);
        }
      }
    });

    applyWorldClockVisibility();
    window.requestAnimationFrame(applyRowHeights);
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

  function applyRowHeights() {
    const rows = getRows();

    for (const panel of panels.values()) {
      panel.style.removeProperty("--custom-row-height");
    }

    rows.forEach((row) => {
      const height = state.rowHeights[rowSignatureFromDom(row)];
      if (!height) return;
      row.forEach(({ panel }) => {
        panel.style.setProperty("--custom-row-height", `${height}px`);
      });
    });
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
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function rowModelFor(order, sizeOverrides, hiddenList = state.hidden) {
    const hiddenSet = new Set(hiddenList);
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
      if (current.items.length && current.total + span > MAX_SPAN) closeRow();
      current.items.push({ id, span });
      current.total += span;
      if (current.total >= MAX_SPAN) closeRow();
    }
    closeRow();

    return rows;
  }

  function pruneRowHeights() {
    const validKeys = new Set(
      rowModelFor(state.order, state.sizes, state.hidden).map(rowSignatureFromModel),
    );
    const next = {};
    for (const [key, height] of Object.entries(state.rowHeights)) {
      if (validKeys.has(key)) next[key] = height;
    }
    state.rowHeights = next;
  }

  function expandPanelIntoFreeSpace(panelId) {
    const rows = rowModelFor(state.order, state.sizes, state.hidden);
    const row = rows.find((candidate) => candidate.items.at(-1)?.id === panelId);
    if (!row) return;
    const freeSpace = MAX_SPAN - row.total;
    const item = row.items.at(-1);
    if (!item || freeSpace <= 0) return;

    state.sizes = {
      ...state.sizes,
      [panelId]: clampSpan(item.span + freeSpace),
    };
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function syncExpandButtons() {
    dashboard.querySelectorAll(".panel-expand-button").forEach((button) => button.remove());
    if (!dashboard.classList.contains("is-customizing")) return;
    if (window.matchMedia("(max-width: 1080px)").matches) return;

    const rows = rowModelFor(state.order, state.sizes, state.hidden);
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
    const elements = [
      ...visiblePanelElements().filter((panel) => !panel.classList.contains("is-dragging")),
      dropPreview,
    ];

    elements.forEach((el) => {
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

  function renderDashboardDropPreview(draggedId, targetId, placement) {
    if (!targetId || draggedId === targetId) return;
    const nextOrder = orderWithInsertion(draggedId, targetId, placement);
    const nextSizes = { ...state.sizes };
    const hiddenSet = new Set(state.hidden);
    const visible = nextOrder.filter((id) => !hiddenSet.has(id));
    const spanById = computeSpans(visible, nextSizes);
    const previewOrder = visible.indexOf(draggedId);
    const previewSpan = spanById.get(draggedId) ?? DEFAULT_SPANS[draggedId] ?? MAX_SPAN;
    const nextKey = `${draggedId}:${targetId}:${placement}:${previewSpan}`;

    dashboardDropState = {
      order: nextOrder,
      sizes: nextSizes,
      targetId,
      placement,
    };

    if (nextKey === dashboardPreviewKey) return;
    dashboardPreviewKey = nextKey;
    const previousRects = captureLayoutRects();

    visible.forEach((id, visibleIndex) => {
      const el = panels.get(id);
      if (!el) return;
      el.style.setProperty("--panel-order", String(visibleIndex));
      if (id !== draggedId) {
        el.style.setProperty("--panel-span", String(spanById.get(id) ?? MAX_SPAN));
      }
    });

    dropPreview.style.setProperty("--panel-order", String(previewOrder));
    dropPreview.style.setProperty("--preview-span", String(previewSpan));
    dropPreview.classList.add("is-visible");
    dropPreview.classList.remove("is-expanded");
    dropPreview.textContent = `Colocar ${PANEL_META[draggedId]?.label || "panel"}`;

    animateLayoutFrom(previousRects);
  }

  function clearDashboardDropPreview(options = {}) {
    const { restoreLayout = false } = options;
    const hadPreview = dashboardPreviewKey || dropPreview.classList.contains("is-visible");
    const previousRects = restoreLayout && hadPreview ? captureLayoutRects() : null;
    dashboardDropState = null;
    dashboardPreviewKey = "";
    dropPreview.classList.remove("is-visible", "is-expanded");
    dropPreview.textContent = "";
    dropPreview.style.removeProperty("--panel-order");
    dropPreview.style.removeProperty("--preview-span");
    if (restoreLayout && hadPreview) {
      applyLayout();
      animateLayoutFrom(previousRects);
    }
  }

  function placementForTarget(targetEl, x, y, mode) {
    const rect = targetEl.getBoundingClientRect();
    if (mode === "list") return y < rect.top + rect.height / 2 ? "before" : "after";
    if (y < rect.top) return "before";
    if (y > rect.bottom) return "after";
    return x < rect.left + rect.width / 2 ? "before" : "after";
  }

  function distanceToRect(rect, x, y) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return Math.hypot(dx, dy);
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
    };
  }

  function updateDropTargetClasses(previousTarget, nextTarget) {
    if (previousTarget?.el && previousTarget.el !== nextTarget?.el) {
      previousTarget.el.classList.remove("is-drop-target", "is-drop-before", "is-drop-after");
    }
    if (!nextTarget?.el) return;
    nextTarget.el.classList.add("is-drop-target");
    nextTarget.el.classList.toggle("is-drop-before", nextTarget.placement === "before");
    nextTarget.el.classList.toggle("is-drop-after", nextTarget.placement === "after");
  }

  function clearDropTarget(target) {
    target?.el?.classList.remove("is-drop-target", "is-drop-before", "is-drop-after");
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
    if (hiddenSet.has(id)) {
      hiddenSet.delete(id);
    } else {
      const visibleCount = state.order.length - hiddenSet.size;
      if (visibleCount <= 1) return; // siempre queda al menos 1 panel visible
      hiddenSet.add(id);
    }
    state.hidden = Array.from(hiddenSet);
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function applyPreset(presetName) {
    const preset = LAYOUT_PRESETS[presetName];
    if (!preset) return;
    state.version = STATE_VERSION;
    state.order = DEFAULT_ORDER.slice();
    state.hidden = DEFAULT_HIDDEN.slice();
    state.sizes = cloneSizes(preset.sizes);
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

      const controlsWrap = document.createElement("span");
      controlsWrap.className = "customize-row-controls";
      controlsWrap.append(moveWrap, visBtn);

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
      const itemEl = handle.closest("[data-panel-id]");
      if (!itemEl) return;

      const draggedId = itemEl.dataset.panelId;
      const label = PANEL_META[draggedId]?.label || draggedId;
      const pointerId = ev.pointerId;
      const startX = ev.clientX;
      const startY = ev.clientY;
      let currentTarget = null;
      let ghost = null;
      let dragging = false;
      let finished = false;

      ev.preventDefault();
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // Algunos navegadores no permiten capturar el puntero en elementos
        // que cambian de visibilidad durante el gesto. Los listeners globales
        // siguen cubriendo ese caso.
      }

      function beginDrag(x, y) {
        dragging = true;
        itemEl.classList.add("is-dragging");
        if (mode === "dashboard") dashboard.classList.add("is-layout-dragging");
        ghost = makeDragGhost(label, x, y);
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
          );
        } else if (mode === "dashboard") {
          clearDashboardDropPreview({ restoreLayout: true });
        }
      }

      function finish(cancelled = false) {
        if (finished) return;
        finished = true;
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
          if (mode === "dashboard") clearDashboardDropPreview({ restoreLayout: true });
          return;
        }

        if (currentTarget) {
          if (mode === "dashboard" && dashboardDropState) {
            state.order = dashboardDropState.order;
            state.sizes = dashboardDropState.sizes;
            clearDashboardDropPreview();
            pruneRowHeights();
            saveState();
            applyLayout();
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
          clearDashboardDropPreview({ restoreLayout: true });
        }
      }

      function onUp(upEv) {
        if (upEv.pointerId !== pointerId) return;
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

  // Handles de arrastre directamente sobre los paneles del dashboard.
  dashboard.querySelectorAll("[data-drag-handle]").forEach((handle) => {
    setupDragging(
      handle,
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

  function clampSpan(value) {
    return Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.round(value)));
  }

  function commitPanelSpans(leftPanel, leftSpan, rightPanel, rightSpan) {
    const next = { ...state.sizes };
    next[leftPanel.dataset.panelId] = clampSpan(leftSpan);
    next[rightPanel.dataset.panelId] = clampSpan(rightSpan);
    state.sizes = next;
    pruneRowHeights();
    saveState();
    applyLayout();
  }

  function setRowHeight(rowIndex, height) {
    const row = getRows()[rowIndex];
    if (!row) return;
    const next = { ...state.rowHeights };
    next[rowSignatureFromDom(row)] = Math.min(
      MAX_ROW_HEIGHT,
      Math.max(MIN_ROW_HEIGHT, Math.round(height)),
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

  function addHorizontalSplitter(rowIndex, upperRow, lowerRow) {
    const splitter = document.createElement("button");
    splitter.type = "button";
    splitter.className = "layout-splitter layout-splitter-horizontal";
    splitter.dataset.rowIndex = String(rowIndex);
    splitter.setAttribute("aria-label", `Ajustar altura de fila ${rowIndex + 1}`);
    splitter.title = "Arrastrá verticalmente. Paso: 12 px.";
    splitter.dataset.tooltip = "Altura: paso 12 px";

    const dashboardRect = dashboard.getBoundingClientRect();
    const upperBottom = Math.max(...upperRow.map(({ rect }) => rect.bottom));
    const lowerTop = Math.min(...lowerRow.map(({ rect }) => rect.top));
    const y = (upperBottom + lowerTop) / 2 - dashboardRect.top;

    splitter.style.left = "16px";
    splitter.style.right = "16px";
    splitter.style.top = `${y}px`;

    setupHorizontalSplitter(splitter, rowIndex, upperRow);
    splitterLayer.appendChild(splitter);
  }

  function refreshSplitters() {
    splitterLayer.innerHTML = "";
    if (!dashboard.classList.contains("is-customizing")) return;
    if (window.matchMedia("(max-width: 1080px)").matches) return;

    const rows = getRows();
    rows.forEach((row, rowIndex) => {
      for (let index = 0; index < row.length - 1; index += 1) {
        addVerticalSplitter(row[index], row[index + 1]);
      }
      if (rowIndex < rows.length - 1) {
        addHorizontalSplitter(rowIndex, row, rows[rowIndex + 1]);
      }
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
      const maxDelta = rightStart - MIN_SPAN;
      const minDelta = MIN_SPAN - leftStart;
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
        const maxDelta = rightStart - MIN_SPAN;
        const minDelta = MIN_SPAN - leftStart;
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
      });
    }

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
          Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + steppedDelta)),
        );
        preview(finalHeight);
        const appliedDelta = finalHeight - startHeight;
        splitter.style.top = `${splitterStartTop + appliedDelta}px`;
        badge.textContent = `${finalHeight}px`;
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
        rowHeights: {},
      };
      saveState();
      applyLayout();
    });
  }

  window.addEventListener("resize", scheduleSplitterRefresh);
  applyLayout();
})();
