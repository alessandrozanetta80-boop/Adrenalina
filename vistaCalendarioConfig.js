(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // Configurazione del calendario battute della stagione attiva.
  // Le date non sono scritte nel software: sono una configurazione
  // che l'amministratore puo' cambiare per ogni stagione.
  function render() {
    var C = App.ui.componenti;

    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.stagioneAttiva) {
        C.intestazione({ titolo: 'Calendario battute', indietro: '#/stagioni' });
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2>' +
          '<p>Il calendario appartiene a una stagione.</p></div>');
        return;
      }
      var stagione = ctx.stagioneAttiva;

      return App.core.calendarioBattute.perStagione(stagione.id).then(function (cfg) {
        C.intestazione({
          titolo: 'Calendario battute',
          sotto: 'Stagione ' + stagione.nome,
          indietro: '#/stagioni'
        });

        var giorniScelti = cfg ? cfg.giorniSettimana : [];
        function scelto(codice) { return giorniScelti.indexOf(codice) !== -1; }

        C.monta(
          '<div class="sezione">' +
            '<div class="campo"><label for="k-nome">Nome del calendario</label>' +
              '<input type="text" id="k-nome" value="' +
              C.esc(cfg ? cfg.nome : App.costanti.CALENDARIO_NOME_PREDEFINITO) + '">' +
              '<div class="aiuto">Per esempio il comprensorio alpino di riferimento.</div>' +
            '</div>' +
            '<div class="due-colonne">' +
              '<div class="campo"><label for="k-inizio">Data inizio</label>' +
                '<input type="date" id="k-inizio" value="' +
                C.esc(cfg ? cfg.dataInizio : '') + '">' +
                '<div class="errore" id="err-k-inizio"></div></div>' +
              '<div class="campo"><label for="k-fine">Data fine</label>' +
                '<input type="date" id="k-fine" value="' +
                C.esc(cfg ? cfg.dataFine : '') + '">' +
                '<div class="errore" id="err-k-fine"></div></div>' +
            '</div>' +
            '<div class="campo"><label>Giorni di battuta</label>' +
              '<div class="spunte">' +
              App.costanti.GIORNI_SETTIMANA.map(function (g) {
                return '<label class="spunta"><input type="checkbox" name="giorno" value="' +
                  g.codice + '"' + (scelto(g.codice) ? ' checked' : '') + '> ' +
                  C.esc(g.etichetta) + '</label>';
              }).join('') +
              '</div>' +
              '<div class="errore" id="err-k-giorni"></div>' +
            '</div>' +
          '</div>' +

          '<div class="sezione">' +
            '<p class="nota-piccola" id="anteprima-date"></p>' +
            '<button class="btn btn-azione" id="btn-salva-calendario">Salva calendario</button>' +
          '</div>' +

          '<p class="nota-piede">Le date non vengono create nel database: ' +
          'una giornata nasce solo quando la compili.</p>');

        function leggi() {
          return {
            nome: document.getElementById('k-nome').value,
            dataInizio: document.getElementById('k-inizio').value,
            dataFine: document.getElementById('k-fine').value,
            giorniSettimana: Array.prototype.slice
              .call(document.querySelectorAll('input[name="giorno"]:checked'))
              .map(function (c) { return c.value; })
          };
        }

        function aggiornaAnteprima() {
          var campi = leggi();
          var el = document.getElementById('anteprima-date');
          if (Object.keys(App.core.calendarioBattute.valida(campi)).length) {
            el.textContent = '';
            return;
          }
          var n = App.core.calendarioBattute.dateDa(campi).length;
          el.textContent = n + ' date di battuta in questo periodo.';
        }

        function mostraErrori(errori) {
          ['k-inizio', 'k-fine', 'k-giorni'].forEach(function (id) {
            var e = document.getElementById('err-' + id);
            if (e) e.textContent = '';
          });
          if (errori.dataInizio) document.getElementById('err-k-inizio').textContent = errori.dataInizio;
          if (errori.dataFine) document.getElementById('err-k-fine').textContent = errori.dataFine;
          if (errori.giorniSettimana) {
            document.getElementById('err-k-giorni').textContent = errori.giorniSettimana;
          }
        }

        ['k-inizio', 'k-fine'].forEach(function (id) {
          document.getElementById(id).addEventListener('change', aggiornaAnteprima);
        });
        Array.prototype.forEach.call(document.querySelectorAll('input[name="giorno"]'),
          function (c) { c.addEventListener('change', aggiornaAnteprima); });
        aggiornaAnteprima();

        var inCorso = false;
        document.getElementById('btn-salva-calendario').addEventListener('click', function () {
          if (inCorso) return;
          var bottone = document.getElementById('btn-salva-calendario');
          var campi = leggi();
          var errori = App.core.calendarioBattute.valida(campi);
          if (Object.keys(errori).length) {
            mostraErrori(errori);
            C.toast('Controlla i campi segnalati.', 'errore');
            return;
          }
          inCorso = true;
          bottone.disabled = true;
          bottone.setAttribute('aria-busy', 'true');
          Promise.resolve()
            .then(function () { return App.core.calendarioBattute.salva(stagione.id, campi); })
            .then(function () {
              C.toast('Calendario salvato.');
              App.ui.router.vai('#/giornate');
            })
            .catch(function (e) {
              inCorso = false;
              bottone.disabled = false;
              bottone.setAttribute('aria-busy', 'false');
              if (e.errori) mostraErrori(e.errori);
              C.toast(e.message, 'errore');
            });
        });
      });
    });
  }

  App.ui.viste.calendarioConfig = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
