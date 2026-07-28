/* ==========================================================================
   clarkie.de — gemeinsames Seitenskript
   1) Datenschutz-Hinweis vor der System-Info-Seite (einheitliches Modal,
      wird zentral hier erzeugt statt in jede Seite kopiert)
   2) Aktiven Navigationspunkt markieren
   3) Jahreszahl in der Fußzeile
   ========================================================================== */
(function () {
    'use strict';

    var body = document.body;
    var root = body.getAttribute('data-root') || './';

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
        modal.classList.remove('open');
        body.style.overflow = '';
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
                  '<span>Ich habe die <a href="' + root + 'webrtc/datenschutz.html" target="_blank" ' +
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
            window.location.href = target || (root + 'webrtc/');
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

    /* ---- 2) Aktiver Navigationspunkt ------------------------------------- */
    var section = body.getAttribute('data-section');
    if (section) {
        Array.prototype.forEach.call(document.querySelectorAll('.nav a[data-nav]'), function (a) {
            if (a.getAttribute('data-nav') === section) a.classList.add('active');
        });
    }

    /* ---- 3) Jahreszahl ---------------------------------------------------- */
    Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
        el.textContent = new Date().getFullYear();
    });
})();
