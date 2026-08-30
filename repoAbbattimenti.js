(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  App.data.abbattimenti = {
    tutti: function () { return App.data.repo.getAll('abbattimenti'); },
    perId: function (id) { return App.data.repo.get('abbattimenti', id); },
    perStagione: function (stagioneId) {
      return App.data.repo.getPerIndice('abbattimenti', 'by_stagione', stagioneId);
    },
    perGiornata: function (giornataId) {
      return App.data.repo.getPerIndice('abbattimenti', 'by_giornata', giornataId);
    },
    perTiratore: function (membroId) {
      return App.data.repo.getPerIndice('abbattimenti', 'by_tiratore', membroId);
    },
    perStagioneECodice: function (stagioneId, codiceCapo) {
      return App.data.repo.getPerIndice('abbattimenti', 'by_stagione_codice',
        [stagioneId, codiceCapo]).then(function (r) { return r[0] || null; });
    },
    salva: function (abbattimento) {
      return App.data.repo.scrivi('abbattimenti', function (t) {
        return t.put('abbattimenti', App.data.repo.timbraModifica(abbattimento));
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
