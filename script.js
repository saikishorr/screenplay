/* ========= Screenplay Writer =========
   - Script content ONLY in 12pt Courier New (CSS .script-area)
   - Autosave to localStorage
   - Upload/Download (.txt or .fountain)
   - PDF export (jsPDF; Courier 12; screenplay margins)
   - FDX export (Final Draft XML)
   - Formatter sidebar + mobile slide-in panel
   - Keyboard shortcuts
   - version 1.1.0 
===================================== */

const editor = document.getElementById('editor');
const printArea = document.getElementById('printArea');
const upload = document.getElementById('upload');
const downloadBtn = document.getElementById('downloadBtn');
const downloadFormat = document.getElementById('downloadFormat');
const newBtn = document.getElementById('newBtn');
const pdfBtn = document.getElementById('pdfBtn');
const fdxBtn = document.getElementById('fdxBtn');
const autosaveState = document.getElementById('autosaveState');
const cursorPos = document.getElementById('cursorPos');
const sidebarToggle = document.getElementById('sidebarToggle');

/* ---------- Sidebar toggle (mobile) ---------- */
sidebarToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('sidebar-open');
});

/* ---------- Caret helpers ---------- */
function getSelectionRange(el){ return { start: el.selectionStart, end: el.selectionEnd }; }
function setSelection(el, start, end=start){ el.focus(); el.setSelectionRange(start, end); }
function insertAtCursor(el, text, opts={select:false}){
  const { start, end } = getSelectionRange(el);
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;
  const pos = start + text.length;
  setSelection(el, pos, opts.select ? pos - text.length : pos);
  triggerAutosave();
  updateCursorDisplay();
}

/* ---------- Screenplay tab stops ---------- */
const COL = { DIALOG: 10, PAREN: 16, SPEAKER: 22, TRANSITION: 60 };
const spaces = n => ' '.repeat(Math.max(0, n));
const padToColumn = c => '\n' + spaces(c - 1);
const rightAlign = (text, c = COL.TRANSITION) => {
  const pad = Math.max(1, c - text.length);
  return '\n' + spaces(pad) + text.toUpperCase();
};

/* ---------- Formatter actions ---------- */
const actions = {
  header(){ insertAtCursor(editor, '\nINT. LOCATION - DAY\n'); },
  action(){ insertAtCursor(editor, '\nAction line describing what happens.\n'); },
  speaker(){ insertAtCursor(editor, padToColumn(COL.SPEAKER) + 'CHARACTER NAME\n'); },
  parentheses(){ insertAtCursor(editor, padToColumn(COL.PAREN) + '(quietly)\n'); },
  dialog(){ insertAtCursor(editor, padToColumn(COL.DIALOG) + 'This is a line of dialogue.\n'); },
  newchar(){
    insertAtCursor(editor, padToColumn(COL.SPEAKER) + 'NEW CHARACTER\n' +
                             padToColumn(COL.PAREN) + '(introducing)\n');
  },
  vfx(){ insertAtCursor(editor, '\nSFX: THUNDER CRACKS.\n'); },
  fadein(){ insertAtCursor(editor, rightAlign('FADE IN:') + '\n'); },
  cutto(){ insertAtCursor(editor, rightAlign('CUT TO:') + '\n'); },
  fadeout(){ insertAtCursor(editor, rightAlign('FADE OUT.') + '\n'); }
};
document.querySelectorAll('[data-action]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const action = btn.getAttribute('data-action');
    actions[action] && actions[action]();
  });
});

/* ---------- Autosave ---------- */
const KEY = 'screenplay:autosave:v1';
let saveTimer = null;

function triggerAutosave(){
  clearTimeout(saveTimer);
  autosaveState.textContent = 'Saving…';
  saveTimer = setTimeout(()=>{
    try {
      localStorage.setItem(KEY, editor.value);
      autosaveState.textContent = 'Saved';
    } catch {
      autosaveState.textContent = 'Not saved (storage full?)';
    }
  }, 300);
}
(function loadAutosave(){
  const data = localStorage.getItem(KEY);
  if(data) editor.value = data;
})();

editor.addEventListener('input', ()=>{ triggerAutosave(); updateCursorDisplay(); });
editor.addEventListener('click', updateCursorDisplay);
editor.addEventListener('keyup', updateCursorDisplay);

function updateCursorDisplay(){
  const { selectionStart } = editor;
  const upTo = editor.value.slice(0, selectionStart);
  const lines = upTo.split('\n');
  const line = lines.length;
  const col = lines[lines.length-1].length + 1;
  cursorPos.textContent = `Line ${line}, Col ${col}`;
}

/* ---------- Upload ---------- */
upload.addEventListener('change', (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    editor.value = reader.result;
    triggerAutosave();
    updateCursorDisplay();
  };
  reader.readAsText(file);
  upload.value = '';
});

/* ---------- Download text (.txt / .fountain) ---------- */
function downloadText(filename, text){
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
downloadBtn.addEventListener('click', ()=>{
  const ext = downloadFormat.value === 'fountain' ? 'fountain' : 'txt';
  downloadText(`script.${ext}`, editor.value);
});

/* ---------- PDF export (jsPDF) ---------- */
pdfBtn.addEventListener('click', ()=>{
  const { jsPDF } = window.jspdf;
  // US Letter, units in inches
  const doc = new jsPDF({ unit: 'in', format: 'letter' });
  // Courier, 12 pt
  doc.setFont('courier', 'normal');
  doc.setFontSize(12);

  // Screenplay margins: L 1.5", R 1", T 1", B 1"
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { top: 1, right: 1, bottom: 1, left: 1.5 };
  const usableWidth = pageWidth - margin.left - margin.right;
  const lineHeight = 12 / 72 * 1.5; // 12pt in inches * 1.5 leading

  let y = margin.top;
  const text = editor.value.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Respect spaces for indenting—use splitTextToSize with no trimming
    const chunks = doc.splitTextToSize(lines[i].replace(/\t/g,'    '), usableWidth, { lineBreak: true });
    chunks.forEach(chunk => {
      if (y + lineHeight > pageHeight - margin.bottom) {
        doc.addPage();
        doc.setFont('courier','normal');
        doc.setFontSize(12);
        y = margin.top;
      }
      doc.text(chunk || ' ', margin.left, y, { baseline: 'top' });
      y += lineHeight;
    });
  }

  doc.save('script.pdf');
});

/* ---------- FDX export ---------- */
function inferParagraphType(line){
  const trimmed = line.trim();
  const isAllCaps = /^[^a-z]*$/.test(trimmed) && /[A-Z]/.test(trimmed);
  const startsWithINTEXT = /^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed);
  const isTransition = /(FADE IN:|FADE OUT\.|CUT TO:)\s*$/.test(trimmed);
  const isParenthetical = /^\(.+\)$/.test(trimmed);

  if (startsWithINTEXT) return 'Scene Heading';
  if (isTransition) return 'Transition';
  if (isAllCaps && trimmed.length > 0 && trimmed.length <= 30) return 'Character';
  if (isParenthetical) return 'Parenthetical';

  const leading = line.match(/^\s*/)?.[0]?.length ?? 0;
  if (leading >= 9 && !startsWithINTEXT && !isTransition && !isParenthetical && !/SFX:/.test(trimmed)) {
    return 'Dialogue';
  }
  return 'Action';
}
const xmlEscape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function buildFDX(text){
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const paras = lines.map(l=>{
    const type = l.trim() === '' ? 'Action' : inferParagraphType(l);
    const xmlText = xmlEscape(l.replace(/\t/g,'    '));
    return `      <Paragraph Type="${type}"><Text>${xmlText}</Text></Paragraph>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="1">
  <Content>
${paras}
  </Content>
</FinalDraft>
`;
}

fdxBtn.addEventListener('click', ()=>{
  const xml = buildFDX(editor.value);
  downloadText('script.fdx', xml);
});

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener('keydown', (e)=>{
  if(e.ctrlKey){
    const k = e.key.toLowerCase();
    if(k === '7'){ e.preventDefault(); downloadBtn.click(); }
    if(k === '6'){ e.preventDefault(); newBtn.click(); }
    if(k === '1'){ e.preventDefault(); actions.header(); }
    if(k === '2'){ e.preventDefault(); actions.action(); }
    if(k === '3'){ e.preventDefault(); actions.speaker(); }
    if(k === '4'){ e.preventDefault(); actions.parentheses(); }
    if(k === '5'){ e.preventDefault(); actions.dialog(); }
  }
});

/* ---------- Print helper (optional) ---------- */
function syncPrintArea(){ printArea.textContent = editor.value; }
window.addEventListener('beforeprint', syncPrintArea);

/* Init */
(function init(){ syncPrintArea(); updateCursorDisplay(); })();


/* ---------- New Script ---------- */
newBtn.addEventListener('click', () => {
  if (confirm("Start a new script? Unsaved changes will be lost.")) {
    editor.value = "";
    triggerAutosave();
    updateCursorDisplay();
  }
});


/* ===== Technical Enhancements + Screenplay-Specific Enhancements (JS) ===== */
/* Requires an existing <textarea id="editor"> and sidebar/status elements from your app. */

/* ---------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const downloadBlob = (name, data, type='text/plain')=>{
  const b = new Blob([data], {type}); const u = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a);
  a.click(); a.remove(); URL.revokeObjectURL(u);
};

/* ---------- 1) Theme Toggle (Dark/Light) ---------- */
(function injectThemeToggle(){
  const btn = document.createElement('button');
  btn.id = 'themeToggle';
  btn.textContent = '☀︎/🌙';
  btn.title = 'Toggle theme';
  btn.style.marginRight = '6px';
  ($('.brand') || $('.topbar') || document.body).appendChild(btn);

  const KEY_THEME = 'screenplay:theme';
  const saved = localStorage.getItem(KEY_THEME);
  if(saved === 'light') document.body.classList.add('light');

  btn.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    localStorage.setItem(KEY_THEME, document.body.classList.contains('light') ? 'light' : 'dark');
  });
})();

/* ---------- 2) Writing Analytics (Words/Chars/Scenes) ---------- */
(function injectMetrics(){
  const bar = document.querySelector('.statusbar');
  if(!bar) return;
  const box = document.createElement('span');
  box.className = 'status-metrics';
  box.innerHTML = `<span id="mWords">Words: 0</span><span id="mChars">Chars: 0</span><span id="mScenes">Scenes: 0</span>`;
  bar.appendChild(box);

  const count = ()=>{
    const t = editor.value;
    const words = (t.match(/\b[\w’'-]+\b/g) || []).length;
    const chars = t.length;
    const scenes = (t.match(/^(INT\.|EXT\.|INT\/EXT\.)/gmi) || []).length;
    $('#mWords').textContent = `Words: ${words}`;
    $('#mChars').textContent = `Chars: ${chars}`;
    $('#mScenes').textContent = `Scenes: ${scenes}`;
  };
  editor.addEventListener('input', count);
  document.addEventListener('DOMContentLoaded', count);
  count();
})();

/* ---------- 3) Find & Replace (Ctrl+F to open) ---------- */
(function injectFindReplace(){
  const panel = document.createElement('div');
  panel.className = 'find-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <input id="findText" placeholder="Find" />
    <input id="replaceText" placeholder="Replace" />
    <button id="findPrevBtn" title="Shift+Enter">Prev</button>
    <button id="findNextBtn" title="Enter">Next</button>
    <button id="replaceBtn">Replace</button>
    <button id="replaceAllBtn">All</button>
    <button id="closeFind">✕</button>
  `;
  document.body.appendChild(panel);

  let lastIndex = 0;
  const getText = ()=> editor.value;
  const setSel = (start, end)=>{ editor.focus(); editor.setSelectionRange(start, end); editor.scrollTop = editor.scrollHeight * (start / getText().length); };

  function findNext(back=false){
    const q = $('#findText').value;
    if(!q) return;
    const text = getText();
    const start = back ? Math.max(0, editor.selectionStart - 1) : Math.max(editor.selectionEnd, lastIndex);
    let idx = back ? text.lastIndexOf(q, start) : text.indexOf(q, start);
    if(idx === -1){ // wrap
      idx = back ? text.lastIndexOf(q) : text.indexOf(q);
    }
    if(idx !== -1){
      setSel(idx, idx + q.length);
      lastIndex = idx + (back ? 0 : q.length);
    }
  }
  function replaceSel(){
    const q = $('#findText').value; if(!q) return;
    const r = $('#replaceText').value ?? '';
    const {selectionStart:s, selectionEnd:e} = editor;
    if(e > s && editor.value.slice(s,e) === q){
      editor.setRangeText(r, s, e, 'end');
      triggerAutosave?.();
    }
  }
  function replaceAll(){
    const q = $('#findText').value; if(!q) return;
    const r = $('#replaceText').value ?? '';
    editor.value = getText().split(q).join(r);
    triggerAutosave?.();
  }

  // open/close
  function open(){ panel.style.display='flex'; $('#findText').focus(); $('#findText').select(); }
  function close(){ panel.style.display='none'; }

  document.addEventListener('keydown',(e)=>{
    if(e.ctrlKey && e.key.toLowerCase() === 'f'){ e.preventDefault(); open(); }
    if(e.key === 'Escape' && panel.style.display !== 'none'){ close(); }
    if(e.key === 'Enter' && panel.style.display !== 'none'){ e.preventDefault(); findNext(e.shiftKey); }
  });
  $('#findNextBtn').addEventListener('click',()=>findNext(false));
  $('#findPrevBtn').addEventListener('click',()=>findNext(true));
  $('#replaceBtn').addEventListener('click',replaceSel);
  $('#replaceAllBtn').addEventListener('click',replaceAll);
  $('#closeFind').addEventListener('click',close);
})();

/* ---------- 4) Scene Numbering (toggle add/update) ---------- */
(function injectSceneNumbering(){
  const btn = document.createElement('button');
  btn.id = 'sceneNumberBtn';
  btn.textContent = 'Number Scenes';
  btn.title = 'Auto-number INT./EXT. headings';
  ($('.actions') || $('.topbar') || document.body).appendChild(btn);

  btn.addEventListener('click', ()=>{
    const lines = editor.value.replace(/\r\n/g,'\n').split('\n');
    let n = 1;
    const out = lines.map(line=>{
      const m = line.match(/^\s*(\d+\.\s+)?(INT\.|EXT\.|INT\/EXT\.)\s*/i);
      if(m){
        // remove existing leading number like "12. "
        const cleaned = line.replace(/^\s*\d+\.\s+/, '');
        const numbered = `${n}. ${cleaned}`;
        n++;
        return numbered;
      }
      return line;
    }).join('\n');
    editor.value = out;
    triggerAutosave?.();
  });
})();

/* ---------- 5) Outline View (scene list, click to jump) ---------- */
(function injectOutline(){
  const sidebar = document.querySelector('.sidebar');
  if(!sidebar) return;
  const wrap = document.createElement('div');
  wrap.id = 'outline';
  wrap.innerHTML = `<h3>Outline</h3><ul id="outlineList"></ul>`;
  sidebar.appendChild(wrap);
  const list = $('#outlineList');

  function rebuild(){
    const lines = editor.value.replace(/\r\n/g,'\n').split('\n');
    list.innerHTML = '';
    let charCount = 0;
    lines.forEach((ln, i)=>{
      const m = ln.match(/^\s*(\d+\.\s+)?(INT\.|EXT\.|INT\/EXT\.)\s*(.*)$/i);
      const len = ln.length + 1; charCount += len;
      if(m){
        const item = document.createElement('li');
        const num = (m[1] || '').trim();
        const tail = (m[3] || '').trim();
        item.textContent = `${(num||'').replace('.','')} ${m[2].toUpperCase()} ${tail}`.trim();
        const pos = charCount - len; // approx char index at line start
        item.addEventListener('click', ()=>{
          editor.focus();
          editor.setSelectionRange(pos, pos);
        });
        list.appendChild(item);
      }
    });
  }
  editor.addEventListener('input', rebuild);
  rebuild();
})();

/* ---------- 6) Templates (insert starters) ---------- */
(function injectTemplates(){
  const dd = document.createElement('select');
  dd.id = 'templateSelect';
  dd.title = 'Insert template';
  dd.innerHTML = `
    <option value="">Templates…</option>
    <option value="feature">Feature Film</option>
    <option value="short">Short Film</option>
    <option value="tv">TV Pilot</option>
  `;
  ($('.actions') || $('.topbar') || document.body).appendChild(dd);

  const TPL = {
    feature: `TITLE: YOUR MOVIE

INT. LOCATION - DAY

Action line setting the scene.

                         PROTAGONIST
               (under their breath)
          First line of dialogue.

`,
    short: `TITLE: YOUR SHORT

EXT. PARK - EVENING

A simple moment.

                         ALEX
          Let's keep this tight.

`,
    tv: `SERIES TITLE: EPISODE 101

INT. WRITERS' ROOM - DAY

The room buzzes.

                         SHOWRUNNER
          Cold open. Let's go.

`
  };

  dd.addEventListener('change', ()=>{
    const v = dd.value; if(!v) return;
    if(confirm('Replace current content with template?')){
      editor.value = TPL[v];
      triggerAutosave?.();
    }
    dd.value = '';
  });
})();

/* ---------- 7) Script Breakdown (export simple JSON) ---------- */
(function injectBreakdown(){
  const btn = document.createElement('button');
  btn.id = 'breakdownBtn';
  btn.textContent = 'Breakdown JSON';
  btn.title = 'Export characters & scenes';
  ($('.actions') || $('.topbar') || document.body).appendChild(btn);

  btn.addEventListener('click', ()=>{
    const txt = editor.value.replace(/\r\n/g,'\n');
    const lines = txt.split('\n');

    const scenes = [];
    const characters = new Set();

    let current = null;
    lines.forEach(l=>{
      const scene = l.match(/^\s*(\d+\.\s+)?(INT\.|EXT\.|INT\/EXT\.)\s*(.*)$/i);
      if(scene){
        current = { heading: l.trim(), lines: [] };
        scenes.push(current);
      } else if(current){
        current.lines.push(l);
      }
      // naive character cue: all caps, short
      const cue = l.trim();
      if(/^[^a-z]*$/.test(cue) && /[A-Z]/.test(cue) && cue.length>0 && cue.length<=30 && !/^(INT\.|EXT\.|INT\/EXT\.)/i.test(cue)){
        characters.add(cue.replace(/\s+\(.*\)$/,'').trim());
      }
    });

    const data = {
      scenes: scenes.map(s=>({ heading: s.heading, length: s.lines.length })),
      characters: Array.from(characters).sort()
    };
    downloadBlob('breakdown.json', JSON.stringify(data, null, 2), 'application/json');
  });
})();
