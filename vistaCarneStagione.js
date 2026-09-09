(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function euro(cent) { return App.core.quote.formattaEuro(cent); }

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
  }

  // ---------- schede delle battute con capi ----------
  //
  // Ogni battuta in cui e' stato abbattuto qualcosa compare qui da sola:
  // i capi arrivano dagli abbattimenti, i presenti dalle presenze. Da
  // questa stessa schermata si registra la carne ricavata, si aggiunge
  // una vendita e si segna un ritiro, senza rientrare nella giornata.
  // Le battute si dividono in tre gruppi, perche' tre sono le cose che
  // si possono fare: registrare la carne, lavorarla, o solo consultarla.
  //   DA LAVORARE   capi abbattuti, carne netta ancora da pesare
  //   DISPONIBILE   c'e' ancora carne da vendere o ritirare
  //   STORICO       tutto esaurito: resta il conto
  function gruppo(battute, titolo, nota, vuoto, C, K) {
    if (!battute.length) {
      return vuoto
        ? '<div class="sezione"><h3>' + titolo + '</h3>' +
          '<p class="nota-piccola">' + vuoto + '</p></div>'
        : '';
    }
    return '<div class="sezione"><h3>' + titolo +
      '<span class="contatore">' + battute.length + '</span></h3>' +
      (nota ? '<p class="nota-piccola">' + nota + '</p>' : '') +
      schedeBattute(battute, C, K) + '</div>';
  }

  function schedeBattute(battute, C, K) {
    return battute.map(function (b) {
        var g = b.giornata;
        var manca = !b.carneRegistrata;

        var elencoCapi = b.capi.map(function (a) {
          return '<div class="dettaglio-riga"><dt>' + C.esc(a.codiceCapo) + '</dt>' +
            '<dd>' + C.esc(K.formattaKg(a.pesoGrammi || 0)) + '</dd></div>';
        }).join('');

        return '<div class="card scheda-battuta" style="margin-bottom:14px">' +
          '<h4 class="titolo-battuta">' + C.esc(C.formattaData(g.data)) +
            (g.zona ? ' · ' + C.esc(g.zona) : '') + '</h4>' +

          '<dl class="dettaglio">' +
            elencoCapi +
            riga('<strong>Totale abbattuto</strong>',
              '<strong>' + C.esc(K.formattaKg(b.pesoCapiGrammi)) + '</strong>') +
            riga('Partecipanti presenti', String(b.numeroPresenti)) +
          '</dl>' +

          (manca
            ? '<p class="nota-piccola">Carne ricavata non ancora registrata: ' +
              'senza quel dato non si può dividere niente.</p>' +
              C.seModifica(
                '<button class="btn btn-azione btn-largo" data-carne-nuova="' +
                C.esc(g.id) + '">Registra carne ricavata</button>')
            : '<dl class="dettaglio">' +
                riga('<strong>Carne ricavata</strong>',
                  '<strong>' + C.esc(K.formattaKg(b.disponibileGrammi)) + '</strong>') +
                riga('Quota per partecipante',
                  C.esc(K.formattaKg(b.quotaPerPartecipanteGrammi)) + ' a testa') +
                riga('Venduta', C.esc(K.formattaKg(b.vendutoGrammi))) +
                riga('Ritirata', C.esc(K.formattaKg(b.usciteGrammi))) +
                riga('<strong>Residua</strong>',
                  '<strong>' + C.esc(K.formattaKg(b.residuoGrammi)) + '</strong>') +
                (b.ricavoCent
                  ? riga('Ricavo', C.esc(euro(b.ricavoCent))) : '') +
              '</dl>' +
              (b.vendite.length
                ? '<div class="lista">' + b.vendite.map(function (v) {
                    return '<div class="voce"><span class="principale">' +
                      '<span class="titolo">' + C.esc(K.formattaKg(v.pesoGrammi)) +
                        ' · ' + C.esc(euro(v.prezzoCentKg)) + '/kg</span>' +
                      (v.vendutaDa
                        ? '<span class="sotto">venduta da ' +
                          C.esc(v.vendutaDa) + '</span>'
                        : '') +
                    '</span></div>';
                  }).join('') + '</div>'
                : '') +
              C.seModifica(
                '<div class="pila" style="margin-top:10px">' +
                  '<button class="btn btn-azione" data-vendita="' + C.esc(g.id) +
                    '">Aggiungi vendita</button>' +
                  '<button class="btn btn-contorno" data-ritiro="' + C.esc(g.id) +
                    '">Registra ritiro</button>' +
                  '<button class="btn btn-contorno" data-carne-correggi="' +
                    C.esc(b.lotto.id) + '">Correggi carne ricavata</button>' +
                '</div>')) +
        '</div>';
      }).join('');
  }

  // ---------- riepilogo di stagione ----------
  function render() {
    var C = App.ui.componenti;
    var K = App.core.carne;

    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.stagioneAttiva) {
        C.intestazione({ titolo: 'Carne', sotto: 'Nessuna stagione attiva', indietro: '#/home' });
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2></div>');
        return;
      }
      return Promise.all([
        App.core.carne.riepilogoStagione(ctx.stagioneAttiva.id),
        App.core.carne.giornateConCapi(ctx.stagioneAttiva.id)
      ]).then(function (risultati) {
        var r = risultati[0];
        var battute = risultati[1];
        C.intestazione({
          titolo: 'Carne',
          sotto: 'Stagione ' + ctx.stagioneAttiva.nome,
          indietro: '#/home'
        });

        var t = r.totali;
        // Tre gruppi, in ordine di urgenza.
        var daLavorare = battute.filter(function (b) { return !b.carneRegistrata; });
        var disponibili = battute.filter(function (b) {
          return b.carneRegistrata && b.residuoGrammi > 0;
        });
        var storico = battute.filter(function (b) {
          return b.carneRegistrata && b.residuoGrammi <= 0;
        });

        C.monta(
          // a. riepilogo generale
          '<div class="sezione">' +
            '<div class="card"><dl class="dettaglio">' +
              riga('Carne netta registrata', C.esc(K.formattaKg(t.disponibileGrammi))) +
              riga('Venduta', C.esc(K.formattaKg(t.vendutoGrammi))) +
              riga('Ritirata', C.esc(K.formattaKg(t.ritiratoGrammi))) +
              riga('Residua', C.esc(K.formattaKg(t.residuoGrammi))) +
              riga('Ricavi carne', '<strong>' + C.esc(euro(t.ricavoTotaleCent)) + '</strong>') +
            '</dl></div>' +
          '</div>' +

          // b. azioni rapide: le due cose che si fanno ogni volta
          C.seModifica(
            '<div class="sezione pila azioni-rapide">' +
              '<button class="btn btn-azione btn-largo" id="btn-vendita-rapida"' +
                (disponibili.length ? '' : ' disabled') + '>Registra vendita</button>' +
              '<button class="btn btn-contorno btn-largo" id="btn-ritiro-rapido"' +
                (disponibili.length ? '' : ' disabled') + '>Registra ritiro</button>' +
              (disponibili.length ? '' :
                '<p class="nota-piccola">Nessun lotto con carne disponibile: ' +
                'registra prima la carne ricavata da una battuta.</p>') +
            '</div>') +

          // c. da lavorare
          gruppo(daLavorare, 'Da lavorare',
            'Capi abbattuti, carne netta ancora da registrare.',
            battute.length ? '' : 'Nessun capo abbattuto in questa stagione: ' +
              'non c\u2019è ancora carne da dividere.', C, K) +

          // d. carne disponibile
          gruppo(disponibili, 'Carne disponibile', '', '', C, K) +

          // Chi ha venduto cosa: il registro delle vendite per persona.
          (r.venditori && r.venditori.length
            ? '<div class="sezione">' +
                '<h3>Chi ha venduto<span class="contatore">' +
                  C.esc(K.formattaKg(t.vendutoGrammi)) + '</span></h3>' +
                '<div class="lista">' + r.venditori.map(function (v) {
                  return '<div class="voce">' +
                    '<span class="principale">' +
                      '<span class="titolo">' + C.esc(v.nome) + '</span>' +
                      '<span class="sotto">' + v.vendite +
                        (v.vendite === 1 ? ' vendita' : ' vendite') + '</span>' +
                    '</span>' +
                    '<span class="coda"><strong>' + C.esc(K.formattaKg(v.pesoGrammi)) +
                      '</strong><br>' + C.esc(euro(v.ricavoCent)) + '</span>' +
                  '</div>';
                }).join('') + '</div>' +
              '</div>'
            : '') +

          // f. situazione soci, sotto le funzioni operative
          '<div class="sezione">' +
            '<h3>Soci<span class="contatore">obbligo ' +
              C.esc(K.formattaKg(r.obbligoGrammi)) + '</span></h3>' +
            '<p class="nota-piccola">La vendita per la squadra e il credito carne sono ' +
            'due conti distinti: raggiungere l\u2019obbligo non consuma il credito.</p>' +
            '<div class="lista">' + r.soci.map(function (s) {
              return '<div class="voce voce-carne-socio">' +
                '<span class="principale">' +
                  '<span class="titolo">' + C.esc(C.nomeCompleto(s.membro)) + '</span>' +
                  '<span class="sotto">' +
                    'Vendita ' + C.esc(K.formattaKg(s.vendutoAttribuitoGrammi)) + ' / ' +
                    C.esc(K.formattaKg(s.obbligoGrammi)) +
                    (s.obbligoRaggiunto
                      ? ' <span class="ok-testo">\u2713</span>'
                      : ' · restano ' + C.esc(K.formattaKg(s.residuoObbligoGrammi))) +
                    (s.eccedenzaVenditaGrammi
                      ? ' · eccedenza ' + C.esc(K.formattaKg(s.eccedenzaVenditaGrammi))
                      : '') +
                  '</span>' +
                  '<span class="sotto">Credito carne ' +
                    C.esc(K.formattaKg(s.creditoDisponibileGrammi)) +
                    (s.creditoRitiratoGrammi
                      ? ' (ritirati ' + C.esc(K.formattaKg(s.creditoRitiratoGrammi)) + ')'
                      : '') +
                  '</span>' +
                '</span>' +
              '</div>';
            }).join('') + '</div>' +
          '</div>' +

          // g. storico: battute esaurite
          gruppo(storico, 'Storico', 'Battute con la carne tutta distribuita.',
            '', C, K) +

          C.seModifica(
            '<div class="sezione">' +
              '<button class="btn btn-contorno" data-vai="#/carne/prodotti">' +
              'Configura prodotti e prezzi</button>' +
            '</div>'));

        collegaAzioniBattute(battute, C, K);
        collegaAzioniRapide(disponibili, C, K);
      });
    });
  }

  // Le due azioni rapide in cima alla pagina. Se c'e' una sola battuta
  // con carne disponibile ci si va dritti; se ce ne sono piu' di una la
  // si sceglie, senza uscire da qui.
  function collegaAzioniRapide(disponibili, C, K) {
    function scegliBattuta(titolo) {
      if (!disponibili.length) return Promise.resolve(null);
      if (disponibili.length === 1) return Promise.resolve(disponibili[0]);
      return C.chiediScelta({
        titolo: titolo,
        testo: 'Da quale battuta esce questa carne?',
        opzioni: disponibili.map(function (b) {
          return {
            valore: b.giornata.id,
            etichetta: C.formattaData(b.giornata.data) +
              (b.giornata.zona ? ' · ' + b.giornata.zona : '') +
              ' — restano ' + K.formattaKg(b.residuoGrammi)
          };
        })
      }).then(function (id) {
        if (!id) return null;
        return disponibili.filter(function (b) { return b.giornata.id === id; })[0];
      });
    }

    var vendita = document.getElementById('btn-vendita-rapida');
    if (vendita) {
      vendita.addEventListener('click', function () {
        scegliBattuta('Registra vendita').then(function (b) {
          if (!b) return;
          App.ui.router.vai('#/giornata/' + b.giornata.id + '/carne/vendita');
        });
      });
    }

    var ritiro = document.getElementById('btn-ritiro-rapido');
    if (ritiro) {
      ritiro.addEventListener('click', function () {
        App.ui.router.vai('#/carne/ritiro');
      });
    }
  }

  // Le tre azioni della scheda battuta. Chiedono il minimo indispensabile
  // e restano su questa pagina: e' il senso della schermata.
  function collegaAzioniBattute(battute, C, K) {
    function perGiornata(id) {
      return battute.filter(function (b) { return b.giornata.id === id; })[0];
    }

    function agisci(selettore, fn) {
      Array.prototype.forEach.call(document.querySelectorAll(selettore),
        function (b) {
          b.addEventListener('click', function () {
            b.disabled = true;
            Promise.resolve(fn(b)).then(function (rifatto) {
              if (rifatto === false) { b.disabled = false; return; }
              render();
            }).catch(function (e) {
              b.disabled = false;
              C.toast(e.message, 'errore');
            });
          });
        });
    }

    // 1. carne ricavata: apre il lotto della giornata
    agisci('[data-carne-nuova]', function (b) {
      var battuta = perGiornata(b.getAttribute('data-carne-nuova'));
      return C.chiediNumero({
        titolo: 'Carne ricavata',
        testo: 'Quanti chili sono usciti dal macello per questa battuta? ' +
          'Verranno divisi fra i ' + battuta.numeroPresenti + ' presenti.',
        etichetta: 'Carne netta',
        unita: 'kg',
        valore: '',
        conferma: 'Registra',
        valida: function (v) {
          var g = K.parseKgInGrammi(v);
          if (g === null) return 'Scrivi una quantità, per esempio 100.';
          if (g <= 0) return 'La quantità deve essere maggiore di zero.';
          return null;
        }
      }).then(function (valore) {
        if (valore === null) return false;
        return K.creaLotto(battuta.giornata.id, {
          pesoNettoDisponibileGrammi: K.parseKgInGrammi(valore), note: ''
        }).then(function () { C.toast('Carne registrata.'); });
      });
    });

    // 2. correzione della carne ricavata
    agisci('[data-carne-correggi]', function (b) {
      var lottoId = b.getAttribute('data-carne-correggi');
      var battuta = battute.filter(function (x) {
        return x.lotto && x.lotto.id === lottoId;
      })[0];
      var minimo = battuta.vendutoGrammi + battuta.usciteGrammi;
      return C.chiediNumero({
        titolo: 'Correggi la carne ricavata',
        testo: 'Le quote dei partecipanti vengono ricalcolate.',
        etichetta: 'Carne netta',
        unita: 'kg',
        valore: K.kgPerInput(battuta.disponibileGrammi),
        conferma: 'Salva',
        valida: function (v) {
          var g = K.parseKgInGrammi(v);
          if (g === null) return 'Scrivi una quantità, per esempio 100.';
          if (g < minimo) {
            return 'Sono già usciti ' + K.formattaKg(minimo) +
              ': non può scendere sotto.';
          }
          return null;
        }
      }).then(function (valore) {
        if (valore === null) return false;
        return K.aggiornaPeso(lottoId, K.parseKgInGrammi(valore))
          .then(function () { C.toast('Carne aggiornata.'); });
      });
    });

    // 3. vendita: usa sempre il form completo. Niente scorciatoie che
    // inventano tipo o prezzo: chi vende sceglie socio, prodotto, kg e €/kg.
    Array.prototype.forEach.call(document.querySelectorAll('[data-vendita]'),
      function (b) {
        b.addEventListener('click', function () {
          App.ui.router.vai('#/giornata/' +
            b.getAttribute('data-vendita') + '/carne/vendita');
        });
      });

    // 4. ritiro: chi si porta a casa la sua parte
    agisci('[data-ritiro]', function (b) {
      var battuta = perGiornata(b.getAttribute('data-ritiro'));
      var presenti = battuta.presenti;
      if (!presenti.length) {
        C.toast('Nessun partecipante segnato in questa battuta.', 'errore');
        return false;
      }
      return C.chiediScelta({
        titolo: 'Chi ritira?',
        opzioni: presenti.map(function (m) {
          return { valore: m.id, etichetta: C.nomeCompleto(m) };
        }),
        conferma: 'Continua'
      }).then(function (membroId) {
        if (!membroId) return false;
        return C.chiediNumero({
          titolo: 'Quanto ritira?',
          testo: 'Nel lotto restano ' + K.formattaKg(battuta.residuoGrammi) + '.',
          etichetta: 'Quantità ritirata',
          unita: 'kg',
          valore: '',
          conferma: 'Registra ritiro',
          valida: function (v) {
            var g = K.parseKgInGrammi(v);
            if (g === null) return 'Scrivi una quantità, per esempio 2.';
            if (g <= 0) return 'La quantità deve essere maggiore di zero.';
            if (g > battuta.residuoGrammi) {
              return 'Nel lotto restano ' + K.formattaKg(battuta.residuoGrammi) + '.';
            }
            return null;
          }
        }).then(function (peso) {
          if (peso === null) return false;
          return K.registraUscita({
            lottoCarneId: battuta.lotto.id,
            membroId: membroId,
            stagioneId: battuta.giornata.stagioneId,
            tipoMovimento: 'RITIRO_CREDITO',
            data: App.core.calendario.oggi(),
            pesoGrammi: K.parseKgInGrammi(peso),
            note: ''
          }).then(function () { C.toast('Ritiro registrato.'); });
        });
      });
    });
  }

  // ---------- form ritiro credito ----------
  function renderRitiro() {
    var C = App.ui.componenti;
    var K = App.core.carne;

    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.stagioneAttiva) { C.erroreSchermo('Nessuna stagione attiva.'); return; }
      var idStagione = ctx.stagioneAttiva.id;

      return Promise.all([
        App.core.carne.riepilogoStagione(idStagione),
        App.data.lottiCarne.perStagione(idStagione),
        App.data.giornate.perStagione(idStagione)
      ]).then(function (res) {
        var rs = res[0];
        var lotti = res[1];
        var giornatePerId = {};
        res[2].forEach(function (g) { giornatePerId[g.id] = g; });

        C.intestazione({
          titolo: 'Ritiro carne',
          sotto: 'Stagione ' + ctx.stagioneAttiva.nome,
          indietro: '#/carne'
        });

        if (!lotti.length) {
          C.monta('<div class="avviso-box">Non c\u2019è ancora nessun lotto di carne ' +
            'da cui prelevare.</div>');
          return;
        }

        var sociConCredito = rs.soci.filter(function (s) {
          return s.creditoDisponibileGrammi > 0;
        });
        if (!sociConCredito.length) {
          C.monta('<div class="avviso-box">Nessun socio ha credito carne disponibile: ' +
            'il credito nasce dalla carne venduta.</div>');
          return;
        }

        // I riepiloghi servono a mostrare i due limiti prima del salvataggio.
        var perSocio = {};
        rs.soci.forEach(function (s) { perSocio[s.membro.id] = s; });
        var residuoPerLotto = {};

        return Promise.all(lotti.map(function (l) {
          return App.core.carne.riepilogoLotto(l.id);
        })).then(function (riepiloghi) {
          riepiloghi.forEach(function (rl) { residuoPerLotto[rl.lotto.id] = rl.residuoGrammi; });

          var opzioniSocio = sociConCredito.map(function (s) {
            return '<option value="' + C.esc(s.membro.id) + '">' +
              C.esc(C.nomeCompleto(s.membro)) + '</option>';
          }).join('');

          var opzioniLotto = lotti.map(function (l) {
            var g = giornatePerId[l.giornataId];
            return '<option value="' + C.esc(l.id) + '">' +
              (g ? C.esc(C.formattaData(g.data)) + (g.zona ? ' — ' + C.esc(g.zona) : '') : 'Lotto') +
            '</option>';
          }).join('');

          C.monta(
            '<div class="sezione">' +
              '<div class="campo"><label for="r-socio">Socio</label>' +
                '<select id="r-socio">' + opzioniSocio + '</select>' +
                '<div class="errore" id="err-r-socio"></div></div>' +
              '<div class="campo"><label for="r-lotto">Lotto da cui prelevare</label>' +
                '<select id="r-lotto">' + opzioniLotto + '</select></div>' +
              '<div class="riquadro-limiti">' +
                '<div><span>Credito disponibile</span>' +
                  '<b id="lim-credito">—</b></div>' +
                '<div><span>Carne residua nel lotto</span>' +
                  '<b id="lim-lotto">—</b></div>' +
              '</div>' +
              '<div class="campo"><label for="r-data">Data</label>' +
                '<input type="date" id="r-data" value="' +
                C.esc(App.core.calendario.oggi()) + '">' +
                '<div class="errore" id="err-r-data"></div></div>' +
              '<div class="campo"><label for="r-peso">Peso (kg)</label>' +
                '<input type="text" inputmode="decimal" id="r-peso" placeholder="es. 4">' +
                '<div class="errore" id="err-r-peso"></div></div>' +
              '<div class="campo"><label for="r-note">Note</label>' +
                '<textarea id="r-note"></textarea></div>' +
            '</div>' +
            '<div class="sezione pila">' +
              '<button class="btn btn-azione" id="btn-salva-ritiro">Registra ritiro</button>' +
              '<button class="btn btn-contorno" data-vai="#/carne">Annulla</button>' +
            '</div>');

          function aggiornaLimiti() {
            var s = perSocio[document.getElementById('r-socio').value];
            var idL = document.getElementById('r-lotto').value;
            document.getElementById('lim-credito').textContent =
              s ? K.formattaKg(s.creditoDisponibileGrammi) : '—';
            document.getElementById('lim-lotto').textContent =
              K.formattaKg(residuoPerLotto[idL] || 0);
          }
          document.getElementById('r-socio').addEventListener('change', aggiornaLimiti);
          document.getElementById('r-lotto').addEventListener('change', aggiornaLimiti);
          aggiornaLimiti();

          var inCorso = false;
          document.getElementById('btn-salva-ritiro').addEventListener('click', function () {
            if (inCorso) return;
            var bottone = this;
            var campi = {
              membroId: document.getElementById('r-socio').value,
              lottoCarneId: document.getElementById('r-lotto').value,
              data: document.getElementById('r-data').value,
              pesoGrammi: K.parseKgInGrammi(document.getElementById('r-peso').value),
              note: document.getElementById('r-note').value
            };
            document.getElementById('err-r-peso').textContent = '';
            document.getElementById('err-r-data').textContent = '';
            inCorso = true;
            bottone.disabled = true;
            bottone.setAttribute('aria-busy', 'true');
            Promise.resolve()
              .then(function () { return App.core.carne.registraRitiro(campi); })
              .then(function () {
                C.toast('Ritiro registrato.');
                App.ui.router.vai('#/carne');
              })
              .catch(function (e) {
                inCorso = false;
                bottone.disabled = false;
                bottone.setAttribute('aria-busy', 'false');
                if (e.errori && e.errori.pesoGrammi) {
                  document.getElementById('err-r-peso').textContent = e.errori.pesoGrammi;
                }
                if (e.errori && e.errori.data) {
                  document.getElementById('err-r-data').textContent = e.errori.data;
                }
                C.toast(e.message, 'errore');
              });
          });
        });
      });
    });
  }

  App.ui.viste.carneStagione = { render: render };
  App.ui.viste.formRitiro = { render: renderRitiro };
})(typeof window !== 'undefined' ? window : globalThis);
