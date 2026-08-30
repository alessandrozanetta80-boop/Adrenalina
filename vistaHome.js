(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};
  var C = null;

  function render() {
    C = App.ui.componenti;
    return Promise.all([
      App.core.membro.elenco(),
      App.data.giornate.tutte(),
      App.data.abbattimenti.tutti()
    ]).then(function (r) {
      var dati = r[0];
      var ctx = dati.contesto;
      var Q = App.core.quote;

      // Rete di sicurezza: il router gia' devia alla configurazione iniziale
      // quando non esiste nessuna squadra.
      if (!ctx.squadra) return App.ui.router.vai('#/configurazione');

      var idStagione = ctx.stagioneAttiva ? ctx.stagioneAttiva.id : null;

      var giornateStagione = idStagione
        ? r[1].filter(function (g) { return g.stagioneId === idStagione; })
        : [];
      // Conteggio derivato: capi non annullati della stagione attiva.
      var numCapi = idStagione
        ? r[2].filter(function (a) {
            return a.stagioneId === idStagione && !a.annullato;
          }).length
        : 0;

      var attivi = dati.righe.filter(function (x) { return x.membro.attivo; });
      var riep = Q.riepilogo(attivi.map(function (x) { return x.iscrizione; })
        .filter(function (i) { return !!i; }));
      var nonIscritti = attivi.filter(function (x) { return !x.iscrizione; }).length;

      var membriPerId = {};
      dati.righe.forEach(function (x) { membriPerId[x.membro.id] = x.membro; });

      // Prossima giornata: la piu' vicina fra quelle non passate e non annullate.
      var oggi = App.core.giornata.oggiIso();
      var future = giornateStagione.filter(function (g) {
        return String(g.data) >= oggi && g.stato !== 'ANNULLATA';
      }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
      var prossima = future[0] || null;

      C.intestazione({ nascosta: true });

      var V = App.ui.viste.giornate;

      function navCard(hash, titolo, secondario) {
        return '<button class="btn-nav" data-vai="' + hash + '">' +
          '<span class="voce">' + titolo + '</span>' +
          '<span class="freccia">' +
            (secondario ? '<span class="dato">' + secondario + '</span>' : '') +
            '&#8250;' +
          '</span>' +
        '</button>';
      }

      // Voce presente ma non ancora attiva: il modulo non esiste.
      function navInattiva(titolo) {
        return '<button class="btn-nav btn-nav-inattivo" disabled>' +
          '<span class="voce">' + titolo + '</span>' +
          '<span class="freccia"><span class="dato">Prossimamente</span></span>' +
        '</button>';
      }

      var capocacciaProssima = prossima && prossima.capocacciaMembroId
        ? membriPerId[prossima.capocacciaMembroId] : null;

      C.monta(
        // --- A. testata identitaria ---
        '<div class="testata-identita">' +
          '<div class="riga-marchio">' +
            '<img class="logo" src="icona-192.png" alt="" width="52" height="52">' +
            '<div class="marchio">Adrenalina</div>' +
          '</div>' +
          '<div class="stagione">' +
            (ctx.stagioneAttiva
              ? 'Stagione ' + C.esc(ctx.stagioneAttiva.nome)
              : 'Nessuna stagione attiva') +
          '</div>' +
        '</div>' +

        // --- B. prossima giornata (solo se esiste) ---
        (prossima
          ? '<div class="sezione">' +
              '<div class="card-prossima">' +
                '<div class="occhiello">' +
                  (String(prossima.data) === oggi ? 'Oggi' : 'Prossima giornata') +
                '</div>' +
                '<div class="quando">' +
                  C.esc(V.giornoSettimana(prossima.data)) + ' ' +
                  C.esc(C.formattaData(prossima.data)) +
                '</div>' +
                '<div class="zona">' + C.esc(prossima.zona || 'Zona non indicata') + '</div>' +
                '<dl class="righe">' +
                  '<div><dt>Ritrovo</dt><dd>' +
                    (prossima.orarioRitrovo ? 'ore ' + C.esc(prossima.orarioRitrovo) : '—') +
                  '</dd></div>' +
                  '<div><dt>Capocaccia</dt><dd>' +
                    (capocacciaProssima
                      ? C.esc(C.nomeCompleto(capocacciaProssima))
                      : 'Da assegnare') +
                  '</dd></div>' +
                '</dl>' +
                '<button class="btn btn-primario btn-largo" data-vai="#/giornata/' +
                  C.esc(prossima.id) + '">Apri giornata</button>' +
              '</div>' +
            '</div>'
          : '') +

        // --- C. la stagione in tre numeri, senza card amministrative ---
        '<div class="sezione">' +
          '<div class="strip-stagione">' +
            '<div><span class="valore">' + attivi.length + '</span>' +
              '<span class="etichetta">Membri attivi</span></div>' +
            '<div><span class="valore">' + giornateStagione.length + '</span>' +
              '<span class="etichetta">Giornate</span></div>' +
            '<div><span class="valore">' + numCapi + '</span>' +
              '<span class="etichetta">Capi stagione</span></div>' +
          '</div>' +
        '</div>' +

        // --- D. le quattro porte principali ---
        '<div class="sezione">' +
          '<div class="pila">' +
            navCard('#/giornate', 'Giornate', giornateStagione.length + ' in stagione') +
            navCard('#/soci', 'Squadra', attivi.length + ' attivi') +
            navCard('#/abbattimenti', 'Abbattimenti', numCapi + ' capi') +
            navInattiva('Cassa') +
          '</div>' +
        '</div>' +

        // --- E. amministrazione, fuori dal percorso quotidiano ---
        '<div class="sezione">' +
          '<h3>Amministrazione</h3>' +
          '<div class="pila">' +
            '<div class="card riga-quote">' +
              '<span class="valore">' + riep.daIncassare + '</span>' +
              '<span class="etichetta">Quote da incassare</span>' +
              '<span class="extra">' + C.esc(Q.formattaEuro(riep.residuoTotaleCent)) +
                ' · ' + riep.pagate + ' pagate</span>' +
            '</div>' +
            navCard('#/stagioni', 'Stagioni', ctx.stagioni.length +
              (ctx.stagioni.length === 1 ? ' stagione' : ' stagioni')) +
            navCard('#/backup', 'Backup dati', '') +
          '</div>' +
          (nonIscritti
            ? '<p class="nota-piede">' + nonIscritti +
              ' socio/i attivo/i non ancora iscritto/i alla stagione attiva.</p>'
            : '') +
        '</div>' +

        '<p class="nota-piede">Adrenalina v' + C.esc(App.versione.APP_VERSION) +
        ' — dati salvati solo su questo dispositivo</p>');
    });
  }

  App.ui.viste.home = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
