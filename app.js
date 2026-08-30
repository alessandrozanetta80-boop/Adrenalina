(function (global) {
  'use strict';
  var App = global.App;

  // Utente corrente: in questa versione locale sempre Amministratore.
  // Nessuna autenticazione: il campo serve solo a predisporre il modello.
  App.utenteCorrente = { livelloAccessoApp: 'AMMINISTRATORE' };

  function avvia() {
    App.seed.datiDemo.inizializzaSeNecessario()
      .then(function () { App.ui.router.avvia(); })
      .catch(function (e) {
        if (global.console) global.console.error(e);
        document.getElementById('intestazione').innerHTML =
          '<div class="intestazione-riga"><p class="intestazione-titolo">Adrenalina</p></div>';
        App.ui.componenti.erroreSchermo(
          'Impossibile avviare l\u2019app: ' + e.message +
          ' — verifica di aver aperto l\u2019app tramite un server HTTP locale ' +
          'e non con un doppio clic sul file.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})(typeof window !== 'undefined' ? window : globalThis);
