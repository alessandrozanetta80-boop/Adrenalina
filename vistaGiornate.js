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

  function badgeStato(stato) {
    var classe = 'badge badge-stato';
    if (stato === 'COMPLETATA') classe += ' badge-ok';
    else if (stato === 'ANNULLATA') classe += ' badge-pericolo badge-annullato';
    else classe += ' badge-verde';
    return '<span class="' + classe + '">' + (SEGNO[stato] || '') + ' ' +
      App.ui.componenti.esc(App.costanti.etichettaStatoGiornata(stato)) + '</span>';
  }

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

      var elenco = dati.righe.length
        ? '<div class="elenco">' + dati.righe.map(function (r) {
            var g = r.giornata;
            var passata = String(g.data) < oggi;
            // Griglia a due colonne: testo a sinistra, stato sempre in alto a
            // destra. La lunghezza della data non sposta piu' il badge.
            return '<button class="voce-giornata' +
              (passata ? ' passata' : '') +
              (g.stato === 'ANNULLATA' ? ' annullata' : '') +
              '" data-vai="#/giornata/' + C.esc(g.id) + '">' +
              '<div class="testo">' +
                '<div class="quando">' +
                  '<span class="giorno">' + C.esc(giornoSettimana(g.data)) + '</span> ' +
                  '<span class="data">' + C.esc(C.formattaData(g.data)) + '</span>' +
                '</div>' +
                '<div class="zona">' + C.esc(g.zona || 'Zona non indicata') + '</div>' +
              '</div>' +
              '<div class="stato">' + badgeStato(g.stato) + '</div>' +
              '<div class="meta-riga">' +
                '<span>' +
                  (g.orarioRitrovo ? 'ore ' + C.esc(g.orarioRitrovo) + ' · ' : '') +
                  (r.capocaccia
                    ? C.esc(C.nomeCompleto(r.capocaccia))
                    : 'Capocaccia da assegnare') +
                '</span>' +
                '<span class="presenti">' + r.presenti +
                  ' present' + (r.presenti === 1 ? 'e' : 'i') + '</span>' +
              '</div>' +
            '</button>';
          }).join('') + '</div>'
        : '<div class="vuoto">Nessuna giornata in questa stagione.</div>';

      C.monta(
        '<div class="sezione">' +
          '<button class="btn btn-primario btn-largo" data-vai="#/giornata/nuova">' +
          '+ Nuova giornata</button>' +
        '</div>' +
        '<div class="sezione">' + elenco + '</div>' +
        '<p class="nota-piede">Sono mostrate solo le giornate della stagione attiva. ' +
        'Le stagioni precedenti conservano le proprie.</p>');
    });
  }

  App.ui.viste.giornate = { render: render, giornoSettimana: giornoSettimana, badgeStato: badgeStato };
})(typeof window !== 'undefined' ? window : globalThis);
