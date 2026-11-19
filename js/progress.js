/* Progression — localStorage, chaque accès protégé par try/catch.
   L'app reste utilisable si le stockage est indisponible (navigation privée, quota…). */
(function () {
  'use strict';

  var KEY = 'cmdb-revision:progress';
  var memory = null; // repli en mémoire si localStorage indisponible

  function empty() {
    return { version: 1, questions: {}, flashcards: {}, quizzes: [] };
  }

  function load() {
    if (memory) return memory;
    var data = null;
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    if (!data || typeof data !== 'object') data = empty();
    data.questions = data.questions || {};
    data.flashcards = data.flashcards || {};
    data.quizzes = data.quizzes || [];
    memory = data;
    return memory;
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* stockage indisponible */ }
  }

  /** Enregistre la réponse à une question (correct = booléen). */
  function recordAnswer(questionId, correct) {
    var d = load();
    var q = d.questions[questionId] || { vu: 0, ok: 0, dernier: null };
    q.vu += 1;
    if (correct) q.ok += 1;
    q.dernier = correct;
    d.questions[questionId] = q;
    save();
  }

  /** Enregistre le résultat global d'un quiz. */
  function recordQuiz(theme, score, total) {
    var d = load();
    d.quizzes.push({ theme: theme || 'tous', score: score, total: total, date: new Date().toISOString() });
    if (d.quizzes.length > 100) d.quizzes = d.quizzes.slice(-100);
    save();
  }

  /** Flashcard : 'connue' ou 'a-revoir'. */
  function setFlashcard(notionId, statut) {
    var d = load();
    d.flashcards[notionId] = statut;
    save();
  }

  function getFlashcard(notionId) { return load().flashcards[notionId] || null; }
  function getQuestion(questionId) { return load().questions[questionId] || null; }
  function getAll() { return load(); }

  function reset() {
    memory = empty();
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  window.Progress = {
    recordAnswer: recordAnswer,
    recordQuiz: recordQuiz,
    setFlashcard: setFlashcard,
    getFlashcard: getFlashcard,
    getQuestion: getQuestion,
    getAll: getAll,
    reset: reset
  };
})();
