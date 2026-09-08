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
    },
    // --- schema versione 5: calendario battute e carne ---
    {
      nome: 'calendariBattuta',
      keyPath: 'id',
      indici: [
        { nome: 'by_stagione', keyPath: 'stagioneId', opzioni: { unique: true } }
      ],
      versione: 5
    },
    {
      nome: 'configCarne',
      keyPath: 'id',
      indici: [
        { nome: 'by_stagione', keyPath: 'stagioneId', opzioni: { unique: true } }
      ],
      versione: 5
    },
    {
      nome: 'lottiCarne',
      keyPath: 'id',
      indici: [
        // Al massimo un lotto carne per giornata.
        { nome: 'by_giornata', keyPath: 'giornataId', opzioni: { unique: true } },
        { nome: 'by_stagione', keyPath: 'stagioneId' }
      ],
      versione: 5
    },
    {
      nome: 'quoteCarne',
      keyPath: 'id',
      indici: [
        { nome: 'by_lotto',  keyPath: 'lottoCarneId' },
        { nome: 'by_membro', keyPath: 'membroId' },
        { nome: 'by_lotto_membro', keyPath: ['lottoCarneId', 'membroId'], opzioni: { unique: true } }
      ],
      versione: 5
    },
    {
      nome: 'venditeCarne',
      keyPath: 'id',
      indici: [
        { nome: 'by_lotto', keyPath: 'lottoCarneId' }
      ],
      versione: 5
    },
    {
      nome: 'ritiriCarne',
      keyPath: 'id',
      indici: [
        { nome: 'by_membro',   keyPath: 'membroId' },
        { nome: 'by_stagione', keyPath: 'stagioneId' },
        { nome: 'by_lotto',    keyPath: 'lottoCarneId' }
      ],
      versione: 5
    },
    // --- schema versione 6: sincronizzazione ---
    {
      // Coda locale delle modifiche non ancora inviate.
      nome: 'outbox',
      keyPath: 'operationId',
      indici: [
        { nome: 'by_stato', keyPath: 'stato' },
        { nome: 'by_creata', keyPath: 'creataIl' }
      ],
      versione: 6
    },
    {
      // Registro di cosa e' stato sincronizzato, da chi e con che esito.
      nome: 'audit',
      keyPath: 'id',
      indici: [
        { nome: 'by_quando', keyPath: 'quando' },
        { nome: 'by_operazione', keyPath: 'operationId' }
      ],
      versione: 6
    }
  ];

  App.data.schema = {
    dbName: 'adrenalinaDB',
    dbVersion: 6,
    stores: STORES,
    // Store introdotti da una specifica versione dello schema.
    storesDiVersione: function (v) {
      return STORES.filter(function (s) { return s.versione === v; });
    },
    nomiStore: STORES.map(function (s) { return s.nome; }),
    // Store inclusi nel file di backup (tutti).
    // Il backup contiene i dati della squadra, non la coda locale di
    // sincronizzazione ne' il registro: sono di questo dispositivo.
    nomiStoreBackup: STORES.map(function (s) { return s.nome; })
      .filter(function (n) { return n !== 'outbox' && n !== 'audit'; }),

    // Gli store che viaggiano fra i dispositivi. "meta" resta fuori:
    // contiene informazioni di questo telefono (versione dello schema,
    // squadra corrente, presenza dei dati di prova) e non ha nemmeno un
    // campo id, perche' e' indicizzato per chiave.
    nomiStoreCondivisi: STORES.map(function (s) { return s.nome; })
      .filter(function (n) {
        return n !== 'outbox' && n !== 'audit' && n !== 'meta';
      }),
    // Store che contengono record marcabili demo.
    nomiStoreDemo: ['squadre', 'stagioni', 'membri', 'iscrizioni',
                    'giornate', 'presenze', 'abbattimenti', 'controlliSanitari',
                    'calendariBattuta', 'configCarne', 'lottiCarne', 'quoteCarne',
                    'venditeCarne', 'ritiriCarne']
  };
})(typeof window !== 'undefined' ? window : globalThis);
