// ==UserScript==
// @name         MyPPT Image Downloader
// @namespace    https://github.com/jrmzchi/assets
// @version      1.3.5
// @description  Mobile-friendly image gallery and downloads for visible MyPPT/LURL pages
// @match        https://myppt.cc/*
// @match        https://*.myppt.cc/*
// @match        https://lurl.cc/*
// @match        https://*.lurl.cc/*
// @updateURL    https://raw.githubusercontent.com/jrmzchi/assets/main/scripts/MyPPT_Image_Downloader.meta.js
// @downloadURL  https://raw.githubusercontent.com/jrmzchi/assets/main/scripts/MyPPT_Image_Downloader.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      *.myppt.cc
// @connect      *.lurl.cc
// ==/UserScript==

(() => {
  'use strict';
  if (window.__mypptDownloaderV2) return;
  window.__mypptDownloaderV2 = true;
  const unlockStyle = document.createElement('style');
  unlockStyle.textContent = 'img,a,video{-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important}';
  document.documentElement.appendChild(unlockStyle);
  ['contextmenu','selectstart','copy','dragstart'].forEach(type => {
    window.addEventListener(type, event => {
      if (event.target?.closest?.('#myppt-download-ui')) return;
      event.stopImmediatePropagation();
    }, true);
  });
  const found = new Map();
  const selected = new Set();
  const blocked = /^(?:data:|blob:|javascript:)/i;
  const urlOf = s => {
    if (!s || blocked.test(s)) return null;
    try { const u = new URL(s, location.href); return /^https?:$/.test(u.protocol) ? u.href : null; }
    catch { return null; }
  };
  const add = (s, origin) => {
    const u = urlOf(s);
    if (!u || found.has(u)) return;
    found.set(u, origin);
  };
  const parseSrcset = s => (s || '').split(',').forEach(part => add(part.trim().split(/\s+/)[0], 'srcset'));
  function scan() {
    document.querySelectorAll('img').forEach(img => {
      ['currentSrc','src'].forEach(k => add(img[k], 'image'));
      ['data-src','data-original','data-lazy-src','data-url','data-image'].forEach(k => add(img.getAttribute(k), 'image'));
      parseSrcset(img.getAttribute('srcset'));
      parseSrcset(img.getAttribute('data-srcset'));
    });
    document.querySelectorAll('source').forEach(el => parseSrcset(el.getAttribute('srcset')));
    document.querySelectorAll('link[rel="preload"][as="image"]').forEach(el => add(el.href, 'preload'));
    document.querySelectorAll('a[href]').forEach(el => {
      if (/\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(el.href)) add(el.href,'link');
    });
    document.querySelectorAll('[style*="background"]').forEach(el => {
      const m = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) add(m[1], 'background');
    });
    return [...found.keys()];
  }
  const root = document.createElement('div');
  root.id = 'myppt-download-ui';
  const shadow = root.attachShadow({mode:'open'});
  shadow.innerHTML = `
<style>
*{box-sizing:border-box}button{font:inherit;cursor:pointer}#fab{position:fixed;bottom:calc(env(safe-area-inset-bottom) + 24px);right:18px;border:0;border-radius:999px;background:#2563eb;color:white;padding:13px 18px;font:600 14px system-ui;box-shadow:0 8px 28px #0005;z-index:2147483647}
#veil{display:none;position:fixed;inset:0;background:#0009;z-index:2147483646}#veil.open{display:block}
#sheet{position:absolute;bottom:0;left:0;right:0;max-height:90dvh;display:flex;flex-direction:column;background:#f8fafc;color:#0f172a;border-radius:22px 22px 0 0;padding:16px 14px calc(env(safe-area-inset-bottom) + 16px);font:14px system-ui}
#top{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:18px;margin:0}#sub{font-size:12px;color:#64748b;margin-top:4px}#close{border:0;border-radius:10px;background:#e2e8f0;padding:9px 13px}
#actions{display:flex;gap:8px;margin:16px 0 10px}#actions button{border:1px solid #cbd5e1;border-radius:11px;background:white;padding:10px 12px;flex:1}#actions button.primary{background:#2563eb;color:white;border-color:#2563eb}
#gallery{overflow:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-content:start;min-height:100px}
.item{position:relative;border:2px solid transparent;border-radius:12px;overflow:hidden;background:#e2e8f0;aspect-ratio:1;cursor:pointer}.item.active{border-color:#2563eb}.item img{width:100%;height:100%;object-fit:cover}.tick{position:absolute;top:6px;right:6px;background:#fff;border-radius:50%;width:23px;height:23px;text-align:center;line-height:23px;font-weight:bold;color:#2563eb}
#gallery img{-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important}#viewer{display:none;position:fixed;inset:0;z-index:2147483647;background:#111;color:white;flex-direction:column}#viewer.open{display:flex}#viewerhead{display:flex;justify-content:space-between;align-items:center;padding:calc(env(safe-area-inset-top) + 12px) 16px 12px}#viewerhead button{padding:10px 14px;border:0;border-radius:10px;background:#374151;color:white}#viewernav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px calc(env(safe-area-inset-bottom) + 12px)}#viewernav button{background:#374151;color:white;border:0;border-radius:12px;padding:12px 22px}#viewernav button:disabled{opacity:.35}#viewercount{font:600 14px system-ui}#viewerbody{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:12px}#viewerbody img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important;pointer-events:auto!important}#status{font-size:12px;color:#64748b;margin:10px 0 0}#empty{grid-column:1/-1;padding:30px 12px;text-align:center;color:#64748b}
</style>
<button id="fab" type="button">📷 圖片</button>
<div id="veil"><section id="sheet" role="dialog" aria-label="MyPPT 圖片下載">
<div id="top"><div><h2>圖片下載</h2><div id="sub">已找到 0 張圖片</div></div><button id="close">關閉</button></div>
<div id="actions"><button id="refresh">重新掃描</button><button id="all">全選</button><button id="save">進階下載（可能受限制）</button></div>
<div id="gallery"></div><button id="view" style="margin-top:10px;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:white">檢視原圖／長按儲存</button><button id="canvas" style="margin-top:10px;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:white">測試圖片讀取</button><button id="report" style="margin-top:10px;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:white">複製診斷報告</button><p id="status">先捲動頁面，讓圖片載入後再掃描。</p>
</section></div><div id="viewer"><div id="viewerhead"><span>長按圖片嘗試儲存</span><button id="viewclose">返回</button></div><div id="viewerbody"></div><div id="viewernav"><button id="prev" type="button">上一張</button><span id="viewercount">1 / 1</span><button id="next" type="button">下一張</button></div></div>`;
  document.documentElement.appendChild(root);
  const $ = id => shadow.getElementById(id);
  const veil = $('veil'), gallery = $('gallery');
  function render() {
    const list = scan();
    $('sub').textContent = '已找到 ' + list.length + ' 個圖片網址 · 已選 ' + selected.size;
    gallery.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('div');
      empty.id = 'empty';
      empty.textContent = '尚未找到圖片。請確認頁面已載入、可正常查看內容。';
      gallery.append(empty);
    }
    list.forEach((url,i) => {
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'item' + (selected.has(url) ? ' active' : '');
      tile.setAttribute('aria-label','選取圖片 '+(i+1));
      const img = document.createElement('img');
      img.src = url; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.style.webkitTouchCallout = 'default';
      const tick = document.createElement('span');
      tick.className = 'tick'; tick.textContent = selected.has(url) ? '✓' : '+';
      tile.append(img,tick);
      tile.onclick = () => { selected.has(url) ? selected.delete(url) : selected.add(url); render(); };
      gallery.append(tile);
    });
  }
  $('fab').onclick = () => { render(); veil.classList.add('open'); };
  $('close').onclick = () => veil.classList.remove('open');
  veil.addEventListener('click',e => { if(e.target === veil) veil.classList.remove('open'); });
  $('refresh').onclick = render;
  $('all').onclick = () => {
    const urls = scan();
    if (urls.every(u=>selected.has(u))) selected.clear(); else urls.forEach(u=>selected.add(u));
    render();
  };
  const extension = (blob, u) => {
    const type = (blob.type || '').toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('avif')) return 'avif';
    if (type.includes('jpeg')) return 'jpg';
    try { const ext = new URL(u).pathname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i); if (ext) return ext[1].toLowerCase(); } catch {}
    return 'jpg';
  };
  const validImage = b => b && b.size > 0 && (b.type.startsWith('image/') || b.type === 'application/octet-stream');
  let diagnostics = [];
  const note = s => { diagnostics.push(s); };
  const requestGM = url => new Promise((resolve,reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      note('GM: API unavailable'); return reject(new Error('Tampermonkey 跨網域 API 不可用'));
    }
    try {
      GM_xmlhttpRequest({
        method:'GET',url,responseType:'blob',timeout:20000,
        onload: r => {
          const b = r.response;
          note('GM: HTTP '+r.status+'; type='+ (b?.type || 'unknown') +'; bytes='+(b?.size ?? 'unknown'));
          if (r.status < 200 || r.status >= 300) return reject(new Error('GM HTTP '+r.status));
          if (!validImage(b)) return reject(new Error('GM 回傳非圖片內容'));
          resolve(b);
        },
        onerror: e => { note('GM: onerror; type='+(e?.type||'unknown')); reject(new Error('GM 請求失敗')); },
        ontimeout: () => { note('GM: timeout'); reject(new Error('GM 逾時')); },
        onabort: () => { note('GM: aborted'); reject(new Error('GM 已中止')); }
      });
    } catch(e) { note('GM: exception '+(e?.name||'Error')); reject(e); }
  });
  async function getBlob(url) {
    note('Image host: '+new URL(url).hostname);
    note('Page host: '+location.hostname);
    try {
      const r = await fetch(url,{credentials:'include',referrer:location.href});
      note('fetch: HTTP '+r.status+'; type='+r.type+'; content-type='+(r.headers.get('content-type')||'unknown'));
      if (!r.ok) throw new Error('HTTP '+r.status);
      const b = await r.blob();
      note('fetch blob: '+b.type+'; bytes='+b.size);
      if (!validImage(b)) throw new Error('回傳內容不是圖片');
      return b;
    } catch(e) {
      note('fetch error: '+(e?.name||'Error')+' - '+(e?.message||'unknown'));
      return requestGM(url);
    }
  }
  let viewerUrls = [];
  let viewerIndex = 0;
  const showViewerImage = () => {
    const url = viewerUrls[viewerIndex];
    if (!url) return;
    const image = document.createElement('img');
    image.src = url;
    image.alt = '原圖，請長按嘗試儲存';
    image.draggable = true;
    image.style.webkitTouchCallout = 'default';
    $('viewerbody').replaceChildren(image);
    $('viewercount').textContent = (viewerIndex+1)+' / '+viewerUrls.length;
    $('prev').disabled = viewerIndex === 0;
    $('next').disabled = viewerIndex === viewerUrls.length-1;
  };
  const moveViewer = delta => {
    const next = viewerIndex + delta;
    if (next < 0 || next >= viewerUrls.length) return;
    viewerIndex = next;
    showViewerImage();
  };
  $('view').onclick = () => {
    viewerUrls = scan();
    const chosen = viewerUrls.findIndex(url => selected.has(url));
    if (chosen < 0) { $('status').textContent = '請先選一張圖片'; return; }
    viewerIndex = chosen;
    showViewerImage();
    $('viewer').classList.add('open');
  };
  $('prev').onclick = () => moveViewer(-1);
  $('next').onclick = () => moveViewer(1);
  let swipeStart = null;
  $('viewerbody').addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { swipeStart = null; return; }
    swipeStart = {x:e.touches[0].clientX,y:e.touches[0].clientY};
  }, {passive:true});
  $('viewerbody').addEventListener('touchend', e => {
    if (!swipeStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX-swipeStart.x;
    const dy = e.changedTouches[0].clientY-swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)*1.5) moveViewer(dx < 0 ? 1 : -1);
  }, {passive:true});
  $('viewerbody').addEventListener('touchcancel', () => { swipeStart = null; });
  $('viewclose').onclick = () => {
    $('viewer').classList.remove('open');
    $('viewerbody').replaceChildren();
    viewerUrls = [];
  };
  $('canvas').onclick = () => {
    diagnostics = ['Canvas / image loading diagnostic'];
    const url = [...selected][0];
    if (!url) { $('status').textContent='請先選一張圖片'; return; }
    const img = new Image();
    img.onload = () => {
      note('Image: loaded '+img.naturalWidth+'x'+img.naturalHeight);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img,0,0);
        canvas.toDataURL('image/png');
        note('Canvas: export successful');
        $('status').textContent='Canvas 可匯出，請複製診斷報告';
      } catch(e) {
        note('Canvas: '+(e?.name||'Error')+' - '+(e?.message||'unknown'));
        $('status').textContent='Canvas 無法匯出，請複製診斷報告';
      }
    };
    img.onerror = () => { note('Image: load failed'); $('status').textContent='圖片載入失敗，請複製診斷報告'; };
    img.src = url;
  };
  $('report').onclick = async () => {
    const report = 'MyPPT Downloader v1.3.5\\n'+diagnostics.join('\\n');
    try { await navigator.clipboard.writeText(report); $('status').textContent='診斷報告已複製'; }
    catch { window.prompt('複製以下診斷內容',report); }
  };
  const downloadBlob = (blob,name) => {
    const objectURL = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectURL; a.download = name;
    a.style.display = 'none'; shadow.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(objectURL),60000);
  };
  $('save').onclick = async () => {
    const urls = [...selected];
    if (!urls.length) { $('status').textContent = '請先選取圖片。'; return; }
    diagnostics = ['Browser: iOS Safari / Tampermonkey (user reported)'];
    $('save').disabled = true;
    let success = 0, failed = 0, error = '';
    for (let i = 0; i < urls.length; i++) {
      $('status').textContent = '正在下載 ' + (i+1) + '/' + urls.length + '…';
      try {
        const blob = await getBlob(urls[i]);
        const name = 'myppt_' + String(i+1).padStart(3,'0') + '.' + extension(blob,urls[i]);
        downloadBlob(blob,name);
        success++;
      } catch (e) { failed++; error = e.message || String(e); note('Result: '+error); }
    }
    $('save').disabled = false;
    $('status').textContent = '完成：成功 '+success+'，失敗 '+failed+(failed ? '。最後錯誤：'+error : '')+'。iOS 可能要求允許多檔下載。';
  };
})();