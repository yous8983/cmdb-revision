/* Application : chargement des données, navigation, fiches, flashcards, progression. */
(function () {
  'use strict';

  var data = { themes: [], notions: [], questions: [] };
  var VIEWS = { home: 'CMDB Révision', fiches: 'Fiches', quiz: 'Quiz', flashcards: 'Flashcards', progression: 'Progression' };
  var LAST_VIEW_KEY = 'cmdb-revision:last-view';

  /* ---------- Helpers DOM ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function emptyState(ico, title, text) {
    return el('div', { class: 'empty' }, [
      el('span', { class: 'ico', 'aria-hidden': 'true' }, ico),
      el('p', null, el('strong', null, title)),
      text ? el('p', null, text) : null
    ]);
  }

  function themeTitle(id) {
    var t = data.themes.find(function (x) { return x.id === id; });
    return t ? t.titre : id;
  }

  function findNotion(id) {
    return data.notions.find(function (n) { return n.id === id; }) || null;
  }

  /** Bloc analogie (fiches, dos de flashcard, explication du quiz). */
  function analogyBlock(a, rappel) {
    var box = el('div', { class: 'analogy' });
    box.appendChild(el('p', null, el('strong', null, '💡 Analogie' + (a && a.univers ? ' — ' + a.univers : ''))));
    if (rappel) box.appendChild(el('p', null, rappel));
    if (a) {
      if (a.image && !rappel) box.appendChild(el('p', null, a.image));
      if (a.fonction && !rappel) box.appendChild(el('p', null, [el('em', null, 'Fonction : '), a.fonction]));
      if (a.limite) box.appendChild(el('div', { class: 'limit' }, [el('strong', null, '⚠ Limite : '), a.limite]));
    }
    return box;
  }

  function list(items) {
    return el('ul', null, (items || []).map(function (x) { return el('li', null, x); }));
  }

  function fillThemeSelect(select, allLabel) {
    select.innerHTML = '';
    select.appendChild(el('option', { value: '' }, allLabel));
    data.themes.forEach(function (t) { select.appendChild(el('option', { value: t.id }, t.titre)); });
  }

  /* ---------- Navigation ---------- */
  function go(view) {
    if (!VIEWS[view]) view = 'home';
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    document.querySelectorAll('.tab').forEach(function (t) {
      if (t.dataset.goto === view) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    document.getElementById('page-title').textContent = VIEWS[view];
    document.getElementById('btn-home').hidden = view === 'home';
    try { localStorage.setItem(LAST_VIEW_KEY, view); } catch (e) { /* ignore */ }
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    render(view);
    window.scrollTo(0, 0);
  }

  function render(view) {
    if (view === 'home') renderHome();
    else if (view === 'fiches') renderFiches();
    else if (view === 'quiz') window.Quiz.render(document.getElementById('quiz-root'));
    else if (view === 'flashcards') renderFlashcards();
    else if (view === 'progression') renderProgression();
  }

  /* ---------- Accueil ---------- */
  function renderHome() {
    var row = document.getElementById('home-stats');
    row.innerHTML = '';
    [[data.themes.length, 'thèmes'], [data.notions.length, 'notions'], [data.questions.length, 'questions']].forEach(function (s) {
      row.appendChild(el('div', { class: 'stat' }, [el('b', null, String(s[0])), el('span', null, s[1])]));
    });
  }

  /* ---------- Fiches ---------- */
  function renderFiches() {
    var select = document.getElementById('fiches-theme');
    var root = document.getElementById('fiches-list');
    if (!select.options.length) {
      fillThemeSelect(select, 'Tous les thèmes');
      select.addEventListener('change', renderFiches);
    }
    root.innerHTML = '';
    if (!data.notions.length) {
      root.appendChild(emptyState('📘', 'Aucune fiche pour le moment.', 'Les notions seront ajoutées au fil des séries de captures.'));
      return;
    }
    var theme = data.themes.find(function (t) { return t.id === select.value; });
    if (theme && theme.analogie_fil_rouge) {
      root.appendChild(el('div', { class: 'analogy' }, [
        el('p', null, el('strong', null, '🧵 Fil rouge du thème')),
        el('p', null, theme.analogie_fil_rouge)
      ]));
    }
    data.notions
      .filter(function (n) { return !select.value || n.theme === select.value; })
      .forEach(function (n) {
        var d = el('details', { class: 'card' }, [
          el('summary', null, n.titre),
          el('span', { class: 'tag' }, themeTitle(n.theme)),
          el('p', null, n.definition),
          n.points_cles && n.points_cles.length ? el('h4', null, 'Points clés') : null,
          n.points_cles && n.points_cles.length ? list(n.points_cles) : null,
          n.analogie ? analogyBlock(n.analogie) : null,
          n.pieges_examen && n.pieges_examen.length
            ? el('div', { class: 'traps' }, [el('strong', null, '🎯 Pièges d\'examen'), list(n.pieges_examen)])
            : null,
          n.source ? el('p', { class: 'source' }, 'Source : ' + n.source) : null
        ]);
        root.appendChild(d);
      });
  }

  /* ---------- Flashcards ---------- */
  var flash = { deck: [], index: 0 };

  function renderFlashcards() {
    var select = document.getElementById('flash-theme');
    if (!select.options.length) {
      fillThemeSelect(select, 'Tous les thèmes');
      select.addEventListener('change', function () { flash.index = 0; buildDeck(); drawCard(); });
    }
    buildDeck();
    drawCard();
  }

  function buildDeck() {
    var t = document.getElementById('flash-theme').value;
    var all = data.notions.filter(function (n) { return !t || n.theme === t; });
    // Les cartes "à revoir" et non vues d'abord, les "connues" ensuite.
    flash.deck = all.filter(function (n) { return window.Progress.getFlashcard(n.id) !== 'connue'; })
      .concat(all.filter(function (n) { return window.Progress.getFlashcard(n.id) === 'connue'; }));
    if (flash.index >= flash.deck.length) flash.index = 0;
  }

  function drawCard() {
    var root = document.getElementById('flash-root');
    root.innerHTML = '';
    if (!flash.deck.length) {
      root.appendChild(emptyState('🔁', 'Aucune flashcard pour le moment.', 'Chaque notion ajoutée deviendra une flashcard.'));
      return;
    }
    var n = flash.deck[flash.index];
    var statut = window.Progress.getFlashcard(n.id);
    var card = el('div', { class: 'flashcard', role: 'button', tabindex: '0', 'aria-label': 'Retourner la carte' }, [
      el('div', { class: 'flashcard-inner' }, [
        el('div', { class: 'flash-face flash-front' }, [
          el('span', { class: 'tag' }, themeTitle(n.theme)),
          el('h3', null, n.titre),
          el('p', { class: 'muted' }, 'Touchez pour retourner')
        ]),
        el('div', { class: 'flash-face flash-back' }, [
          el('p', null, n.definition),
          n.analogie ? analogyBlock(n.analogie) : null
        ])
      ])
    ]);
    function flip() { card.classList.toggle('flipped'); }
    card.addEventListener('click', flip);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });

    var prev = el('button', { class: 'btn', type: 'button', 'aria-label': 'Carte précédente' }, '←');
    var redo = el('button', { class: 'btn', type: 'button' }, 'À revoir');
    var known = el('button', { class: 'btn primary', type: 'button' }, 'Je sais');
    var nextB = el('button', { class: 'btn', type: 'button', 'aria-label': 'Carte suivante' }, '→');
    prev.addEventListener('click', function () { flash.index = (flash.index - 1 + flash.deck.length) % flash.deck.length; drawCard(); });
    nextB.addEventListener('click', function () { flash.index = (flash.index + 1) % flash.deck.length; drawCard(); });
    redo.addEventListener('click', function () { window.Progress.setFlashcard(n.id, 'a-revoir'); nextB.click(); });
    known.addEventListener('click', function () { window.Progress.setFlashcard(n.id, 'connue'); nextB.click(); });

    root.appendChild(el('p', { class: 'flash-counter' },
      (flash.index + 1) + ' / ' + flash.deck.length + (statut ? ' · ' + (statut === 'connue' ? '✔ connue' : '↺ à revoir') : '')));
    root.appendChild(card);
    root.appendChild(el('div', { class: 'btn-row' }, [prev, redo, known, nextB]));
  }

  /* ---------- Progression ---------- */
  function renderProgression() {
    var root = document.getElementById('progress-root');
    var p = window.Progress.getAll();
    root.innerHTML = '';

    var answered = data.questions.filter(function (q) { return p.questions[q.id]; });
    var correct = answered.filter(function (q) { return p.questions[q.id].dernier === true; });
    var known = data.notions.filter(function (n) { return p.flashcards[n.id] === 'connue'; });

    var summary = el('div', { class: 'stats-row' }, [
      el('div', { class: 'stat' }, [el('b', null, answered.length + '/' + data.questions.length), el('span', null, 'questions vues')]),
      el('div', { class: 'stat' }, [el('b', null, answered.length ? Math.round(correct.length / answered.length * 100) + ' %' : '—'), el('span', null, 'réussite')]),
      el('div', { class: 'stat' }, [el('b', null, known.length + '/' + data.notions.length), el('span', null, 'cartes sues')])
    ]);
    root.appendChild(summary);

    if (!data.themes.length) {
      root.appendChild(emptyState('📈', 'Pas encore de contenu.', 'La progression par thème apparaîtra ici.'));
    } else {
      var card = el('div', { class: 'card' }, [el('h3', null, 'Par thème')]);
      data.themes.forEach(function (t) {
        var qs = data.questions.filter(function (q) { return q.theme === t.id; });
        var ok = qs.filter(function (q) { return p.questions[q.id] && p.questions[q.id].dernier === true; }).length;
        var pct = qs.length ? Math.round(ok / qs.length * 100) : 0;
        card.appendChild(el('div', { class: 'theme-progress' }, [
          el('div', { class: 'row' }, [el('span', null, t.titre), el('span', null, ok + '/' + qs.length)]),
          el('div', { class: 'progressbar' }, [el('div', { style: 'width:' + pct + '%' })])
        ]));
      });
      root.appendChild(card);
    }

    if (p.quizzes.length) {
      var hist = el('div', { class: 'card' }, [el('h3', null, 'Derniers quiz')]);
      hist.appendChild(list(p.quizzes.slice(-5).reverse().map(function (z) {
        var d = new Date(z.date);
        return d.toLocaleDateString('fr-FR') + ' — ' + (z.theme === 'tous' ? 'Tous les thèmes' : themeTitle(z.theme)) + ' : ' + z.score + '/' + z.total;
      })));
      root.appendChild(hist);
    }

    var reset = el('button', { class: 'btn', type: 'button' }, 'Réinitialiser la progression');
    reset.addEventListener('click', function () {
      if (confirm('Effacer toute la progression ?')) { window.Progress.reset(); renderProgression(); }
    });
    root.appendChild(el('div', { class: 'btn-row' }, [reset]));
  }

  /* ---------- Chargement ---------- */
  function loadJSON(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error(path + ' : HTTP ' + r.status);
      return r.json();
    });
  }

  function init() {
    document.querySelectorAll('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.goto); });
    });
    document.getElementById('btn-home').addEventListener('click', function () { go('home'); });

    Promise.all([loadJSON('data/themes.json'), loadJSON('data/notions.json'), loadJSON('data/questions.json')])
      .then(function (res) {
        data.themes = Array.isArray(res[0]) ? res[0] : [];
        data.notions = Array.isArray(res[1]) ? res[1] : [];
        data.questions = Array.isArray(res[2]) ? res[2] : [];
      })
      .catch(function (e) { console.error('Chargement des données impossible', e); })
      .then(function () {
        var start = location.hash.slice(1);
        go(VIEWS[start] ? start : 'home');
      });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').catch(function (e) { console.warn('SW non enregistré', e); });
      });
    }
  }

  window.App = { data: data, el: el, emptyState: emptyState, analogyBlock: analogyBlock, findNotion: findNotion, themeTitle: themeTitle };
  init();
})();
