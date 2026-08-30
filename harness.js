// Harness di test. Gira SOLO con Node, non viene mai caricato da index.html.
// Carica la vera index.html in jsdom, con un IndexedDB simulato in memoria
// che sopravvive ai "refresh" per poter testare la persistenza.

const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
const nodeCrypto = require('crypto');

const RADICE = path.resolve(__dirname);

// Un solo "disco" condiviso fra tutti i refresh della stessa sessione di test.
function nuovoDisco() {
  return new FDBFactory();
}

const erroriConsole = [];

async function avviaApp(disco, opzioni = {}) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => erroriConsole.push('jsdomError: ' + e.message));
  virtualConsole.on('error', (...a) => erroriConsole.push('console.error: ' + a.join(' ')));
  virtualConsole.on('warn', (...a) => erroriConsole.push('console.warn: ' + a.join(' ')));

  const dom = await JSDOM.fromFile(path.join(RADICE, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.indexedDB = disco;
      window.IDBKeyRange = FDBKeyRange;
      window.structuredClone = structuredClone;
      Object.defineProperty(window, 'crypto', {
        configurable: true,
        value: opzioni.senzaRandomUUID
          ? { getRandomValues: (b) => nodeCrypto.webcrypto.getRandomValues(b) }
          : nodeCrypto.webcrypto
      });
      // jsdom non implementa createObjectURL: lo stubbiamo per il test di export.
      window.URL.createObjectURL = () => 'blob:finto';
      window.URL.revokeObjectURL = () => {};
    }
  });

  await attesa(dom, () => dom.window.App && dom.window.App.ui && dom.window.App.ui.router);
  await pausa(dom, 60);
  return dom;
}

function pausa(dom, ms) {
  return new Promise((r) => dom.window.setTimeout(r, ms));
}

// Attende che una condizione diventi vera, con timeout.
async function attesa(dom, fn, etichetta = 'condizione', limite = 4000) {
  const inizio = Date.now();
  while (Date.now() - inizio < limite) {
    let v;
    try { v = fn(); } catch (e) { v = false; }
    if (v) return v;
    await pausa(dom, 15);
  }
  throw new Error('Timeout in attesa di: ' + etichetta);
}

// Naviga e attende che la vista sia stata disegnata.
async function vaiA(dom, hash, testoAtteso) {
  dom.window.App.ui.router.vai(hash);
  await attesa(dom, () => {
    const t = dom.window.document.body.textContent || '';
    return testoAtteso ? t.includes(testoAtteso) : true;
  }, 'vista ' + hash + (testoAtteso ? ' con "' + testoAtteso + '"' : ''));
  await pausa(dom, 40);
}

function $(dom, sel) { return dom.window.document.querySelector(sel); }
function $$(dom, sel) { return Array.from(dom.window.document.querySelectorAll(sel)); }

function clic(dom, selOrEl) {
  const el = typeof selOrEl === 'string' ? $(dom, selOrEl) : selOrEl;
  if (!el) throw new Error('Elemento non trovato: ' + selOrEl);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}

function scrivi(dom, sel, valore) {
  const el = $(dom, sel);
  if (!el) throw new Error('Campo non trovato: ' + sel);
  el.value = valore;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  return el;
}

function spunta(dom, sel, valore) {
  const el = $(dom, sel);
  if (!el) throw new Error('Casella non trovata: ' + sel);
  el.checked = !!valore;
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  return el;
}

// Conferma il prossimo dialogo modale che compare.
async function confermaModale(dom, atteso = true) {
  await attesa(dom, () => $(dom, '.modale-fondo'), 'dialogo di conferma');
  clic(dom, atteso ? '[data-azione="si"]' : '[data-azione="no"]');
  await pausa(dom, 60);
}

module.exports = {
  RADICE, nuovoDisco, avviaApp, attesa, pausa, vaiA,
  $, $$, clic, scrivi, spunta, confermaModale, erroriConsole
};
