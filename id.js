(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // Unica fonte di ID dell'applicazione.
  // Nessuna entita' genera ID per conto proprio.
  var _forzaFallback = false;   // usato solo dai test
  var _avvisatoMathRandom = false;

  function esadecimale(byte) {
    return (byte + 0x100).toString(16).slice(1);
  }

  function byteCasuali(n) {
    var c = global.crypto;
    var b = new Uint8Array(n);
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(b);
      return b;
    }
    // Ultima spiaggia: contesti senza Web Crypto (es. http:// su browser molto vecchi).
    if (!_avvisatoMathRandom && global.console) {
      _avvisatoMathRandom = true;
      global.console.warn('Web Crypto non disponibile: ID generati con Math.random (qualita' +
        ' inferiore). Usare un contesto sicuro o localhost.');
    }
    for (var i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  function uuidDaByte() {
    var b = byteCasuali(16);
    b[6] = (b[6] & 0x0f) | 0x40;   // versione 4
    b[8] = (b[8] & 0x3f) | 0x80;   // variante RFC 4122
    var h = [];
    for (var i = 0; i < 16; i++) h.push(esadecimale(b[i]));
    return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
           h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' +
           h.slice(10, 16).join('');
  }

  function uuid() {
    var c = global.crypto;
    if (!_forzaFallback && c && typeof c.randomUUID === 'function') {
      try { return c.randomUUID(); } catch (e) { /* si prosegue col fallback */ }
    }
    return uuidDaByte();
  }

  function nuovo(prefisso) {
    if (!prefisso) throw new Error('nuovoId richiede un prefisso di tipo.');
    return prefisso + '_' + uuid();
  }

  App.core.id = {
    nuovo: nuovo,
    uuid: uuid,
    SQUADRA: 'sqd',
    STAGIONE: 'stg',
    MEMBRO: 'mbr',
    ISCRIZIONE: 'isc',
    GIORNATA: 'gio',
    PRESENZA: 'pre',
    ABBATTIMENTO: 'abb',
    CONTROLLO: 'san',
    // solo per i test automatici
    _forzaFallback: function (v) { _forzaFallback = !!v; },
    _fallbackAttivo: function () { return _forzaFallback; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
