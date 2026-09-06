(function (global) {
  'use strict';
  var App = global.App;

  // Utente corrente: in questa versione locale sempre Amministratore.
  // Nessuna autenticazione: il campo serve solo a predisporre il modello.
  App.utenteCorrente = { livelloAccessoApp: 'AMMINISTRATORE' };

  // ---------- controllo versione ----------
  // I file dell'app portano ?v=versione nell'indirizzo, quindi il browser
  // li riscarica appena la versione cambia. Ma index.html puo' restare in
  // cache, e finche' resta li' il browser non vede nemmeno i nuovi ?v=.
  // Qui si chiede al server quale versione e' pubblicata, saltando la
  // cache, e se e' diversa da quella caricata si propone l'aggiornamento.
  // Senza rete non succede nulla: l'app resta utilizzabile offline.
  function controllaVersione() {
    if (typeof global.fetch !== 'function') return;
    var url = 'versione.json?t=' + Date.now();
    global.fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dati) {
        if (!dati || !dati.versione) return;
        if (dati.versione === App.versione.APP_VERSION) return;
        mostraAggiornamento(dati.versione);
      })
      .catch(function () { /* offline o file assente: si continua */ });
  }

  function mostraAggiornamento(nuova) {
    if (document.getElementById('barra-aggiornamento')) return;
    var barra = document.createElement('div');
    barra.id = 'barra-aggiornamento';
    barra.className = 'barra-aggiornamento';
    barra.setAttribute('role', 'status');
    barra.innerHTML =
      '<span>Disponibile la versione ' + App.ui.componenti.esc(nuova) + '.</span>' +
      '<button type="button" id="btn-aggiorna">Aggiorna</button>';
    document.body.appendChild(barra);

    document.getElementById('btn-aggiorna').addEventListener('click', function () {
      // Si riparte da un indirizzo nuovo: cosi' anche index.html viene
      // riscaricato invece di essere ripreso dalla cache.
      var hash = global.location.hash || '#/home';
      global.location.replace('index.html?v=' + encodeURIComponent(nuova) + hash);
    });
  }

  function avvia() {
    App.seed.datiDemo.inizializzaSeNecessario()
      .then(function () {
        App.ui.router.avvia();
        controllaVersione();
      })
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

  App.controlloVersione = {
    controlla: controllaVersione,
    mostraAggiornamento: mostraAggiornamento
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})(typeof window !== 'undefined' ? window : globalThis);
