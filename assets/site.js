// Chikap 原型的互動：深淺切換、AI 註文展開收合、目錄收合（窄螢幕，或寬螢幕上目錄長到會擠開註文時）。
// 沒有 JavaScript 時：AI 註文和目錄都直接攤開，深淺跟系統。
// 有 JavaScript 時，<head> 裡的小段程式先在 <html> 加上 js，CSS 一開始就把窄螢幕的註文和目錄收好，載入時不會跳。
(function () {
  var root = document.documentElement;
  var wide = window.matchMedia('(min-width: 1160px)');

  // 深淺切換：只換顏色，零點幾秒過渡；記在這台瀏覽器
  function effectiveDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  var toggle = document.querySelector('.theme-toggle');
  function syncToggleLabel() {
    if (toggle) toggle.setAttribute('aria-label', effectiveDark() ? '換成淺色' : '換成深色');
  }
  if (toggle) {
    syncToggleLabel();
    toggle.addEventListener('click', function () {
      var next = effectiveDark() ? 'light' : 'dark';
      root.classList.add('theme-anim');
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncToggleLabel();
      setTimeout(function () { root.classList.remove('theme-anim'); }, 300);
    });
  }

  // AI 註文：寬螢幕放右欄（一直顯示）；窄螢幕收起來，點朱紅的 ※ 打開、再點收起
  var marks = Array.prototype.slice.call(document.querySelectorAll('.ai-mark'));
  function noteOf(mark) { return document.getElementById(mark.getAttribute('aria-controls')); }
  function setNote(mark, open) {
    var note = noteOf(mark);
    if (!note) return;
    note.classList.toggle('is-open', open);
    mark.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  marks.forEach(function (m) {
    m.addEventListener('click', function () {
      var note = noteOf(m);
      if (!note) return;
      if (wide.matches) {
        note.classList.add('flash');
        setTimeout(function () { note.classList.remove('flash'); }, 900);
      } else {
        setNote(m, !note.classList.contains('is-open'));
      }
    });
  });

  // 目錄：寬螢幕攤開在右欄；窄螢幕收成一列，點「目錄」打開
  var toc = document.querySelector('.toc');
  var tocBtn = toc && toc.querySelector('.toc-toggle');

  // 寬螢幕：註文一律留在右欄。有註文被目錄推得離段落太遠，先把目錄收成「目錄 ▾」開關；
  // 收起來還是太遠（例如兩段很短、註文很長），整頁的註文才改放段落正下方（同一頁只用一種樣子）
  var post = document.querySelector('.post');
  function notesFar() {
    return Array.prototype.some.call(document.querySelectorAll('.ai'), function (b) {
      var note = b.querySelector('.ai-note'), p = b.querySelector('p');
      // 被推下來超過 2px 就算（原本 17：被推 5px 時註文和段落第一行不在同一條基線，看得出歪）
      return note && p && note.getBoundingClientRect().top - p.getBoundingClientRect().top > 2;
    });
  }
  function placeNotes() {
    if (!post) return;
    var wasOpen = toc && toc.classList.contains('is-open');
    if (toc) toc.classList.remove('is-open');   // 用收起的樣子量；讀者自己打開的目錄量完再打開
    post.classList.remove('notes-below', 'toc-collapsed');
    if (wide.matches && notesFar()) {
      if (tocBtn) post.classList.add('toc-collapsed');
      if (!tocBtn || notesFar()) post.classList.add('notes-below');
    }
    if (wasOpen) toc.classList.add('is-open');
  }
  function setToc(open) {
    if (!toc) return;
    toc.classList.toggle('is-open', open);
    if (tocBtn) tocBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (tocBtn) {
    tocBtn.addEventListener('click', function () { setToc(!toc.classList.contains('is-open')); });
  }

  // 只有跨過斷點時才重設開合；手機捲動時網址列收放也會觸發 resize，不能因此把打開的註收起來
  function onBreakpoint() {
    marks.forEach(function (m) {
      setNote(m, false);
      if (wide.matches) m.setAttribute('aria-expanded', 'true');   // 寬螢幕註文一直在右欄
    });
    setToc(false);
    placeNotes();
  }
  // 手機的自動摘要：照螢幕寬度切到剛好排滿兩行、結尾「……」（固定 26 字時，390 寬的第二行只剩 6 字左右）。
  // 原文用電腦版那份（約 70 字；手機兩行最多約 40 字，一定夠）。沒有 JavaScript 時照舊顯示 26 字的短版
  var narrow = window.matchMedia('(max-width: 699px)');
  var ELL = '……';
  function cutAt(src, k) {
    var s = src.slice(0, k);
    // 英文字不切一半（­＝建站時加的斷字點，算在字裡面）
    if (k < src.length && /[A-Za-z0-9­]/.test(src.charAt(k)) && /[A-Za-z0-9­]$/.test(s)) s = s.replace(/[A-Za-z0-9'’­-]+$/, '');
    return s.replace(/[\s，、；：。,.;:]+$/, '');   // 刪節號前面不留標點和空格
  }
  function fitExcerpts() {
    if (!narrow.matches) return;
    Array.prototype.forEach.call(document.querySelectorAll('.excerpt'), function (p) {
      var long = p.querySelector('.ex-long'), short = p.querySelector('.ex-short');
      if (!long || !short) return;
      var full = long.textContent, cut = full.slice(-ELL.length) === ELL;
      var src = cut ? full.slice(0, -ELL.length) : full;
      var max = parseFloat(getComputedStyle(p).lineHeight) * 2 + 1;
      function fits(s) { short.textContent = s; return p.getBoundingClientRect().height <= max; }
      if (!cut && fits(src)) return;
      var lo = 0, hi = src.length;   // 找最長、加上「……」還排得進兩行的長度
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (fits(cutAt(src, mid) + ELL)) lo = mid; else hi = mid - 1;
      }
      short.textContent = cutAt(src, lo) + ELL;
    });
  }

  // 首頁大站名旁的鳥：點一下（手機碰一下）再拍一次，一拍就拍完整段；滑鼠移上去不動。
  // 動畫寫在 site.css 的 flap 那段（.is-flapping）；還在拍（含打開頁面那一下）時點了不理，拍完才能再點。
  // 「減少動態效果」時 CSS 那段整個不套用，加了 class 也不會動。
  Array.prototype.forEach.call(document.querySelectorAll('.big-logo .mark'), function (m) {
    var svg = m.querySelector('svg');
    m.addEventListener('click', function () {
      if (svg && svg.getAnimations && svg.getAnimations().length) return;
      m.classList.remove('is-flapping');
      void m.offsetWidth;   // 讓瀏覽器先算一次樣式，拿掉再加上才會從頭拍
      m.classList.add('is-flapping');
    });
  });

  onBreakpoint();
  fitExcerpts();
  if (wide.addEventListener) wide.addEventListener('change', onBreakpoint);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placeNotes(); fitExcerpts(); });   // 字型載入後行數會變
  var rt, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      placeNotes();
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; fitExcerpts(); }   // 只有寬度變了才重切（手機網址列收放只改高度）
    }, 150);
  });
})();
