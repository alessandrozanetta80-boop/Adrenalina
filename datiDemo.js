(function (global) {
  'use strict';
  var App = global.App;
  App.seed = App.seed || {};

  // ATTENZIONE: questo file contiene DUE cose diverse.
  //
  //   1. ANAGRAFICA della squadra Adrenalina: squadra, stagione,
  //      21 soci e le loro iscrizioni. Tutti con demo:false.
  //      Non vengono toccati da "Elimina dati di prova".
  //
  //   2. DATI DI CACCIA FITTIZI: giornate, presenze, abbattimenti e
  //      controlli sanitari. Tutti con demo:true.
  //      Servono solo a mostrare come funziona l'app e si cancellano
  //      da Backup dati -> "Elimina dati di prova".
  //
  // I nomi che compaiono negli eventi di caccia sono reali, gli eventi no:
  // nessuna giornata, presenza, abbattimento o controllo qui dentro
  // corrisponde a un fatto avvenuto.
  //
  // VERSIONE PER DEMO PUBBLICA.
  // Di ogni socio restano solo nome, cognome, ruoli venatori e livello di
  // accesso. Telefono, data di nascita, scadenza del porto d'armi e note
  // sono deliberatamente vuoti: i campi esistono nel modello e nei form,
  // ma qui non vengono popolati per non pubblicare dati personali.
  // Anche le quote versate sono dimostrative e NON rappresentano la
  // situazione economica reale della squadra.

  function costruisci() {
    var idSquadra = App.core.id.nuovo(App.core.id.SQUADRA);
    var idStagione = App.core.id.nuovo(App.core.id.STAGIONE);
    var quotaPredefinitaCent = 24000;   // 240,00 €

    // ---------- squadra e stagione: DATI REALI ----------
    var squadra = App.data.repo.timbraCreazione({
      id: idSquadra,
      nome: 'Adrenalina',
      stagioneAttivaId: idStagione,
      demo: false
    });

    var stagione = App.data.repo.timbraCreazione({
      id: idStagione,
      squadraId: idSquadra,
      nome: '2026/2027',
      dataInizio: '2026-09-01',
      dataFine: '2027-01-31',
      stato: 'attiva',
      quotaAnnualePredefinitaCent: quotaPredefinitaCent,
      demo: false
    });

    // ---------- soci ----------
    // Solo nome, cognome, ruoli venatori e livello di accesso.
    // Nessun dato personale nella demo pubblica.
    var CS = ['CAPOSQUADRA', 'CANARO'];
    var PO = ['POSTAIOLO'];

    // Quote dimostrative: servono a far vedere i tre stati dell'interfaccia
    // (pagata, parziale, non pagata). Non sono i pagamenti reali.
    var QUOTA_PAGATA = 24000;
    var QUOTA_PARZIALE = 12000;

    var persone = [
      { nome: 'Stefano',       cognome: 'Bianchi',    ruoli: PO,
        livello: 'AMMINISTRATORE', versata: QUOTA_PAGATA },
      { nome: 'Pier',          cognome: 'Nolli',      ruoli: CS,
        livello: 'MEMBRO', versata: QUOTA_PAGATA },
      { nome: 'Luca',          cognome: 'Malcotti',   ruoli: CS,
        livello: 'AMMINISTRATORE', versata: QUOTA_PAGATA },
      { nome: 'Davide',        cognome: 'Zanotti',    ruoli: CS,
        livello: 'MEMBRO', versata: QUOTA_PAGATA },
      { nome: 'Roberto',       cognome: 'Dido',       ruoli: PO,
        livello: 'MEMBRO', versata: QUOTA_PARZIALE },
      { nome: 'Cristian',      cognome: 'Cerlini',    ruoli: PO,
        livello: 'MEMBRO', versata: QUOTA_PARZIALE },
      { nome: 'Adriano',       cognome: 'De Giorgis', ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Antonio',       cognome: 'Rinaldi',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Cesare',        cognome: 'Bettini',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Federico',      cognome: 'Tonetti',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Francesco',     cognome: 'Ferrari',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Gabriele',      cognome: 'Beltrami',   ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Giuseppe',      cognome: 'Olivari',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Lele',          cognome: 'Pinco',      ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Luciano',       cognome: 'Boretti',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Marco',         cognome: 'Mora',       ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Massimiliano',  cognome: 'Manganelli', ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Pierangelo',    cognome: 'Cottini',    ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Renato',        cognome: 'Borri',      ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Simone',        cognome: 'Agrati',     ruoli: PO, livello: 'MEMBRO', versata: 0 },
      { nome: 'Alessandro',    cognome: 'Zanetta',    ruoli: PO,
        livello: 'AMMINISTRATORE', versata: 0 }
    ];

    var membri = [];
    var iscrizioni = [];

    persone.forEach(function (p) {
      var idNuovoMembro = App.core.id.nuovo(App.core.id.MEMBRO);
      membri.push(App.data.repo.timbraCreazione({
        id: idNuovoMembro,
        squadraId: idSquadra,
        nome: p.nome,
        cognome: p.cognome,
        // Campi supportati dall'app ma vuoti nella demo pubblica:
        // si compilano dalla scheda socio, qui non vengono pubblicati.
        dataNascita: null,
        telefono: null,
        note: '',
        livelloAccessoApp: p.livello,
        attivo: true,
        scadenzaPortoArmi: null,
        demo: false
      }));
      iscrizioni.push(App.core.stagione.nuovaIscrizione({
        stagioneId: idStagione,
        membroId: idNuovoMembro,
        ruoliVenatori: p.ruoli,
        ospite: false,
        quotaAnnualePrevistaCent: quotaPredefinitaCent,
        quotaVersataCent: p.versata,
        demo: false
      }));
    });

    // ---------- da qui in poi: SOLO DATI FITTIZI (demo:true) ----------
    // Date relative a oggi, cosi' restano sensate col passare del tempo.
    function dataRelativa(giorni) {
      var d = new Date();
      d.setDate(d.getDate() + giorni);
      return App.core.calendario.oggi(d);
    }
    function idMembro(nomeCompleto) {
      var m = membri.filter(function (x) {
        return (x.nome + ' ' + x.cognome) === nomeCompleto;
      })[0];
      return m ? m.id : null;
    }

    var modelliGiornate = [
      { data: dataRelativa(-21), orario: '06:30', zona: 'Costa del Faggeto',
        capocaccia: 'Pier Nolli', stato: 'COMPLETATA', note: 'Battuta mattutina.',
        presenze: { 'Pier Nolli': 'PRESENTE', 'Luca Malcotti': 'PRESENTE',
                    'Davide Zanotti': 'PRESENTE', 'Roberto Dido': 'LAVORO',
                    'Stefano Bianchi': 'ASSENTE' } },
      { data: dataRelativa(-7), orario: '06:30', zona: 'Valle Scura',
        capocaccia: 'Luca Malcotti', stato: 'COMPLETATA', note: '',
        presenze: { 'Pier Nolli': 'PRESENTE', 'Luca Malcotti': 'PRESENTE',
                    'Davide Zanotti': 'ASSENTE', 'Roberto Dido': 'PRESENTE' } },
      { data: dataRelativa(-3), orario: '07:00', zona: 'Pian dei Lupi',
        capocaccia: null, stato: 'ANNULLATA', note: 'Annullata per maltempo.',
        presenze: {} },
      { data: dataRelativa(4), orario: '06:30', zona: 'Costa del Faggeto',
        capocaccia: 'Pier Nolli', stato: 'PROGRAMMATA', note: '',
        presenze: { 'Pier Nolli': 'PRESENTE', 'Roberto Dido': 'LAVORO' } },
      { data: dataRelativa(11), orario: '06:30', zona: 'Fosso Grande',
        capocaccia: null, stato: 'PROGRAMMATA', note: 'Capocaccia da assegnare.',
        presenze: {} }
    ];

    var giornate = [];
    var presenze = [];

    modelliGiornate.forEach(function (g) {
      var idGiornata = App.core.id.nuovo(App.core.id.GIORNATA);
      giornate.push(App.data.repo.timbraCreazione({
        id: idGiornata,
        squadraId: idSquadra,
        stagioneId: idStagione,
        data: g.data,
        orarioRitrovo: g.orario,
        zona: g.zona,
        capocacciaMembroId: g.capocaccia ? idMembro(g.capocaccia) : null,
        note: g.note,
        stato: g.stato,
        demo: true
      }));
      // I soci non elencati restano senza record: valgono NON_SEGNATO.
      Object.keys(g.presenze).forEach(function (nomeCompleto) {
        var mid = idMembro(nomeCompleto);
        if (!mid) return;
        presenze.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.PRESENZA),
          giornataId: idGiornata,
          membroId: mid,
          stato: g.presenze[nomeCompleto],
          note: '',
          demo: true
        }));
      });
    });

    // Registro capi fittizio, sulle due giornate gia' completate.
    var completate = giornate.filter(function (g) { return g.stato === 'COMPLETATA'; });
    var modelliCapi = completate.length >= 2 ? [
      { giornata: completate[0].id, tiratore: 'Pier Nolli', sesso: 'MASCHIO',
        pesoGrammi: 85500, classe: 'ADULTO', cane: 'Muta Diana',
        note: 'Verro adulto.', annullato: false },
      { giornata: completate[0].id, tiratore: 'Davide Zanotti', sesso: 'FEMMINA',
        pesoGrammi: 62300, classe: 'ADULTO', cane: 'Fulmine',
        note: 'Scrofa.', annullato: false },
      { giornata: completate[0].id, tiratore: 'Pier Nolli', sesso: 'MASCHIO',
        pesoGrammi: 31200, classe: 'SUBADULTO', cane: null,
        note: '', annullato: false },
      { giornata: completate[1].id, tiratore: 'Luca Malcotti', sesso: 'FEMMINA',
        pesoGrammi: 45000, classe: 'SUBADULTO', cane: 'Cane Thor',
        note: '', annullato: false },
      { giornata: completate[1].id, tiratore: 'Luca Malcotti', sesso: 'NON_DETERMINATO',
        pesoGrammi: 28000, classe: 'PICCOLO', cane: null,
        note: 'Registrato per errore, annullato.', annullato: true }
    ] : [];

    var abbattimenti = [];
    var progressivo = 0;
    modelliCapi.forEach(function (c) {
      var mid = idMembro(c.tiratore);
      if (!mid) return;
      progressivo++;
      abbattimenti.push(App.data.repo.timbraCreazione({
        id: App.core.id.nuovo(App.core.id.ABBATTIMENTO),
        codiceCapo: App.core.capo.formattaCodice(progressivo),
        squadraId: idSquadra,
        stagioneId: idStagione,
        giornataId: c.giornata,
        tiratoreMembroId: mid,
        sesso: c.sesso,
        pesoGrammi: c.pesoGrammi,
        classeEta: c.classe,
        caneMuta: c.cane,
        note: c.note,
        annullato: c.annullato,
        demo: true
      }));
    });

    // Controlli sanitari fittizi: non tutti i capi ne hanno uno.
    var modelliControlli = [
      { indice: 0, stato: 'NEGATIVO_CONFORME', prelievo: -20, esito: -18,
        riferimento: 'TR-2026-014', note: 'Esito conforme.' },
      { indice: 1, stato: 'IN_ATTESA', prelievo: -20, esito: null,
        riferimento: 'TR-2026-015', note: '' },
      { indice: 3, stato: 'NON_PRELEVATO', prelievo: null, esito: null,
        riferimento: null, note: 'Campione non prelevato.' }
    ];

    var controlliSanitari = [];
    modelliControlli.forEach(function (c) {
      var capo = abbattimenti[c.indice];
      if (!capo) return;
      controlliSanitari.push(App.data.repo.timbraCreazione({
        id: App.core.id.nuovo(App.core.id.CONTROLLO),
        abbattimentoId: capo.id,
        statoTrichinella: c.stato,
        dataPrelievo: c.prelievo === null ? null : dataRelativa(c.prelievo),
        dataEsito: c.esito === null ? null : dataRelativa(c.esito),
        riferimentoCampione: c.riferimento,
        note: c.note,
        demo: true
      }));
    });

    return {
      squadra: squadra, stagione: stagione, membri: membri,
      iscrizioni: iscrizioni, giornate: giornate, presenze: presenze,
      abbattimenti: abbattimenti, controlliSanitari: controlliSanitari
    };
  }

  function inserisci() {
    var d = costruisci();
    return App.data.repo.scrivi(
      ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate',
       'presenze', 'abbattimenti', 'controlliSanitari'],
      function (t) {
      t.put('squadre', d.squadra);
      t.put('stagioni', d.stagione);
      d.membri.forEach(function (m) { t.put('membri', m); });
      d.iscrizioni.forEach(function (i) { t.put('iscrizioni', i); });
      d.giornate.forEach(function (g) { t.put('giornate', g); });
      d.presenze.forEach(function (p) { t.put('presenze', p); });
      d.abbattimenti.forEach(function (a) { t.put('abbattimenti', a); });
      d.controlliSanitari.forEach(function (c) { t.put('controlliSanitari', c); });
      t.put('meta', { chiave: 'schemaVersion', valore: App.versione.SCHEMA_VERSION });
      t.put('meta', { chiave: 'squadraCorrenteId', valore: d.squadra.id });
      t.put('meta', { chiave: 'datiDemoPresenti', valore: true });
      return d;
    });
  }

  // Seed solo al primo avvio, se il database e' completamente vuoto.
  function inizializzaSeNecessario() {
    return App.data.repo.leggiStore(['squadre', 'meta']).then(function (dati) {
      var giaAvviato = (dati.meta || []).some(function (m) { return m.chiave === 'schemaVersion'; });
      if (dati.squadre.length > 0 || giaAvviato) return { seedEseguito: false };
      return inserisci().then(function () { return { seedEseguito: true }; });
    });
  }

  App.seed.datiDemo = {
    costruisci: costruisci,
    inserisci: inserisci,
    inizializzaSeNecessario: inizializzaSeNecessario
  };
})(typeof window !== 'undefined' ? window : globalThis);
