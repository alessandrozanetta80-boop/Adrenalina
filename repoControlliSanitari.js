(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  App.data.controlliSanitari = {
    tutti: function () { return App.data.repo.getAll('controlliSanitari'); },
    perId: function (id) { return App.data.repo.get('controlliSanitari', id); },
    perAbbattimento: function (abbattimentoId) {
      return App.data.repo.getPerIndice('controlliSanitari', 'by_abbattimento', abbattimentoId)
        .then(function (r) { return r[0] || null; });
    },
    salva: function (controllo) {
      return App.data.repo.scrivi('controlliSanitari', function (t) {
        return t.put('controlliSanitari', App.data.repo.timbraModifica(controllo));
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
