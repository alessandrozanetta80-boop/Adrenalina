(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // Card di un capo, riusata anche dalla scheda giornata.
  function cardCapo(riga, controllo) {
    var C = App.ui.componenti;
    var K = App.core.capo;
    var a = riga.capo;
    var positivo = controllo && controllo.statoTrichinella === 'POSITIVO';
    // Gerarchia: codice + peso sulla stessa riga, poi il capo, poi chi e quando.
    // Lo stato sanitario chiude la card in una fascia separata.
    return '<button class="voce-capo' + (a.annullato ? ' annullato' : '') +
      '" data-vai="#/capo/' + C.esc(a.id) + '">' +
      '<div class="riga-testata">' +
        '<span class="codice">' + C.esc(a.codiceCapo) + '</span>' +
        '<span class="peso">' + C.esc(K.formattaKg(a.pesoGrammi)) + '</span>' +
      '</div>' +
      '<div class="dati-capo">' +
        C.esc(App.costanti.etichettaSesso(a.sesso)) + ' \u00b7 ' +
        C.esc(App.costanti.etichettaClasseEta(a.classeEta)) +
      '</div>' +
      '<div class="tiratore">' + (riga.tiratore
        ? C.esc(C.nomeCompleto(riga.tiratore)) : 'Tiratore non trovato') + '</div>' +
      '<div class="quando">' +
        C.esc(C.formattaData(riga.data)) +
        (riga.zona ? ' \u00b7 ' + C.esc(riga.zona) : '') +
      '</div>' +
      (a.annullato
        ? '<div class="fascia-annullato">\u2715 Annullato</div>'
        : '') +
      '<div class="riga-sanitaria' + (positivo ? ' positivo' : '') +
        (controllo ? '' : ' assente') + '">' +
        (positivo ? '\u26A0 ' : '') + 'Trichinella: ' +
        C.esc(App.core.sanitario.etichettaStato(controllo)) +
      '</div>' +
    '</button>';
  }

  function render() {
    var C = App.ui.componenti;
    return Promise.all([
      App.core.capo.elenco(),
      App.core.sanitario.mappaPerAbbattimenti()
    ]).then(function (risultati) {
      var dati = risultati[0];
      var controlli = risultati[1];
      var ctx = dati.contesto;
      C.intestazione({
        titolo: 'Registro abbattimenti',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: '#/home'
      });

      if (!ctx.stagioneAttiva) {
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2>' +
          '<p>I capi appartengono a una stagione. Attivane una per continuare.</p></div>');
        return;
      }

      var validi = dati.righe.filter(function (r) { return !r.capo.annullato; }).length;
      var annullati = dati.righe.length - validi;

      var elenco = dati.righe.length
        ? '<div class="elenco">' + dati.righe.map(function (r) {
            return cardCapo(r, controlli[r.capo.id] || null);
          }).join('') + '</div>'
        : '<div class="vuoto">Nessun capo registrato in questa stagione.</div>';

      C.monta(
        '<div class="sezione">' +
          '<div class="riepilogo">' +
            '<div class="squadra">' + validi + ' cap' + (validi === 1 ? 'o' : 'i') + '</div>' +
            '<div class="stagione">Stagione ' + C.esc(ctx.stagioneAttiva.nome) +
              (annullati ? ' · ' + annullati + ' annullat' + (annullati === 1 ? 'o' : 'i') : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="sezione">' +
          '<button class="btn btn-primario btn-largo" data-vai="#/capo/nuovo">' +
          '+ Nuovo abbattimento</button>' +
        '</div>' +
        '<div class="sezione">' + elenco + '</div>' +
        '<p class="nota-piede">Sono mostrati i capi della stagione attiva, dai più recenti. ' +
        'I capi annullati restano in archivio.</p>');
    });
  }

  App.ui.viste.abbattimenti = { render: render, cardCapo: cardCapo };
})(typeof window !== 'undefined' ? window : globalThis);
