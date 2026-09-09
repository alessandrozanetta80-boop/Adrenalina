(function (global) {
  'use strict';
  var App = global.App;
  App.ui.viste = App.ui.viste || {};

  // SCHERMATE REPORT
  //
  // Quello che si vede qui e' esattamente quello che finisce nel PDF:
  // gli stessi dati, chiesti allo stesso motore. Non si modifica niente,
  // quindi anche un accesso in sola lettura puo' consultare ed esportare.

  var VOCI = [
    { tipo: 'stagione',     titolo: 'Riepilogo stagione',
      sotto: 'Giornate, capi, carne e ricavi in una pagina' },
    { tipo: 'giornate',     titolo: 'Giornate',
      sotto: 'Tutte le battute, con presenti, capi e carne' },
    { tipo: 'abbattimenti', titolo: 'Abbattimenti',
      sotto: 'Classifica per cacciatore e dettaglio dei capi' },
    { tipo: 'carne',        titolo: 'Carne',
      sotto: 'Lotti, vendite, venditori e prodotti' },
    { tipo: 'soci',         titolo: 'Situazione soci',
      sotto: 'Presenze, vendite, obbligo e credito' },
    { tipo: 'socio',        titolo: 'Scheda di un socio',
      sotto: 'Un socio solo: presenze, capi, vendite e saldo' }
  ];

  // I filtri scelti valgono per tutti i report finche' non si cambiano.
  // Sono gli stessi che finiscono nel PDF: un posto solo, nessuna copia.
  var filtri = { stagioneId: '', dataDa: '', dataA: '', membroId: '', giornataId: '' };

  // I filtri che quel report accetta davvero: la schermata mostra solo
  // quelli, e solo quelli finiscono nel PDF.
  function ammessi(tipo) {
    var elenco = tipo ? App.core.report.filtriAmmessi(tipo)
      : ['stagioneId', 'dataDa', 'dataA', 'membroId', 'giornataId'];
    var ok = {};
    elenco.forEach(function (c) { ok[c] = true; });
    return ok;
  }

  function filtriPuliti(tipo) {
    var ok = ammessi(tipo);
    var out = {};
    if (ok.stagioneId && filtri.stagioneId) out.stagioneId = filtri.stagioneId;
    if (ok.dataDa && filtri.dataDa) out.dataDa = filtri.dataDa;
    if (ok.dataA && filtri.dataA) out.dataA = filtri.dataA;
    if (ok.membroId && filtri.membroId) out.membroId = filtri.membroId;
    if (ok.giornataId && filtri.giornataId) out.giornataId = filtri.giornataId;
    return out;
  }

  function C() { return App.ui.componenti; }
  function kg(g) { return App.core.carne.formattaKg(g); }
  function euro(c) { return App.core.quote.formattaEuro(c); }

  function riga(etichetta, valore) {
    return '<div class="dettaglio-riga"><dt>' + C().esc(etichetta) + '</dt>' +
      '<dd>' + valore + '</dd></div>';
  }

  function blocco(titolo, contenuto) {
    return '<div class="sezione"><h3>' + C().esc(titolo) + '</h3>' + contenuto + '</div>';
  }

  function scheda(righe) {
    return '<div class="card"><dl class="dettaglio">' + righe.join('') + '</dl></div>';
  }

  function vuoto(testo) {
    return '<p class="nota-piede">' + C().esc(testo) + '</p>';
  }

  function pulsantePdf(tipo, id, etichetta) {
    return '<div class="sezione pila">' +
      '<button class="btn btn-azione btn-largo" data-pdf="' + C().esc(tipo) + '"' +
      ' data-pdf-filtri="' + C().esc(JSON.stringify(filtriPuliti(tipo))) + '"' +
      (id ? ' data-pdf-id="' + C().esc(id) + '"' : '') + '>' +
      C().esc(etichetta || 'Esporta PDF') + '</button></div>';
  }

  // ---------- pannello dei filtri ----------
  function opzioni(elenco, scelto, vuoto) {
    return '<option value="">' + C().esc(vuoto) + '</option>' +
      elenco.map(function (o) {
        return '<option value="' + C().esc(o.id) + '"' +
          (String(scelto) === String(o.id) ? ' selected' : '') + '>' +
          C().esc(o.etichetta) + '</option>';
      }).join('');
  }

  // Ogni report mostra soltanto i filtri che sa applicare. Offrire un
  // periodo dove il saldo resta stagionale darebbe un foglio che mescola
  // due cose diverse: meglio non offrirlo.
  function pannelloFiltri(op, tipo) {
    var c = C();
    var ok = ammessi(tipo);
    var stagioni = op.stagioni.map(function (s) {
      return { id: s.id, etichetta: s.nome + (s.attiva ? ' (attiva)' : '') };
    });
    var soci = op.soci.map(function (s) { return { id: s.id, etichetta: s.nome }; });
    var scelta = filtri.stagioneId || op.filtri.stagioneId || '';
    var campi = '';

    // La stagione compare solo se ce n\'e\' davvero piu\' di una.
    if (ok.stagioneId && op.stagioni.length > 1) {
      campi += '<label class="campo"><span>Stagione</span>' +
        '<select id="f-stagione">' + opzioni(stagioni, scelta, 'Stagione attiva') +
        '</select></label>';
    }
    if (ok.dataDa) {
      campi += '<label class="campo"><span>Dal giorno</span>' +
        '<input type="date" id="f-da" value="' + c.esc(filtri.dataDa) + '"></label>';
    }
    if (ok.dataA) {
      campi += '<label class="campo"><span>Al giorno</span>' +
        '<input type="date" id="f-a" value="' + c.esc(filtri.dataA) + '"></label>';
    }
    if (ok.membroId) {
      campi += '<label class="campo"><span>' +
        (tipo === 'carne' ? 'Venditore' : 'Socio') + '</span>' +
        '<select id="f-socio">' + opzioni(soci, filtri.membroId, 'Tutti i soci') +
        '</select></label>';
    }
    if (ok.giornataId) {
      campi += '<label class="campo"><span>Giornata</span>' +
        '<select id="f-giornata">' +
        opzioni(op.giornate, filtri.giornataId, 'Tutte le giornate') +
        '</select></label>';
    }
    if (!campi) return '';

    return '<div class="sezione"><h3>Filtri</h3><div class="card">' + campi +
      ((tipo === 'soci' || tipo === 'socio')
        ? '<p class="nota-piede">Credito, debito e obbligo sono valori ' +
          'dell\'intera stagione: qui non si filtra per periodo.</p>'
        : '') +
      '<div class="pila">' +
        '<button class="btn btn-azione" id="btn-filtri">Applica filtri</button>' +
        '<button class="btn btn-contorno" id="btn-filtri-azzera">Azzera</button>' +
      '</div>' +
      '</div></div>';
  }

  function collegaFiltri(tipo) {
    // Un campo che questa schermata non mostra non viene toccato: resta
    // com'era per i report che lo accettano.
    function leggi(id, attuale) {
      var el = document.getElementById(id);
      return el ? el.value : attuale;
    }
    var applica = document.getElementById('btn-filtri');
    if (applica) {
      applica.addEventListener('click', function () {
        filtri.stagioneId = leggi('f-stagione', filtri.stagioneId);
        filtri.dataDa = leggi('f-da', filtri.dataDa);
        filtri.dataA = leggi('f-a', filtri.dataA);
        filtri.membroId = leggi('f-socio', filtri.membroId);
        filtri.giornataId = leggi('f-giornata', filtri.giornataId);
        renderDettaglio({ tipo: tipo });
      });
    }
    var azzera = document.getElementById('btn-filtri-azzera');
    if (azzera) {
      azzera.addEventListener('click', function () {
        filtri = { stagioneId: '', dataDa: '', dataA: '', membroId: '',
          giornataId: '' };
        renderDettaglio({ tipo: tipo });
      });
    }
  }

  function badgeStato(stato) {
    var classe = stato === 'IN CREDITO' ? 'badge badge-ok'
      : (stato === 'IN DEBITO' ? 'badge badge-pericolo' : 'badge');
    return '<span class="' + classe + '">' + C().esc(stato) + '</span>';
  }

  // ---------- indice ----------
  function renderIndice() {
    var c = C();
    return App.core.squadra.contesto().then(function (ctx) {
      c.intestazione({
        titolo: 'Report',
        sotto: ctx.stagioneAttiva
          ? 'Stagione ' + ctx.stagioneAttiva.nome : 'Nessuna stagione attiva',
        indietro: '#/soci'
      });
      c.monta(
        '<div class="sezione">' +
          '<div class="lista">' +
            VOCI.map(function (v) {
              return '<button class="voce" data-vai="#/report/' + v.tipo + '">' +
                '<span class="principale">' +
                  '<span class="titolo">' + c.esc(v.titolo) + '</span>' +
                  '<span class="sotto">' + c.esc(v.sotto) + '</span>' +
                '</span><span class="freccia">&#8250;</span></button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<p class="nota-piede">Ogni report si può leggere qui e salvare in PDF. ' +
        'I report non modificano nessun dato.</p>');
    });
  }

  // ---------- corpi delle cinque schermate ----------
  function corpoStagione(d) {
    var t = d.totali;
    return blocco('Numeri della stagione', scheda([
      riga('Giornate effettuate', String(t.giornateEffettuate)),
      riga('Partecipazioni', String(t.partecipazioni)),
      riga('Capi abbattuti', String(t.capiAbbattuti)),
      riga('Peso totale', C().esc(kg(t.pesoTotaleGrammi))),
      riga('Carne netta', C().esc(kg(t.carneNettaGrammi))),
      riga('Carne venduta', C().esc(kg(t.vendutoGrammi))),
      riga('Carne ritirata', C().esc(kg(t.ritiratoGrammi))),
      riga('Carne residua', C().esc(kg(t.residuoGrammi))),
      riga('Ricavi carne', '<strong>' + C().esc(euro(t.ricavoCent)) + '</strong>')
    ])) +
    blocco('Capi per cacciatore', d.cacciatori.length
      ? scheda(d.cacciatori.map(function (x) {
          return riga(x.nome, x.capi + ' · ' + C().esc(kg(x.pesoGrammi)));
        }))
      : vuoto('Nessun capo abbattuto in questa stagione.')) +
    blocco('Soci: vendite, ritiri e saldo', d.soci.length
      ? scheda(d.soci.map(function (s) {
          return riga(s.nome, C().esc(kg(s.vendutoGrammi)) + ' venduti · ' +
            C().esc(kg(s.ritiratoGrammi)) + ' ritirati · ' +
            C().esc(App.core.pdf.etichettaSaldo(s)));
        }))
      : vuoto('Nessun socio iscritto.'));
  }

  function corpoGiornate(d) {
    return blocco('Totali', scheda([
      riga('Giornate', String(d.totali.giornate)),
      riga('Presenze', String(d.totali.presenze)),
      riga('Capi', String(d.totali.capi)),
      riga('Peso', C().esc(kg(d.totali.pesoGrammi))),
      riga('Carne netta', C().esc(kg(d.totali.carneNettaGrammi)))
    ])) +
    blocco('Giornate', d.righe.length
      ? '<div class="lista">' + d.righe.map(function (r) {
          return '<div class="card">' +
            '<dl class="dettaglio">' +
              riga(App.core.report.dataIta(r.data) + ' · ' + C().esc(r.zona),
                r.presenti + ' presenti') +
              riga('Capi', r.capi + ' · ' + C().esc(kg(r.pesoGrammi))) +
              riga('Carne netta', C().esc(kg(r.carneNettaGrammi))) +
            '</dl>' +
            '<div class="pila">' +
              '<button class="btn btn-contorno" data-vai="#/giornata/' +
                C().esc(r.giornataId) + '">Apri la giornata</button>' +
              '<button class="btn btn-contorno" data-pdf="giornata" data-pdf-id="' +
                C().esc(r.giornataId) + '">PDF di questa giornata</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : vuoto('Nessuna giornata in questa stagione.'));
  }

  function corpoAbbattimenti(d) {
    return blocco('Riepilogo', scheda([
      riga('Totale capi', String(d.totali.capi)),
      riga('Peso totale', C().esc(kg(d.totali.pesoGrammi)))
    ])) +
    blocco('Classifica per cacciatore', d.classifica.length
      ? scheda(d.classifica.map(function (x) {
          return riga(x.nome, x.capi + ' capi · ' + C().esc(kg(x.pesoGrammi)));
        }))
      : vuoto('Nessun capo abbattuto in questa stagione.')) +
    blocco('Dettaglio capi', d.dettaglio.length
      ? scheda(d.dettaglio.map(function (x) {
          return riga(App.core.report.dataIta(x.data) + ' · ' + C().esc(x.codice),
            C().esc(x.abbattitore) + ' · ' + C().esc(x.sesso) + ' · ' +
            C().esc(x.classe) + ' · ' + C().esc(kg(x.pesoGrammi)));
        }))
      : vuoto('Nessun capo da elencare.'));
  }

  function corpoCarne(d) {
    var t = d.totali;
    // Con il filtro sul venditore si mostrano i suoi numeri e basta:
    // netta, ritirata e residua sono della battuta, non sue.
    var testa = d.soloVenditore
      ? blocco('Venduto dal socio', scheda([
          riga('Kg venduti', C().esc(kg(t.vendutoGrammi))),
          riga('Ricavi', '<strong>' + C().esc(euro(t.ricavoCent)) + '</strong>'),
          riga('Numero di vendite', String(d.vendite.length))
        ])) +
        '<p class="nota-piede">Sono riportate soltanto le vendite di questo ' +
        'socio. Carne netta, ritirata e residua sono valori della battuta e ' +
        'non vengono attribuiti a un singolo venditore.</p>'
      : blocco('Riepilogo carne', scheda([
          riga('Carne netta', C().esc(kg(t.nettaGrammi))),
          riga('Venduta', C().esc(kg(t.vendutoGrammi))),
          riga('Ritirata', C().esc(kg(t.ritiratoGrammi))),
          riga('Residua', C().esc(kg(t.residuoGrammi))),
          riga('Ricavi', '<strong>' + C().esc(euro(t.ricavoCent)) + '</strong>')
        ])) +
        blocco('Per battuta', d.lotti.length
          ? scheda(d.lotti.map(function (l) {
              return riga(App.core.report.dataIta(l.data) + ' · ' + l.capi +
                (l.capi === 1 ? ' capo' : ' capi'),
                C().esc(kg(l.nettaGrammi)) + ' netta · ' +
                C().esc(kg(l.vendutoGrammi)) + ' venduta · ' +
                C().esc(kg(l.ritiratoGrammi)) + ' ritirata · ' +
                C().esc(kg(l.residuoGrammi)) + ' residua');
            }))
          : vuoto('Nessun lotto di carne registrato.'));
    return testa +
    blocco('Vendite', d.vendite.length
      ? scheda(d.vendite.map(function (v) {
          return riga(App.core.report.dataIta(v.data) + ' · ' + C().esc(v.venditore),
            C().esc(v.prodotto) + ' · ' + C().esc(kg(v.pesoGrammi)) + ' · ' +
            C().esc(euro(v.prezzoCentKg)) + '/kg · ' +
            '<strong>' + C().esc(euro(v.totaleCent)) + '</strong>');
        }))
      : vuoto('Nessuna vendita registrata.')) +
    blocco('Chi ha venduto', d.venditori.length
      ? scheda(d.venditori.map(function (v) {
          return riga(v.nome, C().esc(kg(v.pesoGrammi)) + ' · ' +
            C().esc(euro(v.ricavoCent)));
        }))
      : vuoto('Nessun venditore registrato.')) +
    blocco('Per prodotto', d.prodotti.length
      ? scheda(d.prodotti.map(function (p) {
          return riga(p.prodotto, C().esc(kg(p.pesoGrammi)) + ' · ' +
            C().esc(euro(p.ricavoCent)));
        }))
      : vuoto('Nessun prodotto venduto.'));
  }

  function corpoSoci(d) {
    return blocco('Come sta la squadra', scheda([
      riga('In credito', String(d.conteggi.inCredito)),
      riga('In pari', String(d.conteggi.inPari)),
      riga('In debito', String(d.conteggi.inDebito)),
      riga('Obbligo di vendita', C().esc(kg(d.obbligoGrammi)))
    ])) +
    blocco('Socio per socio', d.righe.length
      ? '<div class="lista">' + d.righe.map(function (r) {
          return '<div class="card"><dl class="dettaglio">' +
            riga(r.nome, badgeStato(r.stato)) +
            riga('Presenze / capi', r.presenze + ' / ' + r.capi) +
            riga('Kg venduti', C().esc(kg(r.vendutoGrammi))) +
            riga('Kg ritirati', C().esc(kg(r.ritiratoGrammi))) +
            riga('Obbligo', C().esc(kg(r.obbligoGrammi))) +
            riga('Credito/Debito', '<strong>' +
              C().esc(App.core.pdf.etichettaSaldo(r)) + '</strong>') +
          '</dl></div>';
        }).join('') + '</div>'
      : vuoto('Nessun socio iscritto.'));
  }

  function corpoSocio(d) {
    var r = d.riga;
    return blocco(d.nome, scheda([
      riga('Stato', badgeStato(r.stato)),
      riga('Presenze', String(r.presenze)),
      riga('Capi abbattuti', String(r.capi)),
      riga('Kg venduti', C().esc(kg(r.vendutoGrammi))),
      riga('Kg ritirati', C().esc(kg(r.ritiratoGrammi))),
      riga('Obbligo', C().esc(kg(r.obbligoGrammi))),
      riga('Obbligo residuo', C().esc(kg(r.residuoObbligoGrammi))),
      riga('Credito/Debito', '<strong>' +
        C().esc(App.core.pdf.etichettaSaldo(r)) + '</strong>')
    ])) +
    blocco('Capi abbattuti', d.capi.length
      ? scheda(d.capi.map(function (x) {
          return riga(App.core.report.dataIta(x.data) + ' · ' + C().esc(x.codice),
            C().esc(x.sesso) + ' · ' + C().esc(x.classe) + ' · ' +
            C().esc(kg(x.pesoGrammi)));
        }))
      : vuoto('Nessun capo abbattuto da questo socio.')) +
    blocco('Vendite', d.vendite.length
      ? scheda(d.vendite.map(function (v) {
          return riga(App.core.report.dataIta(v.data) + ' · ' + C().esc(v.prodotto),
            C().esc(kg(v.pesoGrammi)) + ' · ' + C().esc(euro(v.prezzoCentKg)) + '/kg · ' +
            '<strong>' + C().esc(euro(v.totaleCent)) + '</strong>');
        }))
      : vuoto('Nessuna vendita registrata a questo socio.'));
  }

  var CORPI = {
    stagione: corpoStagione,
    giornate: corpoGiornate,
    abbattimenti: corpoAbbattimenti,
    carne: corpoCarne,
    soci: corpoSoci,
    socio: corpoSocio
  };

  // ---------- dettaglio ----------
  function renderDettaglio(params) {
    var c = C();
    var tipo = params.tipo;
    var voce = VOCI.filter(function (v) { return v.tipo === tipo; })[0];
    if (!voce) { App.ui.router.vai('#/report'); return Promise.resolve(); }

    return App.core.report.opzioniFiltri(filtriPuliti(tipo)).then(function (op) {
      // La scheda di un socio ha senso solo dopo aver scelto la persona.
      if (tipo === 'socio' && !filtri.membroId) {
        c.intestazione({ titolo: voce.titolo, sotto: 'Scegli un socio',
          indietro: '#/report' });
        c.monta(pannelloFiltri(op, tipo) +
          '<p class="nota-piede">Scegli un socio nei filtri qui sopra ' +
          'per vedere e stampare la sua scheda.</p>');
        collegaFiltri(tipo);
        return;
      }
      return App.core.report.costruisci(tipo, filtriPuliti(tipo)).then(function (d) {
        if (!d) {
          c.intestazione({ titolo: voce.titolo, indietro: '#/report' });
          c.monta('<div class="vuoto"><h2>Niente da mostrare</h2>' +
            '<p>Attiva una stagione o allarga i filtri.</p></div>');
          return;
        }
        var etichette = (d.filtri && d.filtri.etichette) || [];
        c.intestazione({
          titolo: voce.titolo,
          sotto: 'Stagione ' + d.stagioneNome,
          indietro: '#/report'
        });
        c.monta(pulsantePdf(tipo, null, 'Esporta PDF') +
          (etichette.length
            ? '<p class="nota-piede">' + c.esc(etichette.join(' · ')) + '</p>'
            : '') +
          pannelloFiltri(op, tipo) +
          CORPI[tipo](d));
        collegaFiltri(tipo);
      });
    });
  }

  App.ui.viste.report = { render: renderIndice };
  App.ui.viste.reportDettaglio = { render: renderDettaglio };
})(typeof window !== 'undefined' ? window : globalThis);
