(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function euro(cent) { return App.core.quote.formattaEuro(cent); }

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
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
      return App.core.carne.riepilogoStagione(ctx.stagioneAttiva.id).then(function (r) {
        C.intestazione({
          titolo: 'Carne',
          sotto: 'Stagione ' + ctx.stagioneAttiva.nome,
          indietro: '#/home'
        });

        var t = r.totali;
        C.monta(
          '<div class="sezione">' +
            '<div class="card"><dl class="dettaglio">' +
              riga('Carne netta registrata', C.esc(K.formattaKg(t.disponibileGrammi))) +
              riga('Venduta', C.esc(K.formattaKg(t.vendutoGrammi))) +
              riga('Ritirata', C.esc(K.formattaKg(t.ritiratoGrammi))) +
              riga('Residua', C.esc(K.formattaKg(t.residuoGrammi))) +
              riga('Ricavi carne', '<strong>' + C.esc(euro(t.ricavoTotaleCent)) + '</strong>') +
            '</dl></div>' +
          '</div>' +

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

          C.seModifica(
            '<div class="sezione">' +
              '<button class="btn btn-contorno" data-vai="#/carne/ritiro">' +
              'Registra ritiro carne</button>' +
            '</div>') +

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
          '</div>');
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
