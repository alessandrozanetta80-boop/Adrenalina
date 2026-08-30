(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function testoPulito(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  function dataPulita(v) {
    var t = testoPulito(v);
    return t === '' ? null : t;
  }

  // Un capo senza record non ha stato "sconosciuto": e' semplicemente
  // non registrato. "Non registrato" non viene mai memorizzato.
  function etichettaStato(controllo) {
    if (!controllo) return App.costanti.ETICHETTA_SANITARIO_ASSENTE;
    return App.costanti.etichettaStatoTrichinella(controllo.statoTrichinella);
  }

  function valida(campi) {
    var errori = {};
    var cal = App.core.calendario;

    if (!App.costanti.statoTrichinellaValido(campi.statoTrichinella)) {
      errori.statoTrichinella = 'Stato della trichinella non valido.';
    }

    var prelievo = dataPulita(campi.dataPrelievo);
    var esito = dataPulita(campi.dataEsito);

    if (prelievo !== null && !cal.dataValida(prelievo)) {
      errori.dataPrelievo = 'Data non valida: usa il formato AAAA-MM-GG e una data esistente.';
    }
    if (esito !== null && !cal.dataValida(esito)) {
      errori.dataEsito = 'Data non valida: usa il formato AAAA-MM-GG e una data esistente.';
    }
    // Entrambe valorizzate e valide: l'esito non puo' precedere il prelievo.
    if (!errori.dataPrelievo && !errori.dataEsito &&
        prelievo !== null && esito !== null && esito < prelievo) {
      errori.dataEsito = 'La data di esito non può precedere quella di prelievo.';
    }
    return errori;
  }

  function perAbbattimento(abbattimentoId) {
    return App.data.controlliSanitari.perAbbattimento(abbattimentoId);
  }

  // Mappa abbattimentoId -> controllo, per il registro capi.
  function mappaPerAbbattimenti() {
    return App.data.controlliSanitari.tutti().then(function (elenco) {
      var mappa = {};
      elenco.forEach(function (c) { mappa[c.abbattimentoId] = c; });
      return mappa;
    });
  }

  // Un solo record per capo: se esiste si aggiorna, altrimenti si crea.
  // Nessuna cancellazione, nemmeno quando il capo viene annullato.
  function salva(abbattimentoId, campi) {
    var errori = valida(campi);
    if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

    return App.data.abbattimenti.perId(abbattimentoId).then(function (capo) {
      if (!capo) throw new Error('Abbattimento non trovato.');
      return App.data.controlliSanitari.perAbbattimento(abbattimentoId)
        .then(function (esistente) {
          var valori = {
            statoTrichinella: campi.statoTrichinella,
            dataPrelievo: dataPulita(campi.dataPrelievo),
            dataEsito: dataPulita(campi.dataEsito),
            riferimentoCampione: testoPulito(campi.riferimentoCampione) || null,
            note: testoPulito(campi.note) || ''
          };

          if (esistente) {
            Object.keys(valori).forEach(function (k) { esistente[k] = valori[k]; });
            return App.data.controlliSanitari.salva(esistente)
              .then(function () { return esistente; });
          }

          valori.id = App.core.id.nuovo(App.core.id.CONTROLLO);
          valori.abbattimentoId = abbattimentoId;
          valori.demo = false;
          var nuovo = App.data.repo.timbraCreazione(valori);
          return App.data.controlliSanitari.salva(nuovo).then(function () { return nuovo; });
        });
    });
  }

  App.core.sanitario = {
    valida: valida,
    etichettaStato: etichettaStato,
    perAbbattimento: perAbbattimento,
    mappaPerAbbattimenti: mappaPerAbbattimenti,
    salva: salva
  };
})(typeof window !== 'undefined' ? window : globalThis);
