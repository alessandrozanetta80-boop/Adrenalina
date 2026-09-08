(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // INIZIALIZZAZIONE DELL'ARCHIVIO CONDIVISO
  //
  // Il primo archivio della squadra viene creato UNA VOLTA, da un
  // amministratore, con un'azione esplicita. Mai in automatico.
  //
  // Il pericolo che questo protocollo evita: un telefono pieno di dati
  // che si collega a un archivio vuoto e comincia a caricare, oppure due
  // telefoni che caricano archivi diversi e li mescolano. Da qui in poi
  // esiste una sola versione della verita', e nessuno la puo'
  // sovrascrivere per sbaglio.
  //
  // Prima di scrivere una sola riga sul remoto:
  //   1. si controlla di poterlo fare (accesso, permessi, rete);
  //   2. si controlla che il remoto sia davvero vuoto;
  //   3. si fa un backup locale completo e valido;
  //   4. si controlla che i dati locali siano coerenti;
  //   5. solo allora si carica, e alla fine si verifica il risultato.
  //
  // Se qualcosa non torna ci si ferma PRIMA di aver toccato il remoto.

  var RACCOLTA_MARKER = 'bootstrap';
  var ID_MARKER = 'iniziale';

  function ora() { return new Date().toISOString(); }

  function storeCondivisi() {
    return App.data.schema.nomiStoreCondivisi;
  }

  // ------------------------------------------------------- precondizioni
  // Restituisce { puoProcedere, motivi[], remotoVuoto, gia Inizializzato }
  function analizza() {
    // Inizializzare l'archivio e' un'operazione da amministratore:
    // chi ha la sola lettura non deve nemmeno poterla valutare.
    if (App.core.accesso.attivo() && !App.core.accesso.amministratore()) {
      return Promise.resolve({
        puoProcedere: false,
        motivi: ['Solo un amministratore può inizializzare l’archivio condiviso.'],
        remotoVuoto: null
      });
    }
    var esito = {
      puoProcedere: false,
      motivi: [],
      remotoVuoto: null,
      giaInizializzato: null,
      conteggiLocali: null,
      conteggiRemoti: null
    };

    if (!App.core.accesso.attivo()) {
      esito.motivi.push('Firebase non è configurato su questo dispositivo.');
      return Promise.resolve(esito);
    }
    if (!App.core.accesso.autorizzato()) {
      esito.motivi.push('Serve un amministratore autorizzato.');
      return Promise.resolve(esito);
    }
    if (!App.core.modalita.condivisa()) {
      esito.motivi.push('L’archivio condiviso non è attivo.');
      return Promise.resolve(esito);
    }
    if (typeof global.navigator !== 'undefined' && global.navigator &&
        global.navigator.onLine === false) {
      esito.motivi.push('Serve il collegamento a internet.');
      return Promise.resolve(esito);
    }

    var motore = App.core.modalita.motore();
    var adattatore = motore && motore.adattatore ? motore.adattatore() : null;
    if (!adattatore) {
      esito.motivi.push('Collegamento all’archivio condiviso non disponibile.');
      return Promise.resolve(esito);
    }

    return App.data.repo.leggiStore(storeCondivisi()).then(function (locali) {
      esito.conteggiLocali = {};
      var totaleLocale = 0;
      storeCondivisi().forEach(function (n) {
        esito.conteggiLocali[n] = locali[n].length;
        totaleLocale += locali[n].length;
      });
      esito.totaleLocale = totaleLocale;
      if (!totaleLocale) {
        esito.motivi.push('Questo dispositivo non ha dati da caricare.');
      }

      // Letture STRETTE: un permesso negato, un timeout o una rete
      // assente non devono mai essere scambiati per "archivio vuoto".
      // Se non si riesce a leggere, non si procede.
      return adattatore.contaCondiviseStrict()
        .then(function (conteggio) {
          esito.conteggiRemoti = conteggio.perStore;
          esito.remotoVuoto = conteggio.totale === 0;
          return adattatore.leggiMarkerStrict(RACCOLTA_MARKER, ID_MARKER);
        })
        .then(function (marker) {
          esito.marker = marker || null;
          esito.giaInizializzato = !!(marker && marker.stato === 'COMPLETO');
          var utente = App.core.accesso.stato().utente;
          esito.ripresa = !!(marker && marker.stato === 'IN_CORSO' &&
            marker.amministratore === utente.uid);

          if (esito.giaInizializzato) {
            esito.motivi.push('L’archivio condiviso è già stato inizializzato.');
          } else if (marker && marker.stato === 'IN_CORSO' && !esito.ripresa) {
            esito.motivi.push('Inizializzazione già in corso da parte di un altro ' +
              'amministratore.');
          } else if (!esito.remotoVuoto && !esito.ripresa) {
            // dati senza marker: qualcosa e' finito li' fuori protocollo
            esito.motivi.push('L’archivio condiviso contiene già dati. ' +
              'L’inizializzazione non può essere eseguita.');
          }

          esito.puoProcedere = esito.motivi.length === 0;
          return esito;
        });
    }).catch(function (e) {
      // Non si finge che l'archivio sia vuoto: non lo sappiamo.
      esito.remotoVuoto = null;
      esito.erroreLettura = e.message;
      esito.puoProcedere = false;
      esito.motivi.push('Impossibile leggere l’archivio condiviso: ' + e.message +
        '. Finché non si riesce a leggerlo, l’inizializzazione non parte.');
      return esito;
    });
  }

  // --------------------------------------------- normalizzazione degli ID
  //
  // Alcuni record devono avere un identificativo calcolato dai dati
  // (una presenza per giornata e socio, un lotto per giornata...).
  // Un archivio nato in locale ha invece identificativi casuali.
  //
  // Prima di pubblicare si sistemano tutti insieme, in una sola
  // transazione: si calcolano i nuovi identificativi e si aggiornano i
  // riferimenti di chi li cita. Farlo record per record non basterebbe,
  // perche' una quota dipende dall'identificativo del suo lotto, che a
  // sua volta sta cambiando.
  function normalizzaArchivioLocale() {
    var store = storeCondivisi();
    return App.data.repo.leggiStore(store).then(function (dati) {
      var rinominati = {};
      var cambiato = true;
      var giri = 0;

      // Si ripete finche' nessun identificativo cambia piu': serve
      // perche' le quote si calcolano sul lotto gia' rinominato.
      while (cambiato && giri < 5) {
        cambiato = false;
        giri++;
        store.forEach(function (n) {
          if (!App.core.idDeterministici.deterministico(n)) return;
          dati[n].forEach(function (r) {
            // prima si seguono i riferimenti gia' rinominati
            Object.keys(r).forEach(function (campo) {
              var v = r[campo];
              if (typeof v === 'string' && rinominati[v] && campo !== 'id') {
                r[campo] = rinominati[v];
                cambiato = true;
              }
            });
            var nuovo = App.core.idDeterministici.calcola(n, r);
            if (nuovo && r.id !== nuovo) {
              rinominati[r.id] = nuovo;
              r.id = nuovo;
              cambiato = true;
            }
          });
        });
        // e i riferimenti negli store non deterministici
        store.forEach(function (n) {
          if (App.core.idDeterministici.deterministico(n)) return;
          dati[n].forEach(function (r) {
            Object.keys(r).forEach(function (campo) {
              var v = r[campo];
              if (typeof v === 'string' && rinominati[v] && campo !== 'id') {
                r[campo] = rinominati[v];
                cambiato = true;
              }
            });
          });
        });
      }

      var quanti = Object.keys(rinominati).length;
      if (!quanti) return { rinominati: 0 };

      var f = App.data.repo.scriviSenzaCoda || App.data.repo.scrivi;
      return f.call(App.data.repo, store, function (t) {
        store.forEach(function (n) {
          t.svuota(n);
          dati[n].forEach(function (r) { t.put(n, r); });
        });
      }).then(function () { return { rinominati: quanti }; });
    });
  }

  // ------------------------------------------------------- confronto
  // Campi aggiunti dalla sincronizzazione: non fanno parte del dato
  // applicativo e non vanno confrontati.
  var CAMPI_TECNICI = ['revision', 'modificatoDa', 'modificatoIl'];

  function canonico(record) {
    var pulito = {};
    Object.keys(record).sort().forEach(function (k) {
      if (CAMPI_TECNICI.indexOf(k) !== -1) return;
      pulito[k] = record[k];
    });
    return JSON.stringify(pulito);
  }

  // Confronta l'archivio locale con quello appena caricato: numero,
  // identificativi e contenuto. Restituisce le differenze trovate.
  function confronta(locali, remoti) {
    var differenze = [];
    storeCondivisi().forEach(function (n) {
      var qui = locali[n] || [];
      var la = remoti[n] || [];
      if (qui.length !== la.length) {
        differenze.push(n + ': ' + la.length + ' record invece di ' + qui.length + '.');
        return;
      }
      var perId = {};
      la.forEach(function (r) { perId[r.id] = r; });
      qui.forEach(function (r) {
        var altro = perId[r.id];
        if (!altro) {
          differenze.push(n + ': manca il record ' + r.id + '.');
          return;
        }
        delete perId[r.id];
        if (canonico(r) !== canonico(altro)) {
          differenze.push(n + ': il record ' + r.id + ' è diverso da quello caricato.');
        }
      });
      Object.keys(perId).forEach(function (id) {
        differenze.push(n + ': record inatteso ' + id + '.');
      });
    });
    return differenze;
  }

  // --------------------------------------------------- validazione locale
  // Prima di pubblicare, i dati devono reggere le stesse verifiche che
  // usiamo per i backup: riferimenti, identificativi, codici, orfani.
  function validaLocale() {
    return App.core.backup.costruisciBackup().then(function (backup) {
      var errori = App.core.backup.validaBackup(backup);
      return { backup: backup, errori: errori };
    });
  }

  // --------------------------------------------------- contatori dei capi
  // Il contatore remoto non puo' partire da uno se in archivio ci sono
  // gia' dei capi: il primo nuovo capo prenderebbe un codice usato.
  // Si parte dal massimo esistente, stagione per stagione.
  function contatoriDaDati(abbattimenti) {
    var perStagione = {};
    (abbattimenti || []).forEach(function (a) {
      var n = App.core.capo.numeroDaCodice
        ? App.core.capo.numeroDaCodice(a.codiceCapo)
        : Number(String(a.codiceCapo || '').replace(/[^0-9]/g, ''));
      if (!n || isNaN(n)) return;
      if (!perStagione[a.stagioneId] || perStagione[a.stagioneId] < n) {
        perStagione[a.stagioneId] = n;
      }
    });
    return perStagione;
  }

  // ------------------------------------------------------------ esecuzione
  // ESECUZIONE DEL BOOTSTRAP
  //
  // Protocollo a stati, non un'unica operazione che o riesce o lascia
  // macerie:
  //
  //   1. controlli e validazione locale, con letture STRETTE
  //   2. backup preventivo SALVATO SUL TELEFONO (non solo in memoria)
  //   3. acquisizione: si scrive subito il marker IN_CORSO, in
  //      transazione. Da qui nessun altro amministratore puo' iniziare.
  //   4. contatori, in modo idempotente
  //   5. caricamento dei dati attraverso la coda
  //   6. verifica: locale e remoto devono coincidere
  //   7. chiusura: IN_CORSO -> COMPLETO
  //
  // Se qualcosa si rompe fra il 3 e il 7, il marker resta IN_CORSO e la
  // stessa persona puo' riprendere: le operazioni gia' applicate non si
  // duplicano perche' portano lo stesso operationId.
  function esegui(opzioni) {
    opzioni = opzioni || {};
    var passi = [];
    function passo(nome, dettaglio) {
      passi.push({ nome: nome, dettaglio: dettaglio || '', quando: ora() });
    }

    var motore = App.core.modalita.motore();
    if (!motore) {
      return Promise.reject(new Error('Archivio condiviso non attivo.'));
    }
    var adattatore = motore.adattatore();
    var utente = App.core.accesso.stato().utente;

    return analizza().then(function (a) {
      if (!a.puoProcedere) {
        var e = new Error(a.motivi.join(' '));
        e.motivi = a.motivi;
        e.analisi = a;
        throw e;
      }
      passo('controlli', a.ripresa
        ? 'inizializzazione interrotta da riprendere'
        : 'archivio condiviso vuoto e non ancora inizializzato');

      // Il backup e' dell'archivio COM'E' ADESSO, prima di toccarlo.
      // La normalizzazione degli identificativi riscrive IndexedDB:
      // se avvenisse prima, il backup non fotograferebbe piu' quello
      // che c'era. E se il file non si riesce a salvare, non si tocca
      // niente, ne' in locale ne' sul remoto.
      var salva = opzioni.salvaBackup ||
        function (b) { return App.core.backup.scaricaBackup(b); };

      return App.core.backup.costruisciBackup().then(function (originale) {
        if (!originale || !originale.dati) {
          throw new Error('Impossibile creare il backup preventivo: ' +
            'l\u2019inizializzazione non parte.');
        }
        return Promise.resolve(salva(originale)).then(function () {
          passo('backup', 'backup dell\u2019archivio originale salvato');
          if (opzioni.suBackup) opzioni.suBackup(originale);
          return normalizzaArchivioLocale();
        });
      }).then(function (norm) {
        if (norm.rinominati) {
          passo('identificativi', norm.rinominati +
            ' identificativi resi calcolabili dai dati');
        }
        return validaLocale();
      }).then(function (v) {
        if (v.errori.length) {
          var e = new Error('I dati di questo dispositivo non sono coerenti: ' +
            v.errori.slice(0, 3).join(' '));
          e.errori = v.errori;
          throw e;
        }
        passo('validazione', 'dati locali coerenti');
        var backup = v.backup;

        return Promise.resolve().then(function () {

          // --- acquisizione: da qui l'archivio e' "prenotato" ---
          return adattatore.acquisisciBootstrap(RACCOLTA_MARKER, ID_MARKER, {
            identificativo: App.core.id.uuid(),
            versioneApp: App.versione.APP_VERSION,
            versioneSchema: App.versione.SCHEMA_VERSION
          }, utente);
        }).then(function (acq) {
          passo('acquisizione', acq.ripresa
            ? 'ripresa dell\u2019inizializzazione precedente'
            : 'inizializzazione acquisita');

          // --- contatori, idempotenti ---
          var contatori = contatoriDaDati(backup.dati.abbattimenti);
          var catena = Promise.resolve();
          Object.keys(contatori).forEach(function (idStagione) {
            catena = catena.then(function () {
              return adattatore.impostaContatoreIdempotente(idStagione,
                contatori[idStagione], utente);
            });
          });

          // --- dati, attraverso la coda ---
          var conteggi = {};
          catena = catena.then(function () {
            passo('contatori', Object.keys(contatori).length +
              ' contatore/i inizializzato/i');
            var accodamenti = Promise.resolve();
            storeCondivisi().forEach(function (n) {
              var record = backup.dati[n] || [];
              conteggi[n] = record.length;
              record.forEach(function (r) {
                accodamenti = accodamenti.then(function () {
                  return motore.accoda({
                    tipo: 'put', store: n, dati: r,
                    // Identificativo stabile dell'operazione: se il
                    // caricamento si interrompe e si riprende, la stessa
                    // riga non viene applicata due volte.
                    operationId: 'boot_' + acq.marker.identificativo + '_' + n +
                      '_' + (r.id || ''),
                    expectedRevision: null
                  });
                });
              });
            });
            return accodamenti;
          });

          catena = catena.then(function () {
            return App.core.modalita.sincronizzaOra();
          }).then(function (r) {
            var invio = r && r.invio ? r.invio : {};
            if (invio.conflitti || invio.negate) {
              throw new Error('Caricamento interrotto: ' +
                (invio.conflitti || 0) + ' conflitti, ' +
                (invio.negate || 0) + ' operazioni negate. ' +
                'L\u2019inizializzazione resta in corso e si può riprendere.');
            }
            passo('caricamento',
              ((invio.inviate || 0) + (invio.duplicate || 0)) + ' record caricati');
            return App.core.modalita.attendiSincronizzazione();
          });

          // --- verifica con lettura STRETTA ---
          catena = catena.then(function () {
            return adattatore.leggiTuttoStrict();
          }).then(function (remoti) {
            // Contare i record non basta: 21 di qua e 21 di la' possono
            // essere 21 record diversi. Si confrontano identificativi e
            // contenuto, ignorando solo i campi che aggiunge la
            // sincronizzazione.
            var differenze = confronta(backup.dati, remoti);
            if (differenze.length) {
              throw new Error('Verifica fallita dopo il caricamento: ' +
                differenze.slice(0, 3).join(' ') +
                ' L\u2019inizializzazione resta in corso e si può riprendere.');
            }
            passo('verifica', 'identificativi e contenuti coincidono');

            return adattatore.completaBootstrap(RACCOLTA_MARKER, ID_MARKER,
              conteggi, utente);
          }).then(function (marker) {
            passo('completamento', 'archivio dichiarato inizializzato');
            // Questo telefono appartiene ora a quell'archivio.
            return App.core.modalita.marcaArchivio(marker.identificativo)
              .then(function () {
                // Da adesso l'archivio e' pronto: la sincronizzazione
                // ordinaria puo' partire.
                return App.core.modalita.rivalutaArchivio();
              })
              .then(function () {
                return { passi: passi, conteggi: conteggi, marker: marker };
              });
          });

          return catena;
        });
      });
    });
  }

  App.core.bootstrap = {
    RACCOLTA_MARKER: RACCOLTA_MARKER,
    ID_MARKER: ID_MARKER,
    analizza: analizza,
    validaLocale: validaLocale,
    contatoriDaDati: contatoriDaDati,
    normalizzaArchivioLocale: normalizzaArchivioLocale,
    confronta: confronta,
    esegui: esegui
  };
})(typeof window !== 'undefined' ? window : globalThis);
