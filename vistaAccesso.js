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
              'Questo account non \u00e8 ancora autorizzato. Puoi inviare una ' +
              'richiesta; un amministratore potr\u00e0 concederti l\u2019accesso ' +
              'in sola lettura oppure come amministratore.' +
            '</div>' +
            '<button class="btn btn-azione" id="btn-richiedi">' +
            'Richiedi accesso</button>' +
            '<div class="errore" id="err-richiesta"></div>' +
            '<button class="btn btn-contorno" id="btn-esci-accesso">' +
            'Esci e prova con un altro account</button>'
          : '<button class="btn btn-azione" id="btn-accedi">Accedi con Google</button>' +
            '<div class="errore" id="err-accesso"></div>') +

        '<p class="nota-accesso">' +
        (entratoMaFuori
          ? 'Account usato: ' + C.esc(st.utente.email) + '.'
          : 'L\u2019app \u00e8 riservata alle persone autorizzate dalla squadra.') +
        '</p>' +
      '</div>');

    var uscita = document.getElementById('btn-esci-accesso');
    if (uscita) {
      uscita.addEventListener('click', function () { A.esci(); });

      var chiedi = document.getElementById('btn-richiedi');
      if (chiedi) {
        chiedi.addEventListener('click', function () {
          chiedi.disabled = true;
          A.richiediAccesso().then(function () {
            document.getElementById('err-richiesta').textContent =
              'Richiesta inviata. Un amministratore deve autorizzarti.';
            chiedi.textContent = 'Richiesta inviata';
          }).catch(function (e) {
            chiedi.disabled = false;
            document.getElementById('err-richiesta').textContent = e.message;
          });
        });
      }
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
