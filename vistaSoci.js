(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};
  var mostraInattivi = true;

  function render() {
    var C = App.ui.componenti;
    return App.core.membro.elenco().then(function (dati) {
      var ctx = dati.contesto;
      C.intestazione({
        titolo: 'Squadra / Soci',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: '#/home'
      });

      var righe = dati.righe.filter(function (r) { return mostraInattivi || r.membro.attivo; });
      var inattivi = dati.righe.filter(function (r) { return !r.membro.attivo; }).length;

      var elenco = righe.length
        ? '<div class="elenco">' + righe.map(function (r) {
            var m = r.membro;
            return '<button class="voce-socio' + (m.attivo ? '' : ' inattivo') +
              '" data-vai="#/socio/' + C.esc(m.id) + '">' +
              '<div class="nome">' + C.esc(C.nomeCompleto(m)) + '</div>' +
              '<div class="ruoli">' +
                C.esc(r.iscrizione ? C.etichettaRuoli(r.iscrizione.ruoliVenatori) : 'Non iscritto') +
                (r.iscrizione && r.iscrizione.ospite ? ' · Ospite' : '') +
              '</div>' +
              '<div class="badge-riga">' +
                C.badgeAttivo(m.attivo) +
                C.badgeQuota(r.statoQuota) +
              '</div>' +
            '</button>';
          }).join('') + '</div>'
        : '<div class="vuoto">Nessun socio da mostrare.</div>';

      C.monta(
        '<div class="sezione">' +
          '<button class="btn btn-primario btn-largo" data-vai="#/socio/nuovo">' +
          '+ Aggiungi socio</button>' +
        '</div>' +
        (inattivi
          ? '<div class="sezione"><label class="interruttore">' +
            '<input type="checkbox" id="chk-inattivi"' + (mostraInattivi ? ' checked' : '') + '>' +
            '<span>Mostra anche i soci non attivi (' + inattivi + ')</span></label></div>'
          : '') +
        '<div class="sezione">' + elenco + '</div>');

      var chk = document.getElementById('chk-inattivi');
      if (chk) chk.addEventListener('change', function () {
        mostraInattivi = chk.checked;
        render();
      });
    });
  }

  App.ui.viste.soci = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
