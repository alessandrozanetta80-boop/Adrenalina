(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  // Registro unico degli store. Export/import e cancellazione dati demo
  // leggono da qui: aggiungere uno store in futuro non richiede toccarli.
  //
  // Nota: IndexedDB non accetta i booleani come chiavi di indice, quindi
  // "attivo" e "ospite" NON sono indicizzati e vengono filtrati in memoria.
  var STORES = [
    {
      nome: 'meta',
      keyPath: 'chiave',
      indici: [],
      versione: 1
    },
    {
      nome: 'squadre',
      keyPath: 'id',
      indici: [],
      versione: 1
    },
    {
      nome: 'stagioni',
      keyPath: 'id',
      indici: [
        { nome: 'by_squadra', keyPath: 'squadraId' },
        { nome: 'by_stato',   keyPath: 'stato' }
      ],
      versione: 1
    },
    {
      nome: 'membri',
      keyPath: 'id',
      indici: [
        { nome: 'by_squadra', keyPath: 'squadraId' },
        { nome: 'by_cognome', keyPath: 'cognome' }
      ],
      versione: 1
    },
    {
      nome: 'iscrizioni',
      keyPath: 'id',
      indici: [
        { nome: 'by_stagione', keyPath: 'stagioneId' },
        { nome: 'by_membro',   keyPath: 'membroId' },
        { nome: 'by_stagione_membro', keyPath: ['stagioneId', 'membroId'], opzioni: { unique: true } }
      ],
      versione: 1
    },
    // --- schema versione 2 ---
    {
      nome: 'giornate',
      keyPath: 'id',
      indici: [
        { nome: 'by_stagione', keyPath: 'stagioneId' },
        { nome: 'by_squadra',  keyPath: 'squadraId' },
        { nome: 'by_data',     keyPath: 'data' }
      ],
      versione: 2
    },
    {
      nome: 'presenze',
      keyPath: 'id',
      indici: [
        { nome: 'by_giornata', keyPath: 'giornataId' },
        { nome: 'by_membro',   keyPath: 'membroId' },
        { nome: 'by_giornata_membro', keyPath: ['giornataId', 'membroId'], opzioni: { unique: true } }
      ],
      versione: 2
    },
    // --- schema versione 3 ---
    {
      nome: 'abbattimenti',
      keyPath: 'id',
      indici: [
        { nome: 'by_stagione', keyPath: 'stagioneId' },
        { nome: 'by_giornata', keyPath: 'giornataId' },
        { nome: 'by_tiratore', keyPath: 'tiratoreMembroId' },
        // Il codice leggibile e' univoco dentro la stagione, non nell'app.
        { nome: 'by_stagione_codice', keyPath: ['stagioneId', 'codiceCapo'], opzioni: { unique: true } }
      ],
      versione: 3
    },
    // --- schema versione 4 ---
    {
      nome: 'controlliSanitari',
      keyPath: 'id',
      indici: [
        // Un solo controllo sanitario per capo.
        { nome: 'by_abbattimento', keyPath: 'abbattimentoId', opzioni: { unique: true } }
      ],
      versione: 4
    }
  ];

  App.data.schema = {
    dbName: 'adrenalinaDB',
    dbVersion: 4,
    stores: STORES,
    // Store introdotti da una specifica versione dello schema.
    storesDiVersione: function (v) {
      return STORES.filter(function (s) { return s.versione === v; });
    },
    nomiStore: STORES.map(function (s) { return s.nome; }),
    // Store inclusi nel file di backup (tutti).
    nomiStoreBackup: STORES.map(function (s) { return s.nome; }),
    // Store che contengono record marcabili demo.
    nomiStoreDemo: ['squadre', 'stagioni', 'membri', 'iscrizioni',
                    'giornate', 'presenze', 'abbattimenti', 'controlliSanitari']
  };
})(typeof window !== 'undefined' ? window : globalThis);
