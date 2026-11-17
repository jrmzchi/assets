// ==UserScript==
// @name         MyPPT Image Downloader (Mobile)
// @namespace    https://github.com/jrmzchi/assets
// @version      1.1.0
// @description  Download images visible on MyPPT and LURL pages
// @match        https://myppt.cc/*
// @match        https://lurl.cc/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.__mypptImageDownloader) return;
  window.__mypptImageDownloader = true;
  const urls = new Set();
  const normalize = (value) => {
    if (!value || /^(data:|blob:|javascript:)/i.test(value)) return;
    try {
      const u = new URL(value, location.href);
      if (!/^https?:$/.test(u.protocol)) return;
      return u.href;
    } catch { return; }
  };
  function scan() {
    document.querySelectorAll('img').forEach(img => {
      for (const key of ['currentSrc','src','data-src','data-original','data-lazy-src','data-url']) {
        const v = key in img ? img[key] : img.getAttribute(key);
        const u = normalize(v);
        if (u) urls.add(u);
      }
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (srcset) srcset.split(',').forEach(s => {
        const u = normalize(s.trim().split(/\s+/)[0]);
        if (u) urls.add(u);
      });
    });
    document.querySelectorAll('a[href]').forEach(a => {
      const u = normalize(a.href);
      if (u && /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(u)) urls.add(u);
    });
    document.querySelectorAll('link[rel="preload"][as="image"]').forEach(el => {
      const u = normalize(el.href);
      if (u) urls.add(u);
    });
    return [...urls];
  }
  const button = document.createElement('button');
  button.textContent = '📷 圖片下載';
  Object.assign(button.style, {
    position:'fixed',right:'14px',bottom:'85px',zIndex:'2147483647',
    padding:'12px 16px',background:'#1677ff',color:'white',
    border:'0',borderRadius:'24px',fontSize:'15px',
    boxShadow:'0 3px 14px #0005'
  });
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position:'fixed',inset:'8% 4%',zIndex:'2147483647',
    background:'#fff',color:'#222',padding:'14px',borderRadius:'12px',
    overflow:'auto',display:'none',boxShadow:'0 5px 25px #0008'
  });
  function show() {
    const list = scan();
    panel.replaceChildren();
    const heading = document.createElement('div');
    heading.textContent = 'MyPPT 圖片下載（' + list.length + '）';
    heading.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:10px';
    panel.append(heading);
    const close = document.createElement('button');
    close.textContent = '關閉';
    close.onclick = () => { panel.style.display = 'none'; };
    panel.append(close);
    const hint = document.createElement('p');
    hint.textContent = '點擊圖片可開啟原圖，再長按儲存。請先捲動頁面載入所有圖片。';
    panel.append(hint);
    list.forEach((url,i) => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.cssText = 'display:inline-block;width:46%;margin:1%;vertical-align:top;word-break:break-all';
      const img = document.createElement('img');
      img.src = url;
      img.loading = 'lazy';
      img.style.cssText = 'width:100%;max-height:160px;object-fit:contain;background:#eee';
      const label = document.createElement('div');
      label.textContent = '圖片 ' + (i+1);
      a.append(img,label);
      panel.append(a);
    });
    panel.style.display = 'block';
  }
  button.onclick = show;
  document.documentElement.append(button,panel);
})();