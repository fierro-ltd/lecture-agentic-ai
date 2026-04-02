/* =============================================================================
   Lecture Agentic AI — Demo UI
   app.js — vanilla JS, no build tools, no frameworks
   ============================================================================= */

/* ---------------------------------------------------------------------------
   STATE
   --------------------------------------------------------------------------- */
var state = {
  submissions: [],
  selectedId: null,
  currentFilter: 'review',
  demoSubmissionId: null,
  pollTimer: null,
  submitting: false,
};

/* ---------------------------------------------------------------------------
   CONSTANTS
   --------------------------------------------------------------------------- */
var SAMPLE_AI_EVAL = {
  overall_score: 72,
  criterion_scores: { clarity: 22, evidence: 18, analysis: 16, writing: 16 },
  strengths: ['Clear thesis statement', 'Good structural organization', 'Relevant topic selection'],
  weaknesses: ['Limited supporting evidence', 'Needs deeper critical analysis', 'Missing counterarguments'],
  feedback: 'The submission demonstrates understanding of the topic but needs more depth in analysis and evidence.',
};

var SAMPLE_CONTENT = 'This essay examines the impact of artificial intelligence on modern healthcare delivery systems. AI-powered diagnostics have shown promising results in radiology, pathology, and genomics. However, ethical considerations around data privacy, algorithmic bias, and the doctor-patient relationship remain significant challenges that must be addressed before widespread adoption.\n\nThe integration of machine learning algorithms into clinical decision-making has demonstrated accuracy comparable to specialist physicians in areas such as medical imaging analysis. Studies have shown that AI systems can detect certain cancers, retinal diseases, and cardiac abnormalities with sensitivity and specificity exceeding 90%. Despite these advances, the deployment of AI in healthcare raises important questions about accountability, transparency, and the potential for algorithmic bias in diverse patient populations.';

var PIPELINE_STEP_DESCS = {
  submitted: { waiting: '', active: 'Sending to HAST API\u2026', complete: 'Received by HAST' },
  ai:        { waiting: '', active: 'Hermes agent evaluating\u2026', complete: 'Evaluation complete' },
  human:     { waiting: '', active: 'Awaiting reviewer decision\u2026', complete: 'Review submitted' },
  complete:  { waiting: '', active: 'Finalising\u2026', complete: 'Pipeline complete' },
};

/* ---------------------------------------------------------------------------
   UTILITIES
   --------------------------------------------------------------------------- */

function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getConfig() {
  return {
    apiUrl: (document.getElementById('cfgApiUrl').value || '').replace(/\/$/, ''),
    apiKey: document.getElementById('cfgApiKey').value || '',
  };
}

function defaultApiUrl() {
  var proto = window.location.protocol;
  var host  = window.location.hostname;
  var port  = proto === 'https:' ? '8443' : '8000';
  return proto + '//' + host + ':' + port;
}

function debounce(fn, ms) {
  var timer;
  return function () {
    clearTimeout(timer);
    var args = arguments;
    var ctx  = this;
    timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return escHtml(iso);
  }
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '\u2026' : str;
}

/* ---------------------------------------------------------------------------
   API HELPERS
   --------------------------------------------------------------------------- */

function apiFetch(path, opts) {
  var cfg = getConfig();
  var url = cfg.apiUrl + path;
  var options = opts || {};
  options.headers = Object.assign({}, options.headers || {}, {
    'Authorization': 'Bearer ' + cfg.apiKey,
    'Content-Type': 'application/json',
  });

  return fetch(url, options).then(function (res) {
    if (res.ok) {
      if (res.status === 204) return null;
      return res.json();
    }
    return res.text().then(function (body) {
      var detail = body;
      try { detail = JSON.parse(body).detail || body; } catch (e) { /* use raw body */ }
      throw new Error('HTTP ' + res.status + ': ' + detail);
    });
  });
}

/* ---------------------------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------------------------- */

function showSection(id) {
  document.querySelectorAll('.content-section').forEach(function (sec) {
    sec.classList.toggle('active', sec.id === id);
  });

  document.querySelectorAll('.nav-link').forEach(function (btn) {
    var isActive = btn.getAttribute('data-section') === id;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  if (id === 'review') {
    loadReviewQueue(state.currentFilter);
  }
}

/* ---------------------------------------------------------------------------
   CONNECTION TEST
   --------------------------------------------------------------------------- */

function testConnection() {
  var cfg   = getConfig();
  var url   = cfg.apiUrl + '/health';
  var dot   = document.getElementById('statusDot');
  var label = document.getElementById('statusLabel');

  dot.className     = 'status-dot status-dot--checking';
  label.textContent = 'Checking\u2026';

  fetch(url, { method: 'GET' })
    .then(function (res) {
      if (res.ok) {
        dot.className     = 'status-dot status-dot--ok';
        label.textContent = 'Connected';
      } else {
        throw new Error('Status ' + res.status);
      }
    })
    .catch(function () {
      dot.className     = 'status-dot status-dot--error';
      label.textContent = 'Not connected';
    });
}

/* ---------------------------------------------------------------------------
   LIVE DEMO — PIPELINE
   --------------------------------------------------------------------------- */

function updatePipelineStep(stepId, newState) {
  var el = document.getElementById(stepId);
  if (!el) return;

  el.classList.remove('waiting', 'active', 'complete');
  el.classList.add(newState);
  el.setAttribute('data-state', newState);

  var descMap = {
    stepSubmitted: 'descSubmitted',
    stepAI:        'descAI',
    stepHuman:     'descHuman',
    stepComplete:  'descComplete',
  };
  var keyMap = {
    stepSubmitted: 'submitted',
    stepAI:        'ai',
    stepHuman:     'human',
    stepComplete:  'complete',
  };

  var descEl = document.getElementById(descMap[stepId]);
  var key    = keyMap[stepId];
  if (descEl && PIPELINE_STEP_DESCS[key]) {
    descEl.textContent = PIPELINE_STEP_DESCS[key][newState] || '';
  }
}

function resetAllPipelineSteps() {
  ['stepSubmitted', 'stepAI', 'stepHuman', 'stepComplete'].forEach(function (id) {
    updatePipelineStep(id, 'waiting');
  });
}

function renderEvaluation(aiEval) {
  if (!aiEval) return '<p>No evaluation data available.</p>';

  var parts = [];

  // Overall score
  var score = (aiEval.overall_score != null) ? aiEval.overall_score : '\u2014';
  parts.push(
    '<div class="eval-score">' +
    '<span class="eval-score-number">' + escHtml(score) + '</span>' +
    '<span class="eval-score-label"> / 100</span>' +
    '</div>'
  );

  // Criterion scores
  if (aiEval.criterion_scores && typeof aiEval.criterion_scores === 'object') {
    var criteriaRows = '';
    Object.keys(aiEval.criterion_scores).forEach(function (k) {
      criteriaRows +=
        '<li>' +
        '<span class="eval-criterion-name">' + escHtml(k) + '</span>' +
        '<span class="eval-criterion-score">' + escHtml(aiEval.criterion_scores[k]) + '</span>' +
        '</li>';
    });
    parts.push('<div class="eval-criteria"><h3>Criterion Scores</h3><ul class="eval-criteria-list">' + criteriaRows + '</ul></div>');
  }

  // Strengths
  if (aiEval.strengths && aiEval.strengths.length) {
    var strengthItems = '';
    aiEval.strengths.forEach(function (s) {
      strengthItems += '<li>\u2197 ' + escHtml(s) + '</li>';
    });
    parts.push('<div class="eval-list eval-list--strengths"><h3>Strengths</h3><ul>' + strengthItems + '</ul></div>');
  }

  // Weaknesses
  if (aiEval.weaknesses && aiEval.weaknesses.length) {
    var weaknessItems = '';
    aiEval.weaknesses.forEach(function (w) {
      weaknessItems += '<li>\u2198 ' + escHtml(w) + '</li>';
    });
    parts.push('<div class="eval-list eval-list--weaknesses"><h3>Areas for Improvement</h3><ul>' + weaknessItems + '</ul></div>');
  }

  // Feedback
  if (aiEval.feedback) {
    parts.push('<blockquote class="eval-feedback">' + escHtml(aiEval.feedback) + '</blockquote>');
  }

  return parts.join('');
}

function pollPipeline(submissionId) {
  var iterations    = 0;
  var maxIterations = 60;

  function tick() {
    if (iterations >= maxIterations) {
      showToast('Polling timed out after 2 minutes. Check the Review Queue.', 'error');
      stopPolling();
      return;
    }
    iterations++;

    apiFetch('/api/submissions/' + submissionId)
      .then(function (sub) {
        var status = sub.status;

        if (status === 'evaluating') {
          updatePipelineStep('stepAI', 'active');

        } else if (status === 'review') {
          updatePipelineStep('stepAI', 'complete');
          updatePipelineStep('stepHuman', 'active');

          var evalCard = document.getElementById('evalCard');
          var evalBody = document.getElementById('evalCardBody');
          evalCard.hidden = false;
          evalBody.innerHTML = renderEvaluation(sub.ai_evaluation);

          document.getElementById('reviewInline').hidden = false;
          stopPolling();

        } else if (status === 'approved' || status === 'rejected' || status === 'revision_requested') {
          updatePipelineStep('stepHuman', 'complete');
          updatePipelineStep('stepComplete', 'complete');
          showResultCard(sub);
          stopPolling();
        }
      })
      .catch(function (err) {
        showToast('Poll error: ' + err.message, 'error');
        stopPolling();
      });
  }

  stopPolling();
  state.pollTimer = setInterval(tick, 2000);
  tick();
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function showResultCard(sub) {
  var resultCard = document.getElementById('resultCard');
  var resultBody = document.getElementById('resultCardBody');
  var decision   = sub.review_decision || sub.status || 'unknown';

  var labelMap = {
    approved:           'Approved',
    rejected:           'Rejected',
    revision_requested: 'Revision Requested',
  };
  var label = labelMap[decision] || escHtml(decision);

  var parts = [
    '<div class="result-decision result-decision--' + escHtml(decision) + '">' +
    '<span class="result-decision-label">' + label + '</span>' +
    '</div>'
  ];

  if (sub.reviewer_notes) {
    parts.push(
      '<div class="result-notes"><h3>Reviewer Notes</h3>' +
      '<p>' + escHtml(sub.reviewer_notes) + '</p></div>'
    );
  }

  resultBody.innerHTML = parts.join('');
  resultCard.hidden    = false;
  document.getElementById('btnNewDemoWrap').hidden = false;
}

function submitDemo() {
  if (state.submitting) return;

  var content  = document.getElementById('submissionContent').value.trim();
  var criteria = document.getElementById('submissionCriteria').value.trim();
  var type     = document.getElementById('submissionType').value;

  if (!content) {
    showToast('Please enter submission content before submitting.', 'error');
    return;
  }

  state.submitting = true;
  var btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled    = true;
  btnSubmit.textContent = 'Submitting\u2026';

  document.getElementById('demoForm').hidden      = true;
  document.getElementById('pipeline').hidden      = false;
  document.getElementById('evalCard').hidden      = true;
  document.getElementById('reviewInline').hidden  = true;
  document.getElementById('resultCard').hidden    = true;
  document.getElementById('btnNewDemoWrap').hidden = true;

  resetAllPipelineSteps();
  updatePipelineStep('stepSubmitted', 'active');

  var body = {
    submission_type: type,
    entity_id:       'demo-' + Date.now(),
    content:         content,
    criteria:        criteria ? criteria.split(',').map(function (c) { return c.trim(); }) : [],
    ai_evaluation:   SAMPLE_AI_EVAL,
    context:         { source: 'demo-ui' },
  };

  apiFetch('/api/submissions', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
    .then(function (sub) {
      updatePipelineStep('stepSubmitted', 'complete');
      updatePipelineStep('stepAI', 'active');
      state.demoSubmissionId = sub.id;
      state.submitting       = false;
      btnSubmit.disabled     = false;
      btnSubmit.textContent  = 'Submit for AI Evaluation';
      pollPipeline(sub.id);
    })
    .catch(function (err) {
      state.submitting      = false;
      btnSubmit.disabled    = false;
      btnSubmit.textContent = 'Submit for AI Evaluation';
      showToast('Submission failed: ' + err.message, 'error');
      document.getElementById('demoForm').hidden = false;
      document.getElementById('pipeline').hidden = true;
    });
}

function submitReview(decision) {
  if (!state.demoSubmissionId) {
    showToast('No active submission to review.', 'error');
    return;
  }

  var notes       = document.getElementById('reviewNotes').value.trim();
  var btnApprove  = document.getElementById('btnApprove');
  var btnReject   = document.getElementById('btnReject');
  var btnRevision = document.getElementById('btnRevision');

  [btnApprove, btnReject, btnRevision].forEach(function (b) { b.disabled = true; });

  apiFetch('/api/submissions/' + state.demoSubmissionId + '/review', {
    method: 'POST',
    body:   JSON.stringify({ decision: decision, reviewer_notes: notes }),
  })
    .then(function (sub) {
      document.getElementById('reviewInline').hidden = true;
      updatePipelineStep('stepHuman', 'complete');
      updatePipelineStep('stepComplete', 'complete');

      var result = sub || { review_decision: decision, reviewer_notes: notes };
      showResultCard(result);
      showToast('Review submitted: ' + decision.replace(/_/g, ' '), 'success');
    })
    .catch(function (err) {
      showToast('Review failed: ' + err.message, 'error');
      [btnApprove, btnReject, btnRevision].forEach(function (b) { b.disabled = false; });
    });
}

function resetDemo() {
  stopPolling();
  state.demoSubmissionId = null;
  state.submitting       = false;

  document.getElementById('demoForm').hidden      = false;
  document.getElementById('pipeline').hidden      = true;
  document.getElementById('evalCard').hidden      = true;
  document.getElementById('reviewInline').hidden  = true;
  document.getElementById('resultCard').hidden    = true;
  document.getElementById('btnNewDemoWrap').hidden = true;
  document.getElementById('reviewNotes').value    = '';

  resetAllPipelineSteps();

  var btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled    = false;
  btnSubmit.textContent = 'Submit for AI Evaluation';

  ['btnApprove', 'btnReject', 'btnRevision'].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.disabled = false;
  });
}

/* ---------------------------------------------------------------------------
   REVIEW QUEUE
   --------------------------------------------------------------------------- */

function loadReviewQueue(filter) {
  state.currentFilter = filter || 'review';
  var list = document.getElementById('reviewList');
  list.innerHTML = '<li class="review-list-loading">Loading\u2026</li>';

  var path = '/api/submissions';
  if (filter && filter !== 'all') {
    var statusMap = {
      pending:            'review',
      review:             'review',
      approved:           'approved',
      rejected:           'rejected',
      revision_requested: 'revision_requested',
    };
    var apiStatus = statusMap[filter] || filter;
    path += '?status=' + encodeURIComponent(apiStatus);
  }

  apiFetch(path)
    .then(function (data) {
      var items = Array.isArray(data) ? data : (data.submissions || data.items || []);
      state.submissions = items;
      renderReviewList(items);
    })
    .catch(function (err) {
      list.innerHTML = '<li class="review-list-error">Failed to load: ' + escHtml(err.message) + '</li>';
      showToast('Could not load review queue: ' + err.message, 'error');
    });
}

function renderReviewList(items) {
  var list = document.getElementById('reviewList');

  if (!items || items.length === 0) {
    list.innerHTML = '<li class="review-list-empty">No submissions found.</li>';
    return;
  }

  var rows = items.map(function (sub) {
    var badgeClass  = 'badge--' + escHtml(sub.status || 'unknown');
    var statusLabel = (sub.status || 'unknown').replace(/_/g, ' ');
    var score = (sub.ai_evaluation && sub.ai_evaluation.overall_score != null)
      ? sub.ai_evaluation.overall_score
      : null;
    var safeId = escHtml(sub.id);

    return (
      '<li class="review-list-item" role="listitem">' +
      '<button class="review-list-btn" onclick="selectReviewSubmission(\'' + safeId + '\')" ' +
      'aria-label="View submission ' + escHtml(sub.entity_id || sub.id) + '">' +
      '<div class="review-list-row">' +
      '<span class="badge ' + badgeClass + '">' + escHtml(statusLabel) + '</span>' +
      (score != null ? '<span class="review-list-score">' + escHtml(score) + '/100</span>' : '') +
      '</div>' +
      '<div class="review-list-entity">' + escHtml(sub.entity_id || sub.id) + '</div>' +
      '<div class="review-list-content">' + escHtml(truncate(sub.content, 120)) + '</div>' +
      '<div class="review-list-date">' + escHtml(fmtDate(sub.created_at)) + '</div>' +
      '</button>' +
      '</li>'
    );
  });

  list.innerHTML = rows.join('');
}

function selectReviewSubmission(id) {
  state.selectedId = id;
  var detail = document.getElementById('reviewDetail');
  detail.innerHTML = '<div class="review-detail-loading">Loading\u2026</div>';

  apiFetch('/api/submissions/' + id)
    .then(function (sub) {
      renderReviewDetail(sub);
    })
    .catch(function (err) {
      detail.innerHTML = '<div class="review-detail-error">Failed to load: ' + escHtml(err.message) + '</div>';
      showToast('Could not load submission: ' + err.message, 'error');
    });
}

function renderReviewDetail(sub) {
  var detail     = document.getElementById('reviewDetail');
  var statusLabel = (sub.status || 'unknown').replace(/_/g, ' ');
  var badgeClass  = 'badge--' + escHtml(sub.status || 'unknown');

  var parts = [
    '<div class="detail-header">' +
    '<span class="badge ' + badgeClass + '">' + escHtml(statusLabel) + '</span>' +
    '<span class="detail-id">' + escHtml(sub.entity_id || sub.id) + '</span>' +
    '<span class="detail-date">' + escHtml(fmtDate(sub.created_at)) + '</span>' +
    '</div>',

    '<div class="detail-section"><h3>Content</h3>' +
    '<div class="detail-content">' + escHtml(sub.content) + '</div></div>',
  ];

  if (sub.ai_evaluation) {
    parts.push(
      '<div class="detail-section"><h3>AI Evaluation</h3>' +
      renderEvaluation(sub.ai_evaluation) +
      '</div>'
    );
  }

  if (sub.review_decision) {
    var labelMap = { approved: 'Approved', rejected: 'Rejected', revision_requested: 'Revision Requested' };
    var decisionLabel = labelMap[sub.review_decision] || escHtml(sub.review_decision);
    var decisionPart =
      '<div class="detail-section detail-decision">' +
      '<h3>Review Decision</h3>' +
      '<span class="result-decision result-decision--' + escHtml(sub.review_decision) + '">' +
      decisionLabel + '</span>';
    if (sub.reviewer_notes) {
      decisionPart += '<p class="detail-notes">' + escHtml(sub.reviewer_notes) + '</p>';
    }
    decisionPart += '</div>';
    parts.push(decisionPart);
  }

  if (sub.status === 'review') {
    var safeId = escHtml(sub.id);
    parts.push(
      '<div class="detail-section detail-actions">' +
      '<h3>Submit Review</h3>' +
      '<div class="review-actions">' +
      '<button class="btn btn-approve"   onclick="submitQueueReview(\'' + safeId + '\', \'approved\')">Approve</button>' +
      '<button class="btn btn-reject"    onclick="submitQueueReview(\'' + safeId + '\', \'rejected\')">Reject</button>' +
      '<button class="btn btn-revision"  onclick="submitQueueReview(\'' + safeId + '\', \'revision_requested\')">Request Revision</button>' +
      '</div>' +
      '<div class="form-group" style="margin-top:0.75rem;">' +
      '<label for="queueReviewNotes">Reviewer Notes <span class="label-optional">(optional)</span></label>' +
      '<textarea id="queueReviewNotes" rows="3" placeholder="Add context or instructions\u2026"></textarea>' +
      '</div>' +
      '</div>'
    );
  }

  detail.innerHTML = parts.join('');
}

function submitQueueReview(id, decision) {
  var notesEl = document.getElementById('queueReviewNotes');
  var notes   = notesEl ? notesEl.value.trim() : '';

  document.querySelectorAll('.detail-actions .btn').forEach(function (b) { b.disabled = true; });

  apiFetch('/api/submissions/' + id + '/review', {
    method: 'POST',
    body:   JSON.stringify({ decision: decision, reviewer_notes: notes }),
  })
    .then(function () {
      showToast('Review submitted: ' + decision.replace(/_/g, ' '), 'success');
      document.getElementById('reviewDetail').innerHTML =
        '<div class="review-detail-placeholder"><p>Select a submission from the list to view details.</p></div>';
      state.selectedId = null;
      loadReviewQueue(state.currentFilter);
    })
    .catch(function (err) {
      showToast('Review failed: ' + err.message, 'error');
      document.querySelectorAll('.detail-actions .btn').forEach(function (b) { b.disabled = false; });
    });
}

function filterReview(filter) {
  state.currentFilter = filter;

  document.querySelectorAll('.filter-tab').forEach(function (tab) {
    var isActive = tab.getAttribute('data-filter') === filter;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.getElementById('reviewDetail').innerHTML =
    '<div class="review-detail-placeholder">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
    '<polyline points="14 2 14 8 20 8"/>' +
    '<line x1="16" y1="13" x2="8" y2="13"/>' +
    '<line x1="16" y1="17" x2="8" y2="17"/>' +
    '<polyline points="10 9 9 9 8 9"/>' +
    '</svg>' +
    '<p>Select a submission from the list to view details.</p>' +
    '</div>';
  state.selectedId = null;

  loadReviewQueue(filter);
}

/* ---------------------------------------------------------------------------
   TOAST NOTIFICATIONS
   --------------------------------------------------------------------------- */

function showToast(message, type) {
  var container = document.getElementById('toastContainer');
  var toast     = document.createElement('div');
  toast.className = 'toast toast--' + (type || 'info');
  toast.textContent = message;

  var closeBtn = document.createElement('button');
  closeBtn.className   = 'toast-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.onclick = function () { removeToast(toast); };
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  requestAnimationFrame(function () {
    toast.classList.add('toast--visible');
  });

  setTimeout(function () { removeToast(toast); }, 4000);
}

function removeToast(toast) {
  toast.classList.remove('toast--visible');
  toast.classList.add('toast--hiding');
  setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/* ---------------------------------------------------------------------------
   INITIALIZATION
   --------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', function () {

  var apiUrlInput = document.getElementById('cfgApiUrl');
  apiUrlInput.value = defaultApiUrl();

  var apiKeyInput = document.getElementById('cfgApiKey');
  var savedKey    = localStorage.getItem('hastApiKey');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  apiKeyInput.addEventListener('input', function () {
    localStorage.setItem('hastApiKey', apiKeyInput.value);
  });

  var contentArea = document.getElementById('submissionContent');
  if (contentArea && !contentArea.value.trim()) {
    contentArea.value = SAMPLE_CONTENT;
  }

  var debouncedTest = debounce(testConnection, 600);
  apiUrlInput.addEventListener('input', debouncedTest);
  apiKeyInput.addEventListener('input', debouncedTest);

  testConnection();
});
