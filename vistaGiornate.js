(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  var GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  function pezzi(iso) {
    var p = String(iso).slice(0, 10).split('-');
    return { anno: Number(p[0]), mese: Number(p[1]), giorno: Number(p[2]) };
  }

  function giornoSettimana(iso) {
    if (!iso) return '';
    var p = pezzi(iso);
    if (!p.anno) return '';
    return GIORNI[new Date(p.anno, p.mese - 1, p.giorno).getDay()] || '';
  }

  function breve(iso) {
    var p = pezzi(iso);
    var g = giornoSettimana(iso);
    return g.slice(0, 3) + ' ' + p.giorno + ' ' + MESI[p.mese - 1].toLowerCase();
  }

  function titoloMese(iso) {
    var p = pezzi(iso);
    return MESI[p.mese - 1] + ' ' + p.anno;
  }

  // Marcatore testuale davanti all'etichetta: lo stato resta riconoscibile
  // anche in bianco e nero o per chi non distingue i colori.
  var SEGNO = { PROGRAMMATA: '\u25CB', COMPLETATA: '\u2713', ANNULLATA: '\u2715' };

  function etichettaStato(stato, passata) {
    if (stato === 'DA_COMPILARE') {
      return passata
        ? '<span class="stato non-registrata">Non registrata</span>'
        : '<span class="stato da-compilare">Da compilare</span>';
    }
    var classe = 'stato programmata';
    if (stato === 'COMPLETATA') classe = 'stato completata';
    else if (stato === 'ANNULLATA') classe = 'stato annullata';
    return '<span class="' + classe + '">' + (SEGNO[stato] || '') + ' ' +
      App.ui.componenti.esc(App.costanti.etichettaStatoGiornata(stato)) + '</span>';
  }

  // La scheda giornata riusa questa funzione.
  function badgeStato(stato) { return etichettaStato(stato, false); }

  function render() {
    var C = App.ui.componenti;

    return App.core.squadra.contesto().then(function (ctx) {
      C.intestazione({
        titolo: 'Calendario battute',
        sotto: ctx.stagioneAttiva ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: '#/home'
      });

      if (!ctx.stagioneAttiva) {
        C.monta('<div class="vuoto"><h2>Nessuna stagione attiva</h2>' +
          '<p>Le giornate appartengono a una stagione. Attivane una per continuare.</p></div>' +
          C.seModifica('<div class="sezione">' +
            '<button class="btn btn-contorno" data-vai="#/stagioni">' +
            'Vai a Stagioni</button></div>'));
        return;
      }

      return App.core.calendarioBattute.elenco(ctx.stagioneAttiva.id).then(function (dati) {
        var oggi = App.core.giornata.oggiIso();

        if (!dati.configurazione) {
          C.monta('<div class="avviso-box">Il calendario delle battute non è ancora ' +
            'configurato per questa stagione.</div>' +
            C.seModifica('<div class="sezione">' +
              '<button class="btn btn-contorno" data-vai="#/stagioni">' +
              'Configura in Amministrazione</button></div>'));
          return;
        }

        // Una riga per data potenziale. Nessun record giornata viene creato qui:
        // le date sono derivate dalla configurazione della stagione.
        function riga(r) {
          var passata = r.data < oggi;
          // Una giornata gia' preparata si apre sempre. Una data ancora
          // vuota porta al modulo di creazione: a chi legge soltanto
          // non serve, quindi la riga non e' toccabile.
          var soloConsultazione = !!(App.core.accesso.attivo() &&
            App.core.accesso.lettore && App.core.accesso.lettore());
          var vai = r.giornata
            ? '#/giornata/' + r.giornata.id
            : (soloConsultazione ? null : '#/giornata/nuova/' + r.data);
          // La data e' l'informazione principale; il resto e' secondario
          // e sta su una sola riga, per non gonfiare l'elenco.
          var dettaglio = '';
          if (r.giornata) {
            dettaglio = (r.giornata.zona || 'Zona non indicata');
            if (r.giornata.orarioRitrovo) dettaglio += ' · ' + r.giornata.orarioRitrovo;
            if (r.lotto) dettaglio += ' · carne registrata';
          }
          return '<button class="voce voce-data' + (passata ? ' passata' : '') +
            (vai ? '" data-vai="' + vai + '">' : '" disabled>') +
            '<span class="principale">' +
              '<span class="titolo">' + C.esc(breve(r.data)) + '</span>' +
              (dettaglio ? '<span class="sotto">' + C.esc(dettaglio) + '</span>' : '') +
            '</span>' +
            etichettaStato(r.stato, passata) +
            '<span class="freccia">&#8250;</span>' +
          '</button>';
        }

        var gruppi = [];
        var correnteMese = null;
        // Il calendario elenca le date di battuta previste. Le giornate
        // create fuori da quelle date restano raggiungibili, ma in coda
        // e sotto un titolo che dice chiaramente cosa sono.
        var inCalendario = dati.righe.filter(function (r) { return !r.fuoriCalendario; });
        var fuori = dati.righe.filter(function (r) { return r.fuoriCalendario; });

        inCalendario.forEach(function (r) {
          var m = titoloMese(r.data);
          if (m !== correnteMese) { gruppi.push({ mese: m, righe: [] }); correnteMese = m; }
          gruppi[gruppi.length - 1].righe.push(r);
        });

        var compilate = inCalendario.filter(function (r) { return !!r.giornata; }).length;

        C.monta(
          '<div class="sezione">' +
            '<p class="nota-piccola">' + inCalendario.length + ' date di battuta · ' +
            compilate + ' preparate. Tocca una data per aprirla o prepararla.</p>' +
          '</div>' +
          gruppi.map(function (g) {
            return '<div class="sezione"><h3>' + C.esc(g.mese) + '</h3>' +
              '<div class="lista">' + g.righe.map(riga).join('') + '</div></div>';
          }).join('') +
          (fuori.length
            ? '<div class="sezione"><h3>Fuori calendario</h3>' +
              '<p class="nota-piccola">Giornate registrate in date che non ' +
              'appartengono al calendario di questa stagione.</p>' +
              '<div class="lista">' + fuori.map(riga).join('') + '</div></div>'
            : ''));
      });
    });
  }

  App.ui.viste.giornate = {
    render: render,
    giornoSettimana: giornoSettimana,
    badgeStato: badgeStato
  };
})(typeof window !== 'undefined' ? window : globalThis);
