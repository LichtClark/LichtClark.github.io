/*
 * app.js — Bedienoberfläche für den v86-Emulator.
 *
 * Es gibt keinerlei Serverlogik: Kernel, BIOS, Abbilder und das WebAssembly-Modul
 * werden als statische Dateien geladen, alles andere passiert im Browser-Tab.
 * Einzige Ausnahme ist der optionale Netzwerk-Relay, der ausdrücklich eingeschaltet
 * werden muss (siehe Abschnitt "Netzwerk").
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Lokale Entwicklung (Datei fehlt -> fetch-assets-Hinweis) vs. gehostete
  // Online-Version (kein PowerShell, keine tools/): Meldungen unterscheiden sich.
  const isLocalDev = () =>
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  const el = {
    profile: $("profile"),
    profileHint: $("profile_hint"),
    customBox: $("custom_box"),
    customFile: $("custom_file"),
    customKind: $("custom_kind"),
    customCmdline: $("custom_cmdline"),
    isoReport: $("iso_report"),
    forceArchBox: $("force_arch_box"),
    forceArch: $("force_arch"),
    notice: $("notice"),
    noticeText: $("notice_text"),
    noticeClose: $("notice_close"),
    diskAutosave: $("disk_autosave"),
    memory: $("memory"),
    vgaMemory: $("vga_memory"),
    enableAudio: $("enable_audio"),
    enableAcpi: $("enable_acpi"),

    diskMode: $("disk_mode"),
    diskOpts: $("disk_opts"),
    diskSize: $("disk_size"),
    diskId: $("disk_id"),
    diskStatus: $("disk_status"),
    btnDiskSave: $("btn_disk_save"),
    btnDiskDrop: $("btn_disk_drop"),

    netMode: $("net_mode"),
    netRelayBox: $("net_relay_box"),
    relayUrl: $("relay_url"),
    netCard: $("net_card"),
    netHint: $("net_hint"),
    btnNetUp: $("btn_net_up"),
    btnNetTest: $("btn_net_test"),

    btnStart: $("btn_start"),
    btnPause: $("btn_pause"),
    btnReset: $("btn_reset"),
    btnKill: $("btn_kill"),
    btnFullscreen: $("btn_fullscreen"),
    btnScreenshot: $("btn_screenshot"),
    btnSaveState: $("btn_save_state"),
    btnLoadState: $("btn_load_state"),
    stateFile: $("state_file"),
    sendText: $("send_text"),
    btnSendText: $("btn_send_text"),
    uploadFile: $("upload_file"),
    downloadPath: $("download_path"),
    btnDownloadFile: $("btn_download_file"),
    recipeBlock: $("recipe_block"),
    autoStart: $("auto_start"),
    autoStatus: $("auto_status"),
    recipes: $("recipes"),

    zoom: $("zoom"),
    tabVga: $("tab_vga"),
    tabSerial: $("tab_serial"),
    screenContainer: $("screen_container"),
    screenEmpty: $("screen_empty"),
    screenTitle: $("screen_title"),
    serial: $("serial"),
    logEl: $("log"),
    progressWrap: $("progress_wrap"),
    progressBar: $("progress_bar"),
    progressName: $("progress_name"),
    progressPct: $("progress_pct"),
    statState: $("stat_state"),
    statUptime: $("stat_uptime"),
    statMips: $("stat_mips"),
    statRes: $("stat_res"),
    badgeState: $("badge_state"),
    fileWarning: $("file_warning"),
  };

  const state = {
    emulator: null,
    running: false,
    bootedAt: 0,
    lastInstr: 0,
    lastTick: 0,
    timer: null,
    hasFilesystem: false,
    view: "vga",
    fsAnnounced: false,
    autoLaeuft: false,
    autoAbbruch: false,
    disk: null,        // { id, buffer, persist, size }
    isoInfo: null,     // Ergebnis der ISO-Analyse für "Eigenes Abbild"
    netActive: "off",
  };

  // ───────────────────────────── Hilfsfunktionen ─────────────────────────────

  function log(msg) {
    const t = new Date().toLocaleTimeString("de-DE");
    el.logEl.textContent += `[${t}] ${msg}\n`;
    el.logEl.scrollTop = el.logEl.scrollHeight;
  }

  /*
   * Meldungen erscheinen in der Seite statt in alert()/confirm(). Das ist nicht nur
   * angenehmer, sondern auch verlässlicher: eingebettete Browser-Ansichten
   * unterdrücken native Dialoge, confirm() liefert dort stillschweigend false.
   */
  function notify(kind, text) {
    el.notice.hidden = false;
    el.notice.className = "notice " + kind;
    el.noticeText.textContent = text;
    log(text.replace(/\s+/g, " "));
  }

  function clearNotice() { el.notice.hidden = true; }

  function setBadge(text, cls) {
    el.badgeState.textContent = text;
    el.badgeState.className = "badge" + (cls ? " " + cls : "");
  }

  function fmtBytes(n) {
    if (n === undefined || n === null) return "–";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(i === 0 ? 0 : 1) + " " + u[i];
  }

  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h) return `${h} h ${m % 60} min`;
    if (m) return `${m} min ${s % 60} s`;
    return `${s} s`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ───────────────────────────── Ansicht (VGA / seriell) ────────────────────

  function setView(view) {
    state.view = view === "serial" ? "serial" : "vga";
    const serial = state.view === "serial";
    el.tabVga.classList.toggle("active", !serial);
    el.tabSerial.classList.toggle("active", serial);
    el.zoom.parentElement.style.visibility = serial ? "hidden" : "visible";
    if (!el.screenEmpty.hidden) return;      // vor dem Booten bleibt der Platzhalter
    el.screenContainer.classList.toggle("active", !serial);
    el.serial.hidden = !serial;
    if (serial) {
      const ta = el.serial.querySelector("textarea");
      if (ta) ta.focus();
    }
  }

  // ───────────────────────────── Profile / Einstellungen ─────────────────────

  function fillProfiles() {
    for (const p of PROFILES) {
      if (window.BL_WEB && p.web === false) continue;   // Online-Build: nur ausgelieferte Gaeste zeigen
      const o = document.createElement("option");
      o.value = p.id; o.textContent = p.name;
      el.profile.appendChild(o);
    }
  }

  /*
   * ?sys=<id> waehlt von der Startseite aus direkt ein System vor (z. B. die
   * Karten "Alpine starten" / "Buildroot starten"). Ungueltige oder online nicht
   * ausgelieferte Werte werden ignoriert.
   */
  function applyQuery() {
    const sys = new URLSearchParams(location.search).get("sys");
    if (sys && PROFILE_BY_ID[sys] &&
        [...el.profile.options].some((o) => o.value === sys)) {
      el.profile.value = sys;
    }
  }

  const currentProfile = () => PROFILE_BY_ID[el.profile.value] || PROFILES[0];

  function onProfileChange(applyDefaults) {
    const p = currentProfile();
    el.profileHint.textContent = p.hint;
    el.customBox.hidden = p.source !== "custom";
    setView(p.console || "vga");
    renderRecipes(p);

    if (p.disk === "required" && el.diskMode.value === "none") el.diskMode.value = "persist";
    if (p.disk === "none") el.diskMode.value = "none";
    onDiskModeChange();

    if (applyDefaults !== false) {
      el.memory.value = String(p.memory);
      el.vgaMemory.value = String(p.vga_memory);
      saveSettings();
    }
  }

  const SETTINGS_KEY = "browserlinux.settings";

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        profile: el.profile.value,
        memory: el.memory.value,
        vga_memory: el.vgaMemory.value,
        audio: el.enableAudio.checked,
        acpi: el.enableAcpi.checked,
        netMode: el.netMode.value,
        netCard: el.netCard.value,
        relay: el.relayUrl.value,
        diskMode: el.diskMode.value,
        diskSize: el.diskSize.value,
        diskId: el.diskId.value,
        zoom: el.zoom.value,
        autoStart: el.autoStart.checked,
      }));
    } catch (e) { /* privater Modus – egal */ }
  }

  function loadSettings() {
    let s;
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); } catch (e) { s = null; }
    if (!s) return;
    if (PROFILE_BY_ID[s.profile]) el.profile.value = s.profile;
    if (s.memory) el.memory.value = s.memory;
    if (s.vga_memory) el.vgaMemory.value = s.vga_memory;
    el.enableAudio.checked = !!s.audio;
    el.enableAcpi.checked = !!s.acpi;
    if (s.netMode) el.netMode.value = s.netMode;
    if (s.netCard) el.netCard.value = s.netCard;
    if (s.relay) el.relayUrl.value = s.relay;
    if (s.diskMode) el.diskMode.value = s.diskMode;
    if (s.diskSize) el.diskSize.value = s.diskSize;
    if (s.diskId) el.diskId.value = s.diskId;
    if (s.zoom) el.zoom.value = s.zoom;
    if (s.autoStart !== undefined) el.autoStart.checked = !!s.autoStart;
  }

  // ───────────────────────────── Rezepte ─────────────────────────────────────

  function renderRecipes(profile) {
    el.recipes.innerHTML = "";
    const list = profile.recipes || [];
    el.recipeBlock.hidden = list.length === 0;
    for (const r of list) {
      const b = document.createElement("button");
      b.textContent = r.label;
      b.title = r.cmd;
      b.disabled = !state.running;
      b.className = "recipe";
      b.addEventListener("click", () => {
        sendToGuest(r.cmd);
        log(`Rezept „${r.label}“ gesendet.`);
      });
      el.recipes.appendChild(b);
    }
  }

  function setRecipesEnabled(on) {
    for (const b of el.recipes.querySelectorAll("button")) b.disabled = !on;
  }

  // ───────────────────────────── Autostart ──────────────────────────────────

  /*
   * Liest, was der Gast gerade auf dem Schirm hat — je nach Profil aus dem
   * VGA-Textpuffer oder aus dem xterm der seriellen Konsole.
   */
  function guestScreen() {
    const emu = state.emulator;
    if (!emu) return "";
    try {
      if (state.view === "serial" && emu.serial_adapter && emu.serial_adapter.term) {
        const b = emu.serial_adapter.term.buffer.active;
        const zeilen = [];
        for (let i = 0; i < b.length; i++) {
          const l = b.getLine(i);
          if (l) zeilen.push(l.translateToString(true));
        }
        return zeilen.join("\n");
      }
      return emu.screen_adapter.get_text_screen().join("\n");
    } catch (e) { return ""; }
  }

  function warteAufText(muster, ms, label) {
    return new Promise((fertig) => {
      const t0 = performance.now();
      const tick = () => {
        if (!state.emulator || state.autoAbbruch) return fertig(false);
        if (muster.test(guestScreen())) return fertig(true);
        if (performance.now() - t0 > ms) return fertig(false);
        if (label) setAutoStatus(`${label} … ${Math.round((performance.now() - t0) / 1000)} s`);
        setTimeout(tick, 2500);
      };
      tick();
    });
  }

  function setAutoStatus(text) {
    el.autoStatus.textContent = text;
    el.autoStatus.hidden = !text;
  }

  /*
   * Arbeitet die autorun-Schritte des Profils ab: warten, tippen, auf die
   * Ausgabe warten. Läuft der Tab im Hintergrund, drosselt der Browser die
   * Zeitgeber stark — deshalb der Hinweis in der Oberfläche.
   */
  async function runAutostart(profile) {
    const schritte = profile.autorun || [];
    if (!schritte.length) return;
    state.autoAbbruch = false;
    state.autoLaeuft = true;
    log(`Autostart: ${schritte.length} Schritte.`);
    try {
      for (let i = 0; i < schritte.length; i++) {
        const s = schritte[i];
        const nr = `${i + 1}/${schritte.length}`;
        if (s.vorher) {
          setAutoStatus(`${nr} ${s.text}: warte …`);
          if (!await warteAufText(s.vorher, s.ms || 180000, `${nr} ${s.text}`)) {
            return autoFehler(`${s.text}: der Gast hat sich nicht gemeldet`);
          }
        }
        if (state.autoAbbruch) return;
        if (s.tippen) {
          setAutoStatus(`${nr} ${s.text} …`);
          sendToGuest(s.tippen);
        }
        if (s.nachher) {
          if (!await warteAufText(s.nachher, s.ms || 180000, `${nr} ${s.text}`)) {
            return autoFehler(`${s.text}: keine Rückmeldung`);
          }
        }
        log(`Autostart ${nr}: ${s.text} erledigt.`);
      }
      setAutoStatus("Autostart fertig — der Gast ist eingerichtet.");
      log("Autostart abgeschlossen.");
    } finally {
      state.autoLaeuft = false;
    }
  }

  function autoFehler(text) {
    setAutoStatus("Autostart abgebrochen: " + text);
    notify("warn",
      "Autostart abgebrochen — " + text + ". Die VM läuft weiter; die Schritte " +
      "lassen sich einzeln über die Rezepte nachholen. Häufigster Grund: der Tab " +
      "lag im Hintergrund, dort bremst der Browser die Zeitgeber aus.");
  }

  /** Schickt eine Befehlszeile an die gerade sichtbare Konsole der VM. */
  function sendToGuest(cmd) {
    if (!state.emulator) return;
    if (state.view === "serial") state.emulator.serial0_send(cmd + "\n");
    else state.emulator.keyboard_send_text(cmd + "\n");
  }

  // ───────────────────────────── Netzwerk ────────────────────────────────────

  /*
   * v86 kennt drei Backends (belegt in vendor/libv86.js):
   *   "fetch"            eigener TCP/IP-Stack im Browser, Verbindungen laufen über fetch().
   *                      Kein fremder Server nötig — aber es gilt die Same-Origin-Policy:
   *                      Nur Ziele, die CORS erlauben, antworten. Paketquellen wie
   *                      dl-cdn.alpinelinux.org tun das nicht, apk scheitert damit.
   *   "wisp(s)://…"      WISP-Relay, echtes TCP in beide Richtungen.
   *   "ws(s)://…"        klassischer websockproxy-Relay (Ethernet-Frames über WebSocket).
   * Bei den Relay-Varianten sieht der Betreiber des Relays den gesamten Netzverkehr
   * der VM — das steht auch so in der Oberfläche.
   */
  function buildNetDevice() {
    const mode = el.netMode.value;
    if (mode === "off") return null;
    const type = el.netCard.value === "virtio" ? "virtio" : "ne2k";
    if (mode === "fetch") {
      return { type, relay_url: "fetch", dns_method: "doh", doh_server: "cloudflare-dns.com" };
    }
    const url = el.relayUrl.value.trim();
    if (!url) return null;
    return { type, relay_url: url };
  }

  function onNetModeChange() {
    const mode = el.netMode.value;
    el.netRelayBox.hidden = mode !== "relay";
    el.netHint.innerHTML = {
      off: "Der Gast hat keine Netzwerkverbindung. Alles bleibt im Tab.",
      fetch:
        "v86 bildet Router, DHCP und DNS selbst nach und leitet Verbindungen über " +
        "<code>fetch()</code> weiter — <strong>ohne fremden Server</strong>. Dafür gilt die " +
        "Same-Origin-Policy des Browsers: nur Ziele mit CORS-Freigabe antworten, alle " +
        "anderen quittieren mit <code>502 Fetch Error</code>. " +
        "Für <code>apk</code>/<code>apt</code> reicht das nicht, für CORS-offene APIs schon.",
      relay:
        "Volles TCP über einen WebSocket-Relay — damit funktionieren Paketmanager, ssh und " +
        "beliebige Ports. <strong>Der Betreiber des Relays sieht den gesamten Verkehr der VM.</strong> " +
        "Nur Adressen eintragen, denen Sie vertrauen; eigener Relay: " +
        "<code>wisp-server-node</code> oder <code>websockproxy</code>.",
    }[mode];
    saveSettings();
  }

  /*
   * Der Fetch-Modus setzt jede Gast-Verbindung als Browser-fetch() ab. Scheitert
   * die (fehlende CORS-Freigabe), landet bei v86 nur ein roher JS-Stacktrace in
   * der Gast-Konsole — für den Nutzer nicht deutbar. Deshalb wird fetch() hier
   * beobachtet und der erste Fehlschlag verständlich gemeldet.
   *
   * Zweiter, leiser Effekt: fetch() darf den User-Agent nicht setzen. Dienste,
   * die danach unterscheiden (wttr.in, ifconfig.me …), antworten deshalb mit
   * ihrer Browser-Variante statt mit der Terminalausgabe.
   */
  function watchFetchFailures() {
    if (window.__blFetchWatched) return;
    window.__blFetchWatched = true;
    const orig = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      return orig.call(this, input, init).catch((err) => {
        if (state.netActive === "fetch" && /^https?:\/\//.test(url) &&
            !url.startsWith(location.origin)) {
          let host = url;
          try { host = new URL(url).host; } catch (e) { /* egal */ }
          notify("warn",
            `${host} hat die Anfrage abgelehnt: der Dienst erlaubt keinen Zugriff aus dem ` +
            "Browser (kein CORS). Im Netzwerkmodus „Relay“ läuft echtes TCP — damit " +
            "funktionieren solche Ziele, und der Gast sendet auch seinen eigenen " +
            "User-Agent statt dem des Browsers.");
        }
        throw err;
      });
    };
  }

  async function netUp() {
    const p = currentProfile();
    sendToGuest(p.netUp || "udhcpc");
    log("Netzwerk im Gast wird hochgezogen …");
  }

  async function netTest() {
    sendToGuest("wget -qO- http://example.com 2>&1 | head -5 || curl -s http://example.com | head -5");
    log("Testabruf abgeschickt — Ergebnis erscheint in der Konsole.");
  }

  // ───────────────────────────── Festplatte ──────────────────────────────────

  function onDiskModeChange() {
    const mode = el.diskMode.value;
    el.diskOpts.hidden = mode === "none";
    refreshDiskStatus();
    saveSettings();
  }

  async function refreshDiskStatus() {
    if (el.diskMode.value === "none") { el.diskStatus.textContent = "–"; return; }
    try {
      const info = await DiskStore.info(el.diskId.value.trim());
      const q = await DiskStore.quota();
      const quotaTxt = q ? ` · Browser-Kontingent: ${fmtBytes(q.usage)} von ${fmtBytes(q.quota)} belegt` : "";
      el.diskStatus.textContent = info
        ? `gespeichert: ${fmtBytes(info.size)}, zuletzt ${new Date(info.updated).toLocaleString("de-DE")}${quotaTxt}`
        : `noch nicht angelegt${quotaTxt}`;
    } catch (e) {
      el.diskStatus.textContent = "Speicher nicht verfügbar: " + e.message;
    }
  }

  /*
   * Eine virtuelle Platte ist ein einziger ArrayBuffer und liegt vollständig im
   * Arbeitsspeicher des Tabs. Große Größen scheitern deshalb je nach freiem
   * Speicher ("Array buffer allocation failed") — statt den Start abzubrechen,
   * wird die nächstkleinere Größe genommen und das offen gesagt.
   */
  function allocateDisk(size) {
    const MIN = 128 * 1024 * 1024;
    let want = size;
    for (;;) {
      try {
        return new ArrayBuffer(want);
      } catch (e) {
        if (want <= MIN) {
          throw new Error(
            "Selbst 128 MB liessen sich nicht mehr belegen. Bitte den Tab neu laden " +
            "oder andere Tabs schliessen."
          );
        }
        want = Math.floor(want / 2);
      }
    }
  }

  /** Prüft beim Umstellen der Größe sofort, ob so viel Speicher überhaupt zu haben ist. */
  function probeDiskSize() {
    const size = parseInt(el.diskSize.value, 10) * 1024 * 1024;
    let ok = false;
    try {
      const test = new ArrayBuffer(size);
      ok = test.byteLength === size;
    } catch (e) { ok = false; }
    const opt = el.diskSize.selectedOptions[0];
    if (!ok) {
      notify("warn",
        `${fmtBytes(size)} lassen sich in diesem Tab gerade nicht belegen. ` +
        "Die Platte liegt komplett im Arbeitsspeicher — bei Bedarf eine Nummer " +
        "kleiner wählen oder den Browser neu starten.");
      opt.textContent = opt.textContent.replace(/ — .*/, "") + " — zu groß";
    } else {
      opt.textContent = opt.textContent.replace(/ — .*/, "");
      clearNotice();
    }
    return ok;
  }

  /** Legt den Plattenpuffer an — entweder frisch oder aus IndexedDB. */
  async function prepareDisk() {
    const mode = el.diskMode.value;
    if (mode === "none") { state.disk = null; return null; }

    const size = parseInt(el.diskSize.value, 10) * 1024 * 1024;
    const id = el.diskId.value.trim() || "disk";
    let buffer = null;

    if (mode === "persist") {
      await DiskStore.requestPersistence();
      const info = await DiskStore.info(id);
      if (info) {
        setBadge("lade Festplatte …", "busy");
        buffer = await DiskStore.load(id, (i, n) => {
          el.progressWrap.hidden = false;
          el.progressName.textContent = `Festplatte „${id}“ aus dem Browser-Speicher`;
          el.progressPct.textContent = Math.round((i / n) * 100) + " %";
          el.progressBar.style.width = Math.round((i / n) * 100) + "%";
        });
        el.progressWrap.hidden = true;
        log(`Festplatte „${id}“ geladen (${fmtBytes(buffer.byteLength)}).`);
      }
    }

    if (!buffer) {
      buffer = allocateDisk(size);
      if (buffer.byteLength !== size) {
        notify("warn",
          `Für ${fmtBytes(size)} reichte der freie Speicher des Tabs nicht — angelegt ` +
          `wurde stattdessen eine Platte mit ${fmtBytes(buffer.byteLength)}. ` +
          "Größere Platten brauchen einen frisch gestarteten Browser; " +
          "der gesamte Inhalt liegt im Arbeitsspeicher dieses Tabs.");
      }
      log(`Neue leere Festplatte angelegt (${fmtBytes(buffer.byteLength)}).`);
    }

    state.disk = { id, buffer, persist: mode === "persist", size: buffer.byteLength };
    return buffer;
  }

  /**
   * Findet den Puffer, in den v86 die Schreibzugriffe der Festplatte ablegt.
   * Es wird nicht auf eine feste Position gesetzt, sondern der IDE-Kanal gesucht,
   * dessen Puffer zur angelegten Platte passt.
   */
  function findDiskBuffer() {
    const cpu = state.emulator && state.emulator.v86 && state.emulator.v86.cpu;
    const ide = cpu && cpu.devices && cpu.devices.ide;
    if (!ide || !state.disk) return null;
    const cands = [];
    for (const ch of [ide.primary, ide.secondary]) {
      if (!ch) continue;
      for (const dev of [ch.master, ch.slave]) {
        if (dev && !dev.is_atapi && dev.buffer && dev.buffer.buffer) cands.push(dev.buffer.buffer);
      }
    }
    return cands.find((b) => b.byteLength === state.disk.size) || cands[0] || null;
  }

  async function saveDisk() {
    if (!state.disk) return;
    const buf = findDiskBuffer() || state.disk.buffer;
    setBadge("sichere Festplatte …", "busy");
    el.btnDiskSave.disabled = true;
    try {
      const res = await DiskStore.save(state.disk.id, buf, state.disk.id, (i, n) => {
        el.progressWrap.hidden = false;
        el.progressName.textContent = `Festplatte „${state.disk.id}“ wird gesichert`;
        el.progressPct.textContent = Math.round((i / n) * 100) + " %";
        el.progressBar.style.width = Math.round((i / n) * 100) + "%";
      });
      el.progressWrap.hidden = true;
      log(`Festplatte gesichert: ${res.written} von ${res.total} Blöcken geändert (${fmtBytes(res.bytes)}).`);
      await refreshDiskStatus();
    } catch (e) {
      notify("err", "Die Festplatte konnte nicht gesichert werden: " + e.message);
    }
    el.btnDiskSave.disabled = !state.running;
    setBadge(state.running ? "läuft" : "bereit", state.running ? "ok" : "");
  }

  // Zweistufig statt confirm(): der erste Klick fragt, der zweite löscht.
  let dropArmed = null;
  async function dropDisk() {
    const id = el.diskId.value.trim();
    if (!id) return;
    if (dropArmed !== id) {
      dropArmed = id;
      el.btnDiskDrop.textContent = "🗑 wirklich?";
      el.btnDiskDrop.classList.add("danger");
      setTimeout(() => {
        if (dropArmed !== id) return;
        dropArmed = null;
        el.btnDiskDrop.textContent = "🗑 löschen";
        el.btnDiskDrop.classList.remove("danger");
      }, 5000);
      return;
    }
    dropArmed = null;
    el.btnDiskDrop.textContent = "🗑 löschen";
    el.btnDiskDrop.classList.remove("danger");
    await DiskStore.remove(id);
    notify("ok", `Festplatte „${id}“ gelöscht.`);
    await refreshDiskStatus();
  }

  // ───────────────────────────── ISO-Analyse ─────────────────────────────────

  async function analyseIso(file) {
    el.isoReport.hidden = false;
    el.isoReport.className = "iso_report";
    el.isoReport.textContent = "Abbild wird untersucht …";
    state.isoInfo = null;
    try {
      const info = await IsoInfo.inspect(file);
      state.isoInfo = info;
      const verdict = {
        amd64: ["err", "64-Bit-Abbild — v86 emuliert nur 32-Bit-x86. Dieses System kann hier nicht starten."],
        i386: ["ok", "32-Bit-Abbild — grundsätzlich lauffähig."],
        both: ["ok", "Enthält 32-Bit-Bootpfad — grundsätzlich lauffähig."],
        unknown: ["warn", "Architektur nicht eindeutig bestimmbar. Ein Versuch schadet nicht."],
      }[info.arch];
      el.isoReport.classList.add(verdict[0]);
      el.isoReport.innerHTML =
        `<strong>${verdict[1]}</strong>` +
        (info.label ? `<br>Datenträger: ${info.label}` : "") +
        info.details.map((d) => `<br><span class="tiny">${d}</span>`).join("");
      el.forceArchBox.hidden = info.arch !== "amd64";
      if (info.arch !== "amd64") el.forceArch.checked = false;
    } catch (e) {
      el.isoReport.className = "iso_report warn";
      el.isoReport.textContent = "Analyse nicht möglich: " + e.message;
    }
  }

  // ───────────────────────────── Konfiguration bauen ─────────────────────────

  function serialConsoleConfig() {
    el.serial.innerHTML = "";
    if (typeof window.Terminal === "function") {
      el.serial.classList.remove("plain");
      return { type: "xtermjs", container: el.serial, xterm_lib: window.Terminal };
    }
    log("xterm.js nicht gefunden – serielle Konsole läuft im einfachen Textmodus.");
    const ta = document.createElement("textarea");
    ta.spellcheck = false;
    el.serial.classList.add("plain");
    el.serial.appendChild(ta);
    return { type: "textarea", container: ta };
  }

  async function checkAssets(profile) {
    for (const path of profile.assets || []) {
      let ok = false;
      try { ok = (await fetch(path, { method: "HEAD" })).ok; } catch (e) { ok = false; }
      if (!ok) {
        if (isLocalDev()) {
          throw new Error(
            `Das Abbild "${path}" fehlt.\n\n` +
            "Einmalig holen mit:\n    powershell -ExecutionPolicy Bypass -File tools\\fetch-assets.ps1" +
            (profile.optional ? " -Extras" : "")
          );
        }
        throw new Error(
          `Das Abbild „${path.split("/").pop()}“ liess sich nicht laden. ` +
          "Vermutlich ein Verbindungsproblem — bitte die Seite neu laden. " +
          "In der Online-Version stehen Alpine, Buildroot und „Eigenes Abbild“ zur Verfügung."
        );
      }
    }
  }

  async function fileToImage(file) {
    const LIMIT = 128 * 1024 * 1024;
    if (file.size <= LIMIT) return { buffer: await file.arrayBuffer() };
    return { buffer: file, async: true, size: file.size };
  }

  async function buildConfig() {
    const p = currentProfile();
    await checkAssets(p);

    const cfg = Object.assign({
      wasm_path: "vendor/v86.wasm",
      bios: { url: "vendor/bios/seabios.bin" },
      vga_bios: { url: "vendor/bios/vgabios.bin" },
      memory_size: parseInt(el.memory.value, 10) * 1024 * 1024,
      vga_memory_size: parseInt(el.vgaMemory.value, 10) * 1024 * 1024,
      screen: { container: el.screenContainer, scaling: parseFloat(el.zoom.value) || 1 },
      serial_console: serialConsoleConfig(),
      disable_speaker: !el.enableAudio.checked,
      acpi: !!el.enableAcpi.checked,
      autostart: true,
    }, p.build());

    if (p.source === "custom") {
      const file = el.customFile.files && el.customFile.files[0];
      if (!file) throw new Error("Bitte zuerst eine Abbild-Datei auswählen.");
      if (state.isoInfo && state.isoInfo.arch === "amd64" && !el.forceArch.checked) {
        throw new Error(
          `„${file.name}“ ist ein 64-Bit-Abbild (amd64). v86 emuliert einen 32-Bit-Prozessor — ` +
          "das System startet damit nicht, der Bildschirm bliebe schwarz. " +
          "Wer es trotzdem sehen will, hakt unten „trotzdem starten versuchen“ an."
        );
      }
      const kind = el.customKind.value;
      cfg[kind] = await fileToImage(file);
      if (kind === "bzimage") cfg.cmdline = el.customCmdline.value.trim();
      cfg.filesystem = {};
      log(`Eigenes Abbild: ${file.name} (${fmtBytes(file.size)}) als ${kind}`);
    }

    const diskBuffer = await prepareDisk();
    if (diskBuffer) {
      cfg.hda = { buffer: diskBuffer };
      if (!cfg.boot_order && !cfg.bzimage) cfg.boot_order = 0x123; // CD, dann Platte
    } else if (p.disk === "required") {
      throw new Error("Dieses Profil startet von der Festplatte — bitte oben eine Festplatte auswählen.");
    }

    const net = buildNetDevice();
    if (net) {
      cfg.net_device = net;
      state.netActive = el.netMode.value;
      if (state.netActive === "fetch") watchFetchFailures();
      log(`Netzwerk: ${net.relay_url === "fetch" ? "Browser-Fetch" : net.relay_url} über ${net.type}`);
    } else {
      state.netActive = "off";
    }

    state.hasFilesystem = !!cfg.filesystem;
    return cfg;
  }

  // ───────────────────────────── Emulator-Steuerung ──────────────────────────

  async function start() {
    if (state.emulator) return;
    let cfg;
    el.btnStart.disabled = true;
    clearNotice();
    try {
      cfg = await buildConfig();
    } catch (e) {
      notify("err", e.message);
      el.btnStart.disabled = false;
      return;
    }

    el.screenEmpty.hidden = true;
    setView(currentProfile().console || "vga");
    setBadge("startet …", "busy");
    el.statState.textContent = "startet";
    state.fsAnnounced = false;
    log(`Starte ${currentProfile().name.split("·")[0].trim()} mit ${el.memory.value} MB RAM.`);

    const V86Class = window.V86 || window.V86Starter;
    if (!V86Class) {
      log("Fehler: libv86.js wurde nicht geladen.");
      el.btnStart.disabled = false;
      return;
    }

    const emu = new V86Class(cfg);
    state.emulator = emu;

    emu.add_listener("download-progress", (e) => {
      el.progressWrap.hidden = false;
      const name = (e.file_name || "").split("/").pop();
      const pct = e.lengthComputable && e.total ? Math.round((e.loaded / e.total) * 100) : null;
      el.progressName.textContent =
        `${name} (${e.file_index + 1}/${e.file_count}) · ${fmtBytes(e.loaded)}` +
        (e.total ? ` / ${fmtBytes(e.total)}` : "");
      el.progressPct.textContent = pct === null ? "…" : pct + " %";
      el.progressBar.style.width = (pct === null ? 100 : pct) + "%";
      el.progressBar.classList.toggle("indeterminate", pct === null);
    });

    emu.add_listener("download-error", (e) => {
      log(`Download fehlgeschlagen: ${e.file_name}`);
      setBadge("Download-Fehler", "err");
    });

    emu.add_listener("emulator-loaded", () => {
      el.progressWrap.hidden = true;
      log("Alle Abbilder geladen, CPU läuft an.");
    });

    emu.add_listener("emulator-started", () => {
      state.running = true;
      if (!state.bootedAt) state.bootedAt = performance.now();
      setBadge("läuft", "ok");
      el.statState.textContent = "läuft";
      el.btnPause.textContent = "⏸ Pause";
      setRuntimeButtons(true);
      if (el.autoStart.checked && !state.autoLaeuft) {
        runAutostart(currentProfile());
      }
    });

    emu.add_listener("emulator-stopped", () => {
      state.running = false;
      setBadge("pausiert", "busy");
      el.statState.textContent = "pausiert";
      el.btnPause.textContent = "▶ Weiter";
    });

    emu.add_listener("screen-set-size", (dims) => {
      const [w, h, bpp] = dims;
      el.statRes.textContent = bpp ? `${w}×${h} · ${bpp} bpp` : `${w}×${h} Zeichen (Text)`;
      el.screenTitle.textContent = bpp ? "Grafikmodus" : "Textmodus";
    });

    emu.add_listener("9p-attach", () => {
      if (state.fsAnnounced) return;
      state.fsAnnounced = true;
      log("9p-Dateisystem verbunden — Austauschordner in der VM: /mnt");
    });

    state.bootedAt = performance.now();
    state.lastInstr = 0;
    state.lastTick = performance.now();
    startStats();

    el.btnKill.disabled = false;
    el.btnPause.disabled = false;
    el.btnReset.disabled = false;
  }

  function setRuntimeButtons(on) {
    el.btnFullscreen.disabled = !on;
    el.btnScreenshot.disabled = !on;
    el.btnSaveState.disabled = !on;
    el.btnLoadState.disabled = !on;
    el.btnSendText.disabled = !on;
    el.btnDownloadFile.disabled = !on || !state.hasFilesystem;
    el.uploadFile.disabled = !on || !state.hasFilesystem;
    el.btnDiskSave.disabled = !on || !state.disk;
    el.btnNetUp.disabled = !on || state.netActive === "off";
    el.btnNetTest.disabled = !on || state.netActive === "off";
    setRecipesEnabled(on);
  }

  async function togglePause() {
    if (!state.emulator) return;
    if (state.running) { await state.emulator.stop(); log("Emulation pausiert."); }
    else { await state.emulator.run(); log("Emulation fortgesetzt."); }
  }

  function reset() {
    if (!state.emulator) return;
    state.emulator.restart();
    state.bootedAt = performance.now();
    log("Neustart ausgelöst.");
  }

  async function kill() {
    if (!state.emulator) return;
    if (state.disk && state.disk.persist && el.diskAutosave.checked) {
      await saveDisk();
    }
    try { await state.emulator.destroy(); } catch (e) { /* egal */ }
    state.autoAbbruch = true;
    setAutoStatus("");
    state.emulator = null;
    state.running = false;
    state.disk = null;
    stopStats();
    const textDiv = el.screenContainer.querySelector("div");
    if (textDiv) textDiv.textContent = "";
    el.screenContainer.classList.remove("active");
    el.serial.hidden = true;
    el.serial.innerHTML = "";
    el.screenEmpty.hidden = false;
    el.screenTitle.textContent = "–";
    el.progressWrap.hidden = true;
    setBadge("bereit");
    el.statState.textContent = "gestoppt";
    el.statUptime.textContent = "–";
    el.statMips.textContent = "–";
    el.statRes.textContent = "–";
    el.btnStart.disabled = false;
    el.btnPause.disabled = true;
    el.btnReset.disabled = true;
    el.btnKill.disabled = true;
    setRuntimeButtons(false);
    log("VM beendet, Speicher freigegeben.");
  }

  // ───────────────────────────── Statistik ───────────────────────────────────

  function startStats() {
    stopStats();
    state.timer = setInterval(() => {
      if (!state.emulator) return;
      el.statUptime.textContent = fmtDuration(performance.now() - state.bootedAt);
      if (!state.running) return;
      const instr = state.emulator.get_instruction_counter();
      const now = performance.now();
      const delta = instr - state.lastInstr, dt = (now - state.lastTick) / 1000;
      state.lastInstr = instr; state.lastTick = now;
      if (dt > 0 && delta >= 0) el.statMips.textContent = (delta / dt / 1e6).toFixed(1) + " MIPS";
    }, 1000);
  }

  function stopStats() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  // ───────────────────────────── Werkzeuge ───────────────────────────────────

  function screenshot() {
    const img = state.emulator && state.emulator.screen_make_screenshot();
    if (!img || !img.src) { log("Screenshot nicht möglich."); return; }
    const a = document.createElement("a");
    a.href = img.src; a.download = `browserlinux-${stamp()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    log("Screenshot gespeichert.");
  }

  async function saveState() {
    if (!state.emulator) return;
    setBadge("sichere Zustand …", "busy");
    try {
      const buf = await state.emulator.save_state();
      downloadBlob(new Blob([buf], { type: "application/octet-stream" }),
        `browserlinux-state-${currentProfile().id}-${stamp()}.bin`);
      log(`Zustand gesichert (${fmtBytes(buf.byteLength)}).`);
    } catch (e) {
      log("Zustand sichern fehlgeschlagen: " + e.message);
    }
    setBadge(state.running ? "läuft" : "pausiert", state.running ? "ok" : "busy");
  }

  async function loadStateFile(file) {
    if (!state.emulator || !file) return;
    setBadge("lade Zustand …", "busy");
    try {
      await state.emulator.restore_state(await file.arrayBuffer());
      log(`Zustand aus ${file.name} wiederhergestellt.`);
      if (!state.running) await state.emulator.run();
    } catch (e) {
      notify("err", "Zustand konnte nicht geladen werden (" + e.message +
        "). Er muss mit derselben Konfiguration erzeugt worden sein — gleiches Profil, gleicher RAM.");
    }
    setBadge(state.running ? "läuft" : "pausiert", state.running ? "ok" : "busy");
  }

  function sendText() {
    const txt = el.sendText.value;
    if (!state.emulator || !txt) return;
    sendToGuest(txt);
    log(`Getippt (${state.view === "serial" ? "COM1" : "Tastatur"}): ${txt}`);
    el.sendText.value = "";
  }

  async function uploadToVm(file) {
    if (!state.emulator || !file) return;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      await state.emulator.create_file(file.name, data);
      log(`${file.name} (${fmtBytes(file.size)}) liegt im 9p-Dateisystem — in der VM unter /mnt/${file.name}.`);
    } catch (e) {
      log("Upload fehlgeschlagen: " + e.message);
    }
    el.uploadFile.value = "";
  }

  async function downloadFromVm() {
    const path = el.downloadPath.value.trim().replace(/^\/mnt\//, "").replace(/^\//, "");
    if (!state.emulator || !path) return;
    try {
      const data = await state.emulator.read_file(path);
      downloadBlob(new Blob([data]), path.split("/").pop());
      log(`${path} aus der VM geholt (${fmtBytes(data.length)}).`);
    } catch (e) {
      log(`Datei "${path}" nicht gefunden. Pfad relativ zum 9p-Wurzelverzeichnis angeben.`);
    }
  }

  // ───────────────────────────── Verdrahtung ─────────────────────────────────

  function wire() {
    el.profile.addEventListener("change", () => onProfileChange(true));
    for (const c of [el.memory, el.vgaMemory, el.enableAudio, el.enableAcpi,
                     el.netCard, el.relayUrl]) {
      c.addEventListener("change", saveSettings);
    }
    el.diskSize.addEventListener("change", () => { saveSettings(); probeDiskSize(); });
    el.netMode.addEventListener("change", onNetModeChange);
    el.diskMode.addEventListener("change", onDiskModeChange);
    el.diskId.addEventListener("change", () => { saveSettings(); refreshDiskStatus(); });

    el.btnStart.addEventListener("click", start);
    el.btnPause.addEventListener("click", togglePause);
    el.btnReset.addEventListener("click", reset);
    el.btnKill.addEventListener("click", kill);

    el.noticeClose.addEventListener("click", clearNotice);
    el.autoStart.addEventListener("change", saveSettings);
    el.btnDiskSave.addEventListener("click", saveDisk);
    el.btnDiskDrop.addEventListener("click", dropDisk);
    el.btnNetUp.addEventListener("click", netUp);
    el.btnNetTest.addEventListener("click", netTest);

    el.btnFullscreen.addEventListener("click", () => state.emulator && state.emulator.screen_go_fullscreen());
    el.btnScreenshot.addEventListener("click", screenshot);
    el.btnSaveState.addEventListener("click", saveState);
    el.btnLoadState.addEventListener("click", () => el.stateFile.click());
    el.stateFile.addEventListener("change", () => loadStateFile(el.stateFile.files[0]));

    el.btnSendText.addEventListener("click", sendText);
    el.sendText.addEventListener("keydown", (e) => { if (e.key === "Enter") sendText(); });

    el.uploadFile.addEventListener("change", () => uploadToVm(el.uploadFile.files[0]));
    el.btnDownloadFile.addEventListener("click", downloadFromVm);
    el.downloadPath.addEventListener("keydown", (e) => { if (e.key === "Enter") downloadFromVm(); });

    el.zoom.addEventListener("change", () => {
      const s = parseFloat(el.zoom.value) || 1;
      if (state.emulator) state.emulator.screen_set_scale(s, s);
      saveSettings();
    });

    el.tabVga.addEventListener("click", () => setView("vga"));
    el.tabSerial.addEventListener("click", () => setView("serial"));

    el.customFile.addEventListener("change", async () => {
      const f = el.customFile.files[0];
      if (!f) return;
      const n = f.name.toLowerCase();
      if (n.endsWith(".iso")) el.customKind.value = "cdrom";
      else if (n.includes("bzimage") || n.endsWith(".vmlinuz")) el.customKind.value = "bzimage";
      else el.customKind.value = "hda";
      if (n.endsWith(".iso")) await analyseIso(f);
      else el.isoReport.hidden = true;
    });

    window.addEventListener("beforeunload", (e) => {
      if (state.emulator) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  function preflight() {
    if (location.protocol === "file:") {
      el.fileWarning.hidden = false;
      el.btnStart.disabled = true;
      setBadge("falsches Protokoll", "err");
      return false;
    }
    if (typeof WebAssembly !== "object") {
      notify("err", "Dieser Browser kann kein WebAssembly – ohne das geht die Emulation nicht.");
      el.btnStart.disabled = true;
      return false;
    }
    return true;
  }

  // Für die Browser-Konsole: BrowserLinux.state.emulator gibt Zugriff auf die volle v86-API.
  window.BrowserLinux = { state, log, DiskStore, IsoInfo, sendToGuest };

  fillProfiles();
  loadSettings();
  applyQuery();
  onProfileChange(false);
  onNetModeChange();
  wire();
  // Online-Build: der 64-Bit-Modus wird nicht ausgeliefert, also den Link entfernen.
  // Ausserdem keine fremde Relay-Adresse fuer anonyme Besucher vorbelegen — sonst
  // liefe deren VM-Verkehr per Klick ueber einen Drittanbieter-Relay. Der Modus
  // bleibt waehlbar (mit Warnung), nur ohne vorausgefuellten Fremd-Host.
  if (window.BL_WEB) {
    const x = document.getElementById("badge_x64");
    if (x) x.remove();
    if (/mercurywork\.shop/.test(el.relayUrl.value)) el.relayUrl.value = "";
  }
  if (preflight()) {
    log("Bereit. v86 geladen, alles läuft lokal in diesem Tab.");
  }
})();
