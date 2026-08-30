(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};
  App.data.stagioni = {
    tutte: function () { return App.data.repo.getAll('stagioni'); },
    perId: function (id) { return App.data.repo.get('stagioni', id); },
    perSquadra: function (squadraId) {
      return App.data.repo.getPerIndice('stagioni', 'by_squadra', squadraId);
    },
    salva: function (stagione) {
      return App.data.repo.scrivi('stagioni', function (t) {
        return t.put('stagioni', App.data.repo.timbraModifica(stagione));
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
