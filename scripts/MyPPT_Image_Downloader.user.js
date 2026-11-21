// ==UserScript==
// @name         MyPPT Image Downloader
// @namespace    https://github.com/jrmzchi/assets
// @version      1.6.4
// @description  iPhone image gallery with native long-press save + auto age confirm + date password then 1069 fallback
// @match        https://myppt.cc/*
// @match        https://*.myppt.cc/*
// @match        https://lurl.cc/*
// @match        https://*.lurl.cc/*
// @updateURL    https://raw.githubusercontent.com/jrmzchi/assets/main/scripts/MyPPT_Image_Downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/jrmzchi/assets/main/scripts/MyPPT_Image_Downloader.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('myppt-download-ui')) return;

  // ========== 自動年齡驗證 ==========
  const AGE_TEXTS = ['我已年滿', '年滿18', '已滿18', '進入', '確認', '同意', 'Yes', 'Enter', 'I am'];
  function autoAgeConfirm() {
    const candidates = [...document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"], span')];
    for (const el of candidates) {
      if (!el.offsetParent && el.style.display === 'none') continue;
      const text = (el.innerText || el.textContent || el.value || '').replace(/\s+/g, '').trim();
      if (!text) continue;
      if (AGE_TEXTS.some(t => text.includes(t)) && el.getClientRects().length && !el.disabled) {
        console.log('[MyPPT] 自動點年齡確認:', text);
        el.click();
        return true;
      }
    }
    return false;
  }
  autoAgeConfirm();
  // =================================

  const unlockStyle = document.createElement('style');
  unlockStyle.textContent = 'img,a,video{-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important}';
  document.documentElement.appendChild(unlockStyle);
  ['contextmenu','selectstart','copy','dragstart'].forEach(type => {
    window.addEventListener(type, event => {
      if (event.target?.closest?.('#myppt-download-ui')) return;
      event.stopImmediatePropagation();
    }, true);
  });

  // ========== 密碼處理：先日期，失敗後試 1069 ==========
  let lastAutoValue = '';
  const baseKey = 'myppt:pw:' + location.origin + location.pathname + location.search;
  const dateTriedKey = baseKey + ':date';
  const fallbackTriedKey = baseKey + ':1069';

  function getTried(key) {
    try { return sessionStorage.getItem(key) === '1'; } catch (_) { return false; }
  }
  function setTried(key) {
    try { sessionStorage.setItem(key, '1'); } catch (_) {}
  }

  function findPasswordField() {
    return [...document.querySelectorAll('input')].find(el =>
      !el.disabled && !el.readOnly && el.getClientRects().length &&
      (el.type === 'password' || /密碼|password|passcode/i.test(
        [el.placeholder, el.name, el.id, el.getAttribute('aria-label')].join(' ')
      ))
    );
  }

  function findSubmitButton(scope) {
    const buttons = [...scope.querySelectorAll('button,input[type="submit"],input[type="button"]')];
    return buttons.find(el => {
      const label = (el.innerText || el.textContent || el.value || '').replace(/\s+/g,'').trim();
      return /^(送出|提交|確認|解鎖|確定|立即解密|解密|Submit|Unlock)$/i.test(label) && !el.disabled && el.getClientRects().length;
    });
  }

  function submitPassword(field, password) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(field, password);
    else field.value = password;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    lastAutoValue = password;

    const form = field.closest('form');
    const scope = form || field.closest('section,article,.card,.container,.modal') || document;
    const submit = findSubmitButton(scope);
    setTimeout(() => {
      if (submit) submit.click();
      else if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
      else {
        // Some LURL password dialogs listen for Enter instead of using a form.
        field.focus();
        for (const type of ['keydown', 'keypress', 'keyup']) {
          field.dispatchEvent(new KeyboardEvent(type, {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
            bubbles: true, cancelable: true
          }));
        }
      }
    }, 150);
  }

  function tryDatePassword() {
    if (getTried(dateTriedKey)) return false;
    const text = document.body?.innerText || '';
    const match = text.match(/上傳日期\s*[：:]\s*\d{4}[-/](\d{1,2})[-/](\d{1,2})(?=\s|$)/);
    if (!match) return false;
    const month = Number(match[1]), day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const password = String(month).padStart(2, '0') + String(day).padStart(2, '0');
    const field = findPasswordField();
    if (!field) return false;
    console.log('[MyPPT] 嘗試日期密碼:', password);
    setTried(dateTriedKey);
    submitPassword(field, password);
    return true;
  }

  function tryFallbackPassword() {
    if (getTried(fallbackTriedKey)) return false;
    const field = findPasswordField();
    if (!field) return false;
    console.log('[MyPPT] 日期密碼失敗，嘗試固定密碼 1069');
    setTried(fallbackTriedKey);
    submitPassword(field, '1069');
    return true;
  }

  function handlePassword() {
    // 如果還沒試過日期密碼，先試日期
    if (!getTried(dateTriedKey)) {
      tryDatePassword();
      return;
    }
    // 已經試過日期，且還看得到密碼欄，就試 1069
    if (!getTried(fallbackTriedKey) && findPasswordField()) {
      // 稍微延遲，避免跟第一次提交衝突
      setTimeout(tryFallbackPassword, 800);
    }
  }

  // 初始執行
  setTimeout(handlePassword, 400);

  // 用 MutationObserver 持續監控（頁面可能動態載入密碼框）
  let fillQueued = false;
  const fillObserver = new MutationObserver(() => {
    if (fillQueued) return;
    fillQueued = true;
    setTimeout(() => {
      fillQueued = false;
      autoAgeConfirm();
      handlePassword();
    }, 300);
  });
  fillObserver.observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('pageshow', () => setTimeout(handlePassword, 400));
  // =====================================================

  const urls = new Map();
  const isImage = u => /\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(u);
  function add(value) {
    if (!value || /^(?:data|blob|javascript):/i.test(value)) return;
    try {
      const url = new URL(value, location.href);
      if (/^https?:$/.test(url.protocol) && isImage(url.href)) urls.set(url.href, true);
    } catch {}
  }
  function scan() {
    document.querySelectorAll('img:not(#myppt-download-ui img)').forEach(img => {
      [img.currentSrc,img.src,...['data-src','data-original','data-lazy-src','data-url','data-image'].map(k => img.getAttribute(k))].forEach(add);
      [img.getAttribute('srcset'),img.getAttribute('data-srcset')].forEach(srcset => {
        (srcset || '').split(',').forEach(part => add(part.trim().split(/\s+/)[0]));
      });
    });
    document.querySelectorAll('source[srcset]').forEach(el => {
      el.getAttribute('srcset').split(',').forEach(part => add(part.trim().split(/\s+/)[0]));
    });
    document.querySelectorAll('a[href],link[rel="preload"][as="image"]').forEach(el => add(el.href));
    document.querySelectorAll('[style*="background"]').forEach(el => {
      const match = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) add(match[1]);
    });
    return [...urls.keys()];
  }

  const root = document.createElement('div');
  root.id = 'myppt-download-ui';
  const shadow = root.attachShadow({mode:'open'});
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box}
      button{font:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}
      #fab{position:fixed;right:18px;bottom:calc(env(safe-area-inset-bottom) + 20px);z-index:2147483645;border:0;border-radius:999px;padding:14px 18px;background:#2563eb;color:#fff;font:600 14px -apple-system,system-ui;box-shadow:0 8px 26px #0004}
      #galleryScreen{display:none;position:fixed;inset:0;z-index:2147483646;background:#0009;color:#0f172a;font:14px -apple-system,system-ui}
      #galleryScreen.open{display:block}
      #sheet{position:absolute;bottom:0;left:0;right:0;max-height:88dvh;display:flex;flex-direction:column;background:#f8fafc;border-radius:22px 22px 0 0;padding:16px 14px calc(env(safe-area-inset-bottom) + 14px)}
      #galleryScreen .top{display:flex;align-items:center;gap:10px;padding:0 0 14px;background:transparent;border:0}
      #galleryScreen .top strong{font-size:19px;letter-spacing:-.4px;flex:1}
      #galleryScreen .top .tools{display:flex;gap:8px;align-items:center}
      #galleryScreen .top button{display:grid;place-items:center;width:36px;height:36px;padding:0;background:#e9eef5;border:0;border-radius:11px;color:#334155;font-size:20px}
      #galleryScreen #count{font-size:12px;color:#64748b;background:#edf2f7;padding:5px 9px;border-radius:999px;font-variant-numeric:tabular-nums}
      #handle{width:36px;height:5px;border-radius:99px;background:#cbd5e1;margin:-6px auto 16px}
      #grid{overflow:auto;min-height:100px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-content:start}
      .tile{border:0;border-radius:12px;overflow:hidden;aspect-ratio:1;background:#e2e8f0;padding:0}
      .tile img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:auto;-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important}
      #empty{grid-column:1/-1;padding:35px 15px;text-align:center;color:#64748b}
      #sheetHint{font-size:12px;color:#64748b;margin:12px 0 0;text-align:center}
      #viewer{display:none;position:fixed;inset:0;z-index:2147483647;background:#0b0b0d;color:#fff;flex-direction:column;font:14px -apple-system,system-ui}
      #viewer.open{display:flex}
      #viewer .top{background:#141416;color:#fff;border-color:#29292e}
      #viewer .top button{background:#2c2c30;color:#fff}
      #position{font-variant-numeric:tabular-nums;font-size:14px;color:#d1d5db}
      #imageArea{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:8px;overflow:auto}
      #imageArea img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important;pointer-events:auto!important}
      #bottom{display:flex;align-items:center;gap:12px;padding:12px 16px calc(env(safe-area-inset-bottom) + 12px);background:#141416}
      #bottom button{background:#303036;color:white;border:0;border-radius:12px;padding:12px 16px;min-width:82px}
      #bottom button:disabled{opacity:.3}
      #hint{flex:1;text-align:center;font-size:12px;color:#cbd5e1}
    </style>
    <button id="fab" type="button">📷 圖片</button>
    <section id="galleryScreen" aria-label="圖片清單"><div id="sheet">
      <div id="handle"></div>
      <header class="top"><strong>圖片</strong><span id="count">0 張</span><div class="tools"><button id="refresh" type="button" aria-label="重新掃描" title="重新掃描">↻</button><button id="close" type="button" aria-label="關閉" title="關閉">×</button></div></header>
      <div id="grid"></div>
      <p id="sheetHint">點擊縮圖檢視原圖 · 長按圖片儲存</p>
    </div></section>
    <section id="viewer" aria-label="原圖檢視">
      <header class="top"><button id="back" type="button">‹ 返回</button><strong>原圖檢視</strong><span id="position">1 / 1</span></header>
      <div id="imageArea"></div>
      <footer id="bottom"><button id="prev" type="button">‹ 上一張</button><span id="hint">長按圖片儲存</span><button id="next" type="button">下一張 ›</button></footer>
    </section>
  `;
  document.documentElement.appendChild(root);
  const $ = id => shadow.getElementById(id);
  let list = [];
  let index = 0;

  function renderGrid() {
    list = scan();
    $('count').textContent = list.length + ' 張';
    $('grid').replaceChildren();
    if (!list.length) {
      const empty = document.createElement('div');
      empty.id = 'empty';
      empty.textContent = '尚未找到圖片，請先捲動原網頁載入圖片，再點重新掃描。';
      $('grid').append(empty);
      return;
    }
    list.forEach((url,i) => {
      const tile = document.createElement('button');
      tile.className = 'tile'; tile.type = 'button';
      tile.setAttribute('aria-label','檢視第 '+(i+1)+' 張圖片');
      const img = document.createElement('img');
      img.src = url; img.loading = 'lazy'; img.alt = '';
      tile.append(img);
      tile.onclick = () => openViewer(i);
      $('grid').append(tile);
    });
  }
  function showImage() {
    const url = list[index];
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '原圖，長按可嘗試儲存';
    img.draggable = true;
    img.style.webkitTouchCallout = 'default';
    $('imageArea').replaceChildren(img);
    $('position').textContent = (index+1) + ' / ' + list.length;
    $('prev').disabled = index === 0;
    $('next').disabled = index === list.length-1;
  }
  function openViewer(i) {
    index = i;
    showImage();
    $('viewer').classList.add('open');
  }
  function move(delta) {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    index = next;
    showImage();
  }
  $('fab').onclick = () => { renderGrid(); $('galleryScreen').classList.add('open'); };
  $('refresh').onclick = renderGrid;
  $('close').onclick = () => $('galleryScreen').classList.remove('open');
  $('galleryScreen').addEventListener('click', e => { if (e.target === $('galleryScreen')) $('galleryScreen').classList.remove('open'); });
  $('back').onclick = () => { $('viewer').classList.remove('open'); $('imageArea').replaceChildren(); };
  $('prev').onclick = () => move(-1);
  $('next').onclick = () => move(1);

  let touchStart = null;
  $('imageArea').addEventListener('touchstart', e => {
    touchStart = e.touches.length === 1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : null;
  },{passive:true});
  $('imageArea').addEventListener('touchend', e => {
    if (!touchStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)*1.5) move(dx < 0 ? 1 : -1);
  },{passive:true});
  $('imageArea').addEventListener('touchcancel',() => { touchStart = null; });
})();
