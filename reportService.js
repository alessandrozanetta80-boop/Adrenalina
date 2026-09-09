(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // MOTORE DEI REPORT
  //
  // Qui non nasce nessun numero nuovo. Ogni cifra arriva dai service che
  // gia' la calcolano: carne, capi, giornate, presenze. Questo modulo si
  // limita ad aggregarli e a metterli in righe pronte da mostrare o da
  // stampare. Non scrive niente: e' di sola lettura, e per questo lo puo'
  // usare anche chi ha accesso in sola lettura.

  var TIPI = ['stagione', 'giornate', 'giornata', 'abbattimenti', 'carne', 'soci', 'socio'];

  function K() { return App.core.carne; }
  function euro(cent) { return App.core.quote.formattaEuro(cent); }
  function kg(grammi) { return App.core.carne.formattaKg(grammi); }

  function nomeMembro(m) {
    if (!m) return '—';
    return ((m.nome || '') + ' ' + (m.cognome || '')).trim() || '—';
  }

  function dataIta(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return String(iso);
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  // ---------- filtri ----------
  //
  // I filtri vengono capiti e applicati in un posto solo. La schermata e
  // il PDF chiamano questo stesso motore con gli stessi parametri, quindi
  // non possono mostrare due cose diverse.

  function giornoIso(v) {
    var s = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  function normalizzaFiltri(f, ctx) {
    var p = f || {};
    var stagioni = ctx.stagioni || [];
    var stagione = null;
    if (p.stagioneId) {
      stagione = stagioni.filter(function (s) { return s.id === p.stagioneId; })[0] || null;
    }
    // Senza una richiesta esplicita vale la stagione attiva: e' quella che
    // interessa quasi sempre, e la schermata la propone gia' scelta.
    if (!stagione) stagione = ctx.stagioneAttiva || null;

    var da = giornoIso(p.dataDa), a = giornoIso(p.dataA);
    // Date invertite: si raddrizzano invece di restituire il vuoto.
    if (da && a && da > a) { var t = da; da = a; a = t; }

    return {
      stagioneId: stagione ? stagione.id : null,
      stagione: stagione,
      dataDa: da,
      dataA: a,
      membroId: p.membroId || null,
      giornataId: p.giornataId || p.id || null
    };
  }

  // Non tutti i filtri hanno senso in tutti i report.
  //
  // Credito, debito e obbligo sono valori di STAGIONE: non esiste il
  // credito "del mese di novembre". Offrire un periodo dove il saldo
  // resta stagionale produrrebbe un foglio che mescola due cose diverse,
  // quindi in "Situazione soci" e nella scheda di un socio il periodo e
  // la singola giornata non si accettano proprio.
  var AMMESSI = {
    stagione:     ['stagioneId'],
    giornate:     ['stagioneId', 'dataDa', 'dataA', 'membroId', 'giornataId'],
    giornata:     ['stagioneId'],
    abbattimenti: ['stagioneId', 'dataDa', 'dataA', 'membroId', 'giornataId'],
    carne:        ['stagioneId', 'dataDa', 'dataA', 'membroId', 'giornataId'],
    soci:         ['stagioneId', 'membroId'],
    socio:        ['stagioneId', 'membroId']
  };

  function filtriAmmessi(tipo) {
    return (AMMESSI[tipo] || ['stagioneId']).slice();
  }

  // Toglie i filtri che quel report non accetta, invece di fingere di
  // applicarli. Cosi' un filtro rimasto acceso su un'altra schermata non
  // puo' sporcare i numeri di questa.
  function soloAmmessi(f, tipo) {
    var ok = {};
    filtriAmmessi(tipo).forEach(function (c) { ok[c] = true; });
    return {
      stagioneId: f.stagioneId,
      stagione: f.stagione,
      dataDa: ok.dataDa ? f.dataDa : null,
      dataA: ok.dataA ? f.dataA : null,
      membroId: ok.membroId ? f.membroId : null,
      giornataId: ok.giornataId ? f.giornataId : null
    };
  }

  function nelPeriodo(f, data) {
    if (!f.dataDa && !f.dataA) return true;
    var d = String(data || '').slice(0, 10);
    if (!d) return false;
    if (f.dataDa && d < f.dataDa) return false;
    if (f.dataA && d > f.dataA) return false;
    return true;
  }

  function giornataAmmessa(f, giornataId) {
    return !f.giornataId || f.giornataId === giornataId;
  }

  // Righe leggibili da stampare sotto il titolo, cosi' chi riceve il PDF
  // sa su che cosa sta guardando.
  function etichetteFiltri(f, nomi) {
    var e = [];
    if (f.dataDa && f.dataA) e.push('Dal ' + dataIta(f.dataDa) + ' al ' + dataIta(f.dataA));
    else if (f.dataDa) e.push('Dal ' + dataIta(f.dataDa));
    else if (f.dataA) e.push('Fino al ' + dataIta(f.dataA));
    if (f.giornataId) e.push('Giornata: ' + ((nomi && nomi.giornata) || '—'));
    if (f.membroId) e.push('Socio: ' + ((nomi && nomi.socio) || '—'));
    return e;
  }

  // Etichetta breve della stagione per i nomi di file: "2026/2027" -> "2026-27".
  function siglaStagione(nome) {
    var t = String(nome || '').trim();
    var m = t.match(/(\d{4})\D+(\d{2,4})/);
    if (m) return m[1] + '-' + m[2].slice(-2);
    return t.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '') || 'stagione';
  }

  // Ripulisce un nome di persona per usarlo in un nome di file.
  function pezzoNome(testo) {
    return String(testo || '').trim()
      .replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '') || 'Socio';
  }

  function nomeFile(tipo, dati) {
    var pezzo = {
      stagione: 'Stagione', giornate: 'Giornate', abbattimenti: 'Capi',
      carne: 'Carne', soci: 'Soci'
    }[tipo];
    if (tipo === 'giornata') {
      return 'Adrenalina-Giornata-' + (dati && dati.data ? dati.data : 'giornata') + '.pdf';
    }
    if (tipo === 'socio') {
      return 'Adrenalina-Socio-' + pezzoNome(dati ? dati.nome : '') + '-' +
        siglaStagione(dati ? dati.stagioneNome : '') + '.pdf';
    }
    return 'Adrenalina-' + (pezzo || 'Report') + '-' +
      siglaStagione(dati ? dati.stagioneNome : '') + '.pdf';
  }

  // Testata comune a tutti i report.
  function testata(ctx, titolo, f, nomi) {
    var st = f && f.stagione ? f.stagione : (ctx.stagioneAttiva || null);
    return {
      titolo: titolo,
      squadraNome: ctx.squadra ? ctx.squadra.nome : '—',
      stagioneNome: st ? st.nome : '—',
      stagioneId: st ? st.id : null,
      filtri: f ? {
        stagioneId: f.stagioneId, dataDa: f.dataDa, dataA: f.dataA,
        membroId: f.membroId, giornataId: f.giornataId,
        etichette: etichetteFiltri(f, nomi)
      } : null,
      generatoIl: new Date().toISOString()
    };
  }

  // Credito e debito arrivano gia' calcolati dal motore carne: qui si
  // riducono a un solo saldo leggibile, senza reinventare la regola.
  function saldoSocio(s) {
    var saldo = (s.creditoDisponibileGrammi || 0) - (s.debitoCarneGrammi || 0);
    return {
      saldoGrammi: saldo,
      stato: saldo > 0 ? 'IN CREDITO' : (saldo < 0 ? 'IN DEBITO' : 'IN PARI')
    };
  }

  // Riepiloghi dei lotti della stagione, calcolati dal motore carne.
  // Il filtro toglie righe, non cambia nessun numero.
  function lottiDellaStagione(f) {
    return App.data.repo.leggiStore(['lottiCarne']).then(function (d) {
      var lotti = d.lottiCarne.filter(function (l) {
        return l.stagioneId === f.stagioneId && giornataAmmessa(f, l.giornataId);
      });
      return Promise.all(lotti.map(function (l) {
        return K().riepilogoLotto(l.id);
      })).then(function (r) {
        return r.filter(function (x) {
          return !!x && nelPeriodo(f, x.giornata ? x.giornata.data : null);
        });
      });
    });
  }

  function righeVendite(riepiloghiLotto, f) {
    var righe = [];
    riepiloghiLotto.forEach(function (r) {
      r.venditeValide.forEach(function (v) {
        if (f && f.membroId && v.vendutaDaMembroId !== f.membroId) return;
        if (f && !nelPeriodo(f, v.data)) return;
        righe.push({
          data: v.data,
          venditore: (v.vendutaDa || '').trim() || '—',
          venditoreMembroId: v.vendutaDaMembroId || null,
          prodotto: App.costanti.etichettaTaglio(v.tipoTaglio),
          tipoTaglio: v.tipoTaglio,
          pesoGrammi: v.pesoGrammi,
          prezzoCentKg: v.prezzoCentKg,
          totaleCent: K().ricavoCent(v.pesoGrammi, v.prezzoCentKg)
        });
      });
    });
    righe.sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    return righe;
  }

  function filtraCapi(f, righe) {
    return righe.filter(function (r) {
      if (r.capo.annullato) return false;
      if (!giornataAmmessa(f, r.capo.giornataId)) return false;
      if (f.membroId && r.capo.tiratoreMembroId !== f.membroId) return false;
      return nelPeriodo(f, r.data);
    });
  }

  // Capi validi della stagione, gia' arricchiti da capoService.
  //
  // capoService tiene il registro della sola stagione attiva. Quando si
  // chiede un'altra stagione si rileggono gli stessi store ricomponendo
  // la stessa riga: il banco verifica che sulla stagione attiva le due
  // strade diano esattamente lo stesso risultato.
  function capiDellaStagione(f) {
    return App.core.capo.elenco().then(function (d) {
      var attiva = d.contesto.stagioneAttiva ? d.contesto.stagioneAttiva.id : null;
      if (!f.stagioneId || f.stagioneId === attiva) {
        return { contesto: d.contesto, righe: filtraCapi(f, d.righe) };
      }
      return App.data.repo.leggiStore(['abbattimenti', 'giornate', 'membri'])
        .then(function (s) {
          var gPerId = {}, mPerId = {};
          s.giornate.forEach(function (g) { gPerId[g.id] = g; });
          s.membri.forEach(function (m) { mPerId[m.id] = m; });
          var righe = s.abbattimenti
            .filter(function (a) { return a.stagioneId === f.stagioneId; })
            .map(function (a) {
              var g = gPerId[a.giornataId] || null;
              return { capo: a, giornata: g, zona: g ? (g.zona || null) : null,
                data: g ? g.data : null, tiratore: mPerId[a.tiratoreMembroId] || null };
            });
          righe.sort(function (x, y) {
            var dx = x.data || '', dy = y.data || '';
            if (dx !== dy) return dy.localeCompare(dx);
            return String(y.capo.codiceCapo).localeCompare(String(x.capo.codiceCapo));
          });
          return { contesto: d.contesto, righe: filtraCapi(f, righe) };
        });
    });
  }

  // Giornate della stagione, con lo stesso criterio: elenco certificato
  // per la stagione attiva, rilettura degli store per le altre.
  function giornateDellaStagione(f, ammesse) {
    function filtra(righe) {
      return righe.filter(function (r) {
        var g = r.giornata;
        if (!giornataAmmessa(f, g.id)) return false;
        if (ammesse && !ammesse[g.id]) return false;
        return nelPeriodo(f, g.data);
      });
    }
    return App.core.giornata.elenco().then(function (d) {
      var attiva = d.contesto.stagioneAttiva ? d.contesto.stagioneAttiva.id : null;
      if (!f.stagioneId || f.stagioneId === attiva) {
        return { contesto: d.contesto, righe: filtra(d.righe) };
      }
      return App.data.repo.leggiStore(['giornate', 'presenze', 'membri'])
        .then(function (s) {
          var mPerId = {};
          s.membri.forEach(function (m) { mPerId[m.id] = m; });
          var presenti = {};
          s.presenze.forEach(function (p) {
            if (p.stato !== App.costanti.STATO_PRESENZA.PRESENTE) return;
            presenti[p.giornataId] = (presenti[p.giornataId] || 0) + 1;
          });
          var righe = s.giornate
            .filter(function (g) { return g.stagioneId === f.stagioneId; })
            .map(function (g) {
              return {
                giornata: g,
                capocaccia: g.capocacciaMembroId
                  ? (mPerId[g.capocacciaMembroId] || null) : null,
                presenti: presenti[g.id] || 0
              };
            });
          righe.sort(function (a, b) {
            return String(b.giornata.data).localeCompare(String(a.giornata.data));
          });
          return { contesto: d.contesto, righe: filtra(righe) };
        });
    });
  }

  // Giornate in cui un socio risulta presente: serve quando si filtra
  // per persona, per non mostrargli battute a cui non c'era.
  function giornateDelMembro(f) {
    if (!f.membroId) return Promise.resolve(null);
    return App.data.repo.leggiStore(['presenze']).then(function (d) {
      var set = {};
      d.presenze.forEach(function (p) {
        if (p.membroId !== f.membroId) return;
        if (p.stato !== App.costanti.STATO_PRESENZA.PRESENTE) return;
        set[p.giornataId] = true;
      });
      return set;
    });
  }

  // Nome del socio e data della giornata usati nelle etichette dei filtri.
  function nomiFiltro(f) {
    if (!f.membroId && !f.giornataId) return Promise.resolve(null);
    return App.data.repo.leggiStore(['membri', 'giornate']).then(function (d) {
      var out = {};
      if (f.membroId) {
        var m = d.membri.filter(function (x) { return x.id === f.membroId; })[0];
        out.socio = nomeMembro(m);
      }
      if (f.giornataId) {
        var g = d.giornate.filter(function (x) { return x.id === f.giornataId; })[0];
        out.giornata = g ? (dataIta(g.data) + ' · ' + (g.zona || '—')) : '—';
      }
      return out;
    });
  }

  function classificaCacciatori(righeCapi) {
    var per = {};
    righeCapi.forEach(function (r) {
      var id = r.capo.tiratoreMembroId || 'senza';
      if (!per[id]) {
        per[id] = { membroId: r.capo.tiratoreMembroId || null,
          nome: nomeMembro(r.tiratore), capi: 0, pesoGrammi: 0 };
      }
      per[id].capi++;
      per[id].pesoGrammi += r.capo.pesoGrammi || 0;
    });
    return Object.keys(per).map(function (k) { return per[k]; })
      .sort(function (a, b) {
        if (b.capi !== a.capi) return b.capi - a.capi;
        if (b.pesoGrammi !== a.pesoGrammi) return b.pesoGrammi - a.pesoGrammi;
        return a.nome.localeCompare(b.nome);
      });
  }

  // Totali della carne.
  //
  // Senza filtri sono esattamente quelli del motore carne. Con un filtro
  // su date o su una singola giornata si sommano i lotti rimasti: sono
  // gli stessi riepiloghi gia' calcolati dal motore, non numeri nuovi.
  // Il banco verifica che senza filtri le due strade coincidano.
  function totaliCarne(f, stagione, lotti, vendite) {
    // Filtro per venditore: il foglio parla di quella persona, quindi i
    // totali sono i suoi e soltanto i suoi. Carne netta, ritirata e
    // residua sono numeri della squadra e non appartengono a nessun
    // venditore: qui restano fuori invece di essere spacciati per suoi.
    if (f.membroId) {
      return {
        soloVenditore: true,
        nettaGrammi: null,
        ritiratoGrammi: null,
        residuoGrammi: null,
        vendutoGrammi: vendite.reduce(function (a, v) { return a + v.pesoGrammi; }, 0),
        ricavoCent: vendite.reduce(function (a, v) { return a + v.totaleCent; }, 0)
      };
    }
    if (!f.dataDa && !f.dataA && !f.giornataId) {
      return {
        soloVenditore: false,
        nettaGrammi: stagione.totali.disponibileGrammi,
        vendutoGrammi: stagione.totali.vendutoGrammi,
        ritiratoGrammi: stagione.totali.ritiratoGrammi,
        residuoGrammi: stagione.totali.residuoGrammi,
        ricavoCent: stagione.totali.ricavoTotaleCent
      };
    }
    function somma(campo) {
      return lotti.reduce(function (a, r) { return a + (r[campo] || 0); }, 0);
    }
    return {
      soloVenditore: false,
      nettaGrammi: somma('disponibileGrammi'),
      vendutoGrammi: somma('vendutoGrammi'),
      ritiratoGrammi: somma('ritiratoGrammi'),
      residuoGrammi: somma('residuoGrammi'),
      ricavoCent: somma('ricavoTotaleCent')
    };
  }

  // Capi per giornata. Il filtro sul socio qui non si applica: il numero
  // di capi di una battuta e' della battuta, non di chi la guarda.
  function capiPerGiornata(f) {
    var senzaSocio = {
      stagioneId: f.stagioneId, stagione: f.stagione,
      dataDa: f.dataDa, dataA: f.dataA, membroId: null, giornataId: f.giornataId
    };
    return capiDellaStagione(senzaSocio).then(function (capi) {
      var per = {};
      capi.righe.forEach(function (r) {
        var g = r.capo.giornataId;
        if (!per[g]) per[g] = { capi: 0, pesoGrammi: 0 };
        per[g].capi++;
        per[g].pesoGrammi += r.capo.pesoGrammi || 0;
      });
      return per;
    });
  }

  // Conta le presenze per socio nelle giornate ammesse dal filtro.
  function presenzePerMembro(idGiornate) {
    return App.data.repo.leggiStore(['presenze']).then(function (d) {
      var per = {};
      d.presenze.forEach(function (p) {
        if (!idGiornate[p.giornataId]) return;
        if (p.stato !== App.costanti.STATO_PRESENZA.PRESENTE) return;
        per[p.membroId] = (per[p.membroId] || 0) + 1;
      });
      return per;
    });
  }

  // Apre ogni report: normalizza i filtri e prepara le etichette.
  function avvio(filtri, tipo) {
    return App.core.squadra.contesto().then(function (ctx) {
      var f = soloAmmessi(normalizzaFiltri(filtri, ctx), tipo);
      if (!f.stagioneId) return null;
      return nomiFiltro(f).then(function (nomi) {
        return { ctx: ctx, f: f, nomi: nomi };
      });
    });
  }

  // ---------- a. riepilogo stagione ----------
  function datiStagione(filtri) {
    return avvio(filtri, 'stagione').then(function (base) {
      if (!base) return null;
      var ctx = base.ctx, f = base.f;
      return giornateDelMembro(f).then(function (ammesse) {
        return Promise.all([
          giornateDellaStagione(f, ammesse),
          capiDellaStagione(f),
          K().riepilogoStagione(f.stagioneId),
          lottiDellaStagione(f)
        ]).then(function (res) {
          var giornate = res[0], capi = res[1], carne = res[2], lotti = res[3];

          var idGiornate = {};
          giornate.righe.forEach(function (r) { idGiornate[r.giornata.id] = true; });

          return presenzePerMembro(idGiornate).then(function (presenze) {
            var partecipazioni = 0;
            Object.keys(presenze).forEach(function (idMembro) {
              if (f.membroId && idMembro !== f.membroId) return;
              partecipazioni += presenze[idMembro];
            });

            var effettuate = giornate.righe.filter(function (r) {
              return r.giornata.stato === 'COMPLETATA';
            }).length;
            var pesoTotale = capi.righe.reduce(function (a, r) {
              return a + (r.capo.pesoGrammi || 0);
            }, 0);
            var tc = totaliCarne(f, carne, lotti);

            var out = testata(ctx, 'Riepilogo stagione', f, base.nomi);
            out.totali = {
              giornateProgrammate: giornate.righe.length,
              giornateEffettuate: effettuate,
              partecipazioni: partecipazioni,
              capiAbbattuti: capi.righe.length,
              pesoTotaleGrammi: pesoTotale,
              carneNettaGrammi: tc.nettaGrammi,
              vendutoGrammi: tc.vendutoGrammi,
              ritiratoGrammi: tc.ritiratoGrammi,
              residuoGrammi: tc.residuoGrammi,
              ricavoCent: tc.ricavoCent
            };
            out.cacciatori = classificaCacciatori(capi.righe);
            out.soci = carne.soci
              .filter(function (s) { return !f.membroId || s.membro.id === f.membroId; })
              .map(function (s) {
                var sa = saldoSocio(s);
                return {
                  membroId: s.membro.id,
                  nome: nomeMembro(s.membro),
                  vendutoGrammi: s.vendutoAttribuitoGrammi,
                  ritiratoGrammi: s.creditoRitiratoGrammi,
                  obbligoGrammi: s.obbligoGrammi,
                  residuoObbligoGrammi: s.residuoObbligoGrammi,
                  saldoGrammi: sa.saldoGrammi,
                  stato: sa.stato
                };
              });
            return out;
          });
        });
      });
    });
  }

  // ---------- b. giornate ----------
  function datiGiornate(filtri) {
    return avvio(filtri, 'giornate').then(function (base) {
      if (!base) return null;
      var ctx = base.ctx, f = base.f;
      return giornateDelMembro(f).then(function (ammesse) {
        return Promise.all([
          giornateDellaStagione(f, ammesse),
          capiPerGiornata(f),
          lottiDellaStagione(f)
        ]).then(function (res) {
          var giornate = res[0], perGiornata = res[1], lotti = res[2];

          var carnePerGiornata = {};
          lotti.forEach(function (r) { carnePerGiornata[r.lotto.giornataId] = r; });

          var out = testata(ctx, 'Giornate', f, base.nomi);
          out.righe = giornate.righe.map(function (r) {
            var g = r.giornata;
            var c = perGiornata[g.id] || { capi: 0, pesoGrammi: 0 };
            var k = carnePerGiornata[g.id] || null;
            return {
              giornataId: g.id,
              data: g.data,
              zona: g.zona || '—',
              stato: App.costanti.etichettaStatoGiornata
                ? App.costanti.etichettaStatoGiornata(g.stato) : g.stato,
              presenti: r.presenti,
              capi: c.capi,
              pesoGrammi: c.pesoGrammi,
              carneNettaGrammi: k ? k.disponibileGrammi : 0
            };
          });
          out.totali = {
            giornate: out.righe.length,
            presenze: out.righe.reduce(function (a, x) { return a + x.presenti; }, 0),
            capi: out.righe.reduce(function (a, x) { return a + x.capi; }, 0),
            pesoGrammi: out.righe.reduce(function (a, x) { return a + x.pesoGrammi; }, 0),
            carneNettaGrammi: out.righe.reduce(function (a, x) {
              return a + x.carneNettaGrammi; }, 0)
          };
          return out;
        });
      });
    });
  }

  // ---------- b-bis. singola giornata ----------
  function datiGiornata(giornataId) {
    return App.core.giornata.scheda(giornataId).then(function (scheda) {
      if (!scheda) return null;
      var g = scheda.giornata;
      return Promise.all([
        App.core.presenza.perGiornata(giornataId),
        App.core.capo.perGiornata(giornataId),
        K().perGiornata(giornataId)
      ]).then(function (res) {
        var presenze = res[0], capi = res[1], carne = res[2];

        var out = testata(scheda.contesto, 'Giornata del ' + dataIta(g.data));
        if (scheda.stagione) out.stagioneNome = scheda.stagione.nome;
        out.giornataId = g.id;
        out.data = g.data;
        out.zona = g.zona || '—';
        out.orarioRitrovo = g.orarioRitrovo || '';
        out.capocaccia = scheda.capocaccia ? nomeMembro(scheda.capocaccia) : '—';
        out.note = g.note || '';

        var SP = App.costanti.STATO_PRESENZA;
        var righePresenze = (presenze && presenze.righe) ? presenze.righe : [];
        out.presenti = righePresenze
          .filter(function (r) { return r.stato === SP.PRESENTE; })
          .map(function (r) { return nomeMembro(r.membro); });
        out.assenti = righePresenze
          .filter(function (r) { return r.stato === SP.ASSENTE; })
          .map(function (r) { return nomeMembro(r.membro); });
        out.aLavoro = righePresenze
          .filter(function (r) { return r.stato === SP.LAVORO; })
          .map(function (r) { return nomeMembro(r.membro); });

        out.capi = capi.tutti
          .filter(function (x) { return !x.capo.annullato; })
          .map(function (x) {
            return {
              codice: x.capo.codiceCapo || '—',
              abbattitore: nomeMembro(x.tiratore),
              sesso: App.costanti.etichettaSesso(x.capo.sesso),
              classe: App.costanti.etichettaClasseEta(x.capo.classeEta),
              pesoGrammi: x.capo.pesoGrammi || 0,
              recuperato: x.capo.recuperato !== false
            };
          });
        out.pesoCapiGrammi = out.capi.reduce(function (a, x) {
          return a + x.pesoGrammi; }, 0);

        out.carne = carne ? {
          nettaGrammi: carne.disponibileGrammi,
          vendutoGrammi: carne.vendutoGrammi,
          ritiratoGrammi: carne.ritiratoGrammi,
          residuoGrammi: carne.residuoGrammi,
          ricavoCent: carne.ricavoTotaleCent
        } : null;
        out.vendite = carne ? righeVendite([carne]) : [];
        return out;
      });
    });
  }

  // ---------- c. abbattimenti ----------
  function datiAbbattimenti(filtri) {
    return avvio(filtri, 'abbattimenti').then(function (base) {
      if (!base) return null;
      var f = base.f;
      return capiDellaStagione(f).then(function (capi) {
        var out = testata(base.ctx, 'Abbattimenti', f, base.nomi);
        out.totali = {
          capi: capi.righe.length,
          pesoGrammi: capi.righe.reduce(function (a, r) {
            return a + (r.capo.pesoGrammi || 0); }, 0)
        };
        out.classifica = classificaCacciatori(capi.righe);
        out.dettaglio = capi.righe.slice().sort(function (a, b) {
          var da = a.data || '', db = b.data || '';
          if (da !== db) return da.localeCompare(db);
          return String(a.capo.codiceCapo).localeCompare(String(b.capo.codiceCapo));
        }).map(function (r) {
          return {
            data: r.data,
            codice: r.capo.codiceCapo || '—',
            abbattitore: nomeMembro(r.tiratore),
            sesso: App.costanti.etichettaSesso(r.capo.sesso),
            classe: App.costanti.etichettaClasseEta(r.capo.classeEta),
            pesoGrammi: r.capo.pesoGrammi || 0
          };
        });
        return out;
      });
    });
  }

  // ---------- d. carne ----------
  function datiCarne(filtri) {
    return avvio(filtri, 'carne').then(function (base) {
      if (!base) return null;
      var f = base.f;
      return Promise.all([
        K().riepilogoStagione(f.stagioneId),
        lottiDellaStagione(f),
        capiPerGiornata(f)
      ]).then(function (res) {
        var stagione = res[0], lotti = res[1], perGiornata = res[2];

        var out = testata(base.ctx, 'Carne', f, base.nomi);
        // Le righe delle vendite si preparano per prime: con il filtro sul
        // venditore i totali nascono da queste stesse righe, cosi' il
        // totale della tabella non puo' che coincidere con quello che si
        // vede sopra.
        out.vendite = righeVendite(lotti, f);
        out.soloVenditore = !!f.membroId;
        out.totali = totaliCarne(f, stagione, lotti, out.vendite);
        // "Per battuta" e' una tabella di squadra: con il filtro sul
        // venditore non ha senso e non si mostra.
        out.lotti = out.soloVenditore ? [] : lotti.map(function (r) {
          var c = perGiornata[r.lotto.giornataId] || { capi: 0 };
          return {
            lottoId: r.lotto.id,
            giornataId: r.lotto.giornataId,
            data: r.giornata ? r.giornata.data : null,
            zona: r.giornata ? (r.giornata.zona || '—') : '—',
            capi: c.capi,
            nettaGrammi: r.disponibileGrammi,
            vendutoGrammi: r.vendutoGrammi,
            ritiratoGrammi: r.ritiratoGrammi,
            residuoGrammi: r.residuoGrammi
          };
        }).sort(function (a, b) {
          return String(a.data).localeCompare(String(b.data));
        });

        // Il venditore e' quello registrato sulla vendita: l'intera
        // quantita' resta sua, non viene divisa fra i presenti.
        // Con i filtri attivi il riepilogo si rifa' sulle righe rimaste,
        // sempre con la stessa regola.
        var soloTotali = !f.dataDa && !f.dataA && !f.giornataId && !f.membroId;
        if (soloTotali) {
          out.venditori = stagione.venditori.map(function (v) {
            return { nome: v.nome, pesoGrammi: v.pesoGrammi,
              ricavoCent: v.ricavoCent, vendite: v.vendite };
          });
        } else {
          var perVenditore = {};
          out.vendite.forEach(function (v) {
            var chiave = v.venditoreMembroId || v.venditore;
            if (!perVenditore[chiave]) {
              perVenditore[chiave] = { nome: v.venditore, pesoGrammi: 0,
                ricavoCent: 0, vendite: 0 };
            }
            perVenditore[chiave].pesoGrammi += v.pesoGrammi;
            perVenditore[chiave].ricavoCent += v.totaleCent;
            perVenditore[chiave].vendite++;
          });
          out.venditori = Object.keys(perVenditore)
            .map(function (k) { return perVenditore[k]; })
            .sort(function (a, b) { return b.pesoGrammi - a.pesoGrammi; });
        }

        var perProdotto = {};
        out.vendite.forEach(function (v) {
          if (!perProdotto[v.tipoTaglio]) {
            perProdotto[v.tipoTaglio] = { prodotto: v.prodotto,
              tipoTaglio: v.tipoTaglio, pesoGrammi: 0, ricavoCent: 0 };
          }
          perProdotto[v.tipoTaglio].pesoGrammi += v.pesoGrammi;
          perProdotto[v.tipoTaglio].ricavoCent += v.totaleCent;
        });
        out.prodotti = Object.keys(perProdotto)
          .map(function (k) { return perProdotto[k]; })
          .sort(function (a, b) { return b.pesoGrammi - a.pesoGrammi; });
        return out;
      });
    });
  }

  // ---------- e. situazione soci ----------
  function datiSoci(filtri) {
    return avvio(filtri, 'soci').then(function (base) {
      if (!base) return null;
      var f = base.f;
      return giornateDelMembro(f).then(function (ammesse) {
        return Promise.all([
          K().riepilogoStagione(f.stagioneId),
          giornateDellaStagione(f, ammesse),
          capiDellaStagione(f)
        ]).then(function (res) {
          var carne = res[0], giornate = res[1], capi = res[2];

          var idGiornate = {};
          giornate.righe.forEach(function (r) { idGiornate[r.giornata.id] = true; });
          var capiPerMembro = {};
          capi.righe.forEach(function (r) {
            capiPerMembro[r.capo.tiratoreMembroId] =
              (capiPerMembro[r.capo.tiratoreMembroId] || 0) + 1;
          });

          return presenzePerMembro(idGiornate).then(function (presenze) {
            var out = testata(base.ctx, 'Situazione soci', f, base.nomi);
            out.obbligoGrammi = carne.obbligoGrammi;
            out.righe = carne.soci
              .filter(function (s) { return !f.membroId || s.membro.id === f.membroId; })
              .map(function (s) {
                var sa = saldoSocio(s);
                return {
                  membroId: s.membro.id,
                  nome: nomeMembro(s.membro),
                  presenze: presenze[s.membro.id] || 0,
                  capi: capiPerMembro[s.membro.id] || 0,
                  vendutoGrammi: s.vendutoAttribuitoGrammi,
                  ritiratoGrammi: s.creditoRitiratoGrammi,
                  obbligoGrammi: s.obbligoGrammi,
                  residuoObbligoGrammi: s.residuoObbligoGrammi,
                  creditoDisponibileGrammi: s.creditoDisponibileGrammi,
                  debitoCarneGrammi: s.debitoCarneGrammi,
                  saldoGrammi: sa.saldoGrammi,
                  stato: sa.stato
                };
              });
            out.conteggi = {
              inCredito: out.righe.filter(function (r) { return r.stato === 'IN CREDITO'; }).length,
              inPari: out.righe.filter(function (r) { return r.stato === 'IN PARI'; }).length,
              inDebito: out.righe.filter(function (r) { return r.stato === 'IN DEBITO'; }).length
            };
            return out;
          });
        });
      });
    });
  }

  // ---------- f. singolo socio ----------
  //
  // La scheda di una persona sola. Non nasce nessun numero nuovo: sono le
  // stesse righe di "Situazione soci", ristrette a lui, piu' le sue
  // vendite e i suoi capi presi dagli stessi elenchi.
  function datiSocio(filtri) {
    var p = filtri || {};
    if (!p.membroId) {
      return Promise.reject(new Error('Serve un socio per questo report.'));
    }
    return datiSoci(p).then(function (soci) {
      if (!soci) return null;
      var riga = soci.righe[0];
      if (!riga) return null;
      var f = {
        stagioneId: soci.stagioneId, membroId: p.membroId,
        dataDa: soci.filtri ? soci.filtri.dataDa : null,
        dataA: soci.filtri ? soci.filtri.dataA : null,
        giornataId: soci.filtri ? soci.filtri.giornataId : null
      };
      return Promise.all([
        capiDellaStagione(f),
        lottiDellaStagione(f)
      ]).then(function (res) {
        var capi = res[0], lotti = res[1];
        var out = {
          titolo: 'Scheda socio',
          squadraNome: soci.squadraNome,
          stagioneNome: soci.stagioneNome,
          stagioneId: soci.stagioneId,
          filtri: soci.filtri,
          generatoIl: soci.generatoIl,
          membroId: riga.membroId,
          nome: riga.nome,
          obbligoGrammi: riga.obbligoGrammi,
          riga: riga
        };
        out.capi = capi.righe.slice().sort(function (a, b) {
          return String(a.data).localeCompare(String(b.data));
        }).map(function (r) {
          return {
            data: r.data,
            codice: r.capo.codiceCapo || '—',
            sesso: App.costanti.etichettaSesso(r.capo.sesso),
            classe: App.costanti.etichettaClasseEta(r.capo.classeEta),
            pesoGrammi: r.capo.pesoGrammi || 0
          };
        });
        out.vendite = righeVendite(lotti, f);
        return out;
      });
    });
  }

  // Punto unico di ingresso: la schermata e il PDF chiedono gli stessi dati
  // allo stesso posto, cosi' non possono divergere.
  function costruisci(tipo, params) {
    var p = params || {};
    if (tipo === 'stagione') return datiStagione(p);
    if (tipo === 'giornate') return datiGiornate(p);
    if (tipo === 'giornata') return datiGiornata(p.id || p.giornataId);
    if (tipo === 'abbattimenti') return datiAbbattimenti(p);
    if (tipo === 'carne') return datiCarne(p);
    if (tipo === 'soci') return datiSoci(p);
    if (tipo === 'socio') return datiSocio(p);
    return Promise.reject(new Error('Report sconosciuto: ' + tipo));
  }

  // Elenchi per i menu a tendina dei filtri. Sola lettura, come tutto
  // il resto del modulo.
  function opzioniFiltri(filtri) {
    return App.core.squadra.contesto().then(function (ctx) {
      var f = normalizzaFiltri(filtri, ctx);
      return App.data.repo.leggiStore(['giornate', 'membri', 'iscrizioni'])
        .then(function (d) {
          var iscritti = {};
          d.iscrizioni.forEach(function (i) {
            if (i.stagioneId === f.stagioneId) iscritti[i.membroId] = true;
          });
          var soci = d.membri
            .filter(function (m) { return iscritti[m.id]; })
            .map(function (m) { return { id: m.id, nome: nomeMembro(m) }; })
            .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
          var giornate = d.giornate
            .filter(function (g) { return g.stagioneId === f.stagioneId; })
            .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); })
            .map(function (g) {
              return { id: g.id, data: g.data,
                etichetta: dataIta(g.data) + ' · ' + (g.zona || '—') };
            });
          return {
            filtri: f,
            stagioni: (ctx.stagioni || []).map(function (s) {
              return { id: s.id, nome: s.nome, attiva: !!(ctx.stagioneAttiva &&
                ctx.stagioneAttiva.id === s.id) };
            }),
            soci: soci,
            giornate: giornate
          };
        });
    });
  }

  App.core.report = {
    TIPI: TIPI,
    costruisci: costruisci,
    stagione: datiStagione,
    giornate: datiGiornate,
    giornata: datiGiornata,
    abbattimenti: datiAbbattimenti,
    carne: datiCarne,
    soci: datiSoci,
    socio: datiSocio,
    opzioniFiltri: opzioniFiltri,
    filtriAmmessi: filtriAmmessi,
    normalizzaFiltri: normalizzaFiltri,
    nomeFile: nomeFile,
    dataIta: dataIta,
    siglaStagione: siglaStagione,
    saldoSocio: saldoSocio,
    kg: kg,
    euro: euro
  };
})(typeof window !== 'undefined' ? window : globalThis);
