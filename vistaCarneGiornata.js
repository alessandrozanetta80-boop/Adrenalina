(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function euro(cent) { return App.core.quote.formattaEuro(cent); }

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
  }

  // Schermata "Gestisci carne" di una singola battuta.
  function render(params) {
    var C = App.ui.componenti;
    var K = App.core.carne;
    var V = App.ui.viste.giornate;

    return App.core.carne.perGiornata(params.id).then(function (r) {
      if (r) return { modo: 'lotto', r: r };
      return App.core.giornata.scheda(params.id).then(function (s) {
        return { modo: 'nuovo', scheda: s };
      });
    }).then(function (pacchetto) {
      if (pacchetto.modo === 'nuovo') return registraCarne(pacchetto.scheda, params);
      return gestisci(pacchetto.r, params);
    });

    // ---------- primo inserimento: si fissa lo snapshot ----------
    function registraCarne(scheda, params2) {
      if (!scheda) { C.erroreSchermo('Giornata non trovata.'); return; }
      var g = scheda.giornata;
      return App.core.carne.presentiDiGiornata(g.id).then(function (presenti) {
        C.intestazione({
          titolo: 'Carne della battuta',
          sotto: V.giornoSettimana(g.data) + ' ' + C.formattaData(g.data) +
            (g.zona ? ' · ' + g.zona : ''),
          indietro: '#/giornata/' + g.id
        });

        if (!presenti.length) {
          C.monta('<div class="avviso-box">Nessun partecipante segnato come presente. ' +
            'Registra prima i partecipanti alla battuta: la carne si divide fra loro.</div>' +
            '<div class="sezione"><button class="btn btn-contorno" data-vai="#/giornata/' +
            C.esc(g.id) + '">Torna alla giornata</button></div>');
          return;
        }

        C.monta(
          '<div class="sezione">' +
            '<p class="nota-piccola">La carne netta non si ricava dal peso dei capi: ' +
            'va pesata e inserita a mano. Verrà divisa fra i ' + presenti.length +
            ' partecipanti presenti oggi, e questa divisione resterà fissa anche se ' +
            'le presenze verranno corrette in seguito.</p>' +
            '<div class="campo"><label for="c-peso">Carne netta disponibile (kg)</label>' +
              '<input type="text" inputmode="decimal" id="c-peso" placeholder="es. 100">' +
              '<div class="errore" id="err-c-peso"></div></div>' +
            '<div class="campo"><label for="c-note">Note</label>' +
              '<textarea id="c-note"></textarea></div>' +
          '</div>' +
          '<div class="sezione">' +
            '<h3>Partecipanti alla battuta<span class="contatore">' + presenti.length + '</span></h3>' +
            '<div class="lista">' + presenti.map(function (m) {
              return '<div class="voce"><span class="principale">' +
                '<span class="titolo">' + C.esc(C.nomeCompleto(m)) + '</span></span></div>';
            }).join('') + '</div>' +
          '</div>' +
          '<div class="sezione">' +
            '<button class="btn btn-azione" id="btn-salva-carne">Registra carne</button>' +
          '</div>');

        var inCorso = false;
        document.getElementById('btn-salva-carne').addEventListener('click', function () {
          if (inCorso) return;
          var bottone = this;
          var grammi = K.parseKgInGrammi(document.getElementById('c-peso').value);
          var err = document.getElementById('err-c-peso');
          err.textContent = '';
          if (grammi === null || grammi <= 0) {
            err.textContent = 'Indica un peso maggiore di zero, per esempio 100.';
            return;
          }
          inCorso = true;
          bottone.disabled = true;
          bottone.setAttribute('aria-busy', 'true');
          Promise.resolve().then(function () {
            return App.core.carne.creaLotto(g.id, {
              pesoNettoDisponibileGrammi: grammi,
              note: document.getElementById('c-note').value
            });
          }).then(function () {
            C.toast('Carne registrata.');
            App.ui.router.vai('#/giornata/' + g.id + '/carne');
          }).catch(function (e) {
            inCorso = false;
            bottone.disabled = false;
            bottone.setAttribute('aria-busy', 'false');
            if (e.errori && e.errori.pesoNettoDisponibileGrammi) {
              err.textContent = e.errori.pesoNettoDisponibileGrammi;
            } else C.toast(e.message, 'errore');
          });
        });
      });
    }

    // ---------- gestione del lotto esistente ----------
    function gestisci(r, params2) {
      var g = r.giornata;
      var quota = r.numeroPartecipanti
        ? Math.floor(r.disponibileGrammi / r.numeroPartecipanti) : 0;
      var creditoPerPersona = r.numeroPartecipanti
        ? Math.floor(r.vendutoGrammi / r.numeroPartecipanti) : 0;

      C.intestazione({
        titolo: 'Carne della battuta',
        sotto: (g ? V.giornoSettimana(g.data) + ' ' + C.formattaData(g.data) : '') +
          (g && g.zona ? ' · ' + g.zona : ''),
        indietro: '#/giornata/' + (g ? g.id : '')
      });

      C.monta(
        '<div class="sezione">' +
          '<div class="strip-carne">' +
            '<div><b>' + C.esc(K.formattaKg(r.disponibileGrammi)) + '</b>' +
              '<span>carne netta</span></div>' +
            '<div><b>' + r.numeroPartecipanti + '</b><span>partecipanti</span></div>' +
            '<div><b>' + C.esc(K.formattaKg(quota)) + '</b><span>quota a testa</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="sezione">' +
          '<h3>Vendite<span class="contatore">' +
            C.esc(K.formattaKg(r.vendutoGrammi)) + '</span></h3>' +
          (r.vendite.length
            ? '<div class="lista">' + r.vendite.map(function (v) {
                return '<div class="voce voce-vendita' + (v.annullata ? ' annullata' : '') + '">' +
                  '<span class="principale">' +
                    '<span class="alta">' +
                      '<span class="titolo">' +
                        C.esc(App.costanti.etichettaTaglio(v.tipoTaglio)) + '</span>' +
                      '<span class="importo">' +
                        C.esc(euro(K.ricavoCent(v.pesoGrammi, v.prezzoCentKg))) + '</span>' +
                    '</span>' +
                    '<span class="sotto">' + C.esc(K.formattaKg(v.pesoGrammi)) + ' × ' +
                      C.esc(euro(v.prezzoCentKg)) + '/kg · ' +
                      C.esc(C.formattaData(v.data)) +
                      (v.annullata ? ' · annullata' : '') + '</span>' +
                  '</span>' +
                  '<button class="mini" data-vendita="' + C.esc(v.id) + '">' +
                    (v.annullata ? 'Ripristina' : 'Annulla') + '</button>' +
                '</div>';
              }).join('') + '</div>'
            : '<p class="nota-piede">Nessuna vendita registrata.</p>') +
          '<button class="btn btn-contorno" data-vai="#/giornata/' + C.esc(g ? g.id : '') +
          '/carne/vendita" style="margin-top:12px">+ Aggiungi vendita</button>' +
        '</div>' +

        (r.ritiri.length
          ? '<div class="sezione"><h3>Ritiri dal lotto<span class="contatore">' +
            C.esc(K.formattaKg(r.ritiratoGrammi)) + '</span></h3>' +
            '<div class="lista">' + r.ritiri.map(function (x) {
              var m = r.partecipanti.filter(function (p) {
                return p.membro.id === x.membroId; })[0];
              return '<div class="voce"><span class="principale">' +
                '<span class="titolo">' +
                  (m ? C.esc(C.nomeCompleto(m.membro)) : 'Socio') + '</span>' +
                '<span class="sotto">' + C.esc(K.formattaKg(x.pesoGrammi)) + ' · ' +
                  C.esc(C.formattaData(x.data)) +
                  (x.annullato ? ' · annullato' : '') + '</span>' +
              '</span></div>';
            }).join('') + '</div></div>'
          : '') +

        '<div class="sezione"><h3>Riepilogo</h3>' +
          '<div class="card"><dl class="dettaglio">' +
            riga('Disponibile', C.esc(K.formattaKg(r.disponibileGrammi))) +
            riga('Venduto', C.esc(K.formattaKg(r.vendutoGrammi))) +
            riga('Ritirato a credito', C.esc(K.formattaKg(r.ritiratoGrammi))) +
            (r.salaminiGrammi
              ? riga('Salamini', C.esc(K.formattaKg(r.salaminiGrammi))) : '') +
            (r.consegnatoGrammi
              ? riga('Consegnato senza diritto',
                  C.esc(K.formattaKg(r.consegnatoGrammi))) : '') +
            riga('Residuo', '<strong>' + C.esc(K.formattaKg(r.residuoGrammi)) + '</strong>') +
            riga('Ricavo', '<strong>' + C.esc(euro(r.ricavoTotaleCent)) + '</strong>') +
            riga('Credito maturato', C.esc(K.formattaKg(creditoPerPersona)) + ' a testa') +
          '</dl></div>' +
          '<p class="nota-piccola">Il credito nasce dalla carne effettivamente venduta: ' +
          'chi ha partecipato potrà ritirarne altrettanta.</p>' +
        '</div>' +

        '<div class="sezione"><h3>Ripartizione</h3>' +
          '<p class="nota-piccola">' + r.numeroAventiDiritto + ' quote su ' +
            r.numeroPartecipanti + ' presenti.</p>' +
          '<div class="lista">' + r.partecipanti.map(function (p) {
            var nota;
            if (p.inCompensazione) {
              nota = 'in compensazione · scala ' +
                C.esc(K.formattaKg(p.quotaCompensataGrammi));
            } else if (!p.haDiritto) {
              nota = 'fuori dalla divisione';
            } else {
              nota = C.esc(K.formattaKg(p.quotaSpettanteGrammi)) +
                ' · venduto ' + C.esc(K.formattaKg(p.vendutoAttribuitoGrammi));
            }
            return '<div class="voce' +
              (p.inCompensazione || !p.haDiritto ? ' senza-diritto' : '') +
              '"><span class="principale">' +
              '<span class="titolo">' + C.esc(C.nomeCompleto(p.membro)) + '</span>' +
              '<span class="sotto">' + nota + '</span>' +
            '</span>' +
            '<button class="btn-piccolo" data-diritto="' + C.esc(p.membro.id) + '">' +
              (p.haDiritto ? 'Escludi' : 'Includi') + '</button>' +
            '</div>';
          }).join('') + '</div>' +
        '</div>' +

        '<div class="sezione pila">' +
          '<button class="btn btn-contorno" id="btn-salamini">' +
            'Metti da parte per i salamini</button>' +
          '<button class="btn btn-contorno" id="btn-modifica-peso">Correggi carne netta</button>' +
        '</div>');

      // annulla / ripristina una vendita
      Array.prototype.forEach.call(document.querySelectorAll('[data-vendita]'), function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-vendita');
          var v = r.vendite.filter(function (x) { return x.id === id; })[0];
          App.core.carne.impostaVenditaAnnullata(id, !v.annullata).then(function () {
            C.toast(v.annullata ? 'Vendita ripristinata.' : 'Vendita annullata.');
            render(params2);
          }).catch(function (e) { C.toast(e.message, 'errore'); });
        });
      });

      // includi / escludi dalla divisione (ospiti, casi particolari)
      Array.prototype.forEach.call(document.querySelectorAll('[data-diritto]'), function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-diritto');
          var p = r.partecipanti.filter(function (x) { return x.membro.id === id; })[0];
          App.core.carne.impostaDiritto(r.lotto.id, id, !p.haDiritto).then(function () {
            C.toast(p.haDiritto ? 'Escluso dalla divisione.' : 'Incluso nella divisione.');
            render(params2);
          }).catch(function (e) { C.toast(e.message, 'errore'); });
        });
      });

      document.getElementById('btn-salamini').addEventListener('click', function () {
        C.chiediNumero({
          titolo: 'Carne per i salamini',
          testo: 'Esce dal lotto senza passare dalla divisione fra i partecipanti.',
          etichetta: 'Quantità da mettere da parte',
          unita: 'kg',
          valore: '',
          conferma: 'Metti da parte',
          valida: function (v) {
            var g = K.parseKgInGrammi(v);
            if (g === null) return 'Scrivi una quantità, per esempio 12,4.';
            if (g <= 0) return 'La quantità deve essere maggiore di zero.';
            if (g > r.residuoGrammi) {
              return 'Nel lotto restano ' + K.formattaKg(r.residuoGrammi) + '.';
            }
            return null;
          }
        }).then(function (valore) {
          if (valore === null) return;
          return App.core.carne.registraUscita({
            lottoCarneId: r.lotto.id,
            tipoMovimento: 'SALAMINI',
            data: App.core.calendario.oggi(),
            pesoGrammi: K.parseKgInGrammi(valore),
            note: ''
          }).then(function () {
            C.toast('Carne messa da parte per i salamini.');
            render(params2);
          });
        }).catch(function (e) { C.toast(e.message, 'errore'); });
      });

      document.getElementById('btn-modifica-peso').addEventListener('click', function () {
        var minimo = r.vendutoGrammi + r.usciteGrammi;
        C.chiediNumero({
          titolo: 'Correggi la carne netta',
          testo: 'Le quote dei partecipanti vengono ricalcolate sugli stessi ' +
            'nomi registrati quel giorno.',
          etichetta: 'Carne netta disponibile',
          unita: 'kg',
          valore: K.kgPerInput(r.disponibileGrammi),
          conferma: 'Salva',
          valida: function (v) {
            var g = K.parseKgInGrammi(v);
            if (g === null) return 'Scrivi una quantità, per esempio 39,7.';
            if (g <= 0) return 'La quantità deve essere maggiore di zero.';
            if (g < minimo) {
              return 'Sono già usciti ' + K.formattaKg(minimo) +
                ': non può scendere sotto.';
            }
            return null;
          }
        }).then(function (valore) {
          if (valore === null) return;
          return App.core.carne.aggiornaPeso(r.lotto.id, K.parseKgInGrammi(valore))
            .then(function () {
              C.toast('Carne netta aggiornata.');
              render(params2);
            });
        }).catch(function (e) { C.toast(e.message, 'errore'); });
      });
    }
  }

  App.ui.viste.carneGiornata = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
