(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};
  var S = App.costanti.STATO_QUOTA;

  // Gli importi sono SEMPRE centesimi interi nel modello dati.
  // Lo stato e il residuo sono derivati: mai salvati, mai indicizzati.

  function intero(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return Math.round(n);
  }

  function stato(previstaCent, versataCent) {
    var p = intero(previstaCent);
    var v = intero(versataCent);
    if (p <= 0) return S.NON_APPLICABILE;
    if (v <= 0) return S.NON_PAGATA;
    if (v < p) return S.PARZIALE;
    return S.PAGATA;
  }

  function statoIscrizione(iscrizione) {
    if (!iscrizione) return null;   // membro non iscritto alla stagione
    return stato(iscrizione.quotaAnnualePrevistaCent, iscrizione.quotaVersataCent);
  }

  function residuoCent(previstaCent, versataCent) {
    return Math.max(0, intero(previstaCent) - intero(versataCent));
  }

  function residuoIscrizione(iscrizione) {
    if (!iscrizione) return 0;
    return residuoCent(iscrizione.quotaAnnualePrevistaCent, iscrizione.quotaVersataCent);
  }

  // "24000" -> "240,00 €"
  function formattaEuro(cent) {
    var n = intero(cent) / 100;
    var testo;
    try {
      testo = n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      testo = n.toFixed(2).replace('.', ',');
    }
    return testo + ' €';
  }

  // Valore per <input>: "240,00"
  function euroPerInput(cent) {
    return (intero(cent) / 100).toFixed(2).replace('.', ',');
  }

  // "240" / "240,00" / "1.240,50" / "240.50" -> centesimi. null se non valido.
  function parseEuroInCent(testo) {
    if (testo === null || testo === undefined) return null;
    var s = String(testo).trim().replace(/\s/g, '').replace(/€/g, '');
    if (s === '') return 0;
    if (!/^-?[0-9.,]+$/.test(s)) return null;

    var haVirgola = s.indexOf(',') !== -1;
    var haPunto = s.indexOf('.') !== -1;

    if (haVirgola && haPunto) {
      // formato italiano: punto = migliaia, virgola = decimali
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (haVirgola) {
      s = s.replace(',', '.');
    } else if (haPunto) {
      // un solo punto con 1-2 decimali = separatore decimale; altrimenti migliaia
      var parti = s.split('.');
      if (parti.length === 2 && parti[1].length <= 2) {
        s = parti.join('.');
      } else {
        s = parti.join('');
      }
    }
    var n = Number(s);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  // Conteggi Home: pagate / da incassare (NON_PAGATA + PARZIALE).
  function riepilogo(iscrizioni) {
    var out = {
      totali: 0, pagate: 0, parziali: 0, nonPagate: 0,
      nonApplicabili: 0, daIncassare: 0, residuoTotaleCent: 0
    };
    (iscrizioni || []).forEach(function (i) {
      out.totali++;
      var st = statoIscrizione(i);
      if (st === S.PAGATA) out.pagate++;
      else if (st === S.PARZIALE) { out.parziali++; out.daIncassare++; }
      else if (st === S.NON_PAGATA) { out.nonPagate++; out.daIncassare++; }
      else out.nonApplicabili++;
      out.residuoTotaleCent += residuoIscrizione(i);
    });
    return out;
  }

  App.core.quote = {
    STATO: S,
    stato: stato,
    statoIscrizione: statoIscrizione,
    residuoCent: residuoCent,
    residuoIscrizione: residuoIscrizione,
    formattaEuro: formattaEuro,
    euroPerInput: euroPerInput,
    parseEuroInCent: parseEuroInCent,
    riepilogo: riepilogo
  };
})(typeof window !== 'undefined' ? window : globalThis);
