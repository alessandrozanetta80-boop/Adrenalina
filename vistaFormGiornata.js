(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function render(params) {
    var C = App.ui.componenti;
    var nuova = !params.id;

    var promessa = nuova
      ? App.core.squadra.contesto().then(function (ctx) {
          return { contesto: ctx, giornata: null, stagione: ctx.stagioneAttiva };
        })
      : App.core.giornata.scheda(params.id);

    return promessa.then(function (dati) {
      if (!dati) { C.erroreSchermo('Giornata non trovata.'); return; }
      var ctx = dati.contesto;
      var g = dati.giornata || null;

      if (nuova && !ctx.stagioneAttiva) {
        C.intestazione({ titolo: 'Nuova giornata', indietro: '#/giornate' });
        C.monta('<div class="avviso-box">Nessuna stagione attiva: non è possibile ' +
          'creare una giornata.</div>');
        return;
      }

      var squadraId = g ? g.squadraId : ctx.squadra.id;
      var indietro = nuova ? '#/giornate' : '#/giornata/' + g.id;

      return App.core.giornata.candidatiCapocaccia(
        squadraId, g ? g.capocacciaMembroId : null
      ).then(function (candidati) {
        // La stagione mostrata e' quella DELLA GIORNATA, che puo' non essere
        // quella attiva. Modificare una giornata non la sposta mai di stagione.
        var stagioneGiornata = dati.stagione || null;
        C.intestazione({
          titolo: nuova ? 'Nuova giornata' : 'Modifica giornata',
          sotto: stagioneGiornata ? 'Stagione ' + stagioneGiornata.nome : '',
          indietro: indietro
        });

        var opzioniCapocaccia = '<option value="">— da assegnare —</option>' +
          candidati.map(function (m) {
            var sel = g && g.capocacciaMembroId === m.id;
            return '<option value="' + C.esc(m.id) + '"' + (sel ? ' selected' : '') + '>' +
              C.esc(C.nomeCompleto(m)) + (m.attivo ? '' : ' (non attivo)') + '</option>';
          }).join('');

        var opzioniStato = App.costanti.STATI_GIORNATA.map(function (st) {
          var sel = g ? g.stato === st.codice : st.codice === App.costanti.STATO_GIORNATA_PREDEFINITO;
          return '<option value="' + st.codice + '"' + (sel ? ' selected' : '') + '>' +
            C.esc(st.etichetta) + '</option>';
        }).join('');

        C.monta(
          '<div class="sezione"><h3>Quando</h3>' +
            '<div class="due-colonne">' +
              '<div class="campo"><label for="g-data">Data</label>' +
                '<input type="date" id="g-data" value="' + C.esc(g ? g.data : '') + '">' +
                '<div class="errore" id="err-g-data"></div></div>' +
              '<div class="campo"><label for="g-orario">Orario ritrovo</label>' +
                '<input type="time" id="g-orario" value="' +
                C.esc(g ? (g.orarioRitrovo || '') : App.costanti.ORARIO_RITROVO_PREDEFINITO) + '">' +
                '<div class="errore" id="err-g-orario"></div></div>' +
            '</div>' +
          '</div>' +

          '<div class="sezione"><h3>Dove</h3>' +
            '<div class="campo"><label for="g-zona">Zona / località</label>' +
              '<input type="text" id="g-zona" value="' + C.esc(g ? (g.zona || '') : '') + '">' +
              '<div class="aiuto">Testo libero.</div></div>' +
          '</div>' +

          '<div class="sezione"><h3>Organizzazione</h3>' +
            '<div class="campo"><label for="g-capocaccia">Capocaccia</label>' +
              '<select id="g-capocaccia">' + opzioniCapocaccia + '</select>' +
              '<div class="aiuto">Può essere qualsiasi socio della squadra, ' +
              'non solo chi ha ruolo Caposquadra.</div></div>' +
            '<div class="campo"><label for="g-stato">Stato</label>' +
              '<select id="g-stato">' + opzioniStato + '</select>' +
              '<div class="errore" id="err-g-stato"></div></div>' +
            '<div class="campo"><label for="g-note">Note</label>' +
              '<textarea id="g-note">' + C.esc(g ? (g.note || '') : '') + '</textarea></div>' +
          '</div>' +

          '<div class="sezione pila">' +
            '<button class="btn btn-primario btn-largo" id="btn-salva-giornata">Salva</button>' +
            '<button class="btn btn-fantasma" data-vai="' + indietro + '">Annulla</button>' +
          '</div>');

        function leggiCampi() {
          return {
            data: document.getElementById('g-data').value,
            orarioRitrovo: document.getElementById('g-orario').value,
            zona: document.getElementById('g-zona').value,
            capocacciaMembroId: document.getElementById('g-capocaccia').value || null,
            note: document.getElementById('g-note').value,
            stato: document.getElementById('g-stato').value
          };
        }

        function mostraErrori(errori) {
          ['g-data', 'g-orario', 'g-stato'].forEach(function (id) {
            var e = document.getElementById('err-' + id);
            if (e) e.textContent = '';
          });
          if (errori.data) document.getElementById('err-g-data').textContent = errori.data;
          if (errori.orarioRitrovo) {
            document.getElementById('err-g-orario').textContent = errori.orarioRitrovo;
          }
          if (errori.stato) document.getElementById('err-g-stato').textContent = errori.stato;
        }

        document.getElementById('btn-salva-giornata').addEventListener('click', function () {
          var campi = leggiCampi();
          var errori = App.core.giornata.valida(campi);
          if (Object.keys(errori).length) {
            mostraErrori(errori);
            C.toast('Controlla i campi segnalati.', 'errore');
            return;
          }
          Promise.resolve()
            .then(function () {
              return nuova
                ? App.core.giornata.crea(campi)
                : App.core.giornata.aggiorna(g.id, campi);
            })
            .then(function (salvata) {
              C.toast(nuova ? 'Giornata creata.' : 'Modifiche salvate.');
              App.ui.router.vai('#/giornata/' + salvata.id);
            })
            .catch(function (e) {
              if (e.errori) { mostraErrori(e.errori); C.toast('Controlla i campi segnalati.', 'errore'); }
              else C.toast(e.message, 'errore');
            });
        });
      });
    });
  }

  App.ui.viste.formGiornata = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
