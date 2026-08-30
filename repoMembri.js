(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};
  App.data.membri = {
    tutti: function () { return App.data.repo.getAll('membri'); },
    perId: function (id) { return App.data.repo.get('membri', id); },
    perSquadra: function (squadraId) {
      return App.data.repo.getPerIndice('membri', 'by_squadra', squadraId);
    },
    salva: function (membro) {
      return App.data.repo.scrivi('membri', function (t) {
        return t.put('membri', App.data.repo.timbraModifica(membro));
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
