(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // ID DETERMINISTICI
  //
  // Il database locale garantisce l'unicita' con gli indici (una sola
  // presenza per socio e giornata, un solo lotto per giornata, e cosi'
  // via). Un archivio condiviso come Firestore non ha indici unici:
  // l'unicita' si ottiene costruendo l'identificativo del documento a
  // partire dai dati che devono essere unici.
  //
  // Due amministratori che segnano lo stesso socio nella stessa giornata
  // calcolano lo stesso identificativo, quindi scrivono lo stesso
  // documento invece di crearne due.
  //
  // Nota: sono identificativi, non chiavi leggibili. Restano opachi.

  function pezzo(v) {
    return String(v || '').replace(/[^A-Za-z0-9_-]/g, '');
  }

  // presenze: una per giornata + socio
  function presenza(giornataId, membroId) {
    return 'pre_' + pezzo(giornataId) + '__' + pezzo(membroId);
  }

  // lotto carne: uno per giornata
  function lottoCarne(giornataId) {
    return 'lot_' + pezzo(giornataId);
  }

  // configurazione carne: una per stagione
  function configCarne(stagioneId) {
    return 'cfc_' + pezzo(stagioneId);
  }

  // calendario battute: uno per stagione
  function calendario(stagioneId) {
    return 'cal_' + pezzo(stagioneId);
  }

  // quota carne: una per lotto + socio
  function quotaCarne(lottoCarneId, membroId) {
    return 'qcr_' + pezzo(lottoCarneId) + '__' + pezzo(membroId);
  }

  // controllo sanitario: uno per capo
  function controlloSanitario(abbattimentoId) {
    return 'san_' + pezzo(abbattimentoId);
  }

  // iscrizione: una per stagione + socio
  function iscrizione(stagioneId, membroId) {
    return 'isc_' + pezzo(stagioneId) + '__' + pezzo(membroId);
  }

  // Quali store usano un identificativo calcolato, e come.
  var REGOLE = {
    presenze: function (r) { return presenza(r.giornataId, r.membroId); },
    lottiCarne: function (r) { return lottoCarne(r.giornataId); },
    configCarne: function (r) { return configCarne(r.stagioneId); },
    calendariBattuta: function (r) { return calendario(r.stagioneId); },
    quoteCarne: function (r) { return quotaCarne(r.lottoCarneId, r.membroId); },
    controlliSanitari: function (r) { return controlloSanitario(r.abbattimentoId); },
    iscrizioni: function (r) { return iscrizione(r.stagioneId, r.membroId); }
  };

  function deterministico(store) { return !!REGOLE[store]; }

  function calcola(store, record) {
    var fn = REGOLE[store];
    return fn ? fn(record) : null;
  }

  App.core.idDeterministici = {
    presenza: presenza,
    lottoCarne: lottoCarne,
    configCarne: configCarne,
    calendario: calendario,
    quotaCarne: quotaCarne,
    controlloSanitario: controlloSanitario,
    iscrizione: iscrizione,
    deterministico: deterministico,
    calcola: calcola,
    STORE: Object.keys(REGOLE)
  };
})(typeof window !== 'undefined' ? window : globalThis);
