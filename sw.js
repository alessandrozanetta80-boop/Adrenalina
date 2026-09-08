/* SERVICE WORKER — Adrenalina
 *
 * Serve a una cosa sola: far partire l'app anche senza campo, dopo che e'
 * stata aperta almeno una volta. Non tocca i dati della squadra, che
 * vivono in IndexedDB e nella coda di sincronizzazione.
 *
 * Strategia:
 *   - i file dell'app (js, css, immagini, font) si prendono dalla cache,
 *     perche' portano ?v=versione nell'indirizzo: quando la versione
 *     cambia, cambia l'indirizzo e vengono riscaricati;
 *   - index.html e versione.json si chiedono prima alla rete, cosi' un
 *     aggiornamento arriva subito; se la rete manca si usa la copia.
 *
 * L'ELENCO QUI SOTTO E' GENERATO DALLO SCRIPT DI COSTRUZIONE a partire da
 * index.html. Non modificarlo a mano: un file dimenticato qui vuol dire
 * un'app che offline non parte.
 */

var VERSIONE = '0.8.1';
var CACHE = 'adrenalina-' + VERSIONE;

/* ELENCO-INIZIO */
var FILE = [
  './',
  './index.html',
  './favicon-32.png?v=0.8.1',
  './apple-touch-icon-180.png?v=0.8.1',
  './manifest.webmanifest?v=0.8.1',
  './adrenalina-display.woff2?v=0.8.1',
  './base.css?v=0.8.1',
  './layout.css?v=0.8.1',
  './components.css?v=0.8.1',
  './firebase-app-compat.js?v=0.8.1',
  './firebase-auth-compat.js?v=0.8.1',
  './firebase-firestore-compat.js?v=0.8.1',
  './versione.js?v=0.8.1',
  './firebase.js?v=0.8.1',
  './costanti.js?v=0.8.1',
  './accessoService.js?v=0.8.1',
  './id.js?v=0.8.1',
  './idDeterministici.js?v=0.8.1',
  './sincronizzazione.js?v=0.8.1',
  './modalita.js?v=0.8.1',
  './bootstrap.js?v=0.8.1',
  './calendario.js?v=0.8.1',
  './schema.js?v=0.8.1',
  './db.js?v=0.8.1',
  './repo.js?v=0.8.1',
  './adattatoreFirestore.js?v=0.8.1',
  './scrittureCondivise.js?v=0.8.1',
  './repoSquadre.js?v=0.8.1',
  './repoStagioni.js?v=0.8.1',
  './repoMembri.js?v=0.8.1',
  './repoIscrizioni.js?v=0.8.1',
  './repoGiornate.js?v=0.8.1',
  './repoAbbattimenti.js?v=0.8.1',
  './repoControlliSanitari.js?v=0.8.1',
  './repoCarne.js?v=0.8.1',
  './quoteService.js?v=0.8.1',
  './squadraService.js?v=0.8.1',
  './stagioneService.js?v=0.8.1',
  './membroService.js?v=0.8.1',
  './presenzaService.js?v=0.8.1',
  './giornataService.js?v=0.8.1',
  './capoService.js?v=0.8.1',
  './sanitarioService.js?v=0.8.1',
  './calendarioBattuteService.js?v=0.8.1',
  './carneService.js?v=0.8.1',
  './backupService.js?v=0.8.1',
  './gennaio2026.js?v=0.8.1',
  './datiDemo.js?v=0.8.1',
  './componenti.js?v=0.8.1',
  './vistaAccesso.js?v=0.8.1',
  './vistaGestioneAccessi.js?v=0.8.1',
  './vistaConfigurazione.js?v=0.8.1',
  './vistaHome.js?v=0.8.1',
  './vistaSoci.js?v=0.8.1',
  './vistaSchedaSocio.js?v=0.8.1',
  './vistaFormSocio.js?v=0.8.1',
  './vistaGiornate.js?v=0.8.1',
  './vistaFormGiornata.js?v=0.8.1',
  './vistaSchedaGiornata.js?v=0.8.1',
  './vistaPresenze.js?v=0.8.1',
  './vistaAbbattimenti.js?v=0.8.1',
  './vistaFormCapo.js?v=0.8.1',
  './vistaSchedaCapo.js?v=0.8.1',
  './vistaFormSanitario.js?v=0.8.1',
  './vistaCarneGiornata.js?v=0.8.1',
  './vistaFormVendita.js?v=0.8.1',
  './vistaCarneStagione.js?v=0.8.1',
  './vistaCalendarioConfig.js?v=0.8.1',
  './vistaStagioni.js?v=0.8.1',
  './vistaSincronizzazione.js?v=0.8.1',
  './vistaBackup.js?v=0.8.1',
  './router.js?v=0.8.1',
  './app.js?v=0.8.1',
  './icona-192.png?v=0.8.1',
  './icona-512.png?v=0.8.1'
];
/* ELENCO-FINE */

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll fallisce tutto se un solo file manca: e' voluto, cosi' un
      // elenco sbagliato si nota subito invece di dare un'app monca.
      return cache.addAll(FILE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (chiavi) {
      return Promise.all(chiavi.map(function (k) {
        // Le versioni precedenti non servono piu'.
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function primaLaRete(richiesta) {
  return fetch(richiesta).then(function (risposta) {
    if (risposta && risposta.ok) {
      var copia = risposta.clone();
      caches.open(CACHE).then(function (c) { c.put(richiesta, copia); });
    }
    return risposta;
  }).catch(function () {
    return caches.match(richiesta).then(function (r) {
      return r || caches.match('./index.html');
    });
  });
}

function primaLaCache(richiesta) {
  return caches.match(richiesta).then(function (r) {
    if (r) return r;
    return fetch(richiesta).then(function (risposta) {
      if (risposta && risposta.ok && richiesta.method === 'GET') {
        var copia = risposta.clone();
        caches.open(CACHE).then(function (c) { c.put(richiesta, copia); });
      }
      return risposta;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var richiesta = e.request;
  if (richiesta.method !== 'GET') return;

  var url = new URL(richiesta.url);

  // Solo quello che sta nel nostro sito: le chiamate a Firebase passano
  // dritte, non vanno mai messe in cache.
  if (url.origin !== self.location.origin) return;

  var percorso = url.pathname;
  if (richiesta.mode === 'navigate' ||
      percorso.endsWith('/index.html') ||
      percorso.endsWith('/versione.json')) {
    e.respondWith(primaLaRete(richiesta));
    return;
  }

  e.respondWith(primaLaCache(richiesta));
});
