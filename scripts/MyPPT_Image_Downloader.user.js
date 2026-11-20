// ==UserScript==
// @name         MyPPT Image Downloader
// @namespace    https://github.com/jrmzchi/assets
// @version      1.5.3
// @description  iPhone image and video viewer with native save
// @match        https://myppt.cc/*
// @match        https://*.myppt.cc/*
// @match        https://lurl.cc/*
// @match        https://*.lurl.cc/*
// @updateURL    https://raw.githubusercontent.com/jrmzchi/assets/main/scripts/MyPPT_Image_Downloader.meta.js
// @downloadURL  https://raw.githubusercontent.com/jrmzchi/assets/main/scripts/MyPPT_Image_Downloader.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      *.myppt.cc
// @connect      myppt.cc
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('myppt-download-ui')) return;

  const unlockStyle = document.createElement('style');
  unlockStyle.textContent = 'img,a,video{-webkit-touch-callout:default!important;-webkit-user-select:auto!important;user-select:auto!important}';
  document.documentElement.appendChild(unlockStyle);
  ['contextmenu','selectstart','copy','dragstart'].forEach(type => {
    window.addEventListener(type, event => {
      if (event.target?.closest?.('#myppt-download-ui')) return;
      event.stopImmediatePropagation();
    }, true);
  });

  // Prefill the password field with MMDD from the displayed upload date.
  let lastAutoValue = '';
  const submittedFields = new WeakMap();
  function submitDatePassword(field, password) {
    if (submittedFields.get(field) === password) return;
    const form = field.closest('form');
    const scope = form || field.closest('section,article,.card,.container,.modal') || document;
    const buttons = [...scope.querySelectorAll('button,input[type="submit"],input[type="button"]')];
    const submit = buttons.find(el => {
      const label = (el.innerText || el.textContent || el.value || '').replace(/\s+/g,'').trim();
      return /^(送出|提交|確認|解鎖|確定|Submit|Unlock)$/i.test(label) && !el.disabled && el.getClientRects().length;
    });
    if (!submit && !form) return;
    submittedFields.set(field,password);
    if (submit) submit.click();
    else if (typeof form.requestSubmit === 'function') form.requestSubmit();
  }
  function prefillUploadDatePassword() {
    const text = document.body?.innerText || '';
    const match = text.match(/上傳日期\s*[：:]\s*\d{4}[-/](\d{1,2})[-/](\d{1,2})(?=\s|$)/);
    if (!match) return;
    const month = Number(match[1]), day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return;
    const password = String(month).padStart(2, '0') + String(day).padStart(2, '0');
    const field = [...document.querySelectorAll('input')].find(el =>
      !el.disabled && !el.readOnly && el.getClientRects().length &&
      (el.type === 'password' || /密碼|password|passcode/i.test(
        [el.placeholder, el.name, el.id, el.getAttribute('aria-label')].join(' ')
      ))
    );
    if (!field || (field.value && field.value !== password && field.value !== lastAutoValue)) return;
    if (field.value === password) {
      if (lastAutoValue === password) submitDatePassword(field,password);
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(field, password);
    else field.value = password;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    lastAutoValue = password;
    setTimeout(() => { if (field.isConnected && field.value === password) submitDatePassword(field,password); }, 200);
  }
  prefillUploadDatePassword();
  let fillQueued = false;
  const fillObserver = new MutationObserver(() => {
    if (fillQueued) return;
    fillQueued = true;
    setTimeout(() => { fillQueued = false; prefillUploadDatePassword(); }, 250);
  });
  fillObserver.observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('pageshow', prefillUploadDatePassword);


  const videoUrls = new Map();
  function scanVideos() {
    const add = value => {
      if (!value || /^(data|blob|javascript):/i.test(value)) return;
      try {
        const u = new URL(value, location.href);
        if (/^https?:$/.test(u.protocol) && /\.(mov|mp4|m4v|webm)(?:[?#]|$)/i.test(u.href)) videoUrls.set(u.href,true);
      } catch {}
    };
    document.querySelectorAll('video').forEach(el => {
      add(el.currentSrc); add(el.src); add(el.getAttribute('data-src'));
      el.querySelectorAll('source').forEach(s => add(s.src));
    });
    document.querySelectorAll('source[src],a[href]').forEach(el => add(el.src || el.href));
    return [...videoUrls.keys()];
  }
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
      #tabs{display:flex;gap:6px;background:#e9eef5;padding:4px;border-radius:12px;margin-bottom:12px}
      #tabs button{flex:1;border:0;border-radius:9px;background:transparent;padding:10px;color:#64748b;font-weight:600}
      #tabs button.active{background:#fff;color:#0f172a;box-shadow:0 1px 4px #0001}
      #videos{display:none;overflow:auto;min-height:100px}
      .videoCard{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:8px}
      .videoCard span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .videoCard button,.videoCard a{border:0;background:#2563eb;color:white;padding:10px 12px;border-radius:10px;text-decoration:none;font:inherit;white-space:nowrap}
      .videoCard button{background:#e2e8f0;color:#334155}
      .videoCard button:last-child{background:#2563eb;color:white}
      .videoCard button:disabled{opacity:.55}
      #videoViewer{display:none;position:fixed;inset:0;z-index:2147483647;background:#101014;color:white;flex-direction:column;font:14px -apple-system,system-ui}
      #videoViewer.open{display:flex}
      #videoViewer header{padding:calc(env(safe-area-inset-top) + 12px) 16px 12px;display:flex;justify-content:space-between;align-items:center}
      #videoViewer button{background:#303036;color:white;border:0;border-radius:10px;padding:12px}
      #videoViewer video{width:100%;flex:1;min-height:0;object-fit:contain}
      #videoViewer footer{padding:12px 16px calc(env(safe-area-inset-bottom) + 14px);text-align:center}
      #videoViewer #openVideo{background:#2563eb;width:100%;font-weight:600}
      #videoViewer p{color:#cbd5e1;font-size:12px}
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
      <div id="tabs"><button id="imageTab" class="active" type="button">圖片</button><button id="videoTab" type="button">影片</button></div>
      <div id="grid"></div><div id="videos"></div>
      <p id="sheetHint">點擊縮圖檢視原圖 · 長按圖片儲存</p>
    </div></section>
    <section id="viewer" aria-label="原圖檢視">
      <header class="top"><button id="back" type="button">‹ 返回</button><strong>原圖檢視</strong><span id="position">1 / 1</span></header>
      <div id="imageArea"></div>
      <footer id="bottom"><button id="prev" type="button">‹ 上一張</button><span id="hint">長按圖片儲存</span><button id="next" type="button">下一張 ›</button></footer>
    </section>
    <section id="videoViewer"><header><strong>影片檢視</strong><button id="videoBack">返回</button></header>
    <video id="videoPlayer" controls playsinline preload="metadata"></video>
    <footer><button id="openVideo">開啟原始影片</button><p>可使用 Safari 分享選單嘗試儲存至「檔案」</p></footer></section>
  `;
  document.documentElement.appendChild(root);
  const $ = id => shadow.getElementById(id);
  let list = [];
  let index = 0;
  let activeTab = 'image';
  let currentVideo = '';

  function fetchVideoViaGM(url) {
    return new Promise((resolve,reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') return reject(new Error('Tampermonkey 不支援跨網域請求'));
      GM_xmlhttpRequest({
        method:'GET', url, responseType:'blob', timeout:120000,
        headers:{'Accept':'video/*,*/*;q=0.8'},
        onload: res => {
          if (res.status !== 200) return reject(new Error('HTTP '+res.status+'（影片未完整回傳）'));
          const blob = res.response;
          const headers = res.responseHeaders || '';
          if (/content-type:\s*(?:text\/html|application\/json)/i.test(headers))
            return reject(new Error('伺服器回傳驗證頁，而非影片'));
          if (!(blob instanceof Blob) || !blob.size)
            return reject(new Error('未取得完整影片資料'));
          resolve(blob);
        },
        ontimeout: () => reject(new Error('下載逾時')),
        onerror: () => reject(new Error('Tampermonkey 跨網域請求失敗'))
      });
    });
  }
  function renderVideos() {
    const items = scanVideos();
    $('videos').replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.id = 'empty';
      empty.textContent = '尚未找到影片，請先播放網頁影片，再重新掃描。';
      $('videos').append(empty);
    }
    items.forEach((url,i) => {
      const card = document.createElement('div'); card.className='videoCard';
      const title = document.createElement('span'); title.textContent='🎬 影片 '+(i+1)+' · '+(new URL(url).pathname.split('.').pop()||'').toUpperCase();
      const button = document.createElement('button'); button.textContent='檢視';
      button.onclick = () => { currentVideo=url; $('videoPlayer').src=url; $('videoViewer').classList.add('open'); };
      const download = document.createElement('button');
      download.textContent='下載';
      download.setAttribute('aria-label','下載第 '+(i+1)+' 部影片');
      download.onclick = async () => {
        download.disabled = true;
        download.textContent = '下載中…';
        try {
          let blob;
          try {
            blob = await fetchVideoViaGM(url);
          } catch (gmError) {
            try {
              const response = await fetch(url, {mode:'cors',credentials:'include',redirect:'follow'});
              if (!response.ok) throw new Error('HTTP '+response.status);
              if (/text\/html|application\/json/i.test(response.headers.get('content-type') || ''))
                throw new Error('伺服器回傳驗證頁');
              blob = await response.blob();
              if (!blob.size) throw new Error('影片資料為空');
            } catch (fetchError) {
              throw new Error('GM：'+gmError.message+'；fetch：'+fetchError.message);
            }
          }
          const ext = ((new URL(url).pathname.match(/\.(mov|mp4|m4v|webm)$/i)||[])[1]||'mp4').toLowerCase();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = 'myppt_video_'+String(i+1).padStart(3,'0')+'.'+ext;
          a.style.display='none';
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(objectUrl),60000);
          download.textContent = '已送出下載';
        } catch (error) {
          const message = error instanceof TypeError
            ? '無法讀取影片：可能受到 CORS、網路或 Cloudflare 限制。'
            : '下載失敗：'+(error?.message || '未知錯誤');
          download.textContent = '下載失敗';
          alert(message+'\n不會自動跳轉至原始影片。');
        } finally {
          download.disabled = false;
          setTimeout(() => { if (download.isConnected) download.textContent='下載'; },2500);
        }
      };
      card.append(title,button,download); $('videos').append(card);
    });
    $('count').textContent=items.length+' 部';
  }
  function setTab(tab) {
    activeTab=tab;
    $('imageTab').classList.toggle('active',tab==='image');
    $('videoTab').classList.toggle('active',tab==='video');
    $('grid').style.display=tab==='image'?'grid':'none';
    $('videos').style.display=tab==='video'?'block':'none';
    $('sheetHint').textContent=tab==='image'?'點擊縮圖檢視原圖 · 長按圖片儲存':'點「下載」直接取得影片；如遭 CORS 或 Cloudflare 阻擋會顯示錯誤';
    if (tab==='image') renderGrid(); else renderVideos();
  }
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
  $('fab').onclick = () => { setTab(activeTab); $('galleryScreen').classList.add('open'); };
  $('imageTab').onclick = () => setTab('image');
  $('videoTab').onclick = () => setTab('video');
  $('videoBack').onclick = () => { $('videoViewer').classList.remove('open'); $('videoPlayer').pause(); $('videoPlayer').removeAttribute('src'); $('videoPlayer').load(); };
  $('openVideo').onclick = () => { if (currentVideo) window.open(currentVideo,'_blank','noopener'); };
  $('refresh').onclick = () => setTab(activeTab);
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
