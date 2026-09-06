(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // ACCESSO
  //
  // Se Firebase non e' configurato questo servizio non fa nulla: l'app
  // resta quella locale di sempre, senza login e senza rete.
  //
  // Se e' configurato, l'app chiede l'accesso con Google prima di mostrare
  // qualsiasi schermata. Il ruolo (amministratore o socio) decide solo cosa
  // si vede: chi puo' davvero scrivere lo stabiliscono le regole del
  // database, non il browser.

  var RUOLO = { AMMINISTRATORE: 'AMMINISTRATORE', SOCIO: 'SOCIO' };

  var statoCorrente = {
    attivo: false,       // l'accesso e' richiesto?
    pronto: false,       // Firebase ha gia' detto chi c'e'?
    utente: null,        // { uid, email, nome, foto }
    ruolo: null,
    errore: null
  };

  var ascoltatori = [];
  var auth = null;

  function attivo() {
    return !!(App.configFirebase && App.configFirebase.configurato());
  }

  function stato() { return statoCorrente; }

  function suCambio(fn) {
    ascoltatori.push(fn);
    return function () {
      var i = ascoltatori.indexOf(fn);
      if (i !== -1) ascoltatori.splice(i, 1);
    };
  }

  function annuncia() {
    ascoltatori.slice().forEach(function (fn) {
      try { fn(statoCorrente); } catch (e) {
        if (global.console) global.console.error(e);
      }
    });
  }

  function daUtenteFirebase(u) {
    if (!u) return null;
    return {
      uid: u.uid,
      email: u.email || '',
      nome: u.displayName || u.email || '',
      foto: u.photoURL || null
    };
  }

  function calcolaRuolo(utente) {
    if (!utente) return null;
    return App.configFirebase.eAmministratore(utente.email)
      ? RUOLO.AMMINISTRATORE : RUOLO.SOCIO;
  }

  // Avvio: se non configurato si esce subito dichiarando l'accesso spento.
  function avvia() {
    if (!attivo()) {
      statoCorrente.attivo = false;
      statoCorrente.pronto = true;
      annuncia();
      return Promise.resolve(statoCorrente);
    }
    if (!global.firebase || !global.firebase.initializeApp) {
      statoCorrente.attivo = true;
      statoCorrente.pronto = true;
      statoCorrente.errore = 'Libreria di accesso non caricata.';
      annuncia();
      return Promise.resolve(statoCorrente);
    }

    statoCorrente.attivo = true;
    try {
      if (!global.firebase.apps || !global.firebase.apps.length) {
        global.firebase.initializeApp(App.configFirebase.CONFIG);
      }
      auth = global.firebase.auth();
    } catch (e) {
      statoCorrente.pronto = true;
      statoCorrente.errore = e.message;
      annuncia();
      return Promise.resolve(statoCorrente);
    }

    return new Promise(function (resolve) {
      auth.onAuthStateChanged(function (u) {
        statoCorrente.utente = daUtenteFirebase(u);
        statoCorrente.ruolo = calcolaRuolo(statoCorrente.utente);
        statoCorrente.pronto = true;
        statoCorrente.errore = null;
        annuncia();
        resolve(statoCorrente);
      }, function (e) {
        statoCorrente.pronto = true;
        statoCorrente.errore = e.message;
        annuncia();
        resolve(statoCorrente);
      });
    });
  }

  function accedi() {
    if (!attivo()) return Promise.reject(new Error('Accesso non configurato.'));
    if (!auth) return Promise.reject(new Error('Accesso non disponibile.'));
    var provider = new global.firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider).catch(function (e) {
      // Su alcuni browser di telefono la finestra viene bloccata:
      // si ripiega sul reindirizzamento, che funziona sempre.
      if (e && (e.code === 'auth/popup-blocked' ||
                e.code === 'auth/operation-not-supported-in-this-environment')) {
        return auth.signInWithRedirect(provider);
      }
      throw e;
    });
  }

  function esci() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  }

  function autenticato() {
    return !attivo() || !!statoCorrente.utente;
  }

  function amministratore() {
    if (!attivo()) return true;   // app locale: chi la apre e' l'amministratore
    return statoCorrente.ruolo === RUOLO.AMMINISTRATORE;
  }

  App.core.accesso = {
    RUOLO: RUOLO,
    attivo: attivo,
    stato: stato,
    avvia: avvia,
    accedi: accedi,
    esci: esci,
    autenticato: autenticato,
    amministratore: amministratore,
    suCambio: suCambio,
    // solo per i test: rimette lo stato come all'avvio
    _reimposta: function (nuovo) {
      statoCorrente = {
        attivo: false, pronto: false, utente: null, ruolo: null, errore: null
      };
      if (nuovo) {
        Object.keys(nuovo).forEach(function (k) { statoCorrente[k] = nuovo[k]; });
      }
      annuncia();
      return statoCorrente;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
