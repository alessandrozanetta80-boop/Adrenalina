(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  var SP = App.costanti.STATO_PRESENZA;

  function testoPulito(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  // ---------- PESO ----------
  // Nel modello il peso e' SEMPRE un intero in grammi: 45 kg -> 45000,
  // 85,5 kg -> 85500. Mai virgola mobile in kg.
  // Accetta "45", "45,5", "45.5", "1.234,5". null se non interpretabile.
  function parseKgInGrammi(testo) {
    if (testo === null || testo === undefined) return null;
    var s = String(testo).trim().replace(/\s/g, '').replace(/kg/gi, '');
    if (s === '') return null;
    if (!/^[0-9.,]+$/.test(s)) return null;

    var haVirgola = s.indexOf(',') !== -1;
    var haPunto = s.indexOf('.') !== -1;
    if (haVirgola && haPunto) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (haVirgola) {
      s = s.replace(',', '.');
    } else if (haPunto) {
      var parti = s.split('.');
      // un solo punto con 1-3 decimali = separatore decimale, altrimenti migliaia
      if (parti.length === 2 && parti[1].length <= 3) s = parti.join('.');
      else s = parti.join('');
    }
    var n = Number(s);
    if (!isFinite(n)) return null;
    return Math.round(n * 1000);
  }

  function formattaKg(grammi) {
    var n = (Number(grammi) || 0) / 1000;
    var testo;
    try {
      testo = n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    } catch (e) {
      testo = n.toFixed(1).replace('.', ',');
    }
    return testo + ' kg';
  }

  function kgPerInput(grammi) {
    return ((Number(grammi) || 0) / 1000).toFixed(1).replace('.', ',');
  }

  function pesoValido(grammi) {
    return typeof grammi === 'number' && isFinite(grammi) &&
      Math.floor(grammi) === grammi &&
      grammi > 0 && grammi <= App.costanti.PESO_MASSIMO_GRAMMI;
  }

  // ---------- CODICE CAPO ----------
  // Progressivo leggibile, univoco dentro la stagione: CG-001, CG-002...
  // Si parte dal numero piu' alto gia' presente, cosi' i numeri liberati da
  // un annullamento non vengono riutilizzati. Non e' la chiave primaria.
  function numeroDaCodice(codice) {
    var m = /^[A-Z]+-(\d+)$/.exec(String(codice || ''));
    return m ? Number(m[1]) : 0;
  }

  function formattaCodice(numero) {
    var s = String(numero);
    while (s.length < 3) s = '0' + s;
    return App.costanti.PREFISSO_CODICE_CAPO + '-' + s;
  }

  function prossimoCodice(abbattimenti, stagioneId) {
    var massimo = 0;
    (abbattimenti || []).forEach(function (a) {
      if (a.stagioneId !== stagioneId) return;
      var n = numeroDaCodice(a.codiceCapo);
      if (n > massimo) massimo = n;
    });
    return formattaCodice(massimo + 1);
  }

  function prossimoCodicePerStagione(stagioneId) {
    return App.data.abbattimenti.perStagione(stagioneId).then(function (a) {
      return prossimoCodice(a, stagioneId);
    });
  }

  // ---------- VALIDAZIONE ----------
  function valida(campi) {
    var errori = {};
    if (!campi.giornataId) errori.giornataId = 'Scegli la giornata di caccia.';
    if (!campi.tiratoreMembroId) errori.tiratoreMembroId = 'Scegli il tiratore.';
    if (!App.costanti.sessoValido(campi.sesso)) errori.sesso = 'Sesso non valido.';
    if (!App.costanti.classeEtaValida(campi.classeEta)) errori.classeEta = 'Classe di età non valida.';

    if (campi.pesoGrammi === null || campi.pesoGrammi === undefined) {
      errori.pesoGrammi = 'Peso non valido: usa per esempio 85,5.';
    } else if (typeof campi.pesoGrammi !== 'number' || !isFinite(campi.pesoGrammi)) {
      errori.pesoGrammi = 'Peso non valido: usa per esempio 85,5.';
    } else if (campi.pesoGrammi <= 0) {
      errori.pesoGrammi = 'Il peso deve essere maggiore di zero.';
    } else if (campi.pesoGrammi > App.costanti.PESO_MASSIMO_GRAMMI) {
      errori.pesoGrammi = 'Peso oltre il limite consentito (' +
        (App.costanti.PESO_MASSIMO_GRAMMI / 1000) + ' kg).';
    }
    return errori;
  }

  // Il tiratore deve essere della squadra e iscritto alla stagione della
  // giornata. Restituisce anche un eventuale avviso, che NON blocca.
  function verificaTiratore(giornata, membroId) {
    return Promise.all([
      App.data.membri.perId(membroId),
      App.data.iscrizioni.perStagioneEMembro(giornata.stagioneId, membroId),
      App.data.presenze.perGiornataEMembro(giornata.id, membroId)
    ]).then(function (r) {
      var membro = r[0], iscrizione = r[1], presenza = r[2];
      if (!membro) throw new Error('Il tiratore selezionato non esiste.');
      if (membro.squadraId !== giornata.squadraId) {
        throw new Error('Il tiratore non appartiene alla squadra di questa giornata.');
      }
      if (!iscrizione) {
        throw new Error('Il tiratore non è iscritto alla stagione di questa giornata.');
      }
      var avviso = null;
      if (presenza && presenza.stato === SP.ASSENTE) {
        avviso = 'Attenzione: ' + membro.nome + ' ' + membro.cognome +
          ' risulta ASSENTE in questa giornata.';
      } else if (presenza && presenza.stato === SP.LAVORO) {
        avviso = 'Attenzione: ' + membro.nome + ' ' + membro.cognome +
          ' risulta in LAVORO in questa giornata.';
      }
      return { membro: membro, avviso: avviso };
    });
  }

  // Avviso da mostrare prima del salvataggio, senza scrivere nulla.
  function avvisoTiratore(giornataId, membroId) {
    if (!giornataId || !membroId) return Promise.resolve(null);
    return App.data.giornate.perId(giornataId).then(function (g) {
      if (!g) return null;
      return verificaTiratore(g, membroId)
        .then(function (r) { return r.avviso; })
        .catch(function () { return null; });
    });
  }

  function campiAbbattimento(campi) {
    return {
      tiratoreMembroId: campi.tiratoreMembroId,
      sesso: campi.sesso,
      pesoGrammi: Math.round(campi.pesoGrammi),
      classeEta: campi.classeEta,
      caneMuta: testoPulito(campi.caneMuta) || null,
      note: testoPulito(campi.note) || ''
    };
  }

  // ---------- CREAZIONE / MODIFICA ----------
  function crea(campi) {
    var errori = valida(campi);
    if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

    return App.data.giornate.perId(campi.giornataId).then(function (giornata) {
      if (!giornata) throw new Error('Giornata non trovata.');
      return verificaTiratore(giornata, campi.tiratoreMembroId).then(function () {
        return prossimoCodicePerStagione(giornata.stagioneId).then(function (codice) {
          var base = campiAbbattimento(campi);
          base.id = App.core.id.nuovo(App.core.id.ABBATTIMENTO);
          base.codiceCapo = codice;
          // squadra e stagione derivano sempre dalla giornata
          base.squadraId = giornata.squadraId;
          base.stagioneId = giornata.stagioneId;
          base.giornataId = giornata.id;
          base.annullato = false;
          base.demo = false;
          var capo = App.data.repo.timbraCreazione(base);
          return App.data.abbattimenti.salva(capo).then(function () { return capo; });
        });
      });
    });
  }

  // La giornata di un capo puo' essere corretta, ma restando nella stessa
  // stagione: spostarlo altrove invaliderebbe il codice progressivo.
  function aggiorna(abbattimentoId, campi) {
    var errori = valida(campi);
    if (Object.keys(errori).length) { var e = new Error('Dati non validi.'); e.errori = errori; throw e; }

    return App.data.abbattimenti.perId(abbattimentoId).then(function (capo) {
      if (!capo) throw new Error('Abbattimento non trovato.');
      return App.data.giornate.perId(campi.giornataId).then(function (giornata) {
        if (!giornata) throw new Error('Giornata non trovata.');
        if (giornata.stagioneId !== capo.stagioneId) {
          throw new Error('La giornata scelta appartiene a un\u2019altra stagione.');
        }
        return verificaTiratore(giornata, campi.tiratoreMembroId).then(function () {
          var agg = campiAbbattimento(campi);
          Object.keys(agg).forEach(function (k) { capo[k] = agg[k]; });
          capo.giornataId = giornata.id;
          capo.squadraId = giornata.squadraId;
          return App.data.abbattimenti.salva(capo).then(function () { return capo; });
        });
      });
    });
  }

  // Nessuna cancellazione fisica: si commuta solo il flag.
  function impostaAnnullato(abbattimentoId, annullato) {
    return App.data.abbattimenti.perId(abbattimentoId).then(function (capo) {
      if (!capo) throw new Error('Abbattimento non trovato.');
      capo.annullato = !!annullato;
      return App.data.abbattimenti.salva(capo).then(function () { return capo; });
    });
  }

  // ---------- LETTURE ----------
  function arricchisci(capo, giornatePerId, membriPerId) {
    var g = giornatePerId[capo.giornataId] || null;
    return {
      capo: capo,
      giornata: g,
      zona: g ? (g.zona || null) : null,
      data: g ? g.data : null,
      tiratore: membriPerId[capo.tiratoreMembroId] || null
    };
  }

  // Registro della stagione attiva, dai piu' recenti.
  function elenco() {
    return App.core.squadra.contesto().then(function (ctx) {
      return App.data.repo.leggiStore(['abbattimenti', 'giornate', 'membri'])
        .then(function (d) {
          var idStagione = ctx.stagioneAttiva ? ctx.stagioneAttiva.id : null;
          var giornatePerId = {}, membriPerId = {};
          d.giornate.forEach(function (g) { giornatePerId[g.id] = g; });
          d.membri.forEach(function (m) { membriPerId[m.id] = m; });

          var righe = d.abbattimenti
            .filter(function (a) { return idStagione && a.stagioneId === idStagione; })
            .map(function (a) { return arricchisci(a, giornatePerId, membriPerId); });

          righe.sort(function (x, y) {
            var dx = x.data || '', dy = y.data || '';
            if (dx !== dy) return dy.localeCompare(dx);
            return String(y.capo.codiceCapo).localeCompare(String(x.capo.codiceCapo));
          });
          return { contesto: ctx, righe: righe };
        });
    });
  }

  function scheda(abbattimentoId) {
    return App.core.squadra.contesto().then(function (ctx) {
      return App.data.repo.leggiStore(['abbattimenti', 'giornate', 'membri'])
        .then(function (d) {
          var capo = d.abbattimenti.filter(function (a) { return a.id === abbattimentoId; })[0];
          if (!capo) return null;
          var giornatePerId = {}, membriPerId = {};
          d.giornate.forEach(function (g) { giornatePerId[g.id] = g; });
          d.membri.forEach(function (m) { membriPerId[m.id] = m; });
          var stagione = null;
          ctx.stagioni.forEach(function (s) { if (s.id === capo.stagioneId) stagione = s; });
          var riga = arricchisci(capo, giornatePerId, membriPerId);
          riga.contesto = ctx;
          riga.stagione = stagione;
          return riga;
        });
    });
  }

  // Capi validi (non annullati) di una giornata.
  function perGiornata(giornataId) {
    return App.data.repo.leggiStore(['abbattimenti', 'membri']).then(function (d) {
      var membriPerId = {};
      d.membri.forEach(function (m) { membriPerId[m.id] = m; });
      var tutti = d.abbattimenti.filter(function (a) { return a.giornataId === giornataId; });
      tutti.sort(function (a, b) {
        return String(a.codiceCapo).localeCompare(String(b.codiceCapo));
      });
      return {
        tutti: tutti.map(function (a) {
          return { capo: a, tiratore: membriPerId[a.tiratoreMembroId] || null };
        }),
        validi: tutti.filter(function (a) { return !a.annullato; }).length
      };
    });
  }

  // Conteggio derivato: capi non annullati della stagione. Mai memorizzato.
  function conteggioStagione(stagioneId) {
    if (!stagioneId) return Promise.resolve(0);
    return App.data.abbattimenti.perStagione(stagioneId).then(function (a) {
      return a.filter(function (x) { return !x.annullato; }).length;
    });
  }

  // Tiratori selezionabili: iscritti alla stagione della giornata, attivi,
  // piu' chi e' gia' registrato come tiratore anche se poi disattivato.
  function candidatiTiratore(giornata, idGiaScelto) {
    return App.data.repo.leggiStore(['membri', 'iscrizioni']).then(function (d) {
      var iscritti = {};
      d.iscrizioni.forEach(function (i) {
        if (i.stagioneId === giornata.stagioneId) iscritti[i.membroId] = true;
      });
      return d.membri.filter(function (m) {
        if (m.squadraId !== giornata.squadraId) return false;
        if (m.id === idGiaScelto) return true;
        return m.attivo && iscritti[m.id];
      }).sort(function (a, b) {
        var c = (a.cognome || '').localeCompare(b.cognome || '', 'it');
        return c !== 0 ? c : (a.nome || '').localeCompare(b.nome || '', 'it');
      });
    });
  }

  App.core.capo = {
    parseKgInGrammi: parseKgInGrammi,
    formattaKg: formattaKg,
    kgPerInput: kgPerInput,
    pesoValido: pesoValido,
    numeroDaCodice: numeroDaCodice,
    formattaCodice: formattaCodice,
    prossimoCodice: prossimoCodice,
    prossimoCodicePerStagione: prossimoCodicePerStagione,
    valida: valida,
    avvisoTiratore: avvisoTiratore,
    crea: crea,
    aggiorna: aggiorna,
    impostaAnnullato: impostaAnnullato,
    elenco: elenco,
    scheda: scheda,
    perGiornata: perGiornata,
    conteggioStagione: conteggioStagione,
    candidatiTiratore: candidatiTiratore
  };
})(typeof window !== 'undefined' ? window : globalThis);
