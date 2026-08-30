(function (global) {
  'use strict';
  var App = global.App;
  App.ui = App.ui || {};

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formattaData(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return String(iso);
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function scaduto(iso) {
    if (!iso) return false;
    // Confronto con la data locale del dispositivo, non con UTC.
    return String(iso).slice(0, 10) < App.core.calendario.oggi();
  }

  function badgeQuota(stato) {
    if (!stato) return '<span class="badge">Non iscritto</span>';
    var S = App.costanti.STATO_QUOTA;
    var classe = 'badge';
    if (stato === S.PAGATA) classe += ' badge-ok';
    else if (stato === S.PARZIALE) classe += ' badge-avviso';
    else if (stato === S.NON_PAGATA) classe += ' badge-pericolo';
    return '<span class="' + classe + '">' + esc(App.costanti.etichettaStatoQuota(stato)) + '</span>';
  }

  function badgeAttivo(attivo) {
    return attivo
      ? '<span class="badge badge-verde">Attivo</span>'
      : '<span class="badge">Non attivo</span>';
  }

  function etichettaRuoli(ruoli) {
    if (!ruoli || !ruoli.length) return '—';
    return ruoli.map(App.costanti.etichettaRuolo).join(' / ');
  }

  function nomeCompleto(membro) {
    return ((membro.nome || '') + ' ' + (membro.cognome || '')).trim();
  }

  function toast(messaggio, tipo) {
    var cont = document.getElementById('toast-contenitore');
    if (!cont) return;
    var d = document.createElement('div');
    d.className = 'toast' + (tipo === 'errore' ? ' toast-errore' : '');
    d.textContent = messaggio;
    cont.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); },
      tipo === 'errore' ? 6000 : 3200);
  }

  // Dialogo di conferma. Risolve true/false.
  function conferma(opzioni) {
    return new Promise(function (resolve) {
      var cont = document.getElementById('modale-contenitore');
      var fondo = document.createElement('div');
      fondo.className = 'modale-fondo';
      fondo.setAttribute('role', 'dialog');
      fondo.setAttribute('aria-modal', 'true');
      fondo.innerHTML =
        '<div class="modale">' +
          '<h2>' + esc(opzioni.titolo) + '</h2>' +
          '<p>' + esc(opzioni.testo) + '</p>' +
          (opzioni.elenco && opzioni.elenco.length
            ? '<div class="avviso-box pericolo"><ul>' +
              opzioni.elenco.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') +
              '</ul></div>'
            : '') +
          '<div class="azioni">' +
            '<button class="btn ' + (opzioni.pericolo ? 'btn-pericolo' : 'btn-primario') +
              '" data-azione="si">' + esc(opzioni.conferma || 'Conferma') + '</button>' +
            '<button class="btn btn-fantasma" data-azione="no">' +
              esc(opzioni.annulla || 'Annulla') + '</button>' +
          '</div>' +
        '</div>';

      function chiudi(valore) {
        if (fondo.parentNode) fondo.parentNode.removeChild(fondo);
        document.removeEventListener('keydown', suTasto);
        resolve(valore);
      }
      function suTasto(e) { if (e.key === 'Escape') chiudi(false); }

      fondo.addEventListener('click', function (e) {
        var az = e.target.getAttribute && e.target.getAttribute('data-azione');
        if (az === 'si') chiudi(true);
        else if (az === 'no' || e.target === fondo) chiudi(false);
      });
      document.addEventListener('keydown', suTasto);
      cont.appendChild(fondo);
      var primo = fondo.querySelector('[data-azione="si"]');
      if (primo) primo.focus();
    });
  }

  function intestazione(opzioni) {
    var testa = document.getElementById('intestazione');
    // Sulla Home il nome squadra e' gia' nella testata identitaria:
    // la barra si nasconde per non ripeterlo.
    testa.classList.toggle('nascosta', !!opzioni.nascosta);
    if (opzioni.nascosta) { testa.innerHTML = ''; return; }
    testa.innerHTML =
      '<div class="intestazione-riga">' +
        (opzioni.indietro
          ? '<button class="btn-indietro" id="btn-indietro" aria-label="Indietro">&#8592;</button>'
          : '') +
        '<div>' +
          '<p class="intestazione-titolo">' + esc(opzioni.titolo) + '</p>' +
          (opzioni.sotto ? '<p class="intestazione-sotto">' + esc(opzioni.sotto) + '</p>' : '') +
        '</div>' +
      '</div>';
    var b = document.getElementById('btn-indietro');
    if (b) b.addEventListener('click', function () { App.ui.router.vai(opzioni.indietro); });
  }

  function monta(html) {
    var app = document.getElementById('app');
    app.innerHTML = html;
    app.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    return app;
  }

  function erroreSchermo(messaggio) {
    monta('<div class="avviso-box pericolo">' + esc(messaggio) + '</div>');
  }

  App.ui.componenti = {
    esc: esc,
    formattaData: formattaData,
    scaduto: scaduto,
    badgeQuota: badgeQuota,
    badgeAttivo: badgeAttivo,
    etichettaRuoli: etichettaRuoli,
    nomeCompleto: nomeCompleto,
    toast: toast,
    conferma: conferma,
    intestazione: intestazione,
    monta: monta,
    erroreSchermo: erroreSchermo
  };
})(typeof window !== 'undefined' ? window : globalThis);
