(async () => {
  // ================= CONFIG =================
  const NEG = 0.25;          // negative mark per wrong answer (0 = off)
  const DEFAULT_MIN = 45;    // default minutes
  const SKIP_SUBJECTS = /(?!)/;   // matches nothing, so no subjects are skipped// ==========================================

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  // poll fn() every `step` ms until it returns truthy or `max` ms pass; resolves with last value
  const until = async (fn, max, step = 40) => { const t0 = performance.now(); let v; while (!(v = fn()) && performance.now() - t0 < max) await sleep(step); return v; };
  document.getElementById('xm-overlay')?.remove(); document.getElementById('xm-style')?.remove();

  // 1) time -------------------------------------------------------------
  const ans = prompt('How many minutes for this exam?', DEFAULT_MIN);
  if (ans === null) return;
  const minutes = parseFloat(ans);
  if (!(minutes > 0)) return alert('Invalid time.');

  // styles + loading overlay (shown immediately) -------------------------
  document.head.insertAdjacentHTML('beforeend', `<style id="xm-style">
  #xm-overlay{position:fixed;inset:0;z-index:2147483647;background:#0f1115;color:#e8e8e8;overflow:auto;font-family:system-ui,sans-serif}
  #xm-overlay *{box-sizing:border-box}
  #xm-load{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;font:600 18px system-ui,sans-serif}
  .xm-spin{width:46px;height:46px;border-radius:50%;border:4px solid #2a2f3a;border-top-color:#3b82f6;animation:xmr .7s linear infinite}
  @keyframes xmr{to{transform:rotate(360deg)}}
  #xm-bar{position:sticky;top:0;z-index:5;background:#171a21;border-bottom:1px solid #2a2f3a;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between}
  #xm-timer{font:700 20px monospace}#xm-timer.low{color:#ff5b5b}
  .xm-btn{background:#0e7a56;color:#fff;border:0;border-radius:10px;min-width:44px;padding:8px 14px;font-size:18px;cursor:pointer}
  .xm-btn.alt{background:#2a2f3a}
  #xm-body{max-width:820px;margin:0 auto;padding:14px}
  .xm-sub{text-align:center;font-size:20px;font-weight:700;margin:22px 0 10px}
  .xm-q{border:1px solid #2a2f3a;border-radius:14px;padding:14px;margin-bottom:14px;background:#14171d;content-visibility:auto;contain-intrinsic-size:auto 340px}
  .xm-q p{font-size:17px;line-height:1.7;margin:0}
  .xm-o{display:flex;gap:14px;align-items:center;border:1px solid #2a2f3a;border-radius:16px;padding:10px 12px;margin-top:10px;cursor:pointer;transition:background .15s,border-color .15s}
  .xm-o>div{flex:1;min-width:0}
  .xm-o p{margin:0;font-size:18px}
  .xm-c{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid #3a4150;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#e8e8e8}
  .xm-q.lock .xm-o{cursor:default}
  .xm-o.sel{background:#1e3a8a;border-color:#3b82f6}
  .xm-o.sel .xm-c{background:#fff;color:#000;border-color:#fff}
  .xm-o.ok{border-color:#0e7a56;background:#13211d}.xm-o.ok .xm-c{background:#0e7a56;color:#fff;border-color:#0e7a56}
  .xm-o.bad{border-color:#f87171;background:#2b141c}.xm-o.bad .xm-c{background:#c81010;color:#fff;border-color:#c81010}
  .xm-chip{background:#2a2f3a;color:#ddd;border:0;border-radius:99px;padding:8px 14px;font-size:16px;cursor:pointer}.xm-chip.on{background:#0e7a56;color:#fff}
  .xm-tag{font-size:18px;margin-top:10px;display:block}
  .xm-sum{text-align:center;padding:16px;border:1px solid #2a2f3a;border-radius:14px;margin-bottom:14px;background:#14171d;font-size:18px}
  .xm-sum b{font-size:32px}
  </style>`);
  const ov = document.createElement('div'); ov.id = 'xm-overlay';
  ov.innerHTML = '<div id="xm-load"><div class="xm-spin"></div><span>Loading exam…</span><small id="xm-prog" style="color:#8a93a3"></small></div>';
  document.body.appendChild(ov);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  let tick, submitted = false;
  const close = () => { clearInterval(tick); ov.remove(); document.getElementById('xm-style')?.remove(); document.body.style.overflow = prevOverflow; };
  const prog = t => { const p = ov.querySelector('#xm-prog'); if (p) p.textContent = t; };
  await frame();

  // 2) load all questions — stop the moment the expected count is present -
  const CARD = 'div.relative.rounded-xl.border.border-border.p-5';
  const cards = () => [...document.querySelectorAll(CARD)];
  const bn = '\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF';
  const total = (() => {
    const sp = document.querySelector('h1.header')?.parentElement?.querySelector('span'); // "<label> <count>"
    const d = (sp?.textContent.match(/[\d\u09E6-\u09EF]+/) || [''])[0].replace(/[\u09E6-\u09EF]/g, c => bn.indexOf(c));
    return +d || 0;
  })();
  let last = -1, lastChange = performance.now();
  while (true) {
    const n = cards().length;
    if (n !== last) { last = n; lastChange = performance.now(); prog(total ? `${n}/${total}` : n); }
    if (total ? n >= total : (n > 0 && performance.now() - lastChange > 350)) break;
    if (performance.now() - lastChange > 2000) break;           // nothing new is coming
    window.scrollTo(0, document.body.scrollHeight);
    document.querySelectorAll('div').forEach(e => { if (e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; });
    await sleep(40);
  }
  window.scrollTo(0, 0);
  const subjectOf = c => { for (let p = c.parentElement; p; p = p.parentElement) { const h = p.querySelector(':scope > h3'); if (h) return h.textContent.trim(); } return ''; };
  const list = cards().filter(c => !SKIP_SUBJECTS.test(subjectOf(c)));
  if (!list.length) { close(); return alert('No questions found on this page.'); }

  // 3) reveal answers: click eye, finish the instant every card has changed
  const eye = document.querySelector('button[data-event="eye_icon_review"]');
  if (!eye) { close(); return alert('Eye button not found.'); }
  const isHidden = () => /M3\.98 8\.223/.test(eye.innerHTML);   // eye-slash icon = hidden
  const optsOf = c => [...c.querySelectorAll(':scope > div.grid > button')];
  const sig = b => {
    const s = getComputedStyle(b), t = b.querySelector('span');
    return [b.className, s.borderColor, s.backgroundColor, t && t.className, t && getComputedStyle(t).backgroundColor].join('|');
  };
  const green = b => {
    const t = b.querySelector('span'), s = getComputedStyle(b);
    return [s.borderColor, s.backgroundColor, t ? getComputedStyle(t).backgroundColor : '']
      .map(c => { const m = c.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0]; return m[1] - Math.max(m[0], m[2]); })
      .reduce((a, b) => Math.max(a, b), -999);
  };
  const changedIdx = (c, bef) => optsOf(c).map((b, j) => sig(b) !== bef[j] ? j : -1).filter(j => j >= 0);

  if (!isHidden()) { eye.click(); await until(isHidden, 1000); }
  const before = list.map(c => optsOf(c).map(sig));
  prog('Fetching answers…');
  eye.click();
  let lastCnt = 0, lastMove = performance.now();
  await until(() => {
    const cnt = list.reduce((a, c, i) => a + (changedIdx(c, before[i]).length ? 1 : 0), 0);
    if (cnt !== lastCnt) { lastCnt = cnt; lastMove = performance.now(); prog(`${cnt}/${list.length}`); }
    return cnt === list.length || (cnt > 0 && performance.now() - lastMove > 400);
  }, 2500, 30);

  let missing = 0;
  const qs = list.map((c, i) => {
    const opts = optsOf(c);
    let idx = changedIdx(c, before[i]);
    if (idx.length > 1) idx = [idx.reduce((a, b) => green(opts[b]) > green(opts[a]) ? b : a)];
    if (!idx.length) { const g = opts.map(green), m = Math.max(...g); if (m > 20) idx = [g.indexOf(m)]; }
    if (!idx.length) missing++;
    return {
      subject: subjectOf(c),
      q: c.querySelector('.pr-8')?.innerHTML || '',
      opts: opts.map(b => ({ l: b.querySelector('span')?.textContent.trim() || '', h: b.querySelector('.flex-1')?.innerHTML || b.innerHTML })),
      correct: idx.length ? idx[0] : null,
      pick: null,
    };
  });
  if (!isHidden()) eye.click();                                 // restore page state
  if (missing) console.warn(`[xm] answer not detected for ${missing}/${qs.length} questions (left ungraded)`);

  // 4) exam UI ------------------------------------------------------------
  let left = Math.round(minutes * 60);
  const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function renderExam() {
    ov.innerHTML = `<div id="xm-bar"><span id="xm-timer">${mmss(left)}</span><span id="xm-cnt"></span>
      <span><button class="xm-btn alt" id="xm-quit">Quit</button> <button class="xm-btn" id="xm-submit">Submit</button></span></div>
      <div id="xm-body"></div>`;
    const body = ov.querySelector('#xm-body'), frag = document.createDocumentFragment(); let lastSub = null;
    const count = () => ov.querySelector('#xm-cnt').textContent = `${qs.filter(q => q.pick !== null).length}/${qs.length} answered`;
    qs.forEach((q, i) => {
      if (q.subject !== lastSub) { lastSub = q.subject; const h = document.createElement('div'); h.className = 'xm-sub'; h.textContent = q.subject; frag.appendChild(h); }
      const d = document.createElement('div'); d.className = 'xm-q';
      d.innerHTML = q.q + q.opts.map((o, j) => `<div class="xm-o" data-j="${j}"><span class="xm-c">${o.l}</span><div>${o.h}</div></div>`).join('');
      d.querySelectorAll('.xm-o').forEach(el => el.onclick = () => {
        if (q.pick !== null) return;                            // locked once chosen
        q.pick = +el.dataset.j; el.classList.add('sel'); d.classList.add('lock'); count();
      });
      frag.appendChild(d);
    });
    body.appendChild(frag); count();
    ov.querySelector('#xm-quit').onclick = () => confirm('Quit the exam? Progress will be lost.') && close();
    ov.querySelector('#xm-submit').onclick = () => {
      const un = qs.filter(q => q.pick === null).length;
      if (!un || confirm(`${un} unanswered. Submit anyway?`)) submit();
    };
  }

  function submit() {
    if (submitted) return; submitted = true; clearInterval(tick);
    let right = 0, wrong = 0, skip = 0, ungraded = 0;
    qs.forEach(q => { if (q.correct === null) ungraded++; else if (q.pick === null) skip++; else if (q.pick === q.correct) right++; else wrong++; });
    const score = right - wrong * NEG;
    let filter = 'all';
    const status = q => q.correct === null ? 'ungraded' : q.pick === null ? 'skipped' : q.pick === q.correct ? 'correct' : 'wrong';
    const LABEL = q => ({ correct: 'Correct', wrong: 'Wrong', skipped: 'Skipped', ungraded: 'Answer not detected' })[status(q)];
    const COLOR = { correct: '#4ade80', wrong: '#f87171', skipped: '#fbbf24', ungraded: '#999' };

    ov.innerHTML = `<div id="xm-bar"><b>Result</b><span><button class="xm-btn alt" id="xm-retake">Retake</button> <button class="xm-btn" id="xm-close">Close</button></span></div>
      <div id="xm-body"><div class="xm-sum"><b>${score.toFixed(2)}</b> / ${qs.length - ungraded}<br>
      ${right} correct · ${wrong} wrong · ${skip} skipped${ungraded ? ` · ${ungraded} ungraded` : ''}<br><small>Negative marking: −${NEG} per wrong answer</small></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;justify-content:center" id="xm-filters"></div><div id="xm-list"></div></div>`;
    const F = [['all', 'All'], ['wrong', 'Wrong'], ['skipped', 'Skipped'], ['ws', 'Wrong + Skipped'], ['correct', 'Correct']];
    const fb = ov.querySelector('#xm-filters');
    F.forEach(([k, t]) => { const b = document.createElement('button'); b.className = 'xm-chip'; b.textContent = t; b.onclick = () => { filter = k; draw(); }; b.dataset.k = k; fb.appendChild(b); });
    function draw() {
      fb.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === filter));
      const L = ov.querySelector('#xm-list'), frag = document.createDocumentFragment();
      qs.forEach((q, i) => {
        const s = status(q);
        if (filter === 'wrong' && s !== 'wrong') return;
        if (filter === 'skipped' && s !== 'skipped') return;
        if (filter === 'ws' && s !== 'wrong' && s !== 'skipped') return;
        if (filter === 'correct' && s !== 'correct') return;
        const d = document.createElement('div'); d.className = 'xm-q';
        d.innerHTML = `<small style="color:#8a93a3">${q.subject} · Q${i + 1}</small>` + q.q +
          q.opts.map((o, j) => `<div class="xm-o ${j === q.correct ? 'ok' : j === q.pick ? 'bad' : ''}"><span class="xm-c">${o.l}</span><div>${o.h}</div></div>`).join('') +
          `<span class="xm-tag" style="color:${COLOR[s]}">${LABEL(q)}</span>`;
        frag.appendChild(d);
      });
      L.innerHTML = ''; L.appendChild(frag);
      if (!L.children.length) L.innerHTML = '<p style="text-align:center;color:#8a93a3">Nothing here.</p>';
    }
    draw(); ov.scrollTop = 0;
    ov.querySelector('#xm-close').onclick = close;
    ov.querySelector('#xm-retake').onclick = () => { qs.forEach(q => q.pick = null); submitted = false; left = Math.round(minutes * 60); renderExam(); start(); };
  }

  function start() {
    tick = setInterval(() => {
      left--; const t = ov.querySelector('#xm-timer');
      if (t) { t.textContent = mmss(Math.max(left, 0)); t.classList.toggle('low', left <= 60); }
      if (left <= 0) { alert("Time's up! Submitting."); submit(); }
    }, 1000);
  }
  renderExam(); start();
})();
