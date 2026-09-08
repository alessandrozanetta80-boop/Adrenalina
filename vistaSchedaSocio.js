(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
  }

  function render(params) {
    var C = App.ui.componenti;
    var Q = App.core.quote;
    return App.core.membro.scheda(params.id).then(function (dati) {
      if (!dati) return { dati: null, presenze: 0 };
      var idStag = dati.contesto.stagioneAttiva ? dati.contesto.stagioneAttiva.id : null;
      // Conteggio derivato, calcolato ogni volta dai dati reali.
      return Promise.all([
        idStag ? App.core.presenza.conteggioPresenze(idStag, params.id) : 0,
        idStag ? App.core.carne.riepilogoSocio(idStag, params.id) : null
      ]).then(function (r) {
        return { dati: dati, presenze: r[0], carne: r[1] };
      });
    }).then(function (pacchetto) {
      var dati = pacchetto.dati;
      if (!dati) {
        C.intestazione({ titolo: 'Socio', indietro: '#/soci' });
        C.erroreSchermo('Socio non trovato.');
        return;
      }
      var m = dati.riga.membro;
      var isc = dati.riga.iscrizione;
      var ctx = dati.contesto;

      C.intestazione({ titolo: C.nomeCompleto(m), indietro: '#/soci' });

      var sezioneStagione;
      if (!ctx.stagioneAttiva) {
        sezioneStagione = '<div class="vuoto">Nessuna stagione attiva.</div>';
      } else if (!isc) {
        sezioneStagione =
          '<div class="avviso-box">Questo socio non è iscritto alla stagione ' +
          C.esc(ctx.stagioneAttiva.nome) + '.</div>' +
          C.seModifica(
            '<button class="btn btn-primario" id="btn-iscrivi" style="margin-top:10px">' +
            'Iscrivi alla stagione attiva</button>');
      } else {
        sezioneStagione = '<div class="card"><dl class="dettaglio">' +
          riga('Presenze', String(pacchetto.presenze)) +
          riga('Quota prevista', C.esc(Q.formattaEuro(isc.quotaAnnualePrevistaCent))) +
          riga('Quota versata', C.esc(Q.formattaEuro(isc.quotaVersataCent))) +
          riga('Residuo', C.esc(Q.formattaEuro(Q.residuoIscrizione(isc)))) +
          riga('Stato', C.badgeQuota(dati.riga.statoQuota)) +
        '</dl></div>';
      }

      var portoScaduto = C.scaduto(m.scadenzaPortoArmi);

      C.monta(
        '<div class="sezione">' +
          '<div class="badge-riga" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
            C.badgeAttivo(m.attivo) +
            (isc && isc.ospite ? '<span class="badge">Ospite</span>' : '') +
          '</div>' +
        '</div>' +

        '<div class="sezione"><h3>Dati personali</h3><div class="card"><dl class="dettaglio">' +
          riga('Nome', C.esc(m.nome)) +
          riga('Cognome', C.esc(m.cognome)) +
          riga('Data di nascita', C.esc(C.formattaData(m.dataNascita))) +
          riga('Telefono', m.telefono
            ? '<a href="tel:' + C.esc(m.telefono) + '">' + C.esc(m.telefono) + '</a>' : '—') +
          (m.note ? riga('Note', C.esc(m.note)) : '') +
        '</dl></div></div>' +

        '<div class="sezione"><h3>Squadra' +
          (ctx.stagioneAttiva ? ' — stagione ' + C.esc(ctx.stagioneAttiva.nome) : '') +
          '</h3><div class="card"><dl class="dettaglio">' +
          riga('Ruoli venatori', C.esc(isc ? C.etichettaRuoli(isc.ruoliVenatori) : '—')) +
          riga('Attivo', m.attivo ? 'Sì' : 'No') +
          riga('Ospite', isc ? (isc.ospite ? 'Sì' : 'No') : '—') +
        '</dl></div></div>' +

        '<div class="sezione"><h3>Documenti</h3><div class="card"><dl class="dettaglio">' +
          riga("Scadenza porto d'armi",
            C.esc(C.formattaData(m.scadenzaPortoArmi)) +
            (portoScaduto ? ' <span class="badge badge-pericolo">Scaduto</span>' : '')) +
        '</dl></div></div>' +

        '<div class="sezione"><h3>Stagione attiva</h3>' + sezioneStagione + '</div>' +

        // --- carne: due conti distinti, obbligo di vendita e credito ---
        (function () {
          var c = pacchetto.carne;
          if (!c || !ctx.stagioneAttiva) return '';
          var K = App.core.carne;
          return '<div class="sezione"><h3>Carne — stagione ' +
            C.esc(ctx.stagioneAttiva.nome) + '</h3>' +
            '<div class="card"><p class="sotto-titolo">Vendita per la squadra</p>' +
              '<dl class="dettaglio">' +
                riga('Venduti', C.esc(K.formattaKg(c.vendutoAttribuitoGrammi))) +
                riga('Obbligo', C.esc(K.formattaKg(c.obbligoGrammi))) +
                (c.obbligoRaggiunto
                  ? riga('Stato', '<span class="ok-testo">\u2713 Obiettivo raggiunto</span>')
                  : riga('Restano', '<strong>' +
                      C.esc(K.formattaKg(c.residuoObbligoGrammi)) + '</strong>')) +
                (c.eccedenzaVenditaGrammi
                  ? riga('Eccedenza', C.esc(K.formattaKg(c.eccedenzaVenditaGrammi)))
                  : '') +
              '</dl>' +
            '</div>' +
            '<div class="card" style="margin-top:10px">' +
              '<p class="sotto-titolo">Credito carne</p>' +
              '<dl class="dettaglio">' +
                riga('Maturato', C.esc(K.formattaKg(c.creditoMaturatoGrammi))) +
                riga('Ritirato', C.esc(K.formattaKg(c.creditoRitiratoGrammi))) +
                riga('Disponibile', '<strong>' +
                  C.esc(K.formattaKg(c.creditoDisponibileGrammi)) + '</strong>') +
              '</dl>' +
              '<p class="nota-piccola">Il credito è la carne già venduta per conto del ' +
              'socio: resta a sua disposizione anche dopo aver assolto l\u2019obbligo.</p>' +
            '</div>' +
            // Il debito e' il conto opposto: carne ricevuta senza esserci.
            (c.consegnatoSenzaDirittoGrammi
              ? '<div class="card avviso-carne" style="margin-top:10px">' +
                  '<p class="sotto-titolo">Compensazione</p>' +
                  '<dl class="dettaglio">' +
                    riga('Ricevuta senza esserci',
                      C.esc(K.formattaKg(c.consegnatoSenzaDirittoGrammi))) +
                    riga('Già compensata', C.esc(K.formattaKg(c.compensatoGrammi))) +
                    riga('Debito residuo', '<strong>' +
                      C.esc(K.formattaKg(c.debitoCarneGrammi)) + '</strong>') +
                  '</dl>' +
                  '<p class="nota-piccola">' +
                  (c.inCompensazione
                    ? 'Finché il debito non è azzerato il socio resta fuori dalla ' +
                      'divisione, e la quota che gli sarebbe spettata lo riduce.'
                    : 'Debito estinto: il socio rientra nella divisione.') +
                  '</p>' +
                '</div>'
              : '') +
          '</div>';
        })() +

        C.seModifica(
          '<div class="sezione pila">' +
            '<button class="btn btn-primario btn-largo" data-vai="#/socio/' + C.esc(m.id) +
              '/modifica">Modifica</button>' +
            '<button class="btn' + (m.attivo ? '' : ' btn-primario') + '" id="btn-attivo">' +
              (m.attivo ? 'Disattiva socio' : 'Riattiva socio') + '</button>' +
          '</div>' +
          '<p class="nota-piede">I soci non vengono mai cancellati: si disattivano.</p>'));

      var btnIscrivi = document.getElementById('btn-iscrivi');
      var btnAttivo = document.getElementById('btn-attivo');
      if (btnIscrivi) btnIscrivi.addEventListener('click', function () {
        App.core.membro.iscriviAStagioneAttiva(m.id).then(function () {
          C.toast('Socio iscritto alla stagione attiva.');
          render(params);
        }).catch(function (e) { C.toast(e.message, 'errore'); });
      });

      if (btnAttivo) btnAttivo.addEventListener('click', function () {
        if (m.attivo) {
          C.conferma({
            titolo: 'Disattivare il socio?',
            testo: C.nomeCompleto(m) + ' resterà in archivio con tutto lo storico, ' +
                   'ma non comparirà tra i membri attivi.',
            conferma: 'Disattiva',
            pericolo: true
          }).then(function (si) {
            if (!si) return;
            App.core.membro.impostaAttivo(m.id, false).then(function () {
              C.toast('Socio disattivato.');
              render(params);
            });
          });
        } else {
          App.core.membro.impostaAttivo(m.id, true).then(function () {
            C.toast('Socio riattivato.');
            render(params);
          });
        }
      });
    });
  }

  App.ui.viste.schedaSocio = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
