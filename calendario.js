(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function due(n) { return (n < 10 ? '0' : '') + n; }

  // Data odierna nel fuso LOCALE del dispositivo, formato YYYY-MM-DD.
  // toISOString() converte in UTC: in Italia, dopo le 22:00 (ora legale)
  // restituirebbe il giorno successivo. Qui si usano i getter locali.
  function oggi(riferimento) {
    var d = riferimento || new Date();
    return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
  }

  // Vera esistenza della data sul calendario, non solo la forma.
  // Rifiuta 2026-02-31, 2026-13-10, 2026-00-10, 2025-02-29.
  function dataValida(iso) {
    if (typeof iso !== 'string') return false;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return false;
    var anno = Number(m[1]), mese = Number(m[2]), giorno = Number(m[3]);
    if (mese < 1 || mese > 12) return false;
    if (giorno < 1 || giorno > 31) return false;
    // Costruzione locale: se il giorno "trabocca" nel mese successivo,
    // la data non esiste.
    var d = new Date(anno, mese - 1, giorno);
    return d.getFullYear() === anno && d.getMonth() === mese - 1 && d.getDate() === giorno;
  }

  App.core.calendario = {
    oggi: oggi,
    dataValida: dataValida
  };
})(typeof window !== 'undefined' ? window : globalThis);
