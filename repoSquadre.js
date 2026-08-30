(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};
  App.data.squadre = {
    tutte: function () { return App.data.repo.getAll('squadre'); },
    perId: function (id) { return App.data.repo.get('squadre', id); },
    salva: function (squadra) {
      return App.data.repo.scrivi('squadre', function (t) {
        return t.put('squadre', App.data.repo.timbraModifica(squadra));
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
