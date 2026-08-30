// Suite di test della Fase 1.
// Avvio:  NODE_PATH=<cartella node_modules> node esegui.js
// Richiede: jsdom, fake-indexeddb (solo per i test, mai per l'app).

const H = require('./harness');
const assert = require('assert');

const risultati = [];
let domCorrente = null;

async function prova(nome, fn) {
  try {
    await fn();
    risultati.push({ nome, esito: 'OK', nota: '' });
    console.log('  OK   ' + nome);
  } catch (e) {
    risultati.push({ nome, esito: 'FALLITO', nota: e.message });
    console.log('  FAIL ' + nome + '  -> ' + e.message);
  }
}

function stato(dom, previstaCent, versataCent) {
  return dom.window.App.core.quote.stato(previstaCent, versataCent);
}

async function leggiTutto(dom) {
  return dom.window.App.data.repo.leggiStore(
    dom.window.App.data.schema.nomiStoreBackup);
}

function normalizza(dati) {
  const out = {};
  Object.keys(dati).sort().forEach((k) => {
    out[k] = (dati[k] || []).slice().sort((a, b) =>
      String(a.id || a.chiave).localeCompare(String(b.id || b.chiave)));
  });
  return JSON.stringify(out);
}

(async function main() {
  console.log('\n=== ADRENALINA — TEST FASE 1 ===\n');
  const disco = H.nuovoDisco();

  // ---------------------------------------------------------------- 1
  console.log('[Avvio e dati demo]');
  let dom = await H.avviaApp(disco);
  domCorrente = dom;

  await prova('1. Apertura app senza errori in console', async () => {
    assert.deepStrictEqual(H.erroriConsole, [], 'console sporca: ' + H.erroriConsole.join(' | '));
    assert.ok(dom.window.document.body.textContent.includes('Adrenalina'));
  });

  await prova('7a. Conteggi Home sull\'anagrafica reale (21 attivi, 5 pagate, 16 da incassare)',
    async () => {
      const t = dom.window.document.body.textContent.replace(/\s+/g, ' ');
      assert.ok(t.includes('21Membri attivi'), 'membri attivi errati: ' + t);
      assert.ok(t.includes('5 pagate'), 'quote pagate errate: ' + t);
      assert.ok(t.includes('16Quote da incassare'), 'quote da incassare errate: ' + t);
      // 16 soci x 240,00 € = 3.840,00 €; il separatore delle migliaia
      // dipende dalla locale del motore, quindi si accetta con o senza punto.
      assert.ok(/3\.?840,00 €/.test(t), 'residuo totale errato: ' + t);
    });

  // ---------------------------------------------------------------- stati quota
  console.log('\n[Stato quota derivato]');
  await prova('Q1. 240 € previsti / 0 versati -> NON_PAGATA', async () => {
    assert.strictEqual(stato(dom, 24000, 0), 'NON_PAGATA');
  });
  await prova('Q2. 240 € previsti / 100 versati -> PARZIALE', async () => {
    assert.strictEqual(stato(dom, 24000, 10000), 'PARZIALE');
  });
  await prova('Q3. 240 € previsti / 240 versati -> PAGATA', async () => {
    assert.strictEqual(stato(dom, 24000, 24000), 'PAGATA');
  });
  await prova('Q4. 240 € previsti / 300 versati -> PAGATA', async () => {
    assert.strictEqual(stato(dom, 24000, 30000), 'PAGATA');
  });
  await prova('Q5. 0 € previsti -> NON_APPLICABILE', async () => {
    assert.strictEqual(stato(dom, 0, 0), 'NON_APPLICABILE');
    assert.strictEqual(stato(dom, 0, 5000), 'NON_APPLICABILE');
  });
  await prova('Q6. Nessuno stato o residuo salvato nel database', async () => {
    const d = await leggiTutto(dom);
    d.iscrizioni.forEach((i) => {
      ['statoQuota', 'stato', 'quotaPagata', 'residuo', 'residuoCent', 'saldo'].forEach((c) => {
        assert.ok(!(c in i), 'campo derivato trovato su iscrizione: ' + c);
      });
      assert.ok(Number.isInteger(i.quotaAnnualePrevistaCent), 'quota prevista non intera');
      assert.ok(Number.isInteger(i.quotaVersataCent), 'quota versata non intera');
    });
  });
  await prova('Q7. Importi in centesimi, formattati in euro italiani', async () => {
    const Q = dom.window.App.core.quote;
    assert.strictEqual(Q.formattaEuro(24000), '240,00 €');
    assert.strictEqual(Q.parseEuroInCent('240'), 24000);
    assert.strictEqual(Q.parseEuroInCent('240,00'), 24000);
    assert.strictEqual(Q.parseEuroInCent('1.240,50'), 124050);
    assert.strictEqual(Q.parseEuroInCent('100,5'), 10050);
    assert.strictEqual(Q.parseEuroInCent('abc'), null);
  });

  // ---------------------------------------------------------------- ID
  console.log('\n[Generazione ID]');
  await prova('ID1. ID unici e con prefisso di tipo', async () => {
    const id = dom.window.App.core.id;
    const s = new Set();
    for (let i = 0; i < 5000; i++) s.add(id.nuovo(id.MEMBRO));
    assert.strictEqual(s.size, 5000, 'collisione fra ID');
    assert.ok(id.nuovo(id.STAGIONE).startsWith('stg_'));
  });
  await prova('ID2. Fallback funzionante senza crypto.randomUUID', async () => {
    const id = dom.window.App.core.id;
    id._forzaFallback(true);
    const v = id.nuovo(id.MEMBRO);
    id._forzaFallback(false);
    assert.ok(/^mbr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),
      'UUID di fallback malformato: ' + v);
  });
  await prova('ID3. App avviabile in un contesto privo di crypto.randomUUID', async () => {
    const discoIsolato = H.nuovoDisco();
    const d2 = await H.avviaApp(discoIsolato, { senzaRandomUUID: true });
    assert.strictEqual(typeof d2.window.crypto.randomUUID, 'undefined');
    const dati = await d2.window.App.data.repo.leggiStore(['membri']);
    assert.strictEqual(dati.membri.length, 21, 'seed non eseguito senza randomUUID');
    dati.membri.forEach((m) => assert.ok(/^mbr_[0-9a-f-]{36}$/.test(m.id), 'ID malformato: ' + m.id));
    d2.window.close();
  });

  // ---------------------------------------------------------------- soci
  console.log('\n[Soci]');
  let idNuovoSocio = null;

  await prova('2. Creazione socio con due ruoli contemporanei', async () => {
    await H.vaiA(dom, '#/soci', 'Aggiungi socio');
    H.clic(dom, '[data-vai="#/socio/nuovo"]');
    await H.attesa(dom, () => H.$(dom, '#f-nome'), 'form nuovo socio');

    H.scrivi(dom, '#f-nome', 'Stefano');
    H.scrivi(dom, '#f-cognome', 'Conti');
    H.scrivi(dom, '#f-nascita', '1980-02-10');
    H.scrivi(dom, '#f-telefono', '3401112222');
    H.scrivi(dom, '#f-porto', '2028-01-31');
    H.$$(dom, 'input[name="ruolo"]').forEach((c) => { c.checked = false; });
    H.$$(dom, 'input[name="ruolo"]').forEach((c) => {
      if (c.value === 'CAPOSQUADRA' || c.value === 'CANARO') c.checked = true;
    });
    H.scrivi(dom, '#f-prevista', '240,00');
    H.scrivi(dom, '#f-versata', '100,00');
    H.clic(dom, '#btn-salva');

    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Stefano Conti'), 'scheda del nuovo socio');
    const d = await leggiTutto(dom);
    const m = d.membri.filter((x) => x.cognome === 'Conti')[0];
    assert.ok(m, 'socio non salvato');
    idNuovoSocio = m.id;
    assert.strictEqual(m.demo, false, 'il socio reale non deve essere marcato demo');
    assert.ok(!('ruoliVenatori' in m), 'i ruoli non devono stare sul membro');
    assert.ok(!('ospite' in m), 'ospite non deve stare sul membro');
    assert.strictEqual(m.livelloAccessoApp, 'MEMBRO');
  });

  await prova('R1. I due ruoli sono salvati e riletti dall\'iscrizione', async () => {
    const d = await leggiTutto(dom);
    const isc = d.iscrizioni.filter((i) => i.membroId === idNuovoSocio)[0];
    assert.ok(isc, 'iscrizione non creata');
    assert.deepStrictEqual(isc.ruoliVenatori.slice().sort(), ['CANARO', 'CAPOSQUADRA']);
    assert.strictEqual(isc.quotaAnnualePrevistaCent, 24000);
    assert.strictEqual(isc.quotaVersataCent, 10000);
  });

  await prova('R2. I due ruoli sono visibili in elenco e scheda ("Caposquadra / Canaro")', async () => {
    await H.vaiA(dom, '#/socio/' + idNuovoSocio, 'Stefano Conti');
    const t = dom.window.document.body.textContent.replace(/\s+/g, ' ');
    assert.ok(t.includes('Caposquadra / Canaro'), 'ruoli non mostrati: ' + t);
    assert.ok(t.includes('Parziale'), 'stato quota parziale non mostrato');
    assert.ok(t.includes('140,00 €'), 'residuo non mostrato');
    await H.vaiA(dom, '#/soci', 'Stefano Conti');
    assert.ok(dom.window.document.body.textContent.includes('Caposquadra / Canaro'),
      'ruoli non mostrati in elenco');
  });

  await prova('3. Modifica socio (cambio ruoli e versamento a saldo)', async () => {
    await H.vaiA(dom, '#/socio/' + idNuovoSocio + '/modifica', 'Modifica socio');
    H.$$(dom, 'input[name="ruolo"]').forEach((c) => {
      c.checked = (c.value === 'POSTAIOLO');
    });
    H.scrivi(dom, '#f-versata', '240,00');
    H.scrivi(dom, '#f-telefono', '3409998888');
    H.clic(dom, '#btn-salva');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('3409998888'), 'scheda aggiornata');

    const d = await leggiTutto(dom);
    const m = d.membri.filter((x) => x.id === idNuovoSocio)[0];
    const isc = d.iscrizioni.filter((i) => i.membroId === idNuovoSocio)[0];
    assert.strictEqual(m.telefono, '3409998888');
    assert.deepStrictEqual(isc.ruoliVenatori, ['POSTAIOLO']);
    assert.strictEqual(isc.quotaVersataCent, 24000);
    assert.ok(dom.window.document.body.textContent.includes('Pagata'), 'stato non passato a Pagata');
  });

  await prova('4. Disattivazione socio (nessuna cancellazione)', async () => {
    await H.vaiA(dom, '#/socio/' + idNuovoSocio, 'Disattiva socio');
    H.clic(dom, '#btn-attivo');
    await H.confermaModale(dom, true);
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Riattiva socio'), 'socio disattivato');

    const d = await leggiTutto(dom);
    const m = d.membri.filter((x) => x.id === idNuovoSocio)[0];
    assert.ok(m, 'il socio è stato cancellato invece che disattivato');
    assert.strictEqual(m.attivo, false);
    assert.strictEqual(d.iscrizioni.filter((i) => i.membroId === idNuovoSocio).length, 1,
      'iscrizione persa alla disattivazione');
  });

  await prova('4b. Riattivazione socio', async () => {
    H.clic(dom, '#btn-attivo');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Disattiva socio'), 'socio riattivato');
    const d = await leggiTutto(dom);
    assert.strictEqual(d.membri.filter((x) => x.id === idNuovoSocio)[0].attivo, true);
  });

  await prova('7b. Conteggi Home aggiornati dopo le modifiche', async () => {
    await H.vaiA(dom, '#/home', 'Membri attivi');
    const t = dom.window.document.body.textContent.replace(/\s+/g, ' ');
    assert.ok(t.includes('22Membri attivi'), 'attivi: ' + t);
    assert.ok(t.includes('6 pagate'), 'pagate: ' + t);
    assert.ok(t.includes('16Quote da incassare'), 'da incassare: ' + t);
  });

  // ---------------------------------------------------------------- stagioni
  console.log('\n[Stagioni]');
  let idStagione1 = null, idStagione2 = null;
  let iscrizioniPrimaStagionePrima = null;

  await prova('5. Creazione nuova stagione con iscrizioni automatiche', async () => {
    const prima = await leggiTutto(dom);
    idStagione1 = prima.stagioni[0].id;
    iscrizioniPrimaStagionePrima = JSON.stringify(
      prima.iscrizioni.filter((i) => i.stagioneId === idStagione1)
        .sort((a, b) => a.id.localeCompare(b.id)));

    await H.vaiA(dom, '#/stagioni', 'Nuova stagione');
    H.clic(dom, '#btn-apri-form');
    await H.attesa(dom, () => H.$(dom, '#s-nome'), 'form nuova stagione');
    H.scrivi(dom, '#s-nome', '2027/2028');
    H.scrivi(dom, '#s-inizio', '2027-09-01');
    H.scrivi(dom, '#s-fine', '2028-01-31');
    H.scrivi(dom, '#s-quota', '300,00');
    H.clic(dom, '#btn-crea-stagione');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('2027/2028'), 'nuova stagione creata');

    const dopo = await leggiTutto(dom);
    assert.strictEqual(dopo.stagioni.length, 2);
    idStagione2 = dopo.stagioni.filter((s) => s.nome === '2027/2028')[0].id;
    const nuove = dopo.iscrizioni.filter((i) => i.stagioneId === idStagione2);
    const attivi = dopo.membri.filter((m) => m.attivo).length;
    assert.strictEqual(nuove.length, attivi,
      'iscrizioni generate ' + nuove.length + ' contro ' + attivi + ' membri attivi');
    const inattivi = dopo.membri.filter((m) => !m.attivo).map((m) => m.id);
    nuove.forEach((i) => assert.ok(inattivi.indexOf(i.membroId) === -1,
      'generata iscrizione per un membro non attivo'));
  });

  await prova('S1. La nuova stagione conserva i ruoli della precedente', async () => {
    const d = await leggiTutto(dom);
    const vecchie = {}, nuove = {};
    d.iscrizioni.forEach((i) => {
      if (i.stagioneId === idStagione1) vecchie[i.membroId] = i;
      if (i.stagioneId === idStagione2) nuove[i.membroId] = i;
    });
    let confrontati = 0;
    Object.keys(nuove).forEach((mid) => {
      if (!vecchie[mid]) return;
      assert.deepStrictEqual(nuove[mid].ruoliVenatori, vecchie[mid].ruoliVenatori,
        'ruoli non riportati per ' + mid);
      assert.strictEqual(nuove[mid].ospite, vecchie[mid].ospite, 'flag ospite non riportato');
      confrontati++;
    });
    assert.ok(confrontati >= 5, 'troppi pochi confronti: ' + confrontati);
  });

  await prova('S2. La nuova stagione azzera la quota versata e applica la quota predefinita', async () => {
    const d = await leggiTutto(dom);
    const nuove = d.iscrizioni.filter((i) => i.stagioneId === idStagione2);
    nuove.forEach((i) => {
      assert.strictEqual(i.quotaVersataCent, 0, 'quota versata non azzerata');
      assert.strictEqual(i.quotaAnnualePrevistaCent, 30000, 'quota prevista non allineata');
    });
  });

  await prova('S3. Le iscrizioni della stagione precedente non sono state toccate', async () => {
    const d = await leggiTutto(dom);
    const ora = JSON.stringify(d.iscrizioni.filter((i) => i.stagioneId === idStagione1)
      .sort((a, b) => a.id.localeCompare(b.id)));
    assert.strictEqual(ora, iscrizioniPrimaStagionePrima,
      'le iscrizioni della stagione 2026/2027 sono state modificate');
  });

  await prova('6. Cambio stagione attiva (e dati della stagione precedente intatti)', async () => {
    await H.vaiA(dom, '#/stagioni', 'Rendi attiva');
    H.clic(dom, '[data-attiva="' + idStagione1 + '"]');
    await H.confermaModale(dom, true);
    await H.attesa(dom, async () => {
      const d = await leggiTutto(dom);
      return d.squadre[0].stagioneAttivaId === idStagione1;
    }, 'stagione attiva tornata a 2026/2027');

    await H.vaiA(dom, '#/home', 'Stagione attiva');
    const t = dom.window.document.body.textContent.replace(/\s+/g, ' ');
    assert.ok(t.includes('2026/2027'), 'home non mostra la stagione riattivata');
    assert.ok(t.includes('6 pagate'), 'conteggi non tornati a quelli del 2026/2027: ' + t);

    const d = await leggiTutto(dom);
    const ora = JSON.stringify(d.iscrizioni.filter((i) => i.stagioneId === idStagione1)
      .sort((a, b) => a.id.localeCompare(b.id)));
    assert.strictEqual(ora, iscrizioniPrimaStagionePrima, 'dati di stagione alterati dal cambio');
  });

  // ---------------------------------------------------------------- persistenza
  console.log('\n[Persistenza]');
  let istantaneaPrimaDelRefresh = null;

  await prova('8. Persistenza dopo refresh della pagina', async () => {
    istantaneaPrimaDelRefresh = normalizza(await leggiTutto(dom));
    dom.window.close();
    dom = await H.avviaApp(disco);
    domCorrente = dom;
    const dopo = normalizza(await leggiTutto(dom));
    assert.strictEqual(dopo, istantaneaPrimaDelRefresh, 'dati alterati dal refresh');
  });

  await prova('9. Chiusura e riapertura app senza perdita dati (nessun re-seed)', async () => {
    dom.window.close();
    dom = await H.avviaApp(disco);
    domCorrente = dom;
    const d = await leggiTutto(dom);
    assert.strictEqual(normalizza(d), istantaneaPrimaDelRefresh, 'dati persi alla riapertura');
    assert.strictEqual(d.membri.filter((m) => m.cognome === 'Zanetta').length, 1,
      'anagrafica reinserita una seconda volta');
    assert.ok(dom.window.document.body.textContent.includes('2026/2027'),
      'stagione attiva non ripristinata');
  });

  // ---------------------------------------------------------------- backup
  console.log('\n[Backup]');
  let backupEsportato = null;

  await prova('10. Esportazione JSON', async () => {
    backupEsportato = await dom.window.App.core.backup.costruisciBackup();
    assert.strictEqual(backupEsportato.formato, 'adrenalina-backup');
    assert.strictEqual(backupEsportato.schemaVersion, 4);
    assert.ok(backupEsportato.appVersion);
    assert.ok(backupEsportato.esportatoIl);
    ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni',
     'giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.ok(Array.isArray(backupEsportato.dati[n]), 'store mancante nel backup: ' + n);
    });
    assert.ok(backupEsportato.dati.membri.length >= 7);
    assert.ok(/^adrenalina-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/
      .test(dom.window.App.core.backup.nomeFileBackup()));
    // il file JSON deve essere serializzabile e rileggibile
    const giro = JSON.parse(JSON.stringify(backupEsportato));
    assert.strictEqual(normalizza(giro.dati), normalizza(backupEsportato.dati));
  });

  await prova('10b. Il pulsante "Esporta dati" funziona senza errori', async () => {
    await H.vaiA(dom, '#/backup', 'Esporta dati');
    H.clic(dom, '#btn-esporta');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Backup esportato'), 'toast di esportazione');
  });

  await prova('11a. I dati di prova sono solo quelli di caccia, mai l\'anagrafica', async () => {
    const ant = await dom.window.App.core.backup.anteprimaEliminazioneDemo();
    // Squadra, stagione, soci e iscrizioni sono reali: non vengono mai contati
    // fra i dati di prova, nemmeno dopo aver aggiunto un socio dall'app.
    assert.strictEqual(ant.conteggi.squadre, 0, 'la squadra reale risulta demo');
    assert.strictEqual(ant.conteggi.stagioni, 0, 'la stagione reale risulta demo');
    assert.strictEqual(ant.conteggi.membri, 0, 'dei soci reali risultano demo');
    assert.strictEqual(ant.conteggi.iscrizioni, 0, 'delle iscrizioni reali risultano demo');
    assert.ok(ant.conteggi.giornate > 0 && ant.conteggi.presenze > 0 &&
      ant.conteggi.abbattimenti > 0 && ant.conteggi.controlliSanitari > 0,
      'i dati di caccia non risultano demo');

    assert.strictEqual(ant.puoProcedere, true,
      'eliminazione bloccata senza motivo: ' + ant.problemi.join(' | '));
    await H.vaiA(dom, '#/backup', 'Elimina dati di prova');
    assert.ok(!H.$(dom, '#btn-demo').disabled, 'pulsante disabilitato senza motivo');

    // nulla e' stato eliminato: qui si e' solo guardato
    assert.strictEqual(normalizza(await leggiTutto(dom)), istantaneaPrimaDelRefresh,
      'l\'anteprima ha modificato i dati');
  });

  await prova('12. Reimportazione JSON dopo svuotamento totale', async () => {
    // svuota davvero tutti gli store
    await dom.window.App.data.repo.scrivi(
      dom.window.App.data.schema.nomiStore, (t) => {
        dom.window.App.data.schema.nomiStore.forEach((n) => t.svuota(n));
      });
    let vuoto = await leggiTutto(dom);
    assert.strictEqual(vuoto.membri.length, 0, 'svuotamento non riuscito');

    await dom.window.App.core.backup.importaBackup(
      JSON.parse(JSON.stringify(backupEsportato)));
    const dopo = await leggiTutto(dom);
    assert.ok(dopo.membri.length > 0, 'importazione senza effetto');
  });

  await prova('13. I dati importati coincidono con quelli esportati', async () => {
    const dopo = await leggiTutto(dom);
    assert.strictEqual(normalizza(dopo), normalizza(backupEsportato.dati),
      'i dati importati non coincidono con il backup');
  });

  await prova('13b. Dopo l\'import l\'app si ridisegna con i dati corretti', async () => {
    dom.window.close();
    dom = await H.avviaApp(disco);
    domCorrente = dom;
    const t = dom.window.document.body.textContent.replace(/\s+/g, ' ');
    assert.ok(t.includes('2026/2027'), 'stagione attiva persa: ' + t);
    assert.ok(t.includes('22Membri attivi'), 'conteggi errati dopo import: ' + t);
  });

  await prova('12b. Un backup non valido viene rifiutato senza toccare i dati', async () => {
    const B = dom.window.App.core.backup;
    assert.ok(B.validaBackup({ pippo: 1 }).length > 0, 'oggetto casuale accettato');
    assert.ok(B.validaBackup({ formato: 'altro', schemaVersion: 1, dati: {} }).length > 0,
      'formato estraneo accettato');
    const futuro = { formato: 'adrenalina-backup', schemaVersion: 99, dati: { membri: [] } };
    assert.ok(B.validaBackup(futuro).join(' ').includes('più recente'),
      'schema futuro non segnalato');
    const prima = normalizza(await leggiTutto(dom));
    let rifiutato = false;
    try { await B.importaBackup(futuro); } catch (e) { rifiutato = true; }
    assert.ok(rifiutato, 'import di uno schema futuro non rifiutato');
    assert.strictEqual(normalizza(await leggiTutto(dom)), prima, 'dati toccati da un import fallito');
  });

  // ---------------------------------------------------------------- demo su installazione pulita
  console.log('\n[Eliminazione dati di prova su installazione pulita]');
  await prova('11b. Elimina dati di prova: resta l\'anagrafica, spariscono i dati di caccia',
    async () => {
    const discoPulito = H.nuovoDisco();
    const d3 = await H.avviaApp(discoPulito);
    await H.vaiA(d3, '#/backup', 'Elimina dati di prova');
    assert.ok(!H.$(d3, '#btn-demo').disabled, 'pulsante disabilitato senza motivo');
    H.clic(d3, '#btn-demo');
    await H.confermaModale(d3, true);
    await H.attesa(d3, () => d3.window.location.hash === '#/home', 'ritorno alla Home');
    await H.pausa(d3, 80);

    const dati = await d3.window.App.data.repo.leggiStore(
      d3.window.App.data.schema.nomiStoreBackup);
    // RESTA: squadra, stagione, 21 soci, 21 iscrizioni con le quote reali
    assert.strictEqual(dati.squadre.length, 1, 'squadra reale eliminata');
    assert.strictEqual(dati.squadre[0].nome, 'Adrenalina');
    assert.strictEqual(dati.stagioni.length, 1, 'stagione reale eliminata');
    assert.strictEqual(dati.stagioni[0].nome, '2026/2027');
    assert.strictEqual(dati.membri.length, 21, 'soci reali eliminati');
    assert.strictEqual(dati.iscrizioni.length, 21, 'iscrizioni reali eliminate');
    const pagate = dati.iscrizioni.filter((i) => i.quotaVersataCent === 24000).length;
    assert.strictEqual(pagate, 5, 'quote reali alterate');
    // VIENE ELIMINATO: tutto il resto
    assert.strictEqual(dati.giornate.length, 0, 'giornate demo non eliminate');
    assert.strictEqual(dati.presenze.length, 0, 'presenze demo non eliminate');
    assert.strictEqual(dati.abbattimenti.length, 0, 'abbattimenti demo non eliminati');
    assert.strictEqual(dati.controlliSanitari.length, 0, 'controlli demo non eliminati');

    // e la Home resta usabile con i dati reali
    const t = d3.window.document.body.textContent.replace(/\s+/g, ' ');
    assert.ok(t.includes('21Membri attivi'), 'Home incoerente dopo la pulizia: ' + t);
    assert.ok(t.includes('0Giornate'), 'giornate ancora contate: ' + t);
    assert.ok(t.includes('0Capi stagione'), 'capi ancora contati: ' + t);

    const flag = dati.meta.filter((m) => m.chiave === 'datiDemoPresenti')[0];
    assert.strictEqual(flag.valore, false, 'flag datiDemoPresenti non aggiornato');
    d3.window.close();
  });

  await prova('11c. Un socio aggiunto dall\'app sopravvive alla pulizia dei demo', async () => {
    const discoMisto = H.nuovoDisco();
    const d4 = await H.avviaApp(discoMisto);
    const A = d4.window.App;
    const r = await A.core.membro.creaSocio({
      nome: 'Nuovo', cognome: 'Aggiunto', dataNascita: null, telefono: null, note: '',
      livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null,
      ruoliVenatori: ['POSTAIOLO'], ospite: false,
      quotaAnnualePrevistaCent: 24000, quotaVersataCent: 12000
    });

    const esito = await A.core.backup.eliminaDatiDemo();
    assert.ok(esito.totale > 0, 'niente eliminato');

    const dati = await A.data.repo.leggiStore(
      ['squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
       'abbattimenti', 'controlliSanitari']);
    assert.strictEqual(dati.membri.length, 22, 'soci persi nella pulizia');
    const nuovo = dati.membri.filter((m) => m.id === r.membro.id)[0];
    assert.ok(nuovo, 'il socio aggiunto e\' stato eliminato');
    const isc = dati.iscrizioni.filter((i) => i.membroId === r.membro.id)[0];
    assert.ok(isc, 'iscrizione del socio aggiunto eliminata');
    assert.strictEqual(isc.quotaVersataCent, 12000, 'quota del socio aggiunto alterata');
    // e i dati di caccia sono spariti tutti
    ['giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.strictEqual(dati[n].length, 0, 'store non svuotato: ' + n);
    });
    d4.window.close();
  });

  // ---------------------------------------------------------------- validazione backup
  console.log('\n[Validazione backup]');

  // Ricostruisce uno stato noto e restituisce un backup valido da mutare.
  async function baseValida() {
    const b = await dom.window.App.core.backup.costruisciBackup();
    return JSON.parse(JSON.stringify(b));
  }

  // Verifica che un backup rotto venga rifiutato e che il database non cambi.
  async function rifiutaSenzaScrivere(nome, muta, frammentoAtteso) {
    await prova(nome, async () => {
      const B = dom.window.App.core.backup;
      const prima = normalizza(await leggiTutto(dom));
      const rotto = await baseValida();
      muta(rotto);

      const errori = B.validaBackup(rotto);
      assert.ok(errori.length > 0, 'backup rotto giudicato valido');
      if (frammentoAtteso) {
        assert.ok(errori.join(' | ').toLowerCase().includes(frammentoAtteso.toLowerCase()),
          'messaggio inatteso: ' + errori.join(' | '));
      }

      let rifiutato = false;
      try { await B.importaBackup(rotto); } catch (e) { rifiutato = true; }
      assert.ok(rifiutato, 'importaBackup non ha rifiutato il backup');

      const dopo = normalizza(await leggiTutto(dom));
      assert.strictEqual(dopo, prima, 'il database e\' stato modificato da un import rifiutato');
    });
  }

  await rifiutaSenzaScrivere('B1. dati vuoto ({}) rifiutato',
    (b) => { b.dati = {}; }, 'mancante');

  await rifiutaSenzaScrivere('B2. store obbligatorio mancante (membri) rifiutato',
    (b) => { delete b.dati.membri; }, 'membri');

  await rifiutaSenzaScrivere('B2b. store obbligatorio non lista rifiutato',
    (b) => { b.dati.iscrizioni = { a: 1 }; }, 'non');

  await rifiutaSenzaScrivere('B3. iscrizione orfana (stagione inesistente) rifiutata',
    (b) => { b.dati.iscrizioni[0].stagioneId = 'stg_inesistente'; }, 'stagione inesistente');

  await rifiutaSenzaScrivere('B3b. iscrizione orfana (socio inesistente) rifiutata',
    (b) => { b.dati.iscrizioni[0].membroId = 'mbr_inesistente'; }, 'socio inesistente');

  await rifiutaSenzaScrivere('B4. membro con squadra inesistente rifiutato',
    (b) => { b.dati.membri[0].squadraId = 'sqd_inesistente'; }, 'squadra inesistente');

  await rifiutaSenzaScrivere('B4b. stagione con squadra inesistente rifiutata',
    (b) => { b.dati.stagioni[0].squadraId = 'sqd_inesistente'; }, 'squadra inesistente');

  await rifiutaSenzaScrivere('B5. stagione attiva appartenente a un\'altra squadra rifiutata',
    (b) => {
      const altra = { id: 'sqd_altra', nome: 'Altra', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(altra);
      // la stagione della squadra reale viene assegnata come attiva alla nuova
      altra.stagioneAttivaId = b.dati.stagioni[0].id;
    }, 'un\u2019altra squadra');

  await rifiutaSenzaScrivere('B5b. stagione attiva inesistente rifiutata',
    (b) => { b.dati.squadre[0].stagioneAttivaId = 'stg_inesistente'; }, 'inesistente');

  await rifiutaSenzaScrivere('B6. iscrizione duplicata (stessa stagione + stesso socio) rifiutata',
    (b) => {
      const copia = JSON.parse(JSON.stringify(b.dati.iscrizioni[0]));
      copia.id = 'isc_copia';
      b.dati.iscrizioni.push(copia);
    }, 'stessa stagione');

  await rifiutaSenzaScrivere('B6b. due record con lo stesso id rifiutati',
    (b) => { b.dati.membri.push(JSON.parse(JSON.stringify(b.dati.membri[0]))); }, 'stesso id');

  await rifiutaSenzaScrivere('B7. quota con valore decimale rifiutata',
    (b) => { b.dati.iscrizioni[0].quotaVersataCent = 100.5; }, 'quota versata');

  await rifiutaSenzaScrivere('B7b. quota non numerica rifiutata',
    (b) => { b.dati.iscrizioni[0].quotaAnnualePrevistaCent = '24000'; }, 'quota prevista');

  await rifiutaSenzaScrivere('B7c. quota negativa rifiutata',
    (b) => { b.dati.iscrizioni[0].quotaVersataCent = -1; }, 'quota versata');

  await rifiutaSenzaScrivere('B7d. quota predefinita di stagione non intera rifiutata',
    (b) => { b.dati.stagioni[0].quotaAnnualePredefinitaCent = 240.99; }, 'quota predefinita');

  await rifiutaSenzaScrivere('B8. ruoliVenatori non lista rifiutato',
    (b) => { b.dati.iscrizioni[0].ruoliVenatori = 'CANARO'; }, 'lista non vuota');

  await rifiutaSenzaScrivere('B8b. ruoliVenatori vuoto rifiutato',
    (b) => { b.dati.iscrizioni[0].ruoliVenatori = []; }, 'lista non vuota');

  await rifiutaSenzaScrivere('B8c. ruolo non riconosciuto rifiutato',
    (b) => { b.dati.iscrizioni[0].ruoliVenatori = ['CANARO', 'OSPITE']; }, 'non riconosciuto');

  await rifiutaSenzaScrivere('B9. livello di accesso non valido rifiutato',
    (b) => { b.dati.membri[0].livelloAccessoApp = 'SUPERUSER'; }, 'livello di accesso');

  await rifiutaSenzaScrivere('B10. record senza id rifiutato',
    (b) => { delete b.dati.membri[0].id; }, 'id valido');

  await rifiutaSenzaScrivere('B10b. iscrizione senza stagioneId rifiutata',
    (b) => { delete b.dati.iscrizioni[0].stagioneId; }, 'stagioneid');

  await prova('B11. Un backup integro resta valido e importabile', async () => {
    const B = dom.window.App.core.backup;
    const buono = await baseValida();
    assert.deepStrictEqual(B.validaBackup(buono).length, 0,
      'backup valido rifiutato: ' + B.validaBackup(buono).join(' | '));
    const prima = normalizza(await leggiTutto(dom));
    await B.importaBackup(buono);
    assert.strictEqual(normalizza(await leggiTutto(dom)), prima,
      'reimport dello stesso backup ha alterato i dati');
  });

  // ---------------------------------------------------------------- configurazione iniziale
  console.log('\n[Configurazione iniziale]');

  await prova('C1. Senza squadra il router porta alla configurazione iniziale', async () => {
    const discoVuoto = H.nuovoDisco();
    const d5 = await H.avviaApp(discoVuoto);
    // svuota tutto, poi prova a raggiungere Home
    await d5.window.App.data.repo.scrivi(d5.window.App.data.schema.nomiStore, (t) => {
      d5.window.App.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    d5.window.App.ui.router.vai('#/home');
    await H.attesa(d5, () => d5.window.location.hash === '#/configurazione',
      'redirezione alla configurazione');
    assert.ok(d5.window.document.body.textContent.includes('Configurazione iniziale'));
    d5.window.close();
  });

  await prova('C2. La configurazione crea squadra e stagione reali in una transazione', async () => {
    const discoVuoto = H.nuovoDisco();
    const d6 = await H.avviaApp(discoVuoto);
    await d6.window.App.data.repo.scrivi(d6.window.App.data.schema.nomiStore, (t) => {
      d6.window.App.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    d6.window.App.ui.router.vai('#/configurazione');
    await H.attesa(d6, () => H.$(d6, '#c-squadra'), 'form di configurazione');

    // valori precompilati richiesti
    assert.strictEqual(H.$(d6, '#c-squadra').value, 'Adrenalina');
    assert.strictEqual(H.$(d6, '#c-stagione').value, '2026/2027');

    H.scrivi(d6, '#c-squadra', 'Adrenalina');
    H.scrivi(d6, '#c-stagione', '2026/2027');
    H.scrivi(d6, '#c-inizio', '2026-09-01');
    H.scrivi(d6, '#c-fine', '2027-01-31');
    H.scrivi(d6, '#c-quota', '240,00');
    H.clic(d6, '#btn-crea-squadra');

    await H.attesa(d6, () => d6.window.location.hash === '#/home', 'ritorno alla Home');
    await H.pausa(d6, 60);

    const d = await d6.window.App.data.repo.leggiStore(
      ['squadre', 'stagioni', 'membri', 'iscrizioni', 'meta']);
    assert.strictEqual(d.squadre.length, 1);
    assert.strictEqual(d.stagioni.length, 1);
    assert.strictEqual(d.membri.length, 0, 'la configurazione non deve creare soci');
    assert.strictEqual(d.iscrizioni.length, 0);

    const sq = d.squadre[0], st = d.stagioni[0];
    assert.strictEqual(sq.nome, 'Adrenalina');
    assert.strictEqual(sq.demo, false, 'squadra marcata demo per errore');
    assert.strictEqual(st.demo, false, 'stagione marcata demo per errore');
    assert.strictEqual(st.nome, '2026/2027');
    assert.strictEqual(st.stato, 'attiva');
    assert.strictEqual(st.squadraId, sq.id);
    assert.strictEqual(sq.stagioneAttivaId, st.id, 'stagione non impostata come attiva');
    assert.strictEqual(st.quotaAnnualePredefinitaCent, 24000);

    const meta = {};
    d.meta.forEach((m) => { meta[m.chiave] = m.valore; });
    assert.strictEqual(meta.squadraCorrenteId, sq.id);
    assert.strictEqual(meta.datiDemoPresenti, false);
    assert.strictEqual(meta.schemaVersion, d6.window.App.versione.SCHEMA_VERSION);

    assert.ok(d6.window.document.body.textContent.includes('2026/2027'),
      'Home non mostra la stagione appena creata');
    d6.window.close();
  });

  await prova('C3. La configurazione rifiuta campi non validi senza scrivere nulla', async () => {
    const discoVuoto = H.nuovoDisco();
    const d7 = await H.avviaApp(discoVuoto);
    await d7.window.App.data.repo.scrivi(d7.window.App.data.schema.nomiStore, (t) => {
      d7.window.App.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    d7.window.App.ui.router.vai('#/configurazione');
    await H.attesa(d7, () => H.$(d7, '#c-squadra'), 'form di configurazione');

    H.scrivi(d7, '#c-squadra', '   ');
    H.clic(d7, '#btn-crea-squadra');
    await H.pausa(d7, 60);
    assert.ok(H.$(d7, '#err-config').textContent.length > 0, 'nessun errore mostrato');
    let d = await d7.window.App.data.repo.leggiStore(['squadre']);
    assert.strictEqual(d.squadre.length, 0, 'squadra creata nonostante il nome vuoto');

    H.scrivi(d7, '#c-squadra', 'Adrenalina');
    H.scrivi(d7, '#c-inizio', '2027-01-31');
    H.scrivi(d7, '#c-fine', '2026-09-01');
    H.clic(d7, '#btn-crea-squadra');
    await H.pausa(d7, 60);
    assert.ok(H.$(d7, '#err-config').textContent.includes('fine'), 'date incoerenti accettate');
    d = await d7.window.App.data.repo.leggiStore(['squadre']);
    assert.strictEqual(d.squadre.length, 0, 'squadra creata con date incoerenti');
    d7.window.close();
  });

  await prova('C4. Backup resta raggiungibile anche senza squadra', async () => {
    const discoVuoto = H.nuovoDisco();
    const d8 = await H.avviaApp(discoVuoto);
    await d8.window.App.data.repo.scrivi(d8.window.App.data.schema.nomiStore, (t) => {
      d8.window.App.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    d8.window.App.ui.router.vai('#/backup');
    await H.attesa(d8, () =>
      d8.window.document.body.textContent.includes('Esporta dati'), 'schermata backup');
    assert.strictEqual(d8.window.location.hash, '#/backup',
      'la schermata backup e\' stata deviata');
    d8.window.close();
  });

  // ---------------------------------------------------------------- Blocco 2: schema
  console.log('\n[Blocco 2 — schema e migrazioni]');

  await prova('G1. Installazione nuova: database creato direttamente a v4', async () => {
    const discoNuovo = H.nuovoDisco();
    const dA = await H.avviaApp(discoNuovo);
    const idb = await dA.window.App.data.db.apri();
    assert.strictEqual(idb.version, 4, 'versione database errata');
    ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
     'abbattimenti', 'controlliSanitari']
      .forEach((n) => assert.ok(idb.objectStoreNames.contains(n), 'store mancante: ' + n));
    const p = idb.transaction(['presenze'], 'readonly').objectStore('presenze');
    assert.ok(p.indexNames.contains('by_giornata_membro'), 'indice unico mancante');
    dA.window.close();
  });

  await prova('G2. Upgrade v1 -> v4 senza perdita dati (tutti i blocchi in un colpo)', async () => {
    // Costruisce a mano un database in formato Fase 1 (versione 1, senza i
    // nuovi store), poi lascia che l'app lo apra e lo aggiorni.
    const discoV1 = H.nuovoDisco();
    const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
    void FDBKeyRange;

    const atteso = await new Promise((resolve, reject) => {
      const req = discoV1.open('adrenalinaDB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('meta', { keyPath: 'chiave' });
        db.createObjectStore('squadre', { keyPath: 'id' });
        const st = db.createObjectStore('stagioni', { keyPath: 'id' });
        st.createIndex('by_squadra', 'squadraId');
        st.createIndex('by_stato', 'stato');
        const mb = db.createObjectStore('membri', { keyPath: 'id' });
        mb.createIndex('by_squadra', 'squadraId');
        mb.createIndex('by_cognome', 'cognome');
        const isc = db.createObjectStore('iscrizioni', { keyPath: 'id' });
        isc.createIndex('by_stagione', 'stagioneId');
        isc.createIndex('by_membro', 'membroId');
        isc.createIndex('by_stagione_membro', ['stagioneId', 'membroId'], { unique: true });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction(['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni'], 'readwrite');
        t.objectStore('meta').put({ chiave: 'schemaVersion', valore: 1 });
        t.objectStore('meta').put({ chiave: 'squadraCorrenteId', valore: 'sqd_v1' });
        t.objectStore('meta').put({ chiave: 'datiDemoPresenti', valore: false });
        t.objectStore('squadre').put({ id: 'sqd_v1', nome: 'Adrenalina', stagioneAttivaId: 'stg_v1',
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('stagioni').put({ id: 'stg_v1', squadraId: 'sqd_v1', nome: '2026/2027',
          dataInizio: '2026-09-01', dataFine: '2027-01-31', stato: 'attiva',
          quotaAnnualePredefinitaCent: 24000, demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('membri').put({ id: 'mbr_v1', squadraId: 'sqd_v1', nome: 'Vecchio',
          cognome: 'Socio', dataNascita: null, telefono: null, note: '',
          livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null,
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('iscrizioni').put({ id: 'isc_v1', stagioneId: 'stg_v1', membroId: 'mbr_v1',
          ruoliVenatori: ['POSTAIOLO'], ospite: false, quotaAnnualePrevistaCent: 24000,
          quotaVersataCent: 10000, creatoIl: 'x', aggiornatoIl: 'x' });
        t.oncomplete = () => { db.close(); resolve(true); };
        t.onerror = () => reject(t.error);
      };
    });
    assert.ok(atteso);

    const dB = await H.avviaApp(discoV1);
    const idb = await dB.window.App.data.db.apri();
    assert.strictEqual(idb.version, 4, 'database non aggiornato a v4');
    ['giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.ok(idb.objectStoreNames.contains(n), 'store ' + n + ' non creato');
    });

    const d = await dB.window.App.data.repo.leggiStore(
      ['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni', 'giornate', 'presenze',
       'abbattimenti', 'controlliSanitari']);
    assert.strictEqual(d.squadre.length, 1, 'squadra persa');
    assert.strictEqual(d.squadre[0].nome, 'Adrenalina');
    assert.strictEqual(d.stagioni.length, 1, 'stagione persa');
    assert.strictEqual(d.membri.length, 1, 'socio perso');
    assert.strictEqual(d.membri[0].cognome, 'Socio');
    assert.strictEqual(d.iscrizioni.length, 1, 'iscrizione persa');
    assert.strictEqual(d.iscrizioni[0].quotaVersataCent, 10000, 'quota alterata');
    assert.strictEqual(d.giornate.length, 0);
    assert.strictEqual(d.presenze.length, 0);
    assert.strictEqual(d.abbattimenti.length, 0);
    assert.strictEqual(d.controlliSanitari.length, 0);
    const metaV1 = {};
    d.meta.forEach((m) => { metaV1[m.chiave] = m.valore; });
    assert.strictEqual(metaV1.schemaVersion, 4,
      'meta.schemaVersion non aggiornato dall\'upgrade');
    assert.strictEqual(d.meta.filter((m) => m.chiave === 'schemaVersion').length, 1,
      'chiave schemaVersion duplicata');
    // nessun re-seed di dati demo sopra un database esistente
    assert.strictEqual(d.membri.filter((m) => m.demo === true).length, 0, 'dati demo reinseriti');
    assert.ok(dB.window.document.body.textContent.includes('2026/2027'), 'Home non ripristinata');
    dB.window.close();
  });

  await prova('G3. Import di un backup schema 1 migrato fino a schema 4', async () => {
    const discoMig = H.nuovoDisco();
    const dC = await H.avviaApp(discoMig);
    const A = dC.window.App;

    // backup in formato Fase 1: nessun giornate/presenze
    const b2 = await A.core.backup.costruisciBackup();
    const b1 = JSON.parse(JSON.stringify(b2));
    b1.schemaVersion = 1;
    delete b1.dati.giornate;
    delete b1.dati.presenze;
    delete b1.dati.abbattimenti;
    delete b1.dati.controlliSanitari;

    assert.deepStrictEqual(A.core.backup.validaBackup(b1).length, 0,
      'backup schema 1 rifiutato: ' + A.core.backup.validaBackup(b1).join(' | '));

    await A.core.backup.importaBackup(b1);
    const d = await A.data.repo.leggiStore(
      ['membri', 'giornate', 'presenze', 'iscrizioni', 'abbattimenti', 'controlliSanitari']);
    assert.ok(d.membri.length > 0, 'membri persi nella migrazione');
    assert.strictEqual(d.giornate.length, 0, 'giornate non inizializzate a lista vuota');
    assert.strictEqual(d.presenze.length, 0, 'presenze non inizializzate a lista vuota');
    assert.strictEqual(d.abbattimenti.length, 0, 'abbattimenti non inizializzati a lista vuota');
    assert.strictEqual(d.controlliSanitari.length, 0, 'controlli non inizializzati a lista vuota');

    // riesportando si ottiene uno schema 4 completo
    const riesportato = await A.core.backup.costruisciBackup();
    assert.strictEqual(riesportato.schemaVersion, 4);
    assert.ok(Array.isArray(riesportato.dati.giornate));
    assert.ok(Array.isArray(riesportato.dati.abbattimenti));
    assert.ok(Array.isArray(riesportato.dati.controlliSanitari));
    dC.window.close();
  });

  await prova('G4. Un backup schema 1 privo di uno store di Fase 1 resta rifiutato', async () => {
    const B = dom.window.App.core.backup;
    const b = await baseValida();
    b.schemaVersion = 1;
    delete b.dati.giornate;
    delete b.dati.presenze;
    delete b.dati.membri;
    const errori = B.validaBackup(b);
    assert.ok(errori.join(' ').includes('membri'), 'store mancante non segnalato');
  });

  // ---------------------------------------------------------------- Blocco 2: giornate
  console.log('\n[Blocco 2 — giornate]');
  let idGiornata = null;

  await prova('G5. Elenco giornate: future prima, poi passate dalla piu\' recente', async () => {
    await H.vaiA(dom, '#/giornate', 'Nuova giornata');
    const r = await dom.window.App.core.giornata.elenco();
    assert.ok(r.righe.length >= 4, 'giornate demo non presenti: ' + r.righe.length);
    const oggi = dom.window.App.core.giornata.oggiIso();
    const date = r.righe.map((x) => x.giornata.data);
    const future = date.filter((d) => d >= oggi);
    const passate = date.filter((d) => d < oggi);
    assert.deepStrictEqual(date.join(','), future.concat(passate).join(','),
      'le future non precedono le passate');
    assert.deepStrictEqual(future.join(','), future.slice().sort().join(','),
      'future non in ordine crescente');
    assert.deepStrictEqual(passate.join(','), passate.slice().sort().reverse().join(','),
      'passate non in ordine decrescente');
  });

  await prova('G6. Creazione giornata dal form, con capocaccia valido', async () => {
    H.clic(dom, '[data-vai="#/giornata/nuova"]');
    await H.attesa(dom, () => H.$(dom, '#g-data'), 'form nuova giornata');
    assert.strictEqual(H.$(dom, '#g-orario').value, '06:30', 'orario non precompilato');
    assert.strictEqual(H.$(dom, '#g-zona').value, '', 'zona precompilata per errore');

    const membri = await dom.window.App.data.membri.tutti();
    const capo = membri.filter((m) => m.attivo)[0];

    H.scrivi(dom, '#g-data', '2026-12-20');
    H.scrivi(dom, '#g-orario', '07:15');
    H.scrivi(dom, '#g-zona', 'Costa Lunga');
    H.scrivi(dom, '#g-capocaccia', capo.id);
    H.scrivi(dom, '#g-note', 'Ritrovo al bivio.');
    H.clic(dom, '#btn-salva-giornata');

    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Costa Lunga'), 'scheda giornata');

    const d = await leggiTutto(dom);
    const g = d.giornate.filter((x) => x.zona === 'Costa Lunga')[0];
    assert.ok(g, 'giornata non salvata');
    idGiornata = g.id;
    assert.strictEqual(g.data, '2026-12-20');
    assert.strictEqual(g.orarioRitrovo, '07:15');
    assert.strictEqual(g.stato, 'PROGRAMMATA', 'stato predefinito errato');
    assert.strictEqual(g.capocacciaMembroId, capo.id);
    assert.strictEqual(g.demo, false);
    const ctx = await dom.window.App.core.squadra.contesto();
    assert.strictEqual(g.stagioneId, ctx.stagioneAttiva.id, 'giornata non legata alla stagione attiva');
    assert.strictEqual(g.squadraId, ctx.squadra.id);
  });

  await prova('G7. Giornata senza capocaccia ammessa (capocacciaMembroId null)', async () => {
    const g = await dom.window.App.core.giornata.crea({
      data: '2026-12-27', orarioRitrovo: '06:30', zona: 'Fosso Stretto',
      capocacciaMembroId: null, note: '', stato: 'PROGRAMMATA'
    });
    assert.strictEqual(g.capocacciaMembroId, null);
    const letta = await dom.window.App.data.giornate.perId(g.id);
    assert.strictEqual(letta.capocacciaMembroId, null);
  });

  await prova('G8. Capocaccia inesistente o di altra squadra rifiutato', async () => {
    const G = dom.window.App.core.giornata;
    let ko = false;
    try {
      await G.crea({ data: '2026-12-28', orarioRitrovo: '06:30', zona: 'X',
        capocacciaMembroId: 'mbr_inesistente', note: '', stato: 'PROGRAMMATA' });
    } catch (e) { ko = true; }
    assert.ok(ko, 'capocaccia inesistente accettato');

    // socio di un'altra squadra
    const A = dom.window.App;
    const estraneo = A.data.repo.timbraCreazione({
      id: A.core.id.nuovo(A.core.id.MEMBRO), squadraId: 'sqd_altra_squadra',
      nome: 'Estraneo', cognome: 'Altrove', dataNascita: null, telefono: null, note: '',
      livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null, demo: false
    });
    await A.data.repo.scrivi(['membri'], (t) => { t.put('membri', estraneo); });
    ko = false;
    try {
      await G.crea({ data: '2026-12-29', orarioRitrovo: '06:30', zona: 'X',
        capocacciaMembroId: estraneo.id, note: '', stato: 'PROGRAMMATA' });
    } catch (e) { ko = true; }
    assert.ok(ko, 'capocaccia di altra squadra accettato');
    await A.data.repo.scrivi(['membri'], (t) => { t.elimina('membri', estraneo.id); });
  });

  await prova('G9. Modifica giornata dal form', async () => {
    await H.vaiA(dom, '#/giornata/' + idGiornata + '/modifica', 'Modifica giornata');
    H.scrivi(dom, '#g-zona', 'Costa Lunga Alta');
    H.scrivi(dom, '#g-orario', '06:45');
    H.clic(dom, '#btn-salva-giornata');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Costa Lunga Alta'), 'scheda aggiornata');
    const g = await dom.window.App.data.giornate.perId(idGiornata);
    assert.strictEqual(g.zona, 'Costa Lunga Alta');
    assert.strictEqual(g.orarioRitrovo, '06:45');
  });

  await prova('G10. Cambio stato giornata e rifiuto di stati non validi', async () => {
    const G = dom.window.App.core.giornata;
    await G.cambiaStato(idGiornata, 'COMPLETATA');
    let g = await dom.window.App.data.giornate.perId(idGiornata);
    assert.strictEqual(g.stato, 'COMPLETATA');
    await G.cambiaStato(idGiornata, 'ANNULLATA');
    g = await dom.window.App.data.giornate.perId(idGiornata);
    assert.strictEqual(g.stato, 'ANNULLATA');

    let ko = false;
    try { await G.cambiaStato(idGiornata, 'RINVIATA'); } catch (e) { ko = true; }
    assert.ok(ko, 'stato inventato accettato');
    ko = false;
    try {
      await G.crea({ data: '2027-01-05', orarioRitrovo: '06:30', zona: 'X',
        capocacciaMembroId: null, note: '', stato: 'BOH' });
    } catch (e) { ko = true; }
    assert.ok(ko, 'stato non valido accettato in creazione');

    await G.cambiaStato(idGiornata, 'PROGRAMMATA');
  });

  await prova('G11. Data mancante o malformata rifiutata', async () => {
    const G = dom.window.App.core.giornata;
    assert.ok(G.valida({ data: '', stato: 'PROGRAMMATA' }).data, 'data vuota accettata');
    assert.ok(G.valida({ data: '20/12/2026', stato: 'PROGRAMMATA' }).data, 'data italiana accettata');
    assert.ok(!G.valida({ data: '2026-12-20', stato: 'PROGRAMMATA' }).data, 'data ISO rifiutata');
  });

  // ---------------------------------------------------------------- Blocco 2: presenze
  console.log('\n[Blocco 2 — presenze]');

  await prova('P1. Creazione presenza dalla schermata, con contatori aggiornati', async () => {
    await H.vaiA(dom, '#/giornata/' + idGiornata + '/presenze', 'Presenti');
    const bottoni = H.$$(dom, '.card-presenza .scelta');
    assert.ok(bottoni.length >= 4, 'controlli presenza non trovati');
    // nessun record all'inizio: tutti non segnati
    assert.strictEqual(H.$(dom, '#cnt-presenti').textContent, '0');
    const nonSegnatiIniziali = Number(H.$(dom, '#cnt-nonsegnati').textContent);
    assert.ok(nonSegnatiIniziali > 0, 'conteggio non segnati errato');

    const prima = H.$$(dom, '.card-presenza')[0];
    H.clic(dom, prima.querySelector('.scelta.presente'));
    await H.attesa(dom, () => H.$(dom, '#cnt-presenti').textContent === '1', 'contatore presenti');
    assert.strictEqual(Number(H.$(dom, '#cnt-nonsegnati').textContent), nonSegnatiIniziali - 1);

    await H.pausa(dom, 80);
    const d = await leggiTutto(dom);
    const p = d.presenze.filter((x) => x.giornataId === idGiornata);
    assert.strictEqual(p.length, 1, 'record presenza non creato');
    assert.strictEqual(p[0].stato, 'PRESENTE');
    assert.strictEqual(p[0].demo, false);
  });

  await prova('P2. Modifica presenza: PRESENTE -> LAVORO -> ASSENTE', async () => {
    const card = H.$$(dom, '.card-presenza')[0];
    H.clic(dom, card.querySelector('.scelta.lavoro'));
    await H.attesa(dom, () => H.$(dom, '#cnt-lavoro').textContent === '1', 'contatore lavoro');
    await H.pausa(dom, 80);
    let d = await leggiTutto(dom);
    let p = d.presenze.filter((x) => x.giornataId === idGiornata);
    assert.strictEqual(p.length, 1, 'record duplicato invece di aggiornato');
    assert.strictEqual(p[0].stato, 'LAVORO');
    const idPresenza = p[0].id;

    H.clic(dom, card.querySelector('.scelta.assente'));
    await H.attesa(dom, () => H.$(dom, '#cnt-assenti').textContent === '1', 'contatore assenti');
    await H.pausa(dom, 80);
    d = await leggiTutto(dom);
    p = d.presenze.filter((x) => x.giornataId === idGiornata);
    assert.strictEqual(p.length, 1);
    assert.strictEqual(p[0].stato, 'ASSENTE');
    assert.strictEqual(p[0].id, idPresenza, 'id della presenza cambiato durante l\'aggiornamento');
  });

  await prova('P3. Ritorno a NON_SEGNATO: il record viene eliminato (opzione B)', async () => {
    const card = H.$$(dom, '.card-presenza')[0];
    H.clic(dom, card.querySelector('.scelta.nonsegnato'));
    await H.attesa(dom, () => H.$(dom, '#cnt-assenti').textContent === '0', 'contatore azzerato');
    await H.pausa(dom, 80);
    const d = await leggiTutto(dom);
    const p = d.presenze.filter((x) => x.giornataId === idGiornata);
    assert.strictEqual(p.length, 0, 'record NON_SEGNATO rimasto in archivio');
  });

  await prova('P4. NON_SEGNATO non viene mai salvato come record', async () => {
    const A = dom.window.App;
    const membri = await A.data.membri.tutti();
    const ctx = await A.core.squadra.contesto();
    const m = membri.filter((x) => x.squadraId === ctx.squadra.id && x.attivo)[0];
    const r = await A.core.presenza.imposta(idGiornata, m.id, 'NON_SEGNATO');
    assert.strictEqual(r, null, 'imposta ha restituito un record per NON_SEGNATO');
    const d = await leggiTutto(dom);
    d.presenze.forEach((p) => {
      assert.notStrictEqual(p.stato, 'NON_SEGNATO', 'trovato record con stato NON_SEGNATO');
    });
  });

  await prova('P5. Stato presenza non valido rifiutato', async () => {
    const A = dom.window.App;
    const membri = await A.data.membri.tutti();
    let ko = false;
    try { await A.core.presenza.imposta(idGiornata, membri[0].id, 'FORSE'); } catch (e) { ko = true; }
    assert.ok(ko, 'stato inventato accettato');
  });

  await prova('P6. Conteggi presenti/assenti/lavoro/non segnati coerenti', async () => {
    const A = dom.window.App;
    const dati0 = await A.core.presenza.perGiornata(idGiornata);
    const membri = dati0.righe.map((r) => r.membro.id);
    assert.ok(membri.length >= 4, 'servono almeno 4 soci per il test');

    await A.core.presenza.imposta(idGiornata, membri[0], 'PRESENTE');
    await A.core.presenza.imposta(idGiornata, membri[1], 'PRESENTE');
    await A.core.presenza.imposta(idGiornata, membri[2], 'ASSENTE');
    await A.core.presenza.imposta(idGiornata, membri[3], 'LAVORO');

    const dati = await A.core.presenza.perGiornata(idGiornata);
    assert.strictEqual(dati.riepilogo.presenti, 2);
    assert.strictEqual(dati.riepilogo.assenti, 1);
    assert.strictEqual(dati.riepilogo.lavoro, 1);
    assert.strictEqual(dati.riepilogo.nonSegnati, dati.righe.length - 4);
    assert.strictEqual(
      dati.riepilogo.presenti + dati.riepilogo.assenti +
      dati.riepilogo.lavoro + dati.riepilogo.nonSegnati,
      dati.righe.length, 'i conteggi non sommano al totale dei soci');

    // e la schermata li mostra
    await H.vaiA(dom, '#/giornata/' + idGiornata + '/presenze', 'Presenti');
    assert.strictEqual(H.$(dom, '#cnt-presenti').textContent, '2');
    assert.strictEqual(H.$(dom, '#cnt-assenti').textContent, '1');
    assert.strictEqual(H.$(dom, '#cnt-lavoro').textContent, '1');
  });

  await prova('P7. Unicita\' giornata + membro', async () => {
    const A = dom.window.App;
    const dati = await A.core.presenza.perGiornata(idGiornata);
    const mid = dati.righe[0].membro.id;
    await A.core.presenza.imposta(idGiornata, mid, 'PRESENTE');
    await A.core.presenza.imposta(idGiornata, mid, 'ASSENTE');
    await A.core.presenza.imposta(idGiornata, mid, 'PRESENTE');
    const d = await leggiTutto(dom);
    const coppie = {};
    d.presenze.forEach((p) => {
      const k = p.giornataId + '|' + p.membroId;
      assert.ok(!coppie[k], 'coppia giornata+membro duplicata');
      coppie[k] = true;
    });
    // e l'indice unico impedisce l'inserimento diretto di un doppione
    const esistente = d.presenze.filter((p) => p.giornataId === idGiornata && p.membroId === mid)[0];
    const copia = JSON.parse(JSON.stringify(esistente));
    copia.id = 'pre_doppione';
    let ko = false;
    try {
      await A.data.repo.scrivi(['presenze'], (t) => { t.put('presenze', copia); });
    } catch (e) { ko = true; }
    assert.ok(ko, 'l\'indice unico non ha impedito il doppione');
  });

  await prova('P8. Presenza di un socio di un\'altra squadra rifiutata', async () => {
    const A = dom.window.App;
    const estraneo = A.data.repo.timbraCreazione({
      id: A.core.id.nuovo(A.core.id.MEMBRO), squadraId: 'sqd_altra',
      nome: 'Tizio', cognome: 'Estraneo', dataNascita: null, telefono: null, note: '',
      livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null, demo: false
    });
    await A.data.repo.scrivi(['membri'], (t) => { t.put('membri', estraneo); });
    let ko = false;
    try { await A.core.presenza.imposta(idGiornata, estraneo.id, 'PRESENTE'); } catch (e) { ko = true; }
    assert.ok(ko, 'presenza di socio esterno accettata');
    await A.data.repo.scrivi(['membri'], (t) => { t.elimina('membri', estraneo.id); });
  });

  // ---------------------------------------------------------------- Blocco 2: storico
  console.log('\n[Blocco 2 — storico e conteggi]');

  await prova('P9. Conteggio presenze del socio: derivato, non memorizzato', async () => {
    const A = dom.window.App;
    const ctx = await A.core.squadra.contesto();
    const dati = await A.core.presenza.perGiornata(idGiornata);
    const mid = dati.righe[0].membro.id;

    const n = await A.core.presenza.conteggioPresenze(ctx.stagioneAttiva.id, mid);
    const d = await leggiTutto(dom);
    const idGiornateStagione = {};
    d.giornate.forEach((g) => { if (g.stagioneId === ctx.stagioneAttiva.id) idGiornateStagione[g.id] = true; });
    const atteso = d.presenze.filter((p) =>
      p.membroId === mid && p.stato === 'PRESENTE' && idGiornateStagione[p.giornataId]).length;
    assert.strictEqual(n, atteso, 'conteggio non coerente con i dati');

    // nessun contatore salvato sul membro
    d.membri.forEach((m) => {
      ['presenzeTotali', 'presenze', 'numPresenze'].forEach((c) => {
        assert.ok(!(c in m), 'campo derivato salvato sul membro: ' + c);
      });
    });

    // e la scheda socio lo mostra
    await H.vaiA(dom, '#/socio/' + mid, 'Presenze');
    assert.ok(dom.window.document.body.textContent.includes('Presenze'),
      'conteggio presenze non mostrato nella scheda socio');
  });

  await prova('P10. Socio disattivato: la presenza storica resta e il nome resta visibile', async () => {
    const A = dom.window.App;
    const dati = await A.core.presenza.perGiornata(idGiornata);
    const riga = dati.righe.filter((r) => r.stato === 'PRESENTE')[0];
    const mid = riga.membro.id;
    const nome = (riga.membro.nome + ' ' + riga.membro.cognome).trim();

    await A.core.membro.impostaAttivo(mid, false);

    const d = await leggiTutto(dom);
    const p = d.presenze.filter((x) => x.giornataId === idGiornata && x.membroId === mid);
    assert.strictEqual(p.length, 1, 'presenza cancellata alla disattivazione');
    assert.strictEqual(p[0].stato, 'PRESENTE');

    const dopo = await A.core.presenza.perGiornata(idGiornata);
    const ancora = dopo.righe.filter((r) => r.membro.id === mid)[0];
    assert.ok(ancora, 'socio disattivato sparito dalla giornata in cui era segnato');
    assert.strictEqual(ancora.storico, true);

    await H.vaiA(dom, '#/giornata/' + idGiornata + '/presenze', 'Presenti');
    assert.ok(dom.window.document.body.textContent.includes(nome),
      'nome del socio disattivato non piu\' visibile');

    await A.core.membro.impostaAttivo(mid, true);
  });

  await prova('P11. Cambio stagione attiva: nessuna giornata persa o spostata', async () => {
    const A = dom.window.App;
    const prima = await leggiTutto(dom);
    const giornatePrima = JSON.stringify(prima.giornate.slice()
      .sort((a, b) => a.id.localeCompare(b.id)));
    const presenzePrima = JSON.stringify(prima.presenze.slice()
      .sort((a, b) => a.id.localeCompare(b.id)));
    const stagioneOriginale = (await A.core.squadra.contesto()).stagioneAttiva.id;

    const nuova = await A.core.stagione.creaStagione({
      nome: '2028/2029', dataInizio: '2028-09-01', dataFine: '2029-01-31',
      quotaAnnualePredefinitaCent: 30000
    });

    // la nuova stagione non ha giornate
    const el = await A.core.giornata.elenco();
    assert.strictEqual(el.righe.length, 0, 'giornate ereditate dalla nuova stagione');

    // e nulla e' stato toccato
    let d = await leggiTutto(dom);
    assert.strictEqual(JSON.stringify(d.giornate.slice()
      .sort((a, b) => a.id.localeCompare(b.id))), giornatePrima, 'giornate alterate');
    assert.strictEqual(JSON.stringify(d.presenze.slice()
      .sort((a, b) => a.id.localeCompare(b.id))), presenzePrima, 'presenze alterate');

    // tornando alla stagione precedente le giornate ricompaiono
    await A.core.stagione.attivaStagione(stagioneOriginale);
    const el2 = await A.core.giornata.elenco();
    assert.ok(el2.righe.length > 0, 'giornate non ritrovate dopo il ritorno alla stagione');
    d = await leggiTutto(dom);
    assert.strictEqual(JSON.stringify(d.giornate.slice()
      .sort((a, b) => a.id.localeCompare(b.id))), giornatePrima, 'giornate alterate dal ritorno');
    void nuova;
  });

  // ---------------------------------------------------------------- Blocco 2: validazione
  console.log('\n[Blocco 2 — validazione backup]');

  await rifiutaSenzaScrivere('V1. Giornata con squadra inesistente rifiutata',
    (b) => { b.dati.giornate[0].squadraId = 'sqd_inesistente'; }, 'squadra inesistente');

  await rifiutaSenzaScrivere('V2. Giornata con stagione inesistente rifiutata',
    (b) => { b.dati.giornate[0].stagioneId = 'stg_inesistente'; }, 'stagione inesistente');

  await rifiutaSenzaScrivere('V3. Giornata con stagione di un\'altra squadra rifiutata',
    (b) => {
      const sq2 = { id: 'sqd_due', nome: 'Due', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(sq2);
      b.dati.giornate[0].squadraId = 'sqd_due';
    }, 'un\u2019altra squadra');

  await rifiutaSenzaScrivere('V4. Capocaccia inesistente rifiutato',
    (b) => { b.dati.giornate[0].capocacciaMembroId = 'mbr_fantasma'; }, 'capocaccia inesistente');

  await rifiutaSenzaScrivere('V5. Capocaccia di un\'altra squadra rifiutato',
    (b) => {
      const sq2 = { id: 'sqd_tre', nome: 'Tre', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(sq2);
      const m2 = JSON.parse(JSON.stringify(b.dati.membri[0]));
      m2.id = 'mbr_altrove';
      m2.squadraId = 'sqd_tre';
      b.dati.membri.push(m2);
      b.dati.giornate[0].capocacciaMembroId = 'mbr_altrove';
    }, 'capocaccia di un\u2019altra squadra');

  await rifiutaSenzaScrivere('V6. Stato giornata non valido rifiutato',
    (b) => { b.dati.giornate[0].stato = 'RINVIATA'; }, 'stato non riconosciuto');

  await rifiutaSenzaScrivere('V7. Data giornata mancante rifiutata',
    (b) => { delete b.dati.giornate[0].data; }, 'data mancante');

  await rifiutaSenzaScrivere('V8. Data giornata malformata rifiutata',
    (b) => { b.dati.giornate[0].data = '20/12/2026'; }, 'data mancante');

  await rifiutaSenzaScrivere('V9. Presenza con giornata inesistente rifiutata',
    (b) => { b.dati.presenze[0].giornataId = 'gio_fantasma'; }, 'giornata inesistente');

  await rifiutaSenzaScrivere('V10. Presenza con socio inesistente rifiutata',
    (b) => { b.dati.presenze[0].membroId = 'mbr_fantasma'; }, 'socio inesistente');

  await rifiutaSenzaScrivere('V11. Presenza che collega persone di squadre diverse rifiutata',
    (b) => {
      const sq2 = { id: 'sqd_quattro', nome: 'Quattro', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(sq2);
      const m2 = JSON.parse(JSON.stringify(b.dati.membri[0]));
      m2.id = 'mbr_esterno';
      m2.squadraId = 'sqd_quattro';
      b.dati.membri.push(m2);
      b.dati.presenze[0].membroId = 'mbr_esterno';
    }, 'squadre diverse');

  await rifiutaSenzaScrivere('V12. Stato presenza non valido rifiutato',
    (b) => { b.dati.presenze[0].stato = 'FORSE'; }, 'stato non riconosciuto');

  await rifiutaSenzaScrivere('V13. Presenza salvata come NON_SEGNATO rifiutata',
    (b) => { b.dati.presenze[0].stato = 'NON_SEGNATO'; }, 'non deve essere salvato');

  await rifiutaSenzaScrivere('V14. Presenza duplicata giornata+membro rifiutata',
    (b) => {
      const copia = JSON.parse(JSON.stringify(b.dati.presenze[0]));
      copia.id = 'pre_copia';
      b.dati.presenze.push(copia);
    }, 'stessa giornata');

  await rifiutaSenzaScrivere('V15. Store giornate mancante in uno schema 2 rifiutato',
    (b) => { delete b.dati.giornate; }, 'giornate');

  await rifiutaSenzaScrivere('V16. Store presenze mancante in uno schema 2 rifiutato',
    (b) => { delete b.dati.presenze; }, 'presenze');

  await prova('V17. Export/import completo con giornate e presenze', async () => {
    const A = dom.window.App;
    const backup = await A.core.backup.costruisciBackup();
    assert.ok(backup.dati.giornate.length > 0, 'nessuna giornata da esportare');
    assert.ok(backup.dati.presenze.length > 0, 'nessuna presenza da esportare');

    await A.data.repo.scrivi(A.data.schema.nomiStore, (t) => {
      A.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    await A.core.backup.importaBackup(JSON.parse(JSON.stringify(backup)));
    const dopo = await leggiTutto(dom);
    assert.strictEqual(normalizza(dopo), normalizza(backup.dati),
      'i dati reimportati non coincidono');
  });

  // ---------------------------------------------------------------- Blocco 2: dati demo
  console.log('\n[Blocco 2 — dati demo]');

  await prova('D1. I dati demo includono giornate e presenze coerenti', async () => {
    const discoDemo = H.nuovoDisco();
    const dD = await H.avviaApp(discoDemo);
    const d = await dD.window.App.data.repo.leggiStore(['giornate', 'presenze', 'membri']);
    assert.ok(d.giornate.length >= 4 && d.giornate.length <= 5,
      'attese 4-5 giornate demo, trovate ' + d.giornate.length);
    d.giornate.forEach((g) => assert.strictEqual(g.demo, true, 'giornata demo non marcata'));
    d.presenze.forEach((p) => assert.strictEqual(p.demo, true, 'presenza demo non marcata'));

    const stati = d.giornate.map((g) => g.stato);
    assert.ok(stati.indexOf('PROGRAMMATA') !== -1, 'manca una giornata programmata');
    assert.ok(stati.indexOf('COMPLETATA') !== -1, 'manca una giornata completata');
    assert.ok(d.giornate.some((g) => g.capocacciaMembroId), 'nessuna giornata con capocaccia');
    assert.ok(d.giornate.some((g) => !g.capocacciaMembroId), 'nessuna giornata senza capocaccia');

    const oggi = dD.window.App.core.giornata.oggiIso();
    assert.ok(d.giornate.some((g) => g.data > oggi), 'nessuna giornata futura');
    assert.ok(d.giornate.some((g) => g.data < oggi), 'nessuna giornata passata');

    const statiP = d.presenze.map((p) => p.stato);
    ['PRESENTE', 'ASSENTE', 'LAVORO'].forEach((st) => {
      assert.ok(statiP.indexOf(st) !== -1, 'manca una presenza ' + st);
    });
    assert.strictEqual(statiP.indexOf('NON_SEGNATO'), -1, 'NON_SEGNATO salvato nei dati demo');
    // esiste almeno un socio senza record in una giornata: vale NON_SEGNATO
    const perGiornata = {};
    d.presenze.forEach((p) => { perGiornata[p.giornataId] = (perGiornata[p.giornataId] || 0) + 1; });
    assert.ok(d.giornate.some((g) => (perGiornata[g.id] || 0) < d.membri.length),
      'nessun caso di socio non segnato');

    // e il backup di un\'app appena installata e\' valido
    const b = await dD.window.App.core.backup.costruisciBackup();
    const err = dD.window.App.core.backup.validaBackup(b);
    assert.strictEqual(err.length, 0, 'dati demo non superano la validazione: ' + err.join(' | '));
    dD.window.close();
  });

  await prova('D2. Eliminazione dati di prova include giornate e presenze', async () => {
    const discoDemo = H.nuovoDisco();
    const dE = await H.avviaApp(discoDemo);
    const A = dE.window.App;
    const ant = await A.core.backup.anteprimaEliminazioneDemo();
    assert.ok(ant.conteggi.giornate > 0, 'giornate demo non contate');
    assert.ok(ant.conteggi.presenze > 0, 'presenze demo non contate');
    assert.strictEqual(ant.puoProcedere, true);

    const r = await A.core.backup.eliminaDatiDemo();
    assert.ok(r.eliminati.giornate > 0 && r.eliminati.presenze > 0);
    const dati = await A.data.repo.leggiStore(A.data.schema.nomiStoreDemo);
    // L'anagrafica reale resta, i dati di caccia fittizi spariscono.
    assert.strictEqual(dati.squadre.length, 1, 'squadra reale eliminata');
    assert.strictEqual(dati.stagioni.length, 1, 'stagione reale eliminata');
    assert.strictEqual(dati.membri.length, 21, 'soci reali eliminati');
    assert.strictEqual(dati.iscrizioni.length, 21, 'iscrizioni reali eliminate');
    ['giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.strictEqual(dati[n].length, 0, 'store non svuotato: ' + n);
    });
    dE.window.close();
  });

  await prova('D3. Eliminazione demo bloccata se una presenza reale usa una giornata demo',
    async () => {
    const discoMisto = H.nuovoDisco();
    const dF = await H.avviaApp(discoMisto);
    const A = dF.window.App;
    // presenza reale registrata dall'app su una giornata dimostrativa
    const g = (await A.data.giornate.tutte())
      .filter((x) => x.stato === 'PROGRAMMATA')[0];
    const isc = await A.data.iscrizioni.perStagione(g.stagioneId);
    await A.core.presenza.imposta(g.id, isc[0].membroId, 'PRESENTE');

    const prima = normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup));
    const ant = await A.core.backup.anteprimaEliminazioneDemo();
    assert.strictEqual(ant.puoProcedere, false, 'eliminazione non bloccata');
    assert.ok(ant.problemi.join(' ').toLowerCase().includes('presenza reale'),
      ant.problemi.join(' | '));

    let ko = false;
    try { await A.core.backup.eliminaDatiDemo(); } catch (e) { ko = true; }
    assert.ok(ko, 'eliminazione eseguita nonostante il blocco');
    assert.strictEqual(normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup)),
      prima, 'dati modificati nonostante il blocco');
    dF.window.close();
  });

  // ---------------------------------------------------------------- 2.1: iscrizione
  console.log('\n[2.1 — presenze solo per iscritti alla stagione]');

  // App pulita con un socio della squadra NON iscritto alla stagione demo.
  async function appConNonIscritto() {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const ctx = await A.core.squadra.contesto();
    const estraneo = A.data.repo.timbraCreazione({
      id: A.core.id.nuovo(A.core.id.MEMBRO),
      squadraId: ctx.squadra.id,
      nome: 'Nuovo', cognome: 'Arrivato', dataNascita: null, telefono: null, note: '',
      livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null, demo: false
    });
    // scritto direttamente: nessuna iscrizione alla stagione attiva
    await A.data.repo.scrivi(['membri'], (t) => { t.put('membri', estraneo); });
    const giornate = await A.data.giornate.tutte();
    return { dom: d, A, ctx, estraneo, giornata: giornate[0] };
  }

  await prova('I1. Socio attivo ma non iscritto alla stagione non compare fra le presenze', async () => {
    const c = await appConNonIscritto();
    const dati = await c.A.core.presenza.perGiornata(c.giornata.id);
    const ids = dati.righe.map((r) => r.membro.id);
    assert.strictEqual(ids.indexOf(c.estraneo.id), -1,
      'il socio non iscritto compare nella schermata presenze');
    // gli iscritti attivi invece ci sono
    const d = await c.A.data.repo.leggiStore(['iscrizioni', 'membri']);
    const attesi = d.iscrizioni
      .filter((i) => i.stagioneId === c.giornata.stagioneId)
      .map((i) => i.membroId)
      .filter((mid) => d.membri.filter((m) => m.id === mid)[0].attivo);
    attesi.forEach((mid) => assert.ok(ids.indexOf(mid) !== -1, 'manca un iscritto attivo'));

    // e non compare neppure nella schermata
    await H.vaiA(c.dom, '#/giornata/' + c.giornata.id + '/presenze', 'Presenti');
    assert.ok(!c.dom.window.document.body.textContent.includes('Nuovo Arrivato'),
      'il socio non iscritto e\' visibile nella schermata');
    c.dom.window.close();
  });

  await prova('I2. Impostare una presenza a un non iscritto viene rifiutato senza scrivere', async () => {
    const c = await appConNonIscritto();
    const prima = normalizza(await c.A.data.repo.leggiStore(c.A.data.schema.nomiStoreBackup));
    let messaggio = '';
    try {
      await c.A.core.presenza.imposta(c.giornata.id, c.estraneo.id, 'PRESENTE');
      assert.fail('presenza accettata per un socio non iscritto');
    } catch (e) { messaggio = e.message; }
    assert.ok(messaggio.toLowerCase().includes('iscritto'), 'messaggio poco chiaro: ' + messaggio);
    assert.strictEqual(normalizza(await c.A.data.repo.leggiStore(c.A.data.schema.nomiStoreBackup)),
      prima, 'il database e\' stato modificato');
    c.dom.window.close();
  });

  await prova('I3. Un socio entrato in una stagione successiva non compare nelle giornate precedenti',
    async () => {
      const disco = H.nuovoDisco();
      const d = await H.avviaApp(disco);
      const A = d.window.App;
      const vecchiaStagione = (await A.core.squadra.contesto()).stagioneAttiva.id;
      const giornateVecchie = (await A.data.giornate.tutte())
        .filter((g) => g.stagioneId === vecchiaStagione);
      assert.ok(giornateVecchie.length > 0);

      // nuova stagione: diventa attiva
      await A.core.stagione.creaStagione({
        nome: '2027/2028', dataInizio: '2027-09-01', dataFine: '2028-01-31',
        quotaAnnualePredefinitaCent: 30000
      });
      // socio creato ORA: iscritto solo alla nuova stagione
      const r = await A.core.membro.creaSocio({
        nome: 'Ultimo', cognome: 'Entrato', dataNascita: null, telefono: null, note: '',
        livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null,
        ruoliVenatori: ['CACCIATORE'], ospite: false,
        quotaAnnualePrevistaCent: 30000, quotaVersataCent: 0
      });
      const idNuovo = r.membro.id;

      // non compare nelle giornate della stagione precedente
      const vecchia = await A.core.presenza.perGiornata(giornateVecchie[0].id);
      assert.strictEqual(vecchia.righe.map((x) => x.membro.id).indexOf(idNuovo), -1,
        'il nuovo socio compare in una giornata della stagione precedente');

      // ma compare in una giornata della stagione nuova
      const gNuova = await A.core.giornata.crea({
        data: '2027-11-15', orarioRitrovo: '06:30', zona: 'Zona nuova',
        capocacciaMembroId: null, note: '', stato: 'PROGRAMMATA'
      });
      const nuova = await A.core.presenza.perGiornata(gNuova.id);
      assert.ok(nuova.righe.map((x) => x.membro.id).indexOf(idNuovo) !== -1,
        'il nuovo socio non compare nella giornata della sua stagione');
      d.window.close();
    });

  await prova('I4. Il socio disattivato con presenza storica resta visibile', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const giornate = await A.data.giornate.tutte();
    const presenze = await A.data.presenze.tutte();
    const p = presenze.filter((x) => x.stato === 'PRESENTE')[0];
    const g = giornate.filter((x) => x.id === p.giornataId)[0];
    const membro = await A.data.membri.perId(p.membroId);

    await A.core.membro.impostaAttivo(membro.id, false);

    const dati = await A.core.presenza.perGiornata(g.id);
    const riga = dati.righe.filter((r) => r.membro.id === membro.id)[0];
    assert.ok(riga, 'presenza storica sparita dopo la disattivazione');
    assert.strictEqual(riga.storico, true);
    assert.strictEqual(riga.stato, 'PRESENTE');

    await H.vaiA(d, '#/giornata/' + g.id + '/presenze', 'Presenti');
    assert.ok(d.window.document.body.textContent.includes(
      (membro.nome + ' ' + membro.cognome).trim()), 'nome non piu\' visibile');
    d.window.close();
  });

  await rifiutaSenzaScrivere('I5. Backup con presenza di socio non iscritto alla stagione rifiutato',
    (b) => {
      // socio della squadra giusta ma senza iscrizione alla stagione della giornata
      const m2 = JSON.parse(JSON.stringify(b.dati.membri[0]));
      m2.id = 'mbr_non_iscritto';
      b.dati.membri.push(m2);
      b.dati.presenze[0].membroId = 'mbr_non_iscritto';
    }, 'non \u00e8 iscritto alla stagione');

  // ---------------------------------------------------------------- 2.1: concorrenza
  console.log('\n[2.1 — scritture concorrenti sulla stessa presenza]');

  await prova('R1. Due tocchi ravvicinati non producono due scritture concorrenti', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const giornate = await A.data.giornate.tutte();
    const g = giornate.filter((x) => x.stato === 'PROGRAMMATA')[0];

    // strumenta il service per misurare la concorrenza reale
    const reale = A.core.presenza.imposta;
    let inCorso = 0, massimo = 0;
    const chiamate = [];
    let sblocca = null;
    const attesaFinta = new Promise((res) => { sblocca = res; });
    A.core.presenza.imposta = function (gid, mid, stato) {
      chiamate.push({ gid, mid, stato });
      inCorso++;
      massimo = Math.max(massimo, inCorso);
      return attesaFinta
        .then(() => reale.call(A.core.presenza, gid, mid, stato))
        .then((r) => { inCorso--; return r; })
        .catch((e) => { inCorso--; throw e; });
    };

    await H.vaiA(d, '#/giornata/' + g.id + '/presenze', 'Presenti');
    const cards = H.$$(d, '.card-presenza');
    assert.ok(cards.length >= 2, 'servono almeno due soci');

    // primo tocco: la card si occupa
    H.clic(d, cards[0].querySelector('.scelta.presente'));
    await H.pausa(d, 20);
    assert.strictEqual(cards[0].getAttribute('aria-busy'), 'true', 'aria-busy non impostato');
    Array.prototype.forEach.call(cards[0].querySelectorAll('.scelta'), (b) => {
      assert.strictEqual(b.disabled, true, 'pulsante della card non bloccato');
    });
    // le altre card restano usabili: si blocca solo la card interessata
    Array.prototype.forEach.call(cards[1].querySelectorAll('.scelta'), (b) => {
      assert.strictEqual(b.disabled, false, 'bloccata anche una card estranea');
    });

    // secondo tocco sulla stessa card mentre il primo e' in volo: ignorato
    H.clic(d, cards[0].querySelector('.scelta.assente'));
    await H.pausa(d, 20);
    assert.strictEqual(chiamate.length, 1, 'partite due scritture sulla stessa presenza');

    sblocca();
    await H.attesa(d, () => cards[0].getAttribute('aria-busy') === 'false', 'card liberata');
    Array.prototype.forEach.call(cards[0].querySelectorAll('.scelta'), (b) => {
      assert.strictEqual(b.disabled, false, 'pulsanti non riabilitati');
    });
    assert.strictEqual(massimo, 1, 'due scritture contemporanee sulla stessa coppia');

    const p = (await A.data.presenze.tutte()).filter((x) => x.giornataId === g.id &&
      x.membroId === chiamate[0].mid);
    assert.strictEqual(p.length, 1, 'record duplicato');
    assert.strictEqual(p[0].stato, 'PRESENTE', 'stato finale incoerente col tocco eseguito');

    A.core.presenza.imposta = reale;
    d.window.close();
  });

  await prova('R2. In caso di errore lo stato torna indietro e i pulsanti si riabilitano', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const g = (await A.data.giornate.tutte()).filter((x) => x.stato === 'PROGRAMMATA')[0];

    await H.vaiA(d, '#/giornata/' + g.id + '/presenze', 'Presenti');
    A.core.presenza.imposta = function () {
      return Promise.reject(new Error('Errore simulato.'));
    };
    const card = H.$$(d, '.card-presenza')[0];
    const primaAttiva = card.querySelector('.scelta.attiva');
    const codicePrima = primaAttiva ? primaAttiva.getAttribute('data-stato') : null;

    H.clic(d, card.querySelector('.scelta.presente'));
    await H.attesa(d, () => card.getAttribute('aria-busy') === 'false', 'card liberata');
    Array.prototype.forEach.call(card.querySelectorAll('.scelta'), (b) => {
      assert.strictEqual(b.disabled, false, 'pulsanti rimasti bloccati dopo l\'errore');
    });
    const dopo = card.querySelector('.scelta.attiva');
    assert.strictEqual(dopo ? dopo.getAttribute('data-stato') : null, codicePrima,
      'stato non ripristinato dopo l\'errore');
    d.window.close();
  });

  // ---------------------------------------------------------------- 2.1: schemaVersion
  console.log('\n[2.1 — coerenza meta.schemaVersion]');

  await prova('S4. Import di un backup schema 1 aggiorna meta.schemaVersion a 4', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;

    const b2 = await A.core.backup.costruisciBackup();
    const b1 = JSON.parse(JSON.stringify(b2));
    b1.schemaVersion = 1;
    delete b1.dati.giornate;
    delete b1.dati.presenze;
    delete b1.dati.abbattimenti;
    delete b1.dati.controlliSanitari;
    b1.dati.meta.forEach((m) => { if (m.chiave === 'schemaVersion') m.valore = 1; });

    await A.core.backup.importaBackup(b1);
    const meta = (await A.data.repo.leggiStore(['meta'])).meta;
    const voci = meta.filter((m) => m.chiave === 'schemaVersion');
    assert.strictEqual(voci.length, 1, 'chiave schemaVersion duplicata');
    assert.strictEqual(voci[0].valore, 4, 'meta.schemaVersion non migrato');
    assert.strictEqual(voci[0].valore, A.versione.SCHEMA_VERSION,
      'meta.schemaVersion non coincide con quella dell\'app');

    // e la riesportazione resta coerente
    const riesportato = await A.core.backup.costruisciBackup();
    assert.strictEqual(riesportato.schemaVersion, 4);
    const metaEsportata = riesportato.dati.meta.filter((m) => m.chiave === 'schemaVersion');
    assert.strictEqual(metaEsportata.length, 1);
    assert.strictEqual(metaEsportata[0].valore, 4, 'riesportazione incoerente');
    d.window.close();
  });

  await prova('S5. Un backup schema 1 senza voce meta.schemaVersion la riceve corretta', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const b = await A.core.backup.costruisciBackup();
    const b1 = JSON.parse(JSON.stringify(b));
    b1.schemaVersion = 1;
    delete b1.dati.giornate;
    delete b1.dati.presenze;
    delete b1.dati.abbattimenti;
    delete b1.dati.controlliSanitari;
    b1.dati.meta = b1.dati.meta.filter((m) => m.chiave !== 'schemaVersion');

    await A.core.backup.importaBackup(b1);
    const meta = (await A.data.repo.leggiStore(['meta'])).meta;
    const voci = meta.filter((m) => m.chiave === 'schemaVersion');
    assert.strictEqual(voci.length, 1, 'voce non inserita o duplicata');
    assert.strictEqual(voci[0].valore, 4);
    d.window.close();
  });

  // ---------------------------------------------------------------- 2.1: date
  console.log('\n[2.1 — data locale e validazione calendariale]');

  await prova('T1. oggiIso() usa il fuso locale, non UTC', async () => {
    const A = dom.window.App;
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(H.RADICE, 'calendario.js'), 'utf8');
    assert.ok(src.includes('getFullYear()') && src.includes('getMonth()') && src.includes('getDate()'),
      'la data non e\' costruita dai getter locali');

    // nessun uso di toISOString per la data corrente nel codice dell\'app
    const cp = require('child_process');
    const elenco = cp.execSync('find . -maxdepth 1 -name "*.js" -not -name "esegui.js" -not -name "harness.js"',
      { cwd: H.RADICE }).toString().trim().split('\n');
    elenco.forEach((f) => {
      const testo = fs.readFileSync(require('path').join(H.RADICE, f), 'utf8');
      assert.strictEqual(testo.indexOf('toISOString().slice(0, 10)'), -1,
        'data locale ricavata da toISOString in ' + f);
    });

    // una data costruita localmente coincide con i getter locali
    const d = new Date(2026, 0, 15, 23, 30);
    assert.strictEqual(A.core.calendario.oggi(d), '2026-01-15');
    const oggi = A.core.calendario.oggi();
    const adesso = new Date();
    assert.strictEqual(oggi, adesso.getFullYear() + '-' +
      String(adesso.getMonth() + 1).padStart(2, '0') + '-' +
      String(adesso.getDate()).padStart(2, '0'));
  });

  await prova('T2. Date calendariamente impossibili rifiutate', async () => {
    const cal = dom.window.App.core.calendario;
    ['2026-02-31', '2026-13-10', '2026-00-10', '2026-04-31', '2025-02-29',
     '2026-01-00', '2026-1-5', '20260105', '', null, undefined, 12345]
      .forEach((v) => assert.strictEqual(cal.dataValida(v), false, 'accettata: ' + v));
    ['2026-02-28', '2024-02-29', '2026-12-31', '2026-01-01']
      .forEach((v) => assert.strictEqual(cal.dataValida(v), true, 'rifiutata: ' + v));
  });

  await prova('T3. Il form giornata rifiuta una data impossibile', async () => {
    const G = dom.window.App.core.giornata;
    assert.ok(G.valida({ data: '2026-02-31', stato: 'PROGRAMMATA' }).data, '31 febbraio accettato');
    assert.ok(G.valida({ data: '2026-13-10', stato: 'PROGRAMMATA' }).data, 'mese 13 accettato');
    assert.ok(!G.valida({ data: '2026-02-28', stato: 'PROGRAMMATA' }).data, 'data valida rifiutata');

    let ko = false;
    try {
      await G.crea({ data: '2026-02-31', orarioRitrovo: '06:30', zona: 'X',
        capocacciaMembroId: null, note: '', stato: 'PROGRAMMATA' });
    } catch (e) { ko = true; }
    assert.ok(ko, 'giornata creata con data impossibile');
  });

  await rifiutaSenzaScrivere('T4. Backup con data giornata impossibile rifiutato',
    (b) => { b.dati.giornate[0].data = '2026-02-31'; }, 'data mancante o non valida');

  // ---------------------------------------------------------------- 2.1: CSS
  console.log('\n[2.1 — CSS delle nuove schermate]');

  await prova('C5. input[type="time"] trattato come gli altri campi', async () => {
    const fs = require('fs');
    const css = fs.readFileSync(require('path').join(H.RADICE, 'components.css'), 'utf8');
    const blocco = css.slice(css.indexOf('.campo input[type="text"]'));
    const regola = blocco.slice(0, blocco.indexOf('}'));
    assert.ok(regola.includes('input[type="time"]'),
      'input time non incluso nella regola base dei campi');
    assert.ok(regola.includes('width: 100%'), 'manca width 100%');
    assert.ok(regola.includes('min-height: var(--tocco)'), 'manca min-height 48px');
    assert.ok(regola.includes('border-radius'), 'manca border-radius');
  });

  await prova('C6. Barra contatori non piu\' sticky, stati presenza 2x2 fino a 430px', async () => {
    const fs = require('fs');
    const css = fs.readFileSync(require('path').join(H.RADICE, 'components.css'), 'utf8');
    const barra = css.slice(css.indexOf('.barra-contatori {'));
    assert.strictEqual(barra.slice(0, barra.indexOf('}')).indexOf('position: sticky'), -1,
      'la barra contatori e\' ancora sticky');

    const scelte = css.slice(css.indexOf('.card-presenza .scelte {'));
    assert.ok(scelte.slice(0, scelte.indexOf('}')).includes('repeat(2, 1fr)'),
      'gli stati presenza non sono su due colonne di default');
    assert.ok(css.includes('@media (min-width: 431px)'),
      'manca il passaggio a quattro colonne sopra i 430px');
    assert.ok(css.includes('.scelta:disabled'), 'manca lo stile dei pulsanti bloccati');
  });

  // ---------------------------------------------------------------- 2.1: stagione nel form
  console.log('\n[2.1 — stagione nel form di modifica giornata]');

  await prova('F1. Il form di modifica mostra la stagione della giornata, non quella attiva',
    async () => {
      const disco = H.nuovoDisco();
      const d = await H.avviaApp(disco);
      const A = d.window.App;
      const stagioneVecchia = (await A.core.squadra.contesto()).stagioneAttiva;
      const g = (await A.data.giornate.tutte())
        .filter((x) => x.stagioneId === stagioneVecchia.id)[0];

      await A.core.stagione.creaStagione({
        nome: '2029/2030', dataInizio: '2029-09-01', dataFine: '2030-01-31',
        quotaAnnualePredefinitaCent: 30000
      });
      const attiva = (await A.core.squadra.contesto()).stagioneAttiva;
      assert.strictEqual(attiva.nome, '2029/2030', 'la nuova stagione non e\' attiva');

      await H.vaiA(d, '#/giornata/' + g.id + '/modifica', 'Modifica giornata');
      const testata = d.window.document.getElementById('intestazione').textContent;
      assert.ok(testata.includes(stagioneVecchia.nome),
        'il form non mostra la stagione della giornata: ' + testata);
      assert.ok(!testata.includes('2029/2030'),
        'il form mostra la stagione attiva invece di quella della giornata: ' + testata);

      // e salvando non cambia stagione
      H.scrivi(d, '#g-zona', 'Zona rinominata');
      H.clic(d, '#btn-salva-giornata');
      await H.attesa(d, () =>
        d.window.document.body.textContent.includes('Zona rinominata'), 'salvataggio');
      const dopo = await A.data.giornate.perId(g.id);
      assert.strictEqual(dopo.stagioneId, stagioneVecchia.id,
        'la giornata e\' stata spostata di stagione');
      d.window.close();
    });

  // ---------------------------------------------------------------- Blocco 3: schema
  console.log('\n[Blocco 3 — schema e migrazioni]');

  await prova('A1. Upgrade v2 -> v4: solo i nuovi store, nessun dato perso', async () => {
    // database in formato Blocco 2 (versione 2, senza abbattimenti)
    const discoV2 = H.nuovoDisco();
    await new Promise((resolve, reject) => {
      const req = discoV2.open('adrenalinaDB', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('meta', { keyPath: 'chiave' });
        db.createObjectStore('squadre', { keyPath: 'id' });
        const st = db.createObjectStore('stagioni', { keyPath: 'id' });
        st.createIndex('by_squadra', 'squadraId');
        st.createIndex('by_stato', 'stato');
        const mb = db.createObjectStore('membri', { keyPath: 'id' });
        mb.createIndex('by_squadra', 'squadraId');
        mb.createIndex('by_cognome', 'cognome');
        const isc = db.createObjectStore('iscrizioni', { keyPath: 'id' });
        isc.createIndex('by_stagione', 'stagioneId');
        isc.createIndex('by_membro', 'membroId');
        isc.createIndex('by_stagione_membro', ['stagioneId', 'membroId'], { unique: true });
        const gio = db.createObjectStore('giornate', { keyPath: 'id' });
        gio.createIndex('by_stagione', 'stagioneId');
        gio.createIndex('by_squadra', 'squadraId');
        gio.createIndex('by_data', 'data');
        const pre = db.createObjectStore('presenze', { keyPath: 'id' });
        pre.createIndex('by_giornata', 'giornataId');
        pre.createIndex('by_membro', 'membroId');
        pre.createIndex('by_giornata_membro', ['giornataId', 'membroId'], { unique: true });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction(['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni',
          'giornate', 'presenze'], 'readwrite');
        t.objectStore('meta').put({ chiave: 'schemaVersion', valore: 2 });
        t.objectStore('meta').put({ chiave: 'squadraCorrenteId', valore: 'sqd_v2' });
        t.objectStore('squadre').put({ id: 'sqd_v2', nome: 'Adrenalina',
          stagioneAttivaId: 'stg_v2', demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('stagioni').put({ id: 'stg_v2', squadraId: 'sqd_v2', nome: '2026/2027',
          dataInizio: '2026-09-01', dataFine: '2027-01-31', stato: 'attiva',
          quotaAnnualePredefinitaCent: 24000, demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('membri').put({ id: 'mbr_v2', squadraId: 'sqd_v2', nome: 'Vecchio',
          cognome: 'Socio', dataNascita: null, telefono: null, note: '',
          livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null,
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('iscrizioni').put({ id: 'isc_v2', stagioneId: 'stg_v2', membroId: 'mbr_v2',
          ruoliVenatori: ['POSTAIOLO'], ospite: false, quotaAnnualePrevistaCent: 24000,
          quotaVersataCent: 0, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('giornate').put({ id: 'gio_v2', squadraId: 'sqd_v2', stagioneId: 'stg_v2',
          data: '2026-11-08', orarioRitrovo: '06:30', zona: 'Vecchia Zona',
          capocacciaMembroId: null, note: '', stato: 'COMPLETATA',
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('presenze').put({ id: 'pre_v2', giornataId: 'gio_v2', membroId: 'mbr_v2',
          stato: 'PRESENTE', note: '', demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.oncomplete = () => { db.close(); resolve(true); };
        t.onerror = () => reject(t.error);
      };
    });

    const dV = await H.avviaApp(discoV2);
    const idb = await dV.window.App.data.db.apri();
    assert.strictEqual(idb.version, 4, 'database non aggiornato a v4');
    assert.ok(idb.objectStoreNames.contains('abbattimenti'), 'store abbattimenti non creato');
    assert.ok(idb.objectStoreNames.contains('controlliSanitari'), 'store controlli non creato');
    const store = idb.transaction(['abbattimenti'], 'readonly').objectStore('abbattimenti');
    assert.ok(store.indexNames.contains('by_stagione_codice'), 'indice codice mancante');

    const d = await dV.window.App.data.repo.leggiStore(dV.window.App.data.schema.nomiStore);
    assert.strictEqual(d.squadre.length, 1, 'squadra persa');
    assert.strictEqual(d.giornate.length, 1, 'giornata persa');
    assert.strictEqual(d.giornate[0].zona, 'Vecchia Zona', 'giornata riscritta');
    assert.strictEqual(d.presenze.length, 1, 'presenza persa');
    assert.strictEqual(d.presenze[0].stato, 'PRESENTE');
    assert.strictEqual(d.iscrizioni.length, 1, 'iscrizione persa');
    assert.strictEqual(d.abbattimenti.length, 0);
    assert.strictEqual(d.controlliSanitari.length, 0);
    const meta = {};
    d.meta.forEach((m) => { meta[m.chiave] = m.valore; });
    assert.strictEqual(meta.schemaVersion, 4, 'meta.schemaVersion non aggiornato a 4');
    assert.strictEqual(d.meta.filter((m) => m.chiave === 'schemaVersion').length, 1,
      'chiave schemaVersion duplicata');
    dV.window.close();
  });

  await prova('A2. Import di un backup schema 2 migrato fino a schema 4', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;

    const b4 = await A.core.backup.costruisciBackup();
    const b2 = JSON.parse(JSON.stringify(b4));
    b2.schemaVersion = 2;
    delete b2.dati.abbattimenti;
    delete b2.dati.controlliSanitari;
    b2.dati.meta.forEach((m) => { if (m.chiave === 'schemaVersion') m.valore = 2; });

    assert.strictEqual(A.core.backup.validaBackup(b2).length, 0,
      'backup schema 2 rifiutato: ' + A.core.backup.validaBackup(b2).join(' | '));
    await A.core.backup.importaBackup(b2);

    const dati = await A.data.repo.leggiStore(
      ['abbattimenti', 'controlliSanitari', 'giornate', 'meta']);
    assert.strictEqual(dati.abbattimenti.length, 0, 'abbattimenti non inizializzati');
    assert.strictEqual(dati.controlliSanitari.length, 0, 'controlli non inizializzati');
    assert.ok(dati.giornate.length > 0, 'giornate perse nella migrazione');
    const voci = dati.meta.filter((m) => m.chiave === 'schemaVersion');
    assert.strictEqual(voci.length, 1);
    assert.strictEqual(voci[0].valore, 4, 'meta.schemaVersion non portata a 4');
    assert.strictEqual(voci[0].valore, A.versione.SCHEMA_VERSION);
    d.window.close();
  });

  // ---------------------------------------------------------------- Blocco 3: peso
  console.log('\n[Blocco 3 — peso e codice capo]');

  await prova('A3. Parsing del peso: 45 / 45,5 / 45.5 e formato italiano', async () => {
    const K = dom.window.App.core.capo;
    assert.strictEqual(K.parseKgInGrammi('45'), 45000);
    assert.strictEqual(K.parseKgInGrammi('45,5'), 45500);
    assert.strictEqual(K.parseKgInGrammi('45.5'), 45500);
    assert.strictEqual(K.parseKgInGrammi('85,5'), 85500);
    assert.strictEqual(K.parseKgInGrammi('110,2'), 110200);
    assert.strictEqual(K.parseKgInGrammi('1.234,5'), 1234500);
    assert.strictEqual(K.parseKgInGrammi(' 45 kg '), 45000);
    assert.strictEqual(K.parseKgInGrammi('abc'), null);
    assert.strictEqual(K.parseKgInGrammi(''), null);
    assert.strictEqual(K.formattaKg(85500), '85,5 kg');
    assert.strictEqual(K.formattaKg(45000), '45,0 kg');
    // il valore memorizzato resta un intero in grammi
    assert.ok(Number.isInteger(K.parseKgInGrammi('45,55')));
  });

  await prova('A4. Peso <= 0, non numerico o oltre soglia tecnica rifiutato', async () => {
    const K = dom.window.App.core.capo;
    const base = { giornataId: 'x', tiratoreMembroId: 'y', sesso: 'MASCHIO',
      classeEta: 'ADULTO' };
    assert.ok(K.valida(Object.assign({}, base, { pesoGrammi: 0 })).pesoGrammi, 'peso 0 accettato');
    assert.ok(K.valida(Object.assign({}, base, { pesoGrammi: -1 })).pesoGrammi, 'peso negativo accettato');
    assert.ok(K.valida(Object.assign({}, base, { pesoGrammi: null })).pesoGrammi, 'peso nullo accettato');
    assert.ok(K.valida(Object.assign({}, base, { pesoGrammi: 500001 })).pesoGrammi,
      'peso oltre soglia accettato');
    assert.ok(!K.valida(Object.assign({}, base, { pesoGrammi: 500000 })).pesoGrammi,
      'soglia esatta rifiutata');
    assert.ok(!K.valida(Object.assign({}, base, { pesoGrammi: 85500 })).pesoGrammi,
      'peso valido rifiutato');
    assert.strictEqual(dom.window.App.costanti.PESO_MASSIMO_GRAMMI, 500000);
  });

  // ---------------------------------------------------------------- Blocco 3: registro
  console.log('\n[Blocco 3 — registro capi]');

  // App pulita, senza abbattimenti demo, per testare la numerazione da zero.
  async function appSenzaCapi() {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    await A.data.repo.scrivi(['abbattimenti'], (t) => { t.svuota('abbattimenti'); });
    const ctx = await A.core.squadra.contesto();
    const giornate = (await A.data.giornate.tutte())
      .filter((g) => g.stagioneId === ctx.stagioneAttiva.id);
    const iscrizioni = await A.data.iscrizioni.perStagione(ctx.stagioneAttiva.id);
    return { dom: d, A, ctx, giornate, iscrizioni };
  }

  await prova('A5. Creazione capo: codice CG-001, poi CG-002', async () => {
    const c = await appSenzaCapi();
    const g = c.giornate[0];
    const tir = c.iscrizioni[0].membroId;

    const primo = await c.A.core.capo.crea({
      giornataId: g.id, tiratoreMembroId: tir, sesso: 'MASCHIO',
      pesoGrammi: c.A.core.capo.parseKgInGrammi('85,5'), classeEta: 'ADULTO',
      caneMuta: 'Muta Diana', note: 'Primo capo.'
    });
    assert.strictEqual(primo.codiceCapo, 'CG-001');
    assert.ok(/^abb_/.test(primo.id), 'id tecnico non opaco: ' + primo.id);
    assert.notStrictEqual(primo.id, primo.codiceCapo, 'il codice e\' usato come chiave');
    assert.strictEqual(primo.pesoGrammi, 85500);
    assert.strictEqual(primo.annullato, false, 'annullato non inizializzato a false');
    assert.strictEqual(primo.demo, false);
    // squadra e stagione derivano dalla giornata
    assert.strictEqual(primo.squadraId, g.squadraId);
    assert.strictEqual(primo.stagioneId, g.stagioneId);
    // la zona NON viene duplicata dentro il capo
    assert.ok(!('zona' in primo), 'la zona e\' stata duplicata nell\'abbattimento');

    const secondo = await c.A.core.capo.crea({
      giornataId: g.id, tiratoreMembroId: tir, sesso: 'FEMMINA',
      pesoGrammi: 62000, classeEta: 'SUBADULTO', caneMuta: null, note: ''
    });
    assert.strictEqual(secondo.codiceCapo, 'CG-002');
    c.dom.window.close();
  });

  await prova('A6. Codice univoco nella stagione e numeri non riutilizzati', async () => {
    const c = await appSenzaCapi();
    const g = c.giornate[0];
    const tir = c.iscrizioni[0].membroId;
    const campi = { giornataId: g.id, tiratoreMembroId: tir, sesso: 'MASCHIO',
      pesoGrammi: 50000, classeEta: 'ADULTO', caneMuta: null, note: '' };

    const a1 = await c.A.core.capo.crea(campi);
    const a2 = await c.A.core.capo.crea(campi);
    const a3 = await c.A.core.capo.crea(campi);
    assert.strictEqual(a3.codiceCapo, 'CG-003');

    // annullare non libera il numero
    await c.A.core.capo.impostaAnnullato(a2.id, true);
    const a4 = await c.A.core.capo.crea(campi);
    assert.strictEqual(a4.codiceCapo, 'CG-004', 'numero riutilizzato dopo un annullamento');

    // nemmeno rimuovendo il record il numero torna disponibile per errore:
    // il progressivo parte dal massimo presente
    const codici = (await c.A.data.abbattimenti.tutti()).map((x) => x.codiceCapo);
    assert.strictEqual(new Set(codici).size, codici.length, 'codici duplicati nella stagione');

    // l'indice unico blocca un doppione scritto direttamente
    const copia = JSON.parse(JSON.stringify(a1));
    copia.id = 'abb_doppione';
    let ko = false;
    try {
      await c.A.data.repo.scrivi(['abbattimenti'], (t) => { t.put('abbattimenti', copia); });
    } catch (e) { ko = true; }
    assert.ok(ko, 'l\'indice unico non ha impedito il codice duplicato');
    c.dom.window.close();
  });

  await prova('A6b. Il progressivo parte dal codice piu\' alto, non dal conteggio', async () => {
    const K = dom.window.App.core.capo;
    // scenario con un buco: CG-001 e CG-005 presenti, tre numeri "liberi"
    const capi = [
      { stagioneId: 'stgA', codiceCapo: 'CG-001' },
      { stagioneId: 'stgA', codiceCapo: 'CG-005' },
      { stagioneId: 'stgB', codiceCapo: 'CG-009' }
    ];
    assert.strictEqual(K.prossimoCodice(capi, 'stgA'), 'CG-006',
      'numero riutilizzato: il progressivo segue il conteggio invece del massimo');
    assert.strictEqual(K.prossimoCodice(capi, 'stgB'), 'CG-010');
    assert.strictEqual(K.prossimoCodice(capi, 'stgVuota'), 'CG-001');
    assert.strictEqual(K.prossimoCodice([], 'stgA'), 'CG-001');
    // oltre CG-999 la numerazione continua senza troncare
    assert.strictEqual(K.prossimoCodice([{ stagioneId: 's', codiceCapo: 'CG-999' }], 's'),
      'CG-1000');
    assert.strictEqual(K.formattaCodice(7), 'CG-007');
    assert.strictEqual(K.numeroDaCodice('CG-042'), 42);
  });

  await prova('A7. Il codice riparte da CG-001 in una stagione diversa', async () => {
    const c = await appSenzaCapi();
    const g = c.giornate[0];
    const tir = c.iscrizioni[0].membroId;
    await c.A.core.capo.crea({ giornataId: g.id, tiratoreMembroId: tir, sesso: 'MASCHIO',
      pesoGrammi: 50000, classeEta: 'ADULTO', caneMuta: null, note: '' });

    await c.A.core.stagione.creaStagione({
      nome: '2030/2031', dataInizio: '2030-09-01', dataFine: '2031-01-31',
      quotaAnnualePredefinitaCent: 30000
    });
    const nuovaG = await c.A.core.giornata.crea({
      data: '2030-11-10', orarioRitrovo: '06:30', zona: 'Zona nuova',
      capocacciaMembroId: null, note: '', stato: 'COMPLETATA'
    });
    const ctx = await c.A.core.squadra.contesto();
    const isc = await c.A.data.iscrizioni.perStagione(ctx.stagioneAttiva.id);
    const capo = await c.A.core.capo.crea({
      giornataId: nuovaG.id, tiratoreMembroId: isc[0].membroId, sesso: 'FEMMINA',
      pesoGrammi: 40000, classeEta: 'SUBADULTO', caneMuta: null, note: ''
    });
    assert.strictEqual(capo.codiceCapo, 'CG-001',
      'la numerazione non riparte nella nuova stagione');
    c.dom.window.close();
  });

  // ---------------------------------------------------------------- Blocco 3: tiratore
  console.log('\n[Blocco 3 — tiratore]');

  await prova('A8. Tiratore non iscritto alla stagione: BLOCCATO', async () => {
    const c = await appSenzaCapi();
    const A = c.A;
    const estraneo = A.data.repo.timbraCreazione({
      id: A.core.id.nuovo(A.core.id.MEMBRO), squadraId: c.ctx.squadra.id,
      nome: 'Non', cognome: 'Iscritto', dataNascita: null, telefono: null, note: '',
      livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null, demo: false
    });
    await A.data.repo.scrivi(['membri'], (t) => { t.put('membri', estraneo); });

    const prima = normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup));
    let messaggio = '';
    try {
      await A.core.capo.crea({ giornataId: c.giornate[0].id, tiratoreMembroId: estraneo.id,
        sesso: 'MASCHIO', pesoGrammi: 50000, classeEta: 'ADULTO', caneMuta: null, note: '' });
      assert.fail('capo accettato con tiratore non iscritto');
    } catch (e) { messaggio = e.message; }
    assert.ok(messaggio.toLowerCase().includes('iscritto'), 'messaggio poco chiaro: ' + messaggio);
    assert.strictEqual(normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup)),
      prima, 'database modificato da una creazione rifiutata');

    // e non compare fra i candidati del form
    const candidati = await A.core.capo.candidatiTiratore(c.giornate[0], null);
    assert.strictEqual(candidati.map((m) => m.id).indexOf(estraneo.id), -1,
      'il non iscritto compare fra i tiratori selezionabili');
    c.dom.window.close();
  });

  await prova('A9. Tiratore ASSENTE o in LAVORO: solo avviso, nessun blocco', async () => {
    const c = await appSenzaCapi();
    const A = c.A;
    const g = c.giornate[0];
    const mid = c.iscrizioni[0].membroId;

    // ASSENTE
    await A.core.presenza.imposta(g.id, mid, 'ASSENTE');
    let avviso = await A.core.capo.avvisoTiratore(g.id, mid);
    assert.ok(avviso && avviso.toUpperCase().includes('ASSENTE'), 'avviso ASSENTE mancante');
    const capo1 = await A.core.capo.crea({ giornataId: g.id, tiratoreMembroId: mid,
      sesso: 'MASCHIO', pesoGrammi: 50000, classeEta: 'ADULTO', caneMuta: null, note: '' });
    assert.ok(capo1.id, 'il salvataggio e\' stato bloccato da un semplice avviso');

    // LAVORO
    await A.core.presenza.imposta(g.id, mid, 'LAVORO');
    avviso = await A.core.capo.avvisoTiratore(g.id, mid);
    assert.ok(avviso && avviso.toUpperCase().includes('LAVORO'), 'avviso LAVORO mancante');
    const capo2 = await A.core.capo.crea({ giornataId: g.id, tiratoreMembroId: mid,
      sesso: 'FEMMINA', pesoGrammi: 40000, classeEta: 'ADULTO', caneMuta: null, note: '' });
    assert.ok(capo2.id, 'il salvataggio e\' stato bloccato dall\'avviso LAVORO');

    // PRESENTE o non segnato: nessun avviso
    await A.core.presenza.imposta(g.id, mid, 'PRESENTE');
    assert.strictEqual(await A.core.capo.avvisoTiratore(g.id, mid), null,
      'avviso mostrato per un socio presente');
    await A.core.presenza.imposta(g.id, mid, 'NON_SEGNATO');
    assert.strictEqual(await A.core.capo.avvisoTiratore(g.id, mid), null,
      'avviso mostrato per un socio non segnato');
    c.dom.window.close();
  });

  // ---------------------------------------------------------------- Blocco 3: UI
  console.log('\n[Blocco 3 — schermate]');
  let idCapoUI = null;

  await prova('A10. Registro e form: creazione dal telefono', async () => {
    await H.vaiA(dom, '#/abbattimenti', 'Nuovo abbattimento');
    H.clic(dom, '[data-vai="#/capo/nuovo"]');
    await H.attesa(dom, () => H.$(dom, '#a-peso'), 'form nuovo capo');

    // il codice e' mostrato prima del salvataggio
    const codiceMostrato = H.$(dom, '.codice-capo-grande .valore').textContent.trim();
    assert.ok(/^CG-\d{3}$/.test(codiceMostrato), 'codice non mostrato: ' + codiceMostrato);

    const opzioni = H.$$(dom, '#a-tiratore option').filter((o) => o.value);
    assert.ok(opzioni.length > 0, 'nessun tiratore selezionabile');
    H.scrivi(dom, '#a-tiratore', opzioni[0].value);
    H.scrivi(dom, '#a-sesso', 'MASCHIO');
    H.scrivi(dom, '#a-classe', 'ADULTO');
    H.scrivi(dom, '#a-peso', '92,4');
    H.scrivi(dom, '#a-cane', 'Cane Thor');
    H.scrivi(dom, '#a-note', 'Registrato dal test.');
    H.clic(dom, '#btn-salva-capo');

    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('92,4 kg'), 'scheda del capo');
    const capi = await dom.window.App.data.abbattimenti.tutti();
    const capo = capi.filter((a) => a.note === 'Registrato dal test.')[0];
    assert.ok(capo, 'capo non salvato');
    idCapoUI = capo.id;
    assert.strictEqual(capo.pesoGrammi, 92400);
    assert.strictEqual(capo.caneMuta, 'Cane Thor');
    assert.strictEqual(capo.codiceCapo, codiceMostrato,
      'codice salvato diverso da quello mostrato');
  });

  await prova('A11. Modifica capo', async () => {
    await H.vaiA(dom, '#/capo/' + idCapoUI + '/modifica', 'Modifica abbattimento');
    H.scrivi(dom, '#a-peso', '77');
    H.scrivi(dom, '#a-classe', 'SUBADULTO');
    H.clic(dom, '#btn-salva-capo');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('77,0 kg'), 'scheda aggiornata');
    const capo = await dom.window.App.data.abbattimenti.perId(idCapoUI);
    assert.strictEqual(capo.pesoGrammi, 77000);
    assert.strictEqual(capo.classeEta, 'SUBADULTO');
  });

  await prova('A12. Annullamento e ripristino dalla scheda', async () => {
    await H.vaiA(dom, '#/capo/' + idCapoUI, 'Annulla abbattimento');
    H.clic(dom, '#btn-annulla-capo');
    await H.confermaModale(dom, true);
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Ripristina abbattimento'), 'capo annullato');
    let capo = await dom.window.App.data.abbattimenti.perId(idCapoUI);
    assert.strictEqual(capo.annullato, true);
    assert.ok(dom.window.document.body.textContent.includes('Abbattimento annullato'),
      'lo stato annullato non e\' evidenziato');

    H.clic(dom, '#btn-annulla-capo');
    await H.attesa(dom, () =>
      dom.window.document.body.textContent.includes('Annulla abbattimento'), 'capo ripristinato');
    capo = await dom.window.App.data.abbattimenti.perId(idCapoUI);
    assert.strictEqual(capo.annullato, false);
    // nessuna cancellazione fisica in nessun momento
    const capi = await dom.window.App.data.abbattimenti.tutti();
    assert.ok(capi.some((a) => a.id === idCapoUI), 'capo cancellato fisicamente');
  });

  await prova('A13. I capi annullati non sono contati (Home e giornata)', async () => {
    const c = await appSenzaCapi();
    const A = c.A;
    const g = c.giornate[0];
    const tir = c.iscrizioni[0].membroId;
    const campi = { giornataId: g.id, tiratoreMembroId: tir, sesso: 'MASCHIO',
      pesoGrammi: 50000, classeEta: 'ADULTO', caneMuta: null, note: '' };

    const a1 = await A.core.capo.crea(campi);
    await A.core.capo.crea(campi);
    assert.strictEqual(await A.core.capo.conteggioStagione(c.ctx.stagioneAttiva.id), 2);
    let perG = await A.core.capo.perGiornata(g.id);
    assert.strictEqual(perG.validi, 2);
    assert.strictEqual(perG.tutti.length, 2);

    await A.core.capo.impostaAnnullato(a1.id, true);
    assert.strictEqual(await A.core.capo.conteggioStagione(c.ctx.stagioneAttiva.id), 1,
      'il capo annullato e\' ancora contato nella stagione');
    perG = await A.core.capo.perGiornata(g.id);
    assert.strictEqual(perG.validi, 1, 'il capo annullato e\' ancora contato nella giornata');
    assert.strictEqual(perG.tutti.length, 2, 'il capo annullato e\' sparito dall\'elenco');

    // la Home mostra il conteggio derivato
    await H.vaiA(c.dom, '#/home', 'Capi stagione');
    assert.ok(c.dom.window.document.body.textContent.includes('1Capi stagione'),
      'conteggio Home errato: ' +
      c.dom.window.document.body.textContent.replace(/\s+/g, ' ').slice(0, 300));

    // nessun contatore memorizzato
    const d = await A.data.repo.leggiStore(['membri', 'stagioni', 'giornate']);
    ['totaleCapi', 'capi', 'pesoTotale', 'capiPerSocio'].forEach((campo) => {
      d.stagioni.forEach((s) => assert.ok(!(campo in s), 'campo derivato su stagione: ' + campo));
      d.membri.forEach((m) => assert.ok(!(campo in m), 'campo derivato su membro: ' + campo));
      d.giornate.forEach((x) => assert.ok(!(campo in x), 'campo derivato su giornata: ' + campo));
    });
    c.dom.window.close();
  });

  await prova('A14. La scheda giornata mostra i capi e il pulsante di registrazione', async () => {
    const c = await appSenzaCapi();
    const g = c.giornate[0];
    const capo = await c.A.core.capo.crea({ giornataId: g.id,
      tiratoreMembroId: c.iscrizioni[0].membroId, sesso: 'MASCHIO',
      pesoGrammi: 71500, classeEta: 'ADULTO', caneMuta: null, note: '' });

    await H.vaiA(c.dom, '#/giornata/' + g.id, 'Abbattimenti');
    const testo = c.dom.window.document.body.textContent;
    assert.ok(testo.includes(capo.codiceCapo), 'codice non elencato nella giornata');
    assert.ok(testo.includes('71,5 kg'), 'peso non mostrato');
    assert.ok(testo.includes('1 capo valido'), 'conteggio capi non mostrato');
    assert.ok(H.$(c.dom, '[data-vai="#/capo/nuovo/' + g.id + '"]'),
      'pulsante di registrazione mancante');

    // il form si apre con quella giornata gia' selezionata
    H.clic(c.dom, '[data-vai="#/capo/nuovo/' + g.id + '"]');
    await H.attesa(c.dom, () => H.$(c.dom, '#a-giornata'), 'form aperto dalla giornata');
    assert.strictEqual(H.$(c.dom, '#a-giornata').value, g.id,
      'la giornata non e\' preselezionata');

    // nessun pulsante dei moduli futuri
    const t2 = c.dom.window.document.body.textContent.toLowerCase();
    ['trichinella', 'carne', 'vendita'].forEach((v) => {
      assert.strictEqual(t2.indexOf(v), -1, 'trovato un riferimento a ' + v);
    });
    c.dom.window.close();
  });

  // ---------------------------------------------------------------- Blocco 3: storico
  console.log('\n[Blocco 3 — storico]');

  await prova('A15. Socio disattivato: resta leggibile come tiratore', async () => {
    const c = await appSenzaCapi();
    const A = c.A;
    const mid = c.iscrizioni[0].membroId;
    const capo = await A.core.capo.crea({ giornataId: c.giornate[0].id,
      tiratoreMembroId: mid, sesso: 'MASCHIO', pesoGrammi: 60000,
      classeEta: 'ADULTO', caneMuta: null, note: '' });
    const membro = await A.data.membri.perId(mid);

    await A.core.membro.impostaAttivo(mid, false);

    const scheda = await A.core.capo.scheda(capo.id);
    assert.ok(scheda.tiratore, 'tiratore perso dopo la disattivazione');
    assert.strictEqual(scheda.tiratore.id, mid);

    await H.vaiA(c.dom, '#/capo/' + capo.id, 'Tiratore');
    assert.ok(c.dom.window.document.body.textContent.includes(
      (membro.nome + ' ' + membro.cognome).trim()), 'nome del tiratore non piu\' visibile');
    c.dom.window.close();
  });

  await prova('A16. Cambio stagione attiva: abbattimenti invariati', async () => {
    const c = await appSenzaCapi();
    const A = c.A;
    await A.core.capo.crea({ giornataId: c.giornate[0].id,
      tiratoreMembroId: c.iscrizioni[0].membroId, sesso: 'MASCHIO',
      pesoGrammi: 60000, classeEta: 'ADULTO', caneMuta: null, note: '' });

    const prima = JSON.stringify((await A.data.abbattimenti.tutti())
      .sort((a, b) => a.id.localeCompare(b.id)));
    const stagioneOriginale = c.ctx.stagioneAttiva.id;

    await A.core.stagione.creaStagione({
      nome: '2031/2032', dataInizio: '2031-09-01', dataFine: '2032-01-31',
      quotaAnnualePredefinitaCent: 30000
    });
    let el = await A.core.capo.elenco();
    assert.strictEqual(el.righe.length, 0, 'capi ereditati dalla nuova stagione');
    assert.strictEqual(JSON.stringify((await A.data.abbattimenti.tutti())
      .sort((a, b) => a.id.localeCompare(b.id))), prima, 'abbattimenti alterati');

    await A.core.stagione.attivaStagione(stagioneOriginale);
    el = await A.core.capo.elenco();
    assert.strictEqual(el.righe.length, 1, 'capi non ritrovati tornando alla stagione');
    assert.strictEqual(JSON.stringify((await A.data.abbattimenti.tutti())
      .sort((a, b) => a.id.localeCompare(b.id))), prima, 'abbattimenti alterati dal ritorno');
    c.dom.window.close();
  });

  // ---------------------------------------------------------------- Blocco 3: validazione
  console.log('\n[Blocco 3 — validazione backup]');

  await rifiutaSenzaScrivere('N1. Capo con giornata inesistente rifiutato',
    (b) => { b.dati.abbattimenti[0].giornataId = 'gio_fantasma'; }, 'giornata inesistente');

  await rifiutaSenzaScrivere('N2. Capo con squadra inesistente rifiutato',
    (b) => { b.dati.abbattimenti[0].squadraId = 'sqd_fantasma'; }, 'squadra inesistente');

  await rifiutaSenzaScrivere('N3. Capo con stagione inesistente rifiutato',
    (b) => { b.dati.abbattimenti[0].stagioneId = 'stg_fantasma'; }, 'stagione inesistente');

  await rifiutaSenzaScrivere('N4. Capo con giornata di un\'altra stagione rifiutato',
    (b) => {
      const st2 = JSON.parse(JSON.stringify(b.dati.stagioni[0]));
      st2.id = 'stg_altra'; st2.nome = 'Altra stagione'; st2.stato = 'chiusa';
      b.dati.stagioni.push(st2);
      b.dati.abbattimenti[0].stagioneId = 'stg_altra';
    }, 'un\u2019altra stagione');

  await rifiutaSenzaScrivere('N5. Capo con tiratore inesistente rifiutato',
    (b) => { b.dati.abbattimenti[0].tiratoreMembroId = 'mbr_fantasma'; }, 'tiratore inesistente');

  await rifiutaSenzaScrivere('N6. Capo con tiratore di un\'altra squadra rifiutato',
    (b) => {
      const sq2 = { id: 'sqd_x', nome: 'X', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(sq2);
      const m2 = JSON.parse(JSON.stringify(b.dati.membri[0]));
      m2.id = 'mbr_x'; m2.squadraId = 'sqd_x';
      b.dati.membri.push(m2);
      b.dati.abbattimenti[0].tiratoreMembroId = 'mbr_x';
    }, 'un\u2019altra squadra');

  await rifiutaSenzaScrivere('N7. Capo con tiratore non iscritto alla stagione rifiutato',
    (b) => {
      const m2 = JSON.parse(JSON.stringify(b.dati.membri[0]));
      m2.id = 'mbr_senza_iscrizione';
      b.dati.membri.push(m2);
      b.dati.abbattimenti[0].tiratoreMembroId = 'mbr_senza_iscrizione';
    }, 'non \u00e8 iscritto alla stagione');

  await rifiutaSenzaScrivere('N8. Codice capo duplicato nella stessa stagione rifiutato',
    (b) => {
      const copia = JSON.parse(JSON.stringify(b.dati.abbattimenti[0]));
      copia.id = 'abb_copia';
      b.dati.abbattimenti.push(copia);
    }, 'stessa stagione');

  await rifiutaSenzaScrivere('N9. Capo senza codice rifiutato',
    (b) => { delete b.dati.abbattimenti[0].codiceCapo; }, 'senza codice capo');

  await rifiutaSenzaScrivere('N10. Peso non intero rifiutato',
    (b) => { b.dati.abbattimenti[0].pesoGrammi = 85500.5; }, 'peso non valido');

  await rifiutaSenzaScrivere('N11. Peso zero o negativo rifiutato',
    (b) => { b.dati.abbattimenti[0].pesoGrammi = 0; }, 'peso non valido');

  await rifiutaSenzaScrivere('N12. Peso oltre la soglia tecnica rifiutato',
    (b) => { b.dati.abbattimenti[0].pesoGrammi = 900000; }, 'peso non valido');

  await rifiutaSenzaScrivere('N13. Sesso non valido rifiutato',
    (b) => { b.dati.abbattimenti[0].sesso = 'M'; }, 'sesso non riconosciuto');

  await rifiutaSenzaScrivere('N14. Classe di età non valida rifiutata',
    (b) => { b.dati.abbattimenti[0].classeEta = 'ADULTO_VERRO'; }, 'classe di et\u00e0');

  await rifiutaSenzaScrivere('N15. Campo annullato non booleano rifiutato',
    (b) => { b.dati.abbattimenti[0].annullato = 'si'; }, 'vero o falso');

  await rifiutaSenzaScrivere('N16. Cane/muta non testuale rifiutato',
    (b) => { b.dati.abbattimenti[0].caneMuta = 42; }, 'cane/muta');

  await rifiutaSenzaScrivere('N17. Store abbattimenti mancante in uno schema 3 rifiutato',
    (b) => { delete b.dati.abbattimenti; }, 'abbattimenti');

  await prova('N18. Stesso codice in stagioni diverse: accettato', async () => {
    const B = dom.window.App.core.backup;
    const b = await baseValida();
    assert.ok(b.dati.abbattimenti.length > 0, 'nessun capo nel backup di base');

    // seconda stagione con una sua giornata, iscrizione e capo CG-001
    const sq = b.dati.squadre[0];
    const st2 = JSON.parse(JSON.stringify(b.dati.stagioni[0]));
    st2.id = 'stg_seconda'; st2.nome = '2099/2100'; st2.stato = 'chiusa';
    b.dati.stagioni.push(st2);

    const gio = JSON.parse(JSON.stringify(b.dati.giornate[0]));
    gio.id = 'gio_seconda'; gio.stagioneId = st2.id; gio.squadraId = sq.id;
    b.dati.giornate.push(gio);

    const membro = b.dati.membri[0];
    const isc = JSON.parse(JSON.stringify(b.dati.iscrizioni[0]));
    isc.id = 'isc_seconda'; isc.stagioneId = st2.id; isc.membroId = membro.id;
    b.dati.iscrizioni.push(isc);

    const codiceEsistente = b.dati.abbattimenti[0].codiceCapo;
    const capo = JSON.parse(JSON.stringify(b.dati.abbattimenti[0]));
    capo.id = 'abb_seconda';
    capo.codiceCapo = codiceEsistente;      // stesso codice, altra stagione
    capo.stagioneId = st2.id;
    capo.giornataId = gio.id;
    capo.squadraId = sq.id;
    capo.tiratoreMembroId = membro.id;
    b.dati.abbattimenti.push(capo);

    const errori = B.validaBackup(b);
    assert.strictEqual(errori.length, 0,
      'stesso codice in stagioni diverse rifiutato: ' + errori.join(' | '));
  });

  await prova('N19. Export/import completo con abbattimenti', async () => {
    const A = dom.window.App;
    const backup = await A.core.backup.costruisciBackup();
    assert.strictEqual(backup.schemaVersion, 4);
    assert.ok(backup.dati.abbattimenti.length > 0, 'nessun capo da esportare');

    await A.data.repo.scrivi(A.data.schema.nomiStore, (t) => {
      A.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    await A.core.backup.importaBackup(JSON.parse(JSON.stringify(backup)));
    assert.strictEqual(normalizza(await leggiTutto(dom)), normalizza(backup.dati),
      'i dati reimportati non coincidono');
  });

  // ---------------------------------------------------------------- Blocco 3: demo
  console.log('\n[Blocco 3 — dati demo]');

  await prova('A17. I dati demo includono i capi richiesti', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const dati = await A.data.repo.leggiStore(['abbattimenti', 'giornate', 'membri']);
    const capi = dati.abbattimenti;
    assert.ok(capi.length > 0 && capi.length <= 5,
      'attesi al massimo 5 capi demo, trovati ' + capi.length);
    capi.forEach((a) => assert.strictEqual(a.demo, true, 'capo demo non marcato'));

    assert.ok(capi.some((a) => a.sesso === 'MASCHIO' && a.classeEta === 'ADULTO'),
      'manca un maschio adulto');
    assert.ok(capi.some((a) => a.sesso === 'FEMMINA' && a.classeEta === 'ADULTO'),
      'manca una femmina adulta');
    assert.ok(capi.some((a) => a.classeEta === 'SUBADULTO'), 'manca un subadulto');
    assert.ok(capi.some((a) => a.pesoGrammi % 1000 !== 0), 'nessun peso con decimali');
    assert.ok(new Set(capi.map((a) => a.giornataId)).size >= 2, 'capi su una sola giornata');
    assert.ok(new Set(capi.map((a) => a.tiratoreMembroId)).size >= 2, 'un solo tiratore');
    assert.ok(capi.some((a) => a.caneMuta), 'nessun cane/muta indicato');
    assert.ok(capi.some((a) => a.annullato === true), 'nessun capo annullato');
    capi.forEach((a) => assert.ok(Number.isInteger(a.pesoGrammi), 'peso non intero nei demo'));

    // codici progressivi e univoci nella stagione
    const codici = capi.map((a) => a.codiceCapo);
    assert.strictEqual(new Set(codici).size, codici.length, 'codici demo duplicati');
    codici.forEach((c) => assert.ok(/^CG-\d{3}$/.test(c), 'codice demo malformato: ' + c));

    // il backup di un'app appena installata resta valido
    const b = await A.core.backup.costruisciBackup();
    const err = A.core.backup.validaBackup(b);
    assert.strictEqual(err.length, 0, 'dati demo non superano la validazione: ' + err.join(' | '));

    // e il prossimo codice riparte dal massimo, non dal conteggio
    const ctx = await A.core.squadra.contesto();
    const prossimo = await A.core.capo.prossimoCodicePerStagione(ctx.stagioneAttiva.id);
    assert.strictEqual(prossimo, A.core.capo.formattaCodice(capi.length + 1));
    d.window.close();
  });

  await prova('A18. Eliminazione dati di prova include gli abbattimenti', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const ant = await A.core.backup.anteprimaEliminazioneDemo();
    assert.ok(ant.conteggi.abbattimenti > 0, 'capi demo non contati');
    assert.strictEqual(ant.puoProcedere, true);

    const r = await A.core.backup.eliminaDatiDemo();
    assert.ok(r.eliminati.abbattimenti > 0, 'capi demo non eliminati');
    const dati = await A.data.repo.leggiStore(A.data.schema.nomiStoreDemo);
    // L'anagrafica reale resta, i dati di caccia fittizi spariscono.
    assert.strictEqual(dati.squadre.length, 1, 'squadra reale eliminata');
    assert.strictEqual(dati.stagioni.length, 1, 'stagione reale eliminata');
    assert.strictEqual(dati.membri.length, 21, 'soci reali eliminati');
    assert.strictEqual(dati.iscrizioni.length, 21, 'iscrizioni reali eliminate');
    ['giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.strictEqual(dati[n].length, 0, 'store non svuotato: ' + n);
    });
    d.window.close();
  });

  await prova('A19. Eliminazione demo bloccata se un capo reale usa dati demo', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const ctx = await A.core.squadra.contesto();
    const g = (await A.data.giornate.tutte())
      .filter((x) => x.stagioneId === ctx.stagioneAttiva.id && x.stato === 'COMPLETATA')[0];
    const isc = await A.data.iscrizioni.perStagione(ctx.stagioneAttiva.id);
    // capo reale dentro una giornata demo
    await A.core.capo.crea({ giornataId: g.id, tiratoreMembroId: isc[0].membroId,
      sesso: 'MASCHIO', pesoGrammi: 55000, classeEta: 'ADULTO', caneMuta: null, note: '' });

    const prima = normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup));
    const ant = await A.core.backup.anteprimaEliminazioneDemo();
    assert.strictEqual(ant.puoProcedere, false, 'eliminazione non bloccata');
    assert.ok(ant.problemi.join(' ').toLowerCase().includes('capo reale'),
      ant.problemi.join(' | '));

    let ko = false;
    try { await A.core.backup.eliminaDatiDemo(); } catch (e) { ko = true; }
    assert.ok(ko, 'eliminazione eseguita nonostante il blocco');
    assert.strictEqual(normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup)),
      prima, 'dati modificati nonostante il blocco');
    d.window.close();
  });

  // ---------------------------------------------------------------- 3.1: coerenza iscrizioni
  console.log('\n[3.1 — iscrizione: socio e stagione della stessa squadra]');

  await rifiutaSenzaScrivere('X1. Iscrizione che collega socio e stagione di squadre diverse rifiutata',
    (b) => {
      // seconda squadra con la sua stagione; il socio resta nella prima
      const sq2 = { id: 'sqd_seconda', nome: 'Seconda', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(sq2);
      const st2 = JSON.parse(JSON.stringify(b.dati.stagioni[0]));
      st2.id = 'stg_seconda_squadra';
      st2.nome = 'Stagione altrui';
      st2.stato = 'chiusa';
      st2.squadraId = sq2.id;
      b.dati.stagioni.push(st2);
      // iscrizione incrociata: membro della squadra A, stagione della squadra B
      const isc = JSON.parse(JSON.stringify(b.dati.iscrizioni[0]));
      isc.id = 'isc_incrociata';
      isc.stagioneId = st2.id;
      b.dati.iscrizioni.push(isc);
    }, 'squadre diverse');

  await prova('X2. Il database resta invariato dopo il rifiuto dell\'iscrizione incrociata',
    async () => {
      // gia' verificato da rifiutaSenzaScrivere, qui in modo esplicito
      // e su un\'app isolata, controllando anche il flusso di import.
      const disco = H.nuovoDisco();
      const d = await H.avviaApp(disco);
      const A = d.window.App;

      const b = JSON.parse(JSON.stringify(await A.core.backup.costruisciBackup()));
      const sq2 = { id: 'sqd_x2', nome: 'Altra', stagioneAttivaId: null, demo: false,
        creatoIl: 'x', aggiornatoIl: 'x' };
      b.dati.squadre.push(sq2);
      const st2 = JSON.parse(JSON.stringify(b.dati.stagioni[0]));
      st2.id = 'stg_x2'; st2.nome = 'Altra stagione'; st2.stato = 'chiusa'; st2.squadraId = sq2.id;
      b.dati.stagioni.push(st2);
      const isc = JSON.parse(JSON.stringify(b.dati.iscrizioni[0]));
      isc.id = 'isc_x2'; isc.stagioneId = st2.id;
      b.dati.iscrizioni.push(isc);

      const prima = normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup));
      const errori = A.core.backup.validaBackup(b);
      assert.ok(errori.length > 0, 'iscrizione incrociata accettata');
      assert.ok(errori.join(' ').toLowerCase().includes('squadre diverse'),
        'messaggio inatteso: ' + errori.join(' | '));

      let rifiutato = false;
      try { await A.core.backup.importaBackup(b); } catch (e) { rifiutato = true; }
      assert.ok(rifiutato, 'import non rifiutato');
      assert.strictEqual(normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup)),
        prima, 'il database e\' stato modificato da un import rifiutato');
      d.window.close();
    });

  await prova('X3. Iscrizione corretta della stessa squadra: accettata', async () => {
    const B = dom.window.App.core.backup;
    const b = await baseValida();

    // seconda stagione DELLA STESSA squadra, con un\'iscrizione dello stesso socio
    const sq = b.dati.squadre[0];
    const st2 = JSON.parse(JSON.stringify(b.dati.stagioni[0]));
    st2.id = 'stg_stessa_squadra';
    st2.nome = '2098/2099';
    st2.stato = 'chiusa';
    st2.squadraId = sq.id;
    b.dati.stagioni.push(st2);

    const isc = JSON.parse(JSON.stringify(b.dati.iscrizioni[0]));
    isc.id = 'isc_stessa_squadra';
    isc.stagioneId = st2.id;
    b.dati.iscrizioni.push(isc);

    const errori = B.validaBackup(b);
    assert.strictEqual(errori.length, 0,
      'iscrizione legittima rifiutata: ' + errori.join(' | '));

    // e un backup integro resta importabile senza alterare i dati
    const buono = await baseValida();
    const prima = normalizza(await leggiTutto(dom));
    await B.importaBackup(buono);
    assert.strictEqual(normalizza(await leggiTutto(dom)), prima,
      'reimport di un backup valido ha alterato i dati');
  });

  // ---------------------------------------------------------------- 3.1: doppio salvataggio
  console.log('\n[3.1 — doppio tap sul salvataggio del capo]');

  await prova('X4. Due click ravvicinati su Salva producono un solo capo', async () => {
    const c = await appSenzaCapi();
    const d = c.dom;
    const A = c.A;
    const g = c.giornate[0];

    // strumenta crea() per misurare le chiamate e tenerla in volo
    const reale = A.core.capo.crea;
    let chiamate = 0;
    let sblocca = null;
    const attesa = new Promise((res) => { sblocca = res; });
    A.core.capo.crea = function (campi) {
      chiamate++;
      return attesa.then(() => reale.call(A.core.capo, campi));
    };

    await H.vaiA(d, '#/capo/nuovo/' + g.id, 'Salva');
    await H.attesa(d, () => H.$(d, '#a-peso'), 'form nuovo capo');
    const opzioni = H.$$(d, '#a-tiratore option').filter((o) => o.value);
    H.scrivi(d, '#a-tiratore', opzioni[0].value);
    H.scrivi(d, '#a-sesso', 'MASCHIO');
    H.scrivi(d, '#a-classe', 'ADULTO');
    H.scrivi(d, '#a-peso', '80');

    const bottone = H.$(d, '#btn-salva-capo');
    H.clic(d, bottone);
    await H.pausa(d, 20);
    assert.strictEqual(bottone.disabled, true, 'pulsante Salva non disabilitato');
    assert.strictEqual(bottone.getAttribute('aria-busy'), 'true', 'aria-busy non impostato');
    // il resto della pagina resta usabile
    assert.strictEqual(H.$(d, '#a-peso').disabled, false, 'bloccata l\'intera pagina');

    // secondo tap mentre il primo e' in volo
    H.clic(d, bottone);
    H.clic(d, bottone);
    await H.pausa(d, 20);
    assert.strictEqual(chiamate, 1, 'avviate ' + chiamate + ' operazioni di salvataggio');

    sblocca();
    await H.attesa(d, () => d.window.location.hash.indexOf('#/capo/') === 0 &&
      d.window.location.hash.indexOf('nuovo') === -1, 'navigazione alla scheda');

    const capi = await A.data.abbattimenti.tutti();
    assert.strictEqual(capi.length, 1, 'creati ' + capi.length + ' capi invece di uno');
    assert.strictEqual(capi[0].codiceCapo, 'CG-001');

    A.core.capo.crea = reale;
    d.window.close();
  });

  await prova('X5. In caso di errore il pulsante Salva torna utilizzabile', async () => {
    const c = await appSenzaCapi();
    const d = c.dom;
    const A = c.A;
    const g = c.giornate[0];

    A.core.capo.crea = function () {
      return Promise.reject(new Error('Errore simulato.'));
    };

    await H.vaiA(d, '#/capo/nuovo/' + g.id, 'Salva');
    await H.attesa(d, () => H.$(d, '#a-peso'), 'form nuovo capo');
    const opzioni = H.$$(d, '#a-tiratore option').filter((o) => o.value);
    H.scrivi(d, '#a-tiratore', opzioni[0].value);
    H.scrivi(d, '#a-peso', '80');

    const bottone = H.$(d, '#btn-salva-capo');
    H.clic(d, bottone);
    await H.attesa(d, () => bottone.disabled === false, 'pulsante riabilitato');
    assert.strictEqual(bottone.getAttribute('aria-busy'), 'false', 'aria-busy non rimosso');
    assert.strictEqual(d.window.location.hash, '#/capo/nuovo/' + g.id,
      'navigazione avvenuta nonostante l\'errore');
    d.window.close();
  });

  await prova('X6. Il blocco vale anche in modifica', async () => {
    const c = await appSenzaCapi();
    const d = c.dom;
    const A = c.A;
    const capo = await A.core.capo.crea({ giornataId: c.giornate[0].id,
      tiratoreMembroId: c.iscrizioni[0].membroId, sesso: 'MASCHIO',
      pesoGrammi: 60000, classeEta: 'ADULTO', caneMuta: null, note: '' });

    const reale = A.core.capo.aggiorna;
    let chiamate = 0;
    let sblocca = null;
    const attesa = new Promise((res) => { sblocca = res; });
    A.core.capo.aggiorna = function (id, campi) {
      chiamate++;
      return attesa.then(() => reale.call(A.core.capo, id, campi));
    };

    await H.vaiA(d, '#/capo/' + capo.id + '/modifica', 'Salva');
    H.scrivi(d, '#a-peso', '70');
    const bottone = H.$(d, '#btn-salva-capo');
    H.clic(d, bottone);
    await H.pausa(d, 20);
    assert.strictEqual(bottone.disabled, true, 'pulsante non disabilitato in modifica');
    H.clic(d, bottone);
    await H.pausa(d, 20);
    assert.strictEqual(chiamate, 1, 'avviate ' + chiamate + ' modifiche');

    sblocca();
    await H.attesa(d, () => d.window.location.hash === '#/capo/' + capo.id, 'navigazione');
    const dopo = await A.data.abbattimenti.perId(capo.id);
    assert.strictEqual(dopo.pesoGrammi, 70000);
    assert.strictEqual((await A.data.abbattimenti.tutti()).length, 1, 'capo duplicato');

    A.core.capo.aggiorna = reale;
    d.window.close();
  });

  // ---------------------------------------------------------------- Blocco 4: schema
  console.log('\n[Blocco 4 — schema e migrazioni]');

  await prova('T5. Upgrade v3 -> v4: solo il nuovo store, nessun dato perso', async () => {
    const discoV3 = H.nuovoDisco();
    await new Promise((resolve, reject) => {
      const req = discoV3.open('adrenalinaDB', 3);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('meta', { keyPath: 'chiave' });
        db.createObjectStore('squadre', { keyPath: 'id' });
        const st = db.createObjectStore('stagioni', { keyPath: 'id' });
        st.createIndex('by_squadra', 'squadraId');
        st.createIndex('by_stato', 'stato');
        const mb = db.createObjectStore('membri', { keyPath: 'id' });
        mb.createIndex('by_squadra', 'squadraId');
        mb.createIndex('by_cognome', 'cognome');
        const isc = db.createObjectStore('iscrizioni', { keyPath: 'id' });
        isc.createIndex('by_stagione', 'stagioneId');
        isc.createIndex('by_membro', 'membroId');
        isc.createIndex('by_stagione_membro', ['stagioneId', 'membroId'], { unique: true });
        const gio = db.createObjectStore('giornate', { keyPath: 'id' });
        gio.createIndex('by_stagione', 'stagioneId');
        gio.createIndex('by_squadra', 'squadraId');
        gio.createIndex('by_data', 'data');
        const pre = db.createObjectStore('presenze', { keyPath: 'id' });
        pre.createIndex('by_giornata', 'giornataId');
        pre.createIndex('by_membro', 'membroId');
        pre.createIndex('by_giornata_membro', ['giornataId', 'membroId'], { unique: true });
        const abb = db.createObjectStore('abbattimenti', { keyPath: 'id' });
        abb.createIndex('by_stagione', 'stagioneId');
        abb.createIndex('by_giornata', 'giornataId');
        abb.createIndex('by_tiratore', 'tiratoreMembroId');
        abb.createIndex('by_stagione_codice', ['stagioneId', 'codiceCapo'], { unique: true });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction(['meta', 'squadre', 'stagioni', 'membri', 'iscrizioni',
          'giornate', 'presenze', 'abbattimenti'], 'readwrite');
        t.objectStore('meta').put({ chiave: 'schemaVersion', valore: 3 });
        t.objectStore('meta').put({ chiave: 'squadraCorrenteId', valore: 'sqd_v3' });
        t.objectStore('squadre').put({ id: 'sqd_v3', nome: 'Adrenalina',
          stagioneAttivaId: 'stg_v3', demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('stagioni').put({ id: 'stg_v3', squadraId: 'sqd_v3', nome: '2026/2027',
          dataInizio: '2026-09-01', dataFine: '2027-01-31', stato: 'attiva',
          quotaAnnualePredefinitaCent: 24000, demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('membri').put({ id: 'mbr_v3', squadraId: 'sqd_v3', nome: 'Vecchio',
          cognome: 'Socio', dataNascita: null, telefono: null, note: '',
          livelloAccessoApp: 'MEMBRO', attivo: true, scadenzaPortoArmi: null,
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('iscrizioni').put({ id: 'isc_v3', stagioneId: 'stg_v3', membroId: 'mbr_v3',
          ruoliVenatori: ['POSTAIOLO'], ospite: false, quotaAnnualePrevistaCent: 24000,
          quotaVersataCent: 0, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('giornate').put({ id: 'gio_v3', squadraId: 'sqd_v3', stagioneId: 'stg_v3',
          data: '2026-11-08', orarioRitrovo: '06:30', zona: 'Vecchia Zona',
          capocacciaMembroId: null, note: '', stato: 'COMPLETATA',
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('presenze').put({ id: 'pre_v3', giornataId: 'gio_v3', membroId: 'mbr_v3',
          stato: 'PRESENTE', note: '', demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.objectStore('abbattimenti').put({ id: 'abb_v3', codiceCapo: 'CG-001',
          squadraId: 'sqd_v3', stagioneId: 'stg_v3', giornataId: 'gio_v3',
          tiratoreMembroId: 'mbr_v3', sesso: 'MASCHIO', pesoGrammi: 85500,
          classeEta: 'ADULTO', caneMuta: 'Fulmine', note: '', annullato: false,
          demo: false, creatoIl: 'x', aggiornatoIl: 'x' });
        t.oncomplete = () => { db.close(); resolve(true); };
        t.onerror = () => reject(t.error);
      };
    });

    const dV = await H.avviaApp(discoV3);
    const idb = await dV.window.App.data.db.apri();
    assert.strictEqual(idb.version, 4, 'database non aggiornato a v4');
    assert.ok(idb.objectStoreNames.contains('controlliSanitari'), 'store non creato');
    const store = idb.transaction(['controlliSanitari'], 'readonly')
      .objectStore('controlliSanitari');
    assert.ok(store.indexNames.contains('by_abbattimento'), 'indice mancante');

    const d = await dV.window.App.data.repo.leggiStore(dV.window.App.data.schema.nomiStore);
    assert.strictEqual(d.abbattimenti.length, 1, 'capo perso');
    assert.strictEqual(d.abbattimenti[0].codiceCapo, 'CG-001', 'capo riscritto');
    assert.strictEqual(d.abbattimenti[0].pesoGrammi, 85500);
    assert.strictEqual(d.giornate.length, 1, 'giornata persa');
    assert.strictEqual(d.presenze.length, 1, 'presenza persa');
    assert.strictEqual(d.controlliSanitari.length, 0);
    const meta = {};
    d.meta.forEach((m) => { meta[m.chiave] = m.valore; });
    assert.strictEqual(meta.schemaVersion, 4, 'meta.schemaVersion non aggiornato a 4');
    assert.strictEqual(d.meta.filter((m) => m.chiave === 'schemaVersion').length, 1,
      'chiave schemaVersion duplicata');
    dV.window.close();
  });

  await prova('T6. Import di un backup schema 3 migrato a schema 4', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;

    const b4 = await A.core.backup.costruisciBackup();
    const b3 = JSON.parse(JSON.stringify(b4));
    b3.schemaVersion = 3;
    delete b3.dati.controlliSanitari;
    b3.dati.meta.forEach((m) => { if (m.chiave === 'schemaVersion') m.valore = 3; });

    assert.strictEqual(A.core.backup.validaBackup(b3).length, 0,
      'backup schema 3 rifiutato: ' + A.core.backup.validaBackup(b3).join(' | '));
    await A.core.backup.importaBackup(b3);

    const dati = await A.data.repo.leggiStore(['controlliSanitari', 'abbattimenti', 'meta']);
    assert.strictEqual(dati.controlliSanitari.length, 0, 'controlli non inizializzati');
    assert.ok(dati.abbattimenti.length > 0, 'capi persi nella migrazione');
    const voci = dati.meta.filter((m) => m.chiave === 'schemaVersion');
    assert.strictEqual(voci.length, 1);
    assert.strictEqual(voci[0].valore, 4, 'meta.schemaVersion non portata a 4');
    assert.strictEqual(voci[0].valore, A.versione.SCHEMA_VERSION);
    d.window.close();
  });

  // ---------------------------------------------------------------- Blocco 4: controllo
  console.log('\n[Blocco 4 — controllo sanitario]');

  // App demo con un capo su cui lavorare.
  async function appConCapo() {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const capi = await A.data.abbattimenti.tutti();
    // un capo demo senza controllo gia' registrato
    const controlli = await A.data.controlliSanitari.tutti();
    const conControllo = {};
    controlli.forEach((c) => { conControllo[c.abbattimentoId] = true; });
    const senza = capi.filter((a) => !conControllo[a.id] && !a.annullato)[0];
    return { dom: d, A, capo: senza, capi, controlli };
  }

  await prova('T7. Creazione controllo sanitario dal form', async () => {
    const c = await appConCapo();
    assert.ok(c.capo, 'nessun capo demo senza controllo');

    await H.vaiA(c.dom, '#/capo/' + c.capo.id, 'Controllo sanitario');
    assert.ok(c.dom.window.document.body.textContent.includes('Non registrato'),
      'un capo senza controllo non risulta "Non registrato"');

    H.clic(c.dom, '[data-vai="#/capo/' + c.capo.id + '/sanitario"]');
    await H.attesa(c.dom, () => H.$(c.dom, '#s-stato'), 'form controllo');
    H.scrivi(c.dom, '#s-stato', 'IN_ATTESA');
    H.scrivi(c.dom, '#s-prelievo', '2026-11-10');
    H.scrivi(c.dom, '#s-riferimento', 'TR-2026-099');
    H.scrivi(c.dom, '#s-note', 'Campione consegnato.');
    H.clic(c.dom, '#btn-salva-sanitario');

    await H.attesa(c.dom, () => c.dom.window.location.hash === '#/capo/' + c.capo.id,
      'ritorno alla scheda del capo');
    await H.pausa(c.dom, 60);
    assert.ok(c.dom.window.document.body.textContent.includes('In attesa'),
      'stato non mostrato nella scheda');

    const salvato = await c.A.data.controlliSanitari.perAbbattimento(c.capo.id);
    assert.ok(salvato, 'controllo non salvato');
    assert.strictEqual(salvato.statoTrichinella, 'IN_ATTESA');
    assert.strictEqual(salvato.dataPrelievo, '2026-11-10');
    assert.strictEqual(salvato.dataEsito, null, 'IN_ATTESA non deve richiedere la data di esito');
    assert.strictEqual(salvato.riferimentoCampione, 'TR-2026-099');
    assert.strictEqual(salvato.demo, false);
    assert.ok(/^san_/.test(salvato.id), 'id non opaco: ' + salvato.id);
    c.dom.window.close();
  });

  await prova('T8. Modifica: aggiorna lo stesso record, nessun duplicato', async () => {
    const c = await appConCapo();
    const A = c.A;
    const primo = await A.core.sanitario.salva(c.capo.id, {
      statoTrichinella: 'IN_ATTESA', dataPrelievo: '2026-11-10', dataEsito: null,
      riferimentoCampione: 'TR-1', note: ''
    });

    await H.vaiA(c.dom, '#/capo/' + c.capo.id + '/sanitario', 'Salva');
    assert.strictEqual(H.$(c.dom, '#s-stato').value, 'IN_ATTESA', 'form non precompilato');
    assert.strictEqual(H.$(c.dom, '#s-prelievo').value, '2026-11-10');
    H.scrivi(c.dom, '#s-stato', 'NEGATIVO_CONFORME');
    H.scrivi(c.dom, '#s-esito', '2026-11-13');
    H.clic(c.dom, '#btn-salva-sanitario');
    await H.attesa(c.dom, () => c.dom.window.location.hash === '#/capo/' + c.capo.id,
      'ritorno alla scheda del capo');
    await H.pausa(c.dom, 60);
    assert.ok(c.dom.window.document.body.textContent.includes('Negativo / Conforme'),
      'stato aggiornato non mostrato');

    const tutti = (await A.data.controlliSanitari.tutti())
      .filter((x) => x.abbattimentoId === c.capo.id);
    assert.strictEqual(tutti.length, 1, 'creato un duplicato invece di aggiornare');
    assert.strictEqual(tutti[0].id, primo.id, 'id cambiato durante la modifica');
    assert.strictEqual(tutti[0].statoTrichinella, 'NEGATIVO_CONFORME');
    assert.strictEqual(tutti[0].dataEsito, '2026-11-13');
    c.dom.window.close();
  });

  await prova('T9. Unicità abbattimentoId garantita dall\'indice', async () => {
    const c = await appConCapo();
    const A = c.A;
    const primo = await A.core.sanitario.salva(c.capo.id, {
      statoTrichinella: 'POSITIVO', dataPrelievo: null, dataEsito: null,
      riferimentoCampione: null, note: ''
    });
    // salvataggi ripetuti non moltiplicano i record
    await A.core.sanitario.salva(c.capo.id, { statoTrichinella: 'IN_ATTESA',
      dataPrelievo: null, dataEsito: null, riferimentoCampione: null, note: '' });
    await A.core.sanitario.salva(c.capo.id, { statoTrichinella: 'NON_VALUTABILE',
      dataPrelievo: null, dataEsito: null, riferimentoCampione: null, note: '' });
    const perCapo = (await A.data.controlliSanitari.tutti())
      .filter((x) => x.abbattimentoId === c.capo.id);
    assert.strictEqual(perCapo.length, 1, 'record moltiplicati');

    // scrittura diretta di un doppione: bloccata dall'indice unique
    const copia = JSON.parse(JSON.stringify(primo));
    copia.id = 'san_doppione';
    let ko = false;
    try {
      await A.data.repo.scrivi(['controlliSanitari'], (t) => {
        t.put('controlliSanitari', copia);
      });
    } catch (e) { ko = true; }
    assert.ok(ko, 'l\'indice unico non ha impedito il doppio controllo');
    c.dom.window.close();
  });

  await prova('T10. Tutti gli stati previsti sono ammessi, gli altri no', async () => {
    const c = await appConCapo();
    const A = c.A;
    const attesi = ['NON_PRELEVATO', 'IN_ATTESA', 'NEGATIVO_CONFORME',
      'POSITIVO', 'NON_VALUTABILE'];
    assert.strictEqual(A.costanti.STATI_TRICHINELLA.map((x) => x.codice).join(','),
      attesi.join(','), 'lista degli stati alterata');

    for (const stato of attesi) {
      const salvato = await A.core.sanitario.salva(c.capo.id, {
        statoTrichinella: stato, dataPrelievo: null, dataEsito: null,
        riferimentoCampione: null, note: ''
      });
      assert.strictEqual(salvato.statoTrichinella, stato, 'stato ' + stato + ' non salvato');
    }

    // etichette richieste
    assert.strictEqual(A.costanti.etichettaStatoTrichinella('NEGATIVO_CONFORME'),
      'Negativo / Conforme');
    assert.strictEqual(A.costanti.etichettaStatoTrichinella('IN_ATTESA'), 'In attesa');
    assert.strictEqual(A.costanti.etichettaStatoTrichinella('NON_PRELEVATO'), 'Non prelevato');

    // uno stato inventato viene rifiutato senza scrivere
    const prima = normalizza(await A.data.repo.leggiStore(['controlliSanitari']));
    let ko = false;
    try {
      await A.core.sanitario.salva(c.capo.id, { statoTrichinella: 'DUBBIO',
        dataPrelievo: null, dataEsito: null, riferimentoCampione: null, note: '' });
    } catch (e) { ko = true; }
    assert.ok(ko, 'stato inventato accettato');
    assert.strictEqual(normalizza(await A.data.repo.leggiStore(['controlliSanitari'])), prima,
      'dati modificati da un salvataggio rifiutato');
    c.dom.window.close();
  });

  await prova('T11. Date: valide accettate, impossibili e incoerenti rifiutate', async () => {
    const S = dom.window.App.core.sanitario;
    const base = { statoTrichinella: 'NEGATIVO_CONFORME', riferimentoCampione: '', note: '' };

    // entrambe assenti: ammesso
    assert.strictEqual(Object.keys(S.valida(Object.assign({}, base,
      { dataPrelievo: null, dataEsito: null }))).length, 0, 'date assenti rifiutate');
    // IN_ATTESA senza esito: ammesso
    assert.strictEqual(Object.keys(S.valida({ statoTrichinella: 'IN_ATTESA',
      dataPrelievo: '2026-11-10', dataEsito: null })).length, 0,
      'IN_ATTESA senza data di esito rifiutato');
    // coppia valida
    assert.strictEqual(Object.keys(S.valida(Object.assign({}, base,
      { dataPrelievo: '2026-11-10', dataEsito: '2026-11-13' }))).length, 0,
      'coppia valida rifiutata');
    // stessa data: ammessa (>=)
    assert.strictEqual(Object.keys(S.valida(Object.assign({}, base,
      { dataPrelievo: '2026-11-10', dataEsito: '2026-11-10' }))).length, 0,
      'esito nello stesso giorno rifiutato');

    // date impossibili
    assert.ok(S.valida(Object.assign({}, base,
      { dataPrelievo: '2026-02-31', dataEsito: null })).dataPrelievo, '31 febbraio accettato');
    assert.ok(S.valida(Object.assign({}, base,
      { dataPrelievo: null, dataEsito: '2026-13-10' })).dataEsito, 'mese 13 accettato');
    assert.ok(S.valida(Object.assign({}, base,
      { dataPrelievo: null, dataEsito: '10/11/2026' })).dataEsito, 'data italiana accettata');

    // esito precedente al prelievo
    const err = S.valida(Object.assign({}, base,
      { dataPrelievo: '2026-11-13', dataEsito: '2026-11-10' }));
    assert.ok(err.dataEsito, 'esito precedente al prelievo accettato');
    assert.ok(err.dataEsito.toLowerCase().includes('precedere'),
      'messaggio poco chiaro: ' + err.dataEsito);
  });

  await prova('T12. Il form rifiuta l\'esito precedente al prelievo senza scrivere', async () => {
    const c = await appConCapo();
    await H.vaiA(c.dom, '#/capo/' + c.capo.id + '/sanitario', 'Salva');
    H.scrivi(c.dom, '#s-stato', 'NEGATIVO_CONFORME');
    H.scrivi(c.dom, '#s-prelievo', '2026-11-13');
    H.scrivi(c.dom, '#s-esito', '2026-11-10');
    H.clic(c.dom, '#btn-salva-sanitario');
    await H.pausa(c.dom, 80);

    assert.ok(H.$(c.dom, '#err-s-esito').textContent.length > 0, 'nessun errore mostrato');
    assert.strictEqual(c.dom.window.location.hash, '#/capo/' + c.capo.id + '/sanitario',
      'navigazione avvenuta nonostante l\'errore');
    const salvato = await c.A.data.controlliSanitari.perAbbattimento(c.capo.id);
    assert.strictEqual(salvato, null, 'controllo salvato nonostante le date incoerenti');
    c.dom.window.close();
  });

  await prova('T13. Capo senza controllo: "Non registrato" e nulla in archivio', async () => {
    const c = await appConCapo();
    const controllo = await c.A.core.sanitario.perAbbattimento(c.capo.id);
    assert.strictEqual(controllo, null, 'esiste gia\' un controllo');
    assert.strictEqual(c.A.core.sanitario.etichettaStato(null), 'Non registrato');

    // "Non registrato" non e' uno stato memorizzato
    const codici = c.A.costanti.STATI_TRICHINELLA.map((x) => x.codice);
    assert.strictEqual(codici.indexOf('NON_REGISTRATO'), -1,
      'NON_REGISTRATO e\' finito fra gli stati memorizzabili');

    await H.vaiA(c.dom, '#/capo/' + c.capo.id, 'Controllo sanitario');
    assert.ok(c.dom.window.document.body.textContent.includes('Non registrato'));
    assert.ok(c.dom.window.document.body.textContent.includes('Gestisci controllo sanitario'),
      'pulsante mancante');
    c.dom.window.close();
  });

  await prova('T14. Il registro mostra lo stato sanitario senza aprire il capo', async () => {
    const c = await appConCapo();
    await c.A.core.sanitario.salva(c.capo.id, { statoTrichinella: 'POSITIVO',
      dataPrelievo: null, dataEsito: null, riferimentoCampione: null, note: '' });

    await H.vaiA(c.dom, '#/abbattimenti', 'Registro');
    const testo = c.dom.window.document.body.textContent;
    assert.ok(testo.includes('Trichinella: Positivo'), 'stato positivo non in elenco');
    assert.ok(testo.includes('Trichinella: In attesa'), 'stato in attesa non in elenco');
    assert.ok(testo.includes('Trichinella: Negativo / Conforme'), 'stato negativo non in elenco');
    assert.ok(testo.includes('Trichinella: Non registrato'), 'capi senza controllo non segnalati');

    // il positivo non si affida al solo colore: c'e' un simbolo nel testo
    const riga = H.$$(c.dom, '.riga-sanitaria.positivo')[0];
    assert.ok(riga, 'nessuna riga marcata positiva');
    assert.ok(riga.textContent.indexOf('\u26A0') !== -1,
      'lo stato positivo e\' distinguibile solo dal colore');
    c.dom.window.close();
  });

  await prova('T15. Capo annullato: controllo leggibile e modificabile, con avviso', async () => {
    const c = await appConCapo();
    const A = c.A;
    const capi = await A.data.abbattimenti.tutti();
    const annullato = capi.filter((a) => a.annullato)[0];
    assert.ok(annullato, 'nessun capo demo annullato');

    await A.core.sanitario.salva(annullato.id, { statoTrichinella: 'NEGATIVO_CONFORME',
      dataPrelievo: '2026-11-10', dataEsito: '2026-11-12',
      riferimentoCampione: 'TR-ANN', note: 'Storico.' });

    // la scheda del capo annullato mostra il controllo
    await H.vaiA(c.dom, '#/capo/' + annullato.id, 'Controllo sanitario');
    let testo = c.dom.window.document.body.textContent;
    assert.ok(testo.includes('Negativo / Conforme'), 'controllo non leggibile su capo annullato');
    assert.ok(testo.includes('TR-ANN'), 'riferimento campione non mostrato');

    // il form avvisa che il capo e' annullato ma resta utilizzabile
    await H.vaiA(c.dom, '#/capo/' + annullato.id + '/sanitario', 'Salva');
    testo = c.dom.window.document.body.textContent;
    assert.ok(testo.includes('è annullato'), 'manca l\'avviso di capo annullato');
    assert.strictEqual(H.$(c.dom, '#btn-salva-sanitario').disabled, false,
      'form bloccato su un capo annullato');
    H.scrivi(c.dom, '#s-note', 'Aggiornato dopo l\'annullamento.');
    H.clic(c.dom, '#btn-salva-sanitario');
    await H.attesa(c.dom, () => c.dom.window.location.hash === '#/capo/' + annullato.id,
      'ritorno alla scheda');
    const dopo = await A.data.controlliSanitari.perAbbattimento(annullato.id);
    assert.strictEqual(dopo.note, 'Aggiornato dopo l\'annullamento.');

    // annullare un capo non cancella il suo controllo
    await A.core.capo.impostaAnnullato(annullato.id, false);
    await A.core.capo.impostaAnnullato(annullato.id, true);
    assert.ok(await A.data.controlliSanitari.perAbbattimento(annullato.id),
      'controllo perso annullando il capo');
    c.dom.window.close();
  });

  // ---------------------------------------------------------------- Blocco 4: validazione
  console.log('\n[Blocco 4 — validazione backup]');

  await rifiutaSenzaScrivere('W1. Controllo sanitario orfano rifiutato',
    (b) => { b.dati.controlliSanitari[0].abbattimentoId = 'abb_fantasma'; },
    'capo inesistente');

  await rifiutaSenzaScrivere('W2. Controllo senza abbattimentoId rifiutato',
    (b) => { delete b.dati.controlliSanitari[0].abbattimentoId; }, 'senza abbattimentoid');

  await rifiutaSenzaScrivere('W3. Controllo senza id rifiutato',
    (b) => { delete b.dati.controlliSanitari[0].id; }, 'senza id valido');

  await rifiutaSenzaScrivere('W4. Stato trichinella non valido rifiutato',
    (b) => { b.dati.controlliSanitari[0].statoTrichinella = 'DUBBIO'; },
    'stato trichinella non riconosciuto');

  await rifiutaSenzaScrivere('W5. Due controlli sullo stesso capo rifiutati',
    (b) => {
      const copia = JSON.parse(JSON.stringify(b.dati.controlliSanitari[0]));
      copia.id = 'san_copia';
      b.dati.controlliSanitari.push(copia);
    }, 'stesso capo');

  await rifiutaSenzaScrivere('W6. Data di prelievo impossibile rifiutata',
    (b) => { b.dati.controlliSanitari[0].dataPrelievo = '2026-02-31'; },
    'data di prelievo non valida');

  await rifiutaSenzaScrivere('W7. Data di esito impossibile rifiutata',
    (b) => { b.dati.controlliSanitari[0].dataEsito = '2026-13-01'; },
    'data di esito non valida');

  await rifiutaSenzaScrivere('W8. Esito precedente al prelievo rifiutato',
    (b) => {
      b.dati.controlliSanitari[0].dataPrelievo = '2026-11-13';
      b.dati.controlliSanitari[0].dataEsito = '2026-11-10';
    }, 'precede quella di prelievo');

  await rifiutaSenzaScrivere('W9. Riferimento campione non testuale rifiutato',
    (b) => { b.dati.controlliSanitari[0].riferimentoCampione = 42; },
    'riferimento campione deve essere testo');

  await rifiutaSenzaScrivere('W10. Note non testuali rifiutate',
    (b) => { b.dati.controlliSanitari[0].note = { a: 1 }; }, 'note devono essere testo');

  await rifiutaSenzaScrivere('W11. Campo demo non booleano rifiutato',
    (b) => { b.dati.controlliSanitari[0].demo = 'si'; }, 'vero o falso');

  await rifiutaSenzaScrivere('W12. Store controlliSanitari mancante in uno schema 4 rifiutato',
    (b) => { delete b.dati.controlliSanitari; }, 'controllisanitari');

  await prova('W13. Un controllo su un capo annullato resta valido', async () => {
    const B = dom.window.App.core.backup;
    const b = await baseValida();
    // marca annullato il capo del primo controllo
    const idCapo = b.dati.controlliSanitari[0].abbattimentoId;
    b.dati.abbattimenti.forEach((a) => { if (a.id === idCapo) a.annullato = true; });
    const errori = B.validaBackup(b);
    assert.strictEqual(errori.length, 0,
      'controllo su capo annullato rifiutato: ' + errori.join(' | '));
  });

  await prova('W14. Export/import completo con i controlli sanitari', async () => {
    const A = dom.window.App;
    const backup = await A.core.backup.costruisciBackup();
    assert.strictEqual(backup.schemaVersion, 4);
    assert.ok(backup.dati.controlliSanitari.length > 0, 'nessun controllo da esportare');

    await A.data.repo.scrivi(A.data.schema.nomiStore, (t) => {
      A.data.schema.nomiStore.forEach((n) => t.svuota(n));
    });
    await A.core.backup.importaBackup(JSON.parse(JSON.stringify(backup)));
    assert.strictEqual(normalizza(await leggiTutto(dom)), normalizza(backup.dati),
      'i dati reimportati non coincidono');
  });

  // ---------------------------------------------------------------- Blocco 4: demo
  console.log('\n[Blocco 4 — dati demo]');

  await prova('T16. I dati demo includono i controlli richiesti', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const dati = await A.data.repo.leggiStore(['controlliSanitari', 'abbattimenti']);
    const controlli = dati.controlliSanitari;
    assert.ok(controlli.length > 0, 'nessun controllo demo');
    controlli.forEach((c) => assert.strictEqual(c.demo, true, 'controllo demo non marcato'));

    const stati = controlli.map((c) => c.statoTrichinella);
    ['IN_ATTESA', 'NEGATIVO_CONFORME', 'NON_PRELEVATO'].forEach((st) => {
      assert.ok(stati.indexOf(st) !== -1, 'manca un controllo ' + st);
    });
    // non tutti i capi hanno un controllo
    assert.ok(controlli.length < dati.abbattimenti.length,
      'ogni capo demo ha un controllo: manca il caso "Non registrato"');
    // un solo controllo per capo
    const perCapo = {};
    controlli.forEach((c) => {
      assert.ok(!perCapo[c.abbattimentoId], 'due controlli demo sullo stesso capo');
      perCapo[c.abbattimentoId] = true;
      assert.ok(dati.abbattimenti.some((a) => a.id === c.abbattimentoId),
        'controllo demo orfano');
    });

    const b = await A.core.backup.costruisciBackup();
    const err = A.core.backup.validaBackup(b);
    assert.strictEqual(err.length, 0, 'dati demo non superano la validazione: ' + err.join(' | '));
    d.window.close();
  });

  await prova('T17. Eliminazione dati di prova include i controlli sanitari', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const ant = await A.core.backup.anteprimaEliminazioneDemo();
    assert.ok(ant.conteggi.controlliSanitari > 0, 'controlli demo non contati');
    assert.strictEqual(ant.puoProcedere, true);

    const r = await A.core.backup.eliminaDatiDemo();
    assert.ok(r.eliminati.controlliSanitari > 0, 'controlli demo non eliminati');
    const dati = await A.data.repo.leggiStore(A.data.schema.nomiStoreDemo);
    // L'anagrafica reale resta, i dati di caccia fittizi spariscono.
    assert.strictEqual(dati.squadre.length, 1, 'squadra reale eliminata');
    assert.strictEqual(dati.stagioni.length, 1, 'stagione reale eliminata');
    assert.strictEqual(dati.membri.length, 21, 'soci reali eliminati');
    assert.strictEqual(dati.iscrizioni.length, 21, 'iscrizioni reali eliminate');
    ['giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.strictEqual(dati[n].length, 0, 'store non svuotato: ' + n);
    });
    d.window.close();
  });

  await prova('T18. Eliminazione demo bloccata se un controllo reale usa un capo demo', async () => {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const capi = await A.data.abbattimenti.tutti();
    const controlli = await A.data.controlliSanitari.tutti();
    const conControllo = {};
    controlli.forEach((c) => { conControllo[c.abbattimentoId] = true; });
    const senza = capi.filter((a) => !conControllo[a.id])[0];

    // controllo reale su un capo demo
    await A.core.sanitario.salva(senza.id, { statoTrichinella: 'IN_ATTESA',
      dataPrelievo: null, dataEsito: null, riferimentoCampione: null, note: '' });

    const prima = normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup));
    const ant = await A.core.backup.anteprimaEliminazioneDemo();
    assert.strictEqual(ant.puoProcedere, false, 'eliminazione non bloccata');
    assert.ok(ant.problemi.join(' ').toLowerCase().includes('controllo sanitario reale'),
      ant.problemi.join(' | '));

    let ko = false;
    try { await A.core.backup.eliminaDatiDemo(); } catch (e) { ko = true; }
    assert.ok(ko, 'eliminazione eseguita nonostante il blocco');
    assert.strictEqual(normalizza(await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup)),
      prima, 'dati modificati nonostante il blocco');
    d.window.close();
  });

  // ---------------------------------------------------------------- anagrafica reale
  console.log('\n[Anagrafica reale della squadra]');

  const NOMI_REALI = [
    'Stefano Bianchi', 'Pier Nolli', 'Luca Malcotti', 'Davide Zanotti',
    'Roberto Dido', 'Cristian Cerlini', 'Adriano De Giorgis', 'Antonio Rinaldi',
    'Cesare Bettini', 'Federico Tonetti', 'Francesco Ferrari', 'Gabriele Beltrami',
    'Giuseppe Olivari', 'Lele Pinco', 'Luciano Boretti', 'Marco Mora',
    'Massimiliano Manganelli', 'Pierangelo Cottini', 'Renato Borri',
    'Simone Agrati', 'Alessandro Zanetta'
  ];
  const AMMINISTRATORI = ['Alessandro Zanetta', 'Stefano Bianchi', 'Luca Malcotti'];
  const CON_DUE_RUOLI = ['Pier Nolli', 'Luca Malcotti', 'Davide Zanotti'];

  async function appReale() {
    const disco = H.nuovoDisco();
    const d = await H.avviaApp(disco);
    const A = d.window.App;
    const dati = await A.data.repo.leggiStore(A.data.schema.nomiStoreBackup);
    const perNome = {};
    dati.membri.forEach((m) => { perNome[(m.nome + ' ' + m.cognome).trim()] = m; });
    return { dom: d, A, dati, perNome };
  }

  await prova('Y1. I 21 soci reali sono presenti, con squadra e stagione reali', async () => {
    const c = await appReale();
    assert.strictEqual(c.dati.membri.length, 21,
      'attesi 21 soci, trovati ' + c.dati.membri.length);
    NOMI_REALI.forEach((n) => assert.ok(c.perNome[n], 'socio mancante: ' + n));
    c.dati.membri.forEach((m) => {
      assert.strictEqual(m.demo, false, 'socio marcato demo: ' + m.cognome);
      assert.strictEqual(m.attivo, true, 'socio non attivo: ' + m.cognome);
    });
    assert.strictEqual(c.dati.squadre.length, 1);
    assert.strictEqual(c.dati.squadre[0].nome, 'Adrenalina');
    assert.strictEqual(c.dati.squadre[0].demo, false, 'squadra marcata demo');
    assert.strictEqual(c.dati.stagioni.length, 1);
    assert.strictEqual(c.dati.stagioni[0].nome, '2026/2027');
    assert.strictEqual(c.dati.stagioni[0].demo, false, 'stagione marcata demo');
    assert.strictEqual(c.dati.stagioni[0].quotaAnnualePredefinitaCent, 24000);
    c.dom.window.close();
  });

  await prova('Y2. Tre amministratori, tutti gli altri membri', async () => {
    const c = await appReale();
    AMMINISTRATORI.forEach((n) => {
      assert.strictEqual(c.perNome[n].livelloAccessoApp, 'AMMINISTRATORE',
        n + ' non e\' amministratore');
    });
    NOMI_REALI.filter((n) => AMMINISTRATORI.indexOf(n) === -1).forEach((n) => {
      assert.strictEqual(c.perNome[n].livelloAccessoApp, 'MEMBRO',
        n + ' dovrebbe essere MEMBRO');
    });
    const amministratori = c.dati.membri
      .filter((m) => m.livelloAccessoApp === 'AMMINISTRATORE').length;
    assert.strictEqual(amministratori, 3, 'amministratori: ' + amministratori);
    const gestori = c.dati.membri.filter((m) => m.livelloAccessoApp === 'GESTORE').length;
    assert.strictEqual(gestori, 0, 'assegnato un livello GESTORE non richiesto');
    c.dom.window.close();
  });

  await prova('Y3. Caposquadra + Canaro per Nolli, Malcotti e Zanotti', async () => {
    const c = await appReale();
    const idStagione = c.dati.stagioni[0].id;
    const perMembro = {};
    c.dati.iscrizioni.forEach((i) => {
      if (i.stagioneId === idStagione) perMembro[i.membroId] = i;
    });
    CON_DUE_RUOLI.forEach((n) => {
      const isc = perMembro[c.perNome[n].id];
      assert.ok(isc, 'iscrizione mancante per ' + n);
      assert.strictEqual(isc.ruoliVenatori.slice().sort().join(','), 'CANARO,CAPOSQUADRA',
        n + ' non ha CAPOSQUADRA + CANARO: ' + isc.ruoliVenatori.join(','));
    });
    NOMI_REALI.filter((n) => CON_DUE_RUOLI.indexOf(n) === -1).forEach((n) => {
      const isc = perMembro[c.perNome[n].id];
      assert.strictEqual(isc.ruoliVenatori.join(','), 'POSTAIOLO',
        n + ' dovrebbe essere solo POSTAIOLO');
    });
    c.dom.window.close();
  });

  await prova('Y4. 21 iscrizioni reali con le quote fornite', async () => {
    const c = await appReale();
    assert.strictEqual(c.dati.iscrizioni.length, 21);
    c.dati.iscrizioni.forEach((i) => {
      assert.strictEqual(i.quotaAnnualePrevistaCent, 24000, 'quota prevista errata');
    });
    const pagate = ['Pier Nolli', 'Luca Malcotti', 'Roberto Dido',
      'Cristian Cerlini', 'Adriano De Giorgis'];
    const perMembro = {};
    c.dati.iscrizioni.forEach((i) => { perMembro[i.membroId] = i; });
    pagate.forEach((n) => {
      assert.strictEqual(perMembro[c.perNome[n].id].quotaVersataCent, 24000,
        n + ' dovrebbe risultare in regola');
    });
    NOMI_REALI.filter((n) => pagate.indexOf(n) === -1).forEach((n) => {
      assert.strictEqual(perMembro[c.perNome[n].id].quotaVersataCent, 0,
        n + ': quota versata inventata');
    });
    c.dom.window.close();
  });

  await prova('Y5. I dati non forniti restano vuoti: nulla e\' stato inventato', async () => {
    const c = await appReale();
    // date di nascita: solo le due note
    const conNascita = c.dati.membri.filter((m) => m.dataNascita);
    assert.strictEqual(conNascita.length, 2,
      'date di nascita presenti: ' + conNascita.map((m) => m.cognome).join(', '));
    assert.strictEqual(c.perNome['Stefano Bianchi'].dataNascita, '1975-05-27');
    assert.strictEqual(c.perNome['Luca Malcotti'].dataNascita, '1975-01-07');

    // telefoni: solo i sei noti
    const conTelefono = c.dati.membri.filter((m) => m.telefono);
    assert.strictEqual(conTelefono.length, 6,
      'telefoni presenti: ' + conTelefono.map((m) => m.cognome).join(', '));
    assert.strictEqual(c.perNome['Stefano Bianchi'].telefono, '347-6986663');
    assert.strictEqual(c.perNome['Cristian Cerlini'].telefono, '333-7772356');

    // porto d'armi: solo le sei scadenze note
    const conPorto = c.dati.membri.filter((m) => m.scadenzaPortoArmi);
    assert.strictEqual(conPorto.length, 6,
      'scadenze presenti: ' + conPorto.map((m) => m.cognome).join(', '));
    assert.strictEqual(c.perNome['Pier Nolli'].scadenzaPortoArmi, '2026-08-20');
    assert.strictEqual(c.perNome['Cristian Cerlini'].scadenzaPortoArmi, '2029-06-26');

    // per tutti gli altri i campi sono null, non stringhe vuote inventate
    ['Antonio Rinaldi', 'Renato Borri', 'Alessandro Zanetta'].forEach((n) => {
      assert.strictEqual(c.perNome[n].dataNascita, null, n + ': nascita inventata');
      assert.strictEqual(c.perNome[n].telefono, null, n + ': telefono inventato');
      assert.strictEqual(c.perNome[n].scadenzaPortoArmi, null, n + ': porto inventato');
    });
    c.dom.window.close();
  });

  await prova('Y6. I dati di caccia restano fittizi e riferiti ai soci reali', async () => {
    const c = await appReale();
    const idReali = {};
    c.dati.membri.forEach((m) => { idReali[m.id] = true; });

    ['giornate', 'presenze', 'abbattimenti', 'controlliSanitari'].forEach((n) => {
      assert.ok(c.dati[n].length > 0, 'nessun dato dimostrativo in ' + n);
      c.dati[n].forEach((r) => {
        assert.strictEqual(r.demo, true, 'record non marcato demo in ' + n);
      });
    });

    // ogni riferimento a una persona punta a un socio reale esistente
    c.dati.giornate.forEach((g) => {
      if (g.capocacciaMembroId) {
        assert.ok(idReali[g.capocacciaMembroId], 'capocaccia inesistente');
      }
    });
    c.dati.presenze.forEach((p) => assert.ok(idReali[p.membroId], 'presenza orfana'));
    c.dati.abbattimenti.forEach((a) => assert.ok(idReali[a.tiratoreMembroId], 'tiratore orfano'));

    // e il backup resta valido
    const b = await c.A.core.backup.costruisciBackup();
    const err = c.A.core.backup.validaBackup(b);
    assert.strictEqual(err.length, 0, 'dati non validi: ' + err.join(' | '));
    c.dom.window.close();
  });

  await prova('Y7. L\'elenco soci mostra i 21 nomi reali', async () => {
    const c = await appReale();
    await H.vaiA(c.dom, '#/soci', 'Aggiungi socio');
    const t = c.dom.window.document.body.textContent;
    NOMI_REALI.forEach((n) => assert.ok(t.includes(n), 'nome non in elenco: ' + n));
    assert.ok(t.includes('Caposquadra / Canaro'), 'ruoli doppi non mostrati');
    c.dom.window.close();
  });

  // ---------------------------------------------------------------- integrità modello
  console.log('\n[Integrità del modello]');
  await prova('M1. Nessun campo ridondante dataCreazione, solo creatoIl/aggiornatoIl', async () => {
    const d = await leggiTutto(dom);
    ['squadre', 'stagioni', 'membri', 'iscrizioni'].forEach((n) => {
      d[n].forEach((r) => {
        assert.ok(!('dataCreazione' in r), 'dataCreazione ancora presente in ' + n);
        assert.ok(r.creatoIl, 'creatoIl mancante in ' + n);
        assert.ok(r.aggiornatoIl, 'aggiornatoIl mancante in ' + n);
      });
    });
  });

  await prova('M2. Ruoli e ospite solo sulle iscrizioni, livello accesso solo sui membri', async () => {
    const d = await leggiTutto(dom);
    d.membri.forEach((m) => {
      assert.ok(!('ruoloVenatorio' in m) && !('ruoliVenatori' in m), 'ruoli sul membro');
      assert.ok(!('ospite' in m), 'ospite sul membro');
      assert.ok(m.livelloAccessoApp, 'livello accesso mancante sul membro');
    });
    d.iscrizioni.forEach((i) => {
      assert.ok(Array.isArray(i.ruoliVenatori) && i.ruoliVenatori.length, 'ruoli mancanti');
      assert.strictEqual(typeof i.ospite, 'boolean');
      assert.ok(!('livelloAccessoApp' in i), 'livello accesso sull\'iscrizione');
    });
  });

  await prova('M3. "OSPITE" non è più un ruolo venatorio', async () => {
    const codici = dom.window.App.costanti.RUOLI_VENATORI.map((r) => r.codice);
    assert.strictEqual(codici.indexOf('OSPITE'), -1, 'OSPITE ancora fra i ruoli');
    assert.strictEqual(codici.join(','), ['CAPOSQUADRA', 'VICE_CAPOSQUADRA', 'CANARO',
      'POSTAIOLO', 'CACCIATORE', 'MEMBRO_SQUADRA'].join(','));
    assert.strictEqual(dom.window.App.costanti.ruoloValido('OSPITE'), false);
  });

  await prova('M4. Indice by_stagione_ruolo rimosso; una sola iscrizione per stagione+membro',
    async () => {
      const s = dom.window.App.data.schema;
      const nomiIndici = s.stores.filter((x) => x.nome === 'iscrizioni')[0]
        .indici.map((i) => i.nome);
      assert.strictEqual(nomiIndici.indexOf('by_stagione_ruolo'), -1,
        'by_stagione_ruolo ancora presente');
      const d = await leggiTutto(dom);
      const visti = {};
      d.iscrizioni.forEach((i) => {
        const k = i.stagioneId + '|' + i.membroId;
        assert.ok(!visti[k], 'iscrizione duplicata per stagione+membro');
        visti[k] = true;
      });
    });

  await prova('M7. onupgradeneeded usa una scaletta incrementale, non uno switch', async () => {
    const fs = require('fs');
    const db = fs.readFileSync(require('path').join(H.RADICE, 'db.js'), 'utf8');
    assert.ok(/if\s*\(\s*vecchia\s*<\s*1\s*\)/.test(db),
      'manca il blocco "if (vecchia < 1)"');
    assert.strictEqual(db.indexOf('switch'), -1, 'switch ancora presente in db.js');
    assert.strictEqual(db.indexOf('case 0'), -1, 'case 0 ancora presente in db.js');
    assert.ok(/if\s*\(\s*vecchia\s*<\s*2\s*\)/.test(db), 'manca il blocco "if (vecchia < 2)"');
    assert.ok(/if\s*\(\s*vecchia\s*<\s*3\s*\)/.test(db), 'manca il blocco "if (vecchia < 3)"');
    assert.ok(/if\s*\(\s*vecchia\s*<\s*4\s*\)/.test(db), 'manca il blocco "if (vecchia < 4)"');
    assert.ok(db.includes('vecchia < 5'), 'pattern per le versioni future non documentato');
  });

  await prova('M8. Un database creato da zero riceve tutti gli store dello schema', async () => {
    const discoNuovo = H.nuovoDisco();
    const d9 = await H.avviaApp(discoNuovo);
    const idb = await d9.window.App.data.db.apri();
    const attesi = d9.window.App.data.schema.nomiStore;
    attesi.forEach((n) => {
      assert.ok(idb.objectStoreNames.contains(n), 'store mancante alla creazione: ' + n);
    });
    assert.strictEqual(idb.version, d9.window.App.data.schema.dbVersion);
    d9.window.close();
  });

  await prova('M5. Nessun modulo ES: index.html carica solo script classici', async () => {
    const fs = require('fs');
    const html = fs.readFileSync(require('path').join(H.RADICE, 'index.html'), 'utf8');
    assert.strictEqual(html.indexOf('type="module"'), -1, 'trovato type="module"');
    assert.strictEqual(html.indexOf('import '), -1, 'trovato un import ES');
    const tag = html.match(/<script src="([^"]+)"/g) || [];
    assert.ok(tag.length >= 20, 'script attesi non trovati');
    tag.forEach((t) => {
      const f = t.match(/src="([^"]+)"/)[1];
      assert.ok(fs.existsSync(require('path').join(H.RADICE, f)), 'file mancante: ' + f);
    });
  });

  await prova('M6. Nessun modulo futuro implementato per errore', async () => {
    const fs = require('fs');
    const cp = require('child_process');
    const elenco = cp.execSync('find . -maxdepth 1 -name "*.js" -not -name "esegui.js" -not -name "harness.js"',
      { cwd: H.RADICE }).toString().trim().split('\n');
    // Giornate, presenze e abbattimenti appartengono ai Blocchi 2 e 3.
    // Restano vietati i moduli dei blocchi successivi.
    const vietate = ['lavorazione', 'macellazione', 'lotto',
      'carne', 'vendit', 'contabil', 'serviceWorker', 'manifest', 'firebase', 'supabase',
      'localStorage', 'sessionStorage', 'fetch('];
    // I commenti descrivono anche i moduli futuri: qui interessa il CODICE.
    function senzaCommenti(src) {
      return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').map((r) => r.replace(/\/\/.*$/, ' ')).join('\n');
    }
    elenco.forEach((f) => {
      const testo = senzaCommenti(
        fs.readFileSync(require('path').join(H.RADICE, f), 'utf8')).toLowerCase();
      vietate.forEach((v) => {
        assert.strictEqual(testo.indexOf(v.toLowerCase()), -1,
          'trovato "' + v + '" nel codice di ' + f);
      });
    });
  });

  // ---------------------------------------------------------------- riepilogo
  const falliti = risultati.filter((r) => r.esito !== 'OK');
  console.log('\n=== RIEPILOGO ===');
  console.log('Eseguiti: ' + risultati.length + '   OK: ' +
    (risultati.length - falliti.length) + '   Falliti: ' + falliti.length);
  if (falliti.length) {
    falliti.forEach((f) => console.log('  - ' + f.nome + ': ' + f.nota));
  }
  if (domCorrente) domCorrente.window.close();
  process.exit(falliti.length ? 1 : 0);
})();
