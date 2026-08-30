(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};
  var formAperto = false;

  function render() {
    var C = App.ui.componenti;
    var Q = App.core.quote;
    return App.core.squadra.contesto().then(function (ctx) {
      return App.data.iscrizioni.tutte().then(function (tutte) {
        C.intestazione({ titolo: 'Stagioni', sotto: ctx.squadra ? ctx.squadra.nome : '', indietro: '#/home' });

        var perStagione = {};
        tutte.forEach(function (i) {
          perStagione[i.stagioneId] = (perStagione[i.stagioneId] || 0) + 1;
        });

        function cardStagione(s) {
          var attiva = ctx.stagioneAttiva && s.id === ctx.stagioneAttiva.id;
          return '<div class="card" style="margin-bottom:10px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
              '<h2 style="margin:0">' + C.esc(s.nome) + '</h2>' +
              (attiva ? '<span class="badge badge-verde">Attiva</span>'
                      : '<span class="badge">Chiusa</span>') +
            '</div>' +
            '<dl class="dettaglio" style="margin-top:8px">' +
              '<div class="dettaglio-riga"><dt>Periodo</dt><dd>' +
                C.esc(C.formattaData(s.dataInizio)) + ' – ' +
                C.esc(C.formattaData(s.dataFine)) + '</dd></div>' +
              '<div class="dettaglio-riga"><dt>Quota predefinita</dt><dd>' +
                C.esc(Q.formattaEuro(s.quotaAnnualePredefinitaCent)) + '</dd></div>' +
              '<div class="dettaglio-riga"><dt>Iscritti</dt><dd>' +
                (perStagione[s.id] || 0) + '</dd></div>' +
            '</dl>' +
            (attiva ? '' :
              '<button class="btn" data-attiva="' + C.esc(s.id) + '" style="margin-top:10px">' +
              'Rendi attiva</button>') +
          '</div>';
        }

        var attiva = ctx.stagioneAttiva;
        var altre = ctx.stagioni.filter(function (s) { return !attiva || s.id !== attiva.id; });

        var quotaSuggerita = attiva ? Q.euroPerInput(attiva.quotaAnnualePredefinitaCent) : '0,00';

        C.monta(
          '<div class="sezione"><h3>Stagione attiva</h3>' +
            (attiva ? cardStagione(attiva) : '<div class="vuoto">Nessuna stagione attiva.</div>') +
          '</div>' +

          '<div class="sezione"><h3>Stagioni precedenti</h3>' +
            (altre.length ? altre.map(cardStagione).join('')
                          : '<div class="vuoto">Nessuna stagione precedente.</div>') +
          '</div>' +

          '<div class="sezione">' +
            '<button class="btn btn-primario btn-largo" id="btn-apri-form">' +
              (formAperto ? 'Chiudi' : '+ Nuova stagione') + '</button>' +
            (formAperto
              ? '<div class="card" style="margin-top:12px">' +
                  '<div class="campo"><label for="s-nome">Nome stagione</label>' +
                    '<input type="text" id="s-nome" placeholder="2027/2028">' +
                    '<div class="errore" id="err-stagione"></div></div>' +
                  '<div class="due-colonne">' +
                    '<div class="campo"><label for="s-inizio">Data inizio</label>' +
                      '<input type="date" id="s-inizio"></div>' +
                    '<div class="campo"><label for="s-fine">Data fine</label>' +
                      '<input type="date" id="s-fine"></div>' +
                  '</div>' +
                  '<div class="campo"><label for="s-quota">Quota annuale predefinita (€)</label>' +
                    '<input type="text" id="s-quota" value="' + quotaSuggerita + '"></div>' +
                  '<div class="avviso-box">Alla creazione verranno generate le iscrizioni ' +
                    'per tutti i soci attivi, con quota versata a zero. Le stagioni precedenti ' +
                    'non vengono modificate.</div>' +
                  '<button class="btn btn-primario btn-largo" id="btn-crea-stagione" ' +
                    'style="margin-top:12px">Crea stagione</button>' +
                '</div>'
              : '') +
          '</div>');

        document.getElementById('btn-apri-form').addEventListener('click', function () {
          formAperto = !formAperto;
          render();
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-attiva]'), function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-attiva');
            var s = ctx.stagioni.filter(function (x) { return x.id === id; })[0];
            C.conferma({
              titolo: 'Cambiare stagione attiva?',
              testo: 'La stagione ' + s.nome + ' diventerà quella attiva. ' +
                     'Nessun dato viene modificato o cancellato.',
              conferma: 'Rendi attiva'
            }).then(function (si) {
              if (!si) return;
              App.core.stagione.attivaStagione(id).then(function () {
                C.toast('Stagione attiva: ' + s.nome);
                render();
              }).catch(function (e) { C.toast(e.message, 'errore'); });
            });
          });
        });

        var btnCrea = document.getElementById('btn-crea-stagione');
        if (btnCrea) btnCrea.addEventListener('click', function () {
          var quota = Q.parseEuroInCent(document.getElementById('s-quota').value);
          var campi = {
            nome: document.getElementById('s-nome').value,
            dataInizio: document.getElementById('s-inizio').value || null,
            dataFine: document.getElementById('s-fine').value || null,
            quotaAnnualePredefinitaCent: quota
          };
          var errori = App.core.stagione.validaStagione(campi, ctx.stagioni);
          if (errori.length) {
            document.getElementById('err-stagione').textContent = errori.join(' ');
            return;
          }
          App.core.stagione.creaStagione(campi).then(function (r) {
            formAperto = false;
            C.toast('Stagione creata: ' + r.iscrizioniCreate + ' iscrizioni generate.');
            render();
          }).catch(function (e) {
            document.getElementById('err-stagione').textContent = e.message;
          });
        });
      });
    });
  }

  App.ui.viste.stagioni = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
