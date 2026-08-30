(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  var SP = App.costanti.STATO_PRESENZA;

  // Ordine dei controlli: gli stati piu' usati per primi.
  var SCELTE = [
    { codice: SP.PRESENTE,    etichetta: 'Presente',    classe: 'presente' },
    { codice: SP.ASSENTE,     etichetta: 'Assente',     classe: 'assente' },
    { codice: SP.LAVORO,      etichetta: 'Lavoro',      classe: 'lavoro' },
    { codice: SP.NON_SEGNATO, etichetta: 'Non segnato', classe: 'nonsegnato' }
  ];

  function aggiornaContatori(righe) {
    var c = { PRESENTE: 0, ASSENTE: 0, LAVORO: 0 };
    righe.forEach(function (r) { if (c[r.stato] !== undefined) c[r.stato]++; });
    var nonSegnati = righe.length - c.PRESENTE - c.ASSENTE - c.LAVORO;
    var set = function (id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('cnt-presenti', c.PRESENTE);
    set('cnt-assenti', c.ASSENTE);
    set('cnt-lavoro', c.LAVORO);
    set('cnt-nonsegnati', nonSegnati);
  }

  function render(params) {
    var C = App.ui.componenti;
    var V = App.ui.viste.giornate;

    return App.core.presenza.perGiornata(params.id).then(function (dati) {
      if (!dati) {
        C.intestazione({ titolo: 'Presenze', indietro: '#/giornate' });
        C.erroreSchermo('Giornata non trovata.');
        return;
      }
      var g = dati.giornata;
      var righe = dati.righe;

      C.intestazione({
        titolo: 'Partecipanti',
        sotto: V.giornoSettimana(g.data) + ' ' + C.formattaData(g.data) +
          (g.zona ? ' · ' + g.zona : ''),
        indietro: '#/giornata/' + g.id
      });

      var contatori =
        '<div class="barra-contatori">' +
          '<div><span class="valore" id="cnt-presenti">0</span><span class="etichetta">Presenti</span></div>' +
          '<div><span class="valore" id="cnt-assenti">0</span><span class="etichetta">Assenti</span></div>' +
          '<div><span class="valore" id="cnt-lavoro">0</span><span class="etichetta">Lavoro</span></div>' +
          '<div><span class="valore" id="cnt-nonsegnati">0</span><span class="etichetta">Non segnati</span></div>' +
        '</div>';

      var elenco = righe.length
        ? righe.map(function (r, i) {
            var ruoli = r.ruoli && r.ruoli.length ? C.etichettaRuoli(r.ruoli) : '';
            return '<div class="card-presenza" data-indice="' + i +
              '" data-occupata="no" aria-busy="false">' +
              '<div class="persona">' +
                '<span class="nome">' + C.esc(C.nomeCompleto(r.membro)) + '</span>' +
                (r.storico ? '<span class="badge">Non attivo</span>' : '') +
                (ruoli ? '<span class="ruoli">' + C.esc(ruoli) + '</span>' : '') +
              '</div>' +
              '<div class="scelte" role="group" aria-label="Stato presenza">' +
                SCELTE.map(function (s) {
                  var attivo = r.stato === s.codice;
                  return '<button type="button" class="scelta ' + s.classe +
                    (attivo ? ' attiva' : '') + '" data-membro="' + C.esc(r.membro.id) +
                    '" data-stato="' + s.codice + '" aria-pressed="' + (attivo ? 'true' : 'false') +
                    '">' + C.esc(s.etichetta) + '</button>';
                }).join('') +
              '</div>' +
            '</div>';
          }).join('')
        : '<div class="vuoto">Nessun socio da segnare per questa giornata.</div>';

      C.monta(
        contatori +
        '<div class="sezione elenco-presenze">' + elenco + '</div>' +
        '<div class="sezione pila">' +
          '<button class="btn btn-largo" data-vai="#/giornata/' + C.esc(g.id) +
          '">Torna alla giornata</button>' +
        '</div>' +
        '<p class="nota-piede">Vista estesa dei partecipanti: ogni tocco viene salvato ' +
        'subito. "Non segnato" rimuove la registrazione del socio per questa giornata.</p>');

      aggiornaContatori(righe);

      // Aggiornamento puntuale: si tocca solo la card interessata,
      // per restare veloci anche con la squadra al completo.
      document.querySelector('.elenco-presenze').addEventListener('click', function (ev) {
        var btn = ev.target;
        while (btn && !btn.getAttribute('data-stato')) {
          btn = btn.parentNode === document.body ? null : btn.parentNode;
          if (!btn || btn === document.body) { btn = null; break; }
        }
        if (!btn) return;

        var membroId = btn.getAttribute('data-membro');
        var stato = btn.getAttribute('data-stato');
        var card = btn.parentNode.parentNode;

        // Due tocchi rapidi sullo stesso socio avvierebbero due scritture
        // sulla stessa coppia giornata+membro. Finche' il salvataggio e' in
        // corso la card resta occupata: si bloccano SOLO i suoi quattro
        // pulsanti, il resto della schermata continua a funzionare.
        if (card.getAttribute('data-occupata') === 'si') return;

        var riga = null;
        righe.forEach(function (r) { if (r.membro.id === membroId) riga = r; });
        if (!riga || riga.stato === stato) return;

        var precedente = riga.stato;
        riga.stato = stato;

        function dipingi(codice) {
          Array.prototype.forEach.call(card.querySelectorAll('.scelta'), function (b) {
            var att = b.getAttribute('data-stato') === codice;
            b.classList.toggle('attiva', att);
            b.setAttribute('aria-pressed', att ? 'true' : 'false');
          });
        }
        function occupa(si) {
          card.setAttribute('data-occupata', si ? 'si' : 'no');
          card.setAttribute('aria-busy', si ? 'true' : 'false');
          Array.prototype.forEach.call(card.querySelectorAll('.scelta'), function (b) {
            b.disabled = si;
          });
        }

        occupa(true);
        dipingi(stato);
        aggiornaContatori(righe);

        App.core.presenza.imposta(g.id, membroId, stato).then(function () {
          occupa(false);
        }).catch(function (e) {
          riga.stato = precedente;
          dipingi(precedente);
          aggiornaContatori(righe);
          occupa(false);
          C.toast(e.message, 'errore');
        });
      });
    });
  }

  App.ui.viste.presenze = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
