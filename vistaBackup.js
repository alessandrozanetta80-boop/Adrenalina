(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function scaricaJson(oggetto, nomeFile) {
    var testo = JSON.stringify(oggetto, null, 2);
    var blob = new Blob([testo], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function leggiFile(file) {
    return new Promise(function (resolve, reject) {
      var lettore = new FileReader();
      lettore.onload = function () {
        try { resolve(JSON.parse(lettore.result)); }
        catch (e) { reject(new Error('Il file non è un JSON valido.')); }
      };
      lettore.onerror = function () { reject(new Error('Impossibile leggere il file.')); };
      lettore.readAsText(file);
    });
  }

  function render() {
    var C = App.ui.componenti;
    return App.core.backup.anteprimaEliminazioneDemo().then(function (ant) {
      C.intestazione({ titolo: 'Backup dati', indietro: '#/home' });

      var totDemo = 0;
      Object.keys(ant.conteggi).forEach(function (k) { totDemo += ant.conteggi[k]; });

      C.monta(
        '<div class="sezione"><h3>Esporta</h3><div class="card">' +
          '<p>Salva tutti i dati dell\u2019app in un file JSON sul dispositivo.</p>' +
          '<button class="btn btn-primario btn-largo" id="btn-esporta">Esporta dati</button>' +
        '</div></div>' +

        '<div class="sezione"><h3>Importa</h3><div class="card">' +
          '<p>Seleziona un backup esportato in precedenza. ' +
          'L\u2019importazione <strong>sostituisce tutti i dati presenti</strong>.</p>' +
          '<input type="file" id="f-backup" accept="application/json,.json" class="nascosto">' +
          '<button class="btn btn-largo" id="btn-importa">Scegli file e importa</button>' +
        '</div></div>' +

        '<div class="sezione"><h3>Dati di prova</h3><div class="card">' +
          (totDemo === 0
            ? '<p>Nessun dato di prova presente.</p>'
            : '<p>Presenti <strong>' + totDemo + '</strong> record di prova: ' +
              ant.conteggi.squadre + ' squadra, ' + ant.conteggi.stagioni + ' stagione, ' +
              ant.conteggi.membri + ' soci, ' + ant.conteggi.iscrizioni + ' iscrizioni, ' +
              ant.conteggi.giornate + ' giornate, ' + ant.conteggi.presenze + ' presenze, ' +
              ant.conteggi.abbattimenti + ' capi, ' +
              ant.conteggi.controlliSanitari + ' controlli sanitari.</p>') +
          (totDemo > 0 && !ant.puoProcedere
            ? '<div class="avviso-box pericolo">Eliminazione non possibile: ' +
              'lascerebbe dati reali senza riferimenti.<ul>' +
              ant.problemi.map(function (p) { return '<li>' + C.esc(p) + '</li>'; }).join('') +
              '</ul></div>'
            : '') +
          '<button class="btn btn-pericolo btn-largo" id="btn-demo" style="margin-top:10px"' +
            (totDemo === 0 || !ant.puoProcedere ? ' disabled' : '') +
            '>Elimina dati di prova</button>' +
        '</div></div>' +

        '<p class="nota-piede">Schema dati versione ' + App.versione.SCHEMA_VERSION +
        ' — app versione ' + C.esc(App.versione.APP_VERSION) + '</p>');

      document.getElementById('btn-esporta').addEventListener('click', function () {
        App.core.backup.costruisciBackup().then(function (b) {
          scaricaJson(b, App.core.backup.nomeFileBackup());
          C.toast('Backup esportato.');
        }).catch(function (e) { C.toast(e.message, 'errore'); });
      });

      var input = document.getElementById('f-backup');
      document.getElementById('btn-importa').addEventListener('click', function () {
        input.value = '';
        input.click();
      });

      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        leggiFile(file).then(function (oggetto) {
          var errori = App.core.backup.validaBackup(oggetto);
          if (errori.length) {
            C.conferma({
              titolo: 'Backup non valido',
              testo: 'Il file non può essere importato.',
              elenco: errori,
              conferma: 'Ho capito',
              annulla: 'Chiudi',
              pericolo: true
            });
            return;
          }
          var r = App.core.backup.riepilogoBackup(oggetto);
          return C.conferma({
            titolo: 'Sostituire tutti i dati?',
            testo: 'Il backup del ' + String(oggetto.esportatoIl || '').slice(0, 10) +
              ' (schema ' + oggetto.schemaVersion + ') contiene ' + r.membri + ' soci, ' +
              r.stagioni + ' stagioni, ' + r.iscrizioni + ' iscrizioni e ' +
              (r.giornate || 0) + ' giornate e ' + (r.abbattimenti || 0) +
              ' capi. Tutti i dati attualmente presenti ' +
              'verranno eliminati e sostituiti. L\u2019operazione non è reversibile.',
            conferma: 'Sostituisci tutto',
            pericolo: true
          }).then(function (si) {
            if (!si) return;
            return App.core.backup.importaBackup(oggetto).then(function () {
              C.toast('Dati importati.');
              App.ui.router.vai('#/home');
            });
          });
        }).catch(function (e) { C.toast(e.message, 'errore'); });
      });

      document.getElementById('btn-demo').addEventListener('click', function () {
        C.conferma({
          titolo: 'Eliminare i dati di prova?',
          testo: 'Verranno eliminati ' + totDemo + ' record contrassegnati come demo. ' +
                 'I dati reali non vengono toccati. L\u2019operazione non è reversibile.',
          conferma: 'Elimina dati di prova',
          pericolo: true
        }).then(function (si) {
          if (!si) return;
          App.core.backup.eliminaDatiDemo().then(function (r) {
            C.toast(r.totale + ' record di prova eliminati.');
            // Se non resta nessuna squadra si riparte dalla configurazione
            // iniziale, non da una Home vuota.
            return App.core.squadra.esisteSquadra().then(function (ci) {
              App.ui.router.vai(ci ? '#/home' : '#/configurazione');
            });
          }).catch(function (e) {
            C.conferma({
              titolo: 'Eliminazione annullata',
              testo: e.message + ' Nessun record è stato eliminato.',
              elenco: e.problemi || [],
              conferma: 'Ho capito',
              annulla: 'Chiudi',
              pericolo: true
            });
          });
        });
      });
    });
  }

  App.ui.viste.backup = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
