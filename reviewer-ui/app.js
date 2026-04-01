/* ============================================================
   Reviewer Dashboard — app.js
   Vanilla JS, no build tools required.

   Security note: All API-sourced values are passed through
   escHtml() before being interpolated into HTML strings.
   The innerHTML assignments below are safe template rendering,
   equivalent to using a templating engine — not raw user input.
   ============================================================ */

// ── State ────────────────────────────────────────────────────
const state = {
  submissions: [],
  selectedId: null,
  currentFilter: 'review',
  loading: false,
  refreshTimer: null,
  submitting: false,
};

// ── Utility ───────────────────────────────────────────────────
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function scoreLevelLabel(score) {
  if (score === null || score === undefined) return 'Not Scored';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Satisfactory';
  if (score >= 40) return 'Needs Improvement';
  return 'Unsatisfactory';
}

function formatDate(iso) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortId(id) {
  if (!id) return '\u2014';
  const s = String(id);
  return s.length > 8 ? '#' + s.slice(0, 8) : '#' + s;
}

function setHtml(el, html) {
  // centralised innerHTML setter — all callers ensure content is escaped
  if (el) el.innerHTML = html;
}

// ── Config ───────────────────────────────────────────────────
function getConfig() {
  const apiUrl = document.getElementById('apiUrl').value.trim().replace(/\/$/, '');
  const apiKey = document.getElementById('apiKey').value.trim();
  return { apiUrl, apiKey };
}

function defaultApiUrl() {
  const { protocol, hostname } = window.location;
  // In production behind Caddy, HAST API is on :8443; locally it's :8000
  var port = (protocol === 'https:') ? '8443' : '8000';
  return protocol + '//' + hostname + ':' + port;
}

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(path, options) {
  options = options || {};
  const { apiUrl, apiKey } = getConfig();
  const url = apiUrl + path;
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
    options.headers || {}
  );

  const res = await fetch(url, Object.assign({}, options, { headers }));

  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try {
      const body = await res.json();
      msg = body.detail || body.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return res.json();
}

async function fetchSubmissions(status) {
  const qs = status ? '?status=' + encodeURIComponent(status) : '';
  return apiFetch('/api/submissions' + qs);
}

async function submitReview(id, decision, notes) {
  return apiFetch('/api/submissions/' + encodeURIComponent(id) + '/review', {
    method: 'POST',
    body: JSON.stringify({ decision: decision, reviewer_notes: notes }),
  });
}

// ── Data helpers ──────────────────────────────────────────────
function statusBadgeClass(status) {
  const map = {
    review:             'badge-review',
    pending_review:     'badge-review',
    approved:           'badge-approved',
    rejected:           'badge-rejected',
    revision_requested: 'badge-revision',
    revision:           'badge-revision',
    pending:            'badge-pending',
    submitted:          'badge-pending',
  };
  return map[status] || 'badge-unknown';
}

function statusLabel(status) {
  const map = {
    review:             'Review',
    pending_review:     'Review',
    approved:           'Approved',
    rejected:           'Rejected',
    revision_requested: 'Revision',
    revision:           'Revision',
    pending:            'Pending',
    submitted:          'Submitted',
  };
  return map[status] || (status ? String(status) : 'Unknown');
}

function scoreClass(score) {
  if (score === null || score === undefined) return 'great';
  if (score < 40) return 'low';
  if (score < 60) return 'medium';
  if (score < 80) return 'high';
  return 'great';
}

function extractScore(submission) {
  const ev = submission.evaluation || submission.ai_evaluation || submission.review_result || {};
  const score = ev.overall_score != null ? ev.overall_score
    : ev.score != null ? ev.score
    : submission.score != null ? submission.score
    : null;
  return score !== null ? Math.round(score) : null;
}

function extractEvaluation(submission) {
  return submission.evaluation || submission.ai_evaluation || submission.review_result || null;
}

function getLearnerName(submission) {
  return submission.learner_name
    || submission.student_name
    || submission.user_name
    || submission.submitter
    || (submission.learner_id ? 'Learner ' + submission.learner_id : null)
    || 'Unknown Learner';
}

function getTaskName(submission) {
  return submission.task_name
    || submission.assignment_name
    || submission.task_id
    || submission.assignment_id
    || '\u2014';
}

// ── Render: submission list ───────────────────────────────────
function renderSubmissionList(submissions) {
  const container = document.getElementById('submissionList');
  if (!container) return;

  if (!submissions || submissions.length === 0) {
    setHtml(container, [
      '<div class="state-block">',
      '  <div class="state-icon">\uD83D\uDCED</div>',
      '  <p>No submissions found</p>',
      '  <p class="state-sub">for the current filter</p>',
      '</div>'
    ].join(''));
    return;
  }

  const rows = submissions.map(function(sub) {
    const score = extractScore(sub);
    const isActive = String(sub.id) === String(state.selectedId);
    const scorePill = score !== null
      ? '<span class="score-pill">' + score + '</span>'
      : '';

    return [
      '<div class="submission-item ' + (isActive ? 'active' : '') + '"',
      '  data-id="' + escHtml(String(sub.id)) + '"',
      '  role="button" tabindex="0"',
      '  aria-label="Submission ' + escHtml(shortId(sub.id)) + ' by ' + escHtml(getLearnerName(sub)) + '">',
      '  <div class="submission-item-header">',
      '    <span class="submission-id">' + escHtml(shortId(sub.id)) + '</span>',
      '    <span class="submission-badge ' + statusBadgeClass(sub.status) + '">' + escHtml(statusLabel(sub.status)) + '</span>',
      '  </div>',
      '  <div class="submission-learner truncate">' + escHtml(getLearnerName(sub)) + '</div>',
      '  <div class="submission-meta">',
      '    <span class="submission-task truncate">' + escHtml(getTaskName(sub)) + '</span>',
      '    ' + scorePill,
      '  </div>',
      '  <div class="submission-time">' + escHtml(formatDate(sub.submitted_at || sub.created_at)) + '</div>',
      '</div>',
    ].join('\n');
  });

  setHtml(container, rows.join(''));

  container.querySelectorAll('.submission-item').forEach(function(el) {
    var handler = function() { selectSubmission(el.dataset.id); };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') handler();
    });
  });
}

// ── Render: detail panel ──────────────────────────────────────
function renderDetail(submission) {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;

  if (!submission) {
    setHtml(panel, [
      '<div class="detail-empty">',
      '  <div class="empty-icon">\uD83D\uDD0D</div>',
      '  <p>Select a submission to review</p>',
      '</div>'
    ].join(''));
    return;
  }

  const ev = extractEvaluation(submission);
  const score = extractScore(submission);
  const isActionable = ['review', 'pending_review'].includes(submission.status);

  setHtml(panel, [
    '<div class="detail-content">',
    buildSubmissionCard(submission),
    buildEvalCard(ev, score),
    buildActionCard(submission, isActionable),
    '</div>',
  ].join(''));

  if (isActionable) {
    var sid = submission.id;
    var btnA = document.getElementById('btnApprove');
    var btnR = document.getElementById('btnReject');
    var btnV = document.getElementById('btnRevision');
    if (btnA) btnA.addEventListener('click', function() { handleAction(sid, 'approve'); });
    if (btnR) btnR.addEventListener('click', function() { handleAction(sid, 'reject'); });
    if (btnV) btnV.addEventListener('click', function() { handleAction(sid, 'request_revision'); });
  }
}

function buildSubmissionCard(sub) {
  const content = sub.content || sub.text || sub.submission_text || sub.answer || '';

  var infoItems = [];
  infoItems.push(
    '<div class="info-item">',
    '  <div class="info-label">Submitted</div>',
    '  <div class="info-value">' + escHtml(formatDate(sub.submitted_at || sub.created_at)) + '</div>',
    '</div>'
  );
  if (sub.course_id || sub.course) {
    infoItems.push(
      '<div class="info-item">',
      '  <div class="info-label">Course</div>',
      '  <div class="info-value">' + escHtml(String(sub.course_id || sub.course)) + '</div>',
      '</div>'
    );
  }
  if (sub.attempt !== undefined) {
    infoItems.push(
      '<div class="info-item">',
      '  <div class="info-label">Attempt</div>',
      '  <div class="info-value">' + escHtml(String(sub.attempt)) + '</div>',
      '</div>'
    );
  }
  if (sub.workflow_run_id) {
    infoItems.push(
      '<div class="info-item">',
      '  <div class="info-label">Workflow Run</div>',
      '  <div class="info-value mono" style="font-size:11px">' + escHtml(String(sub.workflow_run_id)) + '</div>',
      '</div>'
    );
  }

  var contentBlock = content ? [
    '<div style="margin-top:14px">',
    '  <div class="info-label" style="margin-bottom:6px">Submission Content</div>',
    '  <div class="submission-text">' + escHtml(content) + '</div>',
    '</div>'
  ].join('') : '';

  return [
    '<div class="card">',
    '  <div class="card-header">',
    '    <div class="card-title"><span class="icon">\uD83D\uDCCB</span> Submission</div>',
    '    <span class="submission-badge ' + statusBadgeClass(sub.status) + '">' + escHtml(statusLabel(sub.status)) + '</span>',
    '  </div>',
    '  <div class="detail-id">' + escHtml(shortId(sub.id)) + ' &nbsp;&middot;&nbsp; <span class="text-muted mono" style="font-size:11px">' + escHtml(String(sub.id)) + '</span></div>',
    '  <div class="detail-headline">',
    '    <div class="detail-name">' + escHtml(getLearnerName(sub)) + '</div>',
    '    <div class="detail-task">' + escHtml(getTaskName(sub)) + '</div>',
    '  </div>',
    '  <div class="info-grid">',
    infoItems.join('\n'),
    '  </div>',
    contentBlock,
    '</div>',
  ].join('\n');
}

function buildEvalCard(ev, score) {
  if (!ev) {
    return [
      '<div class="card">',
      '  <div class="card-header"><div class="card-title"><span class="icon">\uD83E\uDD16</span> AI Evaluation</div></div>',
      '  <div class="no-eval">No AI evaluation available for this submission.</div>',
      '</div>',
    ].join('');
  }

  const s = score !== null ? score : 0;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (s / 100) * circumference;
  const ringCls = scoreClass(s);
  const ringColorVar = { low: '--red', medium: '--orange', high: '--yellow', great: '--teal' }[ringCls] || '--teal';

  // Breakdown
  const breakdown = ev.criteria_scores || ev.dimension_scores || ev.breakdown || ev.scores || {};
  const breakdownEntries = (typeof breakdown === 'object' && !Array.isArray(breakdown))
    ? Object.entries(breakdown) : [];

  const breakdownHtml = breakdownEntries.length > 0 ? [
    '<div class="eval-breakdown">',
    breakdownEntries.map(function(pair) {
      var key = pair[0], val = pair[1];
      var v = (typeof val === 'object') ? (val.score != null ? val.score : val.value != null ? val.value : 0) : val;
      var pct = Math.min(100, Math.max(0, v));
      return [
        '<div class="breakdown-item">',
        '  <div class="breakdown-label">' + escHtml(formatKey(key)) + '</div>',
        '  <div class="breakdown-bar-wrap">',
        '    <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:' + pct + '%"></div></div>',
        '    <span class="breakdown-score">' + Math.round(v) + '</span>',
        '  </div>',
        '</div>',
      ].join('');
    }).join(''),
    '</div>',
  ].join('') : '';

  // Strengths / weaknesses
  const strengths = ev.strengths || ev.strong_points || [];
  const weaknesses = ev.weaknesses || ev.weak_points || ev.areas_for_improvement || [];
  const feedback = ev.feedback || ev.overall_feedback || ev.summary || ev.comments || '';

  const strengthsHtml = strengths.length > 0 ? [
    '<div class="eval-section">',
    '  <div class="eval-section-title strengths">\u25B2 Strengths</div>',
    '  <ul class="eval-list strengths">',
    strengths.map(function(s) { return '<li>' + escHtml(String(s)) + '</li>'; }).join(''),
    '  </ul>',
    '</div>',
  ].join('') : '';

  const weaknessesHtml = weaknesses.length > 0 ? [
    '<div class="eval-section">',
    '  <div class="eval-section-title weaknesses">\u25BC Areas for Improvement</div>',
    '  <ul class="eval-list weaknesses">',
    weaknesses.map(function(w) { return '<li>' + escHtml(String(w)) + '</li>'; }).join(''),
    '  </ul>',
    '</div>',
  ].join('') : '';

  const feedbackHtml = feedback ? [
    '<div class="eval-section">',
    '  <div class="eval-section-title feedback">\u25C8 Feedback</div>',
    '  <div class="eval-feedback">' + escHtml(feedback) + '</div>',
    '</div>',
  ].join('') : '';

  const modelBadge = ev.model
    ? '<span class="text-muted" style="font-size:11px">' + escHtml(ev.model) + '</span>'
    : '';

  const scoreDisplay = score !== null ? String(score) : '\u2014';
  const denomDisplay = score !== null ? '/ 100' : '';

  return [
    '<div class="card">',
    '  <div class="card-header">',
    '    <div class="card-title"><span class="icon">\uD83E\uDD16</span> AI Evaluation</div>',
    '    ' + modelBadge,
    '  </div>',
    '  <div class="eval-score-hero">',
    '    <div class="score-ring">',
    '      <svg width="80" height="80" viewBox="0 0 80 80">',
    '        <circle class="ring-track" cx="40" cy="40" r="30"/>',
    '        <circle class="ring-fill ' + ringCls + '" cx="40" cy="40" r="30"',
    '          stroke-dasharray="' + circumference.toFixed(2) + '"',
    '          stroke-dashoffset="' + (score !== null ? offset.toFixed(2) : circumference.toFixed(2)) + '"',
    '        />',
    '      </svg>',
    '      <div class="score-center">',
    '        <span class="score-number" style="color:var(' + ringColorVar + ')">' + scoreDisplay + '</span>',
    '        <span class="score-denom">' + denomDisplay + '</span>',
    '      </div>',
    '    </div>',
    '    <div class="score-summary">',
    '      <div class="score-label">' + escHtml(scoreLevelLabel(score)) + '</div>',
    '      <div class="score-desc">' + escHtml(ev.recommendation || ev.verdict || '') + '</div>',
    '    </div>',
    '  </div>',
    breakdownHtml,
    strengthsHtml,
    weaknessesHtml,
    feedbackHtml,
    '</div>',
  ].join('\n');
}

function buildActionCard(sub, isActionable) {
  var lockedMsg = !isActionable
    ? 'This submission has already been ' + statusLabel(sub.status).toLowerCase() + '.'
    : '';

  var lockedBlock = !isActionable
    ? '<p class="action-locked-msg">' + escHtml(lockedMsg) + '</p>'
    : '';

  var dis = isActionable ? '' : 'disabled';

  return [
    '<div class="action-card ' + (isActionable ? '' : 'locked') + '" id="actionCard">',
    '  <div class="card-header" style="margin-bottom:14px">',
    '    <div class="card-title"><span class="icon">\u2696\uFE0F</span> Reviewer Decision</div>',
    '  </div>',
    '  <label class="notes-label" for="reviewNotes">Notes (optional)</label>',
    '  <textarea id="reviewNotes" class="notes-textarea"',
    '    placeholder="Add context or reasoning for your decision\u2026"',
    '    ' + dis + '></textarea>',
    '  <div class="action-buttons">',
    '    <button class="btn btn-approve" id="btnApprove" ' + dis + '>\u2713 Approve</button>',
    '    <button class="btn btn-revision" id="btnRevision" ' + dis + '>\u21BA Request Revision</button>',
    '    <button class="btn btn-reject" id="btnReject" ' + dis + '>\u2715 Reject</button>',
    '  </div>',
    '  <div class="action-result" id="actionResult"></div>',
    lockedBlock,
    '</div>',
  ].join('\n');
}

// ── Actions ───────────────────────────────────────────────────
function handleAction(submissionId, decision) {
  if (state.submitting) return;

  var notesEl = document.getElementById('reviewNotes');
  var notes = notesEl ? notesEl.value.trim() : '';
  var resultEl = document.getElementById('actionResult');
  var btnIds = ['btnApprove', 'btnReject', 'btnRevision'];
  var buttons = btnIds.map(function(id) { return document.getElementById(id); }).filter(Boolean);

  var activeBtnId = decision === 'approve' ? 'btnApprove'
    : decision === 'reject' ? 'btnReject' : 'btnRevision';
  var activeBtn = document.getElementById(activeBtnId);
  var origText = activeBtn ? activeBtn.textContent : '';

  state.submitting = true;
  buttons.forEach(function(b) { b.disabled = true; });
  if (activeBtn) {
    var spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    activeBtn.textContent = '';
    activeBtn.appendChild(spinner);
    activeBtn.appendChild(document.createTextNode(' Submitting\u2026'));
  }

  submitReview(submissionId, decision, notes).then(function() {
    if (resultEl) {
      resultEl.className = 'action-result success';
      resultEl.textContent = 'Decision recorded: ' + decision.replace('_', ' ') + '.';
    }
    showToast('Submission ' + decision.replace('_', ' ') + '.', 'success');

    setTimeout(function() {
      loadSubmissions();
      state.selectedId = null;
      renderDetail(null);
    }, 800);
  }).catch(function(err) {
    if (resultEl) {
      resultEl.className = 'action-result error';
      resultEl.textContent = 'Error: ' + err.message;
    }
    showToast('Failed: ' + err.message, 'error');
    buttons.forEach(function(b) { b.disabled = false; });
    if (activeBtn) activeBtn.textContent = origText;
  }).finally(function() {
    state.submitting = false;
  });
}

// ── Selection ─────────────────────────────────────────────────
function selectSubmission(id) {
  var sub = null;
  for (var i = 0; i < state.submissions.length; i++) {
    if (String(state.submissions[i].id) === String(id)) {
      sub = state.submissions[i];
      break;
    }
  }
  if (!sub) return;

  state.selectedId = sub.id;
  renderSubmissionList(state.submissions);
  renderDetail(sub);

  var panel = document.getElementById('detailPanel');
  if (panel) panel.scrollTop = 0;
}

// ── Load cycle ────────────────────────────────────────────────
function loadSubmissions() {
  updateConnectionStatus('loading');

  var statusParam = state.currentFilter === 'all' ? null : state.currentFilter;

  fetchSubmissions(statusParam).then(function(data) {
    var list = Array.isArray(data) ? data : (data.submissions || data.items || []);
    state.submissions = list;

    updateConnectionStatus('connected');
    updatePendingCount(list);
    renderSubmissionList(list);

    if (state.selectedId) {
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(state.selectedId)) { found = list[i]; break; }
      }
      if (found) renderDetail(found);
    }

    updateLastRefreshed();
  }).catch(function(err) {
    updateConnectionStatus('error', err.message);
    var container = document.getElementById('submissionList');
    if (container) {
      setHtml(container, [
        '<div class="state-block">',
        '  <div class="state-icon">\u26A0\uFE0F</div>',
        '  <p>Failed to load submissions</p>',
        '  <p class="state-sub">' + escHtml(err.message) + '</p>',
        '</div>',
      ].join(''));
    }
  });
}

// ── Filter ────────────────────────────────────────────────────
function setFilter(filter) {
  state.currentFilter = filter;
  state.selectedId = null;
  renderDetail(null);

  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  loadSubmissions();
}

// ── Auto-refresh ──────────────────────────────────────────────
function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(loadSubmissions, 30000);
}

// ── UI helpers ────────────────────────────────────────────────
function updateConnectionStatus(status, msg) {
  var el = document.getElementById('connectionStatus');
  if (!el) return;

  if (status === 'loading') {
    el.className = 'config-status';
    var sp = document.createElement('span');
    sp.className = 'loading-spinner';
    sp.style.cssText = 'width:8px;height:8px;border-width:1px';
    el.textContent = '';
    el.appendChild(sp);
    el.appendChild(document.createTextNode(' Connecting\u2026'));
  } else if (status === 'connected') {
    el.className = 'config-status connected';
    setHtml(el, '<span class="status-dot"></span> Connected');
  } else if (status === 'error') {
    el.className = 'config-status error';
    setHtml(el, '<span class="status-dot"></span> ' + escHtml(msg || 'Error'));
  } else {
    el.className = 'config-status';
    setHtml(el, '<span class="status-dot"></span> Idle');
  }
}

function updatePendingCount(list) {
  var el = document.getElementById('pendingCount');
  if (!el) return;
  var count = list.filter(function(s) {
    return s.status === 'review' || s.status === 'pending_review';
  }).length;
  el.textContent = String(count);
  if (el.parentElement) el.parentElement.style.display = count > 0 ? 'flex' : 'none';
}

function updateLastRefreshed() {
  var el = document.getElementById('lastRefreshed');
  if (!el) return;
  el.textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;

  var icon = type === 'success' ? '\u2713' : type === 'error' ? '\u2715' : '\u2139';
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;

  var iconSpan = document.createElement('span');
  iconSpan.textContent = icon;
  var msgSpan = document.createElement('span');
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 4000);
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  var urlInput = document.getElementById('apiUrl');
  if (urlInput && !urlInput.value) urlInput.value = defaultApiUrl();

  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { setFilter(btn.dataset.filter); });
  });

  var btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.addEventListener('click', loadSubmissions);

  var configDebounce;
  ['apiUrl', 'apiKey'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function() {
      clearTimeout(configDebounce);
      configDebounce = setTimeout(loadSubmissions, 600);
    });
  });

  loadSubmissions();
  startAutoRefresh();
}

document.addEventListener('DOMContentLoaded', init);
