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
      App.data.abbattimenti.tutti(),
      App.data.presenze.tutte()
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

      var capocacciaProssima = prossima && prossima.capocacciaMembroId
        ? membriPerId[prossima.capocacciaMembroId] : null;
      var presentiProssima = prossima
        ? r[3].filter(function (p) {
            return p.giornataId === prossima.id &&
              p.stato === App.costanti.STATO_PRESENZA.PRESENTE;
          }).length
        : 0;
      var capiProssima = prossima
        ? r[2].filter(function (a) {
            return a.giornataId === prossima.id && !a.annullato;
          }).length
        : 0;

      C.monta(
        // --- marchio, discreto ---
        '<div class="marchio-riga">' +
          '<img class="logo" src="icona-192.png" alt="" width="40" height="40">' +
          '<div>' +
            '<div class="marchio">Adrenalina</div>' +
            '<div class="stagione">' +
              (ctx.stagioneAttiva
                ? 'Stagione ' + C.esc(ctx.stagioneAttiva.nome)
                : 'Nessuna stagione attiva') +
            '</div>' +
          '</div>' +
        '</div>' +

        // --- cosa succede adesso ---
        (prossima
          ? '<div class="blocco-oggi">' +
              '<div class="quando-etichetta">' +
                (String(prossima.data) === oggi ? 'Oggi' : 'Prossima battuta') +
              '</div>' +
              '<div class="data">' +
                C.esc(V.giornoSettimana(prossima.data)) + ' ' +
                C.esc(C.formattaData(prossima.data)) +
              '</div>' +
              '<div class="zona">' + C.esc(prossima.zona || 'Zona non indicata') + '</div>' +
              '<div class="meta">' +
                (prossima.orarioRitrovo ? 'Ritrovo ' + C.esc(prossima.orarioRitrovo) : 'Orario da definire') +
                ' · ' +
                (capocacciaProssima
                  ? 'Capocaccia ' + C.esc(C.nomeCompleto(capocacciaProssima))
                  : 'capocaccia da assegnare') +
              '</div>' +
              '<div class="numeri">' +
                '<div><b>' + presentiProssima + '</b><span>partecipanti</span></div>' +
                '<div><b>' + capiProssima + '</b><span>capi</span></div>' +
              '</div>' +
              '<button class="btn btn-azione" data-vai="#/giornata/' + C.esc(prossima.id) +
                '">Apri giornata</button>' +
            '</div>'
          : '<div class="blocco-oggi vuota">' +
              '<div class="quando-etichetta">Nessuna battuta in programma</div>' +
              '<button class="btn btn-azione" data-vai="#/giornate">Vai alle giornate</button>' +
            '</div>') +

        // --- la stagione in tre numeri, senza cornici ---
        '<div class="stagione-riga">' +
          '<div><b>' + attivi.length + '</b><span>soci</span></div>' +
          '<div><b>' + giornateStagione.length + '</b><span>giornate</span></div>' +
          '<div><b>' + numCapi + '</b><span>capi</span></div>' +
        '</div>' +

        // --- amministrazione, chiaramente secondaria ---
        '<div class="sezione">' +
          '<h3>Amministrazione</h3>' +
          '<div class="lista">' +
            '<button class="voce" data-vai="#/stagioni">' +
              '<span class="principale"><span class="titolo">Stagioni</span>' +
              '<span class="sotto">' + C.esc(ctx.stagioneAttiva ? ctx.stagioneAttiva.nome : '—') +
              '</span></span>' +
              '<span class="freccia">&#8250;</span>' +
            '</button>' +
            '<button class="voce" data-vai="#/backup">' +
              '<span class="principale"><span class="titolo">Backup dati</span>' +
              '<span class="sotto">esporta o importa l\u2019archivio</span></span>' +
              '<span class="freccia">&#8250;</span>' +
            '</button>' +
            '<button class="voce" disabled>' +
              '<span class="principale"><span class="titolo">Cassa</span>' +
              '<span class="sotto">' + riep.daIncassare + ' quote da incassare · ' +
              C.esc(Q.formattaEuro(riep.residuoTotaleCent)) + '</span></span>' +
              '<span class="coda">Prossimamente</span>' +
            '</button>' +
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
