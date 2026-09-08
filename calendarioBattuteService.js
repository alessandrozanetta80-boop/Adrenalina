(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // Il calendario NON crea record giornata: le date sono sempre DERIVATE
  // dalla configurazione della stagione. Una giornata nasce solo quando
  // l'utente la compila davvero.

  function due(n) { return (n < 10 ? '0' : '') + n; }

  function isoDa(d) {
    return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
  }

  function dataDaIso(iso) {
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function valida(campi) {
    var errori = {};
    var cal = App.core.calendario;
    if (!cal.dataValida(campi.dataInizio)) {
      errori.dataInizio = 'Data di inizio non valida.';
    }
    if (!cal.dataValida(campi.dataFine)) {
      errori.dataFine = 'Data di fine non valida.';
    }
    if (!errori.dataInizio && !errori.dataFine && campi.dataFine < campi.dataInizio) {
      errori.dataFine = 'La data di fine non può precedere quella di inizio.';
    }
    var giorni = campi.giorniSettimana;
    if (!Array.isArray(giorni) || giorni.length === 0) {
      errori.giorniSettimana = 'Scegli almeno un giorno della settimana.';
    } else {
      var visti = {};
      giorni.forEach(function (g) {
        if (!App.costanti.giornoValido(g)) errori.giorniSettimana = 'Giorno non riconosciuto.';
        if (visti[g]) errori.giorniSettimana = 'Giorno ripetuto.';
        visti[g] = true;
      });
    }
    return errori;
  }

  // Tutte le date potenziali di battuta, in ordine crescente.
  function dateDa(configurazione) {
    if (!configurazione) return [];
    var indici = {};
    (configurazione.giorniSettimana || []).forEach(function (g) {
      indici[App.costanti.indiceGiorno(g)] = true;
    });
    var out = [];
    var d = dataDaIso(configurazione.dataInizio);
    var fine = dataDaIso(configurazione.dataFine);
    // Limite di sicurezza: una stagione non dura piu' di due anni.
    var massimo = 800;
    while (d <= fine && out.length < massimo) {
      if (indici[d.getDay()]) out.push(isoDa(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function perStagione(stagioneId) {
    return App.data.calendari.perStagione(stagioneId);
  }

  // Un solo calendario per stagione: si aggiorna quello esistente.
  function salva(stagioneId, campi) {
    var errori = valida(campi);
    if (Object.keys(errori).length) {
      var e = new Error('Configurazione del calendario non valida.');
      e.errori = errori;
      throw e;
    }
    return App.data.stagioni.perId(stagioneId).then(function (stagione) {
      if (!stagione) throw new Error('Stagione non trovata.');
      return App.data.calendari.perStagione(stagioneId).then(function (esistente) {
        var valori = {
          nome: (campi.nome || App.costanti.CALENDARIO_NOME_PREDEFINITO).trim(),
          dataInizio: campi.dataInizio,
          dataFine: campi.dataFine,
          giorniSettimana: campi.giorniSettimana.slice()
        };
        if (esistente) {
          Object.keys(valori).forEach(function (k) { esistente[k] = valori[k]; });
          return App.data.calendari.salva(esistente).then(function () { return esistente; });
        }
        valori.id = App.core.idDeterministici.calendario(stagioneId);
        valori.stagioneId = stagioneId;
        valori.demo = false;
        var nuovo = App.data.repo.timbraCreazione(valori);
        return App.data.calendari.salva(nuovo).then(function () { return nuovo; });
      });
    });
  }

  // Elenco delle date con lo stato della giornata, se esiste.
  // Nessun record viene creato qui.
  function elenco(stagioneId) {
    return Promise.all([
      App.data.calendari.perStagione(stagioneId),
      App.data.giornate.perStagione(stagioneId),
      App.data.lottiCarne.perStagione(stagioneId)
    ]).then(function (r) {
      var config = r[0];
      var perData = {};
      r[1].forEach(function (g) { perData[g.data] = g; });
      var lottoPerGiornata = {};
      r[2].forEach(function (l) { lottoPerGiornata[l.giornataId] = l; });

      var date = dateDa(config);
      var vistoInCalendario = {};
      date.forEach(function (d) { vistoInCalendario[d] = true; });

      var righe = date.map(function (d) {
        var g = perData[d] || null;
        return {
          data: d,
          giornata: g,
          fuoriCalendario: false,
          lotto: g ? (lottoPerGiornata[g.id] || null) : null,
          stato: g ? g.stato : 'DA_COMPILARE'
        };
      });

      // Una giornata creata fuori dalle date previste non deve sparire.
      r[1].forEach(function (g) {
        if (vistoInCalendario[g.data]) return;
        righe.push({
          data: g.data, giornata: g, fuoriCalendario: true,
          lotto: lottoPerGiornata[g.id] || null, stato: g.stato
        });
      });
      righe.sort(function (a, b) { return a.data.localeCompare(b.data); });
      return { configurazione: config, righe: righe };
    });
  }

  // Prima data utile da oggi in avanti (oggi incluso).
  function prossimaData(righe, oggi) {
    var futura = righe.filter(function (r) {
      return r.data >= oggi && r.stato !== 'ANNULLATA';
    });
    return futura.length ? futura[0] : null;
  }

  App.core.calendarioBattute = {
    valida: valida,
    dateDa: dateDa,
    perStagione: perStagione,
    salva: salva,
    elenco: elenco,
    prossimaData: prossimaData,
    isoDa: isoDa
  };
})(typeof window !== 'undefined' ? window : globalThis);
