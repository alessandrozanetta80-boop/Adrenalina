(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  var V = ['giornataId', 'tiratoreMembroId', 'sesso', 'pesoGrammi', 'classeEta'];

  function render(params) {
    var C = App.ui.componenti;
    var K = App.core.capo;
    var nuovo = !params.id;

    var promessa = nuovo
      ? App.core.squadra.contesto().then(function (ctx) { return { contesto: ctx, capo: null }; })
      : App.core.capo.scheda(params.id).then(function (r) {
          return r ? { contesto: r.contesto, capo: r.capo, stagione: r.stagione } : null;
        });

    return promessa.then(function (dati) {
      if (!dati) { C.erroreSchermo('Abbattimento non trovato.'); return; }
      var ctx = dati.contesto;
      var capo = dati.capo;

      if (nuovo && !ctx.stagioneAttiva) {
        C.intestazione({ titolo: 'Nuovo abbattimento', indietro: '#/abbattimenti' });
        C.monta('<div class="avviso-box">Nessuna stagione attiva: non è possibile ' +
          'registrare un capo.</div>');
        return;
      }

      // I capi si registrano sulle giornate della loro stagione.
      var idStagione = capo ? capo.stagioneId : ctx.stagioneAttiva.id;

      return App.data.giornate.perStagione(idStagione).then(function (giornate) {
        if (nuovo && !giornate.length) {
          C.intestazione({ titolo: 'Nuovo abbattimento', indietro: '#/abbattimenti' });
          C.monta('<div class="avviso-box">Non ci sono giornate in questa stagione. ' +
            'Un capo deve sempre appartenere a una giornata di caccia.</div>' +
            '<div class="sezione pila" style="margin-top:16px">' +
            '<button class="btn btn-primario btn-largo" data-vai="#/giornate">' +
            'Vai alle Giornate</button></div>');
          return;
        }

        giornate.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
        var idGiornataIniziale = capo ? capo.giornataId
          : (params.giornataId && giornate.some(function (g) { return g.id === params.giornataId; })
              ? params.giornataId : giornate[0].id);
        var giornataIniziale = giornate.filter(function (g) {
          return g.id === idGiornataIniziale;
        })[0];

        return Promise.all([
          App.core.capo.candidatiTiratore(giornataIniziale, capo ? capo.tiratoreMembroId : null),
          nuovo ? K.prossimoCodicePerStagione(idStagione) : Promise.resolve(capo.codiceCapo)
        ]).then(function (r) {
          var candidati = r[0];
          var codice = r[1];
          var indietro = nuovo ? '#/abbattimenti' : '#/capo/' + capo.id;
          var stagioneMostrata = capo ? dati.stagione : ctx.stagioneAttiva;

          C.intestazione({
            titolo: nuovo ? 'Nuovo abbattimento' : 'Modifica abbattimento',
            sotto: stagioneMostrata ? 'Stagione ' + stagioneMostrata.nome : '',
            indietro: indietro
          });

          function opzioni(lista, selezionato) {
            return lista.map(function (o) {
              return '<option value="' + C.esc(o.codice) + '"' +
                (o.codice === selezionato ? ' selected' : '') + '>' +
                C.esc(o.etichetta) + '</option>';
            }).join('');
          }

          var opzioniGiornata = giornate.map(function (g) {
            return '<option value="' + C.esc(g.id) + '"' +
              (g.id === idGiornataIniziale ? ' selected' : '') + '>' +
              C.esc(C.formattaData(g.data)) + (g.zona ? ' — ' + C.esc(g.zona) : '') +
            '</option>';
          }).join('');

          var opzioniTiratore = '<option value="">— scegli —</option>' +
            candidati.map(function (m) {
              var sel = capo && capo.tiratoreMembroId === m.id;
              return '<option value="' + C.esc(m.id) + '"' + (sel ? ' selected' : '') + '>' +
                C.esc(C.nomeCompleto(m)) + (m.attivo ? '' : ' (non attivo)') + '</option>';
            }).join('');

          C.monta(
            '<div class="sezione">' +
              '<div class="codice-capo-grande">' +
                '<span class="etichetta">Codice capo</span>' +
                '<span class="valore">' + C.esc(codice) + '</span>' +
                (nuovo ? '<span class="nota">assegnato al salvataggio</span>' : '') +
              '</div>' +
            '</div>' +

            '<div class="sezione"><h3>Giornata</h3>' +
              '<div class="campo"><label for="a-giornata">Giornata di caccia</label>' +
                '<select id="a-giornata">' + opzioniGiornata + '</select>' +
                '<div class="aiuto">La zona viene letta dalla giornata.</div>' +
                '<div class="errore" id="err-a-giornata"></div></div>' +
              '<div class="campo"><label for="a-tiratore">Tiratore</label>' +
                '<select id="a-tiratore">' + opzioniTiratore + '</select>' +
                '<div class="errore" id="err-a-tiratore"></div>' +
                '<div class="avviso-box" id="avviso-tiratore" style="display:none;margin-top:8px">' +
                '</div></div>' +
            '</div>' +

            '<div class="sezione"><h3>Capo</h3>' +
              '<div class="due-colonne">' +
                '<div class="campo"><label for="a-sesso">Sesso</label>' +
                  '<select id="a-sesso">' +
                  opzioni(App.costanti.SESSI, capo ? capo.sesso : 'NON_DETERMINATO') +
                  '</select><div class="errore" id="err-a-sesso"></div></div>' +
                '<div class="campo"><label for="a-classe">Classe di età</label>' +
                  '<select id="a-classe">' +
                  opzioni(App.costanti.CLASSI_ETA, capo ? capo.classeEta : 'NON_DETERMINATA') +
                  '</select><div class="errore" id="err-a-classe"></div></div>' +
              '</div>' +
              '<div class="campo"><label for="a-peso">Peso (kg)</label>' +
                '<input type="text" inputmode="decimal" id="a-peso" value="' +
                (capo ? C.esc(K.kgPerInput(capo.pesoGrammi)) : '') + '">' +
                '<div class="aiuto">Per esempio 85,5.</div>' +
                '<div class="errore" id="err-a-peso"></div></div>' +
              '<div class="campo"><label for="a-cane">Cane / Muta</label>' +
                '<input type="text" id="a-cane" value="' +
                (capo ? C.esc(capo.caneMuta || '') : '') + '">' +
                '<div class="aiuto">Facoltativo.</div></div>' +
              '<div class="campo"><label for="a-note">Note</label>' +
                '<textarea id="a-note">' + (capo ? C.esc(capo.note || '') : '') + '</textarea></div>' +
            '</div>' +

            '<div class="sezione pila">' +
              '<button class="btn btn-primario btn-largo" id="btn-salva-capo">Salva</button>' +
              '<button class="btn btn-fantasma" data-vai="' + indietro + '">Annulla</button>' +
            '</div>');

          function leggiCampi() {
            return {
              giornataId: document.getElementById('a-giornata').value,
              tiratoreMembroId: document.getElementById('a-tiratore').value || null,
              sesso: document.getElementById('a-sesso').value,
              classeEta: document.getElementById('a-classe').value,
              pesoGrammi: K.parseKgInGrammi(document.getElementById('a-peso').value),
              caneMuta: document.getElementById('a-cane').value,
              note: document.getElementById('a-note').value
            };
          }

          function mostraErrori(errori) {
            ['a-giornata', 'a-tiratore', 'a-sesso', 'a-classe', 'a-peso'].forEach(function (id) {
              var e = document.getElementById('err-' + id);
              if (e) e.textContent = '';
            });
            var mappa = {
              giornataId: 'err-a-giornata', tiratoreMembroId: 'err-a-tiratore',
              sesso: 'err-a-sesso', classeEta: 'err-a-classe', pesoGrammi: 'err-a-peso'
            };
            V.forEach(function (k) {
              if (errori[k]) document.getElementById(mappa[k]).textContent = errori[k];
            });
          }

          // Avviso non bloccante: il tiratore risulta assente o in lavoro.
          // Potrebbe essere sbagliata la presenza, non l'abbattimento.
          function aggiornaAvviso() {
            var box = document.getElementById('avviso-tiratore');
            var campi = leggiCampi();
            if (!campi.tiratoreMembroId) { box.style.display = 'none'; return; }
            App.core.capo.avvisoTiratore(campi.giornataId, campi.tiratoreMembroId)
              .then(function (avviso) {
                if (avviso) { box.textContent = avviso; box.style.display = ''; }
                else { box.textContent = ''; box.style.display = 'none'; }
              });
          }

          document.getElementById('a-tiratore').addEventListener('change', aggiornaAvviso);
          document.getElementById('a-giornata').addEventListener('change', aggiornaAvviso);
          aggiornaAvviso();

          // Un doppio tap sul telefono avvierebbe due salvataggi, e su un
          // nuovo capo produrrebbe due record con due codici diversi.
          // Si blocca il solo pulsante Salva finche' la Promise non termina.
          var salvataggioInCorso = false;
          document.getElementById('btn-salva-capo').addEventListener('click', function () {
            if (salvataggioInCorso) return;
            var bottone = document.getElementById('btn-salva-capo');
            var campi = leggiCampi();
            var errori = App.core.capo.valida(campi);
            if (Object.keys(errori).length) {
              mostraErrori(errori);
              C.toast('Controlla i campi segnalati.', 'errore');
              return;
            }

            function occupa(si) {
              salvataggioInCorso = si;
              bottone.disabled = si;
              bottone.setAttribute('aria-busy', si ? 'true' : 'false');
            }
            occupa(true);

            Promise.resolve()
              .then(function () {
                return nuovo ? App.core.capo.crea(campi)
                             : App.core.capo.aggiorna(capo.id, campi);
              })
              .then(function (salvato) {
                // In caso di successo si naviga: il pulsante sparisce con la vista.
                C.toast(nuovo ? 'Capo registrato: ' + salvato.codiceCapo : 'Modifiche salvate.');
                App.ui.router.vai('#/capo/' + salvato.id);
              })
              .catch(function (e) {
                occupa(false);
                if (e.errori) { mostraErrori(e.errori); C.toast('Controlla i campi segnalati.', 'errore'); }
                else C.toast(e.message, 'errore');
              });
          });
        });
      });
    });
  }

  App.ui.viste.formCapo = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
