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

var VERSIONE = '0.8.2';
var CACHE = 'adrenalina-' + VERSIONE;

/* ELENCO-INIZIO */
var FILE = [
  './',
  './index.html',
  './favicon-32.png?v=0.8.2',
  './apple-touch-icon-180.png?v=0.8.2',
  './manifest.webmanifest?v=0.8.2',
  './adrenalina-display.woff2?v=0.8.2',
  './base.css?v=0.8.2',
  './layout.css?v=0.8.2',
  './components.css?v=0.8.2',
  './firebase-app-compat.js?v=0.8.2',
  './firebase-auth-compat.js?v=0.8.2',
  './firebase-firestore-compat.js?v=0.8.2',
  './versione.js?v=0.8.2',
  './firebase.js?v=0.8.2',
  './costanti.js?v=0.8.2',
  './accessoService.js?v=0.8.2',
  './id.js?v=0.8.2',
  './idDeterministici.js?v=0.8.2',
  './sincronizzazione.js?v=0.8.2',
  './modalita.js?v=0.8.2',
  './bootstrap.js?v=0.8.2',
  './calendario.js?v=0.8.2',
  './schema.js?v=0.8.2',
  './db.js?v=0.8.2',
  './repo.js?v=0.8.2',
  './adattatoreFirestore.js?v=0.8.2',
  './scrittureCondivise.js?v=0.8.2',
  './repoSquadre.js?v=0.8.2',
  './repoStagioni.js?v=0.8.2',
  './repoMembri.js?v=0.8.2',
  './repoIscrizioni.js?v=0.8.2',
  './repoGiornate.js?v=0.8.2',
  './repoAbbattimenti.js?v=0.8.2',
  './repoControlliSanitari.js?v=0.8.2',
  './repoCarne.js?v=0.8.2',
  './quoteService.js?v=0.8.2',
  './squadraService.js?v=0.8.2',
  './stagioneService.js?v=0.8.2',
  './membroService.js?v=0.8.2',
  './presenzaService.js?v=0.8.2',
  './giornataService.js?v=0.8.2',
  './capoService.js?v=0.8.2',
  './sanitarioService.js?v=0.8.2',
  './calendarioBattuteService.js?v=0.8.2',
  './carneService.js?v=0.8.2',
  './backupService.js?v=0.8.2',
  './gennaio2026.js?v=0.8.2',
  './datiDemo.js?v=0.8.2',
  './componenti.js?v=0.8.2',
  './vistaAccesso.js?v=0.8.2',
  './vistaGestioneAccessi.js?v=0.8.2',
  './vistaConfigurazione.js?v=0.8.2',
  './vistaHome.js?v=0.8.2',
  './vistaSoci.js?v=0.8.2',
  './vistaSchedaSocio.js?v=0.8.2',
  './vistaFormSocio.js?v=0.8.2',
  './vistaGiornate.js?v=0.8.2',
  './vistaFormGiornata.js?v=0.8.2',
  './vistaSchedaGiornata.js?v=0.8.2',
  './vistaPresenze.js?v=0.8.2',
  './vistaAbbattimenti.js?v=0.8.2',
  './vistaFormCapo.js?v=0.8.2',
  './vistaSchedaCapo.js?v=0.8.2',
  './vistaFormSanitario.js?v=0.8.2',
  './vistaCarneGiornata.js?v=0.8.2',
  './vistaFormVendita.js?v=0.8.2',
  './vistaCarneStagione.js?v=0.8.2',
  './vistaProdottiCarne.js?v=0.8.2',
  './vistaCalendarioConfig.js?v=0.8.2',
  './vistaStagioni.js?v=0.8.2',
  './vistaSincronizzazione.js?v=0.8.2',
  './vistaBackup.js?v=0.8.2',
  './router.js?v=0.8.2',
  './app.js?v=0.8.2',
  './icona-192.png?v=0.8.2',
  './icona-512.png?v=0.8.2'
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
