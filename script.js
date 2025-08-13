/* ========= Screenplay Writer =========
   - Autosave to localStorage
   - Upload/Download
   - Formatter sidebar (indent rules)
   - Keyboard shortcuts
===================================== */

const editor = document.getElementById('editor');
const upload = document.getElementById('upload');
const downloadBtn = document.getElementById('downloadBtn');
const downloadFormat = document.getElementById('downloadFormat');
const newBtn = document.getElementById('newBtn');
const autosaveState = document.getElementById('autosaveState');
const cursorPos = document.getElementById('cursorPos');

/* ---------- UTIL: caret helpers for <textarea> ---------- */
function getSelectionRange(el){
  return { start: el.selectionStart, end: el.selectionEnd };
}
function setSelection(el, start, end=start){
  el.focus(); el.setSelectionRange(start, end);
}
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

/* ---------- Screenplay tab stops (columns, 1-indexed) ---------- */
const COL = {
  DIALOG: 10,       // dialog block indent
  PAREN: 16,        // parenthetical
  SPEAKER: 22,      // character name
  TRANSITION: 60    // right-aligned-ish
};
function spaces(n){ return ' '.repeat(Math.max(0, n)); }
function padToColumn(targetCol){
  // Begin a new line, then pad to (targetCol-1) spaces (since column indexing starts at 1)
  return '\n' + spaces(targetCol - 1);
}
function rightAlign(text, targetCol = COL.TRANSITION){
  const currentLen = text.length;
  const pad = Math.max(1, targetCol - currentLen);
  return '\n' + spaces(pad) + text.toUpperCase();
}

/* ---------- Formatter actions ---------- */
const actions = {
  header(){
    const snippet = '\nINT. LOCATION - DAY\n';
    insertAtCursor(editor, snippet);
  },
  action(){
    const snippet = '\nAction line describing what happens.\n';
    insertAtCursor(editor, snippet);
  },
  speaker(){
    const snippet = padToColumn(COL.SPEAKER) + 'CHARACTER NAME\n';
    insertAtCursor(editor, snippet);
  },
  parentheses(){
    const snippet = padToColumn(COL.PAREN) + '(quietly)\n';
    insertAtCursor(editor, snippet);
  },
  dialog(){
    const snippet = padToColumn(COL.DIALOG) + 'This is a line of dialogue.\n';
    insertAtCursor(editor, snippet);
  },
  newchar(){
    const snippet = padToColumn(COL.SPEAKER) + 'NEW CHARACTER\n' + padToColumn(COL.PAREN) + '(introducing)\n';
    insertAtCursor(editor, snippet);
  },
  vfx(){
    const snippet = '\nSFX: THUNDER CRACKS.\n';
    insertAtCursor(editor, snippet);
  },
  fadein(){
    insertAtCursor(editor, rightAlign('FADE IN:') + '\n');
  },
  cutto(){
    insertAtCursor(editor, rightAlign('CUT TO:') + '\n');
  },
  fadeout(){
    insertAtCursor(editor, rightAlign('FADE OUT.') + '\n');
  }
};

/* ---------- Wire sidebar buttons ---------- */
document.querySelectorAll('[data-action]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const action = btn.getAttribute('data-action');
    actions[action] && actions[action]();
  });
});

/* ---------- Autosave (localStorage) ---------- */
const KEY = 'screenplay:autosave:v1';
let saveTimer = null;

function triggerAutosave(){
  clearTimeout(saveTimer);
  autosaveState.textContent = 'Saving…';
  saveTimer = setTimeout(()=>{
    try {
      localStorage.setItem(KEY, editor.value);
      autosaveState.textContent = 'Saved';
    } catch (e) {
      autosaveState.textContent = 'Not saved (storage full?)';
    }
  }, 300);
}

function loadAutosave(){
  const data = localStorage.getItem(KEY);
  if(data) editor.value = data;
}
loadAutosave();

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

/* ---------- Upload (continue writing) ---------- */
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
  // reset to allow re-uploading the same file if needed
  upload.value = '';
});

/* ---------- Download ---------- */
function downloadText(filename, text){
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

downloadBtn.addEventListener('click', ()=>{
  const ext = downloadFormat.value === 'fountain' ? 'fountain' : 'txt';
  const filename = `script.${ext}`;
  downloadText(filename, editor.value);
});

/* ---------- New (clear editor) ---------- */
newBtn.addEventListener('click', ()=>{
  if(confirm('Clear the editor? Unsaved changes will be lost (download first if needed).')){
    editor.value = '';
    triggerAutosave();
    updateCursorDisplay();
  }
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

/* Initial cursor display */
updateCursorDisplay();