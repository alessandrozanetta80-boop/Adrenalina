(function (global) {
  'use strict';
  var App = global.App;
  App.ui = App.ui || {};

  var ROTTE = [
    { re: /^#\/accesso$/,                    vista: 'accesso' },
    { re: /^#\/accessi$/,                    vista: 'gestioneAccessi' },
    { re: /^#\/configurazione$/,             vista: 'configurazione' },
    { re: /^#\/home$/,                       vista: 'home' },
    { re: /^#\/soci$/,                       vista: 'soci' },
    { re: /^#\/socio\/nuovo$/,               vista: 'formSocio', params: function () { return {}; } },
    { re: /^#\/socio\/([^/]+)\/modifica$/,   vista: 'formSocio', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/socio\/([^/]+)$/,             vista: 'schedaSocio', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornate$/,                   vista: 'giornate' },
    { re: /^#\/giornata\/nuova$/,            vista: 'formGiornata', params: function () { return {}; } },
    { re: /^#\/giornata\/nuova\/(\d{4}-\d{2}-\d{2})$/, vista: 'formGiornata', params: function (m) { return { data: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)\/modifica$/, vista: 'formGiornata', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)\/presenze$/, vista: 'presenze',     params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)$/,          vista: 'schedaGiornata', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/abbattimenti$/,               vista: 'abbattimenti' },
    { re: /^#\/capo\/nuovo$/,                vista: 'formCapo', params: function () { return {}; } },
    { re: /^#\/capo\/nuovo\/([^/]+)$/,       vista: 'formCapo', params: function (m) { return { giornataId: m[1] }; } },
    { re: /^#\/capo\/([^/]+)\/modifica$/,    vista: 'formCapo', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/capo\/([^/]+)\/sanitario$/,   vista: 'formSanitario', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/capo\/([^/]+)$/,              vista: 'schedaCapo', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)\/carne\/vendita$/, vista: 'formVendita', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)\/carne$/,   vista: 'carneGiornata', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/carne\/ritiro$/,              vista: 'formRitiro' },
    { re: /^#\/carne$/,                      vista: 'carneStagione' },
    { re: /^#\/sincronizzazione$/,           vista: 'sincronizzazione' },
    { re: /^#\/calendario$/,                 vista: 'calendarioConfig' },
    { re: /^#\/stagioni$/,                   vista: 'stagioni' },
    { re: /^#\/backup$/,                     vista: 'backup' }
  ];

  function vai(hash) {
    if (global.location.hash === hash) disegna();
    else global.location.hash = hash;
  }

  // Rotte raggiungibili anche senza nessuna squadra in archivio.
  var ROTTE_SENZA_SQUADRA = ['configurazione', 'backup', 'accesso'];

  // Schermate riservate a chi puo' modificare: form di inserimento e
  // correzione, configurazione, backup, gestione accessi, strumenti
  // di sincronizzazione.
  // Le schermate che servono a creare o correggere qualcosa. Restano
  // fuori la configurazione iniziale e il backup, che a un lettore
  // servono comunque: la prima e' la schermata di primo avvio,
  // il secondo gli permette di esportare i dati che vede.
  var VISTE_DI_MODIFICA = [
    'formSocio', 'formGiornata', 'formCapo', 'formSanitario',
    'formVendita', 'formRitiro', 'carneGiornata', 'calendarioConfig',
    'gestioneAccessi', 'sincronizzazione', 'stagioni'
  ];

  // A quale scheda della barra bassa appartiene ogni vista.
  var TAB = {
    home: 'home', configurazione: 'home',
    giornate: 'giornate', schedaGiornata: 'giornate', formGiornata: 'giornate',
    presenze: 'giornate', carneGiornata: 'giornate', formVendita: 'giornate',
    carneStagione: 'home', formRitiro: 'home',
    abbattimenti: 'capi', schedaCapo: 'capi', formCapo: 'capi', formSanitario: 'capi',
    soci: 'squadra', schedaSocio: 'squadra', formSocio: 'squadra',
    stagioni: 'home', backup: 'home', calendarioConfig: 'giornate',
    sincronizzazione: 'home',
    accesso: '', gestioneAccessi: 'home'
  };

  function evidenziaTab(nomeVista) {
    if (typeof document === 'undefined' || !document) return;
    var barra = document.getElementById('barra-bassa');
    if (!barra) return;
    // Sulla schermata di accesso non c'e' niente da navigare.
    barra.classList.toggle('nascosta', nomeVista === 'accesso');
    if (!barra) return;
    var attivo = TAB[nomeVista] || '';
    Array.prototype.forEach.call(barra.querySelectorAll('button'), function (b) {
      var suo = b.getAttribute('data-tab') === attivo;
      b.classList.toggle('attivo', suo);
      b.setAttribute('aria-current', suo ? 'page' : 'false');
    });
  }

  function disegnaRotta(nomeVista, params) {
    evidenziaTab(nomeVista);
    var vista = App.ui.viste[nomeVista];
    return Promise.resolve(vista.render(params)).catch(function (e) {
      if (global.console) global.console.error(e);
      App.ui.componenti.erroreSchermo('Errore: ' + e.message);
    });
  }

  // I disegni vengono messi in fila: un render lento non deve piu' arrivare
  // dopo quello successivo e sovrascrivere la schermata giusta.
  var inCorso = Promise.resolve();

  function disegna() {
    inCorso = inCorso.then(disegnaOra, disegnaOra);
    return inCorso;
  }

  function disegnaOra() {
    // La finestra puo' essere stata chiusa mentre un disegno era in
    // coda: in quel caso non c'e' piu' niente da disegnare.
    if (typeof document === 'undefined' || !document || !document.body) return;
    var hash = global.location.hash || '#/home';
    var rotta = null, m = null;
    for (var i = 0; i < ROTTE.length; i++) {
      m = hash.match(ROTTE[i].re);
      if (m) { rotta = ROTTE[i]; break; }
    }
    if (!rotta) return vai('#/home');

    var params = rotta.params ? rotta.params(m) : {};

    // Chi ha accesso in sola lettura puo' consultare tutto, ma le
    // schermate che servono a creare, modificare o amministrare non
    // deve poterle nemmeno aprire scrivendo l'indirizzo a mano.
    if (App.core.accesso.attivo() && App.core.accesso.lettore &&
        App.core.accesso.lettore() &&
        VISTE_DI_MODIFICA.indexOf(rotta.vista) !== -1) {
      // Si mostra la Home senza rimbalzare l'indirizzo: cambiare hash
      // qui dentro farebbe ripartire il giro da capo.
      App.ui.componenti.toast('Il tuo accesso è in sola lettura.', 'errore');
      return disegnaRotta('home', {});
    }

    // Se l'accesso e' richiesto e nessuno ha fatto il login, si vede
    // solo la schermata di accesso. Con Firebase non configurato questa
    // condizione non scatta mai e l'app funziona come sempre.
    var A = App.core.accesso;
    if (A && A.attivo() && !A.autorizzato()) {
      // Non ancora entrato, oppure entrato ma non in elenco: in entrambi
      // i casi si vede solo la schermata di accesso, che dira' quale
      // dei due casi e'.
      if (rotta.vista !== 'accesso') return vai('#/accesso');
      return disegnaRotta('accesso', {});
    }
    // Gia' dentro e autorizzato: la schermata di accesso non serve piu'.
    if (A && A.attivo() && A.autorizzato() && rotta.vista === 'accesso') {
      return vai('#/home');
    }

    // Senza squadra l'app non ha dati su cui lavorare: si va alla
    // configurazione iniziale invece di mostrare schermate vuote.
    if (ROTTE_SENZA_SQUADRA.indexOf(rotta.vista) !== -1) {
      return disegnaRotta(rotta.vista, params);
    }
    return App.core.squadra.esisteSquadra().then(function (ci) {
      if (!ci) return vai('#/configurazione');
      return disegnaRotta(rotta.vista, params);
    }).catch(function (e) {
      if (global.console) global.console.error(e);
      App.ui.componenti.erroreSchermo('Errore: ' + e.message);
    });
  }

  // Delegazione unica per tutti i pulsanti di navigazione.
  function avvia() {
    // Una sola delegazione per tutti gli elementi con data-vai, barra bassa
    // compresa: due gestori sullo stesso tocco facevano navigare due volte.
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== document.body) {
        if (el.getAttribute && el.getAttribute('data-vai')) {
          e.preventDefault();
          vai(el.getAttribute('data-vai'));
          return;
        }
        el = el.parentNode;
      }
    });
    global.addEventListener('hashchange', disegna);
    if (!global.location.hash) global.location.hash = '#/home';
    else disegna();
  }

  App.ui.router = { avvia: avvia, vai: vai, disegna: disegna };
})(typeof window !== 'undefined' ? window : globalThis);
