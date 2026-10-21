/* ==========================================================================
   clarkie.de — gemeinsames Seitenskript
   0) Seitenleiste (☰ links oben) — auf JEDER Seite gleich, eine Quelle
   1) Datenschutz-Hinweis vor der System-Info-Seite (einheitliches Modal,
      wird zentral hier erzeugt statt in jede Seite kopiert)
   3) Jahreszahl in der Fußzeile
   ========================================================================== */
(function () {
    'use strict';

    var body = document.body;

    /* ---- 0) Seitenleiste ------------------------------------------------- */
    /* Ziele sind die Subdomains; der aktuelle Bereich (body data-section)
       wird markiert. Die Startseite hat zusätzlich ihr Klapp-Menü.         */
    var NAV = [
        ['start',  'https://clarkie.de/',        '🏠',       'Start',            'Startseite'],
        ['filme',  'https://filme.clarkie.de/',  '🎬',       'Filme',            'Empfehlungen'],
        ['system', 'https://webrtc.clarkie.de/', '🖥️', 'System-Info',      'Browser-Analyse'],
        ['linux',  'https://linux.clarkie.de/',  '🐧',       'BrowserLinux',     'Linux im Browser-Tab'],
        ['split',  'https://split.clarkie.de/',  '💸',       'Expense Splitter', 'split.clarkie.de'],
        ['code',   'https://github.com/LichtClark/LichtClark.github.io', '📦', 'Quellcode', 'GitHub']
    ];
    (function buildDrawer() {
        Array.prototype.forEach.call(document.querySelectorAll('nav.nav'), function (n) {
            n.parentNode.removeChild(n);                 // alte Leisten-Platzhalter weg
        });
        var section = body.getAttribute('data-section');

        var btn = document.createElement('button');
        btn.className = 'drawer-btn';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', 'drawer');
        btn.setAttribute('aria-label', 'Menü öffnen');
        btn.innerHTML = '<span></span><span></span><span></span>';

        var scrim = document.createElement('div');
        scrim.className = 'scrim';

        var drawer = document.createElement('aside');
        drawer.className = 'drawer';
        drawer.id = 'drawer';
        drawer.setAttribute('aria-label', 'Seitenleiste');
        drawer.innerHTML = '<div class="drawer-h">Navigation</div>' +
            NAV.map(function (n) {
                return '<a class="link-row' + (n[0] === section ? ' active' : '') + '" href="' + n[1] + '">' +
                       '<span class="link-ico">' + n[2] + '</span>' +
                       '<span class="link-mid"><span class="link-title">' + n[3] + '</span>' +
                       '<span class="link-meta">' + n[4] + '</span></span></a>';
            }).join('') +
            '<div class="drawer-foot">' +
              '<a href="https://webrtc.clarkie.de/datenschutz.html">Datenschutz</a>' +
              '<a href="mailto:dasho@mail.clarkie.de">Kontakt</a>' +
              '<span>&copy; <span data-year></span> Clarkie</span>' +
            '</div>';

        body.insertBefore(drawer, body.firstChild);
        body.insertBefore(scrim, drawer);
        body.insertBefore(btn, scrim);

        function setDrawer(open) {
            drawer.classList.toggle('open', open);
            scrim.classList.toggle('open', open);
            btn.setAttribute('aria-expanded', String(open));
            btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
        }
        btn.addEventListener('click', function () { setDrawer(!drawer.classList.contains('open')); });
        scrim.addEventListener('click', function () { setDrawer(false); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });
    })();

    /* ---- 1) Consent-Modal ------------------------------------------------ */
    var KEY = 'clarkie.consent.webrtc';
    var gates = document.querySelectorAll('[data-consent]');
    var modal = null, check = null, go = null, target = null;

    function accepted() {
        try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
    }
    function remember() {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* Private Mode */ }
    }
    function close() {
        if (!modal) return;
        var wasEntry = modal.getAttribute('data-entry') === '1';
        modal.classList.remove('open');
        modal.removeAttribute('data-entry');
        body.style.overflow = '';
        /* Beim Direktaufruf ohne Zustimmung: zurück zur Startseite. */
        if (wasEntry && !accepted()) window.location.href = 'https://clarkie.de/';
    }

    /* Wird die Seite direkt aufgerufen (Lesezeichen, getippte URL), war der Weg
       über den Link mit data-consent nicht dabei. Dann fragt die Seite selbst.
       Bewusst kein Redirect: die Seite bleibt erreichbar, wer ablehnt geht
       zurück zur Startseite. */
    function askOnLoad() {
        if (accepted()) return;
        if (!modal) build();
        target = null;
        check.checked = false;
        go.disabled = true;
        modal.setAttribute('data-entry', '1');
        modal.classList.add('open');
        body.style.overflow = 'hidden';
    }

    function build() {
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'consentModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML =
            '<div class="modal-box">' +
              '<div class="modal-h">' +
                '<span>&#9888; Hinweis zur Datenerhebung</span>' +
                '<button class="close" data-close aria-label="Schließen">×</button>' +
              '</div>' +
              '<div class="modal-body">' +
                '<p>Die folgende Seite liest Informationen über dein Gerät aus — ' +
                'Betriebssystem, Grafikkarte, Bildschirm, Browser-Details und den ungefähren ' +
                'Standort über deine IP-Adresse.</p>' +
                '<p style="color:var(--dim);font-size:.78rem">Die Auswertung passiert vollständig ' +
                'in deinem Browser. Es wird nichts auf einem Server gespeichert.</p>' +
                '<label class="consent-row" for="consentCheck">' +
                  '<input type="checkbox" id="consentCheck">' +
                  '<span>Ich habe die <a href="https://webrtc.clarkie.de/datenschutz.html" target="_blank" ' +
                  'rel="noopener">Datenschutzerklärung</a> gelesen und akzeptiere sie.</span>' +
                '</label>' +
                '<button class="btn btn-primary btn-full" id="consentGo" disabled>' +
                'Bestätigen und fortfahren</button>' +
              '</div>' +
            '</div>';
        body.appendChild(modal);

        check = modal.querySelector('#consentCheck');
        go = modal.querySelector('#consentGo');

        check.addEventListener('change', function () { go.disabled = !check.checked; });
        go.addEventListener('click', function () {
            if (!check.checked) return;
            remember();
            close();
            /* Ohne target sind wir schon am Ziel — dann nur schließen. */
            if (target) window.location.href = target;
        });
        modal.addEventListener('click', function (ev) { if (ev.target === modal) close(); });
        modal.querySelector('[data-close]').addEventListener('click', close);
        document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    }

    if (gates.length) {
        Array.prototype.forEach.call(gates, function (link) {
            link.addEventListener('click', function (ev) {
                if (accepted()) return;              // schon zugestimmt -> normal folgen
                ev.preventDefault();
                if (!modal) build();
                target = link.getAttribute('href');
                check.checked = false;
                go.disabled = true;
                modal.classList.add('open');
                body.style.overflow = 'hidden';
            });
        });
    }

    if (body.hasAttribute('data-consent-required')) askOnLoad();

    /* ---- 3) Jahreszahl ---------------------------------------------------- */
    Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
        el.textContent = new Date().getFullYear();
    });
})();
