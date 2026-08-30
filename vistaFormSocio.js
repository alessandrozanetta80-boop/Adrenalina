(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function campoTesto(id, etichetta, valore, tipo, aiuto) {
    return '<div class="campo"><label for="' + id + '">' + etichetta + '</label>' +
      '<input type="' + (tipo || 'text') + '" id="' + id + '" value="' +
      App.ui.componenti.esc(valore === null || valore === undefined ? '' : valore) + '">' +
      (aiuto ? '<div class="aiuto">' + aiuto + '</div>' : '') +
      '<div class="errore" id="err-' + id + '"></div></div>';
  }

  function render(params) {
    var C = App.ui.componenti;
    var Q = App.core.quote;
    var nuovo = !params.id;

    var promessa = nuovo
      ? App.core.squadra.contesto().then(function (ctx) { return { contesto: ctx, riga: null }; })
      : App.core.membro.scheda(params.id);

    return promessa.then(function (dati) {
      if (!dati) { C.erroreSchermo('Socio non trovato.'); return; }
      var ctx = dati.contesto;
      var m = dati.riga ? dati.riga.membro : null;
      var isc = dati.riga ? dati.riga.iscrizione : null;
      var quotaPre = ctx.stagioneAttiva ? ctx.stagioneAttiva.quotaAnnualePredefinitaCent : 0;

      var ruoliCorrenti = isc ? isc.ruoliVenatori : [App.costanti.RUOLO_PREDEFINITO];
      var indietro = nuovo ? '#/soci' : '#/socio/' + m.id;

      C.intestazione({
        titolo: nuovo ? 'Nuovo socio' : 'Modifica socio',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: indietro
      });

      var caselleRuoli = App.costanti.RUOLI_VENATORI.map(function (r) {
        var sel = ruoliCorrenti.indexOf(r.codice) !== -1;
        return '<label class="interruttore"><input type="checkbox" name="ruolo" value="' +
          r.codice + '"' + (sel ? ' checked' : '') + '><span>' + C.esc(r.etichetta) +
          '</span></label>';
      }).join('');

      var opzioniLivello = App.costanti.LIVELLI_ACCESSO.map(function (l) {
        var sel = m ? m.livelloAccessoApp === l.codice : l.codice === App.costanti.LIVELLO_PREDEFINITO;
        return '<option value="' + l.codice + '"' + (sel ? ' selected' : '') + '>' +
          C.esc(l.etichetta) + '</option>';
      }).join('');

      C.monta(
        '<div class="sezione"><h3>Dati personali</h3>' +
          '<div class="due-colonne">' +
            campoTesto('f-nome', 'Nome', m ? m.nome : '') +
            campoTesto('f-cognome', 'Cognome', m ? m.cognome : '') +
          '</div>' +
          '<div class="due-colonne">' +
            campoTesto('f-nascita', 'Data di nascita', m ? m.dataNascita : '', 'date') +
            campoTesto('f-telefono', 'Telefono', m ? m.telefono : '', 'tel') +
          '</div>' +
          '<div class="campo"><label for="f-note">Note</label>' +
          '<textarea id="f-note">' + C.esc(m ? m.note : '') + '</textarea></div>' +
        '</div>' +

        '<div class="sezione"><h3>Squadra' +
          (ctx.stagioneAttiva ? ' — stagione ' + C.esc(ctx.stagioneAttiva.nome) : '') + '</h3>' +
          '<div class="campo"><label>Ruoli venatori</label>' +
            '<div class="gruppo-caselle">' + caselleRuoli + '</div>' +
            '<div class="aiuto">Un socio può ricoprire più ruoli nella stessa stagione.</div>' +
            '<div class="errore" id="err-ruoli"></div>' +
          '</div>' +
          '<div class="campo"><label for="f-livello">Livello di accesso app</label>' +
            '<select id="f-livello">' + opzioniLivello + '</select>' +
            '<div class="aiuto">Indipendente dal ruolo venatorio.</div>' +
          '</div>' +
          '<label class="interruttore"><input type="checkbox" id="f-attivo"' +
            (!m || m.attivo ? ' checked' : '') + '><span>Socio attivo</span></label>' +
          '<label class="interruttore"><input type="checkbox" id="f-ospite"' +
            (isc && isc.ospite ? ' checked' : '') + '><span>Ospite in questa stagione</span></label>' +
        '</div>' +

        '<div class="sezione"><h3>Documenti</h3>' +
          campoTesto('f-porto', "Scadenza porto d'armi", m ? m.scadenzaPortoArmi : '', 'date') +
        '</div>' +

        (ctx.stagioneAttiva
          ? '<div class="sezione"><h3>Quota stagione ' + C.esc(ctx.stagioneAttiva.nome) + '</h3>' +
              '<div class="due-colonne">' +
                campoTesto('f-prevista', 'Quota prevista (€)',
                  Q.euroPerInput(isc ? isc.quotaAnnualePrevistaCent : quotaPre), 'text',
                  'Metti 0 se il socio non deve versare quota.') +
                campoTesto('f-versata', 'Quota versata (€)',
                  Q.euroPerInput(isc ? isc.quotaVersataCent : 0), 'text',
                  'Sono ammessi versamenti parziali.') +
              '</div>' +
            '</div>'
          : '<div class="sezione"><div class="avviso-box">Nessuna stagione attiva: ' +
            'ruoli e quote non possono essere registrati.</div></div>') +

        '<div class="sezione pila">' +
          '<button class="btn btn-primario btn-largo" id="btn-salva">Salva</button>' +
          '<button class="btn btn-fantasma" data-vai="' + indietro + '">Annulla</button>' +
        '</div>');

      function leggiCampi() {
        var ruoli = [];
        Array.prototype.forEach.call(
          document.querySelectorAll('input[name="ruolo"]:checked'),
          function (c) { ruoli.push(c.value); });
        var prevista = ctx.stagioneAttiva
          ? Q.parseEuroInCent(document.getElementById('f-prevista').value) : 0;
        var versata = ctx.stagioneAttiva
          ? Q.parseEuroInCent(document.getElementById('f-versata').value) : 0;
        return {
          nome: document.getElementById('f-nome').value,
          cognome: document.getElementById('f-cognome').value,
          dataNascita: document.getElementById('f-nascita').value || null,
          telefono: document.getElementById('f-telefono').value,
          note: document.getElementById('f-note').value,
          livelloAccessoApp: document.getElementById('f-livello').value,
          attivo: document.getElementById('f-attivo').checked,
          ospite: document.getElementById('f-ospite').checked,
          scadenzaPortoArmi: document.getElementById('f-porto').value || null,
          ruoliVenatori: ruoli,
          quotaAnnualePrevistaCent: prevista,
          quotaVersataCent: versata
        };
      }

      function mostraErrori(errori) {
        ['f-nome', 'f-cognome', 'f-prevista', 'f-versata'].forEach(function (id) {
          var e = document.getElementById('err-' + id);
          if (e) e.textContent = '';
        });
        document.getElementById('err-ruoli').textContent = '';
        if (errori.nome) document.getElementById('err-f-nome').textContent = errori.nome;
        if (errori.cognome) document.getElementById('err-f-cognome').textContent = errori.cognome;
        if (errori.ruoliVenatori) document.getElementById('err-ruoli').textContent = errori.ruoliVenatori;
        if (errori.quotaAnnualePrevista && document.getElementById('err-f-prevista'))
          document.getElementById('err-f-prevista').textContent = errori.quotaAnnualePrevista;
        if (errori.quotaVersata && document.getElementById('err-f-versata'))
          document.getElementById('err-f-versata').textContent = errori.quotaVersata;
      }

      document.getElementById('btn-salva').addEventListener('click', function () {
        var campi = leggiCampi();
        var errori = App.core.membro.valida(campi);
        if (Object.keys(errori).length) {
          mostraErrori(errori);
          C.toast('Controlla i campi segnalati.', 'errore');
          return;
        }
        var azione = nuovo
          ? App.core.membro.creaSocio(campi)
          : App.core.membro.aggiornaSocio(m.id, campi);
        azione.then(function (r) {
          C.toast(nuovo ? 'Socio aggiunto.' : 'Modifiche salvate.');
          App.ui.router.vai('#/socio/' + (nuovo ? r.membro.id : m.id));
        }).catch(function (e) {
          if (e.errori) { mostraErrori(e.errori); C.toast('Controlla i campi segnalati.', 'errore'); }
          else C.toast(e.message, 'errore');
        });
      });
    });
  }

  App.ui.viste.formSocio = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
