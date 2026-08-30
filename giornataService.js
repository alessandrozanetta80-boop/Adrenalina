(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  function testoPulito(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  function valida(campi) {
    var errori = {};
    if (!testoPulito(campi.data)) {
      errori.data = 'La data è obbligatoria.';
    } else if (!App.core.calendario.dataValida(testoPulito(campi.data))) {
      errori.data = 'Data non valida: usa il formato AAAA-MM-GG e una data esistente.';
    }
    if (campi.orarioRitrovo && !/^\d{2}:\d{2}$/.test(testoPulito(campi.orarioRitrovo))) {
      errori.orarioRitrovo = 'Orario non valido.';
    }
    if (!App.costanti.statoGiornataValido(campi.stato)) {
      errori.stato = 'Stato della giornata non valido.';
    }
    return errori;
  }

  function campiGiornata(campi) {
    return {
      data: testoPulito(campi.data),
      orarioRitrovo: testoPulito(campi.orarioRitrovo) || null,
      zona: testoPulito(campi.zona) || null,
      capocacciaMembroId: campi.capocacciaMembroId || null,
      note: testoPulito(campi.note) || '',
      stato: campi.stato
    };
  }

  // Il capocaccia, se indicato, deve essere un membro della stessa squadra.
  // Non e' richiesto che abbia il ruolo CAPOSQUADRA.
  function verificaCapocaccia(squadraId, membroId) {
    if (!membroId) return Promise.resolve(null);
    return App.data.membri.perId(membroId).then(function (m) {
      if (!m) throw new Error('Il capocaccia selezionato non esiste.');
      if (m.squadraId !== squadraId) {
        throw new Error('Il capocaccia non appartiene a questa squadra.');
      }
      return m;
    });
  }

  function crea(campi) {
    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.squadra) throw new Error('Nessuna squadra presente.');
      if (!ctx.stagioneAttiva) throw new Error('Nessuna stagione attiva: crea prima una stagione.');
      var errori = valida(campi);
      if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

      return verificaCapocaccia(ctx.squadra.id, campi.capocacciaMembroId).then(function () {
        var base = campiGiornata(campi);
        base.id = App.core.id.nuovo(App.core.id.GIORNATA);
        base.squadraId = ctx.squadra.id;
        base.stagioneId = ctx.stagioneAttiva.id;
        base.demo = false;
        var giornata = App.data.repo.timbraCreazione(base);
        return App.data.giornate.salva(giornata).then(function () { return giornata; });
      });
    });
  }

  // La giornata resta sempre legata alla squadra e alla stagione di origine:
  // modificarla non la sposta mai in un'altra stagione.
  function aggiorna(giornataId, campi) {
    var errori = valida(campi);
    if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

    return App.data.giornate.perId(giornataId).then(function (giornata) {
      if (!giornata) throw new Error('Giornata non trovata.');
      return verificaCapocaccia(giornata.squadraId, campi.capocacciaMembroId).then(function () {
        var agg = campiGiornata(campi);
        Object.keys(agg).forEach(function (k) { giornata[k] = agg[k]; });
        return App.data.giornate.salva(giornata).then(function () { return giornata; });
      });
    });
  }

  function cambiaStato(giornataId, stato) {
    if (!App.costanti.statoGiornataValido(stato)) {
      return Promise.reject(new Error('Stato della giornata non valido.'));
    }
    return App.data.giornate.perId(giornataId).then(function (giornata) {
      if (!giornata) throw new Error('Giornata non trovata.');
      giornata.stato = stato;
      return App.data.giornate.salva(giornata).then(function () { return giornata; });
    });
  }

  // Prossime prima (dalla piu' vicina), poi le passate (dalla piu' recente).
  function ordina(giornate, oggi) {
    var future = [], passate = [];
    giornate.forEach(function (g) {
      (String(g.data) >= oggi ? future : passate).push(g);
    });
    future.sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    passate.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    return future.concat(passate);
  }

  // Data locale del dispositivo, non UTC.
  function oggiIso() { return App.core.calendario.oggi(); }

  // Elenco delle giornate della stagione attiva, con capocaccia e presenti.
  function elenco() {
    return App.core.squadra.contesto().then(function (ctx) {
      return App.data.repo.leggiStore(['giornate', 'presenze', 'membri']).then(function (d) {
        var idStagione = ctx.stagioneAttiva ? ctx.stagioneAttiva.id : null;
        var membriPerId = {};
        d.membri.forEach(function (m) { membriPerId[m.id] = m; });

        var presentiPerGiornata = {};
        d.presenze.forEach(function (p) {
          if (p.stato !== App.costanti.STATO_PRESENZA.PRESENTE) return;
          presentiPerGiornata[p.giornataId] = (presentiPerGiornata[p.giornataId] || 0) + 1;
        });

        var giornate = d.giornate.filter(function (g) {
          return idStagione && g.stagioneId === idStagione;
        });

        var righe = ordina(giornate, oggiIso()).map(function (g) {
          return {
            giornata: g,
            capocaccia: g.capocacciaMembroId ? (membriPerId[g.capocacciaMembroId] || null) : null,
            presenti: presentiPerGiornata[g.id] || 0
          };
        });
        return { contesto: ctx, righe: righe };
      });
    });
  }

  function scheda(giornataId) {
    return App.core.squadra.contesto().then(function (ctx) {
      return App.data.repo.leggiStore(['giornate', 'presenze', 'membri']).then(function (d) {
        var g = d.giornate.filter(function (x) { return x.id === giornataId; })[0];
        if (!g) return null;
        var membriPerId = {};
        d.membri.forEach(function (m) { membriPerId[m.id] = m; });
        var presenze = d.presenze.filter(function (p) { return p.giornataId === g.id; });
        var stagione = null;
        ctx.stagioni.forEach(function (s) { if (s.id === g.stagioneId) stagione = s; });
        return {
          contesto: ctx,
          giornata: g,
          stagione: stagione,
          capocaccia: g.capocacciaMembroId ? (membriPerId[g.capocacciaMembroId] || null) : null,
          riepilogo: App.core.presenza.riepilogo(presenze, 0)
        };
      });
    });
  }

  // Membri selezionabili come capocaccia: gli attivi della squadra, piu'
  // quello gia' assegnato anche se nel frattempo e' stato disattivato.
  function candidatiCapocaccia(squadraId, idGiaScelto) {
    return App.data.membri.tutti().then(function (membri) {
      return membri.filter(function (m) {
        return m.squadraId === squadraId && (m.attivo || m.id === idGiaScelto);
      }).sort(function (a, b) {
        var c = (a.cognome || '').localeCompare(b.cognome || '', 'it');
        return c !== 0 ? c : (a.nome || '').localeCompare(b.nome || '', 'it');
      });
    });
  }

  App.core.giornata = {
    valida: valida,
    crea: crea,
    aggiorna: aggiorna,
    cambiaStato: cambiaStato,
    elenco: elenco,
    scheda: scheda,
    ordina: ordina,
    oggiIso: oggiIso,
    candidatiCapocaccia: candidatiCapocaccia
  };
})(typeof window !== 'undefined' ? window : globalThis);
