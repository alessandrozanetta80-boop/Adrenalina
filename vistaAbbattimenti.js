(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // Card di un capo, riusata anche dalla scheda giornata.
  function cardCapo(riga, controllo) {
    var C = App.ui.componenti;
    var K = App.core.capo;
    var a = riga.capo;
    var stato = App.core.sanitario.etichettaStato(controllo);
    var classe = 'assente';
    if (controllo) {
      if (controllo.statoTrichinella === 'POSITIVO') classe = 'positivo';
      else if (controllo.statoTrichinella === 'NEGATIVO_CONFORME') classe = 'ok';
      else if (controllo.statoTrichinella === 'IN_ATTESA') classe = 'attesa';
      else classe = 'neutro';
    }
    return '<button class="voce voce-capo' + (a.annullato ? ' annullato' : '') +
      '" data-vai="#/capo/' + C.esc(a.id) + '">' +
      '<span class="principale">' +
        '<span class="alta">' +
          '<span class="codice">' + C.esc(a.codiceCapo) + '</span>' +
          '<span class="peso">' + C.esc(K.formattaKg(a.pesoGrammi)) + '</span>' +
        '</span>' +
        '<span class="dati">' +
          C.esc(App.costanti.etichettaSesso(a.sesso)) + ' \u00b7 ' +
          C.esc(App.costanti.etichettaClasseEta(a.classeEta)) +
          (a.annullato ? ' \u00b7 <b class="rosso">Annullato</b>' : '') +
        '</span>' +
        '<span class="chi">' + (riga.tiratore
          ? C.esc(C.nomeCompleto(riga.tiratore)) : 'Tiratore non trovato') + '</span>' +
        '<span class="dove">' + C.esc(C.formattaData(riga.data)) +
          (riga.zona ? ' \u00b7 ' + C.esc(riga.zona) : '') + '</span>' +
        '<span class="sanitario">Trichinella \u00b7 ' +
          '<span class="esito ' + classe + '">' +
          (classe === 'positivo' ? '\u26A0 ' : '') + C.esc(stato) + '</span></span>' +
      '</span>' +
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
      if (!ctx.stagioneAttiva) {
        C.intestazione({ titolo: 'Abbattimenti', sotto: 'Nessuna stagione attiva',
          indietro: '#/home' });
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2>' +
          '<p>I capi appartengono a una stagione. Attivane una per continuare.</p></div>');
        return;
      }

      var validi = dati.righe.filter(function (r) { return !r.capo.annullato; }).length;
      var annullati = dati.righe.length - validi;

      C.intestazione({
        titolo: 'Abbattimenti',
        sotto: 'Stagione ' + ctx.stagioneAttiva.nome + ' · ' + validi +
          ' cap' + (validi === 1 ? 'o' : 'i') +
          (annullati ? ' · ' + annullati + ' annullat' + (annullati === 1 ? 'o' : 'i') : ''),
        indietro: '#/home'
      });

      C.monta(
        '<div class="sezione">' +
          '<button class="btn btn-azione" data-vai="#/capo/nuovo">' +
          '+ Nuovo abbattimento</button>' +
        '</div>' +
        '<div class="sezione">' +
          (dati.righe.length
            ? '<div class="lista">' + dati.righe.map(function (r) {
                return cardCapo(r, controlli[r.capo.id] || null);
              }).join('') + '</div>'
            : '<p class="nota-piede">Nessun capo registrato in questa stagione.</p>') +
        '</div>');
    });
  }

  App.ui.viste.abbattimenti = { render: render, cardCapo: cardCapo };
})(typeof window !== 'undefined' ? window : globalThis);
