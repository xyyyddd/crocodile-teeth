/* =========================================================
   鳄鱼拔牙 · 网页版逻辑
   规则：上下两排牙都能按；想按几颗按几颗；只有一颗机关牙，
        按到的人被咬出局。没有回合、没有玩家编号。
   ========================================================= */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var upperTeethGroup = document.getElementById('upperTeeth');
  var lowerTeethGroup = document.getElementById('lowerTeeth');
  var croc = document.getElementById('croc');
  var stage = document.getElementById('stage');
  var stageHint = document.getElementById('stageHint');
  var safeCountEl = document.getElementById('safeCount');
  var remainCountEl = document.getElementById('remainCount');
  var remainPill = document.getElementById('remainPill');
  var biteText = document.getElementById('biteText');
  var flash = document.getElementById('flash');
  var resultMask = document.getElementById('resultMask');
  var resultCount = document.getElementById('resultCount');
  var teethSeg = document.getElementById('teethSeg');
  var restartBtn = document.getElementById('restartBtn');
  var soundBtn = document.getElementById('soundBtn');
  var againBtn = document.getElementById('againBtn');
  var topBtn = document.getElementById('topBtn');

  // 上颚下缘（牙根所在线）与下颚上缘（牙根所在线）
  // 上颚下缘 / 下颚上缘（牙齿严格长在这两条线上）
  var UPPER_LIP = { x1: 150, y1: 232, x2: 452, y2: 241 };
  var LOWER_LIP = { x1: 150, y1: 332, x2: 452, y2: 300 };

  var state = {
    total: 20,
    cells: [],
    trapIndex: -1,
    phase: 'idle',
    pressed: 0,
    safe: 0
  };

  /* ---------------- 音效 ---------------- */
  var audioCtx = null;
  var soundOn = true;

  function ensureAudio() {
    if (!soundOn) return null;
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  function tone(freq, to, dur, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
  }

  function playClick() { tone(760, 520, 0.07, 'triangle', 0.05); }
  function playChomp() {
    tone(180, 60, 0.26, 'square', 0.09);
    setTimeout(function () { tone(90, 45, 0.3, 'sawtooth', 0.07); }, 40);
  }

  /* ---------------- 建牙 ---------------- */
  function toothPath(w, h, pointsDown) {
    // 圆润的“小胖牙”：根部平、前端半圆，看起来更呆萌
    var half = w / 2;
    var round = h * 0.62;
    var d = '';
    if (pointsDown) {
      d = 'M ' + (-half) + ' 0 L ' + (-half) + ' ' + round +
          ' A ' + half + ' ' + (h - round) + ' 0 0 0 ' + half + ' ' + round +
          ' L ' + half + ' 0 Z';
    } else {
      d = 'M ' + (-half) + ' 0 L ' + (-half) + ' ' + (-round) +
          ' A ' + half + ' ' + (h - round) + ' 0 0 1 ' + half + ' ' + (-round) +
          ' L ' + half + ' 0 Z';
    }
    return d;
  }

  function clearTeeth() {
    upperTeethGroup.innerHTML = '';
    lowerTeethGroup.innerHTML = '';
  }

  function buildRow(group, count, lip, pointsDown, label) {
    var half = Math.max(1, Math.round(state.total / 2));
    var perRow = group === upperTeethGroup ? half : (state.total - half);
    if (count !== perRow) count = perRow;

    var dx = lip.x2 - lip.x1;
    var dy = lip.y2 - lip.y1;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    var w = Math.max(18, Math.min(28, Math.round(280 / count * 0.8)));
    var h = Math.max(26, Math.min(44, Math.round(w * 1.5)));
    var step = (dx * 0.88) / Math.max(1, count - 1);
    var hitW = Math.max(w + 8, Math.abs(step) * 1.0);

    for (var i = 0; i < count; i++) {
      var t = count > 1 ? i / (count - 1) : 0;
      var tt = 0.06 + t * 0.88;   // 上下两排对称分布
      var x = lip.x1 + dx * tt;
      var y = lip.y1 + dy * tt;

      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'tooth-wrap' + (pointsDown ? '' : ' down'));
      g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + (pointsDown ? angle : angle + 180).toFixed(2) + ')');

      // 透明整格点击区（手机上更好点）
      var hit = document.createElementNS(SVG_NS, 'rect');
      hit.setAttribute('class', 'hit');
      hit.setAttribute('x', (-hitW / 2).toFixed(1));
      hit.setAttribute('width', hitW.toFixed(1));
      // 点击区覆盖整颗牙（下排牙整体旋转 180°，所以统一用同一段局部坐标）
      hit.setAttribute('y', (-18).toFixed(1));
      hit.setAttribute('height', (h + 36).toFixed(1));
      g.appendChild(hit);

      var dimple = document.createElementNS(SVG_NS, 'ellipse');
      dimple.setAttribute('class', 'dimple');
      dimple.setAttribute('cx', '0');
      dimple.setAttribute('cy', '1.5');
      dimple.setAttribute('rx', (w * 0.4).toFixed(1));
      dimple.setAttribute('ry', '3.2');
      g.appendChild(dimple);

      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'tooth' + (pointsDown ? '' : ' down'));
      path.setAttribute('d', toothPath(w, h, true));  // 上下牙共用同一椭圆牙形
      if (pointsDown) path.setAttribute('filter', 'url(#fTooth)');
      g.appendChild(path);
      group.appendChild(g);

      state.cells.push({ el: path, wrap: g, index: state.cells.length, pressed: false, pointsDown: pointsDown });
    }
  }

  /* ---------------- 开始一局 ---------------- */
  function applyViewBox() {
    var stageW = stage.clientWidth || window.innerWidth;
    if (stageW < 520) {
      // 手机：拉近到头部与嘴巴，牙齿更大更好点
      croc.setAttribute('viewBox', '110 80 380 300');
    } else {
      croc.setAttribute('viewBox', '0 0 700 470');
    }
  }

  function startRound() {
    clearTeeth();
    state.cells = [];
    state.pressed = 0;
    state.safe = 0;
    state.phase = 'playing';

    croc.classList.remove('bitten');
    stage.classList.remove('shake');
    biteText.classList.remove('show');
    flash.classList.remove('show');
    resultMask.hidden = true;

    buildRow(upperTeethGroup, 0, UPPER_LIP, true, '上排');
    buildRow(lowerTeethGroup, 0, LOWER_LIP, false, '下排');

    // 机关牙随机落在任意一颗牙上
    state.trapIndex = Math.floor(Math.random() * state.cells.length);

    updateHud();
    stageHint.textContent = '上下两排都能按 · 想按几颗按几颗';
    cursor.row = 0;
    cursor.col = 0;
  }

  /* ---------------- 交互 ---------------- */
  function pressCell(cell) {
    if (!cell || state.phase !== 'playing' || cell.pressed) return;
    cell.pressed = true;
    state.pressed++;

    var isTrap = cell.index === state.trapIndex;
    if (isTrap) {
      // 机关牙：先显示被按下去的反馈，再合嘴
      cell.el.classList.add('pressed');
      cell.wrap.classList.add('pressed');
      bite();
    } else {
      state.safe++;
      cell.el.classList.add('pressed');
      cell.wrap.classList.add('pressed');
      playClick();
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      updateHud();
    }
  }

  var cursor = { row: 0, col: 0 };

  function rowCounts() {
    var up = 0;
    state.cells.forEach(function (c) { if (c.pointsDown) up++; });
    return { up: up, down: state.cells.length - up };
  }

  function cursorCell() {
    var rc = rowCounts();
    if (cursor.row === 0) return state.cells[Math.min(cursor.col, rc.up - 1)];
    return state.cells[rc.up + Math.min(cursor.col, rc.down - 1)];
  }

  function refreshCursor() {
    state.cells.forEach(function (c) { c.wrap.classList.remove('cursor'); });
    var cell = cursorCell();
    if (cell) cell.wrap.classList.add('cursor');
  }

  function moveCursor(dRow, dCol) {
    var rc = rowCounts();
    cursor.row = Math.max(0, Math.min(1, cursor.row + dRow));
    var max = cursor.row === 0 ? rc.up : rc.down;
    cursor.col = Math.max(0, Math.min(max - 1, cursor.col + dCol));
    refreshCursor();
  }

  function bite() {
    state.phase = 'bite';
    playChomp();
    if (navigator.vibrate) { try { navigator.vibrate([40, 60, 90]); } catch (e) {} }
    stage.classList.add('shake');
    flash.classList.add('show');
    croc.classList.add('bitten');
    biteText.classList.add('show');
    updateHud();

    setTimeout(function () {
      resultCount.textContent = state.pressed;
      resultMask.hidden = false;
      state.phase = 'result';
    }, 900);
  }

  function updateHud() {
    var remaining = state.cells.length - state.pressed;
    safeCountEl.textContent = state.safe;
    remainCountEl.textContent = remaining;
    var low = remaining <= 4 && state.phase !== 'result';
    remainPill.classList.toggle('low', low);
    if (state.phase === 'playing') {
      stageHint.textContent = low
        ? ('💓 只剩 ' + remaining + ' 颗，心跳加速…')
        : '上下两排都能按 · 想按几颗按几颗';
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function onToothActivate(e) {
    var wrap = e.target.closest ? e.target.closest('.tooth-wrap') : null;
    if (!wrap) return;
    var cell = state.cells.filter(function (c) { return c.wrap === wrap; })[0];
    pressCell(cell);
    if (e.type === 'click') {
      if (wrap.blur) wrap.blur();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    e.preventDefault();
  }

  croc.addEventListener('click', onToothActivate);

  stage.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft') { moveCursor(0, -1); e.preventDefault(); return; }
    if (k === 'ArrowRight') { moveCursor(0, 1); e.preventDefault(); return; }
    if (k === 'ArrowUp') { moveCursor(-1, 0); e.preventDefault(); return; }
    if (k === 'ArrowDown') { moveCursor(1, 0); e.preventDefault(); return; }
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      pressCell(cursorCell());
      e.preventDefault();
    }
  });

  teethSeg.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    Array.prototype.forEach.call(teethSeg.querySelectorAll('button'), function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    state.total = Number(btn.getAttribute('data-count'));
    startRound();
  });

  restartBtn.addEventListener('click', function () { ensureAudio(); startRound(); });
  againBtn.addEventListener('click', function () { ensureAudio(); startRound(); });
  topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊 音效开' : '🔇 音效关';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) { ensureAudio(); playClick(); }
  });

  // 首次交互时解锁音频（浏览器自动播放策略）
  window.addEventListener('pointerdown', function once() {
    ensureAudio();
    window.removeEventListener('pointerdown', once);
  }, { once: true });

  applyViewBox();
  window.addEventListener('resize', applyViewBox);
  startRound();
})();