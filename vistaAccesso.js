(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function render() {
    var C = App.ui.componenti;
    var A = App.core.accesso;
    var st = A.stato();

    C.intestazione({ nascosta: true });

    C.monta(
      '<div class="schermo-accesso">' +
        '<img class="logo" src="adrenalina-simbolo.png" alt="" ' +
          'width="96" height="96">' +
        '<h1 class="marchio-accesso">Adrenalina</h1>' +
        '<p class="sotto">Squadra cinghialai</p>' +

        (st.errore
          ? '<div class="avviso-box pericolo">' + C.esc(st.errore) + '</div>'
          : '') +

        '<button class="btn btn-azione" id="btn-accedi">Accedi con Google</button>' +
        '<div class="errore" id="err-accesso"></div>' +

        '<p class="nota-accesso">L\u2019accesso serve a sapere chi modifica i dati ' +
        'della squadra. I soci vedono tutto; solo gli amministratori possono ' +
        'cambiare qualcosa.</p>' +
      '</div>');

    var bottone = document.getElementById('btn-accedi');
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
