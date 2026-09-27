// Hot-swap transform for the game's source files.
//
// The game is written as ~20 files that share one scope (they were concatenated into a single
// <script type="module">). In development each file is loaded as its own classic <script>, so they
// still share the global scope, and any single file can be re-run later to swap in new code:
//   • top-level const/let become var (a var can be declared again when the file is re-run)
//   • classes become `var X = class X {…}`
//   • on a hot re-run, each top-level value goes through __gvHot.v(), which keeps live state:
//       objects with methods (Player, Plane, Traffic…) get the new methods but keep their data,
//       Maps/Sets/three.js objects are kept, plain data tables/primitives take the new value
//   • on a hot re-run, other top-level statements (event listeners, one-time setup) are skipped
// Top-level statements are found by a small tokenizer: a new statement starts on a line whose first
// column is code at bracket depth 0 (the style every source file follows).

const KW_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'do', 'else', 'yield', 'await']);

// mask[i] = 1 when character i is code at bracket depth 0 (not inside a string, comment, regex or template)
export function scan(code) {
  const n = code.length, mask = new Uint8Array(n);
  let depth = 0; const tpl = []; // stack of bracket depths at which a template ${ } was opened
  let i = 0, prevSig = ''; // previous significant token (for regex detection)
  const isId = c => /[A-Za-z0-9_$]/.test(c);
  while (i < n) {
    const c = code[i], d = code[i + 1];
    if (depth === 0 && !tpl.length) mask[i] = 1;
    if (c === '/' && d === '/') { const e = code.indexOf('\n', i); for (let k = i; k < (e < 0 ? n : e); k++) mask[k] = 0; i = e < 0 ? n : e; continue; }
    if (c === '/' && d === '*') { const e = code.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; for (let k = i; k < end; k++) mask[k] = 0; i = end; continue; }
    if (c === '"' || c === "'") { mask[i] = 0; i++; while (i < n && code[i] !== c) { if (code[i] === '\\') i++; if (code[i] === '\n') break; i++; } i++; prevSig = 'str'; continue; }
    if (c === '`' || (c === '}' && tpl.length && tpl[tpl.length - 1] === depth)) {
      // template literal body (entered at ` or when a ${ } closes)
      if (c === '}') tpl.pop();
      mask[i] = 0; i++;
      while (i < n) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '`') { i++; break; }
        if (code[i] === '$' && code[i + 1] === '{') { i += 2; tpl.push(depth); break; }
        i++;
      }
      prevSig = 'str'; continue;
    }
    if (c === '/') {
      // regex literal or division?
      const regexOk = prevSig === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prevSig) || KW_BEFORE_REGEX.has(prevSig);
      if (regexOk) {
        mask[i] = 0; i++; let inClass = false;
        while (i < n) { const ch = code[i]; if (ch === '\\') { i += 2; continue; } if (ch === '[') inClass = true; else if (ch === ']') inClass = false; else if (ch === '/' && !inClass) { i++; break; } else if (ch === '\n') break; i++; }
        while (i < n && /[a-z]/.test(code[i])) i++;
        prevSig = 'regex'; continue;
      }
    }
    if (c === '(' || c === '[' || c === '{') { depth++; prevSig = c; i++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth = Math.max(0, depth - 1); prevSig = c; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (isId(c)) { let j = i; while (j < n && isId(code[j])) j++; prevSig = code.slice(i, j); if (/^\d/.test(prevSig)) prevSig = 'num'; i = j; continue; }
    prevSig = c; i++;
  }
  return mask;
}

// split a file into top-level statements: [{ start, end, text }]
export function chunks(code) {
  const mask = scan(code); const starts = [0];
  for (let i = 1; i < code.length; i++) {
    if (code[i - 1] !== '\n') continue;
    const c = code[i];
    if (!mask[i] && !(c === '/' && (code[i + 1] === '/' || code[i + 1] === '*'))) continue;
    if (/[A-Za-z_$]/.test(c) || (c === '/' && (code[i + 1] === '/' || code[i + 1] === '*'))) {
      // a comment line at column 0 only starts a chunk if we're at depth 0 there
      if (c === '/' && !isDepth0Before(mask, i)) continue;
      starts.push(i);
    }
  }
  const out = [];
  for (let k = 0; k < starts.length; k++) { const s = starts[k], e = k + 1 < starts.length ? starts[k + 1] : code.length; if (e > s) out.push({ start: s, end: e, text: code.slice(s, e) }); }
  return { mask, list: out };
}
function isDepth0Before(mask, i) { let k = i - 1; while (k >= 0 && !mask[k]) { k--; } return k < 0 || mask[k] === 1; }

const leadingTrivia = t => { const m = /^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/.exec(t); return m ? m[0].length : 0; };

// split `NAME = expr, NAME2 = expr2;` into declarators using the depth-0 mask
function declarators(text, off, mask) {
  const parts = []; let s = 0; let end = text.length;
  for (let i = 0; i < text.length; i++) {
    if (!mask[off + i]) continue;
    if (text[i] === ',') { parts.push(text.slice(s, i)); s = i + 1; }
    else if (text[i] === ';') { end = i; break; }
  }
  parts.push(text.slice(s, end));
  return { parts: parts.map(p => p.trim()).filter(Boolean), tail: text.slice(end) };
}

// names declared at the top level of a file (for collision checks)
export function topNames(code) {
  const { mask, list } = chunks(code); const names = [];
  for (const ch of list) {
    const lead = leadingTrivia(ch.text); const t = ch.text.slice(lead); let m;
    if ((m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(t))) names.push(m[1]);
    else if ((m = /^class\s+([A-Za-z_$][\w$]*)/.exec(t))) names.push(m[1]);
    else if ((m = /^(?:const|let|var)\s+/.exec(t))) for (const p of declarators(t.slice(m[0].length), ch.start + lead + m[0].length, mask).parts) { const mm = /^([A-Za-z_$][\w$]*)/.exec(p); if (mm) names.push(mm[1]); }
  }
  return names;
}

/**
 * transform(code, { hot }) → classic-script source
 *  hot=false: initial load (declarations as var, imports removed)
 *  hot=true : re-run of an edited file (values merged into the live ones, setup statements skipped)
 */
export function transform(code, { hot = false, effects: keepSetup = false, file = "" } = {}) {
  const { mask, list } = chunks(code);
  const out = []; const imports = [];
  // text of the file's plain statements (to see which values they fill in at load time)
  const effects = [];
  const kinds = list.map(ch => {
    const lead = leadingTrivia(ch.text); const t = ch.text.slice(lead);
    if (!t.trim()) return 'trivia';
    if (/^import[\s{*'"]/.test(t)) return 'import';
    if (/^(?:async\s+)?function[\s*]/.test(t)) return 'function';
    if (/^class\s/.test(t)) return 'class';
    if (/^(?:const|let|var)\s/.test(t)) return 'decl';
    effects.push(t); return 'effect';
  });
  const effectText = effects.join('\n');
  list.forEach((ch, k) => {
    const kind = kinds[k]; const lead = leadingTrivia(ch.text); const pre = ch.text.slice(0, lead), t = ch.text.slice(lead);
    if (kind === 'trivia' || kind === 'function') { out.push(ch.text); return; }
    if (kind === 'import') { imports.push(t.trim()); out.push(pre + '// (import provided by the dev loader)' + t.replace(/[^\n]/g, '')); return; }
    if (kind === 'class') {
      const name = /^class\s+([A-Za-z_$][\w$]*)/.exec(t)[1];
      // find the end of the class body (the depth-0 '}' that closes it)
      let end = t.length; for (let i = t.indexOf('{'); i < t.length; i++) { if (mask[ch.start + lead + i] && t[i] === '}') { end = i + 1; break; } }
      const body = t.slice(0, end), rest = t.slice(end);
      out.push(pre + (hot ? `var ${name} = __gvHot.cls(${JSON.stringify(name)}, typeof ${name} === 'undefined' ? undefined : ${name}, ${body});` : `var ${name} = ${body};`) + rest);
      return;
    }
    if (kind === 'decl') {
      const kw = /^(const|let|var)\s+/.exec(t); const body = t.slice(kw[0].length); const off = ch.start + lead + kw[0].length;
      const { parts, tail } = declarators(body, off, mask);
      const decl = parts.map(p => {
        const m = /^([A-Za-z_$][\w$]*)\s*(=([\s\S]*))?$/.exec(p);
        if (!m) return p; // destructuring etc.: plain re-declaration
        const name = m[1]; if (!m[2]) return name;
        const filled = new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b').test(effectText);
        return `${name} = __gvHot.v(${JSON.stringify(name)}, typeof ${name} === 'undefined' ? undefined : ${name}, () => (${m[3].trim()}\n), ${filled})`;
      });
      out.push(pre + 'var ' + decl.join(',\n  ') + (tail.startsWith(';') ? tail : ';' + tail));
      return;
    }
    // plain statement: runs on first load only
    out.push(hot && !keepSetup ? pre + '/* setup statement: runs on first load only */' + t.replace(/[^\n]/g, '') : ch.text);
  });
  return { code: out.join(''), imports };
}
