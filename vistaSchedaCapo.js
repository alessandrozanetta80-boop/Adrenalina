(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + etichetta + '</dt><dd>' + valore + '</dd></div>';
  }

  function render(params) {
    var C = App.ui.componenti;
    var K = App.core.capo;

    return App.core.capo.scheda(params.id).then(function (dati) {
      if (!dati) return { dati: null, controllo: null };
      return App.core.sanitario.perAbbattimento(params.id).then(function (c) {
        return { dati: dati, controllo: c };
      });
    }).then(function (pacchetto) {
      var dati = pacchetto.dati;
      var controllo = pacchetto.controllo;
      if (!dati) {
        C.intestazione({ titolo: 'Capo', indietro: '#/abbattimenti' });
        C.erroreSchermo('Abbattimento non trovato.');
        return;
      }
      var a = dati.capo;
      var g = dati.giornata;

      C.intestazione({
        titolo: a.codiceCapo,
        sotto: dati.stagione ? 'Stagione ' + dati.stagione.nome : '',
        indietro: '#/abbattimenti'
      });

      C.monta(
        '<div class="sezione">' +
          '<div class="testata-capo' + (a.annullato ? ' annullato' : '') + '">' +
            '<div class="riga-alta">' +
              '<div class="codice">' + C.esc(a.codiceCapo) + '</div>' +
              '<div class="peso">' + C.esc(K.formattaKg(a.pesoGrammi)) + '</div>' +
            '</div>' +
            '<div class="sotto">' +
              C.esc(App.costanti.etichettaSesso(a.sesso)) + ' · ' +
              C.esc(App.costanti.etichettaClasseEta(a.classeEta)) +
              (g ? ' · ' + C.esc(C.formattaData(g.data)) : '') +
            '</div>' +
            (a.annullato
              ? '<div class="striscia-annullato">✕ Abbattimento annullato</div>'
              : '') +
          '</div>' +
          '<button class="btn btn-contorno" data-vai="#/capo/' + C.esc(a.id) +
            '/modifica" style="margin-top:12px">Modifica</button>' +
        '</div>' +

        '<div class="sezione"><h3>Giornata</h3><div class="card"><dl class="dettaglio">' +
          riga('Data', C.esc(C.formattaData(g ? g.data : null))) +
          riga('Zona', g && g.zona ? C.esc(g.zona) : '<span class="tenue">Non indicata</span>') +
          riga('Giornata', g
            ? '<a href="#/giornata/' + C.esc(g.id) + '">Apri la giornata</a>'
            : '<span class="tenue">Non trovata</span>') +
        '</dl></div></div>' +

        '<div class="sezione"><h3>Capo</h3><div class="card"><dl class="dettaglio">' +
          riga('Tiratore', dati.tiratore
            ? C.esc(C.nomeCompleto(dati.tiratore)) +
              (dati.tiratore.attivo ? '' : ' <span class="badge">Non attivo</span>')
            : '<span class="tenue">Non trovato</span>') +
          riga('Sesso', C.esc(App.costanti.etichettaSesso(a.sesso))) +
          riga('Peso', C.esc(K.formattaKg(a.pesoGrammi))) +
          riga('Classe di età', C.esc(App.costanti.etichettaClasseEta(a.classeEta))) +
          riga('Cane / Muta', a.caneMuta
            ? C.esc(a.caneMuta) : '<span class="tenue">—</span>') +
          riga('Stato', a.annullato
            ? '<span class="badge badge-pericolo badge-annullato">✕ Annullato</span>'
            : '<span class="badge badge-ok">✓ Valido</span>') +
        '</dl></div></div>' +

        (a.note
          ? '<div class="sezione"><h3>Note</h3><div class="card"><p style="margin:0">' +
            C.esc(a.note) + '</p></div></div>'
          : '') +

        // --- Controllo sanitario (Fase 4) ---
        '<div class="sezione"><h3>Controllo sanitario</h3><div class="card">' +
          '<div class="stato-sanitario' +
            (controllo && controllo.statoTrichinella === 'POSITIVO' ? ' positivo' : '') +
            (!controllo ? ' assente' : '') + '">' +
            '<span class="etichetta">Trichinella</span>' +
            '<span class="valore">' +
              (controllo && controllo.statoTrichinella === 'POSITIVO' ? '\u26A0 ' : '') +
              C.esc(App.core.sanitario.etichettaStato(controllo)) +
            '</span>' +
          '</div>' +
          (controllo
            ? '<dl class="dettaglio" style="margin-top:10px">' +
                riga('Data prelievo', controllo.dataPrelievo
                  ? C.esc(C.formattaData(controllo.dataPrelievo))
                  : '<span class="tenue">—</span>') +
                riga('Data esito', controllo.dataEsito
                  ? C.esc(C.formattaData(controllo.dataEsito))
                  : '<span class="tenue">—</span>') +
                riga('Riferimento campione', controllo.riferimentoCampione
                  ? C.esc(controllo.riferimentoCampione)
                  : '<span class="tenue">—</span>') +
                riga('Note', controllo.note
                  ? C.esc(controllo.note) : '<span class="tenue">—</span>') +
              '</dl>'
            : '<p class="tenue" style="margin:10px 0 0">Nessun controllo registrato ' +
              'per questo capo.</p>') +
          '<button class="btn btn-largo" data-vai="#/capo/' + C.esc(a.id) +
          '/sanitario" style="margin-top:12px">Gestisci controllo sanitario</button>' +
        '</div></div>' +

        '<div class="sezione zona-pericolo">' +
          '<button class="btn' + (a.annullato ? ' btn-primario' : ' btn-pericolo-tenue') +
            '" id="btn-annulla-capo">' +
            (a.annullato ? 'Ripristina abbattimento' : 'Annulla abbattimento') +
          '</button>' +
          '<p class="nota-piede">I capi non vengono mai cancellati: si annullano. ' +
          'Un capo annullato resta in archivio con il suo codice.</p>' +
        '</div>');

      document.getElementById('btn-annulla-capo').addEventListener('click', function () {
        if (a.annullato) {
          App.core.capo.impostaAnnullato(a.id, false).then(function () {
            C.toast('Abbattimento ripristinato.');
            render(params);
          }).catch(function (e) { C.toast(e.message, 'errore'); });
          return;
        }
        C.conferma({
          titolo: 'Annullare questo abbattimento?',
          testo: 'Il capo ' + a.codiceCapo + ' resterà in archivio con il suo codice, ' +
                 'ma non verrà conteggiato. Puoi ripristinarlo in qualsiasi momento.',
          conferma: 'Annulla abbattimento',
          annulla: 'Torna indietro',
          pericolo: true
        }).then(function (si) {
          if (!si) return;
          App.core.capo.impostaAnnullato(a.id, true).then(function () {
            C.toast('Abbattimento annullato.');
            render(params);
          }).catch(function (e) { C.toast(e.message, 'errore'); });
        });
      });
    });
  }

  App.ui.viste.schedaCapo = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
