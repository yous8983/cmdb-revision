/* Moteur de quiz — QCM avec réponses multiples possibles.
   Dépend de window.Progress et des helpers exposés par app.js (window.App). */
(function () {
  'use strict';

  var state = null;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort(), sb = b.slice().sort();
    for (var i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  }

  function el(tag, attrs, children) { return window.App.el(tag, attrs, children); }

  /** Écran de démarrage : choix du thème et du nombre de questions. */
  function renderStart(root) {
    var data = window.App.data;
    root.innerHTML = '';
    if (!data.questions.length) {
      root.appendChild(window.App.emptyState('✅', 'Aucune question pour le moment.', 'Les questions seront ajoutées au fil des séries de captures.'));
      return;
    }
    var select = el('select', { id: 'quiz-theme', 'aria-label': 'Thème du quiz' });
    select.appendChild(el('option', { value: '' }, 'Tous les thèmes (' + data.questions.length + ')'));
    data.themes.forEach(function (t) {
      var n = data.questions.filter(function (q) { return q.theme === t.id; }).length;
      if (n) select.appendChild(el('option', { value: t.id }, t.titre + ' (' + n + ')'));
    });
    var count = el('select', { id: 'quiz-count', 'aria-label': 'Nombre de questions' });
    [10, 20, 40, 0].forEach(function (n) {
      count.appendChild(el('option', { value: String(n) }, n ? n + ' questions' : 'Toutes les questions'));
    });
    var onlyWrong = el('select', { id: 'quiz-mode', 'aria-label': 'Mode' });
    onlyWrong.appendChild(el('option', { value: 'all' }, 'Toutes les questions'));
    onlyWrong.appendChild(el('option', { value: 'wrong' }, 'Seulement mes erreurs / non vues'));

    var start = el('button', { class: 'btn primary', type: 'button' }, 'Commencer');
    start.addEventListener('click', function () {
      begin(root, select.value, parseInt(count.value, 10), onlyWrong.value);
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', null, 'Nouveau quiz'),
      el('label', { class: 'field' }, [select]),
      el('label', { class: 'field' }, [count]),
      el('label', { class: 'field' }, [onlyWrong]),
      el('div', { class: 'btn-row' }, [start])
    ]));
  }

  function begin(root, themeId, n, mode) {
    var pool = window.App.data.questions.filter(function (q) { return !themeId || q.theme === themeId; });
    if (mode === 'wrong') {
      pool = pool.filter(function (q) {
        var p = window.Progress.getQuestion(q.id);
        return !p || p.dernier === false;
      });
    }
    if (!pool.length) {
      root.innerHTML = '';
      root.appendChild(window.App.emptyState('🎉', 'Aucune question à revoir dans cette sélection.', ''));
      var back = el('button', { class: 'btn', type: 'button' }, 'Retour');
      back.addEventListener('click', function () { renderStart(root); });
      root.appendChild(el('div', { class: 'btn-row' }, [back]));
      return;
    }
    pool = shuffle(pool);
    if (n > 0) pool = pool.slice(0, n);
    state = { theme: themeId, items: pool, index: 0, score: 0, selected: [], answered: false };
    renderQuestion(root);
  }

  function renderQuestion(root) {
    var q = state.items[state.index];
    var multi = q.bonnes_reponses.length > 1;
    state.selected = [];
    state.answered = false;
    root.innerHTML = '';

    var pct = Math.round((state.index / state.items.length) * 100);
    root.appendChild(el('div', { class: 'progressbar', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
      el('div', { style: 'width:' + pct + '%' })
    ]));

    var card = el('div', { class: 'card', style: 'margin-top:12px' });
    card.appendChild(el('div', { class: 'q-meta' }, [
      el('span', null, 'Question ' + (state.index + 1) + ' / ' + state.items.length),
      el('span', null, 'Score : ' + state.score)
    ]));
    card.appendChild(el('p', { class: 'q-text' }, q.question));
    card.appendChild(el('p', { class: 'q-hint' }, multi ? 'Plusieurs réponses (' + q.bonnes_reponses.length + ')' : 'Une seule réponse'));

    var buttons = q.choix.map(function (c, i) {
      var b = el('button', { class: 'choice', type: 'button', 'aria-pressed': 'false' }, [
        el('span', { 'aria-hidden': 'true' }, multi ? '☐' : '○'), el('span', null, c)
      ]);
      b.addEventListener('click', function () {
        if (state.answered) return;
        if (multi) {
          var k = state.selected.indexOf(i);
          if (k >= 0) state.selected.splice(k, 1); else state.selected.push(i);
        } else {
          state.selected = [i];
        }
        buttons.forEach(function (bb, j) {
          var on = state.selected.indexOf(j) >= 0;
          bb.setAttribute('aria-pressed', on ? 'true' : 'false');
          bb.firstChild.textContent = multi ? (on ? '☑' : '☐') : (on ? '●' : '○');
        });
        validate.disabled = state.selected.length === 0;
      });
      card.appendChild(b);
      return b;
    });

    var feedback = el('div', { class: 'feedback' });
    card.appendChild(feedback);

    var validate = el('button', { class: 'btn primary', type: 'button', disabled: 'disabled' }, 'Valider');
    var row = el('div', { class: 'btn-row' }, [validate]);
    card.appendChild(row);

    validate.addEventListener('click', function () {
      if (state.answered) { next(root); return; }
      state.answered = true;
      var ok = sameSet(state.selected, q.bonnes_reponses);
      if (ok) state.score += 1;
      window.Progress.recordAnswer(q.id, ok);
      buttons.forEach(function (b, i) {
        b.disabled = true;
        var isGood = q.bonnes_reponses.indexOf(i) >= 0;
        var picked = state.selected.indexOf(i) >= 0;
        if (isGood) b.classList.add('correct');
        else if (picked) b.classList.add('wrong');
      });
      feedback.appendChild(el('p', { class: 'verdict ' + (ok ? 'ok' : 'ko') }, ok ? '✔ Bonne réponse' : '✘ Mauvaise réponse'));
      if (q.explication) feedback.appendChild(el('p', null, q.explication));
      var notion = window.App.findNotion(q.notion);
      if (q.analogie || (notion && notion.analogie)) {
        feedback.appendChild(window.App.analogyBlock(notion ? notion.analogie : null, q.analogie));
      }
      validate.textContent = state.index + 1 < state.items.length ? 'Question suivante' : 'Voir le résultat';
      validate.disabled = false;
    });

    root.appendChild(card);
    window.scrollTo(0, 0);
  }

  function next(root) {
    state.index += 1;
    if (state.index < state.items.length) { renderQuestion(root); return; }
    window.Progress.recordQuiz(state.theme, state.score, state.items.length);
    root.innerHTML = '';
    var pct = Math.round((state.score / state.items.length) * 100);
    var again = el('button', { class: 'btn primary', type: 'button' }, 'Nouveau quiz');
    again.addEventListener('click', function () { renderStart(root); });
    root.appendChild(el('div', { class: 'card', style: 'text-align:center' }, [
      el('h3', null, 'Résultat'),
      el('p', { style: 'font-size:2rem;font-weight:700;margin:8px 0' }, state.score + ' / ' + state.items.length),
      el('p', { class: 'muted' }, pct + ' % de bonnes réponses'),
      el('div', { class: 'btn-row' }, [again])
    ]));
  }

  window.Quiz = { render: renderStart };
})();
