(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function nuovaSquadra(nome, demo) {
    return App.data.repo.timbraCreazione({
      id: App.core.id.nuovo(App.core.id.SQUADRA),
      nome: nome,
      stagioneAttivaId: null,
      demo: !!demo
    });
  }

  // Squadra corrente + stagione attiva, in un colpo solo.
  function contesto() {
    return App.data.repo.leggiStore(['meta', 'squadre', 'stagioni']).then(function (d) {
      var idCorrente = null;
      d.meta.forEach(function (m) { if (m.chiave === 'squadraCorrenteId') idCorrente = m.valore; });

      var squadra = null;
      if (idCorrente) {
        squadra = d.squadre.filter(function (s) { return s.id === idCorrente; })[0] || null;
      }
      if (!squadra) squadra = d.squadre[0] || null;

      var stagioni = squadra
        ? d.stagioni.filter(function (s) { return s.squadraId === squadra.id; })
        : [];
      stagioni.sort(function (a, b) { return (b.nome || '').localeCompare(a.nome || ''); });

      var attiva = null;
      if (squadra && squadra.stagioneAttivaId) {
        attiva = stagioni.filter(function (s) { return s.id === squadra.stagioneAttivaId; })[0] || null;
      }
      return { squadra: squadra, stagioneAttiva: attiva, stagioni: stagioni };
    });
  }

  function validaConfigurazioneIniziale(campi) {
    var errori = [];
    if (!campi.nomeSquadra || !String(campi.nomeSquadra).trim()) {
      errori.push('Il nome della squadra è obbligatorio.');
    }
    if (!campi.nomeStagione || !String(campi.nomeStagione).trim()) {
      errori.push('Il nome della stagione è obbligatorio.');
    }
    if (campi.quotaAnnualePredefinitaCent === null ||
        campi.quotaAnnualePredefinitaCent === undefined) {
      errori.push('La quota annuale predefinita non è valida.');
    }
    if (campi.dataInizio && campi.dataFine && campi.dataFine < campi.dataInizio) {
      errori.push('La data di fine non può precedere la data di inizio.');
    }
    return errori;
  }

  // Primo avvio, o ripartenza dopo l'eliminazione dei dati di prova.
  // Crea squadra reale + stagione reale attiva + meta in una sola transazione.
  function creaSquadraIniziale(campi) {
    var errori = validaConfigurazioneIniziale(campi);
    if (errori.length) { var e = new Error(errori.join(' ')); e.errori = errori; throw e; }

    var idSquadra = App.core.id.nuovo(App.core.id.SQUADRA);
    var idStagione = App.core.id.nuovo(App.core.id.STAGIONE);

    var squadra = App.data.repo.timbraCreazione({
      id: idSquadra,
      nome: String(campi.nomeSquadra).trim(),
      stagioneAttivaId: idStagione,
      demo: false
    });

    var stagione = App.data.repo.timbraCreazione({
      id: idStagione,
      squadraId: idSquadra,
      nome: String(campi.nomeStagione).trim(),
      dataInizio: campi.dataInizio || null,
      dataFine: campi.dataFine || null,
      stato: 'attiva',
      quotaAnnualePredefinitaCent: Math.max(0, Math.round(campi.quotaAnnualePredefinitaCent || 0)),
      demo: false
    });

    return App.data.repo.scrivi(['meta', 'squadre', 'stagioni'], function (t) {
      t.put('squadre', squadra);
      t.put('stagioni', stagione);
      t.put('meta', { chiave: 'schemaVersion', valore: App.versione.SCHEMA_VERSION });
      t.put('meta', { chiave: 'squadraCorrenteId', valore: idSquadra });
      t.put('meta', { chiave: 'datiDemoPresenti', valore: false });
      return { squadra: squadra, stagione: stagione };
    });
  }

  // Esiste almeno una squadra? Serve al router per evitare vicoli ciechi.
  function esisteSquadra() {
    return App.data.repo.getAll('squadre').then(function (s) { return s.length > 0; });
  }

  App.core.squadra = {
    nuovaSquadra: nuovaSquadra,
    contesto: contesto,
    esisteSquadra: esisteSquadra,
    validaConfigurazioneIniziale: validaConfigurazioneIniziale,
    creaSquadraIniziale: creaSquadraIniziale
  };
})(typeof window !== 'undefined' ? window : globalThis);
