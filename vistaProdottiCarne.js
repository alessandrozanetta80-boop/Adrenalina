(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // PRODOTTI E PREZZI
  //
  // Un prezzo standard per tipo di prodotto, per stagione. Serve solo a
  // proporre il prezzo giusto quando si registra una vendita: quello
  // della singola vendita resta modificabile e non tocca lo standard.
  //
  // I prezzi vivono in configCarne, che esiste gia': niente struttura
  // nuova.

  function euroPerKg(cent) {
    return App.core.quote.formattaEuro(cent);
  }

  function render() {
    var C = App.ui.componenti;
    var K = App.core.carne;

    return App.core.squadra.contesto().then(function (ctx) {
      C.intestazione({
        titolo: 'Prodotti e prezzi',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : '',
        indietro: '#/carne'
      });
      if (!ctx.stagioneAttiva) {
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2></div>');
        return undefined;
      }

      return K.configPerStagione(ctx.stagioneAttiva.id).then(function (config) {
        var prezzi = config.prezziCentKg || {};

        C.monta(
          '<div class="sezione">' +
            '<p class="nota-piccola">Il prezzo standard viene proposto quando ' +
            'registri una vendita. Puoi cambiarlo per quella singola vendita ' +
            'senza toccare lo standard.</p>' +
            '<div class="lista">' +
              App.costanti.TIPI_TAGLIO.map(function (t) {
                var cent = typeof prezzi[t.codice] === 'number'
                  ? prezzi[t.codice] : t.prezzoCentKg;
                return '<div class="voce">' +
                  '<span class="principale">' +
                    '<span class="titolo">' + C.esc(t.etichetta) + '</span>' +
                    '<span class="sotto">' + C.esc(euroPerKg(cent)) + ' al kg</span>' +
                  '</span>' +
                  C.seModifica('<button class="btn-piccolo" data-prezzo="' +
                    C.esc(t.codice) + '">Cambia</button>') +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>');

        Array.prototype.forEach.call(
          document.querySelectorAll('[data-prezzo]'), function (b) {
            b.addEventListener('click', function () {
              var codice = b.getAttribute('data-prezzo');
              var tipo = App.costanti.TIPI_TAGLIO.filter(function (t) {
                return t.codice === codice;
              })[0];
              var attuale = typeof prezzi[codice] === 'number'
                ? prezzi[codice] : tipo.prezzoCentKg;
              C.chiediNumero({
                titolo: tipo.etichetta,
                testo: 'Prezzo proposto quando vendi questo prodotto.',
                etichetta: 'Prezzo al chilo',
                unita: '€/kg',
                valore: (attuale / 100).toFixed(2).replace('.', ','),
                conferma: 'Salva',
                valida: function (v) {
                  var cent = App.core.quote.parseEuroInCent(v);
                  if (cent === null) return 'Scrivi un prezzo, per esempio 18,00.';
                  if (cent <= 0) return 'Il prezzo deve essere maggiore di zero.';
                  return null;
                }
              }).then(function (v) {
                if (v === null) return undefined;
                var nuovi = {};
                Object.keys(prezzi).forEach(function (k) { nuovi[k] = prezzi[k]; });
                nuovi[codice] = App.core.quote.parseEuroInCent(v);
                return K.aggiornaPrezzi(ctx.stagioneAttiva.id, nuovi).then(function () {
                  C.toast('Prezzo aggiornato.');
                  render();
                });
              }).catch(function (e) { C.toast(e.message, 'errore'); });
            });
          });
        return undefined;
      });
    });
  }

  App.ui.viste.prodottiCarne = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
