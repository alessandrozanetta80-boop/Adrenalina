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
  // Tre livelli: chi amministra, chi guarda soltanto, chi non entra.
  var RUOLO = {
    AMMINISTRATORE: 'AMMINISTRATORE',
    LETTORE: 'LETTORE',
    NESSUNO: 'NESSUNO'
  };
  var RACCOLTA_ACCESSI = 'accessi';
  var RACCOLTA_RICHIESTE = 'richiesteAccesso';

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

  // Gancio usato solo dai banchi di prova: permette di far partire l'app
  // come se Firebase fosse gia' configurato e l'accesso gia' fatto,
  // senza collegarsi davvero a Google.
  function prova() {
    return typeof global.__adrenalinaProva === 'object' && global.__adrenalinaProva
      ? global.__adrenalinaProva : null;
  }

  function attivo() {
    if (prova()) return true;
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
  // esiste /accessi/{uid}. Se il documento non c'e', o se le
  // regole rifiutano la lettura, la persona non entra.
  // Togliendo quel documento, al riavvio successivo resta fuori.
  // Ruolo memorizzato dall'ultima verifica riuscita, per questo UID.
  // Serve all'avvio senza rete: un amministratore gia' autorizzato non
  // deve trovarsi fuori solo perche' il telefono non ha campo.
  function ruoloMemorizzato(uid) {
    return App.data.repo.leggiStore(['meta']).then(function (d) {
      var m = d.meta.filter(function (x) { return x.chiave === 'ruoloVerificato'; })[0];
      if (!m || !m.valore || m.valore.uid !== uid) return null;
      return m.valore;
    }).catch(function () { return null; });
  }

  function memorizzaRuolo(uid, ruolo) {
    var f = App.data.repo.scriviSenzaCoda || App.data.repo.scrivi;
    return f.call(App.data.repo, ['meta'], function (t) {
      t.put('meta', { chiave: 'ruoloVerificato', valore: {
        uid: uid, ruolo: ruolo, quando: new Date().toISOString()
      } });
    }).catch(function () { return null; });
  }

  // L'autorizzazione la dice il database: esiste /accessi/{uid}?
  // Distinzione essenziale: "documento assente" e "database irraggiungibile"
  // non sono la stessa cosa. Nel secondo caso si usa l'ultimo ruolo
  // verificato, se e' dello stesso account.
  function verificaAutorizzazione(utente) {
    if (!utente) return Promise.resolve(null);
    if (!db) {
      return ruoloMemorizzato(utente.uid).then(function (m) {
        return m ? m.ruolo : RUOLO.NESSUNO;
      });
    }
    return db.collection(RACCOLTA_ACCESSI).doc(utente.uid).get()
      .then(function (doc) {
        var ruolo = RUOLO.NESSUNO;
        if (doc && doc.exists) {
          var r = doc.data().ruolo;
          ruolo = (r === RUOLO.AMMINISTRATORE || r === RUOLO.LETTORE)
            ? r : RUOLO.NESSUNO;
        }
        // verifica riuscita: si aggiorna la memoria, anche per una revoca
        return memorizzaRuolo(utente.uid, ruolo).then(function () { return ruolo; });
      })
      .catch(function (e) {
        // Permesso negato = risposta del server: non si e' autorizzati.
        var codice = String((e && (e.code || e.message)) || '');
        if (codice.indexOf('permission-denied') !== -1) {
          return memorizzaRuolo(utente.uid, RUOLO.NESSUNO).then(function () {
            return RUOLO.NESSUNO;
          });
        }
        // Rete assente o timeout: non si sa. Vale l'ultimo ruolo noto.
        return ruoloMemorizzato(utente.uid).then(function (m) {
          if (m) {
            statoCorrente.ruoloDaMemoria = true;
            return m.ruolo;
          }
          return RUOLO.NESSUNO;
        });
      });
  }

  // Avvio: se non configurato si esce subito dichiarando l'accesso spento.
  function avvia() {
    var p = prova();
    if (p) {
      statoCorrente.attivo = true;
      statoCorrente.utente = { uid: p.uid, email: p.email, nome: p.email, foto: null };
      statoCorrente.ruolo = p.ruolo || RUOLO.AMMINISTRATORE;
      statoCorrente.pronto = true;
      if (!global.firebase) global.firebase = {};
      global.firebase.firestore = p.firestore;
      try { db = p.firestore(); } catch (e) { db = null; }
      // Nel banco di prova la voce di accesso deve esistere davvero,
      // come nella realta': altrimenti si proverebbe un'app in cui il
      // ruolo arriva da un posto diverso da quello vero.
      if (db && p.ruolo !== 'NESSUNO') {
        try {
          var scritta = db.collection(RACCOLTA_ACCESSI).doc(p.uid).set({
            uid: p.uid, email: p.email,
            ruolo: p.ruolo || RUOLO.AMMINISTRATORE,
            creatoDa: p.uid, creatoIl: new Date(),
            modificatoDa: p.uid, modificatoIl: new Date()
          });
          if (scritta && scritta.catch) scritta.catch(function () {});
        } catch (e) { /* il simulatore puo' rifiutare: non e' un problema */ }
      }
      annuncia();
      return Promise.resolve(statoCorrente);
    }
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
      (statoCorrente.ruolo === RUOLO.AMMINISTRATORE ||
       statoCorrente.ruolo === RUOLO.LETTORE);
  }

  function lettore() {
    if (!attivo()) return false;
    return statoCorrente.ruolo === RUOLO.LETTORE;
  }

  function amministratore() {
    if (!attivo()) return true;   // app locale: chi la apre e' l'amministratore
    return statoCorrente.ruolo === RUOLO.AMMINISTRATORE;
  }

  // --------------------------------------------------- richiesta accesso
  // Chi si autentica ma non e' in elenco non vede niente della squadra.
  // Puo' pero' bussare: scrive la propria richiesta, che un
  // amministratore vedra' nella gestione accessi. La richiesta da sola
  // non concede niente.
  function richiediAccesso() {
    var u = stato().utente;
    if (!db || !u) {
      return Promise.reject(new Error('Serve il collegamento per inviare la richiesta.'));
    }
    var quando = (global.firebase && global.firebase.firestore &&
      global.firebase.firestore.FieldValue &&
      global.firebase.firestore.FieldValue.serverTimestamp)
      ? global.firebase.firestore.FieldValue.serverTimestamp()
      : new Date();
    return db.collection(RACCOLTA_RICHIESTE).doc(u.uid).set({
      uid: u.uid, email: u.email, nome: u.nome || '', quando: quando
    });
  }

  // Elenco delle richieste in attesa e degli accessi gia' dati.
  // Solo un amministratore riesce a leggerli: le regole lo impongono.
  function elencoRichieste() {
    if (!db) return Promise.resolve([]);
    return db.collection(RACCOLTA_RICHIESTE).get().then(function (snap) {
      var out = [];
      snap.forEach(function (d) { out.push(d.data()); });
      return out;
    });
  }

  function elencoAccessi() {
    if (!db) return Promise.resolve([]);
    return db.collection(RACCOLTA_ACCESSI).get().then(function (snap) {
      var out = [];
      snap.forEach(function (d) { out.push(d.data()); });
      return out;
    });
  }

  function quandoServer() {
    var F = global.firebase && global.firebase.firestore &&
      global.firebase.firestore.FieldValue;
    return F && F.serverTimestamp ? F.serverTimestamp() : new Date();
  }

  // Dare o cambiare un accesso. Non si tocca il proprio: chi amministra
  // non puo' promuoversi ne' togliersi da solo, cosi' non si resta
  // senza nessuno che possa gestire gli altri.
  function impostaAccesso(uid, email, ruolo) {
    if (!db) return Promise.reject(new Error('Serve il collegamento.'));
    var io = stato().utente;
    if (!io || uid === io.uid) {
      return Promise.reject(new Error('Non puoi modificare il tuo stesso accesso.'));
    }
    if (ruolo !== RUOLO.AMMINISTRATORE && ruolo !== RUOLO.LETTORE) {
      return Promise.reject(new Error('Ruolo non valido.'));
    }
    var rif = db.collection(RACCOLTA_ACCESSI).doc(uid);
    return rif.get().then(function (doc) {
      var esiste = doc && doc.exists;
      var dati = {
        uid: uid,
        email: email || (esiste ? doc.data().email : ''),
        ruolo: ruolo,
        creatoDa: esiste ? doc.data().creatoDa : io.uid,
        creatoIl: esiste ? doc.data().creatoIl : quandoServer(),
        modificatoDa: io.uid,
        modificatoIl: quandoServer()
      };
      return rif.set(dati);
    }).then(function () {
      // la richiesta, se c'era, e' stata evasa
      return db.collection(RACCOLTA_RICHIESTE).doc(uid).delete().catch(function () {});
    });
  }

  function revocaAccesso(uid) {
    if (!db) return Promise.reject(new Error('Serve il collegamento.'));
    var chi = stato().utente;
    if (!chi || uid === chi.uid) {
      return Promise.reject(new Error('Non puoi revocare il tuo stesso accesso.'));
    }
    return db.collection(RACCOLTA_ACCESSI).doc(uid).delete();
  }

  function rifiutaRichiesta(uid) {
    if (!db) return Promise.reject(new Error('Serve il collegamento.'));
    return db.collection(RACCOLTA_RICHIESTE).doc(uid).delete();
  }

  // Aggiorna il ruolo dopo una riverifica e avvisa chi ascolta, cosi'
  // l'interfaccia si adegua senza che nessuno debba ricordarsene.
  function aggiornaRuolo(ruolo) {
    if (statoCorrente.ruolo === ruolo) return statoCorrente;
    statoCorrente.ruolo = ruolo;
    annuncia();
    return statoCorrente;
  }

  App.core.accesso = {
    aggiornaRuolo: aggiornaRuolo,
    richiediAccesso: richiediAccesso,
    elencoRichieste: elencoRichieste,
    elencoAccessi: elencoAccessi,
    impostaAccesso: impostaAccesso,
    revocaAccesso: revocaAccesso,
    rifiutaRichiesta: rifiutaRichiesta,
    RUOLO: RUOLO,
    attivo: attivo,
    stato: stato,
    avvia: avvia,
    accedi: accedi,
    esci: esci,
    autenticato: autenticato,
    autorizzato: autorizzato,
    lettore: lettore,
    RACCOLTA_ACCESSI: RACCOLTA_ACCESSI,
    RACCOLTA_RICHIESTE: RACCOLTA_RICHIESTE,
    ruoloMemorizzato: ruoloMemorizzato,
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
