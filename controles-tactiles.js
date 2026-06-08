/* ============================================================
   BLOOD RITE — CONTROLES TÁCTILES (módulo OPCIONAL e INDEPENDIENTE)
   ------------------------------------------------------------
   Este archivo NO modifica bloodrite.html. Añade un joystick
   virtual y botones de acción para jugar en móvil/tablet.

   CÓMO USARLO (cuando quieras soporte táctil):
   En bloodrite.html, antes de </body>, añade:
       <script src="controles-tactiles.js"></script>

   Funciona porque el juego lee la entrada desde eventos de
   teclado en window (G.keys[e.key]). Este módulo despacha
   KeyboardEvent sintéticos: joystick -> W/A/S/D, y botones ->
   Q (especial), E (interactuar), Espacio (pausa), Tab (mapa).
   Solo se activa en dispositivos con pantalla táctil.
   ============================================================ */
(function () {
  'use strict';
  // Solo activar si hay soporte táctil real
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouch) return;

  // ---- utilidades para simular teclas ----
  var pressed = {};
  function keyDown(k) { if (pressed[k]) return; pressed[k] = true; window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); }
  function keyUp(k) { if (!pressed[k]) return; pressed[k] = false; window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })); }
  function tap(k) { keyDown(k); setTimeout(function () { keyUp(k); }, 90); }

  // ---- estilos ----
  var css = document.createElement('style');
  css.textContent = [
    '#tc-root{position:fixed;inset:0;z-index:400;pointer-events:none;font-family:monospace;}',
    '#tc-stick{position:absolute;left:26px;bottom:26px;width:130px;height:130px;border-radius:50%;background:rgba(20,12,28,.42);border:2px solid rgba(180,120,255,.4);pointer-events:auto;touch-action:none;}',
    '#tc-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#b388ff,#3a1a6a);box-shadow:0 0 16px rgba(150,90,255,.6);}',
    '.tc-btn{position:absolute;width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;background:rgba(30,16,40,.55);border:2px solid rgba(255,255,255,.25);text-shadow:1px 1px 0 #000;}',
    '.tc-btn:active{transform:scale(.9);background:rgba(120,60,180,.6);}',
    '#tc-q{right:120px;bottom:96px;border-color:#ff8844;}',
    '#tc-e{right:34px;bottom:118px;border-color:#44ffcc;}',
    '#tc-space{right:40px;bottom:40px;border-color:#ffcc44;width:52px;height:52px;font-size:15px;}',
    '#tc-tab{right:118px;bottom:30px;border-color:#88aaff;width:52px;height:52px;font-size:15px;}',
    '#tc-lbl{position:absolute;left:50%;top:6px;transform:translateX(-50%);font-size:10px;color:#776;}'
  ].join('');
  document.head.appendChild(css);

  // ---- DOM ----
  var root = document.createElement('div');
  root.id = 'tc-root';
  root.innerHTML =
    '<div id="tc-stick"><div id="tc-knob"></div></div>' +
    '<div class="tc-btn" id="tc-q">Q</div>' +
    '<div class="tc-btn" id="tc-e">E</div>' +
    '<div class="tc-btn" id="tc-space">⏸</div>' +
    '<div class="tc-btn" id="tc-tab">🗺</div>';
  function attach() {
    document.body.appendChild(root);
    initStick();
    initButtons();
  }
  if (document.body) attach(); else window.addEventListener('DOMContentLoaded', attach);

  // ---- joystick -> WASD ----
  function initStick() {
    var stick = document.getElementById('tc-stick');
    var knob = document.getElementById('tc-knob');
    var active = false, cx = 0, cy = 0, R = 52;

    function setDir(dx, dy) {
      var mag = Math.hypot(dx, dy);
      if (mag < 14) { release(); knob.style.transform = 'translate(0,0)'; return; }
      var nx = dx / mag, ny = dy / mag;
      var cl = Math.min(mag, R);
      knob.style.transform = 'translate(' + (nx * cl) + 'px,' + (ny * cl) + 'px)';
      // zona muerta direccional (umbral 0.36 ~ permite diagonales)
      (nx < -0.36 ? keyDown : keyUp)('a');
      (nx > 0.36 ? keyDown : keyUp)('d');
      (ny < -0.36 ? keyDown : keyUp)('w');
      (ny > 0.36 ? keyDown : keyUp)('s');
    }
    function release() { keyUp('a'); keyUp('d'); keyUp('w'); keyUp('s'); }

    function start(e) { active = true; var r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); }
    function move(e) {
      if (!active) return; e.preventDefault();
      var t = e.touches ? e.touches[0] : e;
      setDir(t.clientX - cx, t.clientY - cy);
    }
    function end() { active = false; release(); knob.style.transform = 'translate(0,0)'; }

    stick.addEventListener('touchstart', start, { passive: false });
    stick.addEventListener('touchmove', move, { passive: false });
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);
  }

  // ---- botones de acción ----
  function initButtons() {
    function hold(id, key) {
      var el = document.getElementById(id);
      el.addEventListener('touchstart', function (e) { e.preventDefault(); keyDown(key); }, { passive: false });
      el.addEventListener('touchend', function (e) { e.preventDefault(); keyUp(key); });
      el.addEventListener('touchcancel', function () { keyUp(key); });
    }
    // Q especial y E interactuar: pulsación corta (el juego dispara en keydown)
    function press(id, key) {
      var el = document.getElementById(id);
      el.addEventListener('touchstart', function (e) { e.preventDefault(); tap(key); }, { passive: false });
    }
    press('tc-q', 'q');
    press('tc-e', 'e');
    press('tc-space', ' ');
    press('tc-tab', 'Tab');
  }
})();
