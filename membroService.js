(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function testoPulito(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  function valida(campi) {
    var errori = {};
    if (!testoPulito(campi.nome)) errori.nome = 'Il nome è obbligatorio.';
    if (!testoPulito(campi.cognome)) errori.cognome = 'Il cognome è obbligatorio.';
    if (!App.costanti.livelloValido(campi.livelloAccessoApp)) {
      errori.livelloAccessoApp = 'Livello di accesso non valido.';
    }
    var ruoli = (campi.ruoliVenatori || []).filter(App.costanti.ruoloValido);
    if (!ruoli.length) errori.ruoliVenatori = 'Seleziona almeno un ruolo venatorio.';
    if (campi.quotaAnnualePrevistaCent === null) errori.quotaAnnualePrevista = 'Importo non valido.';
    if (campi.quotaVersataCent === null) errori.quotaVersata = 'Importo non valido.';
    return errori;
  }

  function campiMembro(campi, squadraId) {
    return {
      squadraId: squadraId,
      nome: testoPulito(campi.nome),
      cognome: testoPulito(campi.cognome),
      dataNascita: campi.dataNascita || null,
      telefono: testoPulito(campi.telefono) || null,
      note: testoPulito(campi.note) || '',
      livelloAccessoApp: campi.livelloAccessoApp,
      attivo: campi.attivo !== false,
      scadenzaPortoArmi: campi.scadenzaPortoArmi || null
    };
  }

  // Crea membro + iscrizione alla stagione attiva, in una sola transazione.
  function creaSocio(campi) {
    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.squadra) throw new Error('Nessuna squadra presente.');
      var errori = valida(campi);
      if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

      var base = campiMembro(campi, ctx.squadra.id);
      base.id = App.core.id.nuovo(App.core.id.MEMBRO);
      base.demo = false;
      var membro = App.data.repo.timbraCreazione(base);

      var iscrizione = null;
      if (ctx.stagioneAttiva) {
        iscrizione = App.core.stagione.nuovaIscrizione({
          stagioneId: ctx.stagioneAttiva.id,
          membroId: membro.id,
          ruoliVenatori: campi.ruoliVenatori,
          ospite: campi.ospite,
          quotaAnnualePrevistaCent: campi.quotaAnnualePrevistaCent,
          quotaVersataCent: campi.quotaVersataCent,
          demo: false
        });
      }

      return App.data.repo.scrivi(['membri', 'iscrizioni'], function (t) {
        t.put('membri', membro);
        if (iscrizione) t.put('iscrizioni', iscrizione);
        return { membro: membro, iscrizione: iscrizione };
      });
    });
  }

  // Aggiorna anagrafica sul membro e dati di stagione sull'iscrizione attiva.
  function aggiornaSocio(membroId, campi) {
    return App.core.squadra.contesto().then(function (ctx) {
      var errori = valida(campi);
      if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

      return Promise.all([
        App.data.membri.perId(membroId),
        ctx.stagioneAttiva
          ? App.data.iscrizioni.perStagioneEMembro(ctx.stagioneAttiva.id, membroId)
          : Promise.resolve(null)
      ]).then(function (r) {
        var membro = r[0];
        var iscrizione = r[1];
        if (!membro) throw new Error('Socio non trovato.');

        var aggiornato = campiMembro(campi, membro.squadraId);
        Object.keys(aggiornato).forEach(function (k) { membro[k] = aggiornato[k]; });
        App.data.repo.timbraModifica(membro);

        if (ctx.stagioneAttiva) {
          if (iscrizione) {
            iscrizione.ruoliVenatori = (campi.ruoliVenatori || []).filter(App.costanti.ruoloValido);
            iscrizione.ospite = !!campi.ospite;
            iscrizione.quotaAnnualePrevistaCent = Math.max(0, campi.quotaAnnualePrevistaCent || 0);
            iscrizione.quotaVersataCent = Math.max(0, campi.quotaVersataCent || 0);
            App.data.repo.timbraModifica(iscrizione);
          } else {
            iscrizione = App.core.stagione.nuovaIscrizione({
              stagioneId: ctx.stagioneAttiva.id,
              membroId: membro.id,
              ruoliVenatori: campi.ruoliVenatori,
              ospite: campi.ospite,
              quotaAnnualePrevistaCent: campi.quotaAnnualePrevistaCent,
              quotaVersataCent: campi.quotaVersataCent,
              demo: false
            });
          }
        }

        return App.data.repo.scrivi(['membri', 'iscrizioni'], function (t) {
          t.put('membri', membro);
          if (iscrizione) t.put('iscrizioni', iscrizione);
          return { membro: membro, iscrizione: iscrizione };
        });
      });
    });
  }

  // Nessuna cancellazione: si commuta solo il flag "attivo".
  function impostaAttivo(membroId, attivo) {
    return App.data.membri.perId(membroId).then(function (membro) {
      if (!membro) throw new Error('Socio non trovato.');
      membro.attivo = !!attivo;
      return App.data.membri.salva(membro);
    });
  }

  // Iscrive alla stagione attiva un socio che non ha ancora un'iscrizione.
  function iscriviAStagioneAttiva(membroId) {
    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.stagioneAttiva) throw new Error('Nessuna stagione attiva.');
      return App.data.iscrizioni.perStagioneEMembro(ctx.stagioneAttiva.id, membroId)
        .then(function (esistente) {
          if (esistente) return esistente;
          var iscrizione = App.core.stagione.nuovaIscrizione({
            stagioneId: ctx.stagioneAttiva.id,
            membroId: membroId,
            ruoliVenatori: null,
            ospite: false,
            quotaAnnualePrevistaCent: ctx.stagioneAttiva.quotaAnnualePredefinitaCent,
            quotaVersataCent: 0,
            demo: false
          });
          return App.data.iscrizioni.salva(iscrizione);
        });
    });
  }

  // Elenco soci della stagione attiva: membro + iscrizione + stato derivato.
  function elenco() {
    return App.core.squadra.contesto().then(function (ctx) {
      return App.data.repo.leggiStore(['membri', 'iscrizioni']).then(function (d) {
        var idStagione = ctx.stagioneAttiva ? ctx.stagioneAttiva.id : null;
        var perMembro = {};
        d.iscrizioni.forEach(function (i) {
          if (idStagione && i.stagioneId === idStagione) perMembro[i.membroId] = i;
        });
        var righe = d.membri
          .filter(function (m) { return !ctx.squadra || m.squadraId === ctx.squadra.id; })
          .map(function (m) {
            var isc = perMembro[m.id] || null;
            return {
              membro: m,
              iscrizione: isc,
              statoQuota: App.core.quote.statoIscrizione(isc),
              residuoCent: App.core.quote.residuoIscrizione(isc)
            };
          });
        righe.sort(function (a, b) {
          if (a.membro.attivo !== b.membro.attivo) return a.membro.attivo ? -1 : 1;
          var c = (a.membro.cognome || '').localeCompare(b.membro.cognome || '', 'it');
          return c !== 0 ? c : (a.membro.nome || '').localeCompare(b.membro.nome || '', 'it');
        });
        return { contesto: ctx, righe: righe };
      });
    });
  }

  function scheda(membroId) {
    return elenco().then(function (r) {
      var riga = r.righe.filter(function (x) { return x.membro.id === membroId; })[0] || null;
      return riga ? { contesto: r.contesto, riga: riga } : null;
    });
  }

  App.core.membro = {
    valida: valida,
    creaSocio: creaSocio,
    aggiornaSocio: aggiornaSocio,
    impostaAttivo: impostaAttivo,
    iscriviAStagioneAttiva: iscriviAStagioneAttiva,
    elenco: elenco,
    scheda: scheda
  };
})(typeof window !== 'undefined' ? window : globalThis);
