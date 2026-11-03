(() => {
  "use strict";
  const defaults = structuredClone(window.HUBITOS_HOME_CONFIG);
  const storageKey = "hubitos-home-demo-config-v4";
  const $ = id => document.getElementById(id);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let config = structuredClone(defaults);
  let mode = config.modes[0].id;
  let selectedId = "";
  let composing = false;
  let chosenFiles = [];
  let toastTimer;
  const drafts = new Map();
  const lastChoices = new Map();

  function validate(value) {
    if (!value || value.version !== 4 || typeof value.locale !== "string") return false;
    if (!value.selection || !["random-on-entry", "ordered-on-entry"].includes(value.selection.strategy) || typeof value.selection.avoidImmediateRepeat !== "boolean") return false;
    if (!value.ui || !Object.keys(defaults.ui).every(key => typeof value.ui[key] === "string")) return false;
    if (!value.capabilities || !Object.keys(defaults.capabilities).every(key => typeof value.capabilities[key] === "boolean")) return false;
    if (!value.uploads || !Array.isArray(value.uploads.accept) || !value.uploads.accept.length || !value.uploads.accept.every(extension => typeof extension === "string" && /^\.[a-z0-9]+$/i.test(extension))) return false;
    if (!Number.isSafeInteger(value.uploads.maxFiles) || value.uploads.maxFiles < 1 || !Number.isSafeInteger(value.uploads.maxFileBytes) || value.uploads.maxFileBytes < 1) return false;
    if (!Array.isArray(value.modes) || value.modes.length === 0 || !Array.isArray(value.examples)) return false;
    const modes = new Set();
    for (const entry of value.modes) {
      if (!entry || typeof entry.id !== "string" || !entry.id || modes.has(entry.id) || typeof entry.label !== "string" || !["chat", "bag"].includes(entry.icon)) return false;
      if (typeof entry.dynamicExamples !== "boolean" || typeof entry.staticTitle !== "string" || typeof entry.placeholder !== "string") return false;
      modes.add(entry.id);
    }
    const ids = new Set();
    for (const entry of value.examples) {
      if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || !modes.has(entry.mode) || typeof entry.enabled !== "boolean") return false;
      if (!["role", "shortLabel", "prompt", "prerequisite", "source"].every(key => typeof entry[key] === "string") || !entry.prompt.trim() || !entry.role.trim()) return false;
      if (entry.leadIn !== undefined && typeof entry.leadIn !== "string") return false;
      if (!Array.isArray(entry.requires) || !entry.requires.every(key => typeof key === "string" && Object.hasOwn(value.capabilities, key))) return false;
      ids.add(entry.id);
    }
    return true;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (validate(saved)) config = saved;
  } catch { /* file:// 或禁用存储时，配置仍在内存中正常使用。 */ }
  mode = config.modes[0].id;

  function available(entry) {
    return entry.enabled && entry.requires.every(capability => config.capabilities[capability] === true);
  }
  function examples() {
    if (!config.modes.find(entry => entry.id === mode)?.dynamicExamples) return [];
    return config.examples.filter(entry => entry.mode === mode && available(entry));
  }
  function current() {
    const entries = examples();
    return entries.find(entry => entry.id === selectedId) ?? entries[0] ?? null;
  }
  function rememberChoice(id) {
    lastChoices.set(mode, id);
    try { localStorage.setItem(`${storageKey}:last:${mode}`, id); } catch { /* 内存仍可在模式切换时避开上一条。 */ }
  }
  function chooseOnEntry() {
    const entries = examples();
    if (!entries.length) { selectedId = ""; return; }
    let previous = lastChoices.get(mode);
    try { previous ??= localStorage.getItem(`${storageKey}:last:${mode}`); } catch { /* 存储不可用时仍可随机选择。 */ }
    if (config.selection.strategy === "ordered-on-entry") {
      const index = entries.findIndex(entry => entry.id === previous);
      selectedId = entries[(index + 1) % entries.length].id;
    } else {
      const candidates = config.selection.avoidImmediateRepeat && entries.length > 1
        ? entries.filter(entry => entry.id !== previous) : entries;
      selectedId = candidates[Math.floor(Math.random() * candidates.length)].id;
    }
    rememberChoice(selectedId);
  }
  function formatPrompt(text, preview = false) {
    const now = new Date();
    let year = now.getFullYear();
    if (now >= new Date(year, 11, 1, 20)) year++;
    const publishDate = preview && year === now.getFullYear() ? "12月1日" : `${year}年12月1日`;
    return text.replaceAll("{{publishDate}}", publishDate).replaceAll("{{timezone}}", Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai");
  }
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${name}`);
    svg.setAttribute("aria-hidden", "true"); svg.append(use); return svg;
  }
  function button(text, className, action) {
    const element = document.createElement("button"); element.type = "button";
    element.textContent = text; element.className = className; element.addEventListener("click", action); return element;
  }
  function hasDraft() { return $("prompt").value.length > 0; }
  function setTitle(text) {
    const heading = $("roleTitle");
    if (heading.textContent === text) return;
    heading.getAnimations().forEach(animation => animation.cancel());
    heading.textContent = text;
    if (!reducedMotion.matches) heading.animate([{ opacity: .35, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 210, easing: "ease-out" });
  }
  function renderCopy() {
    document.title = config.ui.pageTitle;
    document.documentElement.lang = config.locale;
    const labels = { previewLabel:"previewLabel", previewNote:"previewNote", openConfig:"configButton", trySaying:"trySaying", clearDraft:"clear", configTitle:"configTitle", configDescription:"configDescription", allExamples:"allExamples", jsonLabel:"configuration", configHelp:"configHelp", resetConfig:"reset", importConfig:"import", exportConfig:"export", applyConfig:"apply", backToDraft:"back", receiptTitle:"receiptTitle", receiptBody:"receiptBody", receiptNote:"receiptNote", textModel:"demoTextModel", imageModel:"demoImageModel", ratioLabel:"demoRatio" };
    for (const [id, key] of Object.entries(labels)) $(id).textContent = config.ui[key];
    const titles = { addFile:"attachment", webButton:"web", ratioButton:"imageSettings", sendButton:"send", closeConfig:"close", fillExample:"tabHint" };
    for (const [id, key] of Object.entries(titles)) {
      $(id).setAttribute("aria-label", config.ui[key]); $(id).title = config.ui[key];
    }
    $("prompt").setAttribute("aria-label", config.ui.inputLabel);
    $("modelPreview").setAttribute("aria-label", config.ui.modelLabel);
    $("modeTabs").setAttribute("aria-label", config.ui.modeLabel);
    $("fillExample").title = config.ui.tabHint;
    $("inputHelp").textContent = `${config.ui.enterHint}。${config.ui.reviewHint}`;
    $("fileInput").accept = config.uploads.accept.join(",");
    renderTabs(); renderScenario();
  }
  function renderTabs() {
    $("modeTabs").replaceChildren(...config.modes.map(entry => {
      const tab = button("", "mode-tab", () => switchMode(entry.id));
      const text = document.createElement("span"); text.textContent = entry.label;
      tab.append(icon(entry.icon), text);
      tab.setAttribute("role", "tab"); tab.setAttribute("aria-selected", String(entry.id === mode));
      tab.tabIndex = entry.id === mode ? 0 : -1;
      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = config.modes.findIndex(item => item.id === mode);
        let next = event.key === "ArrowLeft" ? (index - 1 + config.modes.length) % config.modes.length : (index + 1) % config.modes.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = config.modes.length - 1;
        switchMode(config.modes[next].id);
        $("modeTabs").querySelector('[aria-selected="true"]').focus();
      });
      return tab;
    }));
  }
  function renderScenario() {
    const entry = current(); selectedId = entry?.id ?? "";
    const activeMode = config.modes.find(item => item.id === mode);
    setTitle(entry?.role ?? activeMode?.staticTitle ?? config.ui.defaultTitle);
    $("trySaying").textContent = entry?.leadIn ?? config.ui.trySaying;
    $("exampleText").textContent = entry ? formatPrompt(entry.prompt, true) : config.ui.noExamples;
    $("exampleText").disabled = !entry;
    $("fillExample").disabled = !entry;
    $("trySaying").hidden = !entry;
    $("prompt").placeholder = entry ? "" : activeMode?.placeholder ?? config.ui.emptyPlaceholder;
    renderDraft();
  }
  function renderDraft() {
    const filled = hasDraft();
    $("suggestion").hidden = filled || !current();
    $("sendButton").disabled = !$("prompt").value.trim();
    $("clearDraft").hidden = !filled;
  }
  function selectScenario(id) {
    if (hasDraft() || !examples().some(entry => entry.id === id)) return;
    selectedId = id; rememberChoice(id); renderScenario();
  }
  function fillExample() {
    if (hasDraft() || !current()) return;
    const input = $("prompt");
    input.focus(); input.setRangeText(formatPrompt(current().prompt), 0, input.value.length, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function switchMode(next) {
    if (next === mode) return;
    drafts.set(mode, { text: $("prompt").value, selectedId, files: chosenFiles });
    mode = next;
    const previous = drafts.get(mode);
    $("prompt").value = previous?.text ?? ""; selectedId = previous?.selectedId ?? ""; chosenFiles = previous?.files ?? [];
    if (!hasDraft()) chooseOnEntry();
    $("receipt").hidden = true; $("composeArea").hidden = false;
    renderTabs(); renderScenario(); renderFiles();
  }
  function renderFiles() {
    $("attachments").hidden = !chosenFiles.length;
    $("attachments").replaceChildren(...chosenFiles.map((file, index) => {
      const chip = document.createElement("div"); chip.className = "attachment-chip";
      const label = document.createElement("span"); label.textContent = file.name;
      const remove = button("", "", () => { chosenFiles.splice(index, 1); renderFiles(); });
      remove.setAttribute("aria-label", `${config.ui.removeAttachment} ${file.name}`); remove.append(icon("close"));
      chip.append(icon("file"), label, remove); return chip;
    }));
  }
  function addFiles(files) {
    let rejected = false;
    for (const file of files) {
      const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
      if (!config.uploads.accept.includes(extension) || file.size > config.uploads.maxFileBytes || chosenFiles.length >= config.uploads.maxFiles) {
        rejected = true;
        continue;
      }
      chosenFiles.push(file);
    }
    renderFiles();
    toast(rejected ? config.ui.uploadRejected : config.ui.attachTip);
  }
  function toast(text) {
    clearTimeout(toastTimer); $("toast").textContent = text; $("toast").classList.add("show");
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800);
  }
  function updateMotion() {
    const logo = document.querySelector("video.brand");
    if (reducedMotion.matches) logo.pause();
    else logo.play().catch(() => {});
  }
  function showReceipt() {
    if (composing || !$("prompt").value.trim()) return;
    $("receiptUser").textContent = $("prompt").value;
    $("composeArea").hidden = true; $("receipt").hidden = false;
    $("backToDraft").focus();
  }
  function renderCatalog() {
    $("catalogList").replaceChildren(...config.examples.map(entry => {
      const control = button("", `catalog-item${available(entry) ? "" : " unavailable"}`, () => {
        if (!available(entry)) { toast(config.ui.disabledLabel); return; }
        if (hasDraft() && entry.mode === mode) { toast(config.ui.draftProtection); return; }
        if (entry.mode !== mode) switchMode(entry.mode);
        if (hasDraft()) { toast(config.ui.draftProtection); return; }
        selectScenario(entry.id); $("configDialog").close(); $("prompt").focus();
      });
      const name = document.createElement("b"); name.textContent = entry.role;
      const note = document.createElement("small"); note.textContent = available(entry) ? entry.shortLabel : `${entry.shortLabel} · ${config.ui.disabledLabel}`;
      control.title = `${entry.prompt}\n${entry.prerequisite}\n${config.ui.sourceLabel} ${entry.source}`;
      control.append(name, note); return control;
    }));
  }
  function openConfig() {
    $("configText").value = JSON.stringify(config, null, 2);
    $("configStatus").textContent = ""; renderCatalog();
    $("configDialog").showModal();
  }
  function apply(value) {
    if (!validate(value)) { $("configStatus").textContent = config.ui.invalidConfig; return false; }
    config = structuredClone(value);
    try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch { /* 保留内存配置和导出能力。 */ }
    if (!config.modes.some(entry => entry.id === mode)) mode = config.modes[0].id;
    // 输入内容始终独立于文案配置，应用配置不重写正在编辑的草稿。
    renderCopy(); renderCatalog();
    $("configStatus").textContent = config.ui.configApplied; return true;
  }

  $("prompt").addEventListener("input", renderDraft);
  $("prompt").addEventListener("compositionstart", () => { composing = true; });
  $("prompt").addEventListener("compositionend", () => { composing = false; });
  $("prompt").addEventListener("keydown", event => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !hasDraft() && current()) {
      event.preventDefault(); fillExample();
    }
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault(); showReceipt();
    }
  });
  // 浏览器返回此页也算重新进入。已有草稿继续保留，切回浏览器标签不换示例。
  window.addEventListener("pageshow", event => {
    if (event.persisted && !hasDraft()) { chooseOnEntry(); renderScenario(); }
  });
  reducedMotion.addEventListener("change", updateMotion);
  $("exampleText").addEventListener("click", fillExample);
  $("fillExample").addEventListener("click", fillExample);
  $("clearDraft").addEventListener("click", () => { $("prompt").value = ""; renderScenario(); $("prompt").focus(); });
  $("sendButton").addEventListener("click", showReceipt);
  $("backToDraft").addEventListener("click", () => { $("receipt").hidden = true; $("composeArea").hidden = false; $("prompt").focus(); });
  $("addFile").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", event => { addFiles(event.target.files); event.target.value = ""; });
  $("webButton").addEventListener("click", () => {
    const enabled = $("webButton").getAttribute("aria-pressed") !== "true";
    $("webButton").setAttribute("aria-pressed", String(enabled)); $("webButton").classList.toggle("active", enabled);
  });
  $("openConfig").addEventListener("click", openConfig);
  $("closeConfig").addEventListener("click", () => $("configDialog").close());
  $("configDialog").addEventListener("close", () => { $("openConfig").focus(); });
  $("applyConfig").addEventListener("click", () => {
    try { apply(JSON.parse($("configText").value)); } catch { $("configStatus").textContent = config.ui.invalidConfig; }
  });
  $("resetConfig").addEventListener("click", () => { apply(defaults); $("configText").value = JSON.stringify(config, null, 2); });
  $("exportConfig").addEventListener("click", () => {
    try {
      const value = JSON.parse($("configText").value);
      if (!validate(value)) throw Error("invalid config");
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type:"application/json;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = config.ui.exportFilename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { $("configStatus").textContent = config.ui.invalidConfig; }
  });
  $("importConfig").addEventListener("click", () => $("configFile").click());
  $("configFile").addEventListener("change", async event => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    try {
      const value = JSON.parse(await file.text()); if (!validate(value)) throw Error("invalid config");
      $("configText").value = JSON.stringify(value, null, 2); $("configStatus").textContent = "";
    } catch { $("configStatus").textContent = config.ui.invalidConfig; }
  });
  chooseOnEntry(); renderCopy(); updateMotion();
})();
