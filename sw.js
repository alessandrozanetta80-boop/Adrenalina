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

var VERSIONE = '0.8.0';
var CACHE = 'adrenalina-' + VERSIONE;

/* ELENCO-INIZIO */
var FILE = [
  './',
  './index.html',
  './favicon-32.png?v=0.8.0',
  './apple-touch-icon-180.png?v=0.8.0',
  './manifest.webmanifest?v=0.8.0',
  './adrenalina-display.woff2?v=0.8.0',
  './base.css?v=0.8.0',
  './layout.css?v=0.8.0',
  './components.css?v=0.8.0',
  './firebase-app-compat.js?v=0.8.0',
  './firebase-auth-compat.js?v=0.8.0',
  './firebase-firestore-compat.js?v=0.8.0',
  './versione.js?v=0.8.0',
  './firebase.js?v=0.8.0',
  './costanti.js?v=0.8.0',
  './accessoService.js?v=0.8.0',
  './id.js?v=0.8.0',
  './idDeterministici.js?v=0.8.0',
  './sincronizzazione.js?v=0.8.0',
  './modalita.js?v=0.8.0',
  './bootstrap.js?v=0.8.0',
  './calendario.js?v=0.8.0',
  './schema.js?v=0.8.0',
  './db.js?v=0.8.0',
  './repo.js?v=0.8.0',
  './adattatoreFirestore.js?v=0.8.0',
  './scrittureCondivise.js?v=0.8.0',
  './repoSquadre.js?v=0.8.0',
  './repoStagioni.js?v=0.8.0',
  './repoMembri.js?v=0.8.0',
  './repoIscrizioni.js?v=0.8.0',
  './repoGiornate.js?v=0.8.0',
  './repoAbbattimenti.js?v=0.8.0',
  './repoControlliSanitari.js?v=0.8.0',
  './repoCarne.js?v=0.8.0',
  './quoteService.js?v=0.8.0',
  './squadraService.js?v=0.8.0',
  './stagioneService.js?v=0.8.0',
  './membroService.js?v=0.8.0',
  './presenzaService.js?v=0.8.0',
  './giornataService.js?v=0.8.0',
  './capoService.js?v=0.8.0',
  './sanitarioService.js?v=0.8.0',
  './calendarioBattuteService.js?v=0.8.0',
  './carneService.js?v=0.8.0',
  './backupService.js?v=0.8.0',
  './gennaio2026.js?v=0.8.0',
  './datiDemo.js?v=0.8.0',
  './componenti.js?v=0.8.0',
  './vistaAccesso.js?v=0.8.0',
  './vistaGestioneAccessi.js?v=0.8.0',
  './vistaConfigurazione.js?v=0.8.0',
  './vistaHome.js?v=0.8.0',
  './vistaSoci.js?v=0.8.0',
  './vistaSchedaSocio.js?v=0.8.0',
  './vistaFormSocio.js?v=0.8.0',
  './vistaGiornate.js?v=0.8.0',
  './vistaFormGiornata.js?v=0.8.0',
  './vistaSchedaGiornata.js?v=0.8.0',
  './vistaPresenze.js?v=0.8.0',
  './vistaAbbattimenti.js?v=0.8.0',
  './vistaFormCapo.js?v=0.8.0',
  './vistaSchedaCapo.js?v=0.8.0',
  './vistaFormSanitario.js?v=0.8.0',
  './vistaCarneGiornata.js?v=0.8.0',
  './vistaFormVendita.js?v=0.8.0',
  './vistaCarneStagione.js?v=0.8.0',
  './vistaCalendarioConfig.js?v=0.8.0',
  './vistaStagioni.js?v=0.8.0',
  './vistaSincronizzazione.js?v=0.8.0',
  './vistaBackup.js?v=0.8.0',
  './router.js?v=0.8.0',
  './app.js?v=0.8.0',
  './icona-192.png?v=0.8.0',
  './icona-512.png?v=0.8.0'
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
