(function (global) {
  'use strict';
  var App = global.App = global.App || {};

  // CONFIGURAZIONE FIREBASE
  //
  // Finche' i campi restano vuoti l'accesso NON e' attivo e l'app funziona
  // esattamente come prima: tutto in locale, nessun login, nessuna rete.
  // Compilando questi campi si accende la schermata di accesso.
  //
  // Questi valori NON sono segreti: identificano il progetto, non
  // autorizzano nulla. Chi protegge i dati sono le regole del database
  // (vedi firestore.rules), non il fatto di nascondere la chiave.
  //
  // Come ottenerli: console.firebase.google.com -> il tuo progetto ->
  // Impostazioni progetto -> Le tue app -> App web. Istruzioni passo passo
  // in ACCESSO.md.
  var CONFIG = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: ''
  };

  // Amministratori: chi vede i comandi di modifica nell'interfaccia.
  // ATTENZIONE: questo elenco serve SOLO a decidere cosa mostrare.
  // Il permesso vero lo danno le regole del database, che leggono la
  // raccolta "amministratori". Le due liste vanno tenute allineate,
  // ma se qui ci fosse un errore nessuno potrebbe comunque scrivere.
  var AMMINISTRATORI = [];

  function pulito(v) { return String(v || '').trim(); }

  // L'accesso e' attivo solo se la configurazione e' completa.
  function configurato() {
    return !!(pulito(CONFIG.apiKey) && pulito(CONFIG.authDomain) &&
      pulito(CONFIG.projectId) && pulito(CONFIG.appId));
  }

  function eAmministratore(email) {
    var e = pulito(email).toLowerCase();
    if (!e) return false;
    return AMMINISTRATORI.some(function (x) {
      return pulito(x).toLowerCase() === e;
    });
  }

  App.configFirebase = {
    CONFIG: CONFIG,
    AMMINISTRATORI: AMMINISTRATORI,
    configurato: configurato,
    eAmministratore: eAmministratore
  };
})(typeof window !== 'undefined' ? window : globalThis);
