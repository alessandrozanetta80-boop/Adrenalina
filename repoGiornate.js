(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  App.data.giornate = {
    tutte: function () { return App.data.repo.getAll('giornate'); },
    perId: function (id) { return App.data.repo.get('giornate', id); },
    perStagione: function (stagioneId) {
      return App.data.repo.getPerIndice('giornate', 'by_stagione', stagioneId);
    },
    perSquadra: function (squadraId) {
      return App.data.repo.getPerIndice('giornate', 'by_squadra', squadraId);
    },
    salva: function (giornata) {
      return App.data.repo.scrivi('giornate', function (t) {
        return t.put('giornate', App.data.repo.timbraModifica(giornata));
      });
    }
  };

  App.data.presenze = {
    tutte: function () { return App.data.repo.getAll('presenze'); },
    perId: function (id) { return App.data.repo.get('presenze', id); },
    perGiornata: function (giornataId) {
      return App.data.repo.getPerIndice('presenze', 'by_giornata', giornataId);
    },
    perMembro: function (membroId) {
      return App.data.repo.getPerIndice('presenze', 'by_membro', membroId);
    },
    perGiornataEMembro: function (giornataId, membroId) {
      return App.data.repo.getPerIndice('presenze', 'by_giornata_membro', [giornataId, membroId])
        .then(function (r) { return r[0] || null; });
    },
    salva: function (presenza) {
      return App.data.repo.scrivi('presenze', function (t) {
        return t.put('presenze', App.data.repo.timbraModifica(presenza));
      });
    },
    elimina: function (id) {
      return App.data.repo.scrivi('presenze', function (t) {
        t.elimina('presenze', id);
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
