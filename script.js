/* ========= Screenplay Writer =========
   - Script content ONLY in 12pt Courier New (CSS .script-area)
   - Autosave to localStorage
   - Upload/Download (.txt or .fountain)
   - PDF export (jsPDF; Courier 12; screenplay margins)
   - FDX export (Final Draft XML)
   - Formatter sidebar + mobile slide-in panel
   - Keyboard shortcuts
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
    if(k === 's'){ e.preventDefault(); downloadBtn.click(); }
    if(k === 'n'){ e.preventDefault(); newBtn.click(); }
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
