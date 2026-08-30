(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // Mostrata al primo avvio con database vuoto e subito dopo l'eliminazione
  // dei dati di prova, quando non resta nessuna squadra.
  function render() {
    var C = App.ui.componenti;
    var Q = App.core.quote;

    C.intestazione({ titolo: 'Configurazione iniziale' });

    C.monta(
      '<div class="sezione">' +
        '<p>Non c\u2019\u00e8 ancora nessuna squadra. Crea la squadra e la sua prima ' +
        'stagione: i dati restano su questo dispositivo.</p>' +
      '</div>' +

      '<div class="sezione"><h3>Squadra</h3>' +
        '<div class="campo"><label for="c-squadra">Nome squadra</label>' +
          '<input type="text" id="c-squadra" value="Adrenalina"></div>' +
      '</div>' +

      '<div class="sezione"><h3>Prima stagione</h3>' +
        '<div class="campo"><label for="c-stagione">Nome stagione</label>' +
          '<input type="text" id="c-stagione" value="2026/2027"></div>' +
        '<div class="due-colonne">' +
          '<div class="campo"><label for="c-inizio">Data inizio</label>' +
            '<input type="date" id="c-inizio" value="2026-09-01"></div>' +
          '<div class="campo"><label for="c-fine">Data fine</label>' +
            '<input type="date" id="c-fine" value="2027-01-31"></div>' +
        '</div>' +
        '<div class="campo"><label for="c-quota">Quota annuale predefinita (€)</label>' +
          '<input type="text" id="c-quota" value="240,00">' +
          '<div class="aiuto">Sarà la quota proposta per ogni socio della stagione.</div>' +
        '</div>' +
      '</div>' +

      '<div class="sezione">' +
        '<div class="errore" id="err-config"></div>' +
        '<button class="btn btn-primario btn-largo" id="btn-crea-squadra">Crea squadra</button>' +
      '</div>' +

      '<p class="nota-piede">Hai già un backup? Puoi importarlo da Backup dati ' +
      'invece di creare una squadra nuova.</p>' +
      '<div class="sezione"><button class="btn btn-fantasma" data-vai="#/backup">' +
      'Vai a Backup dati</button></div>');

    document.getElementById('btn-crea-squadra').addEventListener('click', function () {
      var campi = {
        nomeSquadra: document.getElementById('c-squadra').value,
        nomeStagione: document.getElementById('c-stagione').value,
        dataInizio: document.getElementById('c-inizio').value || null,
        dataFine: document.getElementById('c-fine').value || null,
        quotaAnnualePredefinitaCent: Q.parseEuroInCent(document.getElementById('c-quota').value)
      };
      var errori = App.core.squadra.validaConfigurazioneIniziale(campi);
      if (errori.length) {
        document.getElementById('err-config').textContent = errori.join(' ');
        return;
      }
      Promise.resolve()
        .then(function () { return App.core.squadra.creaSquadraIniziale(campi); })
        .then(function (r) {
          C.toast('Squadra creata: ' + r.squadra.nome);
          App.ui.router.vai('#/home');
        })
        .catch(function (e) {
          document.getElementById('err-config').textContent = e.message;
        });
    });
  }

  App.ui.viste.configurazione = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
