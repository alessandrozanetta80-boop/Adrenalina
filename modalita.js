(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // MODALITA' DI LAVORO
  //
  // L'app ne ha due, e deve essere sempre chiaro quale e' attiva.
  //
  //   LOCALE — Firebase non configurato. Tutto su questo dispositivo,
  //   nessuna rete, nessun login. E' il funzionamento di sempre.
  //
  //   CONDIVISA — Firebase configurato e chi ha fatto l'accesso e' fra
  //   gli amministratori. L'archivio e' quello della squadra: ogni
  //   modifica passa dalla coda e viene inviata.
  //
  // Il passaggio da una all'altra avviene solo qui. Un solo motore, un
  // solo aggancio al ritorno della rete: niente doppie inizializzazioni.

  var LOCALE = 'LOCALE';
  var CONDIVISA = 'CONDIVISA';

  var modo = LOCALE;
  var motore = null;
  var ascoltoRete = null;
  var ultimaSincronizzazione = null;

  // Una sola sincronizzazione per volta. Se ne arriva un'altra mentre la
  // prima e' in corso non si scarta: si prende nota e al termine parte
  // un altro giro. Altrimenti una modifica fatta durante un invio
  // resterebbe in coda per sempre.
  var inCorso = null;        // promessa del giro attivo
  var richiestaPendente = false;
  var riverificaInCorso = false;
  var attesePendenti = [];   // chi aspetta il prossimo giro

  function condivisa() { return modo === CONDIVISA && !!motore; }
  function corrente() { return modo; }
  function ottieniMotore() { return motore; }

  function unGiro() {
    return motore.sincronizza().then(function (r) {
      ultimaSincronizzazione = new Date().toISOString();
      return r;
    });
  }

  // Avvia un giro, oppure ne prenota uno se ce n'e' gia' uno in corso.
  // La promessa restituita si risolve quando la coda e' stata svuotata,
  // compresi i giri aggiuntivi resi necessari da modifiche arrivate nel
  // frattempo. Nessun ciclo infinito: si riparte solo se qualcuno ha
  // davvero chiesto un altro giro.
  function sincronizzaOra() {
    if (!condivisa()) return Promise.resolve({ saltata: true });

    if (inCorso) {
      richiestaPendente = true;
      return new Promise(function (risolvi) { attesePendenti.push(risolvi); });
    }

    inCorso = unGiro().then(function (r) {
      inCorso = null;
      if (richiestaPendente) {
        richiestaPendente = false;
        var inAttesa = attesePendenti;
        attesePendenti = [];
        return sincronizzaOra().then(function (r2) {
          inAttesa.forEach(function (risolvi) { risolvi(r2); });
          return r2;
        });
      }
      var restati = attesePendenti;
      attesePendenti = [];
      restati.forEach(function (risolvi) { risolvi(r); });
      return r;
    }).catch(function (e) {
      inCorso = null;
      richiestaPendente = false;
      var restati = attesePendenti;
      attesePendenti = [];
      restati.forEach(function (risolvi) { risolvi({ errore: e.message }); });
      throw e;
    });
    return inCorso;
  }

  // Chiamata dopo ogni scrittura locale andata a buon fine che ha
  // prodotto operazioni da inviare. Non blocca il salvataggio: parte per
  // conto suo, e se il remoto da errore il dato locale resta com'e'.
  function richiediSincronizzazione() {
    if (!condivisa()) return;
    // Finche' l'archivio non e' chiarito (da inizializzare, estraneo o
    // illeggibile) le modifiche restano in coda e non partono.
    if (!statoArchivio || statoArchivio.stato !== STATO.PRONTA) return;
    if (typeof global.navigator !== 'undefined' && global.navigator &&
        global.navigator.onLine === false) {
      return;   // senza rete resta in coda: partira' al ritorno
    }
    sincronizzaOra().catch(function (e) {
      if (global.console) global.console.warn('Sincronizzazione rimandata:', e.message);
    });
  }

  // Serve ai test e alla chiusura ordinata: attende che non ci sia piu'
  // nessun giro in corso ne' prenotato.
  function attendiSincronizzazione() {
    if (!inCorso) return Promise.resolve();
    return inCorso.then(function () {
      return inCorso ? attendiSincronizzazione() : undefined;
    }).catch(function () { return undefined; });
  }

  // Accende la modalita' condivisa. Chiamarla due volte non fa danni:
  // se il motore c'e' gia' non si ricrea niente.
  function attivaCondivisa(utente) {
    // Se e' gia' attiva ma per un'altra persona, non si riusa il motore:
    // conterrebbe la coda e le revisioni dell'account precedente.
    if (condivisa() && motore && motore.utente().uid !== utente.uid) {
      disattivaCondivisa();
    }
    if (condivisa()) return Promise.resolve(motore);
    if (!global.firebase || !global.firebase.firestore) {
      return Promise.reject(new Error('Database condiviso non disponibile.'));
    }

    var db = global.firebase.firestore();
    var adattatore = App.data.adattatoreFirestore.crea(db, null);
    motore = App.core.sync.crea({
      locale: App.data.repo,
      remoto: adattatore,
      utente: { uid: utente.uid, email: utente.email }
    });
    modo = CONDIVISA;

    // La via diretta serve comunque al motore e al bootstrap, anche
    // prima che la coda ordinaria venga accesa.
    if (!App.data.repo.scriviSenzaCoda) {
      App.data.repo.scriviSenzaCoda = App.data.repo.scrivi;
    }


    // Chi ha accesso in sola lettura viene bloccato SUBITO, appena si
    // sa il ruolo: non deve poter modificare niente, nemmeno il
    // database locale, e nemmeno negli stati in cui la sincronizzazione
    // non parte.
    if (App.core.accesso.lettore && App.core.accesso.lettore()) {
      App.data.scrittureCondivise.installaSolaLettura();
    }

    // PRIMA di sincronizzare qualunque cosa si guarda in che situazione
    // siamo. Scaricare senza saperlo e' esattamente il mescolamento che
    // va evitato: il download aggiunge, non sostituisce.
    return valutaStatoArchivio(adattatore).then(function (v) {
      statoArchivio = v;

      if (v.stato === STATO.ARCHIVIO_ESTRANEO ||
          v.stato === STATO.NON_LEGGIBILE ||
          v.stato === STATO.PRE_BOOTSTRAP) {
        // In tutti e tre i casi il motore resta collegato (serve per il
        // bootstrap e per la sostituzione) ma NON parte nessuna
        // sincronizzazione: niente download, niente invio.
        // Le scritture locali continuano a riempire la coda, che restera'
        // ferma finche' la situazione non e' chiarita.
        return motore;
      }

      // La coda ordinaria si accende SOLO ad archivio pronto e solo per
      // chi puo' scrivere. Prima del bootstrap, con un archivio estraneo
      // o senza poter leggere il remoto, le modifiche locali non devono
      // finire in coda: il bootstrap le pubblichera' comunque, e
      // accodarle due volte creerebbe un conflitto contro se stessi.
      // Per chi ha accesso in sola lettura si installa invece il blocco.
      if (App.core.accesso.lettore && App.core.accesso.lettore()) {
        // Chi legge soltanto scarica l'archivio come tutti: quello che
        // non puo' fare e' modificarlo. Il blocco e' gia' installato.
        if (!ascoltoRete) {
          ascoltoRete = function () { riverificaEpoiSincronizza(); };
          global.addEventListener('online', ascoltoRete);
        }
        return sincronizzaOra().then(function () {
          if (v.marker && v.marker.identificativo) {
            return marcaArchivio(v.marker.identificativo);
          }
          return undefined;
        }).then(function () { return motore; });
      }

      // Archivio pronto: si aggancia il ritorno della rete e si scarica.
      if (!ascoltoRete) {
        ascoltoRete = function () { riverificaEpoiSincronizza(); };
        global.addEventListener('online', ascoltoRete);
      }
      App.data.scrittureCondivise.installa(motore, richiediSincronizzazione);
      return sincronizzaOra().then(function () {
        // Il telefono dichiara di appartenere a questo archivio: da qui
        // in poi non risultera' piu' estraneo.
        if (v.marker && v.marker.identificativo) {
          return marcaArchivio(v.marker.identificativo);
        }
        return undefined;
      }).then(function () { return motore; });
    });
  }

  // RIENTRO IN RETE
  //
  // Non basta rimettersi a sincronizzare: nel frattempo l'accesso puo'
  // essere stato revocato. Prima di mandare qualsiasi cosa si controlla
  // di poterlo ancora fare.
  //
  // Distinzione importante: se il controllo non riesce perche' il
  // database non risponde ancora, non e' una revoca. Si rimanda, senza
  // inviare niente.
  function riverificaEpoiSincronizza() {
    if (!condivisa()) return Promise.resolve({ saltata: true });
    var A = App.core.accesso;
    var utente = A.stato().utente;
    if (!utente || !A.verificaAutorizzazione) return sincronizzaOra();

    var primaEra = A.stato().ruolo;
    return A.verificaAutorizzazione(utente).then(function (ruolo) {
      A.aggiornaRuolo(ruolo);
      if (ruolo === 'NESSUNO') {
        // Accesso revocato: si stacca tutto. La coda NON si tocca:
        // quelle modifiche restano sul telefono di chi le ha fatte.
        disattivaCondivisa();
        return { revocato: true };
      }
      if (ruolo !== primaEra) {
        // Ruolo cambiato (per esempio declassato a sola lettura):
        // si riparte dalla valutazione, che installera' i blocchi giusti.
        return rivalutaArchivio().then(function () { return { ruoloCambiato: true }; });
      }
      return sincronizzaOra();
    }).catch(function () {
      // Non si e' riusciti a verificare: si rimanda, senza inviare.
      return { rimandata: true };
    });
  }

  // Dopo un bootstrap o una sostituzione lo stato cambia: si rivaluta e,
  // se ora l'archivio e' pronto, si comincia a sincronizzare davvero.
  function rivalutaArchivio() {
    if (!condivisa()) return Promise.resolve(null);
    var adattatore = motore.adattatore();
    return valutaStatoArchivio(adattatore).then(function (v) {
      statoArchivio = v;
      if (v.stato !== STATO.PRONTA) return v;
      if (App.core.accesso.lettore && App.core.accesso.lettore()) {
        App.data.scrittureCondivise.installaSolaLettura();
        return sincronizzaOra().then(function () { return v; });
      }
      App.data.scrittureCondivise.installa(motore, richiediSincronizzazione);
      if (!ascoltoRete) {
        ascoltoRete = function () { riverificaEpoiSincronizza(); };
        global.addEventListener('online', ascoltoRete);
      }
      return sincronizzaOra().then(function () { return v; });
    });
  }

  // Torna alla modalita' locale: uscita dall'account o permessi revocati.
  function disattivaCondivisa() {
    if (ascoltoRete) {
      global.removeEventListener('online', ascoltoRete);
      ascoltoRete = null;
    }
    App.data.scrittureCondivise.disinstalla();
    motore = null;
    modo = LOCALE;
    statoArchivio = null;
  }

  // Chiamata a ogni cambio di stato dell'accesso.
  function aggiorna() {
    var A = App.core.accesso;
    if (!A || !A.attivo()) {
      if (modo === CONDIVISA) disattivaCondivisa();
      return Promise.resolve(LOCALE);
    }
    if (!A.autorizzato()) {
      // autenticato ma non in elenco, oppure ancora fuori: niente remoto
      if (modo === CONDIVISA) disattivaCondivisa();
      return Promise.resolve(LOCALE);
    }
    return attivaCondivisa(A.stato().utente)
      .then(function () { return CONDIVISA; })
      .catch(function (e) {
        if (global.console) global.console.error(e);
        disattivaCondivisa();
        return LOCALE;
      });
  }

  function stato() {
    if (!condivisa()) {
      return Promise.resolve({ modo: modo, collegato: false });
    }
    return motore.stato().then(function (s) {
      s.modo = modo;
      s.ultimaSincronizzazione = ultimaSincronizzazione;
      return s;
    });
  }

  // STATO DELL'ARCHIVIO
  //
  // Prima di sincronizzare qualsiasi cosa bisogna sapere in che
  // situazione ci si trova. Sono quattro, e vanno distinte PRIMA di
  // leggere o scrivere un solo record, altrimenti il download mescola
  // dati di provenienze diverse.
  //
  //   PRE_BOOTSTRAP        il remoto non e' ancora stato inizializzato
  //   PRONTA               remoto inizializzato e questo telefono gli
  //                        appartiene (o e' vuoto e puo' scaricarlo)
  //   ARCHIVIO_ESTRANEO    remoto inizializzato ma qui ci sono dati che
  //                        vengono da un'altra parte: si ferma tutto
  //   NON_LEGGIBILE        non si e' riusciti a interrogare il remoto:
  //                        non si tira a indovinare
  var STATO = {
    PRE_BOOTSTRAP: 'PRE_BOOTSTRAP',
    PRONTA: 'PRONTA',
    ARCHIVIO_ESTRANEO: 'ARCHIVIO_ESTRANEO',
    NON_LEGGIBILE: 'NON_LEGGIBILE'
  };
  var statoArchivio = null;

  function archivioMarcato() {
    return App.data.repo.leggiStore(['meta']).then(function (d) {
      var m = d.meta.filter(function (x) {
        return x.chiave === 'archivioCondivisoId';
      })[0];
      return m ? m.valore : null;
    });
  }

  function marcaArchivio(identificativo) {
    var f = App.data.repo.scriviSenzaCoda || App.data.repo.scrivi;
    return f.call(App.data.repo, ['meta'], function (t) {
      t.put('meta', { chiave: 'archivioCondivisoId', valore: identificativo });
    });
  }

  // Valutazione con letture STRETTE: se il remoto non risponde, lo stato
  // e' "non leggibile" e non si fa niente.
  function valutaStatoArchivio(adattatore) {
    return adattatore.leggiMarkerStrict(
      App.core.bootstrap.RACCOLTA_MARKER, App.core.bootstrap.ID_MARKER
    ).then(function (marker) {
      if (!marker || marker.stato !== 'COMPLETO') {
        return { stato: STATO.PRE_BOOTSTRAP, marker: marker || null };
      }
      return App.data.repo.leggiStore(App.data.schema.nomiStoreCondivisi)
        .then(function (locali) {
          var totale = 0;
          App.data.schema.nomiStoreCondivisi.forEach(function (n) {
            totale += locali[n].length;
          });
          if (!totale) return { stato: STATO.PRONTA, marker: marker, vuoto: true };
          return archivioMarcato().then(function (segnato) {
            if (segnato === marker.identificativo) {
              return { stato: STATO.PRONTA, marker: marker, vuoto: false };
            }
            return { stato: STATO.ARCHIVIO_ESTRANEO, marker: marker,
              marcatoCome: segnato };
          });
        });
    }).catch(function (e) {
      return { stato: STATO.NON_LEGGIBILE, errore: e.message };
    });
  }

  // DISPOSITIVO VECCHIO CON DATI PROPRI
  //
  // Caso pericoloso: un telefono che ha gia' lavorato in locale si
  // collega a un archivio condiviso gia' inizializzato. I suoi dati non
  // vengono da li', quindi non devono ne' salire ne' mescolarsi.
  // L'attivazione si ferma e serve una scelta esplicita.
  function archivioLocaleEstraneo() {
    if (!condivisa()) return Promise.resolve(false);
    var motore = ottieniMotore();
    var adattatore = motore && motore.adattatore ? motore.adattatore() : null;
    if (!adattatore || !adattatore.leggiMarker) return Promise.resolve(false);

    return adattatore.leggiMarker(
      App.core.bootstrap.RACCOLTA_MARKER, App.core.bootstrap.ID_MARKER
    ).then(function (marker) {
      if (!marker) return false;   // remoto non inizializzato: non e' questo caso
      return App.data.repo.leggiStore(['squadre', 'meta']).then(function (d) {
        if (!d.squadre.length) return false;   // niente in locale: nessun rischio
        var segnato = d.meta.filter(function (m) {
          return m.chiave === 'archivioCondivisoId';
        })[0];
        // Se il telefono non ha mai dichiarato di appartenere a questo
        // archivio, i suoi dati sono di un'altra provenienza.
        return !segnato || segnato.valore !== marker.identificativo;
      });
    }).catch(function () { return false; });
  }

  // Sostituzione controllata: si tiene un backup, si tolgono i dati
  // sincronizzati locali e si riscarica tutto dall'archivio della
  // squadra. Non si carica niente verso il remoto.
  function usaArchivioCondiviso(opzioni) {
    opzioni = opzioni || {};
    if (!condivisa()) {
      return Promise.reject(new Error('L’archivio condiviso non è attivo.'));
    }
    return App.core.backup.costruisciBackup().then(function (backup) {
      if (!backup || !backup.dati) {
        throw new Error('Impossibile creare il backup di sicurezza: operazione annullata.');
      }
      // Il backup e' una fotografia di com'e' il telefono adesso: si
      // salva anche se i dati sono gia' incoerenti, perche' serve
      // proprio a non perdere niente prima di sostituirli. La coerenza
      // si pretende dove conta, cioe' prima di pubblicare (bootstrap).
      backup.avvertenze = App.core.backup.validaBackup(backup);
      if (opzioni.suBackup) opzioni.suBackup(backup);

      // Il backup non basta costruirlo: va SALVATO sul telefono prima
      // di toccare i dati. Se il file non si riesce a scrivere, non si
      // svuota niente.
      var salva = opzioni.salvaBackup ||
        function (b) { return App.core.backup.scaricaBackup(b); };
      return Promise.resolve(salva(backup)).then(function () { return backup; });
    }).then(function (backup) {
      var store = App.data.schema.nomiStoreCondivisi;
      return App.data.repo.scriviSenzaCoda(store.concat(['outbox']), function (t) {
        store.forEach(function (n) { t.svuota(n); });
        t.svuota('outbox');    // niente di locale deve partire verso la squadra
      }).then(function () {
        var motore = ottieniMotore();
        return motore.adattatore().leggiMarkerStrict(
          App.core.bootstrap.RACCOLTA_MARKER, App.core.bootstrap.ID_MARKER);
      }).then(function (marker) {
        if (!marker || !marker.identificativo) {
          throw new Error('L’archivio condiviso non risulta inizializzato.');
        }
        // Da adesso questo telefono appartiene a quell'archivio: va
        // dichiarato PRIMA di scaricare, altrimenti alla rivalutazione
        // risulterebbe ancora estraneo e il download non partirebbe.
        return marcaArchivio(marker.identificativo);
      }).then(function () {
        // Ora lo stato e' cambiato: si rivaluta e si scarica.
        return rivalutaArchivio();
      }).then(function () { return { backup: backup }; });
    });
  }

  App.core.modalita = {
    LOCALE: LOCALE,
    CONDIVISA: CONDIVISA,
    condivisa: condivisa,
    corrente: corrente,
    motore: ottieniMotore,
    aggiorna: aggiorna,
    attivaCondivisa: attivaCondivisa,
    disattivaCondivisa: disattivaCondivisa,
    sincronizzaOra: sincronizzaOra,
    richiediSincronizzazione: richiediSincronizzazione,
    attendiSincronizzazione: attendiSincronizzazione,
    STATO: STATO,
    statoArchivio: function () { return statoArchivio; },
    valutaStatoArchivio: valutaStatoArchivio,
    rivalutaArchivio: rivalutaArchivio,
    riverificaEpoiSincronizza: riverificaEpoiSincronizza,
    // Chiamata dal motore quando il remoto nega un'operazione: puo'
    // essere una revoca, e va accertato invece che ignorarlo.
    chiediRiverifica: function () {
      if (riverificaInCorso || !condivisa()) return;
      riverificaInCorso = true;
      var A = App.core.accesso;
      var utente = A.stato().utente;
      if (!utente || !A.verificaAutorizzazione) { riverificaInCorso = false; return; }
      A.verificaAutorizzazione(utente).then(function (ruolo) {
        A.aggiornaRuolo(ruolo);
        if (ruolo === 'NESSUNO') disattivaCondivisa();
      }).catch(function () { /* non si e' potuto accertare */ })
        .then(function () { riverificaInCorso = false; });
    },
    marcaArchivio: marcaArchivio,
    archivioMarcato: archivioMarcato,
    archivioLocaleEstraneo: archivioLocaleEstraneo,
    usaArchivioCondiviso: usaArchivioCondiviso,
    stato: stato
  };
})(typeof window !== 'undefined' ? window : globalThis);
