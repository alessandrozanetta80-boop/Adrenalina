(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
  }

  function render(params) {
    var C = App.ui.componenti;
    var V = App.ui.viste.giornate;

    return App.core.giornata.scheda(params.id).then(function (dati) {
      if (!dati) return { dati: null, capi: null };
      return App.core.capo.perGiornata(params.id).then(function (capi) {
        return { dati: dati, capi: capi };
      });
    }).then(function (pacchetto) {
      var dati = pacchetto.dati;
      if (!dati) {
        C.intestazione({ titolo: 'Giornata', indietro: '#/giornate' });
        C.erroreSchermo('Giornata non trovata.');
        return;
      }
      var g = dati.giornata;
      var r = dati.riepilogo;
      var dellaStagioneAttiva = dati.contesto.stagioneAttiva &&
        dati.contesto.stagioneAttiva.id === g.stagioneId;

      C.intestazione({
        titolo: V.giornoSettimana(g.data) + ' ' + C.formattaData(g.data),
        sotto: dati.stagione ? 'Stagione ' + dati.stagione.nome : '',
        indietro: '#/giornate'
      });

      C.monta(
        '<div class="sezione">' +
          '<div class="testata-giornata' +
            (g.stato === 'ANNULLATA' ? ' annullata' : '') + '">' +
            '<div class="riga-alta">' +
              '<div class="quando">' +
                C.esc(V.giornoSettimana(g.data)) + ' ' + C.esc(C.formattaData(g.data)) +
              '</div>' +
              V.badgeStato(g.stato) +
            '</div>' +
            '<div class="titolo">' + C.esc(g.zona || 'Zona non indicata') + '</div>' +
            '<dl class="righe">' +
              '<div><dt>Ritrovo</dt><dd>' +
                (g.orarioRitrovo ? 'ore ' + C.esc(g.orarioRitrovo) : '—') + '</dd></div>' +
              '<div><dt>Capocaccia</dt><dd>' +
                (dati.capocaccia ? C.esc(C.nomeCompleto(dati.capocaccia)) : 'Da assegnare') +
              '</dd></div>' +
            '</dl>' +
          '</div>' +
        '</div>' +

        '<div class="sezione"><h3>Presenze</h3><div class="card">' +
          '<div class="griglia-presenze-riepilogo">' +
            '<div><span class="valore">' + r.presenti + '</span><span class="etichetta">Presenti</span></div>' +
            '<div><span class="valore">' + r.assenti + '</span><span class="etichetta">Assenti</span></div>' +
            '<div><span class="valore">' + r.lavoro + '</span><span class="etichetta">Lavoro</span></div>' +
          '</div>' +
          '<button class="btn btn-primario btn-largo" data-vai="#/giornata/' + C.esc(g.id) +
          '/presenze" style="margin-top:12px">Gestisci presenze</button>' +
        '</div></div>' +

        // --- Abbattimenti della giornata (unica aggiunta a questa scheda) ---
        '<div class="sezione"><h3>Abbattimenti</h3><div class="card">' +
          '<p style="margin:0 0 10px"><strong>' + pacchetto.capi.validi + '</strong> cap' +
          (pacchetto.capi.validi === 1 ? 'o valido' : 'i validi') + ' in questa giornata.</p>' +
          (pacchetto.capi.tutti.length
            ? '<ul class="elenco-capi-giornata">' + pacchetto.capi.tutti.map(function (r) {
                return '<li' + (r.capo.annullato ? ' class="annullato"' : '') + '>' +
                  '<a href="#/capo/' + C.esc(r.capo.id) + '">' +
                    '<span class="riga-alta">' +
                      '<span class="codice">' + C.esc(r.capo.codiceCapo) + '</span>' +
                      '<span class="peso">' +
                        C.esc(App.core.capo.formattaKg(r.capo.pesoGrammi)) + '</span>' +
                    '</span>' +
                    '<span class="riga-bassa">' +
                      '<span class="tir">' +
                        (r.tiratore ? C.esc(C.nomeCompleto(r.tiratore)) : '—') + '</span>' +
                      (r.capo.annullato
                        ? '<span class="badge badge-pericolo badge-annullato">' +
                          '\u2715 Annullato</span>'
                        : '') +
                    '</span>' +
                  '</a>' +
                '</li>';
              }).join('') + '</ul>'
            : '') +
          '<button class="btn btn-largo" data-vai="#/capo/nuovo/' + C.esc(g.id) +
          '" style="margin-top:12px">+ Registra abbattimento</button>' +
        '</div></div>' +

        (g.note
          ? '<div class="sezione"><h3>Note</h3><div class="card"><p style="margin:0">' +
            C.esc(g.note) + '</p></div></div>'
          : '') +

        '<div class="sezione pila">' +
          '<button class="btn btn-largo" data-vai="#/giornata/' + C.esc(g.id) +
            '/modifica">Modifica giornata</button>' +
        '</div>' +

        (dellaStagioneAttiva ? '' :
          '<p class="nota-piede">Questa giornata appartiene a una stagione non attiva.</p>'));
    });
  }

  App.ui.viste.schedaGiornata = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
