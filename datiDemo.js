(function (global) {
  'use strict';
  var App = global.App;
  App.seed = App.seed || {};

  // Tutti i record creati qui portano demo:true e sono eliminabili
  // dalla schermata Backup con "Elimina dati di prova".
  function costruisci() {
    var idSquadra = App.core.id.nuovo(App.core.id.SQUADRA);
    var idStagione = App.core.id.nuovo(App.core.id.STAGIONE);
    var quotaPredefinitaCent = 24000;   // 240,00 €

    var squadra = App.data.repo.timbraCreazione({
      id: idSquadra,
      nome: 'Adrenalina',
      stagioneAttivaId: idStagione,
      demo: true
    });

    var stagione = App.data.repo.timbraCreazione({
      id: idStagione,
      squadraId: idSquadra,
      nome: '2026/2027',
      dataInizio: '2026-09-01',
      dataFine: '2027-01-31',
      stato: 'attiva',
      quotaAnnualePredefinitaCent: quotaPredefinitaCent,
      demo: true
    });

    var persone = [
      { nome: 'Marco',    cognome: 'Rossi',    nascita: '1972-03-14', tel: '3401234567',
        livello: 'AMMINISTRATORE', attivo: true,  porto: '2028-05-31',
        ruoli: ['CAPOSQUADRA', 'CANARO'], ospite: false, prevista: 24000, versata: 24000,
        note: 'Referente della squadra.' },
      { nome: 'Luca',     cognome: 'Bianchi',  nascita: '1985-11-02', tel: '3387654321',
        livello: 'GESTORE', attivo: true, porto: '2027-02-28',
        ruoli: ['VICE_CAPOSQUADRA', 'POSTAIOLO'], ospite: false, prevista: 24000, versata: 10000,
        note: '' },
      { nome: 'Andrea',   cognome: 'Verdi',    nascita: '1990-07-21', tel: '3319876543',
        livello: 'MEMBRO', attivo: true, porto: '2027-09-15',
        ruoli: ['CANARO'], ospite: false, prevista: 24000, versata: 0, note: '' },
      { nome: 'Giuseppe', cognome: 'Neri',     nascita: '1965-01-09', tel: '3475551122',
        livello: 'MEMBRO', attivo: true, porto: '2026-11-30',
        ruoli: ['POSTAIOLO'], ospite: false, prevista: 24000, versata: 24000, note: '' },
      { nome: 'Paolo',    cognome: 'Gialli',   nascita: '1998-06-30', tel: '3662233445',
        livello: 'MEMBRO', attivo: true, porto: '2029-04-10',
        ruoli: ['CACCIATORE'], ospite: true, prevista: 0, versata: 0,
        note: 'Ospite: nessuna quota prevista.' },
      { nome: 'Sergio',   cognome: 'Blu',      nascita: '1958-09-05', tel: '3391112233',
        livello: 'MEMBRO', attivo: false, porto: '2026-07-31',
        ruoli: ['MEMBRO_SQUADRA'], ospite: false, prevista: 24000, versata: 0,
        note: 'Non partecipa a questa stagione.' }
    ];

    var membri = [];
    var iscrizioni = [];

    persone.forEach(function (p) {
      var idMembro = App.core.id.nuovo(App.core.id.MEMBRO);
      membri.push(App.data.repo.timbraCreazione({
        id: idMembro,
        squadraId: idSquadra,
        nome: p.nome,
        cognome: p.cognome,
        dataNascita: p.nascita,
        telefono: p.tel,
        note: p.note,
        livelloAccessoApp: p.livello,
        attivo: p.attivo,
        scadenzaPortoArmi: p.porto,
        demo: true
      }));
      iscrizioni.push(App.core.stagione.nuovaIscrizione({
        stagioneId: idStagione,
        membroId: idMembro,
        ruoliVenatori: p.ruoli,
        ospite: p.ospite,
        quotaAnnualePrevistaCent: p.prevista,
        quotaVersataCent: p.versata,
        demo: true
      }));
    });

    // --- Giornate di caccia (Fase 2) ---
    // Date relative a oggi, cosi' i dati demo restano sensati nel tempo:
    // due gia' passate e completate, due future programmate, una annullata.
    function dataRelativa(giorni) {
      var d = new Date();
      d.setDate(d.getDate() + giorni);
      return App.core.calendario.oggi(d);
    }
    function idMembro(cognome) {
      var m = membri.filter(function (x) { return x.cognome === cognome; })[0];
      return m ? m.id : null;
    }

    var modelliGiornate = [
      { data: dataRelativa(-21), orario: '06:30', zona: 'Costa del Faggeto',
        capocaccia: 'Rossi', stato: 'COMPLETATA', note: 'Battuta mattutina.',
        presenze: { Rossi: 'PRESENTE', Bianchi: 'PRESENTE', Verdi: 'PRESENTE',
                    Neri: 'LAVORO', Gialli: 'ASSENTE' } },
      { data: dataRelativa(-7), orario: '06:30', zona: 'Valle Scura',
        capocaccia: 'Bianchi', stato: 'COMPLETATA', note: '',
        presenze: { Rossi: 'PRESENTE', Bianchi: 'PRESENTE', Verdi: 'ASSENTE',
                    Neri: 'PRESENTE' } },
      { data: dataRelativa(-3), orario: '07:00', zona: 'Pian dei Lupi',
        capocaccia: null, stato: 'ANNULLATA', note: 'Annullata per maltempo.',
        presenze: {} },
      { data: dataRelativa(4), orario: '06:30', zona: 'Costa del Faggeto',
        capocaccia: 'Rossi', stato: 'PROGRAMMATA', note: '',
        presenze: { Rossi: 'PRESENTE', Neri: 'LAVORO' } },
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
      Object.keys(g.presenze).forEach(function (cognome) {
        var mid = idMembro(cognome);
        if (!mid) return;
        presenze.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.PRESENZA),
          giornataId: idGiornata,
          membroId: mid,
          stato: g.presenze[cognome],
          note: '',
          demo: true
        }));
      });
    });

    // --- Registro capi (Fase 3) ---
    // Legati alle due giornate completate, con due tiratori diversi,
    // pesi con decimali e un capo annullato.
    var completate = giornate.filter(function (g) { return g.stato === 'COMPLETATA'; });
    var modelliCapi = completate.length >= 2 ? [
      { giornata: completate[0].id, tiratore: 'Rossi', sesso: 'MASCHIO',
        pesoGrammi: 85500, classe: 'ADULTO', cane: 'Muta Diana',
        note: 'Verro adulto.', annullato: false },
      { giornata: completate[0].id, tiratore: 'Verdi', sesso: 'FEMMINA',
        pesoGrammi: 62300, classe: 'ADULTO', cane: 'Fulmine',
        note: 'Scrofa.', annullato: false },
      { giornata: completate[0].id, tiratore: 'Rossi', sesso: 'MASCHIO',
        pesoGrammi: 31200, classe: 'SUBADULTO', cane: null,
        note: '', annullato: false },
      { giornata: completate[1].id, tiratore: 'Bianchi', sesso: 'FEMMINA',
        pesoGrammi: 45000, classe: 'SUBADULTO', cane: 'Cane Thor',
        note: '', annullato: false },
      { giornata: completate[1].id, tiratore: 'Bianchi', sesso: 'NON_DETERMINATO',
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

    // --- Controlli sanitari (Fase 4) ---
    // Non tutti i capi hanno un controllo: chi non ce l'ha risulta
    // "Non registrato", che non e' uno stato memorizzato.
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
