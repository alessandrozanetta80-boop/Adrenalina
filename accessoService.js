(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // ACCESSO
  //
  // Se Firebase non e' configurato questo servizio non fa nulla: l'app
  // resta quella locale di sempre, senza login e senza rete.
  //
  // Se e' configurato, entrano SOLO le persone elencate: chiunque altro
  // si autentichi con Google resta fuori. Anche qui vale la regola di
  // sempre: questo controllo serve a non far perdere tempo a chi non e'
  // autorizzato, ma chi tiene chiusa la porta e' il database.

  // Due soli esiti: sei in elenco o non lo sei.
  var RUOLO = { AMMINISTRATORE: 'AMMINISTRATORE', NESSUNO: 'NESSUNO' };

  var statoCorrente = {
    attivo: false,       // l'accesso e' richiesto?
    pronto: false,       // Firebase ha gia' detto chi c'e'?
    utente: null,        // { uid, email, nome, foto }
    ruolo: null,
    errore: null
  };

  var ascoltatori = [];
  var auth = null;
  var db = null;

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

  // L'autorizzazione NON sta nel browser: si chiede al database se
  // esiste /amministratori/{uid}. Se il documento non c'e', o se le
  // regole rifiutano la lettura, la persona non entra.
  // Togliendo quel documento, al riavvio successivo resta fuori.
  function verificaAutorizzazione(utente) {
    if (!utente) return Promise.resolve(null);
    if (!db) return Promise.resolve(RUOLO.NESSUNO);
    return db.collection('amministratori').doc(utente.uid).get()
      .then(function (doc) {
        return doc && doc.exists ? RUOLO.AMMINISTRATORE : RUOLO.NESSUNO;
      })
      .catch(function () {
        // Le regole rifiutano: per noi equivale a non essere in elenco.
        return RUOLO.NESSUNO;
      });
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
      db = global.firebase.firestore ? global.firebase.firestore() : null;
    } catch (e) {
      statoCorrente.pronto = true;
      statoCorrente.errore = e.message;
      annuncia();
      return Promise.resolve(statoCorrente);
    }

    return new Promise(function (resolve) {
      auth.onAuthStateChanged(function (u) {
        statoCorrente.utente = daUtenteFirebase(u);
        statoCorrente.pronto = false;
        statoCorrente.errore = null;
        annuncia();
        verificaAutorizzazione(statoCorrente.utente).then(function (ruolo) {
          statoCorrente.ruolo = ruolo;
          statoCorrente.pronto = true;
          annuncia();
          resolve(statoCorrente);
        });
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

  // Chi puo' usare l'app: solo le persone in elenco.
  function autorizzato() {
    if (!attivo()) return true;   // app locale: chi la apre e' autorizzato
    return !!statoCorrente.utente &&
      statoCorrente.ruolo === RUOLO.AMMINISTRATORE;
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
    autorizzato: autorizzato,
    amministratore: amministratore,
    suCambio: suCambio,
    verificaAutorizzazione: verificaAutorizzazione,
    // solo per i test: inserisce un database finto
    _impostaDb: function (finto) { db = finto; },
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
