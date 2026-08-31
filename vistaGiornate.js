(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  var GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  function giornoSettimana(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return GIORNI[d.getDay()] || '';
  }

  // Marcatore testuale davanti all'etichetta: lo stato resta riconoscibile
  // anche in bianco e nero o per chi non distingue i colori.
  var SEGNO = { PROGRAMMATA: '\u25CB', COMPLETATA: '\u2713', ANNULLATA: '\u2715' };

  function classeStato(stato) {
    if (stato === 'COMPLETATA') return 'stato completata';
    if (stato === 'ANNULLATA') return 'stato annullata';
    return 'stato programmata';
  }

  function etichettaStato(stato) {
    return '<span class="' + classeStato(stato) + '">' + (SEGNO[stato] || '') + ' ' +
      App.ui.componenti.esc(App.costanti.etichettaStatoGiornata(stato)) + '</span>';
  }

  // La scheda giornata riusa questa funzione.
  function badgeStato(stato) { return etichettaStato(stato); }

  function render() {
    var C = App.ui.componenti;
    return App.core.giornata.elenco().then(function (dati) {
      var ctx = dati.contesto;
      C.intestazione({
        titolo: 'Giornate',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: '#/home'
      });

      if (!ctx.stagioneAttiva) {
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2>' +
          '<p>Le giornate appartengono a una stagione. Attivane una per continuare.</p></div>' +
          '<div class="sezione pila" style="margin-top:16px">' +
          '<button class="btn btn-primario btn-largo" data-vai="#/stagioni">Vai a Stagioni</button>' +
          '</div>');
        return;
      }

      var oggi = App.core.giornata.oggiIso();

      function riga(r) {
        var g = r.giornata;
        return '<button class="voce voce-giornata' +
          (g.stato === 'ANNULLATA' ? ' annullata' : '') +
          '" data-vai="#/giornata/' + C.esc(g.id) + '">' +
          '<span class="principale">' +
            '<span class="alta">' +
              '<span class="data">' + C.esc(giornoSettimana(g.data)) + ' ' +
                C.esc(C.formattaData(g.data)) + '</span>' +
              etichettaStato(g.stato) +
            '</span>' +
            '<span class="zona">' + C.esc(g.zona || 'Zona non indicata') + '</span>' +
            '<span class="meta">' +
              (g.orarioRitrovo ? C.esc(g.orarioRitrovo) + ' · ' : '') +
              (r.capocaccia
                ? C.esc(C.nomeCompleto(r.capocaccia))
                : 'capocaccia da assegnare') +
              ' · ' + r.presenti + ' partecipant' + (r.presenti === 1 ? 'e' : 'i') +
            '</span>' +
          '</span>' +
          '<span class="freccia">&#8250;</span>' +
        '</button>';
      }

      var future = [], passate = [];
      dati.righe.forEach(function (r) {
        (String(r.giornata.data) >= oggi ? future : passate).push(r);
      });

      function gruppo(titolo, elenco, vuoto) {
        return '<div class="sezione"><h3>' + titolo + '</h3>' +
          (elenco.length
            ? '<div class="lista">' + elenco.map(riga).join('') + '</div>'
            : '<p class="nota-piede">' + vuoto + '</p>') +
        '</div>';
      }

      C.monta(
        '<div class="sezione">' +
          '<button class="btn btn-azione" data-vai="#/giornata/nuova">' +
          '+ Nuova giornata</button>' +
        '</div>' +
        gruppo('In programma', future, 'Nessuna giornata in programma.') +
        gruppo('Passate', passate, 'Nessuna giornata passata.'));
    });
  }

  App.ui.viste.giornate = { render: render, giornoSettimana: giornoSettimana, badgeStato: badgeStato };
})(typeof window !== 'undefined' ? window : globalThis);
