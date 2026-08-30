(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function nuovaIscrizione(campi) {
    return App.data.repo.timbraCreazione({
      id: App.core.id.nuovo(App.core.id.ISCRIZIONE),
      stagioneId: campi.stagioneId,
      membroId: campi.membroId,
      ruoliVenatori: campi.ruoliVenatori && campi.ruoliVenatori.length
        ? campi.ruoliVenatori.slice()
        : [App.costanti.RUOLO_PREDEFINITO],
      ospite: !!campi.ospite,
      quotaAnnualePrevistaCent: Math.max(0, Math.round(campi.quotaAnnualePrevistaCent || 0)),
      quotaVersataCent: Math.max(0, Math.round(campi.quotaVersataCent || 0)),
      demo: !!campi.demo
    });
  }

  function validaStagione(campi, stagioniEsistenti) {
    var errori = [];
    if (!campi.nome || !String(campi.nome).trim()) errori.push('Il nome della stagione è obbligatorio.');
    if (campi.quotaAnnualePredefinitaCent === null || campi.quotaAnnualePredefinitaCent === undefined) {
      errori.push('La quota annuale predefinita non è valida.');
    }
    if (campi.dataInizio && campi.dataFine && campi.dataFine < campi.dataInizio) {
      errori.push('La data di fine non può precedere la data di inizio.');
    }
    var nome = String(campi.nome || '').trim().toLowerCase();
    if ((stagioniEsistenti || []).some(function (s) {
      return String(s.nome || '').trim().toLowerCase() === nome;
    })) {
      errori.push('Esiste già una stagione con questo nome.');
    }
    return errori;
  }

  // Crea la stagione, la rende attiva e genera le iscrizioni dei membri attivi.
  // Le iscrizioni delle stagioni precedenti NON vengono mai riscritte:
  // vengono solo lette per riportare ruoli e flag ospite.
  function creaStagione(campi) {
    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.squadra) throw new Error('Nessuna squadra presente.');
      var errori = validaStagione(campi, ctx.stagioni);
      if (errori.length) throw new Error(errori.join(' '));

      return App.data.repo.leggiStore(['membri', 'iscrizioni']).then(function (d) {
        var squadra = ctx.squadra;
        var precedente = ctx.stagioneAttiva;

        var stagione = App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.STAGIONE),
          squadraId: squadra.id,
          nome: String(campi.nome).trim(),
          dataInizio: campi.dataInizio || null,
          dataFine: campi.dataFine || null,
          stato: 'attiva',
          quotaAnnualePredefinitaCent: Math.max(0, Math.round(campi.quotaAnnualePredefinitaCent || 0)),
          demo: false
        });

        var membriAttivi = d.membri.filter(function (m) {
          return m.squadraId === squadra.id && m.attivo === true;
        });

        var precedentiPerMembro = {};
        if (precedente) {
          d.iscrizioni.forEach(function (i) {
            if (i.stagioneId === precedente.id) precedentiPerMembro[i.membroId] = i;
          });
        }

        var nuoveIscrizioni = membriAttivi.map(function (m) {
          var vecchia = precedentiPerMembro[m.id];
          return nuovaIscrizione({
            stagioneId: stagione.id,
            membroId: m.id,
            ruoliVenatori: vecchia ? vecchia.ruoliVenatori : null,
            ospite: vecchia ? vecchia.ospite : false,
            quotaAnnualePrevistaCent: stagione.quotaAnnualePredefinitaCent,
            quotaVersataCent: 0,
            demo: false
          });
        });

        var stagioniDaChiudere = ctx.stagioni.filter(function (s) { return s.stato === 'attiva'; });

        return App.data.repo.scrivi(['stagioni', 'iscrizioni', 'squadre'], function (t) {
          stagioniDaChiudere.forEach(function (s) {
            s.stato = 'chiusa';
            t.put('stagioni', App.data.repo.timbraModifica(s));
          });
          t.put('stagioni', stagione);
          nuoveIscrizioni.forEach(function (i) { t.put('iscrizioni', i); });
          squadra.stagioneAttivaId = stagione.id;
          t.put('squadre', App.data.repo.timbraModifica(squadra));
          return { stagione: stagione, iscrizioniCreate: nuoveIscrizioni.length };
        });
      });
    });
  }

  // Cambio stagione attiva: nessun dato di stagione viene toccato.
  function attivaStagione(stagioneId) {
    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.squadra) throw new Error('Nessuna squadra presente.');
      var bersaglio = ctx.stagioni.filter(function (s) { return s.id === stagioneId; })[0];
      if (!bersaglio) throw new Error('Stagione non trovata.');

      var squadra = ctx.squadra;
      var daChiudere = ctx.stagioni.filter(function (s) {
        return s.stato === 'attiva' && s.id !== stagioneId;
      });

      return App.data.repo.scrivi(['stagioni', 'squadre'], function (t) {
        daChiudere.forEach(function (s) {
          s.stato = 'chiusa';
          t.put('stagioni', App.data.repo.timbraModifica(s));
        });
        bersaglio.stato = 'attiva';
        t.put('stagioni', App.data.repo.timbraModifica(bersaglio));
        squadra.stagioneAttivaId = bersaglio.id;
        t.put('squadre', App.data.repo.timbraModifica(squadra));
        return bersaglio;
      });
    });
  }

  App.core.stagione = {
    creaStagione: creaStagione,
    attivaStagione: attivaStagione,
    nuovaIscrizione: nuovaIscrizione,
    validaStagione: validaStagione
  };
})(typeof window !== 'undefined' ? window : globalThis);
