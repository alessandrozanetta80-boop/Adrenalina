(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function schemaApp() { return App.data.schema; }

  // ---------- ESPORTAZIONE ----------
  function costruisciBackup() {
    var nomi = schemaApp().nomiStoreBackup;
    return App.data.repo.leggiStore(nomi).then(function (dati) {
      return {
        formato: App.versione.FORMATO_BACKUP,
        schemaVersion: App.versione.SCHEMA_VERSION,
        appVersion: App.versione.APP_VERSION,
        esportatoIl: new Date().toISOString(),
        dati: dati
      };
    });
  }

  function nomeFileBackup() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'adrenalina-backup-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' +
           p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  }

  // ---------- VALIDAZIONE IMPORT ----------
  // Nessun backup non valido deve mai arrivare alla transazione di clear+write.
  // La validazione e' in due parti:
  //   1) involucro   -> formato, schemaVersion, presenza degli store obbligatori;
  //   2) struttura   -> campi obbligatori, tipi, e integrita' referenziale.
  // La parte 2 gira sull'oggetto GIA' migrato, cosi' le regole applicate sono
  // sempre quelle dello schema corrente.

  // Store obbligatori per ciascuna versione di schema. Un backup di Fase 1
  // (schema 1) non contiene giornate e presenze: le aggiunge la migrazione.
  var STORE_OBBLIGATORI = {
    1: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni'],
    2: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze'],
    3: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
        'abbattimenti'],
    4: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
        'abbattimenti', 'controlliSanitari'],
    5: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
        'abbattimenti', 'controlliSanitari', 'calendariBattuta', 'configCarne',
        'lottiCarne', 'quoteCarne', 'venditeCarne', 'ritiriCarne'],
    // Lo schema 6 non aggiunge store: aggiunge campi ai record esistenti.
    6: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
        'abbattimenti', 'controlliSanitari', 'calendariBattuta', 'configCarne',
        'lottiCarne', 'quoteCarne', 'venditeCarne', 'ritiriCarne'],
    // Lo schema 7 non aggiunge store: rinomina un campo delle vendite.
    7: ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
        'abbattimenti', 'controlliSanitari', 'calendariBattuta', 'configCarne',
        'lottiCarne', 'quoteCarne', 'venditeCarne', 'ritiriCarne']
  };
  var MAX_ERRORI = 12;

  function storeObbligatori(schemaVersion) {
    return STORE_OBBLIGATORI[schemaVersion] || STORE_OBBLIGATORI[App.versione.SCHEMA_VERSION];
  }

  function idValido(v) {
    return typeof v === 'string' && v.trim() !== '';
  }

  function interoNonNegativo(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0;
  }

  function interoPositivo(v) {
    return interoNonNegativo(v) && v > 0;
  }

  function etichetta(rec, i) {
    return idValido(rec && rec.id) ? '"' + rec.id + '"' : 'in posizione ' + (i + 1);
  }

  // Controlla involucro e presenza degli store obbligatori.
  function validaInvolucro(oggetto) {
    var errori = [];
    if (!oggetto || typeof oggetto !== 'object' || Array.isArray(oggetto)) {
      return ['Il file non contiene un backup valido.'];
    }
    if (oggetto.formato !== App.versione.FORMATO_BACKUP) {
      errori.push('Formato non riconosciuto: il file non \u00e8 un backup di Adrenalina.');
    }
    if (typeof oggetto.schemaVersion !== 'number' ||
        !isFinite(oggetto.schemaVersion) ||
        Math.floor(oggetto.schemaVersion) !== oggetto.schemaVersion ||
        oggetto.schemaVersion < 1) {
      errori.push('Versione dello schema mancante o non valida.');
    } else if (oggetto.schemaVersion > App.versione.SCHEMA_VERSION) {
      errori.push('Il backup proviene da una versione pi\u00f9 recente dell\u2019app (schema ' +
        oggetto.schemaVersion + '). Aggiorna l\u2019app prima di importarlo.');
    }
    if (!oggetto.dati || typeof oggetto.dati !== 'object' || Array.isArray(oggetto.dati)) {
      errori.push('Il backup non contiene la sezione dati.');
      return errori;
    }
    storeObbligatori(oggetto.schemaVersion).forEach(function (n) {
      if (oggetto.dati[n] === undefined) {
        errori.push('Sezione obbligatoria mancante: "' + n + '".');
      } else if (!Array.isArray(oggetto.dati[n])) {
        errori.push('La sezione "' + n + '" non \u00e8 una lista.');
      }
    });
    return errori;
  }

  // Controlla struttura e integrita' referenziale dei record.
  function validaStruttura(dati) {
    var errori = [];
    function segnala(msg) {
      if (errori.length < MAX_ERRORI) errori.push(msg);
    }

    // --- squadre ---
    var squadrePerId = {};
    (dati.squadre || []).forEach(function (sq, i) {
      if (!sq || typeof sq !== 'object') { segnala('Squadra non valida ' + etichetta(sq, i) + '.'); return; }
      if (!idValido(sq.id)) { segnala('Squadra senza id valido ' + etichetta(sq, i) + '.'); return; }
      if (squadrePerId[sq.id]) { segnala('Due squadre con lo stesso id "' + sq.id + '".'); return; }
      squadrePerId[sq.id] = sq;
    });

    // --- stagioni ---
    var stagioniPerId = {};
    (dati.stagioni || []).forEach(function (st, i) {
      if (!st || typeof st !== 'object') { segnala('Stagione non valida ' + etichetta(st, i) + '.'); return; }
      if (!idValido(st.id)) { segnala('Stagione senza id valido ' + etichetta(st, i) + '.'); return; }
      if (stagioniPerId[st.id]) { segnala('Due stagioni con lo stesso id "' + st.id + '".'); return; }
      if (!idValido(st.squadraId)) {
        segnala('Stagione ' + etichetta(st, i) + ' senza squadraId.');
        return;
      }
      if (!squadrePerId[st.squadraId]) {
        segnala('La stagione ' + etichetta(st, i) + ' punta a una squadra inesistente.');
        return;
      }
      if (!interoNonNegativo(st.quotaAnnualePredefinitaCent)) {
        segnala('La stagione ' + etichetta(st, i) +
          ' ha una quota predefinita non valida: deve essere un intero in centesimi.');
      }
      stagioniPerId[st.id] = st;
    });

    // --- squadra.stagioneAttivaId ---
    Object.keys(squadrePerId).forEach(function (idSq) {
      var sq = squadrePerId[idSq];
      if (sq.stagioneAttivaId === null || sq.stagioneAttivaId === undefined) return;
      var st = stagioniPerId[sq.stagioneAttivaId];
      if (!st) {
        segnala('La squadra "' + idSq + '" ha come stagione attiva una stagione inesistente.');
      } else if (st.squadraId !== idSq) {
        segnala('La squadra "' + idSq + '" ha come stagione attiva una stagione di un\u2019altra squadra.');
      }
    });

    // --- membri ---
    var membriPerId = {};
    (dati.membri || []).forEach(function (m, i) {
      if (!m || typeof m !== 'object') { segnala('Socio non valido ' + etichetta(m, i) + '.'); return; }
      if (!idValido(m.id)) { segnala('Socio senza id valido ' + etichetta(m, i) + '.'); return; }
      if (membriPerId[m.id]) { segnala('Due soci con lo stesso id "' + m.id + '".'); return; }
      if (!idValido(m.squadraId)) { segnala('Socio ' + etichetta(m, i) + ' senza squadraId.'); return; }
      if (!squadrePerId[m.squadraId]) {
        segnala('Il socio ' + etichetta(m, i) + ' punta a una squadra inesistente.');
        return;
      }
      if (!App.costanti.livelloValido(m.livelloAccessoApp)) {
        segnala('Il socio ' + etichetta(m, i) + ' ha un livello di accesso non riconosciuto.');
      }
      membriPerId[m.id] = m;
    });

    // --- iscrizioni ---
    var coppieViste = {};
    var iscrizioniPerId = {};
    // "stagioneId|membroId" -> true, usato anche per validare le presenze.
    var iscrittiPerStagione = {};
    (dati.iscrizioni || []).forEach(function (isc, i) {
      if (!isc || typeof isc !== 'object') { segnala('Iscrizione non valida ' + etichetta(isc, i) + '.'); return; }
      if (!idValido(isc.id)) { segnala('Iscrizione senza id valido ' + etichetta(isc, i) + '.'); return; }
      if (iscrizioniPerId[isc.id]) { segnala('Due iscrizioni con lo stesso id "' + isc.id + '".'); return; }
      iscrizioniPerId[isc.id] = true;

      if (!idValido(isc.stagioneId) || !idValido(isc.membroId)) {
        segnala('Iscrizione ' + etichetta(isc, i) + ' senza stagioneId o membroId.');
        return;
      }
      if (!stagioniPerId[isc.stagioneId]) {
        segnala('Iscrizione ' + etichetta(isc, i) + ' collegata a una stagione inesistente.');
        return;
      }
      if (!membriPerId[isc.membroId]) {
        segnala('Iscrizione ' + etichetta(isc, i) + ' collegata a un socio inesistente.');
        return;
      }
      // Un socio non puo' risultare iscritto alla stagione di un'altra squadra.
      if (membriPerId[isc.membroId].squadraId !== stagioniPerId[isc.stagioneId].squadraId) {
        segnala('Iscrizione ' + etichetta(isc, i) +
          ': il socio e la stagione appartengono a squadre diverse.');
        return;
      }
      var coppia = isc.stagioneId + '|' + isc.membroId;
      if (coppieViste[coppia]) {
        segnala('Due iscrizioni per lo stesso socio nella stessa stagione.');
      }
      coppieViste[coppia] = true;
      iscrittiPerStagione[coppia] = true;

      if (!Array.isArray(isc.ruoliVenatori) || isc.ruoliVenatori.length === 0) {
        segnala('Iscrizione ' + etichetta(isc, i) + ': ruoliVenatori deve essere una lista non vuota.');
      } else {
        var ignoti = isc.ruoliVenatori.filter(function (r) { return !App.costanti.ruoloValido(r); });
        if (ignoti.length) {
          segnala('Iscrizione ' + etichetta(isc, i) + ': ruolo non riconosciuto "' + ignoti[0] + '".');
        }
      }
      if (!interoNonNegativo(isc.quotaAnnualePrevistaCent)) {
        segnala('Iscrizione ' + etichetta(isc, i) +
          ': quota prevista non valida, deve essere un intero in centesimi.');
      }
      if (!interoNonNegativo(isc.quotaVersataCent)) {
        segnala('Iscrizione ' + etichetta(isc, i) +
          ': quota versata non valida, deve essere un intero in centesimi.');
      }
    });

    // --- giornate ---
    var giornatePerId = {};
    (dati.giornate || []).forEach(function (g, i) {
      if (!g || typeof g !== 'object') { segnala('Giornata non valida ' + etichetta(g, i) + '.'); return; }
      if (!idValido(g.id)) { segnala('Giornata senza id valido ' + etichetta(g, i) + '.'); return; }
      if (giornatePerId[g.id]) { segnala('Due giornate con lo stesso id "' + g.id + '".'); return; }
      if (!idValido(g.squadraId) || !idValido(g.stagioneId)) {
        segnala('Giornata ' + etichetta(g, i) + ' senza squadraId o stagioneId.');
        return;
      }
      if (!squadrePerId[g.squadraId]) {
        segnala('La giornata ' + etichetta(g, i) + ' punta a una squadra inesistente.');
        return;
      }
      var st = stagioniPerId[g.stagioneId];
      if (!st) {
        segnala('La giornata ' + etichetta(g, i) + ' punta a una stagione inesistente.');
        return;
      }
      if (st.squadraId !== g.squadraId) {
        segnala('La giornata ' + etichetta(g, i) +
          ' \u00e8 legata a una stagione di un\u2019altra squadra.');
        return;
      }
      if (!App.core.calendario.dataValida(g.data)) {
        segnala('La giornata ' + etichetta(g, i) + ' ha una data mancante o non valida.');
      }
      if (!App.costanti.statoGiornataValido(g.stato)) {
        segnala('La giornata ' + etichetta(g, i) + ' ha uno stato non riconosciuto.');
      }
      if (g.capocacciaMembroId !== null && g.capocacciaMembroId !== undefined) {
        var cc = membriPerId[g.capocacciaMembroId];
        if (!cc) {
          segnala('La giornata ' + etichetta(g, i) + ' ha un capocaccia inesistente.');
        } else if (cc.squadraId !== g.squadraId) {
          segnala('La giornata ' + etichetta(g, i) +
            ' ha un capocaccia di un\u2019altra squadra.');
        }
      }
      giornatePerId[g.id] = g;
    });

    // --- presenze ---
    var presenzePerId = {};
    var coppiePresenza = {};
    (dati.presenze || []).forEach(function (p, i) {
      if (!p || typeof p !== 'object') { segnala('Presenza non valida ' + etichetta(p, i) + '.'); return; }
      if (!idValido(p.id)) { segnala('Presenza senza id valido ' + etichetta(p, i) + '.'); return; }
      if (presenzePerId[p.id]) { segnala('Due presenze con lo stesso id "' + p.id + '".'); return; }
      presenzePerId[p.id] = true;

      if (!idValido(p.giornataId) || !idValido(p.membroId)) {
        segnala('Presenza ' + etichetta(p, i) + ' senza giornataId o membroId.');
        return;
      }
      var g = giornatePerId[p.giornataId];
      if (!g) {
        segnala('Presenza ' + etichetta(p, i) + ' collegata a una giornata inesistente.');
        return;
      }
      var m = membriPerId[p.membroId];
      if (!m) {
        segnala('Presenza ' + etichetta(p, i) + ' collegata a un socio inesistente.');
        return;
      }
      if (m.squadraId !== g.squadraId) {
        segnala('Presenza ' + etichetta(p, i) +
          ': il socio e la giornata appartengono a squadre diverse.');
        return;
      }
      if (!iscrittiPerStagione[g.stagioneId + '|' + p.membroId]) {
        segnala('Presenza ' + etichetta(p, i) +
          ': il socio non \u00e8 iscritto alla stagione della giornata.');
        return;
      }
      var coppia = p.giornataId + '|' + p.membroId;
      if (coppiePresenza[coppia]) {
        segnala('Due presenze per lo stesso socio nella stessa giornata.');
      }
      coppiePresenza[coppia] = true;

      if (!App.costanti.statoPresenzaValido(p.stato)) {
        segnala('Presenza ' + etichetta(p, i) + ': stato non riconosciuto.');
      } else if (p.stato === App.costanti.STATO_PRESENZA.NON_SEGNATO) {
        // NON_SEGNATO non si memorizza mai: e' l'assenza del record.
        segnala('Presenza ' + etichetta(p, i) +
          ': NON_SEGNATO non deve essere salvato come record.');
      }
    });

    // --- abbattimenti ---
    var capiPerId = {};
    var codiciPerStagione = {};
    (dati.abbattimenti || []).forEach(function (a, i) {
      if (!a || typeof a !== 'object') { segnala('Abbattimento non valido ' + etichetta(a, i) + '.'); return; }
      if (!idValido(a.id)) { segnala('Abbattimento senza id valido ' + etichetta(a, i) + '.'); return; }
      if (capiPerId[a.id]) { segnala('Due abbattimenti con lo stesso id "' + a.id + '".'); return; }
      capiPerId[a.id] = true;

      if (!idValido(a.codiceCapo)) {
        segnala('Abbattimento ' + etichetta(a, i) + ' senza codice capo.');
        return;
      }
      if (!idValido(a.squadraId) || !idValido(a.stagioneId) || !idValido(a.giornataId)) {
        segnala('Abbattimento ' + etichetta(a, i) + ' senza squadra, stagione o giornata.');
        return;
      }
      if (!squadrePerId[a.squadraId]) {
        segnala('Abbattimento ' + etichetta(a, i) + ' punta a una squadra inesistente.');
        return;
      }
      var stag = stagioniPerId[a.stagioneId];
      if (!stag) {
        segnala('Abbattimento ' + etichetta(a, i) + ' punta a una stagione inesistente.');
        return;
      }
      var gio = giornatePerId[a.giornataId];
      if (!gio) {
        segnala('Abbattimento ' + etichetta(a, i) + ' punta a una giornata inesistente.');
        return;
      }
      if (gio.squadraId !== a.squadraId) {
        segnala('Abbattimento ' + etichetta(a, i) +
          ': la giornata appartiene a un\u2019altra squadra.');
        return;
      }
      if (gio.stagioneId !== a.stagioneId) {
        segnala('Abbattimento ' + etichetta(a, i) +
          ': la giornata appartiene a un\u2019altra stagione.');
        return;
      }
      // Il codice leggibile e' univoco dentro la stagione, non fra stagioni.
      var chiaveCodice = a.stagioneId + '|' + a.codiceCapo;
      if (codiciPerStagione[chiaveCodice]) {
        segnala('Due capi con il codice "' + a.codiceCapo + '" nella stessa stagione.');
      }
      codiciPerStagione[chiaveCodice] = true;

      if (!idValido(a.tiratoreMembroId)) {
        segnala('Abbattimento ' + etichetta(a, i) + ' senza tiratore.');
        return;
      }
      var tir = membriPerId[a.tiratoreMembroId];
      if (!tir) {
        segnala('Abbattimento ' + etichetta(a, i) + ' ha un tiratore inesistente.');
        return;
      }
      if (tir.squadraId !== a.squadraId) {
        segnala('Abbattimento ' + etichetta(a, i) +
          ': il tiratore appartiene a un\u2019altra squadra.');
        return;
      }
      // Iscrizione alla stagione richiesta; la PRESENZA no, e' solo un
      // avviso nella UI e non una regola di integrita'.
      if (!iscrittiPerStagione[a.stagioneId + '|' + a.tiratoreMembroId]) {
        segnala('Abbattimento ' + etichetta(a, i) +
          ': il tiratore non \u00e8 iscritto alla stagione.');
        return;
      }
      if (!App.costanti.sessoValido(a.sesso)) {
        segnala('Abbattimento ' + etichetta(a, i) + ': sesso non riconosciuto.');
      }
      if (!App.costanti.classeEtaValida(a.classeEta)) {
        segnala('Abbattimento ' + etichetta(a, i) + ': classe di et\u00e0 non riconosciuta.');
      }
      if (!App.core.capo.pesoValido(a.pesoGrammi)) {
        segnala('Abbattimento ' + etichetta(a, i) +
          ': peso non valido, deve essere un intero in grammi entro ' +
          (App.costanti.PESO_MASSIMO_GRAMMI / 1000) + ' kg.');
      }
      if (typeof a.annullato !== 'boolean') {
        segnala('Abbattimento ' + etichetta(a, i) + ': il campo annullato deve essere vero o falso.');
      }
      if (a.recuperato !== undefined && typeof a.recuperato !== 'boolean') {
        segnala('Abbattimento ' + etichetta(a, i) +
          ': il campo recuperato deve essere vero o falso.');
      }
      if (a.caneMuta !== null && a.caneMuta !== undefined && typeof a.caneMuta !== 'string') {
        segnala('Abbattimento ' + etichetta(a, i) + ': cane/muta deve essere testo.');
      }
    });

    // --- controlli sanitari ---
    var controlliPerId = {};
    var controlloPerCapo = {};
    (dati.controlliSanitari || []).forEach(function (c, i) {
      if (!c || typeof c !== 'object') {
        segnala('Controllo sanitario non valido ' + etichetta(c, i) + '.'); return;
      }
      if (!idValido(c.id)) {
        segnala('Controllo sanitario senza id valido ' + etichetta(c, i) + '.'); return;
      }
      if (controlliPerId[c.id]) {
        segnala('Due controlli sanitari con lo stesso id "' + c.id + '".'); return;
      }
      controlliPerId[c.id] = true;

      if (!idValido(c.abbattimentoId)) {
        segnala('Controllo sanitario ' + etichetta(c, i) + ' senza abbattimentoId.');
        return;
      }
      if (!capiPerId[c.abbattimentoId]) {
        segnala('Controllo sanitario ' + etichetta(c, i) + ' punta a un capo inesistente.');
        return;
      }
      // Un solo controllo per capo. Il capo puo' essere annullato: non e'
      // una condizione di integrita'.
      if (controlloPerCapo[c.abbattimentoId]) {
        segnala('Due controlli sanitari per lo stesso capo.');
      }
      controlloPerCapo[c.abbattimentoId] = true;

      if (!App.costanti.statoTrichinellaValido(c.statoTrichinella)) {
        segnala('Controllo sanitario ' + etichetta(c, i) + ': stato trichinella non riconosciuto.');
      }
      var prelievo = (c.dataPrelievo === null || c.dataPrelievo === undefined ||
        c.dataPrelievo === '') ? null : c.dataPrelievo;
      var esito = (c.dataEsito === null || c.dataEsito === undefined ||
        c.dataEsito === '') ? null : c.dataEsito;
      var prelievoOk = prelievo === null || App.core.calendario.dataValida(prelievo);
      var esitoOk = esito === null || App.core.calendario.dataValida(esito);
      if (!prelievoOk) {
        segnala('Controllo sanitario ' + etichetta(c, i) + ': data di prelievo non valida.');
      }
      if (!esitoOk) {
        segnala('Controllo sanitario ' + etichetta(c, i) + ': data di esito non valida.');
      }
      if (prelievoOk && esitoOk && prelievo !== null && esito !== null && esito < prelievo) {
        segnala('Controllo sanitario ' + etichetta(c, i) +
          ': la data di esito precede quella di prelievo.');
      }
      if (c.riferimentoCampione !== null && c.riferimentoCampione !== undefined &&
          typeof c.riferimentoCampione !== 'string') {
        segnala('Controllo sanitario ' + etichetta(c, i) +
          ': il riferimento campione deve essere testo.');
      }
      if (c.note !== null && c.note !== undefined && typeof c.note !== 'string') {
        segnala('Controllo sanitario ' + etichetta(c, i) + ': le note devono essere testo.');
      }
      if (c.demo !== undefined && typeof c.demo !== 'boolean') {
        segnala('Controllo sanitario ' + etichetta(c, i) +
          ': il campo demo deve essere vero o falso.');
      }
    });

    // --- calendari battuta ---
    var calendariPerId = {}, calendarioPerStagione = {};
    (dati.calendariBattuta || []).forEach(function (c, i) {
      if (!c || typeof c !== 'object' || !idValido(c.id)) {
        segnala('Calendario battute senza id valido ' + etichetta(c, i) + '.'); return;
      }
      if (calendariPerId[c.id]) { segnala('Due calendari con lo stesso id "' + c.id + '".'); return; }
      calendariPerId[c.id] = true;
      if (!idValido(c.stagioneId) || !stagioniPerId[c.stagioneId]) {
        segnala('Calendario ' + etichetta(c, i) + ' punta a una stagione inesistente.'); return;
      }
      if (calendarioPerStagione[c.stagioneId]) {
        segnala('Due calendari battute per la stessa stagione.');
      }
      calendarioPerStagione[c.stagioneId] = true;
      var cal = App.core.calendario;
      var iOk = cal.dataValida(c.dataInizio), fOk = cal.dataValida(c.dataFine);
      if (!iOk) segnala('Calendario ' + etichetta(c, i) + ': data di inizio non valida.');
      if (!fOk) segnala('Calendario ' + etichetta(c, i) + ': data di fine non valida.');
      if (iOk && fOk && c.dataFine < c.dataInizio) {
        segnala('Calendario ' + etichetta(c, i) + ': la data di fine precede quella di inizio.');
      }
      if (!Array.isArray(c.giorniSettimana) || c.giorniSettimana.length === 0) {
        segnala('Calendario ' + etichetta(c, i) + ': giorniSettimana deve essere una lista non vuota.');
      } else {
        var visti = {};
        c.giorniSettimana.forEach(function (g) {
          if (!App.costanti.giornoValido(g)) {
            segnala('Calendario ' + etichetta(c, i) + ': giorno non riconosciuto "' + g + '".');
          }
          if (visti[g]) segnala('Calendario ' + etichetta(c, i) + ': giorno ripetuto "' + g + '".');
          visti[g] = true;
        });
      }
    });

    // --- configurazione carne ---
    var configPerId = {}, configPerStagione = {};
    (dati.configCarne || []).forEach(function (c, i) {
      if (!c || typeof c !== 'object' || !idValido(c.id)) {
        segnala('Configurazione carne senza id valido ' + etichetta(c, i) + '.'); return;
      }
      if (configPerId[c.id]) { segnala('Due configurazioni carne con lo stesso id.'); return; }
      configPerId[c.id] = true;
      if (!idValido(c.stagioneId) || !stagioniPerId[c.stagioneId]) {
        segnala('Configurazione carne ' + etichetta(c, i) + ': stagione inesistente.'); return;
      }
      if (configPerStagione[c.stagioneId]) {
        segnala('Due configurazioni carne per la stessa stagione.');
      }
      configPerStagione[c.stagioneId] = true;
      if (!interoNonNegativo(c.obbligoVenditaGrammi)) {
        segnala('Configurazione carne ' + etichetta(c, i) +
          ': obbligo di vendita non valido, deve essere un intero in grammi.');
      }
      var prezzi = c.prezziCentKg;
      if (!prezzi || typeof prezzi !== 'object') {
        segnala('Configurazione carne ' + etichetta(c, i) + ': prezzi mancanti.');
      } else {
        Object.keys(prezzi).forEach(function (k) {
          if (!interoNonNegativo(prezzi[k])) {
            segnala('Configurazione carne ' + etichetta(c, i) +
              ': prezzo non valido per "' + k + '".');
          }
        });
      }
    });

    // --- lotti carne ---
    var lottiPerId = {}, lottoPerGiornata = {};
    (dati.lottiCarne || []).forEach(function (l, i) {
      if (!l || typeof l !== 'object' || !idValido(l.id)) {
        segnala('Lotto carne senza id valido ' + etichetta(l, i) + '.'); return;
      }
      if (lottiPerId[l.id]) { segnala('Due lotti carne con lo stesso id "' + l.id + '".'); return; }
      if (!idValido(l.giornataId) || !idValido(l.squadraId) || !idValido(l.stagioneId)) {
        segnala('Lotto carne ' + etichetta(l, i) + ' senza giornata, squadra o stagione.'); return;
      }
      var gio = giornatePerId[l.giornataId];
      if (!gio) {
        segnala('Lotto carne ' + etichetta(l, i) + ' punta a una giornata inesistente.'); return;
      }
      if (gio.squadraId !== l.squadraId || gio.stagioneId !== l.stagioneId) {
        segnala('Lotto carne ' + etichetta(l, i) +
          ': squadra o stagione non coerenti con la giornata.'); return;
      }
      if (lottoPerGiornata[l.giornataId]) {
        segnala('Due lotti carne per la stessa giornata.');
      }
      lottoPerGiornata[l.giornataId] = true;
      if (!interoPositivo(l.pesoNettoDisponibileGrammi)) {
        segnala('Lotto carne ' + etichetta(l, i) +
          ': peso netto non valido, deve essere un intero in grammi maggiore di zero.');
        return;
      }
      lottiPerId[l.id] = l;
    });

    // --- quote carne (snapshot dei partecipanti) ---
    var quotePerId = {}, coppieQuota = {}, sommaQuote = {};
    (dati.quoteCarne || []).forEach(function (q, i) {
      if (!q || typeof q !== 'object' || !idValido(q.id)) {
        segnala('Quota carne senza id valido ' + etichetta(q, i) + '.'); return;
      }
      if (quotePerId[q.id]) { segnala('Due quote carne con lo stesso id.'); return; }
      quotePerId[q.id] = true;
      var lotto = lottiPerId[q.lottoCarneId];
      if (!lotto) {
        segnala('Quota carne ' + etichetta(q, i) + ' punta a un lotto inesistente.'); return;
      }
      var m = membriPerId[q.membroId];
      if (!m) {
        segnala('Quota carne ' + etichetta(q, i) + ' punta a un socio inesistente.'); return;
      }
      if (m.squadraId !== lotto.squadraId) {
        segnala('Quota carne ' + etichetta(q, i) + ': il socio è di un\u2019altra squadra.'); return;
      }
      if (!iscrittiPerStagione[lotto.stagioneId + '|' + q.membroId]) {
        segnala('Quota carne ' + etichetta(q, i) +
          ': il socio non è iscritto alla stagione del lotto.'); return;
      }
      var coppia = q.lottoCarneId + '|' + q.membroId;
      if (coppieQuota[coppia]) segnala('Due quote carne per lo stesso socio nello stesso lotto.');
      coppieQuota[coppia] = true;
      if (!interoNonNegativo(q.quotaSpettanteGrammi)) {
        segnala('Quota carne ' + etichetta(q, i) + ': quota non valida.');
        return;
      }
      if (q.haDiritto !== undefined && typeof q.haDiritto !== 'boolean') {
        segnala('Quota carne ' + etichetta(q, i) + ': il campo haDiritto deve essere vero o falso.');
      }
      if (q.inCompensazione !== undefined && typeof q.inCompensazione !== 'boolean') {
        segnala('Quota carne ' + etichetta(q, i) +
          ': il campo inCompensazione deve essere vero o falso.');
      }
      if (q.quotaCompensataGrammi !== undefined &&
          !interoNonNegativo(q.quotaCompensataGrammi)) {
        segnala('Quota carne ' + etichetta(q, i) + ': quota compensata non valida.');
      }
      // Chi non ha diritto o è in compensazione non riceve carne.
      if ((q.haDiritto === false || q.inCompensazione === true) &&
          q.quotaSpettanteGrammi !== 0) {
        segnala('Quota carne ' + etichetta(q, i) +
          ': chi non ha diritto o è in compensazione non può avere una quota.');
      }
      sommaQuote[q.lottoCarneId] = (sommaQuote[q.lottoCarneId] || 0) + q.quotaSpettanteGrammi;
    });
    Object.keys(lottiPerId).forEach(function (idL) {
      var l = lottiPerId[idL];
      var somma = sommaQuote[idL] || 0;
      // Le quote coprono la carne effettivamente divisa fra i partecipanti:
      // quella venduta o messa da parte per i salamini esce dal lotto senza
      // passare dalla divisione, quindi la somma puo' essere inferiore.
      // Non puo' invece superare la carne disponibile.
      if (somma > l.pesoNettoDisponibileGrammi) {
        segnala('Lotto carne "' + idL + '": la somma delle quote (' + somma +
          ' g) supera il peso disponibile (' + l.pesoNettoDisponibileGrammi + ' g).');
      }
    });

    // --- vendite ---
    var venditePerId = {}, uscitePerLotto = {};
    (dati.venditeCarne || []).forEach(function (v, i) {
      if (!v || typeof v !== 'object' || !idValido(v.id)) {
        segnala('Vendita carne senza id valido ' + etichetta(v, i) + '.'); return;
      }
      if (venditePerId[v.id]) { segnala('Due vendite con lo stesso id.'); return; }
      venditePerId[v.id] = true;
      if (!lottiPerId[v.lottoCarneId]) {
        segnala('Vendita ' + etichetta(v, i) + ' punta a un lotto inesistente.'); return;
      }
      if (!App.costanti.taglioValido(v.tipoTaglio)) {
        segnala('Vendita ' + etichetta(v, i) + ': tipo di taglio non riconosciuto.');
      }
      if (!App.core.calendario.dataValida(v.data)) {
        segnala('Vendita ' + etichetta(v, i) + ': data non valida.');
      }
      if (!interoPositivo(v.pesoGrammi)) {
        segnala('Vendita ' + etichetta(v, i) + ': peso non valido.');
      }
      if (!interoNonNegativo(v.prezzoCentKg)) {
        segnala('Vendita ' + etichetta(v, i) + ': prezzo non valido.');
      }
      if (typeof v.annullata !== 'boolean') {
        segnala('Vendita ' + etichetta(v, i) + ': il campo annullata deve essere vero o falso.');
      }
      if (v.annullata !== true && interoPositivo(v.pesoGrammi)) {
        uscitePerLotto[v.lottoCarneId] = (uscitePerLotto[v.lottoCarneId] || 0) + v.pesoGrammi;
      }
    });

    // --- ritiri ---
    var ritiriPerId = {};
    (dati.ritiriCarne || []).forEach(function (r, i) {
      if (!r || typeof r !== 'object' || !idValido(r.id)) {
        segnala('Ritiro carne senza id valido ' + etichetta(r, i) + '.'); return;
      }
      if (ritiriPerId[r.id]) { segnala('Due ritiri con lo stesso id.'); return; }
      ritiriPerId[r.id] = true;
      var lotto = lottiPerId[r.lottoCarneId];
      if (!lotto) {
        segnala('Ritiro ' + etichetta(r, i) + ' punta a un lotto inesistente.'); return;
      }
      var tipo = r.tipoMovimento || 'RITIRO_CREDITO';
      if (!App.costanti.movimentoCarneValido(tipo)) {
        segnala('Uscita carne ' + etichetta(r, i) + ': tipo di movimento non riconosciuto.');
        return;
      }
      if (App.costanti.movimentoRichiedeSocio(tipo)) {
        if (!membriPerId[r.membroId]) {
          segnala('Uscita carne ' + etichetta(r, i) + ' punta a un socio inesistente.'); return;
        }
      } else if (r.membroId !== null && r.membroId !== undefined) {
        segnala('Uscita carne ' + etichetta(r, i) +
          ': un movimento "' + App.costanti.etichettaMovimentoCarne(tipo) +
          '" non deve essere intestato a un socio.');
        return;
      }
      if (!idValido(r.stagioneId) || !stagioniPerId[r.stagioneId]) {
        segnala('Ritiro ' + etichetta(r, i) + ' punta a una stagione inesistente.'); return;
      }
      if (r.stagioneId !== lotto.stagioneId) {
        segnala('Ritiro ' + etichetta(r, i) + ': stagione diversa da quella del lotto.');
      }
      if (!App.core.calendario.dataValida(r.data)) {
        segnala('Ritiro ' + etichetta(r, i) + ': data non valida.');
      }
      if (!interoPositivo(r.pesoGrammi)) {
        segnala('Ritiro ' + etichetta(r, i) + ': peso non valido.');
      }
      if (typeof r.annullato !== 'boolean') {
        segnala('Ritiro ' + etichetta(r, i) + ': il campo annullato deve essere vero o falso.');
      }
      if (r.annullato !== true && interoPositivo(r.pesoGrammi)) {
        uscitePerLotto[r.lottoCarneId] = (uscitePerLotto[r.lottoCarneId] || 0) + r.pesoGrammi;
      }
    });

    // Vincolo fisico: vendite + ritiri non superano la carne del lotto.
    Object.keys(uscitePerLotto).forEach(function (idL) {
      var l = lottiPerId[idL];
      if (!l) return;
      if (uscitePerLotto[idL] > l.pesoNettoDisponibileGrammi) {
        segnala('Lotto carne "' + idL + '": vendite e ritiri (' + uscitePerLotto[idL] +
          ' g) superano la carne disponibile (' + l.pesoNettoDisponibileGrammi + ' g).');
      }
    });

    // --- meta ---
    (dati.meta || []).forEach(function (m, i) {
      if (!m || typeof m !== 'object' || !idValido(m.chiave)) {
        segnala('Voce meta non valida in posizione ' + (i + 1) + '.');
      }
    });

    return errori;
  }

  // Validazione completa esposta alla UI.
  function validaBackup(oggetto) {
    var errori = validaInvolucro(oggetto);
    if (errori.length) return errori;
    // La struttura si controlla con le regole dello schema corrente: se il
    // backup e' piu' vecchio va prima migrato (lo fa importaBackup).
    if (oggetto.schemaVersion === App.versione.SCHEMA_VERSION) {
      errori = validaStruttura(oggetto.dati);
    }
    return errori;
  }

  // Punto di aggancio per le migrazioni future dei backup.
  // Oggi la catena e' vuota: schemaVersion 1 e' l'unica esistente.
  // Chiave = versione di partenza. Ogni funzione porta il backup alla
  // versione successiva senza toccare gli store gia' presenti.
  var MIGRAZIONI = {
    // Schema 1 -> 2: compaiono giornate e presenze, entrambe vuote.
    1: function (backup) {
      backup.dati.giornate = backup.dati.giornate || [];
      backup.dati.presenze = backup.dati.presenze || [];
      return backup;
    },
    // Schema 2 -> 3: compare il registro capi, vuoto.
    2: function (backup) {
      backup.dati.abbattimenti = backup.dati.abbattimenti || [];
      return backup;
    },
    // Schema 3 -> 4: compaiono i controlli sanitari, vuoti.
    3: function (backup) {
      backup.dati.controlliSanitari = backup.dati.controlliSanitari || [];
      return backup;
    },
    // Schema 4 -> 5: calendario battute e modulo carne, tutti vuoti.
    4: function (backup) {
      ['calendariBattuta', 'configCarne', 'lottiCarne', 'quoteCarne',
       'venditeCarne', 'ritiriCarne'].forEach(function (n) {
        backup.dati[n] = backup.dati[n] || [];
      });
      return backup;
    },
    // Schema 5 -> 6: compaiono diritto alla carne, compensazione, tipo di
    // uscita, chi ha venduto e capo non recuperato. Nessuno store
    // nuovo: si riempiono i campi con i valori che i vecchi dati avevano
    // implicitamente.
    5: function (backup) {
      (backup.dati.quoteCarne || []).forEach(function (q) {
        if (q.haDiritto === undefined) q.haDiritto = true;
        if (q.inCompensazione === undefined) q.inCompensazione = false;
        if (q.quotaCompensataGrammi === undefined) q.quotaCompensataGrammi = 0;
      });
      (backup.dati.ritiriCarne || []).forEach(function (r) {
        if (!r.tipoMovimento) r.tipoMovimento = 'RITIRO_CREDITO';
      });
      (backup.dati.venditeCarne || []).forEach(function (v) {
        if (v.vendutaDa === undefined) v.vendutaDa = null;
      });
      (backup.dati.abbattimenti || []).forEach(function (a) {
        if (a.recuperato === undefined) a.recuperato = true;
      });
      return backup;
    }
  };

  // Schema 6 -> 7: il campo della vendita passa da "acquirente" a
  // "vendutaDa": non era chi compra, ma il socio che vende quella carne.
  MIGRAZIONI[6] = function (backup) {
    (backup.dati.venditeCarne || []).forEach(function (v) {
      if (v.vendutaDa === undefined) v.vendutaDa = v.acquirente || null;
      delete v.acquirente;
    });
    return backup;
  };

  function migraBackup(oggetto) {
    var v = oggetto.schemaVersion;
    while (v < App.versione.SCHEMA_VERSION) {
      var fn = MIGRAZIONI[v];
      if (!fn) throw new Error('Nessuna migrazione disponibile dallo schema ' + v + '.');
      oggetto = fn(oggetto);
      v++;
      oggetto.schemaVersion = v;
    }
    return oggetto;
  }

  function riepilogoBackup(oggetto) {
    var out = {};
    schemaApp().nomiStoreBackup.forEach(function (n) {
      out[n] = (oggetto.dati[n] || []).length;
    });
    return out;
  }

  // Riscrive (o inserisce) la sola voce meta.schemaVersion.
  function allineaSchemaVersion(dati) {
    dati.meta = dati.meta || [];
    var trovata = false;
    dati.meta.forEach(function (m) {
      if (m && m.chiave === 'schemaVersion') {
        m.valore = App.versione.SCHEMA_VERSION;
        trovata = true;
      }
    });
    if (!trovata) {
      dati.meta.push({ chiave: 'schemaVersion', valore: App.versione.SCHEMA_VERSION });
    }
    return dati;
  }

  // Sostituzione totale in una sola transazione. Nessun merge.
  function importaBackup(oggetto) {
    function rifiuta(errori) {
      var e = new Error(errori.join(' '));
      e.errori = errori;
      throw e;
    }
    var errori = validaInvolucro(oggetto);
    if (errori.length) rifiuta(errori);

    var backup = migraBackup(oggetto);

    // Ultimo controllo dopo la migrazione: da qui in poi si scrive, quindi
    // qualunque difetto strutturale deve essere gia' stato intercettato.
    errori = validaStruttura(backup.dati);
    if (errori.length) rifiuta(errori);

    // Il backup puo' arrivare da uno schema precedente: dopo la migrazione
    // meta.schemaVersion deve riflettere lo schema corrente, senza duplicare
    // la chiave (lo store meta ha keyPath 'chiave', quindi il put sostituisce).
    allineaSchemaVersion(backup.dati);

    var nomi = schemaApp().nomiStoreBackup;

    return App.data.repo.scrivi(nomi, function (t) {
      nomi.forEach(function (n) { t.svuota(n); });
      nomi.forEach(function (n) {
        (backup.dati[n] || []).forEach(function (rec) { t.put(n, rec); });
      });
      return riepilogoBackup(backup);
    }).then(function (r) {
      App.data.db.chiudi();   // forza una riapertura pulita
      return r;
    });
  }

  // ---------- DATI DEMO ----------
  // Calcolo puro: cosa verrebbe eliminato e quali riferimenti resterebbero orfani.
  function analizzaEliminazioneDemo(dati) {
    function insiemeDemo(lista) {
      var s = {};
      (lista || []).forEach(function (r) { if (r.demo === true) s[r.id] = true; });
      return s;
    }
    var squadreDemo = insiemeDemo(dati.squadre);
    var stagioniDemo = insiemeDemo(dati.stagioni);
    var membriDemo = insiemeDemo(dati.membri);
    var iscrizioniDemo = insiemeDemo(dati.iscrizioni);
    var giornateDemo = insiemeDemo(dati.giornate);
    var presenzeDemo = insiemeDemo(dati.presenze);
    var abbattimentiDemo = insiemeDemo(dati.abbattimenti);
    var controlliDemo = insiemeDemo(dati.controlliSanitari);
    var calendariDemo = insiemeDemo(dati.calendariBattuta);
    var configCarneDemo = insiemeDemo(dati.configCarne);
    var lottiDemo = insiemeDemo(dati.lottiCarne);
    var quoteCarneDemo = insiemeDemo(dati.quoteCarne);
    var venditeDemo = insiemeDemo(dati.venditeCarne);
    var ritiriDemo = insiemeDemo(dati.ritiriCarne);

    var problemi = [];
    function etichettaMembro(m) { return ((m.nome || '') + ' ' + (m.cognome || '')).trim() || m.id; }

    (dati.stagioni || []).forEach(function (s) {
      if (s.demo !== true && squadreDemo[s.squadraId]) {
        problemi.push('La stagione reale "' + (s.nome || s.id) + '" appartiene a una squadra demo.');
      }
    });
    (dati.membri || []).forEach(function (m) {
      if (m.demo !== true && squadreDemo[m.squadraId]) {
        problemi.push('Il socio reale "' + etichettaMembro(m) + '" appartiene a una squadra demo.');
      }
    });
    (dati.iscrizioni || []).forEach(function (i) {
      if (i.demo === true) return;
      if (stagioniDemo[i.stagioneId]) {
        problemi.push('Un\u2019iscrizione reale è collegata a una stagione demo.');
      }
      if (membriDemo[i.membroId]) {
        problemi.push('Un\u2019iscrizione reale è collegata a un socio demo.');
      }
    });
    (dati.giornate || []).forEach(function (g) {
      if (g.demo === true) return;
      if (squadreDemo[g.squadraId]) {
        problemi.push('Una giornata reale appartiene a una squadra demo.');
      }
      if (stagioniDemo[g.stagioneId]) {
        problemi.push('Una giornata reale appartiene a una stagione demo.');
      }
      if (g.capocacciaMembroId && membriDemo[g.capocacciaMembroId]) {
        problemi.push('Una giornata reale ha come capocaccia un socio demo.');
      }
    });
    (dati.presenze || []).forEach(function (p) {
      if (p.demo === true) return;
      if (giornateDemo[p.giornataId]) {
        problemi.push('Una presenza reale \u00e8 collegata a una giornata demo.');
      }
      if (membriDemo[p.membroId]) {
        problemi.push('Una presenza reale \u00e8 collegata a un socio demo.');
      }
    });
    (dati.abbattimenti || []).forEach(function (a) {
      if (a.demo === true) return;
      if (squadreDemo[a.squadraId]) {
        problemi.push('Un capo reale appartiene a una squadra demo.');
      }
      if (stagioniDemo[a.stagioneId]) {
        problemi.push('Un capo reale appartiene a una stagione demo.');
      }
      if (giornateDemo[a.giornataId]) {
        problemi.push('Un capo reale \u00e8 registrato in una giornata demo.');
      }
      if (membriDemo[a.tiratoreMembroId]) {
        problemi.push('Un capo reale ha come tiratore un socio demo.');
      }
    });
    (dati.controlliSanitari || []).forEach(function (c) {
      if (c.demo === true) return;
      if (abbattimentiDemo[c.abbattimentoId]) {
        problemi.push('Un controllo sanitario reale \u00e8 collegato a un capo demo.');
      }
    });
    (dati.quoteCarne || []).forEach(function (q) {
      if (q.demo === true) return;
      if (lottiDemo[q.lottoCarneId]) {
        problemi.push('Una quota carne reale \u00e8 collegata a un lotto demo.');
      }
    });
    (dati.venditeCarne || []).forEach(function (v) {
      if (v.demo === true) return;
      if (lottiDemo[v.lottoCarneId]) {
        problemi.push('Una vendita reale \u00e8 collegata a un lotto carne demo.');
      }
    });
    (dati.ritiriCarne || []).forEach(function (r) {
      if (r.demo === true) return;
      if (lottiDemo[r.lottoCarneId]) {
        problemi.push('Un ritiro reale \u00e8 collegato a un lotto carne demo.');
      }
      if (membriDemo[r.membroId]) {
        problemi.push('Un ritiro reale \u00e8 collegato a un socio demo.');
      }
    });
    (dati.lottiCarne || []).forEach(function (l) {
      if (l.demo === true) return;
      if (giornateDemo[l.giornataId]) {
        problemi.push('Un lotto carne reale \u00e8 collegato a una giornata demo.');
      }
    });
    (dati.squadre || []).forEach(function (sq) {
      if (sq.demo !== true && sq.stagioneAttivaId && stagioniDemo[sq.stagioneAttivaId]) {
        problemi.push('La squadra reale "' + (sq.nome || sq.id) +
          '" ha come stagione attiva una stagione demo.');
      }
    });

    // messaggi duplicati compattati
    var visti = {}, unici = [];
    problemi.forEach(function (p) { if (!visti[p]) { visti[p] = true; unici.push(p); } });

    return {
      puoProcedere: unici.length === 0,
      problemi: unici,
      conteggi: {
        squadre: Object.keys(squadreDemo).length,
        stagioni: Object.keys(stagioniDemo).length,
        membri: Object.keys(membriDemo).length,
        iscrizioni: Object.keys(iscrizioniDemo).length,
        giornate: Object.keys(giornateDemo).length,
        presenze: Object.keys(presenzeDemo).length,
        abbattimenti: Object.keys(abbattimentiDemo).length,
        controlliSanitari: Object.keys(controlliDemo).length,
        calendariBattuta: Object.keys(calendariDemo).length,
        configCarne: Object.keys(configCarneDemo).length,
        lottiCarne: Object.keys(lottiDemo).length,
        quoteCarne: Object.keys(quoteCarneDemo).length,
        venditeCarne: Object.keys(venditeDemo).length,
        ritiriCarne: Object.keys(ritiriDemo).length
      },
      insiemi: {
        squadre: squadreDemo, stagioni: stagioniDemo,
        membri: membriDemo, iscrizioni: iscrizioniDemo,
        giornate: giornateDemo, presenze: presenzeDemo,
        abbattimenti: abbattimentiDemo,
        controlliSanitari: controlliDemo,
        calendariBattuta: calendariDemo, configCarne: configCarneDemo,
        lottiCarne: lottiDemo, quoteCarne: quoteCarneDemo,
        venditeCarne: venditeDemo, ritiriCarne: ritiriDemo
      }
    };
  }

  function anteprimaEliminazioneDemo() {
    return App.data.repo.leggiStore(schemaApp().nomiStoreDemo).then(analizzaEliminazioneDemo);
  }

  // Elimina SOLO i record demo:true. Si ferma prima di toccare qualsiasi cosa
  // se l'operazione lascerebbe riferimenti orfani. Atomica.
  function eliminaDatiDemo() {
    var storeDemo = schemaApp().nomiStoreDemo;
    return App.data.repo.leggiStore(storeDemo.concat(['meta'])).then(function (dati) {
      var analisi = analizzaEliminazioneDemo(dati);
      if (!analisi.puoProcedere) {
        var e = new Error('Eliminazione annullata: verrebbero creati riferimenti orfani.');
        e.problemi = analisi.problemi;
        throw e;
      }
      var totale = 0;
      Object.keys(analisi.conteggi).forEach(function (k) { totale += analisi.conteggi[k]; });
      if (totale === 0) return { eliminati: analisi.conteggi, totale: 0 };

      // Ordine figli -> genitori.
      // Figli prima dei genitori.
      var ordine = ['ritiriCarne', 'venditeCarne', 'quoteCarne', 'lottiCarne',
                    'configCarne', 'calendariBattuta',
                    'controlliSanitari', 'abbattimenti', 'presenze', 'giornate',
                    'iscrizioni', 'membri', 'stagioni', 'squadre'];
      var squadraCorrente = null;
      (dati.meta || []).forEach(function (m) {
        if (m.chiave === 'squadraCorrenteId') squadraCorrente = m.valore;
      });

      return App.data.repo.scrivi(storeDemo.concat(['meta']), function (t) {
        ordine.forEach(function (nome) {
          Object.keys(analisi.insiemi[nome]).forEach(function (id) { t.elimina(nome, id); });
        });
        if (squadraCorrente && analisi.insiemi.squadre[squadraCorrente]) {
          t.put('meta', { chiave: 'squadraCorrenteId', valore: null });
        }
        t.put('meta', { chiave: 'datiDemoPresenti', valore: false });
        return { eliminati: analisi.conteggi, totale: totale };
      });
    });
  }

  App.core.backup = {
    costruisciBackup: costruisciBackup,
    nomeFileBackup: nomeFileBackup,
    validaBackup: validaBackup,
    validaInvolucro: validaInvolucro,
    validaStruttura: validaStruttura,
    importaBackup: importaBackup,
    riepilogoBackup: riepilogoBackup,
    analizzaEliminazioneDemo: analizzaEliminazioneDemo,
    anteprimaEliminazioneDemo: anteprimaEliminazioneDemo,
    eliminaDatiDemo: eliminaDatiDemo
  };
})(typeof window !== 'undefined' ? window : globalThis);
