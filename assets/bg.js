/* ==========================================================================
   clarkie.de — Partikel-Hintergrund der Startseite
   Behält die Idee der Originalseite bei: Punkte, Verbindungslinien und ein
   Bereich rund um die Maus, in dem alles hell aufleuchtet.
   Neu: Farben kommen aus dem Design-System (CSS-Variablen), Nachbarschafts-
   suche über ein Raster statt O(n^3) — läuft dadurch auch auf dem Handy.
   ========================================================================== */
(function () {
    'use strict';

    var canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var LINK_DIST = 130;      // max. Abstand für eine Verbindungslinie
    var MOUSE_RADIUS = 190;   // Leuchtradius um den Zeiger
    var DENSITY = 16000;      // ein Punkt je X Pixel Fläche

    var dots = [], w = 0, h = 0, dpr = 1;
    var mouseX = -9999, mouseY = -9999, hovered = false;
    var cellSize = LINK_DIST, cols = 0, rows = 0, grid = [];
    var colDot = '255,255,255', colLink = '47,187,110';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function rgbOf(cssColor, fallback) {
        var probe = document.createElement('span');
        probe.style.color = cssColor;
        document.body.appendChild(probe);
        var v = getComputedStyle(probe).color;
        probe.remove();
        var m = v.match(/(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
        return m ? m[1] + ',' + m[2] + ',' + m[3] : fallback;
    }

    function readTheme() {
        var s = getComputedStyle(document.documentElement);
        colDot = rgbOf(s.getPropertyValue('--text').trim() || '#d8d8d8', '216,216,216');
        colLink = rgbOf(s.getPropertyValue('--up').trim() || '#2fbb6e', '47,187,110');
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.max(1, Math.ceil(w / cellSize));
        rows = Math.max(1, Math.ceil(h / cellSize));
        seed();
    }

    function seed() {
        var target = Math.min(220, Math.max(40, Math.round((w * h) / DENSITY)));
        dots = [];
        for (var i = 0; i < target; i++) {
            dots.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.28,
                vy: (Math.random() - 0.5) * 0.28,
                r: Math.random() * 1.8 + 0.7
            });
        }
    }

    function buildGrid() {
        grid = new Array(cols * rows);
        for (var i = 0; i < grid.length; i++) grid[i] = null;
        for (var d = 0; d < dots.length; d++) {
            var dot = dots[d];
            var cx = Math.min(cols - 1, Math.max(0, Math.floor(dot.x / cellSize)));
            var cy = Math.min(rows - 1, Math.max(0, Math.floor(dot.y / cellSize)));
            var k = cy * cols + cx;
            (grid[k] || (grid[k] = [])).push(dot);
        }
    }

    /* Nähe zur Maus, 0..1 — steuert Helligkeit von Punkten und Linien. */
    function glow(x, y) {
        if (!hovered) return 0;
        var dist = Math.hypot(x - mouseX, y - mouseY);
        return dist > MOUSE_RADIUS ? 0 : 1 - dist / MOUSE_RADIUS;
    }

    function step() {
        for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            d.x += d.vx;
            d.y += d.vy;
            if (d.x < 0) { d.x = 0; d.vx *= -1; }
            if (d.x > w) { d.x = w; d.vx *= -1; }
            if (d.y < 0) { d.y = 0; d.vy *= -1; }
            if (d.y > h) { d.y = h; d.vy *= -1; }
        }
    }

    function drawLinks() {
        buildGrid();
        ctx.lineWidth = 1;
        for (var cy = 0; cy < rows; cy++) {
            for (var cx = 0; cx < cols; cx++) {
                var cell = grid[cy * cols + cx];
                if (!cell) continue;
                /* nur rechte/untere Nachbarzellen -> jedes Paar genau einmal */
                for (var n = 0; n < NEIGHBOURS.length; n++) {
                    var nx = cx + NEIGHBOURS[n][0], ny = cy + NEIGHBOURS[n][1];
                    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                    var other = grid[ny * cols + nx];
                    if (!other) continue;
                    var same = (nx === cx && ny === cy);
                    for (var a = 0; a < cell.length; a++) {
                        for (var b = same ? a + 1 : 0; b < other.length; b++) {
                            link(cell[a], other[b]);
                        }
                    }
                }
            }
        }
    }

    var NEIGHBOURS = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

    function link(p, q) {
        var dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (dist > LINK_DIST) return;
        var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        var near = glow(mx, my);
        var alpha = (1 - dist / LINK_DIST) * (0.05 + near * 0.55);
        if (alpha <= 0.012) return;
        ctx.strokeStyle = 'rgba(' + colLink + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
    }

    function drawDots() {
        for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            var near = glow(d.x, d.y);
            var alpha = 0.16 + near * 0.84;
            ctx.fillStyle = near > 0.35
                ? 'rgba(' + colLink + ',' + alpha.toFixed(3) + ')'
                : 'rgba(' + colDot + ',' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r + near * 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function frame() {
        ctx.clearRect(0, 0, w, h);
        if (!reduced) step();
        drawLinks();
        drawDots();
        requestAnimationFrame(frame);
    }

    function pointer(e) {
        var t = e.touches ? e.touches[0] : e;
        mouseX = t.clientX;
        mouseY = t.clientY;
        hovered = true;
    }

    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('touchmove', pointer, { passive: true });
    window.addEventListener('pointerleave', function () { hovered = false; });
    window.addEventListener('resize', resize);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);

    readTheme();
    resize();
    frame();
})();
