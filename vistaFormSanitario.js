(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function render(params) {
    var C = App.ui.componenti;

    return Promise.all([
      App.core.capo.scheda(params.id),
      App.core.sanitario.perAbbattimento(params.id)
    ]).then(function (r) {
      var dati = r[0];
      var controllo = r[1];
      if (!dati) {
        C.intestazione({ titolo: 'Controllo sanitario', indietro: '#/abbattimenti' });
        C.erroreSchermo('Abbattimento non trovato.');
        return;
      }
      var a = dati.capo;
      var indietro = '#/capo/' + a.id;

      C.intestazione({
        titolo: 'Controllo sanitario',
        sotto: a.codiceCapo,
        indietro: indietro
      });

      var opzioniStato = App.costanti.STATI_TRICHINELLA.map(function (st) {
        var sel = controllo
          ? controllo.statoTrichinella === st.codice
          : st.codice === App.costanti.STATO_TRICHINELLA_PREDEFINITO;
        return '<option value="' + st.codice + '"' + (sel ? ' selected' : '') + '>' +
          C.esc(st.etichetta) + '</option>';
      }).join('');

      C.monta(
        (a.annullato
          ? '<div class="sezione"><div class="avviso-box pericolo">' +
            'Il capo ' + C.esc(a.codiceCapo) + ' è annullato. Il controllo sanitario ' +
            'resta consultabile e modificabile.</div></div>'
          : '') +

        '<div class="sezione"><h3>Trichinella</h3>' +
          '<div class="campo"><label for="s-stato">Stato</label>' +
            '<select id="s-stato">' + opzioniStato + '</select>' +
            '<div class="errore" id="err-s-stato"></div></div>' +
          '<div class="due-colonne">' +
            '<div class="campo"><label for="s-prelievo">Data prelievo</label>' +
              '<input type="date" id="s-prelievo" value="' +
              C.esc(controllo ? (controllo.dataPrelievo || '') : '') + '">' +
              '<div class="errore" id="err-s-prelievo"></div></div>' +
            '<div class="campo"><label for="s-esito">Data esito</label>' +
              '<input type="date" id="s-esito" value="' +
              C.esc(controllo ? (controllo.dataEsito || '') : '') + '">' +
              '<div class="errore" id="err-s-esito"></div></div>' +
          '</div>' +
          '<div class="campo"><label for="s-riferimento">Riferimento campione</label>' +
            '<input type="text" id="s-riferimento" value="' +
            C.esc(controllo ? (controllo.riferimentoCampione || '') : '') + '">' +
            '<div class="aiuto">Facoltativo.</div></div>' +
          '<div class="campo"><label for="s-note">Note</label>' +
            '<textarea id="s-note">' + C.esc(controllo ? (controllo.note || '') : '') +
            '</textarea></div>' +
        '</div>' +

        '<div class="sezione pila">' +
          '<button class="btn btn-primario btn-largo" id="btn-salva-sanitario">Salva</button>' +
          '<button class="btn btn-fantasma" data-vai="' + indietro + '">Annulla</button>' +
        '</div>' +
        '<p class="nota-piede">Ogni capo ha un solo controllo sanitario: ' +
        'salvando si aggiorna quello esistente.</p>');

      function leggiCampi() {
        return {
          statoTrichinella: document.getElementById('s-stato').value,
          dataPrelievo: document.getElementById('s-prelievo').value || null,
          dataEsito: document.getElementById('s-esito').value || null,
          riferimentoCampione: document.getElementById('s-riferimento').value,
          note: document.getElementById('s-note').value
        };
      }

      function mostraErrori(errori) {
        ['s-stato', 's-prelievo', 's-esito'].forEach(function (id) {
          var e = document.getElementById('err-' + id);
          if (e) e.textContent = '';
        });
        if (errori.statoTrichinella) {
          document.getElementById('err-s-stato').textContent = errori.statoTrichinella;
        }
        if (errori.dataPrelievo) {
          document.getElementById('err-s-prelievo').textContent = errori.dataPrelievo;
        }
        if (errori.dataEsito) {
          document.getElementById('err-s-esito').textContent = errori.dataEsito;
        }
      }

      // Come nel form del capo: un doppio tap non deve avviare due salvataggi.
      var salvataggioInCorso = false;
      document.getElementById('btn-salva-sanitario').addEventListener('click', function () {
        if (salvataggioInCorso) return;
        var bottone = document.getElementById('btn-salva-sanitario');
        var campi = leggiCampi();
        var errori = App.core.sanitario.valida(campi);
        if (Object.keys(errori).length) {
          mostraErrori(errori);
          C.toast('Controlla i campi segnalati.', 'errore');
          return;
        }

        function occupa(si) {
          salvataggioInCorso = si;
          bottone.disabled = si;
          bottone.setAttribute('aria-busy', si ? 'true' : 'false');
        }
        occupa(true);

        Promise.resolve()
          .then(function () { return App.core.sanitario.salva(a.id, campi); })
          .then(function () {
            C.toast('Controllo sanitario salvato.');
            App.ui.router.vai(indietro);
          })
          .catch(function (e) {
            occupa(false);
            if (e.errori) { mostraErrori(e.errori); C.toast('Controlla i campi segnalati.', 'errore'); }
            else C.toast(e.message, 'errore');
          });
      });
    });
  }

  App.ui.viste.formSanitario = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
