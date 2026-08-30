(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  var SP = App.costanti.STATO_PRESENZA;

  // REGOLA UNICA (opzione B del brief):
  // NON_SEGNATO non e' mai memorizzato. L'assenza di un record presenze
  // per la coppia giornata+membro significa NON_SEGNATO.
  // Riportare un socio a NON_SEGNATO cancella il suo record.
  // Nessun'altra parte dell'app deve creare record con stato NON_SEGNATO.

  function riepilogo(presenze, membriTotali) {
    var out = { presenti: 0, assenti: 0, lavoro: 0, nonSegnati: 0, totale: membriTotali || 0 };
    (presenze || []).forEach(function (p) {
      if (p.stato === SP.PRESENTE) out.presenti++;
      else if (p.stato === SP.ASSENTE) out.assenti++;
      else if (p.stato === SP.LAVORO) out.lavoro++;
    });
    out.nonSegnati = Math.max(0, out.totale - out.presenti - out.assenti - out.lavoro);
    return out;
  }

  // Righe della schermata presenze.
  // Compare un socio se, per la stagione della giornata:
  //   - appartiene alla stessa squadra, ED
  //   - ha un'iscrizione a quella stagione, ED
  //   - e' attivo;
  // oppure se, pur non essendo piu' attivo, ha gia' una presenza storica
  // registrata per quella giornata (il nome resta visibile).
  // Un socio attivo ma non iscritto a quella stagione NON compare: chi entra
  // nel 2027/2028 non deve apparire nelle giornate del 2026/2027.
  function perGiornata(giornataId) {
    return App.data.repo.leggiStore(['giornate', 'presenze', 'membri', 'iscrizioni'])
      .then(function (d) {
        var g = d.giornate.filter(function (x) { return x.id === giornataId; })[0];
        if (!g) return null;

        var presenzePerMembro = {};
        var presenzeGiornata = [];
        d.presenze.forEach(function (p) {
          if (p.giornataId !== giornataId) return;
          presenzePerMembro[p.membroId] = p;
          presenzeGiornata.push(p);
        });

        var ruoliPerMembro = {};
        var iscrittoAllaStagione = {};
        d.iscrizioni.forEach(function (i) {
          if (i.stagioneId !== g.stagioneId) return;
          iscrittoAllaStagione[i.membroId] = true;
          ruoliPerMembro[i.membroId] = i.ruoliVenatori;
        });

        var righe = d.membri.filter(function (m) {
          if (m.squadraId !== g.squadraId) return false;
          if (presenzePerMembro[m.id]) return true;       // storico gia' registrato
          return m.attivo && iscrittoAllaStagione[m.id];
        }).map(function (m) {
          var p = presenzePerMembro[m.id] || null;
          return {
            membro: m,
            presenza: p,
            stato: p ? p.stato : SP.NON_SEGNATO,
            ruoli: ruoliPerMembro[m.id] || null,
            storico: !m.attivo
          };
        });

        righe.sort(function (a, b) {
          if (a.membro.attivo !== b.membro.attivo) return a.membro.attivo ? -1 : 1;
          var c = (a.membro.cognome || '').localeCompare(b.membro.cognome || '', 'it');
          return c !== 0 ? c : (a.membro.nome || '').localeCompare(b.membro.nome || '', 'it');
        });

        return {
          giornata: g,
          righe: righe,
          riepilogo: riepilogo(presenzeGiornata, righe.length)
        };
      });
  }

  // Imposta lo stato di un membro per una giornata.
  // NON_SEGNATO cancella il record, gli altri stati lo creano o aggiornano.
  function imposta(giornataId, membroId, stato, note) {
    if (!App.costanti.statoPresenzaValido(stato)) {
      return Promise.reject(new Error('Stato di presenza non valido.'));
    }
    return Promise.all([
      App.data.giornate.perId(giornataId),
      App.data.membri.perId(membroId),
      App.data.presenze.perGiornataEMembro(giornataId, membroId)
    ]).then(function (r) {
      var giornata = r[0], membro = r[1], esistente = r[2];
      if (!giornata) throw new Error('Giornata non trovata.');
      if (!membro) throw new Error('Socio non trovato.');
      if (membro.squadraId !== giornata.squadraId) {
        throw new Error('Il socio non appartiene alla squadra di questa giornata.');
      }

      // Cancellare non richiede l'iscrizione: un record storico va sempre
      // potuto rimuovere, anche se l'iscrizione e' stata nel frattempo persa.
      if (stato === SP.NON_SEGNATO) {
        if (!esistente) return null;
        return App.data.presenze.elimina(esistente.id).then(function () { return null; });
      }

      // Per registrare una presenza il socio deve essere iscritto alla
      // stagione della giornata.
      return App.data.iscrizioni.perStagioneEMembro(giornata.stagioneId, membroId)
        .then(function (iscrizione) {
          if (!iscrizione) {
            throw new Error('Il socio non è iscritto alla stagione di questa giornata.');
          }
          return scriviPresenza(esistente, giornataId, membroId, stato, note);
        });
    });
  }

  function scriviPresenza(esistente, giornataId, membroId, stato, note) {
      if (esistente) {
        esistente.stato = stato;
        if (note !== undefined) esistente.note = note === null ? '' : String(note);
        return App.data.presenze.salva(esistente).then(function () { return esistente; });
      }

      var nuova = App.data.repo.timbraCreazione({
        id: App.core.id.nuovo(App.core.id.PRESENZA),
        giornataId: giornataId,
        membroId: membroId,
        stato: stato,
        note: note === undefined || note === null ? '' : String(note),
        demo: false
      });
      return App.data.presenze.salva(nuova).then(function () { return nuova; });
  }

  // Conteggio derivato: giornate della stagione in cui il socio risulta PRESENTE.
  // Mai memorizzato sul membro.
  function conteggioPresenze(stagioneId, membroId) {
    return App.data.repo.leggiStore(['giornate', 'presenze']).then(function (d) {
      var idGiornate = {};
      d.giornate.forEach(function (g) {
        if (g.stagioneId === stagioneId) idGiornate[g.id] = true;
      });
      var n = 0;
      d.presenze.forEach(function (p) {
        if (p.membroId === membroId && p.stato === SP.PRESENTE && idGiornate[p.giornataId]) n++;
      });
      return n;
    });
  }

  App.core.presenza = {
    riepilogo: riepilogo,
    perGiornata: perGiornata,
    imposta: imposta,
    conteggioPresenze: conteggioPresenze
  };
})(typeof window !== 'undefined' ? window : globalThis);
