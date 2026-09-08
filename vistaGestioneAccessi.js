(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // GESTIONE ACCESSI
  //
  // Dopo i primi tre amministratori, creati una volta dalla Console,
  // gli accessi si danno e si tolgono da qui.
  //
  // Due regole che non si aggirano dall'interfaccia, perche' stanno
  // anche nelle regole del database:
  //   - nessuno tocca il proprio accesso, per non restare senza
  //     amministratori;
  //   - una richiesta da sola non concede niente.

  function etichettaRuolo(r) {
    return r === 'AMMINISTRATORE' ? 'Amministratore' : 'Sola lettura';
  }

  function render() {
    var C = App.ui.componenti;
    var A = App.core.accesso;

    C.intestazione({ titolo: 'Gestione accessi', indietro: '#/home' });

    if (!A.attivo() || !A.amministratore()) {
      C.monta('<div class="sezione"><div class="avviso-box">' +
        'Questa schermata è riservata agli amministratori.' +
        '</div></div>');
      return Promise.resolve();
    }

    return Promise.all([A.elencoRichieste(), A.elencoAccessi()])
      .then(function (r) {
        var richieste = r[0] || [];
        var accessi = (r[1] || []).slice().sort(function (a, b) {
          return String(a.email).localeCompare(String(b.email));
        });
        var io = A.stato().utente ? A.stato().utente.uid : null;

        C.monta(
          (richieste.length
            ? '<div class="sezione"><h3>Richieste in attesa' +
                '<span class="contatore">' + richieste.length + '</span></h3>' +
              '<div class="lista">' + richieste.map(function (q) {
                return '<div class="voce voce-colonna">' +
                  '<span class="principale">' +
                    '<span class="titolo">' + C.esc(q.email) + '</span>' +
                    (q.nome ? '<span class="sotto">' + C.esc(q.nome) + '</span>' : '') +
                  '</span>' +
                  '<span class="azioni-riga">' +
                    '<button class="btn-piccolo" data-lettore="' + C.esc(q.uid) +
                      '|' + C.esc(q.email) + '">Sola lettura</button>' +
                    '<button class="btn-piccolo" data-admin="' + C.esc(q.uid) +
                      '|' + C.esc(q.email) + '">Amministratore</button>' +
                    '<button class="btn-piccolo btn-scarta" data-rifiuta="' +
                      C.esc(q.uid) + '">Rifiuta</button>' +
                  '</span>' +
                '</div>';
              }).join('') + '</div></div>'
            : '<div class="sezione"><p class="nota-piccola">' +
              'Nessuna richiesta in attesa.</p></div>') +

          '<div class="sezione"><h3>Chi ha accesso' +
            '<span class="contatore">' + accessi.length + '</span></h3>' +
          '<div class="lista">' + accessi.map(function (a) {
            var sonoIo = a.uid === io;
            return '<div class="voce voce-colonna">' +
              '<span class="principale">' +
                '<span class="titolo">' + C.esc(a.email) +
                  (sonoIo ? ' <em>(tu)</em>' : '') + '</span>' +
                '<span class="sotto">' + etichettaRuolo(a.ruolo) + '</span>' +
              '</span>' +
              (sonoIo
                ? '<span class="sotto">Il tuo accesso non si modifica da qui.</span>'
                : '<span class="azioni-riga">' +
                    (a.ruolo === 'AMMINISTRATORE'
                      ? '<button class="btn-piccolo" data-lettore="' + C.esc(a.uid) +
                        '|' + C.esc(a.email) + '">Rendi sola lettura</button>'
                      : '<button class="btn-piccolo" data-admin="' + C.esc(a.uid) +
                        '|' + C.esc(a.email) + '">Rendi amministratore</button>') +
                    '<button class="btn-piccolo btn-scarta" data-revoca="' +
                      C.esc(a.uid) + '|' + C.esc(a.email) + '">Revoca</button>' +
                  '</span>') +
            '</div>';
          }).join('') + '</div>' +
          '<p class="nota-piede">Chi ha la sola lettura vede tutto ma non può ' +
          'modificare niente. Il tuo accesso non si tocca da qui: serve un altro ' +
          'amministratore.</p>' +
          '</div>');

        function agisci(selettore, fn) {
          Array.prototype.forEach.call(
            document.querySelectorAll(selettore), function (b) {
              b.addEventListener('click', function () {
                b.disabled = true;
                Promise.resolve(fn(b)).then(function (fatto) {
                  if (fatto === false) { b.disabled = false; return; }
                  render();
                }).catch(function (e) {
                  b.disabled = false;
                  C.toast(e.message, 'errore');
                });
              });
            });
        }

        agisci('[data-lettore]', function (b) {
          var p = b.getAttribute('data-lettore').split('|');
          return A.impostaAccesso(p[0], p[1], 'LETTORE').then(function () {
            C.toast('Accesso in sola lettura.');
          });
        });

        agisci('[data-admin]', function (b) {
          var p = b.getAttribute('data-admin').split('|');
          return A.impostaAccesso(p[0], p[1], 'AMMINISTRATORE').then(function () {
            C.toast('Ora è amministratore.');
          });
        });

        agisci('[data-rifiuta]', function (b) {
          return A.rifiutaRichiesta(b.getAttribute('data-rifiuta'))
            .then(function () { C.toast('Richiesta rifiutata.'); });
        });

        agisci('[data-revoca]', function (b) {
          var p = b.getAttribute('data-revoca').split('|');
          return C.conferma({
            titolo: 'Revocare l\u2019accesso?',
            testo: p[1] + ' non potrà più aprire l\u2019app né vedere i dati ' +
              'della squadra. I dati già scaricati sul suo telefono restano lì.',
            conferma: 'Revoca',
            annulla: 'Annulla',
            pericolo: true
          }).then(function (si) {
            if (!si) return false;
            return A.revocaAccesso(p[0]).then(function () {
              C.toast('Accesso revocato.');
            });
          });
        });
      });
  }

  App.ui.viste.gestioneAccessi = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
