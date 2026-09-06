(function (global) {
  'use strict';
  var App = global.App;
  App.seed = App.seed || {};

  // GENNAIO 2026 — stagione dimostrativa 2025/2026.
  //
  // Trascrizione fedele dei fogli cartacei della squadra: sette battute,
  // presenze, capi, carne divisa, venduta e messa da parte per i salamini,
  // compensazioni e ospite fuori dalla divisione.
  //
  // TUTTO demo:true. I nomi sono i soprannomi usati sul quaderno, non
  // l'anagrafica reale: serve a far vedere come lavora l'app su una
  // stagione vera, e si cancella con "Elimina dati di prova".
  //
  // Quello che sui fogli non c'era resta vuoto: zona, orario, capocaccia,
  // peso dei singoli capi, tipo di taglio e prezzo delle vendite.

  var SOPRANNOMI = [
    'Pier', 'Davide', 'Luca', 'Adriano', 'Alex', 'Beppe', 'Cecco', 'Cristian',
    'Cesare', 'Lele', 'Lucio', 'Max', 'Mora', 'Pepe', 'Pimy', 'Roby',
    'Stefano', 'Tato', 'Togn', 'Federico', 'Rondo', 'Maum', 'Italo'
  ];

  // Chi non è socio della squadra ma partecipa come ospite.
  var OSPITI = { Italo: true, Maum: true };

  // Le sette battute, come sul quaderno.
  //   presenti        elenco dei presenti
  //   compensazione   presenti che non prendono carne (debito pregresso)
  //   fuoriDivisione  presenti che restano fuori (ospiti)
  //   capi            [tiratore, nonRecuperato]
  //   pesoCapiKg      peso totale dei capi, se annotato
  //   carneKg         carne netta divisa fra gli aventi diritto
  //   vendutoKg       carne venduta, con eventuale vendutaDa
  //   salaminiKg      carne messa da parte per i salamini
  var GIORNATE = [
    {
      data: '2026-01-03',
      presenti: ['Pier', 'Davide', 'Luca', 'Adriano', 'Alex', 'Beppe', 'Cecco',
        'Cristian', 'Cesare', 'Lucio', 'Max', 'Mora', 'Pepe', 'Pimy', 'Roby',
        'Rondo', 'Stefano', 'Tato', 'Maum'],
      compensazione: ['Max', 'Rondo', 'Maum'],
      fuoriDivisione: [],
      capi: [['Cesare'], ['Cesare'], ['Cesare'], ['Cesare']],
      carneKg: 32,
      vendutoKg: 15,
      vendutaDa: '',
      note: 'Max, Maum e Rondo in compensazione: −1,690 kg ciascuno.'
    },
    {
      data: '2026-01-04',
      presenti: ['Pier', 'Davide', 'Adriano', 'Alex', 'Cecco', 'Beppe', 'Cristian',
        'Cesare', 'Lucio', 'Max', 'Mora', 'Pepe', 'Pimy', 'Roby', 'Stefano',
        'Tato', 'Togn'],
      compensazione: ['Max', 'Togn'],
      fuoriDivisione: [],
      capi: [['Stefano'], ['Pimy'], ['Adriano'], ['Togn']],
      carneKg: 51,
      vendutoKg: 2,
      vendutaDa: 'Italo',
      note: 'Max e Togn in compensazione: −3,00 kg ciascuno.'
    },
    {
      data: '2026-01-10',
      presenti: ['Pier', 'Davide', 'Adriano', 'Alex', 'Beppe', 'Cecco', 'Cristian',
        'Federico', 'Lele', 'Max', 'Mora', 'Pepe', 'Pimy', 'Roby', 'Stefano',
        'Tato', 'Cesare', 'Lucio', 'Italo'],
      compensazione: ['Federico'],
      fuoriDivisione: ['Italo'],
      capi: [['Lucio'], ['Lucio'], ['Davide'], ['Pier', true]],
      pesoCapiKg: 98,
      carneKg: 35.7,
      vendutoKg: 4,
      vendutaDa: 'Pier',
      note: 'Federico in compensazione: −1,980 kg. Un capo di Pier perso ' +
        'per difficoltà di recupero. Italo ospite, fuori dalla divisione.'
    },
    {
      data: '2026-01-11',
      presenti: ['Pier', 'Davide', 'Luca', 'Alex', 'Beppe', 'Cecco', 'Cesare',
        'Lele', 'Lucio', 'Max', 'Mora', 'Pimy', 'Roby', 'Stefano', 'Tato',
        'Togn', 'Adriano'],
      compensazione: ['Togn'],
      fuoriDivisione: [],
      capi: [['Davide'], ['Pier'], ['Rondo'], ['Luca']],
      pesoCapiKg: 102,
      carneKg: 19.2,
      vendutoKg: 17.8,
      vendutaDa: '',
      salaminiKg: 35.5,
      note: '35,5 kg messi in freezer per i salamini. Togn in compensazione.'
    },
    {
      data: '2026-01-14',
      presenti: ['Pier', 'Davide', 'Luca', 'Adriano', 'Beppe', 'Cecco', 'Federico',
        'Lele', 'Mora', 'Pepe', 'Pimy', 'Togn'],
      compensazione: ['Federico', 'Togn'],
      fuoriDivisione: [],
      capi: [['Mora'], ['Mora'], ['Pimy'], ['Beppe']],
      carneKg: 27,
      note: 'Federico e Togn in compensazione: −2,250 kg ciascuno.'
    },
    {
      data: '2026-01-18',
      presenti: ['Pier', 'Davide', 'Luca', 'Adriano', 'Beppe', 'Cecco', 'Cristian',
        'Cesare', 'Federico', 'Lele', 'Lucio', 'Mora', 'Pimy', 'Roby', 'Stefano',
        'Tato', 'Togn'],
      compensazione: ['Federico', 'Togn'],
      fuoriDivisione: [],
      capi: [['Cesare'], ['Roby'], ['Lucio']],
      carneKg: 39,
      note: 'Federico e Togn in compensazione: −2,300 kg ciascuno.'
    },
    {
      data: '2026-01-24',
      presenti: ['Pier', 'Davide', 'Luca', 'Adriano', 'Alex', 'Beppe', 'Cecco',
        'Cristian', 'Federico', 'Lucio', 'Max', 'Mora', 'Pepe', 'Pimy', 'Roby',
        'Stefano'],
      compensazione: [],
      fuoriDivisione: [],
      capi: [['Cecco']],
      pesoCapiKg: 55,
      salaminiKg: 12.4,
      note: 'Una femmina di 55 kg. 12,400 kg destinati ai salamini.'
    }
  ];

  function grammi(kg) { return Math.round(kg * 1000); }

  // Distribuzione deterministica dei grammi di resto, come nel servizio carne.
  function ripartisci(totale, quanti) {
    if (quanti <= 0) return [];
    var base = Math.floor(totale / quanti);
    var resto = totale - base * quanti;
    var out = [];
    for (var i = 0; i < quanti; i++) out.push(base + (i < resto ? 1 : 0));
    return out;
  }

  function costruisci(idSquadra) {
    var idStagione = App.core.id.nuovo(App.core.id.STAGIONE);

    var stagione = App.data.repo.timbraCreazione({
      id: idStagione,
      squadraId: idSquadra,
      nome: '2025/2026',
      dataInizio: '2025-10-01',
      dataFine: '2026-01-31',
      stato: 'chiusa',
      quotaAnnualePredefinitaCent: 24000,
      demo: true
    });

    var calendario = App.data.repo.timbraCreazione({
      id: App.core.id.nuovo(App.core.id.CALENDARIO),
      stagioneId: idStagione,
      nome: App.costanti.CALENDARIO_NOME_PREDEFINITO,
      dataInizio: '2025-10-01',
      dataFine: '2026-01-31',
      giorniSettimana: ['MERCOLEDI', 'SABATO', 'DOMENICA'],
      demo: true
    });

    var configCarne = App.data.repo.timbraCreazione({
      id: App.core.id.nuovo(App.core.id.CONFIG_CARNE),
      stagioneId: idStagione,
      obbligoVenditaGrammi: App.costanti.OBBLIGO_VENDITA_GRAMMI_PREDEFINITO,
      prezziCentKg: App.costanti.prezziPredefiniti(),
      demo: true
    });

    // --- soci della stagione dimostrativa ---
    var membri = [];
    var iscrizioni = [];
    var idPerNome = {};

    SOPRANNOMI.forEach(function (nome) {
      var id = App.core.id.nuovo(App.core.id.MEMBRO);
      idPerNome[nome] = id;
      membri.push(App.data.repo.timbraCreazione({
        id: id,
        squadraId: idSquadra,
        nome: nome,
        cognome: '',
        dataNascita: null,
        telefono: null,
        note: '',
        livelloAccessoApp: 'MEMBRO',
        attivo: false,          // stagione chiusa: non sono soci correnti
        scadenzaPortoArmi: null,
        demo: true
      }));
      iscrizioni.push(App.core.stagione.nuovaIscrizione({
        stagioneId: idStagione,
        membroId: id,
        ruoliVenatori: ['CACCIATORE'],
        ospite: !!OSPITI[nome],
        quotaAnnualePrevistaCent: 24000,
        quotaVersataCent: 24000,
        demo: true
      }));
    });

    // --- giornate, presenze, capi, carne ---
    var giornate = [];
    var presenze = [];
    var abbattimenti = [];
    var lottiCarne = [];
    var quoteCarne = [];
    var venditeCarne = [];
    var ritiriCarne = [];
    var progressivoCapo = 0;

    GIORNATE.forEach(function (g) {
      var idGiornata = App.core.id.nuovo(App.core.id.GIORNATA);
      giornate.push(App.data.repo.timbraCreazione({
        id: idGiornata,
        squadraId: idSquadra,
        stagioneId: idStagione,
        data: g.data,
        orarioRitrovo: null,      // non annotato sul quaderno
        zona: null,               // non annotata sul quaderno
        capocacciaMembroId: null, // non annotato sul quaderno
        note: g.note || '',
        stato: 'COMPLETATA',
        demo: true
      }));

      g.presenti.forEach(function (nome) {
        if (!idPerNome[nome]) return;
        presenze.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.PRESENZA),
          giornataId: idGiornata,
          membroId: idPerNome[nome],
          stato: 'PRESENTE',
          note: '',
          demo: true
        }));
      });

      // Il peso del singolo capo non era annotato: quando c'e' il totale
      // della giornata lo si divide in parti uguali fra i capi, e lo si
      // dichiara nelle note. Altrimenti resta un valore simbolico.
      var pesiCapi = g.pesoCapiKg && g.capi && g.capi.length
        ? ripartisci(grammi(g.pesoCapiKg), g.capi.length)
        : null;
      var indiceCapo = 0;

      (g.capi || []).forEach(function (c) {
        var mid = idPerNome[c[0]];
        if (!mid) return;
        progressivoCapo++;
        abbattimenti.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.ABBATTIMENTO),
          codiceCapo: App.core.capo.formattaCodice(progressivoCapo),
          squadraId: idSquadra,
          stagioneId: idStagione,
          giornataId: idGiornata,
          tiratoreMembroId: mid,
          sesso: 'NON_DETERMINATO',
          classeEta: 'NON_DETERMINATA',
          // Il peso del singolo capo non era annotato: si registra solo
          // il totale della giornata sull'ultimo capo, se noto.
          pesoGrammi: pesiCapi ? pesiCapi[indiceCapo++] : 1000,
          caneMuta: null,
          note: (c[1] ? 'Perso per difficoltà di recupero. ' : '') +
            (pesiCapi
              ? 'Peso stimato: sul quaderno c\'era solo il totale della giornata.'
              : 'Peso non annotato sul quaderno.'),
          annullato: false,
          recuperato: c[1] ? false : true,
          demo: true
        }));
      });

      if (!g.carneKg && !g.salaminiKg) return;

      // Lotto carne della battuta: la carne netta e' quella divisa
      // piu' quella venduta piu' quella destinata ai salamini.
      var totaleGrammi = grammi(g.carneKg || 0) +
        grammi(g.vendutoKg || 0) + grammi(g.salaminiKg || 0);
      var idLotto = App.core.id.nuovo(App.core.id.LOTTO_CARNE);
      lottiCarne.push(App.data.repo.timbraCreazione({
        id: idLotto,
        giornataId: idGiornata,
        squadraId: idSquadra,
        stagioneId: idStagione,
        pesoNettoDisponibileGrammi: totaleGrammi,
        note: g.pesoCapiKg ? 'Capi per ' + g.pesoCapiKg + ' kg totali.' : '',
        demo: true
      }));

      // Snapshot dei partecipanti: fuori chi e' in compensazione
      // e chi non ha diritto (ospiti).
      var fuori = {};
      (g.compensazione || []).forEach(function (n) { fuori[n] = 'COMPENSAZIONE'; });
      (g.fuoriDivisione || []).forEach(function (n) { fuori[n] = 'SENZA_DIRITTO'; });

      var aventi = g.presenti.filter(function (n) { return !fuori[n] && idPerNome[n]; });
      var quote = ripartisci(grammi(g.carneKg || 0), aventi.length);
      var proCapite = g.presenti.length
        ? Math.floor(grammi(g.carneKg || 0) / g.presenti.length) : 0;
      var i = 0;

      g.presenti.forEach(function (nome) {
        if (!idPerNome[nome]) return;
        var stato = fuori[nome];
        quoteCarne.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.QUOTA_CARNE),
          lottoCarneId: idLotto,
          membroId: idPerNome[nome],
          quotaSpettanteGrammi: stato ? 0 : (quote[i++] || 0),
          haDiritto: !stato,
          inCompensazione: stato === 'COMPENSAZIONE',
          quotaCompensataGrammi: stato === 'COMPENSAZIONE' ? proCapite : 0,
          demo: true
        }));
      });

      if (g.vendutoKg) {
        venditeCarne.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.VENDITA_CARNE),
          lottoCarneId: idLotto,
          data: g.data,
          tipoTaglio: 'MEZZENA',   // il taglio non era annotato
          pesoGrammi: grammi(g.vendutoKg),
          prezzoCentKg: 1000,      // prezzo non annotato: si usa il predefinito
          vendutaDa: g.vendutaDa || '',
          annullata: false,
          note: 'Tipo di taglio e prezzo non annotati sul quaderno.',
          demo: true
        }));
      }

      if (g.salaminiKg) {
        ritiriCarne.push(App.data.repo.timbraCreazione({
          id: App.core.id.nuovo(App.core.id.RITIRO_CARNE),
          membroId: null,
          stagioneId: idStagione,
          lottoCarneId: idLotto,
          data: g.data,
          pesoGrammi: grammi(g.salaminiKg),
          tipoMovimento: 'SALAMINI',
          annullato: false,
          note: 'Messa in freezer per i salamini.',
          demo: true
        }));
      }
    });

    return {
      stagione: stagione,
      calendario: calendario,
      configCarne: configCarne,
      membri: membri,
      iscrizioni: iscrizioni,
      giornate: giornate,
      presenze: presenze,
      abbattimenti: abbattimenti,
      lottiCarne: lottiCarne,
      quoteCarne: quoteCarne,
      venditeCarne: venditeCarne,
      ritiriCarne: ritiriCarne
    };
  }

  // Scrive la stagione dimostrativa nel database, in una sola transazione.
  // Si aggiunge a quello che c'e' gia': non tocca la stagione corrente.
  function inserisci() {
    return App.core.squadra.contesto().then(function (ctx) {
      if (!ctx.squadra) throw new Error('Nessuna squadra presente.');
      return App.data.stagioni.tutte().then(function (stagioni) {
        var gia = stagioni.filter(function (s) { return s.nome === '2025/2026'; })[0];
        if (gia) throw new Error('La stagione dimostrativa 2025/2026 è già caricata.');

        var d = costruisci(ctx.squadra.id);
        var store = ['stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
          'abbattimenti', 'calendariBattuta', 'configCarne', 'lottiCarne',
          'quoteCarne', 'venditeCarne', 'ritiriCarne'];
        return App.data.repo.scrivi(store, function (t) {
          t.put('stagioni', d.stagione);
          t.put('calendariBattuta', d.calendario);
          t.put('configCarne', d.configCarne);
          d.membri.forEach(function (m) { t.put('membri', m); });
          d.iscrizioni.forEach(function (i) { t.put('iscrizioni', i); });
          d.giornate.forEach(function (g) { t.put('giornate', g); });
          d.presenze.forEach(function (p) { t.put('presenze', p); });
          d.abbattimenti.forEach(function (a) { t.put('abbattimenti', a); });
          d.lottiCarne.forEach(function (l) { t.put('lottiCarne', l); });
          d.quoteCarne.forEach(function (q) { t.put('quoteCarne', q); });
          d.venditeCarne.forEach(function (v) { t.put('venditeCarne', v); });
          d.ritiriCarne.forEach(function (r) { t.put('ritiriCarne', r); });
          return {
            giornate: d.giornate.length,
            membri: d.membri.length,
            capi: d.abbattimenti.length
          };
        });
      });
    });
  }

  App.seed.gennaio2026 = {
    costruisci: costruisci,
    inserisci: inserisci,
    SOPRANNOMI: SOPRANNOMI
  };
})(typeof window !== 'undefined' ? window : globalThis);
