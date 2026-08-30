(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};
  App.data.iscrizioni = {
    tutte: function () { return App.data.repo.getAll('iscrizioni'); },
    perId: function (id) { return App.data.repo.get('iscrizioni', id); },
    perStagione: function (stagioneId) {
      return App.data.repo.getPerIndice('iscrizioni', 'by_stagione', stagioneId);
    },
    perMembro: function (membroId) {
      return App.data.repo.getPerIndice('iscrizioni', 'by_membro', membroId);
    },
    perStagioneEMembro: function (stagioneId, membroId) {
      return App.data.repo.getPerIndice('iscrizioni', 'by_stagione_membro', [stagioneId, membroId])
        .then(function (r) { return r[0] || null; });
    },
    salva: function (iscrizione) {
      return App.data.repo.scrivi('iscrizioni', function (t) {
        return t.put('iscrizioni', App.data.repo.timbraModifica(iscrizione));
      });
    }
  };

  App.data.meta = {
    tutte: function () { return App.data.repo.getAll('meta'); },
    leggi: function (chiave) {
      return App.data.repo.get('meta', chiave).then(function (r) { return r ? r.valore : null; });
    },
    scrivi: function (chiave, valore) {
      return App.data.repo.scrivi('meta', function (t) {
        return t.put('meta', { chiave: chiave, valore: valore });
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
