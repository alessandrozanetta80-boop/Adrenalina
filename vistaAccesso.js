(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function render() {
    var C = App.ui.componenti;
    var A = App.core.accesso;
    var st = A.stato();

    C.intestazione({ nascosta: true });

    // Tre situazioni: non ancora entrato, entrato ma non in elenco,
    // oppure errore di configurazione.
    var entratoMaFuori = !!st.utente && !A.autorizzato();

    C.monta(
      '<div class="schermo-accesso">' +
        '<img class="logo" src="adrenalina-simbolo.png" alt="" ' +
          'width="96" height="96">' +
        '<h1 class="marchio-accesso">Adrenalina</h1>' +
        '<p class="sotto">Squadra cinghialai</p>' +

        (st.errore
          ? '<div class="avviso-box pericolo">' + C.esc(st.errore) + '</div>'
          : '') +

        (entratoMaFuori
          ? '<div class="avviso-box pericolo blocco-accesso">' +
              '<strong>Accesso non consentito</strong><br>' +
              'L\u2019account ' + C.esc(st.utente.email) + ' non \u00e8 abilitato. ' +
              'L\u2019app \u00e8 riservata agli amministratori della squadra.' +
            '</div>' +
            '<button class="btn btn-contorno" id="btn-esci-accesso">' +
            'Esci e prova con un altro account</button>'
          : '<button class="btn btn-azione" id="btn-accedi">Accedi con Google</button>' +
            '<div class="errore" id="err-accesso"></div>') +

        '<p class="nota-accesso">' +
        (entratoMaFuori
          ? 'Se pensi che sia un errore, chiedi a un amministratore di ' +
            'aggiungere il tuo account.'
          : 'L\u2019app \u00e8 riservata agli amministratori della squadra. ' +
            'Gli altri account non possono entrare.') +
        '</p>' +
      '</div>');

    var uscita = document.getElementById('btn-esci-accesso');
    if (uscita) {
      uscita.addEventListener('click', function () { A.esci(); });
      return;
    }

    var bottone = document.getElementById('btn-accedi');
    if (!bottone) return;
    var inCorso = false;
    bottone.addEventListener('click', function () {
      if (inCorso) return;
      inCorso = true;
      bottone.disabled = true;
      bottone.setAttribute('aria-busy', 'true');
      document.getElementById('err-accesso').textContent = '';

      A.accedi().catch(function (e) {
        inCorso = false;
        bottone.disabled = false;
        bottone.setAttribute('aria-busy', 'false');
        var messaggio = e && e.code === 'auth/popup-closed-by-user'
          ? 'Accesso annullato.'
          : (e.message || 'Accesso non riuscito.');
        document.getElementById('err-accesso').textContent = messaggio;
      });
    });
  }

  App.ui.viste.accesso = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
