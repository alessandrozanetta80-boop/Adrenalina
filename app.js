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

  // Il service worker fa partire l'app anche senza campo, dopo che e'
  // stata aperta almeno una volta. Non serve a sincronizzare: quello lo
  // fa la coda. Se il browser non lo supporta, l'app funziona lo stesso.
  function registraServiceWorker() {
    if (!global.navigator || !global.navigator.serviceWorker) return;
    if (global.location && global.location.protocol === 'file:') return;
    global.navigator.serviceWorker.register('sw.js').catch(function (e) {
      if (global.console) global.console.warn('Avvio offline non disponibile:', e.message);
    });
  }

  function avvia() {
    // L'accesso si prepara per primo: se e' richiesto, il router mostra
    // la schermata di login invece dei dati.
    App.core.accesso.avvia()
      .then(function () {
        // Chi non e' autorizzato non deve vedere nessun dato, nemmeno
        // quelli locali: non si crea niente e non si legge niente.
        if (!App.core.accesso.autorizzato()) return null;

        // ORDINE DI AVVIO
        //
        // Con l'archivio condiviso, l'archivio della squadra ha la
        // precedenza: prima ci si collega e si scarica, poi si guarda
        // cosa c'e'. Creare i dati dimostrativi su un telefono nuovo
        // prima del download significherebbe mescolarli a quelli veri,
        // perche' il download aggiunge, non sostituisce.
        //
        // Se il remoto e' ancora vuoto non si inventa niente: l'archivio
        // condiviso verra' popolato dalla migrazione iniziale, non da
        // ogni telefono per conto suo.
        if (App.core.accesso.attivo()) {
          return App.core.modalita.aggiorna();
        }

        // Senza archivio condiviso vale il comportamento di sempre:
        // database vuoto, dati dimostrativi locali.
        return App.seed.datiDemo.inizializzaSeNecessario();
      })
      .then(function () {
        App.ui.router.avvia();
        registraServiceWorker();
        controllaVersione();
        // Entrare o uscire cambia cosa si puo' vedere, e anche se
        // l'archivio e' condiviso o solo di questo dispositivo.
        App.core.accesso.suCambio(function () {
          App.core.modalita.aggiorna().then(function () {
            App.ui.router.disegna();
          });
        });
        // In modalita' condivisa e' gia' stata attivata sopra, prima
        // di qualsiasi dato locale.
        if (App.core.accesso.attivo()) return undefined;
        return App.core.modalita.aggiorna();
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
