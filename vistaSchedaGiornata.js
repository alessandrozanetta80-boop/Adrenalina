(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  var SP = App.costanti.STATO_PRESENZA;

  // Come si presenta ogni stato nella riga compatta.
  var SEGNO = {
    PRESENTE:    { simbolo: '\u2713', etichetta: 'Partecipa',   classe: 'presente' },
    ASSENTE:     { simbolo: '\u2715', etichetta: 'Assente',     classe: 'assente' },
    LAVORO:      { simbolo: 'L',      etichetta: 'Lavoro',      classe: 'lavoro' },
    NON_SEGNATO: { simbolo: '',       etichetta: '',            classe: 'nonsegnato' }
  };

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
  }

  function render(params) {
    var C = App.ui.componenti;
    var V = App.ui.viste.giornate;

    return App.core.giornata.scheda(params.id).then(function (dati) {
      if (!dati) return { dati: null, capi: null, partecipanti: null };
      return Promise.all([
        App.core.capo.perGiornata(params.id),
        App.core.presenza.perGiornata(params.id)
      ]).then(function (r) {
        return { dati: dati, capi: r[0], partecipanti: r[1] };
      });
    }).then(function (pacchetto) {
      var dati = pacchetto.dati;
      if (!dati) {
        C.intestazione({ titolo: 'Giornata', indietro: '#/giornate' });
        C.erroreSchermo('Giornata non trovata.');
        return;
      }
      var g = dati.giornata;
      var righe = pacchetto.partecipanti ? pacchetto.partecipanti.righe : [];
      var dellaStagioneAttiva = dati.contesto.stagioneAttiva &&
        dati.contesto.stagioneAttiva.id === g.stagioneId;

      C.intestazione({
        titolo: V.giornoSettimana(g.data) + ' ' + C.formattaData(g.data),
        sotto: dati.stagione ? 'Stagione ' + dati.stagione.nome : '',
        indietro: '#/giornate'
      });

      function contaPartecipanti() {
        var n = 0;
        righe.forEach(function (x) { if (x.stato === SP.PRESENTE) n++; });
        return n;
      }

      function rigaPartecipante(r) {
        var s = SEGNO[r.stato] || SEGNO.NON_SEGNATO;
        var ruoli = r.ruoli && r.ruoli.length ? C.etichettaRuoli(r.ruoli) : '';
        return '<div class="riga-partecipante ' + s.classe + '" data-membro="' +
          C.esc(r.membro.id) + '" data-occupata="no" aria-busy="false">' +
          '<button type="button" class="tocco" aria-pressed="' +
            (r.stato === SP.PRESENTE ? 'true' : 'false') + '">' +
            '<span class="segno">' + s.simbolo + '</span>' +
            '<span class="chi">' +
              '<span class="nome">' + C.esc(C.nomeCompleto(r.membro)) + '</span>' +
              (ruoli || r.storico
                ? '<span class="ruoli">' + C.esc(ruoli) +
                  (r.storico ? (ruoli ? ' · ' : '') + 'non attivo' : '') + '</span>'
                : '') +
            '</span>' +
            '<span class="stato-testo">' + s.etichetta + '</span>' +
          '</button>' +
          '<button type="button" class="altro" aria-label="Altri stati per ' +
            C.esc(C.nomeCompleto(r.membro)) + '" aria-expanded="false">&#8942;</button>' +
          '<div class="altri-stati" hidden>' +
            '<button type="button" data-stato="ASSENTE">Assente</button>' +
            '<button type="button" data-stato="LAVORO">Lavoro</button>' +
            '<button type="button" data-stato="NON_SEGNATO">Non segnato</button>' +
          '</div>' +
        '</div>';
      }

      C.monta(
        // --- A. testata ---
        '<div class="sezione">' +
          '<div class="testata-giornata' +
            (g.stato === 'ANNULLATA' ? ' annullata' : '') + '">' +
            '<div class="riga-alta">' +
              '<div class="quando">' +
                C.esc(V.giornoSettimana(g.data)) + ' ' + C.esc(C.formattaData(g.data)) +
              '</div>' +
              V.badgeStato(g.stato) +
            '</div>' +
            '<div class="titolo">' + C.esc(g.zona || 'Zona non indicata') + '</div>' +
            '<dl class="righe">' +
              '<div><dt>Ritrovo</dt><dd>' +
                (g.orarioRitrovo ? 'ore ' + C.esc(g.orarioRitrovo) : '—') + '</dd></div>' +
              '<div><dt>Capocaccia</dt><dd>' +
                (dati.capocaccia ? C.esc(C.nomeCompleto(dati.capocaccia)) : 'Da assegnare') +
              '</dd></div>' +
            '</dl>' +
          '</div>' +
        '</div>' +

        // --- B. partecipanti alla battuta ---
        '<div class="sezione">' +
          '<h3>Partecipanti alla battuta</h3>' +
          '<div class="conta-partecipanti">' +
            '<span class="valore" id="conta-partecipanti">' + contaPartecipanti() + '</span>' +
            '<span class="totale">/ ' + righe.length + '</span>' +
            '<span class="etichetta">Partecipanti</span>' +
          '</div>' +
          '<p class="nota-piccola">I partecipanti saranno utilizzati per la futura ' +
          'ripartizione della carne.</p>' +
          (righe.length
            ? '<div class="elenco-partecipanti">' + righe.map(rigaPartecipante).join('') + '</div>'
            : '<div class="vuoto">Nessun socio iscritto a questa stagione.</div>') +
          '<a class="collegamento-tenue" href="#/giornata/' + C.esc(g.id) +
          '/presenze">Vista estesa</a>' +
        '</div>' +

        // --- C. abbattimenti ---
        '<div class="sezione"><h3>Abbattimenti</h3><div class="card">' +
          '<p style="margin:0 0 10px"><strong>' + pacchetto.capi.validi + '</strong> cap' +
          (pacchetto.capi.validi === 1 ? 'o valido' : 'i validi') + ' in questa giornata.</p>' +
          (pacchetto.capi.tutti.length
            ? '<ul class="elenco-capi-giornata">' + pacchetto.capi.tutti.map(function (r) {
                return '<li' + (r.capo.annullato ? ' class="annullato"' : '') + '>' +
                  '<a href="#/capo/' + C.esc(r.capo.id) + '">' +
                    '<span class="riga-alta">' +
                      '<span class="codice">' + C.esc(r.capo.codiceCapo) + '</span>' +
                      '<span class="peso">' +
                        C.esc(App.core.capo.formattaKg(r.capo.pesoGrammi)) + '</span>' +
                    '</span>' +
                    '<span class="riga-bassa">' +
                      '<span class="tir">' +
                        (r.tiratore ? C.esc(C.nomeCompleto(r.tiratore)) : '—') + '</span>' +
                      (r.capo.annullato
                        ? '<span class="badge badge-pericolo badge-annullato">' +
                          '\u2715 Annullato</span>'
                        : '') +
                    '</span>' +
                  '</a>' +
                '</li>';
              }).join('') + '</ul>'
            : '') +
          '<button class="btn btn-largo" data-vai="#/capo/nuovo/' + C.esc(g.id) +
          '" style="margin-top:12px">+ Registra abbattimento</button>' +
        '</div></div>' +

        // --- D. note ---
        (g.note
          ? '<div class="sezione"><h3>Note</h3><div class="card"><p style="margin:0">' +
            C.esc(g.note) + '</p></div></div>'
          : '') +

        // --- E. azione secondaria ---
        '<div class="sezione pila">' +
          '<button class="btn btn-fantasma" data-vai="#/giornata/' + C.esc(g.id) +
            '/modifica">Modifica giornata</button>' +
        '</div>' +

        (dellaStagioneAttiva ? '' :
          '<p class="nota-piede">Questa giornata appartiene a una stagione non attiva.</p>'));

      // ---------- interazione sui partecipanti ----------
      var elenco = document.querySelector('.elenco-partecipanti');
      if (!elenco) return;

      function aggiornaConta() {
        var el = document.getElementById('conta-partecipanti');
        if (el) el.textContent = contaPartecipanti();
      }

      function dipingi(box, stato) {
        var s = SEGNO[stato] || SEGNO.NON_SEGNATO;
        box.className = 'riga-partecipante ' + s.classe;
        box.querySelector('.segno').textContent = s.simbolo;
        box.querySelector('.stato-testo').textContent = s.etichetta;
        box.querySelector('.tocco').setAttribute('aria-pressed',
          stato === SP.PRESENTE ? 'true' : 'false');
      }

      // Un salvataggio per volta sulla stessa persona: due tocchi rapidi
      // non devono avviare due scritture sullo stesso record.
      function applica(box, riga, stato) {
        if (box.getAttribute('data-occupata') === 'si') return;
        if (riga.stato === stato) return;
        var precedente = riga.stato;
        riga.stato = stato;

        function occupa(si) {
          box.setAttribute('data-occupata', si ? 'si' : 'no');
          box.setAttribute('aria-busy', si ? 'true' : 'false');
          Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
            b.disabled = si;
          });
        }
        occupa(true);
        dipingi(box, stato);
        aggiornaConta();

        App.core.presenza.imposta(g.id, riga.membro.id, stato).then(function () {
          occupa(false);
        }).catch(function (e) {
          riga.stato = precedente;
          dipingi(box, precedente);
          aggiornaConta();
          occupa(false);
          C.toast(e.message, 'errore');
        });
      }

      elenco.addEventListener('click', function (ev) {
        var el = ev.target;
        var box = null;
        while (el && el !== elenco) {
          if (el.classList && el.classList.contains('riga-partecipante')) { box = el; break; }
          el = el.parentNode;
        }
        if (!box) return;

        var membroId = box.getAttribute('data-membro');
        var riga = null;
        righe.forEach(function (x) { if (x.membro.id === membroId) riga = x; });
        if (!riga) return;

        // stato scelto dal menu secondario
        var bottone = ev.target;
        while (bottone && bottone !== box && !bottone.getAttribute) bottone = bottone.parentNode;
        var statoScelto = bottone && bottone.getAttribute
          ? bottone.getAttribute('data-stato') : null;
        if (statoScelto) {
          box.querySelector('.altri-stati').hidden = true;
          box.querySelector('.altro').setAttribute('aria-expanded', 'false');
          applica(box, riga, statoScelto);
          return;
        }

        // apertura/chiusura del menu secondario
        var suAltro = ev.target.classList && ev.target.classList.contains('altro');
        if (suAltro) {
          var menu = box.querySelector('.altri-stati');
          var apri = menu.hidden;
          menu.hidden = !apri;
          box.querySelector('.altro').setAttribute('aria-expanded', apri ? 'true' : 'false');
          return;
        }

        // azione primaria: partecipa / non partecipa
        applica(box, riga, riga.stato === SP.PRESENTE ? SP.NON_SEGNATO : SP.PRESENTE);
      });
    });
  }

  App.ui.viste.schedaGiornata = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
