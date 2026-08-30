(function (global) {
  'use strict';
  var App = global.App;

  // Ruoli venatori: un membro puo' averne piu' di uno nella stessa stagione.
  // "Ospite" NON e' un ruolo: e' un booleano separato sull'iscrizione.
  var RUOLI_VENATORI = [
    { codice: 'CAPOSQUADRA',      etichetta: 'Caposquadra' },
    { codice: 'VICE_CAPOSQUADRA', etichetta: 'Vice Caposquadra' },
    { codice: 'CANARO',           etichetta: 'Canaro' },
    { codice: 'POSTAIOLO',        etichetta: 'Postaiolo' },
    { codice: 'CACCIATORE',       etichetta: 'Cacciatore' },
    { codice: 'MEMBRO_SQUADRA',   etichetta: 'Membro Squadra' }
  ];

  // Livello di accesso gestionale: sta sul MEMBRO, non sull'iscrizione.
  var LIVELLI_ACCESSO = [
    { codice: 'AMMINISTRATORE', etichetta: 'Amministratore' },
    { codice: 'GESTORE',        etichetta: 'Gestore' },
    { codice: 'MEMBRO',         etichetta: 'Membro' }
  ];

  var STATI_STAGIONE = [
    { codice: 'attiva', etichetta: 'Attiva' },
    { codice: 'chiusa', etichetta: 'Chiusa' }
  ];

  // --- Fase 2: giornate e presenze ---
  var STATI_GIORNATA = [
    { codice: 'PROGRAMMATA', etichetta: 'Programmata' },
    { codice: 'COMPLETATA',  etichetta: 'Completata' },
    { codice: 'ANNULLATA',   etichetta: 'Annullata' }
  ];

  // Nel database si salvano i codici semantici, mai le sigle X/A/L
  // usate sui registri cartacei. La sigla resta solo un'etichetta di lettura.
  var STATI_PRESENZA = [
    { codice: 'PRESENTE',    etichetta: 'Presente',    sigla: 'X' },
    { codice: 'ASSENTE',     etichetta: 'Assente',     sigla: 'A' },
    { codice: 'LAVORO',      etichetta: 'Lavoro',      sigla: 'L' },
    { codice: 'NON_SEGNATO', etichetta: 'Non segnato', sigla: '\u2014' }
  ];

  var STATO_PRESENZA = {
    PRESENTE: 'PRESENTE',
    ASSENTE: 'ASSENTE',
    LAVORO: 'LAVORO',
    NON_SEGNATO: 'NON_SEGNATO'
  };

  // --- Fase 3: registro capi ---
  var SESSI = [
    { codice: 'MASCHIO',         etichetta: 'Maschio' },
    { codice: 'FEMMINA',         etichetta: 'Femmina' },
    { codice: 'NON_DETERMINATO', etichetta: 'Non determinato' }
  ];

  // Lista volutamente semplice: verro e scrofa si ricavano da sesso + ADULTO,
  // quindi non esistono classi duplicate.
  var CLASSI_ETA = [
    { codice: 'PICCOLO',          etichetta: 'Piccolo' },
    { codice: 'SUBADULTO',        etichetta: 'Subadulto' },
    { codice: 'ADULTO',           etichetta: 'Adulto' },
    { codice: 'NON_DETERMINATA',  etichetta: 'Non determinata' }
  ];

  // --- Fase 4: controllo sanitario ---
  // "Non registrato" NON e' uno stato memorizzato: e' l'assenza del record.
  var STATI_TRICHINELLA = [
    { codice: 'NON_PRELEVATO',     etichetta: 'Non prelevato' },
    { codice: 'IN_ATTESA',         etichetta: 'In attesa' },
    { codice: 'NEGATIVO_CONFORME', etichetta: 'Negativo / Conforme' },
    { codice: 'POSITIVO',          etichetta: 'Positivo' },
    { codice: 'NON_VALUTABILE',    etichetta: 'Non valutabile' }
  ];

  var STATO_QUOTA = {
    NON_APPLICABILE: 'NON_APPLICABILE',
    NON_PAGATA: 'NON_PAGATA',
    PARZIALE: 'PARZIALE',
    PAGATA: 'PAGATA'
  };

  var ETICHETTE_STATO_QUOTA = {
    NON_APPLICABILE: 'Non applicabile',
    NON_PAGATA: 'Non pagata',
    PARZIALE: 'Parziale',
    PAGATA: 'Pagata'
  };

  function etichettaDa(lista, codice) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].codice === codice) return lista[i].etichetta;
    }
    return codice || '—';
  }

  App.costanti = {
    RUOLI_VENATORI: RUOLI_VENATORI,
    STATI_GIORNATA: STATI_GIORNATA,
    SESSI: SESSI,
    STATI_TRICHINELLA: STATI_TRICHINELLA,
    STATO_TRICHINELLA_PREDEFINITO: 'IN_ATTESA',
    ETICHETTA_SANITARIO_ASSENTE: 'Non registrato',
    etichettaStatoTrichinella: function (c) { return etichettaDa(STATI_TRICHINELLA, c); },
    statoTrichinellaValido: function (c) {
      return STATI_TRICHINELLA.some(function (r) { return r.codice === c; });
    },
    CLASSI_ETA: CLASSI_ETA,
    PREFISSO_CODICE_CAPO: 'CG',
    // Protezione tecnica contro input assurdi, non un limite biologico.
    PESO_MASSIMO_GRAMMI: 500000,
    etichettaSesso: function (c) { return etichettaDa(SESSI, c); },
    etichettaClasseEta: function (c) { return etichettaDa(CLASSI_ETA, c); },
    sessoValido: function (c) {
      return SESSI.some(function (r) { return r.codice === c; });
    },
    classeEtaValida: function (c) {
      return CLASSI_ETA.some(function (r) { return r.codice === c; });
    },
    STATI_PRESENZA: STATI_PRESENZA,
    STATO_PRESENZA: STATO_PRESENZA,
    STATO_GIORNATA_PREDEFINITO: 'PROGRAMMATA',
    ORARIO_RITROVO_PREDEFINITO: '06:30',
    etichettaStatoGiornata: function (c) { return etichettaDa(STATI_GIORNATA, c); },
    etichettaStatoPresenza: function (c) { return etichettaDa(STATI_PRESENZA, c); },
    statoGiornataValido: function (c) {
      return STATI_GIORNATA.some(function (r) { return r.codice === c; });
    },
    statoPresenzaValido: function (c) {
      return STATI_PRESENZA.some(function (r) { return r.codice === c; });
    },
    LIVELLI_ACCESSO: LIVELLI_ACCESSO,
    STATI_STAGIONE: STATI_STAGIONE,
    STATO_QUOTA: STATO_QUOTA,
    ETICHETTE_STATO_QUOTA: ETICHETTE_STATO_QUOTA,
    RUOLO_PREDEFINITO: 'MEMBRO_SQUADRA',
    LIVELLO_PREDEFINITO: 'MEMBRO',
    etichettaRuolo: function (c) { return etichettaDa(RUOLI_VENATORI, c); },
    etichettaLivello: function (c) { return etichettaDa(LIVELLI_ACCESSO, c); },
    etichettaStatoQuota: function (c) { return ETICHETTE_STATO_QUOTA[c] || c; },
    ruoloValido: function (c) {
      return RUOLI_VENATORI.some(function (r) { return r.codice === c; });
    },
    livelloValido: function (c) {
      return LIVELLI_ACCESSO.some(function (r) { return r.codice === c; });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
