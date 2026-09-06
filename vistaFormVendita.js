(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function render(params) {
    var C = App.ui.componenti;
    var K = App.core.carne;

    return App.core.carne.perGiornata(params.id).then(function (r) {
      if (!r) {
        C.intestazione({ titolo: 'Nuova vendita', indietro: '#/giornata/' + params.id });
        C.erroreSchermo('Questa giornata non ha ancora una carne registrata.');
        return;
      }
      var g = r.giornata;
      var indietro = '#/giornata/' + params.id + '/carne';

      return App.core.carne.configPerStagione(r.lotto.stagioneId).then(function (config) {
        var prezzi = config.prezziCentKg || App.costanti.prezziPredefiniti();

        C.intestazione({
          titolo: 'Nuova vendita',
          sotto: 'Residuo nel lotto: ' + K.formattaKg(r.residuoGrammi),
          indietro: indietro
        });

        var opzioniTaglio = App.costanti.TIPI_TAGLIO.map(function (t) {
          return '<option value="' + t.codice + '" data-prezzo="' +
            (prezzi[t.codice] !== undefined ? prezzi[t.codice] : t.prezzoCentKg) + '">' +
            C.esc(t.etichetta) + '</option>';
        }).join('');

        var primo = App.costanti.TIPI_TAGLIO[0].codice;
        var prezzoIniziale = prezzi[primo] !== undefined
          ? prezzi[primo] : App.costanti.prezzoPredefinito(primo);

        C.monta(
          '<div class="sezione">' +
            '<div class="campo"><label for="v-data">Data</label>' +
              '<input type="date" id="v-data" value="' +
              C.esc(g ? g.data : App.core.calendario.oggi()) + '">' +
              '<div class="errore" id="err-v-data"></div></div>' +
            '<div class="campo"><label for="v-taglio">Tipo di taglio</label>' +
              '<select id="v-taglio">' + opzioniTaglio + '</select>' +
              '<div class="errore" id="err-v-taglio"></div></div>' +
            '<div class="due-colonne">' +
              '<div class="campo"><label for="v-peso">Peso (kg)</label>' +
                '<input type="text" inputmode="decimal" id="v-peso" placeholder="es. 30">' +
                '<div class="errore" id="err-v-peso"></div></div>' +
              '<div class="campo"><label for="v-prezzo">Prezzo (€/kg)</label>' +
                '<input type="text" inputmode="decimal" id="v-prezzo" value="' +
                C.esc(App.core.quote.formattaEuro(prezzoIniziale).replace(' €', '')) + '">' +
                '<div class="errore" id="err-v-prezzo"></div></div>' +
            '</div>' +
            '<p class="nota-piccola">Il prezzo è quello proposto per il taglio scelto ' +
            'e resta modificabile per questa singola vendita.</p>' +
            '<div class="campo"><label for="v-note">Note</label>' +
              '<textarea id="v-note"></textarea></div>' +
          '</div>' +
          '<div class="sezione pila">' +
            '<button class="btn btn-azione" id="btn-salva-vendita">Salva vendita</button>' +
            '<button class="btn btn-contorno" data-vai="' + indietro + '">Annulla</button>' +
          '</div>');

        var selTaglio = document.getElementById('v-taglio');
        selTaglio.addEventListener('change', function () {
          var opt = selTaglio.options[selTaglio.selectedIndex];
          var cent = Number(opt.getAttribute('data-prezzo')) || 0;
          document.getElementById('v-prezzo').value =
            App.core.quote.formattaEuro(cent).replace(' €', '');
        });

        function mostraErrori(errori) {
          ['v-data', 'v-taglio', 'v-peso', 'v-prezzo'].forEach(function (id) {
            var e = document.getElementById('err-' + id);
            if (e) e.textContent = '';
          });
          var mappa = { data: 'err-v-data', tipoTaglio: 'err-v-taglio',
            pesoGrammi: 'err-v-peso', prezzoCentKg: 'err-v-prezzo' };
          Object.keys(mappa).forEach(function (k) {
            if (errori[k]) document.getElementById(mappa[k]).textContent = errori[k];
          });
        }

        var inCorso = false;
        document.getElementById('btn-salva-vendita').addEventListener('click', function () {
          if (inCorso) return;
          var bottone = this;
          var campi = {
            data: document.getElementById('v-data').value,
            tipoTaglio: selTaglio.value,
            pesoGrammi: K.parseKgInGrammi(document.getElementById('v-peso').value),
            prezzoCentKg: App.core.quote.parseEuroInCent(
              document.getElementById('v-prezzo').value),
            note: document.getElementById('v-note').value
          };
          var errori = App.core.carne.validaVendita(campi);
          if (Object.keys(errori).length) {
            mostraErrori(errori);
            C.toast('Controlla i campi segnalati.', 'errore');
            return;
          }
          inCorso = true;
          bottone.disabled = true;
          bottone.setAttribute('aria-busy', 'true');
          Promise.resolve()
            .then(function () { return App.core.carne.registraVendita(r.lotto.id, campi); })
            .then(function () {
              C.toast('Vendita registrata.');
              App.ui.router.vai(indietro);
            })
            .catch(function (e) {
              inCorso = false;
              bottone.disabled = false;
              bottone.setAttribute('aria-busy', 'false');
              if (e.errori) { mostraErrori(e.errori); C.toast(e.message, 'errore'); }
              else C.toast(e.message, 'errore');
            });
        });
      });
    });
  }

  App.ui.viste.formVendita = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
