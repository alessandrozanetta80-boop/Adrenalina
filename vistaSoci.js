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
        titolo: 'Squadra',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: '#/home'
      });

      var righe = dati.righe.filter(function (r) { return mostraInattivi || r.membro.attivo; });
      var inattivi = dati.righe.filter(function (r) { return !r.membro.attivo; }).length;

      // Rubrica: nome, ruolo e stato della quota. Il resto sta nella scheda.
      var S = App.costanti.STATO_QUOTA;
      function segnoQuota(stato) {
        if (!stato) return '<span class="quota">Non iscritto</span>';
        if (stato === S.PAGATA) return '<span class="quota ok">Pagata \u2713</span>';
        if (stato === S.PARZIALE) return '<span class="quota parziale">Parziale</span>';
        if (stato === S.NON_PAGATA) return '<span class="quota attesa">Da pagare</span>';
        return '<span class="quota">' +
          C.esc(App.costanti.etichettaStatoQuota(stato)) + '</span>';
      }

      var elenco = righe.length
        ? '<div class="lista">' + righe.map(function (r) {
            var m = r.membro;
            return '<button class="voce voce-socio' + (m.attivo ? '' : ' inattivo') +
              '" data-vai="#/socio/' + C.esc(m.id) + '">' +
              '<span class="principale">' +
                '<span class="titolo">' + C.esc(C.nomeCompleto(m)) + '</span>' +
                '<span class="sotto">' +
                  C.esc(r.iscrizione ? C.etichettaRuoli(r.iscrizione.ruoliVenatori) : 'Non iscritto') +
                  (r.iscrizione && r.iscrizione.ospite ? ' · Ospite' : '') +
                  (m.attivo ? '' : ' · non attivo') +
                '</span>' +
              '</span>' +
              segnoQuota(r.statoQuota) +
              '<span class="freccia">&#8250;</span>' +
            '</button>';
          }).join('') + '</div>'
        : '<div class="vuoto">Nessun socio da mostrare.</div>';

      C.monta(
        '<div class="sezione">' +
          '<button class="btn btn-contorno" data-vai="#/socio/nuovo">' +
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
