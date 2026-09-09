(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // STAMPA DEI REPORT
  //
  // Un solo impaginatore per tutti e cinque i report, piu' la singola
  // giornata. I dati arrivano gia' pronti da App.core.report: qui si
  // decide soltanto come stanno sul foglio.
  //
  // La libreria jsPDF e' inclusa nel progetto (jspdf.umd.min.js): niente
  // servizi esterni, il PDF si crea anche senza campo.

  // A4 in punti tipografici. Il foglio resta sempre A4: cambia solo il
  // verso, e le misure si chiedono al documento invece di darle per fisse.
  var MARGINE = 36, PIEDE = 42;

  // "Situazione soci" ha otto colonne e in verticale la piu' larga si
  // troncava. In orizzontale ci sta tutta senza rimpicciolire niente.
  var ORIENTAMENTO = { soci: 'landscape' };

  // "Situazione soci" e' un tabellone: con la spaziatura normale i soci
  // della squadra sbordavano di poche righe sulla seconda pagina. In
  // modalita' densa si stringono soltanto gli spazi verticali (testata,
  // riepilogo, altezza delle righe), non i caratteri: il corpo del testo
  // resta quello degli altri report. Se un giorno i soci non ci stanno
  // lo stesso, la tabella continua a pagina due come ha sempre fatto.
  var DENSI = { soci: true };

  function fogliDenso(tipo) { return !!DENSI[tipo]; }

  function versoFoglio(tipo) { return ORIENTAMENTO[tipo] || 'portrait'; }
  function largPagina(doc) { return doc.internal.pageSize.getWidth(); }
  function altPagina(doc) { return doc.internal.pageSize.getHeight(); }
  function largUtile(doc) { return largPagina(doc) - MARGINE * 2; }

  var VERDE_SCURO = [31, 58, 46];
  var VERDE = [47, 93, 70];
  var ARANCIO = [255, 107, 0];
  var TESTO = [28, 33, 30];
  var TENUE = [93, 102, 95];
  var BORDO = [217, 221, 216];
  var RIGA_ALT = [245, 246, 244];

  function jsPDFDisponibile() {
    return !!(global.jspdf && global.jspdf.jsPDF);
  }

  function euro(cent) { return App.core.quote.formattaEuro(cent); }
  function kg(g) { return App.core.carne.formattaKg(g); }
  function dataIta(iso) { return App.core.report.dataIta(iso); }

  function oraGenerazione(iso) {
    var d = iso ? new Date(iso) : new Date();
    function due(n) { return (n < 10 ? '0' : '') + n; }
    return due(d.getDate()) + '/' + due(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' alle ' + due(d.getHours()) + ':' + due(d.getMinutes());
  }

  // ---------------- il marchio vero ----------------
  //
  // Nei PDF va il logo ufficiale della squadra, non un simbolo inventato.
  // Il file e' quello dell'app (adrenalina-logo.png), gia' messo in cache
  // dal service worker: si legge dallo stesso indirizzo da cui l'app
  // prende le proprie immagini, quindi funziona anche senza campo. Non
  // c'e' nessun servizio esterno e nessuna copia duplicata del logo.
  //
  // Il formato non si da' per scontato: si guardano i primi byte del file
  // e si dice a jsPDF che cosa sta ricevendo.

  var FILE_MARCHIO = 'adrenalina-logo.png';
  var marchioCaricato = null;   // promessa, risolta una volta sola

  function formatoImmagine(byte) {
    if (byte.length > 8 && byte[0] === 0x89 && byte[1] === 0x50 &&
        byte[2] === 0x4E && byte[3] === 0x47) return 'PNG';
    if (byte.length > 3 && byte[0] === 0xFF && byte[1] === 0xD8 &&
        byte[2] === 0xFF) return 'JPEG';
    return null;
  }

  function inBase64(byte) {
    var pezzi = [], blocco = 0x8000;
    for (var i = 0; i < byte.length; i += blocco) {
      pezzi.push(String.fromCharCode.apply(null, byte.subarray(i, i + blocco)));
    }
    return global.btoa(pezzi.join(''));
  }

  // Legge il file del logo dall'app. Se per qualsiasi ragione non si
  // riesce, il PDF non si rompe: si torna alla scritta.
  function caricaMarchio() {
    if (marchioCaricato) return marchioCaricato;
    marchioCaricato = new Promise(function (risolvi) {
      try {
        var richiesta = new global.XMLHttpRequest();
        richiesta.open('GET', FILE_MARCHIO, true);
        richiesta.responseType = 'arraybuffer';
        richiesta.onload = function () {
          try {
            if (!richiesta.response) { risolvi(null); return; }
            var byte = new global.Uint8Array(richiesta.response);
            var formato = formatoImmagine(byte);
            if (!formato) { risolvi(null); return; }
            risolvi({
              formato: formato,
              dati: 'data:image/' + formato.toLowerCase() + ';base64,' + inBase64(byte)
            });
          } catch (e) { risolvi(null); }
        };
        richiesta.onerror = function () { risolvi(null); };
        richiesta.send();
      } catch (e) { risolvi(null); }
    });
    return marchioCaricato;
  }

  // Ripiego quando il logo non c'e': il nome scritto, mai un PDF rotto.
  function marchioScritto(doc, x, y, altezza) {
    var h = altezza || 30;
    doc.setFillColor(VERDE_SCURO[0], VERDE_SCURO[1], VERDE_SCURO[2]);
    doc.roundedRect(x, y, 26, h, 4, 4, 'F');
    doc.setFillColor(ARANCIO[0], ARANCIO[1], ARANCIO[2]);
    doc.roundedRect(x + 7, y + h * 0.22, 12, h * 0.56, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(h > 26 ? 17 : 13);
    doc.setTextColor(VERDE_SCURO[0], VERDE_SCURO[1], VERDE_SCURO[2]);
    doc.text('ADRENALINA', x + 34, y + h * 0.62);
  }

  function marchio(doc, x, y, altezza, immagine) {
    var h = altezza || 30;
    if (!immagine) { marchioScritto(doc, x, y, h); return; }
    var lato = h;
    try {
      var p = doc.getImageProperties ? doc.getImageProperties(immagine.dati) : null;
      var larghezza = (p && p.width && p.height) ? h * (p.width / p.height) : h;
      doc.addImage(immagine.dati, immagine.formato, x, y, larghezza, lato);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(h > 26 ? 17 : 13);
      doc.setTextColor(VERDE_SCURO[0], VERDE_SCURO[1], VERDE_SCURO[2]);
      doc.text('ADRENALINA', x + larghezza + 10, y + h * 0.62);
    } catch (e) {
      marchioScritto(doc, x, y, h);
    }
  }

  function intestazionePagina(doc, st, prima) {
    var y = MARGINE;
    if (prima) {
      marchio(doc, MARGINE, y, 30, st.marchio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TENUE[0], TENUE[1], TENUE[2]);
      doc.text(st.squadraNome, largPagina(doc) - MARGINE, y + 12, { align: 'right' });
      doc.text('Stagione ' + st.stagioneNome, largPagina(doc) - MARGINE, y + 24,
        { align: 'right' });
      y += 44;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(TESTO[0], TESTO[1], TESTO[2]);
      doc.text(st.titolo, MARGINE, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(TENUE[0], TENUE[1], TENUE[2]);
      doc.text('Generato il ' + oraGenerazione(st.generatoIl), MARGINE, y + 6);
      y += 14;
      // Che cosa si sta guardando: i filtri applicati, scritti in chiaro.
      if (st.etichette && st.etichette.length) {
        doc.setTextColor(ARANCIO[0], ARANCIO[1], ARANCIO[2]);
        doc.setFontSize(9);
        doc.text(st.etichette.join('   ·   '), MARGINE, y + 6);
        y += 14;
      }
    } else {
      marchio(doc, MARGINE, y, 20, st.marchio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(TENUE[0], TENUE[1], TENUE[2]);
      doc.text(st.titolo + ' · Stagione ' + st.stagioneNome,
        largPagina(doc) - MARGINE, y + 13, { align: 'right' });
      y += 28;
    }
    doc.setDrawColor(ARANCIO[0], ARANCIO[1], ARANCIO[2]);
    doc.setLineWidth(1.6);
    doc.line(MARGINE, y, largPagina(doc) - MARGINE, y);
    return y + (st.denso ? 12 : 20);
  }

  function nuovoStato(doc, testata, immagine, denso) {
    var st = {
      doc: doc,
      denso: !!denso,
      squadraNome: testata.squadraNome,
      stagioneNome: testata.stagioneNome,
      titolo: testata.titolo,
      generatoIl: testata.generatoIl,
      etichette: (testata.filtri && testata.filtri.etichette) || [],
      marchio: immagine || null,
      y: 0
    };
    st.y = intestazionePagina(doc, st, true);
    return st;
  }

  function spazio(st, quanto) {
    if (st.y + quanto > altPagina(st.doc) - PIEDE) nuovaPagina(st);
  }

  function nuovaPagina(st) {
    st.doc.addPage();
    st.y = intestazionePagina(st.doc, st, false);
  }

  function titoloSezione(st, testo) {
    spazio(st, 40);
    var doc = st.doc;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(VERDE[0], VERDE[1], VERDE[2]);
    doc.text(testo, MARGINE, st.y);
    st.y += 6;
    doc.setDrawColor(BORDO[0], BORDO[1], BORDO[2]);
    doc.setLineWidth(0.7);
    doc.line(MARGINE, st.y, largPagina(doc) - MARGINE, st.y);
    st.y += st.denso ? 9 : 14;
  }

  function paragrafo(st, testo) {
    var doc = st.doc;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(TESTO[0], TESTO[1], TESTO[2]);
    var righe = doc.splitTextToSize(testo, largUtile(doc));
    righe.forEach(function (r) {
      spazio(st, 14);
      doc.text(r, MARGINE, st.y);
      st.y += 13;
    });
    st.y += 4;
  }

  // Griglia di coppie etichetta/valore su due colonne.
  function coppie(st, voci) {
    var doc = st.doc;
    var colonna = largUtile(doc) / 2;
    var i = 0;
    while (i < voci.length) {
      spazio(st, 20);
      for (var c = 0; c < 2 && i < voci.length; c++, i++) {
        var x = MARGINE + c * colonna;
        var v = voci[i];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(TENUE[0], TENUE[1], TENUE[2]);
        doc.text(v[0], x, st.y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(TESTO[0], TESTO[1], TESTO[2]);
        doc.text(String(v[1]), x + colonna - 12, st.y, { align: 'right' });
      }
      st.y += st.denso ? 6 : 8;
      doc.setDrawColor(BORDO[0], BORDO[1], BORDO[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGINE, st.y, largPagina(doc) - MARGINE, st.y);
      st.y += st.denso ? 11 : 15;
    }
    st.y += st.denso ? 2 : 4;
  }

  // Accorcia il testo finche' entra nella colonna: nessuna colonna tagliata,
  // nessuna scritta che sborda su quella accanto.
  function entra(doc, testo, larghezza) {
    var t = String(testo === null || testo === undefined ? '' : testo);
    if (doc.getTextWidth(t) <= larghezza) return t;
    while (t.length > 1 && doc.getTextWidth(t + '…') > larghezza) {
      t = t.slice(0, -1);
    }
    return t + '…';
  }

  // cfg: { intestazioni: [], pesi: [], allinea: [], righe: [[...]], totale: [...] }
  function tabella(st, cfg) {
    var doc = st.doc;
    var pesi = cfg.pesi;
    var somma = pesi.reduce(function (a, b) { return a + b; }, 0);
    var utile = largUtile(doc);
    var larghezze = pesi.map(function (p) { return utile * p / somma; });
    var allinea = cfg.allinea || pesi.map(function () { return 'left'; });
    var padding = 5;
    // Solo l'altezza della riga si stringe: il corpo del testo resta 9,2.
    var altezzaRiga = st.denso ? 14 : 16;
    var baseRiga = altezzaRiga - 5;

    function bordoColonne() {
      var x = MARGINE;
      return larghezze.map(function (l) { var v = x; x += l; return v; });
    }
    var xs = bordoColonne();

    function scriviCella(testo, i, y, grassetto) {
      var l = larghezze[i] - padding * 2;
      var t = entra(doc, testo, l);
      if (allinea[i] === 'right') {
        doc.text(t, xs[i] + larghezze[i] - padding, y, { align: 'right' });
      } else {
        doc.text(t, xs[i] + padding, y);
      }
      void grassetto;
    }

    function testataTabella() {
      doc.setFillColor(VERDE[0], VERDE[1], VERDE[2]);
      doc.rect(MARGINE, st.y, utile, st.denso ? 16 : 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(255, 255, 255);
      cfg.intestazioni.forEach(function (h, i) {
        scriviCella(h, i, st.y + (st.denso ? 11 : 12.4));
      });
      st.y += 18;
    }

    spazio(st, 18 + altezzaRiga * 2);
    testataTabella();

    doc.setFont('helvetica', 'normal');
    cfg.righe.forEach(function (riga, n) {
      if (st.y + altezzaRiga > altPagina(doc) - PIEDE) {
        nuovaPagina(st);
        testataTabella();
        doc.setFont('helvetica', 'normal');
      }
      if (n % 2 === 1) {
        doc.setFillColor(RIGA_ALT[0], RIGA_ALT[1], RIGA_ALT[2]);
        doc.rect(MARGINE, st.y, utile, altezzaRiga, 'F');
      }
      doc.setFontSize(9.2);
      doc.setTextColor(TESTO[0], TESTO[1], TESTO[2]);
      riga.forEach(function (cella, i) { scriviCella(cella, i, st.y + baseRiga); });
      st.y += altezzaRiga;
    });

    if (!cfg.righe.length) {
      doc.setFontSize(9.2);
      doc.setTextColor(TENUE[0], TENUE[1], TENUE[2]);
      doc.text(cfg.vuoto || 'Nessun dato.', MARGINE + padding, st.y + baseRiga);
      st.y += altezzaRiga;
    }

    if (cfg.totale) {
      if (st.y + altezzaRiga > altPagina(doc) - PIEDE) { nuovaPagina(st); testataTabella(); }
      doc.setFillColor(230, 239, 233);
      doc.rect(MARGINE, st.y, utile, altezzaRiga + 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(VERDE_SCURO[0], VERDE_SCURO[1], VERDE_SCURO[2]);
      cfg.totale.forEach(function (cella, i) { scriviCella(cella, i, st.y + baseRiga + 1); });
      st.y += altezzaRiga + 2;
    }

    doc.setDrawColor(BORDO[0], BORDO[1], BORDO[2]);
    doc.setLineWidth(0.5);
    doc.rect(MARGINE, st.y, 0, 0);
    st.y += 20;
  }

  // Numerazione: si scrive alla fine, quando si sa quante pagine sono.
  function numeraPagine(doc) {
    var n = doc.getNumberOfPages();
    if (n < 2) return;
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(TENUE[0], TENUE[1], TENUE[2]);
      doc.text('Pagina ' + i + ' di ' + n, largPagina(doc) / 2, altPagina(doc) - 22,
        { align: 'center' });
    }
  }

  // ---------------- impaginazioni dei singoli report ----------------

  function stampaStagione(st, d) {
    var t = d.totali;
    titoloSezione(st, 'Numeri della stagione');
    coppie(st, [
      ['Giornate effettuate', t.giornateEffettuate],
      ['Partecipazioni', t.partecipazioni],
      ['Capi abbattuti', t.capiAbbattuti],
      ['Peso totale', kg(t.pesoTotaleGrammi)],
      ['Carne netta', kg(t.carneNettaGrammi)],
      ['Carne venduta', kg(t.vendutoGrammi)],
      ['Carne ritirata', kg(t.ritiratoGrammi)],
      ['Carne residua', kg(t.residuoGrammi)],
      ['Ricavi carne', euro(t.ricavoCent)]
    ]);

    titoloSezione(st, 'Capi per cacciatore');
    tabella(st, {
      intestazioni: ['Cacciatore', 'Capi abbattuti', 'Peso'],
      pesi: [3, 1.2, 1.4],
      allinea: ['left', 'right', 'right'],
      righe: d.cacciatori.map(function (c) {
        return [c.nome, String(c.capi), kg(c.pesoGrammi)];
      }),
      totale: ['Totale', String(t.capiAbbattuti), kg(t.pesoTotaleGrammi)],
      vuoto: 'Nessun capo abbattuto in questa stagione.'
    });

    titoloSezione(st, 'Soci: vendite, ritiri e saldo');
    tabella(st, {
      intestazioni: ['Socio', 'Kg venduti', 'Kg ritirati', 'Obbligo', 'Credito/Debito'],
      pesi: [2.6, 1.1, 1.1, 1.1, 1.5],
      allinea: ['left', 'right', 'right', 'right', 'right'],
      righe: d.soci.map(function (s) {
        return [s.nome, kg(s.vendutoGrammi), kg(s.ritiratoGrammi),
          kg(s.obbligoGrammi), etichettaSaldo(s)];
      }),
      vuoto: 'Nessun socio iscritto.'
    });
  }

  function etichettaSaldo(s) {
    if (s.stato === 'IN PARI') return 'In pari';
    var segno = s.saldoGrammi > 0 ? '+' : '−';
    return segno + kg(Math.abs(s.saldoGrammi));
  }

  function stampaGiornate(st, d) {
    titoloSezione(st, 'Giornate della stagione');
    tabella(st, {
      intestazioni: ['Data', 'Zona', 'Presenti', 'Capi', 'Peso', 'Carne netta'],
      pesi: [1.2, 2.2, 1, 0.8, 1.2, 1.4],
      allinea: ['left', 'left', 'right', 'right', 'right', 'right'],
      righe: d.righe.map(function (r) {
        return [dataIta(r.data), r.zona, String(r.presenti), String(r.capi),
          kg(r.pesoGrammi), kg(r.carneNettaGrammi)];
      }),
      totale: ['Totale', String(d.totali.giornate) + ' giornate',
        String(d.totali.presenze), String(d.totali.capi),
        kg(d.totali.pesoGrammi), kg(d.totali.carneNettaGrammi)],
      vuoto: 'Nessuna giornata in questa stagione.'
    });
  }

  function stampaGiornata(st, d) {
    titoloSezione(st, 'La battuta');
    coppie(st, [
      ['Data', dataIta(d.data)],
      ['Zona', d.zona],
      ['Capocaccia', d.capocaccia],
      ['Presenti', String(d.presenti.length)]
    ]);

    titoloSezione(st, 'Presenti (' + d.presenti.length + ')');
    paragrafo(st, d.presenti.length ? d.presenti.join(' · ') : 'Nessun presente registrato.');

    titoloSezione(st, 'Capi abbattuti (' + d.capi.length + ')');
    tabella(st, {
      intestazioni: ['Codice', 'Abbattitore', 'Sesso', 'Classe', 'Peso'],
      pesi: [1.1, 2.4, 1.2, 1.3, 1.1],
      allinea: ['left', 'left', 'left', 'left', 'right'],
      righe: d.capi.map(function (c) {
        return [c.codice, c.abbattitore, c.sesso, c.classe, kg(c.pesoGrammi)];
      }),
      totale: ['Totale', String(d.capi.length) + (d.capi.length === 1 ? ' capo' : ' capi'),
        '', '', kg(d.pesoCapiGrammi)],
      vuoto: 'Nessun capo abbattuto in questa giornata.'
    });

    titoloSezione(st, 'Carne');
    if (d.carne) {
      coppie(st, [
        ['Carne netta', kg(d.carne.nettaGrammi)],
        ['Venduta', kg(d.carne.vendutoGrammi)],
        ['Ritirata', kg(d.carne.ritiratoGrammi)],
        ['Residua', kg(d.carne.residuoGrammi)],
        ['Ricavi', euro(d.carne.ricavoCent)]
      ]);
    } else {
      paragrafo(st, 'Per questa giornata non è stata registrata carne.');
    }

    titoloSezione(st, 'Vendite della giornata');
    tabella(st, {
      intestazioni: ['Venditore', 'Prodotto', 'Kg', '€/kg', 'Totale'],
      pesi: [2.2, 1.7, 1, 1, 1.2],
      allinea: ['left', 'left', 'right', 'right', 'right'],
      righe: d.vendite.map(function (v) {
        return [v.venditore, v.prodotto, kg(v.pesoGrammi),
          euro(v.prezzoCentKg), euro(v.totaleCent)];
      }),
      totale: ['Totale', '', kg(d.vendite.reduce(function (a, v) {
        return a + v.pesoGrammi; }, 0)), '',
        euro(d.vendite.reduce(function (a, v) { return a + v.totaleCent; }, 0))],
      vuoto: 'Nessuna vendita registrata per questa giornata.'
    });
  }

  function stampaAbbattimenti(st, d) {
    titoloSezione(st, 'Riepilogo');
    coppie(st, [
      ['Totale capi', String(d.totali.capi)],
      ['Peso totale', kg(d.totali.pesoGrammi)]
    ]);

    titoloSezione(st, 'Classifica per cacciatore');
    tabella(st, {
      intestazioni: ['Cacciatore', 'N. capi', 'Peso totale'],
      pesi: [3, 1.2, 1.5],
      allinea: ['left', 'right', 'right'],
      righe: d.classifica.map(function (c) {
        return [c.nome, String(c.capi), kg(c.pesoGrammi)];
      }),
      totale: ['Totale', String(d.totali.capi), kg(d.totali.pesoGrammi)],
      vuoto: 'Nessun capo abbattuto in questa stagione.'
    });

    titoloSezione(st, 'Dettaglio capi');
    tabella(st, {
      intestazioni: ['Data', 'Codice', 'Abbattitore', 'Sesso', 'Classe', 'Peso'],
      pesi: [1.2, 1.1, 2.2, 1.2, 1.3, 1.1],
      allinea: ['left', 'left', 'left', 'left', 'left', 'right'],
      righe: d.dettaglio.map(function (c) {
        return [dataIta(c.data), c.codice, c.abbattitore, c.sesso, c.classe,
          kg(c.pesoGrammi)];
      }),
      vuoto: 'Nessun capo da elencare.'
    });
  }

  function stampaCarne(st, d) {
    var t = d.totali;

    if (d.soloVenditore) {
      // Il foglio parla di un venditore solo: si mostrano i suoi numeri,
      // non quelli della squadra. Carne netta, ritirata e residua sono
      // della battuta e non appartengono a lui, quindi restano fuori.
      titoloSezione(st, 'Venduto dal socio');
      coppie(st, [
        ['Kg venduti', kg(t.vendutoGrammi)],
        ['Ricavi', euro(t.ricavoCent)],
        ['Numero di vendite', String(d.vendite.length)]
      ]);
      paragrafo(st, 'Sono riportate soltanto le vendite di questo socio. ' +
        'Carne netta, ritirata e residua sono valori della battuta e non ' +
        'vengono attribuiti a un singolo venditore.');
    } else {
      titoloSezione(st, 'Riepilogo carne');
      coppie(st, [
        ['Carne netta', kg(t.nettaGrammi)],
        ['Venduta', kg(t.vendutoGrammi)],
        ['Ritirata', kg(t.ritiratoGrammi)],
        ['Residua', kg(t.residuoGrammi)],
        ['Ricavi', euro(t.ricavoCent)]
      ]);

      titoloSezione(st, 'Per battuta');
      tabella(st, {
        intestazioni: ['Data', 'Capi', 'Carne netta', 'Venduta', 'Ritirata', 'Residua'],
        pesi: [1.4, 0.7, 1.3, 1.2, 1.2, 1.2],
        allinea: ['left', 'right', 'right', 'right', 'right', 'right'],
        righe: d.lotti.map(function (l) {
          return [dataIta(l.data), String(l.capi), kg(l.nettaGrammi), kg(l.vendutoGrammi),
            kg(l.ritiratoGrammi), kg(l.residuoGrammi)];
        }),
        totale: ['Totale',
          String(d.lotti.reduce(function (a, l) { return a + (l.capi || 0); }, 0)),
          kg(t.nettaGrammi), kg(t.vendutoGrammi),
          kg(t.ritiratoGrammi), kg(t.residuoGrammi)],
        vuoto: 'Nessun lotto di carne registrato.'
      });
    }

    titoloSezione(st, 'Vendite');
    tabella(st, {
      intestazioni: ['Data', 'Venditore', 'Prodotto', 'Kg', '€/kg', 'Totale'],
      pesi: [1.2, 2, 1.5, 0.9, 0.9, 1.1],
      allinea: ['left', 'left', 'left', 'right', 'right', 'right'],
      righe: d.vendite.map(function (v) {
        return [dataIta(v.data), v.venditore, v.prodotto, kg(v.pesoGrammi),
          euro(v.prezzoCentKg), euro(v.totaleCent)];
      }),
      totale: ['Totale', '', '', kg(t.vendutoGrammi), '', euro(t.ricavoCent)],
      vuoto: 'Nessuna vendita registrata.'
    });

    titoloSezione(st, 'Chi ha venduto');
    tabella(st, {
      intestazioni: ['Venditore', 'Kg venduti', 'Ricavi'],
      pesi: [3, 1.3, 1.4],
      allinea: ['left', 'right', 'right'],
      righe: d.venditori.map(function (v) {
        return [v.nome, kg(v.pesoGrammi), euro(v.ricavoCent)];
      }),
      totale: ['Totale', kg(t.vendutoGrammi), euro(t.ricavoCent)],
      vuoto: 'Nessun venditore registrato.'
    });

    titoloSezione(st, 'Per prodotto');
    tabella(st, {
      intestazioni: ['Prodotto', 'Kg venduti', 'Ricavi'],
      pesi: [3, 1.3, 1.4],
      allinea: ['left', 'right', 'right'],
      righe: d.prodotti.map(function (p) {
        return [p.prodotto, kg(p.pesoGrammi), euro(p.ricavoCent)];
      }),
      totale: ['Totale', kg(t.vendutoGrammi), euro(t.ricavoCent)],
      vuoto: 'Nessun prodotto venduto.'
    });
  }

  // Nel tabellone il saldo e' sempre un numero e lo stato sta nella sua
  // colonna: cosi' non si ripete due volte la stessa cosa e niente si
  // accorcia. Altrove resta l'etichetta breve gia' approvata.
  function saldoNumerico(s) {
    if (!s.saldoGrammi) return kg(0);
    return (s.saldoGrammi > 0 ? '+' : '-') + kg(Math.abs(s.saldoGrammi));
  }

  function stampaSoci(st, d) {
    titoloSezione(st, 'Come sta la squadra');
    coppie(st, [
      ['Soci in credito', String(d.conteggi.inCredito)],
      ['Soci in pari', String(d.conteggi.inPari)],
      ['Soci in debito', String(d.conteggi.inDebito)],
      ['Obbligo di vendita', kg(d.obbligoGrammi)]
    ]);

    titoloSezione(st, 'Situazione socio per socio');
    tabella(st, {
      intestazioni: ['Socio', 'Pres.', 'Capi', 'Kg venduti', 'Kg ritirati',
        'Obbligo', 'Saldo', 'Stato'],
      pesi: [2.6, 0.7, 0.7, 1.1, 1.1, 1, 1.1, 1.3],
      allinea: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'left'],
      righe: d.righe.map(function (r) {
        return [r.nome, String(r.presenze), String(r.capi), kg(r.vendutoGrammi),
          kg(r.ritiratoGrammi), kg(r.obbligoGrammi), saldoNumerico(r), r.stato];
      }),
      vuoto: 'Nessun socio iscritto.'
    });
  }

  // ---------------- scheda di un socio solo ----------------
  function stampaSocio(st, d) {
    var r = d.riga;
    titoloSezione(st, d.nome);
    coppie(st, [
      ['Presenze', String(r.presenze)],
      ['Capi abbattuti', String(r.capi)],
      ['Kg venduti', kg(r.vendutoGrammi)],
      ['Kg ritirati', kg(r.ritiratoGrammi)],
      ['Obbligo', kg(r.obbligoGrammi)],
      ['Obbligo residuo', kg(r.residuoObbligoGrammi)],
      ['Credito/Debito', etichettaSaldo(r)]
    ]);

    titoloSezione(st, 'Capi abbattuti');
    tabella(st, {
      intestazioni: ['Data', 'Codice', 'Sesso', 'Classe', 'Peso'],
      pesi: [1.2, 1.4, 1.1, 1.4, 1],
      allinea: ['left', 'left', 'left', 'left', 'right'],
      righe: d.capi.map(function (x) {
        return [dataIta(x.data), x.codice, x.sesso, x.classe, kg(x.pesoGrammi)];
      }),
      totale: ['Totale', String(d.capi.length), '', '',
        kg(d.capi.reduce(function (a, x) { return a + x.pesoGrammi; }, 0))],
      vuoto: 'Nessun capo abbattuto da questo socio.'
    });

    titoloSezione(st, 'Vendite');
    tabella(st, {
      intestazioni: ['Data', 'Prodotto', 'Kg', '€/kg', 'Totale'],
      pesi: [1.2, 2, 1, 1, 1.2],
      allinea: ['left', 'left', 'right', 'right', 'right'],
      righe: d.vendite.map(function (v) {
        return [dataIta(v.data), v.prodotto, kg(v.pesoGrammi),
          euro(v.prezzoCentKg), euro(v.totaleCent)];
      }),
      totale: ['Totale', '',
        kg(d.vendite.reduce(function (a, v) { return a + v.pesoGrammi; }, 0)), '',
        euro(d.vendite.reduce(function (a, v) { return a + v.totaleCent; }, 0))],
      vuoto: 'Nessuna vendita registrata a questo socio.'
    });
  }

  var IMPAGINATORI = {
    stagione: stampaStagione,
    giornate: stampaGiornate,
    giornata: stampaGiornata,
    abbattimenti: stampaAbbattimenti,
    carne: stampaCarne,
    soci: stampaSoci,
    socio: stampaSocio
  };

  // ---------------- ingresso pubblico ----------------

  // Costruisce il documento senza salvarlo: utile per provarlo.
  function componi(tipo, params) {
    if (!jsPDFDisponibile()) {
      return Promise.reject(new Error('La libreria PDF non è disponibile.'));
    }
    var impagina = IMPAGINATORI[tipo];
    if (!impagina) return Promise.reject(new Error('Report sconosciuto: ' + tipo));

    return Promise.all([
      App.core.report.costruisci(tipo, params),
      caricaMarchio()
    ]).then(function (res) {
      var dati = res[0], immagine = res[1];
      if (!dati) throw new Error('Non ci sono dati da esportare.');
      var jsPDF = global.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: versoFoglio(tipo) });
      var st = nuovoStato(doc, dati, immagine, fogliDenso(tipo));
      impagina(st, dati);
      numeraPagine(doc);
      return { doc: doc, dati: dati, marchio: immagine,
        nomeFile: App.core.report.nomeFile(tipo, dati) };
    });
  }

  // Costruisce e consegna il file al telefono.
  function genera(tipo, params) {
    var C = App.ui && App.ui.componenti;
    return componi(tipo, params).then(function (r) {
      r.doc.save(r.nomeFile);
      if (C) C.toast('PDF creato: ' + r.nomeFile);
      return r;
    }).catch(function (e) {
      if (C) C.toast(e.message || 'Non è stato possibile creare il PDF.', 'errore');
      throw e;
    });
  }

  // Un solo gestore per tutti i pulsanti di esportazione dell'app:
  // data-pdf porta il tipo, data-pdf-id l'eventuale giornata,
  // data-pdf-filtri i filtri scelti nella schermata Report. Il PDF esce
  // cosi' dagli stessi parametri che si vedono nell'anteprima.
  function parametriDaPulsante(el) {
    var p = {};
    var filtri = el.getAttribute('data-pdf-filtri');
    if (filtri) {
      try { p = JSON.parse(filtri) || {}; } catch (e) { p = {}; }
    }
    var id = el.getAttribute('data-pdf-id');
    if (id) p.id = id;
    return p;
  }

  function collega() {
    if (typeof document === 'undefined' || !document) return;
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== document.body) {
        if (el.getAttribute && el.getAttribute('data-pdf')) {
          e.preventDefault();
          genera(el.getAttribute('data-pdf'), parametriDaPulsante(el))
            .catch(function () { /* gia' segnalato */ });
          return;
        }
        el = el.parentNode;
      }
    });
  }

  App.core.pdf = {
    disponibile: jsPDFDisponibile,
    componi: componi,
    genera: genera,
    collega: collega,
    caricaMarchio: caricaMarchio,
    etichettaSaldo: etichettaSaldo
  };

  collega();
})(typeof window !== 'undefined' ? window : globalThis);
