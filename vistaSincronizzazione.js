(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function online() {
    return typeof global.navigator === 'undefined' || !global.navigator ||
      global.navigator.onLine !== false;
  }

  function quando(iso) {
    if (!iso) return 'mai';
    var C = App.ui.componenti;
    var d = new Date(iso);
    return C.formattaData(App.core.calendario.oggi(d)) + ' alle ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  // Nome leggibile di un record, quando si riesce a ricostruirlo.
  function descrivi(voce, indice) {
    var C = App.ui.componenti;
    var r = indice[voce.store + '__' + voce.recordId] || voce.dati;
    var etichetta = App.costanti.etichettaStore
      ? App.costanti.etichettaStore(voce.store) : voce.store;
    if (!r) return etichetta;
    if (voce.store === 'abbattimenti' && r.codiceCapo) {
      return etichetta + ' ' + C.esc(r.codiceCapo);
    }
    if (voce.store === 'membri') return etichetta + ' ' + C.esc(C.nomeCompleto(r));
    if (voce.store === 'giornate' && r.data) {
      return etichetta + ' del ' + C.esc(C.formattaData(r.data));
    }
    if (voce.store === 'venditeCarne' && r.pesoGrammi) {
      return etichetta + ' di ' + C.esc(App.core.capo.formattaKg(r.pesoGrammi));
    }
    return etichetta;
  }

  function render() {
    var C = App.ui.componenti;
    var M = App.core.modalita;

    return M.stato().then(function (st) {
      return App.data.repo.leggiStore(['outbox', 'audit']).then(function (d) {
        return { st: st, outbox: d.outbox, audit: d.audit };
      });
    }).then(function (dati) {
      var st = dati.st;
      var bloccate = dati.outbox.filter(function (o) { return o.stato === 'BLOCCATA'; });
      var ultimoErrore = dati.audit
        .filter(function (a) { return a.esito && a.esito !== 'OK' && a.esito !== 'DUPLICATA'; })
        .sort(function (a, b) { return String(b.quando).localeCompare(String(a.quando)); })[0];

      // indice dei record vivi, per dare un nome ai conflitti
      var store = {};
      bloccate.forEach(function (o) { store[o.store] = true; });
      var nomiStore = Object.keys(store);

      return (nomiStore.length
        ? App.data.repo.leggiStore(nomiStore)
        : Promise.resolve({})
      ).then(function (viventi) {
        var indice = {};
        nomiStore.forEach(function (n) {
          (viventi[n] || []).forEach(function (r) { indice[n + '__' + r.id] = r; });
        });

        C.intestazione({
          titolo: 'Sincronizzazione',
          sotto: M.condivisa() ? 'Archivio condiviso' : 'Archivio locale',
          indietro: '#/backup'
        });

        function riga(etichetta, valore) {
          return '<div class="dettaglio-riga"><dt>' + etichetta +
            '</dt><dd>' + valore + '</dd></div>';
        }

        C.monta(
          '<div class="sezione"><h3>Stato</h3><div class="card"><dl class="dettaglio">' +
            riga('Modalità', M.condivisa()
              ? '<strong>Condivisa</strong>' : '<strong>Solo questo telefono</strong>') +
            riga('Collegamento', online()
              ? '<span class="ok-testo">in linea</span>'
              : '<span class="avviso-testo">non in linea</span>') +
            riga('Ultima sincronizzazione', C.esc(quando(st.ultimaSincronizzazione))) +
            riga('In attesa di partire', String(st.inAttesa || 0)) +
            riga('Ferme per un conflitto', bloccate.length
              ? '<strong class="rosso">' + bloccate.length + '</strong>'
              : '0') +
            (ultimoErrore
              ? riga('Ultimo errore', C.esc(ultimoErrore.dettaglio || ultimoErrore.esito))
              : '') +
          '</dl></div></div>' +

          (M.condivisa()
            ? '<div class="sezione">' +
                '<button class="btn btn-azione" id="btn-sincronizza">' +
                'Sincronizza ora</button>' +
              '</div>'
            : '<p class="nota-piede">Questo dispositivo lavora da solo: ' +
              'i dati restano qui e non vengono condivisi.</p>') +

          // L'inizializzazione compare solo quando ha senso: archivio
          // condiviso attivo e non ancora inizializzato.
          '<div class="sezione" id="zona-bootstrap"></div>' +

          (bloccate.length
            ? '<div class="sezione">' +
                '<h3>Conflitti da risolvere<span class="contatore">' +
                bloccate.length + '</span></h3>' +
                '<p class="nota-piccola">Queste modifiche non sono partite perché ' +
                'nel frattempo qualcun altro ha cambiato lo stesso dato. ' +
                'Niente è andato perso: puoi riprovare sulla versione aggiornata.</p>' +
                '<div class="lista">' + bloccate.map(function (o) {
                  var vivo = indice[o.store + '__' + o.recordId];
                  return '<div class="voce voce-conflitto" data-op="' +
                    C.esc(o.operationId) + '">' +
                    '<span class="principale">' +
                      '<span class="titolo">' + descrivi(o, indice) + '</span>' +
                      '<span class="sotto">' +
                        (o.tipo === 'delete' ? 'Cancellazione' : 'Modifica') +
                        ' · ' + C.esc(o.dettaglio || 'in conflitto') +
                      '</span>' +
                      '<span class="sotto">Tu avevi la versione ' +
                        (o.expectedRevision === null ? 'iniziale' : o.expectedRevision) +
                        (vivo && typeof vivo.revision === 'number'
                          ? ' · adesso è la ' + vivo.revision : '') +
                        (vivo && vivo.modificatoDa
                          ? ' · modificato da ' + C.esc(vivo.modificatoDa) : '') +
                      '</span>' +
                    '</span>' +
                    '<button class="btn-piccolo" data-apri="' +
                      C.esc(o.store) + '|' + C.esc(o.recordId) +
                      '">Apri dato aggiornato</button>' +
                    '<button class="btn-piccolo btn-scarta" data-scarta="' +
                      C.esc(o.operationId) + '">Scarta mia modifica</button>' +
                  '</div>';
                }).join('') + '</div>' +
                '<p class="nota-piede">Non esiste un comando per rimandare la tua ' +
                'versione così com\u2019è: riscriverebbe anche i campi che l\u2019altro ' +
                'ha cambiato e tu non volevi toccare. Se la tua modifica serve ancora, ' +
                'apri il dato aggiornato e rifalla: partirà dalla versione giusta. ' +
                'Altrimenti scartala. Finché non scegli, resta qui.</p>' +
              '</div>'
            : '') +

          '<p class="nota-piede">Le modifiche vengono salvate subito su questo ' +
          'telefono e inviate quando c\u2019è collegamento.</p>');

        // Inizializzazione dell'archivio: si mostra solo se e' possibile.
        if (M.condivisa() && App.core.bootstrap) {
          App.core.bootstrap.analizza().then(function (a) {
            var zona = document.getElementById('zona-bootstrap');
            if (!zona) return;
            if (a.giaInizializzato) {
              zona.innerHTML = '<p class="nota-piede">L\u2019archivio della ' +
                'squadra è già stato creato: questo dispositivo ci lavora sopra.</p>';
              return;
            }
            zona.innerHTML =
              '<h3>Primo avvio della squadra</h3>' +
              '<p class="nota-piccola">L\u2019archivio condiviso è ancora vuoto. ' +
              'Si crea una volta sola, da un solo telefono: quello con i dati ' +
              'giusti. Prima viene fatto un backup.</p>' +
              (a.puoProcedere
                ? '<button class="btn btn-contorno" id="btn-bootstrap">' +
                  'Inizializza archivio condiviso</button>'
                : '<div class="avviso-box">' +
                  C.esc(a.motivi.join(' ')) + '</div>');

            var b = document.getElementById('btn-bootstrap');
            if (!b) return;
            b.addEventListener('click', function () {
              C.conferma({
                titolo: 'Creare l\u2019archivio della squadra?',
                testo: 'I dati di questo telefono diventano quelli condivisi. ' +
                  'Si fa una volta sola. Prima viene creato un backup.',
                conferma: 'Inizializza',
                annulla: 'Non adesso'
              }).then(function (si) {
                if (!si) return;
                b.disabled = true;
                b.setAttribute('aria-busy', 'true');
                return App.core.bootstrap.esegui().then(function () {
                  C.toast('Archivio della squadra creato.');
                  render();
                }).catch(function (e) {
                  b.disabled = false;
                  b.setAttribute('aria-busy', 'false');
                  C.toast(e.message, 'errore');
                });
              });
            });
          }).catch(function () { /* niente da mostrare */ });
        }

        var btn = document.getElementById('btn-sincronizza');
        if (btn) {
          btn.addEventListener('click', function () {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            M.sincronizzaOra().then(function () {
              C.toast('Sincronizzazione eseguita.');
              render();
            }).catch(function (e) {
              btn.disabled = false;
              btn.setAttribute('aria-busy', 'false');
              C.toast(e.message, 'errore');
            });
          });
        }

        Array.prototype.forEach.call(
          document.querySelectorAll('[data-scarta]'), function (b) {
            b.addEventListener('click', function () {
              var operationId = b.getAttribute('data-scarta');
              var voce = bloccate.filter(function (o) {
                return o.operationId === operationId;
              })[0];
              if (!voce) return;
              C.conferma({
                titolo: 'Scartare la tua modifica?',
                testo: 'La tua versione di questo dato verrà eliminata e resterà ' +
                  'quella della squadra. Non si può annullare.',
                conferma: 'Scarta',
                annulla: 'Torna indietro',
                pericolo: true
              }).then(function (si) {
                if (!si) return;
                b.disabled = true;
                return App.core.modalita.motore().scarta(operationId)
                  .then(function () { C.toast('Modifica scartata.'); render(); })
                  .catch(function (e) {
                    b.disabled = false;
                    C.toast(e.message, 'errore');
                  });
              });
            });
          });

        // "Apri dato aggiornato": porta al record com'e' adesso, cosi'
        // la modifica si rifa' dal service normale e nasce
        // un'operazione basata sulla versione vera.
        Array.prototype.forEach.call(
          document.querySelectorAll('[data-apri]'), function (b) {
            b.addEventListener('click', function () {
              var parti = b.getAttribute('data-apri').split('|');
              var dove = App.ui.viste.sincronizzazione.percorsoRecord(parti[0], parti[1]);
              if (!dove) {
                C.toast('Apri la schermata di quel dato e rifai la modifica.', 'errore');
                return;
              }
              App.ui.router.vai(dove);
            });
          });
      });
    });
  }

  // Dove si trova, nell'app, il record di un certo store. Serve al
  // comando "Apri dato aggiornato": non tutti gli store hanno una
  // schermata propria, e in quel caso non si inventa un percorso.
  function percorsoRecord(store, recordId) {
    if (store === 'membri') return '#/socio/' + recordId;
    if (store === 'giornate') return '#/giornata/' + recordId;
    if (store === 'abbattimenti') return '#/capo/' + recordId;
    return null;
  }

  App.ui.viste.sincronizzazione = {
    render: render,
    percorsoRecord: percorsoRecord
  };
})(typeof window !== 'undefined' ? window : globalThis);
