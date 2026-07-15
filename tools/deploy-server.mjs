import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(TOOL_DIR, '..');
const UI_DIR = join(TOOL_DIR, 'deploy-ui');
const HOST = '127.0.0.1';
const START_PORT = Number(process.env.DEPLOY_TOOL_PORT || 4179);
const MAX_BODY = 1024 * 1024;
const MAX_OUTPUT = 12 * 1024 * 1024;

class ToolError extends Error {
  constructor(message, details = '', suggestion = '', code = 'COMMAND_FAILED', status = 500) {
    super(message);
    this.details = details;
    this.suggestion = suggestion;
    this.code = code;
    this.status = status;
  }
}

function commandError(command, args, stdout, stderr, exitCode) {
  const details = [stderr, stdout].filter(Boolean).join('\n').trim();
  const text = details.toLowerCase();
  let message = `操作没有完成（退出码 ${exitCode}）`;
  let suggestion = '请查看详细信息，处理后再重试。';
  let code = 'COMMAND_FAILED';

  if (text.includes('not a git repository')) {
    message = '当前目录不是 Git 仓库';
    suggestion = '请从网站项目根目录启动本工具。';
    code = 'NOT_A_REPOSITORY';
  } else if (text.includes('authentication failed') || text.includes('could not read username') || text.includes('permission denied')) {
    message = 'GitHub 登录或权限验证失败';
    suggestion = '请先运行 gh auth login，或检查你是否有该仓库的写入权限。';
    code = 'AUTH_FAILED';
  } else if (text.includes('non-fast-forward') || text.includes('fetch first') || text.includes('rejected')) {
    message = '远程仓库包含本地没有的更新';
    suggestion = '请先获取远程状态并合并更新，再重新推送。';
    code = 'PUSH_REJECTED';
  } else if (text.includes('failed to connect') || text.includes('could not resolve host') || text.includes('connection was reset')) {
    message = '无法连接 GitHub';
    suggestion = '请检查网络连接或代理设置，稍后重试。';
    code = 'NETWORK_ERROR';
  } else if (text.includes('nothing to commit')) {
    message = '没有已加入提交的文件';
    suggestion = '先选择文件并点击“加入本次提交”。';
    code = 'NOTHING_TO_COMMIT';
  } else if (text.includes('conflict') || text.includes('unmerged')) {
    message = '仓库中存在尚未解决的冲突';
    suggestion = '请先解决冲突文件，然后再提交或推送。';
    code = 'MERGE_CONFLICT';
  }

  return new ToolError(message, details || `${command} ${args.join(' ')}`, suggestion, code);
}

function run(command, args, { timeout = 120000, allowFailure = false, env = {} } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: ROOT,
        windowsHide: true,
        shell: false,
        env: { ...process.env, ...env },
      });
    } catch (error) {
      rejectPromise(new ToolError(
        `无法启动 ${command}`,
        error.message,
        `请确认 ${command} 已安装并加入系统 PATH。`,
        'PROGRAM_NOT_FOUND',
      ));
      return;
    }
    const stdout = [];
    const stderr = [];
    let outputSize = 0;
    let timedOut = false;

    const collect = (target) => (chunk) => {
      outputSize += chunk.length;
      if (outputSize <= MAX_OUTPUT) target.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);

    child.on('error', (error) => {
      clearTimeout(timer);
      rejectPromise(new ToolError(
        `无法启动 ${command}`,
        error.message,
        `请确认 ${command} 已安装并加入系统 PATH。`,
        'PROGRAM_NOT_FOUND',
      ));
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString('utf8').trimEnd();
      const err = Buffer.concat(stderr).toString('utf8').trimEnd();
      if (timedOut) {
        rejectPromise(new ToolError(
          '操作等待时间过长，已停止',
          [err, out].filter(Boolean).join('\n'),
          '请检查网络或在终端中确认是否有交互提示。',
          'TIMEOUT',
        ));
      } else if (exitCode !== 0 && !allowFailure) {
        rejectPromise(commandError(command, args, out, err, exitCode));
      } else {
        resolvePromise({ stdout: out, stderr: err, exitCode });
      }
    });
  });
}

const git = (args, options) => run('git', args, options);

async function optionalGit(args) {
  const result = await git(args, { allowFailure: true });
  return result.exitCode === 0 ? result.stdout : '';
}

function parseNameStatus(raw) {
  if (!raw) return [];
  const tokens = raw.split('\0');
  const files = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = tokens[index++] || '';
      const path = tokens[index++] || '';
      files.push({ status, path, oldPath });
    } else {
      const path = tokens[index++] || '';
      if (path) files.push({ status, path });
    }
  }
  return files;
}

function parsePorcelain(raw) {
  if (!raw) return [];
  const tokens = raw.split('\0');
  const files = [];
  for (let index = 0; index < tokens.length;) {
    const entry = tokens[index++];
    if (!entry) continue;
    const x = entry[0] || ' ';
    const y = entry[1] || ' ';
    const path = entry.slice(3);
    const file = {
      path,
      x,
      y,
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ' || x === '?',
      untracked: x === '?' && y === '?',
      conflicted: x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D'),
    };
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') file.oldPath = tokens[index++] || '';
    files.push(file);
  }
  return files;
}

function parseRemoteUrl(remote) {
  const match = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return { repoUrl: remote || '', siteUrl: '' };
  const owner = match[1];
  const repo = match[2];
  return {
    repoUrl: `https://github.com/${owner}/${repo}`,
    siteUrl: repo.toLowerCase().endsWith('.github.io')
      ? `https://${repo}/`
      : `https://${owner}.github.io/${repo}/`,
  };
}

function parseLog(raw) {
  if (!raw) return [];
  return raw.split('\x1e').filter(Boolean).map((record) => {
    const [sha, shortSha, author, date, ...subject] = record.replace(/^\n+|\n+$/g, '').split('\x1f');
    return { sha, shortSha, author, date, subject: subject.join('\x1f') };
  });
}

async function getStatus() {
  const branch = (await optionalGit(['branch', '--show-current'])) || '(游离状态)';
  const upstream = await optionalGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const remote = await optionalGit(['remote', 'get-url', 'origin']);
  const porcelain = await git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const files = parsePorcelain(porcelain.stdout);

  let ahead = 0;
  let behind = 0;
  let pushFiles = [];
  let pushCommits = [];
  if (upstream) {
    const counts = (await git(['rev-list', '--left-right', '--count', `${upstream}...HEAD`])).stdout.split(/\s+/).map(Number);
    behind = counts[0] || 0;
    ahead = counts[1] || 0;
    pushFiles = parseNameStatus((await git(['diff', '--name-status', '-z', '--find-renames', `${upstream}..HEAD`])).stdout);
    pushCommits = parseLog((await git([
      'log',
      '--date=iso-strict',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e',
      `${upstream}..HEAD`,
    ])).stdout);
  }

  const links = parseRemoteUrl(remote);
  return {
    branch,
    upstream: upstream || null,
    remote,
    ...links,
    ahead,
    behind,
    files,
    pushFiles,
    pushCommits,
    counts: {
      changed: files.length,
      staged: files.filter((file) => file.staged).length,
      unstaged: files.filter((file) => file.unstaged).length,
      conflicted: files.filter((file) => file.conflicted).length,
      pushFiles: pushFiles.length,
      pushCommits: pushCommits.length,
    },
    clean: files.length === 0,
  };
}

async function getHistory() {
  const raw = (await git([
    'log',
    '-n', '100',
    '--date=iso-strict',
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e',
  ])).stdout;
  return parseLog(raw);
}

function validateSha(sha) {
  if (!/^[0-9a-f]{4,40}$/i.test(sha || '')) {
    throw new ToolError('提交编号无效', '', '请从提交历史中重新选择。', 'INVALID_SHA', 400);
  }
}

function validatePaths(paths) {
  if (!Array.isArray(paths)) throw new ToolError('文件列表格式无效', '', '', 'INVALID_PATHS', 400);
  return paths.map((filePath) => {
    if (typeof filePath !== 'string' || !filePath || filePath.includes('\0')) {
      throw new ToolError('文件路径无效', String(filePath), '', 'INVALID_PATH', 400);
    }
    const absolute = resolve(ROOT, filePath);
    if (absolute !== ROOT && !absolute.startsWith(`${ROOT}${sep}`)) {
      throw new ToolError('文件不在项目目录中', filePath, '', 'INVALID_PATH', 400);
    }
    return filePath;
  });
}

async function untrackedPreview(filePath) {
  const tracked = await optionalGit(['ls-files', '--others', '--exclude-standard', '--', filePath]);
  if (!tracked) return '';
  const absolute = resolve(ROOT, filePath);
  if (!existsSync(absolute)) return '';
  const stats = statSync(absolute);
  if (!stats.isFile()) return '这是一个目录，加入提交后可查看其中的文件。';
  if (stats.size > 512 * 1024) return `新文件大小为 ${(stats.size / 1024).toFixed(1)} KB，预览已省略。`;
  const data = readFileSync(absolute);
  if (data.includes(0)) return `这是一个二进制文件（${(stats.size / 1024).toFixed(1)} KB），无法显示文本差异。`;
  return `--- /dev/null\n+++ b/${filePath}\n@@ 新文件 @@\n${data.toString('utf8')}`;
}

async function getDiff(search) {
  const filePath = validatePaths([search.get('path') || ''])[0];
  const mode = search.get('mode') || 'all';
  const sha = search.get('sha') || '';

  if (mode === 'push') {
    const upstream = await optionalGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    if (!upstream) return { diff: '当前分支还没有上游分支。首次推送后，这里会显示即将推送的差异。' };
    return { diff: (await git(['diff', '--no-ext-diff', '--find-renames', `${upstream}..HEAD`, '--', filePath])).stdout || '没有可显示的文本差异。' };
  }

  if (mode === 'commit') {
    validateSha(sha);
    return { diff: (await git(['show', '--format=', '--no-ext-diff', '--find-renames', sha, '--', filePath])).stdout || '没有可显示的文本差异。' };
  }

  const chunks = [];
  const staged = (await git(['diff', '--cached', '--no-ext-diff', '--find-renames', '--', filePath])).stdout;
  const working = (await git(['diff', '--no-ext-diff', '--find-renames', '--', filePath])).stdout;
  const untracked = await untrackedPreview(filePath);
  if (staged) chunks.push(`===== 已加入本次提交 =====\n${staged}`);
  if (working) chunks.push(`===== 尚未加入本次提交 =====\n${working}`);
  if (untracked) chunks.push(`===== 新文件 =====\n${untracked}`);
  return { diff: chunks.join('\n\n') || '这个文件没有可显示的文本差异。' };
}

async function getCommit(sha) {
  validateSha(sha);
  const infoRaw = (await git(['show', '-s', '--date=iso-strict', '--format=%H%x1f%h%x1f%an%x1f%ad%x1f%B', sha])).stdout;
  const [fullSha, shortSha, author, date, ...message] = infoRaw.split('\x1f');
  const filesRaw = (await git(['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-z', '--find-renames', sha])).stdout;
  return {
    sha: fullSha,
    shortSha,
    author,
    date,
    message: message.join('\x1f').trim(),
    files: parseNameStatus(filesRaw),
  };
}

async function stageFiles(body) {
  const paths = validatePaths(body.paths || []);
  if (body.all) await git(['add', '-A']);
  else {
    if (!paths.length) throw new ToolError('请先选择文件', '', '勾选需要加入提交的文件。', 'NO_SELECTION', 400);
    await git(['add', '-A', '--', ...paths]);
  }
  return { message: body.all ? '全部变更已加入本次提交。' : `已加入 ${paths.length} 个文件。` };
}

async function unstageFiles(body) {
  const paths = validatePaths(body.paths || []);
  if (body.all) await git(['restore', '--staged', '.']);
  else {
    if (!paths.length) throw new ToolError('请先选择文件', '', '勾选需要移出提交的文件。', 'NO_SELECTION', 400);
    await git(['restore', '--staged', '--', ...paths]);
  }
  return { message: body.all ? '全部文件已移出本次提交。' : `已移出 ${paths.length} 个文件。` };
}

async function createCommit(body) {
  const message = String(body.message || '').trim();
  if (!message) throw new ToolError('请填写提交说明', '', '用一句话概括这次更新。', 'EMPTY_MESSAGE', 400);
  if (message.length > 5000) throw new ToolError('提交说明过长', '', '请将提交说明控制在 5000 字以内。', 'MESSAGE_TOO_LONG', 400);
  const staged = await git(['diff', '--cached', '--name-only']);
  if (!staged.stdout) throw new ToolError('没有已加入提交的文件', '', '先选择文件并点击“加入本次提交”。', 'NOTHING_TO_COMMIT', 400);
  const result = await git(['commit', '-m', message]);
  return { message: '提交创建成功。', output: [result.stdout, result.stderr].filter(Boolean).join('\n') };
}

async function undoLatestCommit(body) {
  const status = await getStatus();
  if (!status.upstream) {
    throw new ToolError(
      '当前分支还没有上游分支',
      '',
      '首次推送前请保留至少一个提交，或先设置上游分支。',
      'NO_UPSTREAM',
      400,
    );
  }
  if (status.ahead < 1 || !status.pushCommits.length) {
    throw new ToolError(
      '没有可以撤销的待推送提交',
      '',
      '只能撤销尚未推送到 GitHub 的提交。',
      'NOTHING_TO_UNDO',
      400,
    );
  }
  if (status.counts.conflicted) {
    throw new ToolError(
      '存在冲突文件，暂时无法撤销提交',
      '',
      '请先解决当前冲突。',
      'MERGE_CONFLICT',
      409,
    );
  }

  const latest = status.pushCommits[0];
  const expectedSha = String(body.expectedSha || '');
  if (expectedSha && expectedSha !== latest.sha) {
    throw new ToolError(
      '待推送提交已经发生变化',
      `页面中的提交是 ${expectedSha.slice(0, 7)}，当前最新提交是 ${latest.shortSha}。`,
      '请刷新页面后重新确认。',
      'COMMIT_CHANGED',
      409,
    );
  }

  const result = await git(['reset', '--mixed', 'HEAD~1']);
  return {
    message: `已撤销提交 ${latest.shortSha}，文件修改已退回工作区。`,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
    undone: latest,
  };
}

async function buildSite() {
  if (process.platform === 'win32') {
    const commandPrompt = process.env.ComSpec || 'cmd.exe';
    return run(commandPrompt, ['/d', '/s', '/c', 'npm.cmd run build'], { timeout: 300000 });
  }
  return run('npm', ['run', 'build'], { timeout: 300000 });
}

async function pushChanges(body) {
  const status = await getStatus();
  if (status.counts.conflicted) {
    throw new ToolError('存在冲突文件，无法推送', '', '请先解决冲突并提交。', 'MERGE_CONFLICT', 409);
  }
  if ((status.counts.staged || status.counts.unstaged) && !body.allowUncommitted) {
    throw new ToolError(
      '还有尚未提交的文件',
      `当前有 ${status.counts.changed} 个工作区变更，这些内容不会被推送。`,
      '确认只推送已有提交，或先完成本次提交。',
      'UNCOMMITTED_CHANGES',
      409,
    );
  }
  if (status.upstream && status.ahead === 0) {
    throw new ToolError('没有需要推送的新提交', '', '先创建提交，或点击“获取远程状态”刷新。', 'NOTHING_TO_PUSH', 400);
  }
  let buildOutput = '';
  if (body.runBuild !== false) {
    const built = await buildSite();
    buildOutput = [built.stdout, built.stderr].filter(Boolean).join('\n');
  }
  const args = status.upstream ? ['push'] : ['push', '-u', 'origin', status.branch];
  const pushed = await git(args, { timeout: 180000 });
  return {
    message: '推送成功，GitHub Pages 将自动开始部署。',
    output: [buildOutput, pushed.stdout, pushed.stderr].filter(Boolean).join('\n'),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new ToolError('请求内容过大', '', '', 'BODY_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ToolError('请求内容格式错误', '', '', 'INVALID_JSON', 400);
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(pathname, response) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(UI_DIR, normalize(relative));
  if (!filePath.startsWith(`${UI_DIR}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(response, 404, { error: { message: '页面不存在' } });
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(readFileSync(filePath));
}

let server;

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${HOST}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'POST' && request.headers['x-deploy-tool'] !== 'local') {
        throw new ToolError('请求来源无效', '', '请刷新工具页面后重试。', 'INVALID_ORIGIN', 403);
      }

      if (request.method === 'GET' && url.pathname === '/api/status') return sendJson(response, 200, await getStatus());
      if (request.method === 'GET' && url.pathname === '/api/history') return sendJson(response, 200, { commits: await getHistory() });
      if (request.method === 'GET' && url.pathname === '/api/diff') return sendJson(response, 200, await getDiff(url.searchParams));
      if (request.method === 'GET' && url.pathname === '/api/commit') return sendJson(response, 200, await getCommit(url.searchParams.get('sha') || ''));

      if (request.method === 'POST' && url.pathname === '/api/stage') return sendJson(response, 200, await stageFiles(await readJsonBody(request)));
      if (request.method === 'POST' && url.pathname === '/api/unstage') return sendJson(response, 200, await unstageFiles(await readJsonBody(request)));
      if (request.method === 'POST' && url.pathname === '/api/commit') return sendJson(response, 200, await createCommit(await readJsonBody(request)));
      if (request.method === 'POST' && url.pathname === '/api/undo-commit') return sendJson(response, 200, await undoLatestCommit(await readJsonBody(request)));
      if (request.method === 'POST' && url.pathname === '/api/push') return sendJson(response, 200, await pushChanges(await readJsonBody(request)));
      if (request.method === 'POST' && url.pathname === '/api/fetch') {
        const fetched = await git(['fetch', '--prune', 'origin'], { timeout: 180000 });
        return sendJson(response, 200, { message: '远程状态已更新。', output: [fetched.stdout, fetched.stderr].filter(Boolean).join('\n') });
      }
      if (request.method === 'POST' && url.pathname === '/api/shutdown') {
        sendJson(response, 200, { message: '发布工具已关闭，可以关闭此页面。' });
        setTimeout(() => server.close(() => process.exit(0)), 150);
        return;
      }
      return sendJson(response, 404, { error: { message: '接口不存在' } });
    }
    serveStatic(url.pathname, response);
  } catch (error) {
    const known = error instanceof ToolError ? error : new ToolError('发生了未预期的错误', error.stack || error.message);
    sendJson(response, known.status || 500, {
      error: {
        message: known.message,
        details: known.details,
        suggestion: known.suggestion,
        code: known.code,
      },
    });
  }
}

function openBrowser(url) {
  const options = { detached: true, stdio: 'ignore', windowsHide: true };
  try {
    if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], options).unref();
    else if (process.platform === 'darwin') spawn('open', [url], options).unref();
    else spawn('xdg-open', [url], options).unref();
  } catch {
    // The URL is also printed below, so a browser launch failure is recoverable.
  }
}

function start(port) {
  server = createServer(handleRequest);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < START_PORT + 20) start(port + 1);
    else {
      console.error(`发布工具启动失败：${error.message}`);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log('');
    console.log('  Favorites 发布台已启动');
    console.log(`  ${url}`);
    console.log('  在页面右上角点击“关闭工具”即可结束。');
    console.log('');
    if (process.env.DEPLOY_TOOL_NO_OPEN !== '1') openBrowser(url);
  });
}

start(START_PORT);
