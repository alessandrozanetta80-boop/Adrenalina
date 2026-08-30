(function (global) {
  'use strict';
  var App = global.App;
  App.ui = App.ui || {};

  var ROTTE = [
    { re: /^#\/configurazione$/,             vista: 'configurazione' },
    { re: /^#\/home$/,                       vista: 'home' },
    { re: /^#\/soci$/,                       vista: 'soci' },
    { re: /^#\/socio\/nuovo$/,               vista: 'formSocio', params: function () { return {}; } },
    { re: /^#\/socio\/([^/]+)\/modifica$/,   vista: 'formSocio', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/socio\/([^/]+)$/,             vista: 'schedaSocio', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornate$/,                   vista: 'giornate' },
    { re: /^#\/giornata\/nuova$/,            vista: 'formGiornata', params: function () { return {}; } },
    { re: /^#\/giornata\/([^/]+)\/modifica$/, vista: 'formGiornata', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)\/presenze$/, vista: 'presenze',     params: function (m) { return { id: m[1] }; } },
    { re: /^#\/giornata\/([^/]+)$/,          vista: 'schedaGiornata', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/abbattimenti$/,               vista: 'abbattimenti' },
    { re: /^#\/capo\/nuovo$/,                vista: 'formCapo', params: function () { return {}; } },
    { re: /^#\/capo\/nuovo\/([^/]+)$/,       vista: 'formCapo', params: function (m) { return { giornataId: m[1] }; } },
    { re: /^#\/capo\/([^/]+)\/modifica$/,    vista: 'formCapo', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/capo\/([^/]+)\/sanitario$/,   vista: 'formSanitario', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/capo\/([^/]+)$/,              vista: 'schedaCapo', params: function (m) { return { id: m[1] }; } },
    { re: /^#\/stagioni$/,                   vista: 'stagioni' },
    { re: /^#\/backup$/,                     vista: 'backup' }
  ];

  function vai(hash) {
    if (global.location.hash === hash) disegna();
    else global.location.hash = hash;
  }

  // Rotte raggiungibili anche senza nessuna squadra in archivio.
  var ROTTE_SENZA_SQUADRA = ['configurazione', 'backup'];

  function disegnaRotta(nomeVista, params) {
    var vista = App.ui.viste[nomeVista];
    return Promise.resolve(vista.render(params)).catch(function (e) {
      if (global.console) global.console.error(e);
      App.ui.componenti.erroreSchermo('Errore: ' + e.message);
    });
  }

  function disegna() {
    var hash = global.location.hash || '#/home';
    var rotta = null, m = null;
    for (var i = 0; i < ROTTE.length; i++) {
      m = hash.match(ROTTE[i].re);
      if (m) { rotta = ROTTE[i]; break; }
    }
    if (!rotta) return vai('#/home');

    var params = rotta.params ? rotta.params(m) : {};

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
