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

  // --- Fase 5: calendario battute ---
  // getDay() di JavaScript: 0 = domenica.
  var GIORNI_SETTIMANA = [
    { codice: 'LUNEDI',    etichetta: 'Lunedì',    breve: 'Lun', indice: 1 },
    { codice: 'MARTEDI',   etichetta: 'Martedì',   breve: 'Mar', indice: 2 },
    { codice: 'MERCOLEDI', etichetta: 'Mercoledì', breve: 'Mer', indice: 3 },
    { codice: 'GIOVEDI',   etichetta: 'Giovedì',   breve: 'Gio', indice: 4 },
    { codice: 'VENERDI',   etichetta: 'Venerdì',   breve: 'Ven', indice: 5 },
    { codice: 'SABATO',    etichetta: 'Sabato',    breve: 'Sab', indice: 6 },
    { codice: 'DOMENICA',  etichetta: 'Domenica',  breve: 'Dom', indice: 0 }
  ];

  // --- Fase 5: carne ---
  // Prezzi iniziali in centesimi al chilo. Sono solo il valore proposto:
  // ogni vendita salva il prezzo davvero applicato in quel momento.
  // Uscite fisiche di carne da un lotto. Tutte scalano il residuo.
  var TIPI_MOVIMENTO_CARNE = [
    { codice: 'RITIRO_CREDITO',        etichetta: 'Ritiro a credito',   richiedeSocio: true },
    { codice: 'CONSEGNA_SENZA_DIRITTO', etichetta: 'Consegna senza diritto', richiedeSocio: true },
    { codice: 'SALAMINI',              etichetta: 'Messa da parte per salamini', richiedeSocio: false }
  ];

  var TIPI_TAGLIO = [
    { codice: 'MEZZENA',    etichetta: 'Mezzena',    prezzoCentKg: 1000 },
    { codice: 'MACINATA',   etichetta: 'Macinata',   prezzoCentKg: 1200 },
    { codice: 'POLPA',      etichetta: 'Polpa',      prezzoCentKg: 1500 },
    { codice: 'SPEZZATINO', etichetta: 'Spezzatino', prezzoCentKg: 1500 }
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
    GIORNI_SETTIMANA: GIORNI_SETTIMANA,
    TIPI_TAGLIO: TIPI_TAGLIO,
    TIPI_MOVIMENTO_CARNE: TIPI_MOVIMENTO_CARNE,
    etichettaMovimentoCarne: function (c) { return etichettaDa(TIPI_MOVIMENTO_CARNE, c); },
    movimentoCarneValido: function (c) {
      return TIPI_MOVIMENTO_CARNE.some(function (t) { return t.codice === c; });
    },
    movimentoRichiedeSocio: function (c) {
      var t = TIPI_MOVIMENTO_CARNE.filter(function (x) { return x.codice === c; })[0];
      return t ? t.richiedeSocio : false;
    },
    OBBLIGO_VENDITA_GRAMMI_PREDEFINITO: 20000,
    CALENDARIO_NOME_PREDEFINITO: 'CA VCO1 — Cinghiale in battuta',
    etichettaGiorno: function (c) { return etichettaDa(GIORNI_SETTIMANA, c); },
    giornoValido: function (c) {
      return GIORNI_SETTIMANA.some(function (g) { return g.codice === c; });
    },
    indiceGiorno: function (c) {
      var g = GIORNI_SETTIMANA.filter(function (x) { return x.codice === c; })[0];
      return g ? g.indice : -1;
    },
    codiceGiornoDaIndice: function (i) {
      var g = GIORNI_SETTIMANA.filter(function (x) { return x.indice === i; })[0];
      return g ? g.codice : null;
    },
    etichettaTaglio: function (c) { return etichettaDa(TIPI_TAGLIO, c); },
    taglioValido: function (c) {
      return TIPI_TAGLIO.some(function (t) { return t.codice === c; });
    },
    prezzoPredefinito: function (c) {
      var t = TIPI_TAGLIO.filter(function (x) { return x.codice === c; })[0];
      return t ? t.prezzoCentKg : 0;
    },
    prezziPredefiniti: function () {
      var out = {};
      TIPI_TAGLIO.forEach(function (t) { out[t.codice] = t.prezzoCentKg; });
      return out;
    },
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
