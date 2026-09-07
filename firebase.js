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

  // NON esiste piu' un elenco di email nel frontend.
  // Chi puo' entrare lo dice esclusivamente il database: esiste il
  // documento /amministratori/{uid}? Allora entra. Altrimenti no.
  // Togliendo quel documento la persona non entra piu' al riavvio
  // successivo, senza toccare il codice.

  function pulito(v) { return String(v || '').trim(); }

  // L'accesso e' attivo solo se la configurazione e' completa.
  function configurato() {
    return !!(pulito(CONFIG.apiKey) && pulito(CONFIG.authDomain) &&
      pulito(CONFIG.projectId) && pulito(CONFIG.appId));
  }

  App.configFirebase = {
    CONFIG: CONFIG,
    configurato: configurato
  };
})(typeof window !== 'undefined' ? window : globalThis);
