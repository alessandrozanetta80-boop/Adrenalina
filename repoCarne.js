(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};
  var R = null;

  function repo() { return App.data.repo; }

  function base(store) {
    return {
      tutti: function () { return repo().getAll(store); },
      perId: function (id) { return repo().get(store, id); },
      salva: function (rec) {
        return repo().scrivi(store, function (t) {
          return t.put(store, repo().timbraModifica(rec));
        });
      }
    };
  }

  App.data.calendari = base('calendariBattuta');
  App.data.calendari.perStagione = function (stagioneId) {
    return repo().getPerIndice('calendariBattuta', 'by_stagione', stagioneId)
      .then(function (r) { return r[0] || null; });
  };

  App.data.configCarne = base('configCarne');
  App.data.configCarne.perStagione = function (stagioneId) {
    return repo().getPerIndice('configCarne', 'by_stagione', stagioneId)
      .then(function (r) { return r[0] || null; });
  };

  App.data.lottiCarne = base('lottiCarne');
  App.data.lottiCarne.perGiornata = function (giornataId) {
    return repo().getPerIndice('lottiCarne', 'by_giornata', giornataId)
      .then(function (r) { return r[0] || null; });
  };
  App.data.lottiCarne.perStagione = function (stagioneId) {
    return repo().getPerIndice('lottiCarne', 'by_stagione', stagioneId);
  };

  App.data.quoteCarne = base('quoteCarne');
  App.data.quoteCarne.perLotto = function (lottoId) {
    return repo().getPerIndice('quoteCarne', 'by_lotto', lottoId);
  };

  App.data.venditeCarne = base('venditeCarne');
  App.data.venditeCarne.perLotto = function (lottoId) {
    return repo().getPerIndice('venditeCarne', 'by_lotto', lottoId);
  };

  App.data.ritiriCarne = base('ritiriCarne');
  App.data.ritiriCarne.perMembro = function (membroId) {
    return repo().getPerIndice('ritiriCarne', 'by_membro', membroId);
  };
  App.data.ritiriCarne.perStagione = function (stagioneId) {
    return repo().getPerIndice('ritiriCarne', 'by_stagione', stagioneId);
  };

  void R;
})(typeof window !== 'undefined' ? window : globalThis);
