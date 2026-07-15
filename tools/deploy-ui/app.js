const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  status: null,
  history: [],
  selectedPaths: new Set(),
  logs: [],
  activeFile: '',
};

const statusText = {
  A: ['新增', 'status-added'],
  '?': ['新增', 'status-added'],
  M: ['修改', 'status-modified'],
  D: ['删除', 'status-deleted'],
  R: ['重命名', 'status-renamed'],
  C: ['复制', 'status-renamed'],
  U: ['冲突', 'status-conflict'],
  T: ['类型变化', 'status-modified'],
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function setLoading(show, text = '正在处理…') {
  $('#loading-text').textContent = text;
  $('#loading').classList.toggle('hidden', !show);
}

function toast(message, kind = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${kind === 'error' ? 'error' : ''}`;
  node.textContent = message;
  $('#toast-region').append(node);
  setTimeout(() => node.remove(), 3600);
}

function addLog(kind, action, message, output = '') {
  state.logs.unshift({ kind, action, message, output, time: new Date() });
  $('#log-count').textContent = state.logs.length;
  renderLogs();
}

function showError(error, action = '操作') {
  const payload = error?.payload?.error || error?.error || error || {};
  const message = payload.message || '操作失败';
  const suggestion = payload.suggestion || '请查看详细信息后重试。';
  const details = payload.details || error.message || '';
  $('#error-title').textContent = message;
  $('#error-suggestion').textContent = suggestion;
  $('#error-details').textContent = details;
  $('#error-details-wrap').classList.toggle('hidden', !details);
  if (!$('#error-dialog').open) $('#error-dialog').showModal();
  addLog('error', action, message, details);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.method === 'POST' ? { 'X-Deploy-Tool': 'local' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `请求失败 (${response.status})`);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function badge(code, staged = false) {
  if (!code || code === ' ') return '';
  const [label, className] = statusText[code[0]] || [code, 'status-modified'];
  return `<span class="status-badge ${className} ${staged ? 'status-staged' : ''}">${staged ? '已暂存 · ' : ''}${label}</span>`;
}

function renderSummary() {
  const data = state.status;
  if (!data) return;
  $('#branch-value').textContent = data.branch;
  $('#upstream-value').textContent = data.upstream ? `跟踪 ${data.upstream}` : '尚未设置上游分支';
  $('#changed-value').textContent = `${data.counts.changed} 个文件`;
  $('#changed-detail').textContent = data.clean ? '工作区干净' : `${data.counts.staged} 个已加入，${data.counts.unstaged} 个未加入`;
  $('#staged-value').textContent = `${data.counts.staged} 个文件`;
  $('#ahead-value').textContent = `${data.ahead} 个提交`;
  $('#push-detail').textContent = `${data.counts.pushFiles} 个文件将被推送`;

  const health = $('#health-value');
  health.className = 'health';
  if (data.counts.conflicted) {
    health.textContent = '需要处理冲突';
    health.classList.add('bad');
    $('#health-detail').textContent = `${data.counts.conflicted} 个冲突文件`;
  } else if (data.behind) {
    health.textContent = '远程有新更新';
    health.classList.add('warn');
    $('#health-detail').textContent = `本地落后 ${data.behind} 个提交`;
  } else if (data.clean && data.ahead === 0) {
    health.textContent = '已全部同步';
    health.classList.add('good');
    $('#health-detail').textContent = '没有待处理内容';
  } else {
    health.textContent = '可以继续准备';
    health.classList.add('warn');
    $('#health-detail').textContent = '检查文件后提交或推送';
  }

  $('#repo-link').href = data.repoUrl || '#';
  $('#site-link').href = data.siteUrl || '#';
  $('#repo-link').classList.toggle('hidden', !data.repoUrl);
  $('#site-link').classList.toggle('hidden', !data.siteUrl);
  $('#push-commit-badge').textContent = `${data.counts.pushCommits} 个提交`;
  $('#undo-commit-button').disabled = data.counts.pushCommits < 1;
  $('#undo-commit-button').title = data.counts.pushCommits
    ? `撤销最新的待推送提交 ${data.pushCommits[0].shortSha}`
    : '没有可以撤销的待推送提交';
  $('#deploy-hint').textContent = data.ahead
    ? `准备推送 ${data.ahead} 个提交、${data.counts.pushFiles} 个文件`
    : '当前没有等待推送的提交';
}

function renderChanges() {
  const list = $('#changes-list');
  const files = state.status?.files || [];
  state.selectedPaths = new Set([...state.selectedPaths].filter((path) => files.some((file) => file.path === path)));
  if (!files.length) {
    list.innerHTML = '<div class="empty-row">没有发现修改。编辑网站文件后点击刷新即可看到。</div>';
    $('#select-all-changes').checked = false;
    return;
  }
  list.innerHTML = files.map((file) => {
    const statusBadges = [
      file.staged ? badge(file.x, true) : '',
      file.unstaged ? badge(file.untracked ? '?' : file.y, false) : '',
    ].filter(Boolean).join('');
    return `<div class="file-row file-item ${state.activeFile === file.path ? 'selected' : ''}" data-path="${escapeHtml(file.path)}" data-mode="all">
      <input class="change-checkbox" type="checkbox" data-check-path="${escapeHtml(file.path)}" ${state.selectedPaths.has(file.path) ? 'checked' : ''} aria-label="选择 ${escapeHtml(file.path)}" />
      <span class="status-stack">${statusBadges}</span>
      <span class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}${file.oldPath ? `<span class="file-old">原：${escapeHtml(file.oldPath)}</span>` : ''}</span>
    </div>`;
  }).join('');
  $('#select-all-changes').checked = state.selectedPaths.size === files.length;
}

function renderPushFiles() {
  const list = $('#push-files-list');
  const files = state.status?.pushFiles || [];
  if (!files.length) {
    list.innerHTML = '<div class="empty-row">没有已经提交但尚未推送的文件。</div>';
  } else {
    list.innerHTML = files.map((file) => `<div class="push-file-row file-item ${state.activeFile === file.path ? 'selected' : ''}" data-path="${escapeHtml(file.path)}" data-mode="push">
      <span>${badge(file.status)}</span>
      <span class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}${file.oldPath ? `<span class="file-old">原：${escapeHtml(file.oldPath)}</span>` : ''}</span>
    </div>`).join('');
  }
  const commits = state.status?.pushCommits || [];
  $('#push-commits').innerHTML = commits.length
    ? commits.map((commit) => `<div class="commit-mini"><code>${escapeHtml(commit.shortSha)}</code><span>${escapeHtml(commit.subject)}</span></div>`).join('')
    : '<div class="commit-mini"><span class="muted">创建 Commit 后会显示在这里</span></div>';
}

function renderHistory() {
  const list = $('#history-list');
  if (!state.history.length) {
    list.innerHTML = '<div class="empty-row">还没有提交历史。</div>';
    return;
  }
  list.innerHTML = state.history.map((commit) => `<button class="history-item" type="button" data-sha="${commit.sha}">
    <strong>${escapeHtml(commit.subject)}</strong>
    <span class="history-item-meta"><code>${escapeHtml(commit.shortSha)}</code><span>${escapeHtml(commit.author)}</span><span>${formatDate(commit.date)}</span></span>
  </button>`).join('');
}

function renderLogs() {
  const list = $('#activity-list');
  if (!state.logs.length) {
    list.innerHTML = '<div class="empty-row">本次启动还没有操作记录。</div>';
    return;
  }
  list.innerHTML = state.logs.map((entry) => `<div class="activity-entry">
    <time>${entry.time.toLocaleTimeString('zh-CN', { hour12: false })}</time>
    <span class="activity-kind ${entry.kind}">${entry.kind === 'error' ? '失败' : entry.kind === 'success' ? '成功' : '信息'}</span>
    <div><strong>${escapeHtml(entry.action)}</strong> · ${escapeHtml(entry.message)}${entry.output ? `<pre class="activity-output">${escapeHtml(entry.output)}</pre>` : ''}</div>
  </div>`).join('');
}

async function refresh({ quiet = false } = {}) {
  if (!quiet) setLoading(true, '正在检查仓库状态…');
  try {
    const [status, history] = await Promise.all([api('/api/status'), api('/api/history')]);
    state.status = status;
    state.history = history.commits;
    renderSummary();
    renderChanges();
    renderPushFiles();
    renderHistory();
    if (!quiet) addLog('success', '刷新状态', '仓库状态已更新。');
  } catch (error) {
    showError(error, '刷新状态');
  } finally {
    if (!quiet) setLoading(false);
  }
}

async function loadDiff(path, mode = 'all', sha = '') {
  state.activeFile = path;
  renderChanges();
  renderPushFiles();
  $('#diff-caption').textContent = `${path} · ${mode === 'push' ? '即将推送的差异' : '当前工作区差异'}`;
  $('#diff-view').textContent = '正在读取差异…';
  try {
    const query = new URLSearchParams({ path, mode });
    if (sha) query.set('sha', sha);
    const result = await api(`/api/diff?${query}`);
    $('#diff-view').textContent = result.diff;
  } catch (error) {
    $('#diff-view').textContent = '差异读取失败。';
    showError(error, '查看差异');
  }
}

function selectedPaths() {
  return [...state.selectedPaths];
}

async function mutate(action, path, body, loadingText) {
  setLoading(true, loadingText);
  try {
    const result = await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
    toast(result.message || `${action}完成`);
    addLog('success', action, result.message || '操作完成。', result.output || '');
    await refresh({ quiet: true });
    return result;
  } catch (error) {
    showError(error, action);
    throw error;
  } finally {
    setLoading(false);
  }
}

async function stage(all = false) {
  await mutate('加入本次提交', '/api/stage', { all, paths: selectedPaths() }, '正在整理本次提交…');
}

async function unstage() {
  await mutate('移出本次提交', '/api/unstage', { paths: selectedPaths() }, '正在更新提交范围…');
}

async function commit() {
  const message = $('#commit-message').value.trim();
  await mutate('创建 Commit', '/api/commit', { message }, '正在创建 Commit…');
  $('#commit-message').value = '';
  $('#message-count').textContent = '0 / 5000';
  state.selectedPaths.clear();
}

async function undoLatestCommit() {
  const latest = state.status?.pushCommits?.[0];
  if (!latest) {
    toast('没有可以撤销的待推送提交。', 'error');
    return;
  }
  const confirmed = window.confirm(
    `确定撤销最近一次提交吗？\n\n${latest.shortSha}  ${latest.subject}\n\n提交中的文件修改会完整退回工作区，不会被删除。`,
  );
  if (!confirmed) return;
  const result = await mutate(
    '撤销最近提交',
    '/api/undo-commit',
    { expectedSha: latest.sha },
    '正在撤销最近一次提交…',
  );
  if (result) state.selectedPaths.clear();
}

async function push(allowUncommitted = false) {
  try {
    await mutate('推送到 GitHub', '/api/push', {
      runBuild: $('#build-before-push').checked,
      allowUncommitted,
    }, $('#build-before-push').checked ? '正在检查构建并推送…' : '正在推送到 GitHub…');
  } catch (error) {
    if (error?.payload?.error?.code === 'UNCOMMITTED_CHANGES' && !allowUncommitted) {
      $('#error-dialog').close();
      const proceed = window.confirm('还有尚未提交的文件，它们不会被推送。是否只推送已经创建的 Commit？');
      if (proceed) await push(true);
    }
  }
}

async function showCommit(sha) {
  setLoading(true, '正在读取提交详情…');
  try {
    const detail = await api(`/api/commit?sha=${encodeURIComponent(sha)}`);
    $('#history-empty').classList.add('hidden');
    $('#history-detail').classList.remove('hidden');
    $('#detail-sha').textContent = detail.shortSha;
    $('#detail-message').textContent = detail.message;
    $('#detail-author').textContent = `提交者：${detail.author}`;
    $('#detail-date').textContent = formatDate(detail.date);
    $('#history-diff').textContent = '点击上方文件查看这次提交中的差异。';
    $('#detail-files').innerHTML = detail.files.length
      ? detail.files.map((file) => `<div class="detail-file" data-commit-path="${escapeHtml(file.path)}" data-sha="${detail.sha}"><span>${badge(file.status)}</span><span class="file-name">${escapeHtml(file.path)}</span></div>`).join('')
      : '<div class="empty-row">本次提交没有文件变化。</div>';
    $$('.history-item').forEach((item) => item.classList.toggle('active', item.dataset.sha === sha));
  } catch (error) {
    showError(error, '查看提交历史');
  } finally {
    setLoading(false);
  }
}

async function loadHistoryDiff(path, sha) {
  $('#history-diff').textContent = '正在读取差异…';
  try {
    const query = new URLSearchParams({ path, mode: 'commit', sha });
    const result = await api(`/api/diff?${query}`);
    $('#history-diff').textContent = result.diff;
  } catch (error) {
    $('#history-diff').textContent = '差异读取失败。';
    showError(error, '查看历史差异');
  }
}

document.addEventListener('click', async (event) => {
  const tab = event.target.closest('.tab');
  if (tab) {
    $$('.tab').forEach((node) => node.classList.toggle('active', node === tab));
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tab.dataset.tab}`));
    return;
  }
  const file = event.target.closest('.file-item');
  if (file && !event.target.matches('input')) await loadDiff(file.dataset.path, file.dataset.mode);
  const historyItem = event.target.closest('.history-item');
  if (historyItem) await showCommit(historyItem.dataset.sha);
  const detailFile = event.target.closest('.detail-file');
  if (detailFile) await loadHistoryDiff(detailFile.dataset.commitPath, detailFile.dataset.sha);
});

document.addEventListener('change', (event) => {
  if (event.target.matches('.change-checkbox')) {
    if (event.target.checked) state.selectedPaths.add(event.target.dataset.checkPath);
    else state.selectedPaths.delete(event.target.dataset.checkPath);
    $('#select-all-changes').checked = state.selectedPaths.size === (state.status?.files.length || 0);
  }
});

$('#select-all-changes').addEventListener('change', (event) => {
  state.selectedPaths = event.target.checked ? new Set((state.status?.files || []).map((file) => file.path)) : new Set();
  renderChanges();
});
$('#refresh-button').addEventListener('click', () => refresh());
$('#fetch-button').addEventListener('click', () => mutate('获取远程状态', '/api/fetch', {}, '正在连接 GitHub…').catch(() => {}));
$('#stage-selected').addEventListener('click', () => stage(false).catch(() => {}));
$('#stage-all').addEventListener('click', () => stage(true).catch(() => {}));
$('#unstage-selected').addEventListener('click', () => unstage().catch(() => {}));
$('#commit-button').addEventListener('click', () => commit().catch(() => {}));
$('#undo-commit-button').addEventListener('click', () => undoLatestCommit().catch(() => {}));
$('#push-button').addEventListener('click', () => push(false));
$('#commit-message').addEventListener('input', (event) => { $('#message-count').textContent = `${event.target.value.length} / 5000`; });
$('#copy-diff').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#diff-view').textContent);
  toast('差异已复制。');
});
$('#clear-log').addEventListener('click', () => { state.logs = []; $('#log-count').textContent = '0'; renderLogs(); });
$('#error-close').addEventListener('click', () => $('#error-dialog').close());
$('#shutdown-button').addEventListener('click', async () => {
  if (!window.confirm('确定关闭 Favorites 发布台吗？')) return;
  try {
    const result = await api('/api/shutdown', { method: 'POST', body: '{}' });
    document.body.innerHTML = `<div class="empty-state"><div><div class="empty-icon">✓</div><strong>${escapeHtml(result.message)}</strong></div></div>`;
  } catch (error) { showError(error, '关闭工具'); }
});

renderLogs();
refresh();
