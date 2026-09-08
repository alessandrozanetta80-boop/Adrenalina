(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  var SP = App.costanti.STATO_PRESENZA;

  // ============================================================
  // Regole del modulo carne, in breve.
  //
  // 1. La carne netta della battuta si inserisce a mano: NON si ricava
  //    dal peso dei capi abbattuti. Sono due cose diverse.
  // 2. Alla creazione del lotto si fissa uno SNAPSHOT dei partecipanti
  //    PRESENTI. Le presenze modificate dopo non riscrivono la storia.
  // 3. Tre conti separati, che non vanno confusi:
  //      - quota teorica  = carne disponibile / partecipanti
  //      - obbligo di vendita stagionale (20 kg) = quanto il socio ha
  //        gia' fatto vendere alla squadra
  //      - credito carne = la stessa quantita' venduta, che il socio
  //        potra' ritirare in seguito
  //    Raggiungere l'obbligo NON azzera il credito.
  // 4. Nessun saldo memorizzato: obbligo, credito e residui sono sempre
  //    derivati dai movimenti registrati.
  // ============================================================

  // ---------- conversioni ----------
  function parseKgInGrammi(testo) { return App.core.capo.parseKgInGrammi(testo); }

  function formattaKg(grammi) {
    var n = (Number(grammi) || 0) / 1000;
    var testo;
    try {
      testo = n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    } catch (e) {
      testo = n.toFixed(1).replace('.', ',');
    }
    return testo + ' kg';
  }

  function kgPerInput(grammi) {
    return ((Number(grammi) || 0) / 1000).toFixed(1).replace('.', ',');
  }

  function interoPositivo(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v > 0;
  }
  function interoNonNegativo(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0;
  }

  // Ricavo di una vendita: grammi x cent/kg / 1000, arrotondato al centesimo.
  function ricavoCent(pesoGrammi, prezzoCentKg) {
    return Math.round((Number(pesoGrammi) || 0) * (Number(prezzoCentKg) || 0) / 1000);
  }

  // ---------- ripartizione deterministica ----------
  // Divide `totale` grammi fra n quote intere la cui somma e' esattamente
  // `totale`. I grammi che avanzano vanno ai primi della lista ordinata.
  function ripartisci(totale, n) {
    if (n <= 0) return [];
    var base = Math.floor(totale / n);
    var resto = totale - base * n;
    var out = [];
    for (var i = 0; i < n; i++) out.push(base + (i < resto ? 1 : 0));
    return out;
  }

  // Ordinamento stabile dei partecipanti: cognome, nome, id.
  function ordinaMembri(membri) {
    return membri.slice().sort(function (a, b) {
      var c = (a.cognome || '').localeCompare(b.cognome || '', 'it');
      if (c !== 0) return c;
      c = (a.nome || '').localeCompare(b.nome || '', 'it');
      if (c !== 0) return c;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  // ---------- configurazione della stagione ----------
  function configPerStagione(stagioneId) {
    return App.data.configCarne.perStagione(stagioneId).then(function (c) {
      if (c) return c;
      // Nessun record: si usano i valori predefiniti, senza scrivere nulla.
      return {
        id: null,
        stagioneId: stagioneId,
        obbligoVenditaGrammi: App.costanti.OBBLIGO_VENDITA_GRAMMI_PREDEFINITO,
        prezziCentKg: App.costanti.prezziPredefiniti(),
        demo: false
      };
    });
  }

  function salvaConfig(stagioneId, campi) {
    var errori = {};
    if (!interoNonNegativo(campi.obbligoVenditaGrammi)) {
      errori.obbligoVenditaGrammi = 'Obbligo di vendita non valido.';
    }
    var prezzi = campi.prezziCentKg || {};
    App.costanti.TIPI_TAGLIO.forEach(function (t) {
      if (!interoNonNegativo(prezzi[t.codice])) {
        errori.prezziCentKg = 'Prezzo non valido per ' + t.etichetta + '.';
      }
    });
    if (Object.keys(errori).length) {
      var e = new Error('Configurazione carne non valida.'); e.errori = errori; throw e;
    }
    return App.data.configCarne.perStagione(stagioneId).then(function (esistente) {
      if (esistente) {
        esistente.obbligoVenditaGrammi = campi.obbligoVenditaGrammi;
        esistente.prezziCentKg = prezzi;
        return App.data.configCarne.salva(esistente).then(function () { return esistente; });
      }
      var nuovo = App.data.repo.timbraCreazione({
        id: App.core.idDeterministici.configCarne(stagioneId),
        stagioneId: stagioneId,
        obbligoVenditaGrammi: campi.obbligoVenditaGrammi,
        prezziCentKg: prezzi,
        demo: false
      });
      return App.data.configCarne.salva(nuovo).then(function () { return nuovo; });
    });
  }

  // ---------- lotto e snapshot ----------
  // Partecipanti PRESENTI della giornata, ordinati. Assente, lavoro e
  // non segnato restano fuori.
  function presentiDiGiornata(giornataId) {
    return App.data.repo.leggiStore(['presenze', 'membri']).then(function (d) {
      var idPresenti = {};
      d.presenze.forEach(function (p) {
        if (p.giornataId === giornataId && p.stato === SP.PRESENTE) idPresenti[p.membroId] = true;
      });
      return ordinaMembri(d.membri.filter(function (m) { return idPresenti[m.id]; }));
    });
  }

  // Debito carne di un socio nella stagione, PRIMA di considerare un
  // eventuale nuovo lotto. Dato derivato, mai memorizzato:
  //   consegne ricevute senza diritto - compensazioni gia' applicate.
  function debitiStagione(stagioneId, escludiLottoId) {
    return App.data.repo.leggiStore(['lottiCarne', 'quoteCarne', 'ritiriCarne'])
      .then(function (d) {
        var idLotti = {};
        d.lottiCarne.forEach(function (l) {
          if (l.stagioneId === stagioneId && l.id !== escludiLottoId) idLotti[l.id] = true;
        });
        var debiti = {};
        d.ritiriCarne.forEach(function (r) {
          if (r.annullato) return;
          if (r.tipoMovimento !== 'CONSEGNA_SENZA_DIRITTO') return;
          if (r.stagioneId !== stagioneId) return;
          debiti[r.membroId] = (debiti[r.membroId] || 0) + r.pesoGrammi;
        });
        d.quoteCarne.forEach(function (q) {
          if (!idLotti[q.lottoCarneId]) return;
          var comp = q.quotaCompensataGrammi || 0;
          if (!comp) return;
          debiti[q.membroId] = (debiti[q.membroId] || 0) - comp;
        });
        Object.keys(debiti).forEach(function (k) {
          if (debiti[k] < 0) debiti[k] = 0;
        });
        return debiti;
      });
  }

  // Chi ha diritto alla carne in quella stagione: gli ospiti no,
  // salvo deroga registrata sulla singola giornata.
  function dirittiStagione(stagioneId) {
    return App.data.iscrizioni.perStagione(stagioneId).then(function (iscrizioni) {
      var out = {};
      iscrizioni.forEach(function (i) { out[i.membroId] = !i.ospite; });
      return out;
    });
  }

  // Costruisce le quote di uno snapshot.
  //   - chi non ha diritto (ospite) resta a zero;
  //   - chi e' in compensazione resta a zero ma si scala il PRO CAPITE,
  //     cioe' totale diviso i presenti, non diviso gli aventi diritto;
  //   - la carne si divide fra gli aventi diritto non in compensazione,
  //     e la somma delle quote e' esattamente il peso disponibile.
  function costruisciQuote(lottoId, presenti, totale, diritti, debiti) {
    var proCapite = presenti.length ? Math.floor(totale / presenti.length) : 0;
    var righe = presenti.map(function (m) {
      var haDiritto = diritti[m.id] !== false;
      var inCompensazione = haDiritto && (debiti[m.id] || 0) > 0;
      return { membro: m, haDiritto: haDiritto, inCompensazione: inCompensazione };
    });
    var aventi = righe.filter(function (r) { return r.haDiritto && !r.inCompensazione; });
    if (!aventi.length) {
      throw new Error('Nessun partecipante ha diritto alla carne in questa battuta: ' +
        'controlla ospiti e compensazioni.');
    }
    var parti = ripartisci(totale, aventi.length);
    var quotaPer = {};
    aventi.forEach(function (r, i) { quotaPer[r.membro.id] = parti[i]; });

    return righe.map(function (r) {
      return App.data.repo.timbraCreazione({
        id: App.core.idDeterministici.quotaCarne(lottoId, r.membro.id),
        lottoCarneId: lottoId,
        membroId: r.membro.id,
        quotaSpettanteGrammi: quotaPer[r.membro.id] || 0,
        haDiritto: r.haDiritto,
        inCompensazione: r.inCompensazione,
        // quanto scala dal debito di chi e' in compensazione
        quotaCompensataGrammi: r.inCompensazione ? Math.min(proCapite, debiti[r.membro.id]) : 0,
        demo: false
      });
    });
  }

  function creaLotto(giornataId, campi) {
    if (!interoPositivo(campi.pesoNettoDisponibileGrammi)) {
      var e = new Error('Peso non valido.');
      e.errori = { pesoNettoDisponibileGrammi: 'Indica un peso maggiore di zero, es. 100.' };
      throw e;
    }
    return Promise.all([
      App.data.giornate.perId(giornataId),
      App.data.lottiCarne.perGiornata(giornataId)
    ]).then(function (r) {
      var giornata = r[0];
      if (!giornata) throw new Error('Giornata non trovata.');
      if (r[1]) throw new Error('Questa giornata ha già un lotto carne.');

      return presentiDiGiornata(giornataId).then(function (presenti) {
        if (!presenti.length) {
          throw new Error('Nessun partecipante segnato come presente: ' +
            'registra prima i partecipanti alla battuta.');
        }
        var lotto = App.data.repo.timbraCreazione({
          id: App.core.idDeterministici.lottoCarne(giornataId),
          giornataId: giornataId,
          squadraId: giornata.squadraId,
          stagioneId: giornata.stagioneId,
          pesoNettoDisponibileGrammi: campi.pesoNettoDisponibileGrammi,
          note: (campi.note || '').trim(),
          demo: false
        });
        return Promise.all([
          dirittiStagione(giornata.stagioneId),
          debitiStagione(giornata.stagioneId, null)
        ]).then(function (dd) {
          var quote = costruisciQuote(lotto.id, presenti,
            lotto.pesoNettoDisponibileGrammi, dd[0], dd[1]);
          return App.data.repo.scrivi(['lottiCarne', 'quoteCarne'], function (t) {
            t.put('lottiCarne', lotto);
            quote.forEach(function (q) { t.put('quoteCarne', q); });
            return lotto;
          });
        });
      });
    });
  }

  // Il peso si puo' correggere, ma non sotto le uscite gia' registrate.
  // Le quote teoriche si ricalcolano sullo STESSO snapshot.
  function aggiornaPeso(lottoId, nuovoPesoGrammi, note) {
    if (!interoPositivo(nuovoPesoGrammi)) {
      var e = new Error('Peso non valido.');
      e.errori = { pesoNettoDisponibileGrammi: 'Indica un peso maggiore di zero.' };
      throw e;
    }
    return riepilogoLotto(lottoId).then(function (rl) {
      if (!rl) throw new Error('Lotto non trovato.');
      var uscite = rl.vendutoGrammi + rl.ritiratoGrammi;
      if (nuovoPesoGrammi < uscite) {
        throw new Error('Il peso non può scendere sotto le uscite già registrate (' +
          formattaKg(uscite) + ').');
      }
      return App.data.quoteCarne.perLotto(lottoId).then(function (quote) {
        var ordinate = quote.slice().sort(function (a, b) {
          return String(a.membroId).localeCompare(String(b.membroId));
        });
        // Le quote vanno ricalcolate nello stesso ordine usato alla creazione.
        return App.data.repo.leggiStore(['membri']).then(function (d) {
          var perId = {};
          d.membri.forEach(function (m) { perId[m.id] = m; });
          var membri = ordinaMembri(ordinate.map(function (q) {
            return perId[q.membroId] || { id: q.membroId, cognome: '', nome: '' };
          }));
          // Diritti e compensazioni restano quelli congelati nello snapshot:
          // cambia solo quanta carne c'e' da dividere.
          var statoPer = {};
          quote.forEach(function (q) {
            statoPer[q.membroId] = {
              haDiritto: q.haDiritto !== false,
              inCompensazione: q.inCompensazione === true
            };
          });
          var aventi = membri.filter(function (m) {
            var st = statoPer[m.id] || {};
            return st.haDiritto !== false && !st.inCompensazione;
          });
          if (!aventi.length) {
            throw new Error('Nessun partecipante ha diritto alla carne in questa battuta.');
          }
          var parti = ripartisci(nuovoPesoGrammi, aventi.length);
          var perMembro = {};
          aventi.forEach(function (m, i) { perMembro[m.id] = parti[i]; });
          var proCapite = membri.length ? Math.floor(nuovoPesoGrammi / membri.length) : 0;

          var lotto = rl.lotto;
          lotto.pesoNettoDisponibileGrammi = nuovoPesoGrammi;
          if (note !== undefined) lotto.note = (note || '').trim();
          quote.forEach(function (q) {
            q.quotaSpettanteGrammi = perMembro[q.membroId] || 0;
            if (q.inCompensazione === true) q.quotaCompensataGrammi = proCapite;
          });

          return App.data.repo.scrivi(['lottiCarne', 'quoteCarne'], function (t) {
            t.put('lottiCarne', App.data.repo.timbraModifica(lotto));
            quote.forEach(function (q) { t.put('quoteCarne', App.data.repo.timbraModifica(q)); });
            return lotto;
          });
        });
      });
    });
  }

  // Rifà lo snapshot dai partecipanti attuali. Consentito solo finché
  // non esistono vendite o ritiri: dopo, la storia non si tocca.
  function aggiornaSnapshot(lottoId) {
    return riepilogoLotto(lottoId).then(function (rl) {
      if (!rl) throw new Error('Lotto non trovato.');
      if (rl.venditeValide.length || rl.ritiriValidi.length) {
        throw new Error('Ci sono già vendite o ritiri: lo snapshot dei partecipanti ' +
          'non può più essere modificato.');
      }
      return presentiDiGiornata(rl.lotto.giornataId).then(function (presenti) {
        if (!presenti.length) throw new Error('Nessun partecipante presente nella giornata.');
        return Promise.all([
          dirittiStagione(rl.lotto.stagioneId),
          debitiStagione(rl.lotto.stagioneId, lottoId)
        ]).then(function (dd) {
        var nuove = costruisciQuote(lottoId, presenti,
          rl.lotto.pesoNettoDisponibileGrammi, dd[0], dd[1]);
        return App.data.quoteCarne.perLotto(lottoId).then(function (vecchie) {
          return App.data.repo.scrivi(['quoteCarne'], function (t) {
            vecchie.forEach(function (q) { t.elimina('quoteCarne', q.id); });
            nuove.forEach(function (q) { t.put('quoteCarne', q); });
            return nuove;
          });
        });
        });
      });
    });
  }

  // Deroga sul diritto alla carne di un singolo partecipante, per esempio
  // per far entrare un ospite nella divisione. Consentita solo finche' non
  // esistono vendite o uscite: dopo, lo storico non si tocca.
  function impostaDiritto(lottoId, membroId, haDiritto) {
    return riepilogoLotto(lottoId).then(function (rl) {
      if (!rl) throw new Error('Lotto non trovato.');
      if (rl.venditeValide.length || rl.usciteValide.length) {
        throw new Error('Ci sono già vendite o uscite registrate: ' +
          'il diritto alla carne non può più essere modificato.');
      }
      return App.data.quoteCarne.perLotto(lottoId).then(function (quote) {
        var mia = quote.filter(function (q) { return q.membroId === membroId; })[0];
        if (!mia) throw new Error('Il socio non fa parte di questa battuta.');
        mia.haDiritto = !!haDiritto;
        if (!haDiritto) mia.inCompensazione = false;

        return App.data.repo.leggiStore(['membri']).then(function (d) {
          var perId = {};
          d.membri.forEach(function (m) { perId[m.id] = m; });
          var membri = ordinaMembri(quote.map(function (q) {
            return perId[q.membroId] || { id: q.membroId, nome: '', cognome: '' };
          }));
          var statoPer = {};
          quote.forEach(function (q) {
            statoPer[q.membroId] = {
              haDiritto: q.haDiritto !== false,
              inCompensazione: q.inCompensazione === true
            };
          });
          var aventi = membri.filter(function (m) {
            var st = statoPer[m.id];
            return st.haDiritto && !st.inCompensazione;
          });
          if (!aventi.length) {
            throw new Error('Almeno un partecipante deve avere diritto alla carne.');
          }
          var totale = rl.lotto.pesoNettoDisponibileGrammi;
          var parti = ripartisci(totale, aventi.length);
          var perMembro = {};
          aventi.forEach(function (m, i) { perMembro[m.id] = parti[i]; });
          quote.forEach(function (q) { q.quotaSpettanteGrammi = perMembro[q.membroId] || 0; });

          return App.data.repo.scrivi(['quoteCarne'], function (t) {
            quote.forEach(function (q) { t.put('quoteCarne', App.data.repo.timbraModifica(q)); });
            return quote;
          });
        });
      });
    });
  }

  // ---------- vendite ----------
  function validaVendita(campi) {
    var errori = {};
    if (!App.core.calendario.dataValida(campi.data)) {
      errori.data = 'Data non valida.';
    }
    if (!App.costanti.taglioValido(campi.tipoTaglio)) {
      errori.tipoTaglio = 'Tipo di taglio non valido.';
    }
    if (!interoPositivo(campi.pesoGrammi)) {
      errori.pesoGrammi = 'Peso non valido: indica per esempio 30.';
    }
    if (!interoNonNegativo(campi.prezzoCentKg)) {
      errori.prezzoCentKg = 'Prezzo non valido.';
    }
    return errori;
  }

  function registraVendita(lottoId, campi) {
    var errori = validaVendita(campi);
    if (Object.keys(errori).length) {
      var e = new Error('Dati non validi.'); e.errori = errori; throw e;
    }
    return riepilogoLotto(lottoId).then(function (rl) {
      if (!rl) throw new Error('Lotto non trovato.');
      if (campi.pesoGrammi > rl.residuoGrammi) {
        var er = new Error('Nel lotto restano solo ' + formattaKg(rl.residuoGrammi) + '.');
        er.errori = { pesoGrammi: 'Disponibili ' + formattaKg(rl.residuoGrammi) + '.' };
        throw er;
      }
      var vendita = App.data.repo.timbraCreazione({
        id: App.core.id.nuovo(App.core.id.VENDITA_CARNE),
        lottoCarneId: lottoId,
        data: campi.data,
        tipoTaglio: campi.tipoTaglio,
        pesoGrammi: campi.pesoGrammi,
        prezzoCentKg: campi.prezzoCentKg,
        // Chi ha comprato la carne. Non cambia l'attribuzione ai soci:
        // il venduto resta ripartito fra gli aventi diritto.
        vendutaDa: (campi.vendutaDa || '').trim() || null,
        annullata: false,
        note: (campi.note || '').trim(),
        demo: false
      });
      return App.data.venditeCarne.salva(vendita).then(function () { return vendita; });
    });
  }

  function impostaVenditaAnnullata(venditaId, annullata) {
    return App.data.venditeCarne.perId(venditaId).then(function (v) {
      if (!v) throw new Error('Vendita non trovata.');
      if (!annullata) {
        // Ripristinare una vendita puo' sforare la disponibilita' del lotto.
        return riepilogoLotto(v.lottoCarneId).then(function (rl) {
          if (v.pesoGrammi > rl.residuoGrammi) {
            throw new Error('Non c\u2019è più spazio nel lotto per ripristinare ' +
              'questa vendita (' + formattaKg(rl.residuoGrammi) + ' disponibili).');
          }
          v.annullata = false;
          return App.data.venditeCarne.salva(v).then(function () { return v; });
        });
      }
      v.annullata = true;
      return App.data.venditeCarne.salva(v).then(function () { return v; });
    });
  }

  // ---------- ritiri ----------
  // Uscita fisica di carne da un lotto. Tre tipi, tutti scalano il residuo:
  //   RITIRO_CREDITO          il socio ritira carne che gli spetta gia'
  //   CONSEGNA_SENZA_DIRITTO  carne data a chi non era presente: crea debito
  //   SALAMINI                messa da parte per la lavorazione, nessun socio
  function registraUscita(campi) {
    var tipo = campi.tipoMovimento || 'RITIRO_CREDITO';
    var errori = {};
    if (!App.costanti.movimentoCarneValido(tipo)) {
      errori.tipoMovimento = 'Tipo di movimento non valido.';
    }
    var serveSocio = App.costanti.movimentoRichiedeSocio(tipo);
    if (serveSocio && !campi.membroId) errori.membroId = 'Scegli il socio.';
    if (!campi.lottoCarneId) errori.lottoCarneId = 'Scegli il lotto da cui prelevare.';
    if (!App.core.calendario.dataValida(campi.data)) errori.data = 'Data non valida.';
    if (!interoPositivo(campi.pesoGrammi)) errori.pesoGrammi = 'Peso non valido.';
    if (Object.keys(errori).length) {
      var e = new Error('Dati non validi.'); e.errori = errori; throw e;
    }

    return App.data.lottiCarne.perId(campi.lottoCarneId).then(function (lotto) {
      if (!lotto) throw new Error('Lotto non trovato.');
      return riepilogoLotto(lotto.id).then(function (rl) {
        // Vincolo fisico: non si puo' portare via piu' carne di quanta ce n'e'.
        if (campi.pesoGrammi > rl.residuoGrammi) {
          var e2 = new Error('Nel lotto restano solo ' + formattaKg(rl.residuoGrammi) + '.');
          e2.errori = { pesoGrammi: 'Nel lotto restano ' + formattaKg(rl.residuoGrammi) + '.' };
          throw e2;
        }
        var prima = Promise.resolve(null);
        // Vincolo aggiuntivo: il ritiro non puo' superare il credito.
        if (tipo === 'RITIRO_CREDITO') {
          prima = riepilogoSocio(lotto.stagioneId, campi.membroId).then(function (rs) {
            if (campi.pesoGrammi > rs.creditoDisponibileGrammi) {
              var e1 = new Error('Il credito disponibile del socio è ' +
                formattaKg(rs.creditoDisponibileGrammi) + '.');
              e1.errori = { pesoGrammi: 'Credito disponibile: ' +
                formattaKg(rs.creditoDisponibileGrammi) + '.' };
              throw e1;
            }
            return null;
          });
        }
        return prima.then(function () {
          var uscita = App.data.repo.timbraCreazione({
            id: App.core.id.nuovo(App.core.id.RITIRO_CARNE),
            membroId: serveSocio ? campi.membroId : null,
            stagioneId: lotto.stagioneId,
            lottoCarneId: lotto.id,
            data: campi.data,
            pesoGrammi: campi.pesoGrammi,
            tipoMovimento: tipo,
            annullato: false,
            note: (campi.note || '').trim(),
            demo: false
          });
          return App.data.ritiriCarne.salva(uscita).then(function () { return uscita; });
        });
      });
    });
  }

  // Nome storico mantenuto per compatibilita' con il resto dell'app.
  function registraRitiro(campi) {
    var c = {};
    Object.keys(campi).forEach(function (k) { c[k] = campi[k]; });
    c.tipoMovimento = c.tipoMovimento || 'RITIRO_CREDITO';
    return registraUscita(c);
  }

  function impostaRitiroAnnullato(ritiroId, annullato) {
    return App.data.ritiriCarne.perId(ritiroId).then(function (r) {
      if (!r) throw new Error('Ritiro non trovato.');
      r.annullato = !!annullato;
      return App.data.ritiriCarne.salva(r).then(function () { return r; });
    });
  }

  // ---------- riepiloghi derivati ----------
  function riepilogoLotto(lottoId) {
    return App.data.repo.leggiStore(
      ['lottiCarne', 'quoteCarne', 'venditeCarne', 'ritiriCarne', 'membri', 'giornate']
    ).then(function (d) {
      var lotto = d.lottiCarne.filter(function (l) { return l.id === lottoId; })[0];
      if (!lotto) return null;

      var quote = d.quoteCarne.filter(function (q) { return q.lottoCarneId === lottoId; });
      var vendite = d.venditeCarne.filter(function (v) { return v.lottoCarneId === lottoId; });
      var ritiri = d.ritiriCarne.filter(function (r) { return r.lottoCarneId === lottoId; });
      var venditeValide = vendite.filter(function (v) { return !v.annullata; });
      var usciteValide = ritiri.filter(function (r) { return !r.annullato; });
      function diTipo(t) {
        return usciteValide.filter(function (r) {
          return (r.tipoMovimento || 'RITIRO_CREDITO') === t;
        });
      }
      var ritiriValidi = diTipo('RITIRO_CREDITO');
      var consegneValide = diTipo('CONSEGNA_SENZA_DIRITTO');
      var salaminiValidi = diTipo('SALAMINI');

      var vendutoGrammi = 0, ricavoTotaleCent = 0;
      venditeValide.forEach(function (v) {
        vendutoGrammi += v.pesoGrammi;
        ricavoTotaleCent += ricavoCent(v.pesoGrammi, v.prezzoCentKg);
      });
      function somma(elenco) {
        var t = 0;
        elenco.forEach(function (r) { t += r.pesoGrammi; });
        return t;
      }
      var ritiratoGrammi = somma(ritiriValidi);
      var consegnatoGrammi = somma(consegneValide);
      var salaminiGrammi = somma(salaminiValidi);
      var usciteGrammi = ritiratoGrammi + consegnatoGrammi + salaminiGrammi;

      var perId = {};
      d.membri.forEach(function (m) { perId[m.id] = m; });
      var membri = ordinaMembri(quote.map(function (q) {
        return perId[q.membroId] || { id: q.membroId, nome: '', cognome: '' };
      }));
      var statoPer = {};
      quote.forEach(function (q) {
        statoPer[q.membroId] = {
          haDiritto: q.haDiritto !== false,
          inCompensazione: q.inCompensazione === true,
          quotaCompensataGrammi: q.quotaCompensataGrammi || 0
        };
      });
      // Il venduto si attribuisce solo a chi ha davvero diritto alla carne.
      var aventi = membri.filter(function (m) {
        var st = statoPer[m.id];
        return st.haDiritto && !st.inCompensazione;
      });
      var partiVendute = ripartisci(vendutoGrammi, aventi.length);
      var quotaPerMembro = {}, vendutoPerMembro = {};
      quote.forEach(function (q) { quotaPerMembro[q.membroId] = q.quotaSpettanteGrammi; });
      aventi.forEach(function (m, i) { vendutoPerMembro[m.id] = partiVendute[i]; });

      var giornata = d.giornate.filter(function (g) { return g.id === lotto.giornataId; })[0] || null;

      return {
        lotto: lotto,
        giornata: giornata,
        partecipanti: membri.map(function (m) {
          var st = statoPer[m.id] || {};
          return {
            membro: m,
            quotaSpettanteGrammi: quotaPerMembro[m.id] || 0,
            vendutoAttribuitoGrammi: vendutoPerMembro[m.id] || 0,
            haDiritto: st.haDiritto !== false,
            inCompensazione: st.inCompensazione === true,
            quotaCompensataGrammi: st.quotaCompensataGrammi || 0
          };
        }),
        numeroPartecipanti: membri.length,
        numeroAventiDiritto: aventi.length,
        disponibileGrammi: lotto.pesoNettoDisponibileGrammi,
        vendutoGrammi: vendutoGrammi,
        ritiratoGrammi: ritiratoGrammi,
        consegnatoGrammi: consegnatoGrammi,
        salaminiGrammi: salaminiGrammi,
        usciteGrammi: usciteGrammi,
        residuoGrammi: lotto.pesoNettoDisponibileGrammi - vendutoGrammi - usciteGrammi,
        ricavoTotaleCent: ricavoTotaleCent,
        vendite: vendite.slice().sort(function (a, b) {
          return String(b.data).localeCompare(String(a.data));
        }),
        venditeValide: venditeValide,
        ritiri: ritiri,
        ritiriValidi: ritiriValidi,
        usciteValide: usciteValide,
        consegneValide: consegneValide,
        salaminiValidi: salaminiValidi
      };
    });
  }

  function perGiornata(giornataId) {
    return App.data.lottiCarne.perGiornata(giornataId).then(function (l) {
      return l ? riepilogoLotto(l.id) : null;
    });
  }

  // Somma su tutta la stagione, per socio. Nessun saldo memorizzato.
  function riepilogoStagione(stagioneId) {
    return Promise.all([
      App.data.repo.leggiStore(
        ['lottiCarne', 'quoteCarne', 'venditeCarne', 'ritiriCarne', 'membri', 'iscrizioni']),
      configPerStagione(stagioneId)
    ]).then(function (res) {
      var d = res[0], config = res[1];
      var obbligo = config.obbligoVenditaGrammi;

      var lotti = d.lottiCarne.filter(function (l) { return l.stagioneId === stagioneId; });
      var idLotti = {};
      lotti.forEach(function (l) { idLotti[l.id] = true; });

      var perId = {};
      d.membri.forEach(function (m) { perId[m.id] = m; });

      var totali = {
        disponibileGrammi: 0, vendutoGrammi: 0, ritiratoGrammi: 0,
        consegnatoGrammi: 0, salaminiGrammi: 0, ricavoTotaleCent: 0
      };
      var vendutoPerMembro = {}, quotaPerMembro = {}, ritiratoPerMembro = {};
      var consegnatoPerMembro = {}, compensatoPerMembro = {};

      lotti.forEach(function (l) {
        totali.disponibileGrammi += l.pesoNettoDisponibileGrammi;

        var quote = d.quoteCarne.filter(function (q) { return q.lottoCarneId === l.id; });
        var venduto = 0;
        d.venditeCarne.forEach(function (v) {
          if (v.lottoCarneId !== l.id || v.annullata) return;
          venduto += v.pesoGrammi;
          totali.ricavoTotaleCent += ricavoCent(v.pesoGrammi, v.prezzoCentKg);
        });
        totali.vendutoGrammi += venduto;

        // Il venduto si attribuisce solo a chi aveva diritto in quella battuta.
        var statoPer = {};
        quote.forEach(function (q) {
          statoPer[q.membroId] = {
            haDiritto: q.haDiritto !== false,
            inCompensazione: q.inCompensazione === true
          };
        });
        var membri = ordinaMembri(quote.map(function (q) {
          return perId[q.membroId] || { id: q.membroId, nome: '', cognome: '' };
        }));
        var aventi = membri.filter(function (m) {
          var st = statoPer[m.id];
          return st.haDiritto && !st.inCompensazione;
        });
        var parti = ripartisci(venduto, aventi.length);
        aventi.forEach(function (m, i) {
          vendutoPerMembro[m.id] = (vendutoPerMembro[m.id] || 0) + parti[i];
        });
        quote.forEach(function (q) {
          quotaPerMembro[q.membroId] = (quotaPerMembro[q.membroId] || 0) + q.quotaSpettanteGrammi;
          compensatoPerMembro[q.membroId] =
            (compensatoPerMembro[q.membroId] || 0) + (q.quotaCompensataGrammi || 0);
        });
      });

      d.ritiriCarne.forEach(function (r) {
        if (r.annullato || !idLotti[r.lottoCarneId]) return;
        var tipo = r.tipoMovimento || 'RITIRO_CREDITO';
        if (tipo === 'SALAMINI') {
          totali.salaminiGrammi += r.pesoGrammi;
          return;
        }
        if (tipo === 'CONSEGNA_SENZA_DIRITTO') {
          totali.consegnatoGrammi += r.pesoGrammi;
          consegnatoPerMembro[r.membroId] =
            (consegnatoPerMembro[r.membroId] || 0) + r.pesoGrammi;
          return;
        }
        totali.ritiratoGrammi += r.pesoGrammi;
        ritiratoPerMembro[r.membroId] = (ritiratoPerMembro[r.membroId] || 0) + r.pesoGrammi;
      });
      totali.residuoGrammi = totali.disponibileGrammi - totali.vendutoGrammi -
        totali.ritiratoGrammi - totali.consegnatoGrammi - totali.salaminiGrammi;

      var iscritti = d.iscrizioni
        .filter(function (i) { return i.stagioneId === stagioneId; })
        .map(function (i) { return perId[i.membroId]; })
        .filter(function (m) { return !!m; });

      var soci = ordinaMembri(iscritti).map(function (m) {
        return calcolaSocio(m, vendutoPerMembro[m.id] || 0, quotaPerMembro[m.id] || 0,
          ritiratoPerMembro[m.id] || 0, obbligo,
          consegnatoPerMembro[m.id] || 0, compensatoPerMembro[m.id] || 0);
      });

      // Chi ha venduto, e quanto, nell'arco della stagione.
      // Dato di sola lettura: non tocca quote ne' crediti.
      var perVenditore = {};
      d.venditeCarne.forEach(function (v) {
        if (v.annullata) return;
        if (!idLotti[v.lottoCarneId]) return;
        var nome = (v.vendutaDa || '').trim();
        if (!nome) return;
        if (!perVenditore[nome]) {
          perVenditore[nome] = { nome: nome, pesoGrammi: 0, ricavoCent: 0, vendite: 0 };
        }
        perVenditore[nome].pesoGrammi += v.pesoGrammi;
        perVenditore[nome].ricavoCent += ricavoCent(v.pesoGrammi, v.prezzoCentKg);
        perVenditore[nome].vendite++;
      });
      var venditori = Object.keys(perVenditore)
        .map(function (k) { return perVenditore[k]; })
        .sort(function (a, b) { return b.pesoGrammi - a.pesoGrammi; });

      return {
        totali: totali, soci: soci, obbligoGrammi: obbligo,
        config: config, venditori: venditori
      };
    });
  }

  function calcolaSocio(membro, venduto, quota, ritirato, obbligo, consegnato, compensato) {
    // Debito: carne ricevuta senza esserci, meno le quote gia' compensate
    // saltando le divisioni successive.
    var debito = Math.max(0, (consegnato || 0) - (compensato || 0));
    return {
      membro: membro,
      quotaTeoricaGrammi: quota,
      vendutoAttribuitoGrammi: venduto,
      obbligoGrammi: obbligo,
      residuoObbligoGrammi: Math.max(0, obbligo - venduto),
      eccedenzaVenditaGrammi: Math.max(0, venduto - obbligo),
      obbligoRaggiunto: venduto >= obbligo,
      // Il credito nasce dalla carne effettivamente venduta, non da quella
      // disponibile, e non si azzera quando l'obbligo e' assolto.
      creditoMaturatoGrammi: venduto,
      creditoRitiratoGrammi: ritirato,
      creditoDisponibileGrammi: venduto - ritirato,
      // Compensazione: conto separato dal credito.
      consegnatoSenzaDirittoGrammi: consegnato || 0,
      compensatoGrammi: compensato || 0,
      debitoCarneGrammi: debito,
      inCompensazione: debito > 0
    };
  }

  function riepilogoSocio(stagioneId, membroId) {
    return riepilogoStagione(stagioneId).then(function (r) {
      var trovato = r.soci.filter(function (s) { return s.membro.id === membroId; })[0];
      if (trovato) return trovato;
      return calcolaSocio({ id: membroId }, 0, 0, 0, r.obbligoGrammi);
    });
  }

  // Esposto per la futura Cassa: entrata da vendita carne. Nessun totale
  // viene duplicato in un altro store.
  function ricavoVenditeCarneStagione(stagioneId) {
    return riepilogoStagione(stagioneId).then(function (r) {
      return r.totali.ricavoTotaleCent;
    });
  }

  App.core.carne = {
    parseKgInGrammi: parseKgInGrammi,
    formattaKg: formattaKg,
    kgPerInput: kgPerInput,
    ricavoCent: ricavoCent,
    ripartisci: ripartisci,
    ordinaMembri: ordinaMembri,
    configPerStagione: configPerStagione,
    salvaConfig: salvaConfig,
    presentiDiGiornata: presentiDiGiornata,
    creaLotto: creaLotto,
    aggiornaPeso: aggiornaPeso,
    aggiornaSnapshot: aggiornaSnapshot,
    validaVendita: validaVendita,
    registraVendita: registraVendita,
    impostaVenditaAnnullata: impostaVenditaAnnullata,
    registraRitiro: registraRitiro,
    registraUscita: registraUscita,
    impostaDiritto: impostaDiritto,
    debitiStagione: debitiStagione,
    impostaRitiroAnnullato: impostaRitiroAnnullato,
    riepilogoLotto: riepilogoLotto,
    perGiornata: perGiornata,
    riepilogoStagione: riepilogoStagione,
    riepilogoSocio: riepilogoSocio,
    ricavoVenditeCarneStagione: ricavoVenditeCarneStagione
  };
})(typeof window !== 'undefined' ? window : globalThis);
