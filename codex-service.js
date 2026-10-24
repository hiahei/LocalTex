const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createCodexAppServerClient } = require('./codex-app-server');

const MAX_USER_PROMPT = 12_000;
const MAX_SELECTION = 40_000;
const MAX_ACTIVE_FILE = 120_000;
const MAX_COMPILE_LOG = 48_000;
const MAX_RETAINED_EVENTS = 240;
const TERMINAL_JOB_TTL = 60 * 60 * 1000;
const MAX_HISTORY_SEARCH = 120;
const MAX_THREAD_NAME = 120;
const MAX_MODEL_ID = 160;
const THREAD_TURN_PAGE_SIZE = 50;
const MAX_THREAD_TURNS = 200;
const reasoningEfforts = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);
const visibleThreadSourceKinds = Object.freeze([
  'cli',
  'vscode',
  'exec',
  'appServer',
  'unknown',
]);

const permissionProfiles = Object.freeze({
  'read-only': Object.freeze({
    mode: 'read-only',
    label: '只读',
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  }),
  'workspace-write': Object.freeze({
    mode: 'workspace-write',
    label: '项目可写',
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  }),
  'full-access': Object.freeze({
    mode: 'full-access',
    label: 'Full access',
    sandboxMode: 'danger-full-access',
    approvalPolicy: 'never',
    networkAccessEnabled: true,
    webSearchMode: 'live',
  }),
});

const readableExtensions = new Set([
  '.bib',
  '.bst',
  '.cls',
  '.csv',
  '.json',
  '.md',
  '.sty',
  '.tex',
  '.txt',
  '.yaml',
  '.yml',
]);

const fileChangeLabels = Object.freeze({
  add: '新增',
  delete: '删除',
  update: '修改',
});

function displayFileChangePath(workingDirectory, value) {
  const rawPath = String(value || '').trim();
  if (!rawPath) return '';
  const workspace = path.resolve(workingDirectory || '.');
  const absolutePath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(workspace, rawPath);
  const relativePath = path.relative(workspace, absolutePath);
  if (!relativePath) return path.basename(absolutePath);
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath.replaceAll('\\', '/');
  }
  return path.basename(absolutePath) || rawPath;
}

function fileChangeView(item, workingDirectory) {
  const changes = (Array.isArray(item?.changes) ? item.changes : [])
    .slice(0, 100)
    .map((change) => ({
      kind: Object.hasOwn(fileChangeLabels, change?.kind) ? change.kind : 'update',
      path: displayFileChangePath(workingDirectory, change?.path),
    }))
    .filter((change) => change.path);
  return {
    status: item?.status === 'failed'
      ? 'failed'
      : item?.status === 'in_progress'
        ? 'in_progress'
        : 'completed',
    changes,
  };
}

function fileChangeSummary(changes, status = 'completed') {
  const safeChanges = Array.isArray(changes) ? changes : [];
  const heading = status === 'failed' ? '写入失败' : '正在写入';
  if (!safeChanges.length) return status === 'completed' ? '文件已写入。' : `${heading}。`;
  const lines = safeChanges.map((change) => {
    const label = fileChangeLabels[change.kind] || fileChangeLabels.update;
    return `${label} \`${String(change.path).replaceAll('`', '')}\``;
  });
  return status === 'completed'
    ? lines.join('\n')
    : `${heading}：\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

function conciseUserRequest(value, maximum = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '本次文件修改';
  return text.length > maximum ? `${text.slice(0, maximum)}…` : text;
}

function fallbackChangeSummary(userRequest, changes) {
  const uniqueChanges = new Map();
  for (const change of Array.isArray(changes) ? changes : []) {
    if (change?.path) uniqueChanges.set(change.path, change);
  }
  const files = [...uniqueChanges.values()].map((change) => {
    const label = fileChangeLabels[change.kind] || fileChangeLabels.update;
    return `${label} \`${String(change.path).replaceAll('`', '')}\``;
  });
  const fileLine = files.length <= 3
    ? files.join('；')
    : `${files.slice(0, 3).join('；')}；另有 ${files.length - 3} 个文件`;
  return [
    '修改总结：',
    `- 已按要求处理：${conciseUserRequest(userRequest)}`,
    fileLine ? `- 涉及文件：${fileLine}` : '',
  ].filter(Boolean).join('\n');
}

function boundedText(value, maximum, fromEnd = false) {
  const text = String(value || '');
  if (text.length <= maximum) return text;
  return fromEnd
    ? `[前文已省略]\n${text.slice(-maximum)}`
    : `${text.slice(0, maximum)}\n[后文已省略]`;
}

function normalizedThreadId(value) {
  const threadId = String(value || '').trim();
  if (!threadId) return '';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(threadId)) {
    throw new Error('Codex 对话标识无效。');
  }
  return threadId;
}

function normalizedThreadName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('请输入对话名称。');
  return name.slice(0, MAX_THREAD_NAME);
}

function normalizedModelId(value) {
  const model = String(value || '').trim();
  if (!model) return '';
  if (model.length > MAX_MODEL_ID || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(model)) {
    throw new Error('Codex 模型标识无效。');
  }
  return model;
}

function normalizedReasoningEffort(value) {
  const effort = String(value || '').trim().toLowerCase();
  if (!effort) return '';
  if (!reasoningEfforts.has(effort)) throw new Error('Codex 推理强度无效。');
  return effort;
}

function configuredModelId() {
  try {
    const config = fs.readFileSync(path.join(codexHome(), 'config.toml'), 'utf8');
    const match = config.match(/^\s*model\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? normalizedModelId(match[1]) : '';
  } catch {
    return '';
  }
}

function configuredReasoningEffort() {
  try {
    const config = fs.readFileSync(path.join(codexHome(), 'config.toml'), 'utf8');
    const match = config.match(/^\s*model_reasoning_effort\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    return match ? normalizedReasoningEffort(match[1]) : '';
  } catch {
    return '';
  }
}

function modelReasoningEfforts(entry) {
  if (!Array.isArray(entry?.supportedReasoningEfforts)) return [];
  const efforts = [];
  for (const value of entry.supportedReasoningEfforts) {
    const candidate = typeof value === 'string'
      ? value
      : value?.reasoningEffort || value?.effort || value?.value;
    try {
      const effort = normalizedReasoningEffort(candidate);
      if (effort && !efforts.includes(effort)) efforts.push(effort);
    } catch {
      // Ignore catalog values that this installed SDK cannot pass through.
    }
  }
  return efforts;
}

function localTeXDisplayPrompt(value) {
  const text = String(value || '').trim();
  const marker = '用户要求：\n';
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return text;
  return text
    .slice(markerIndex + marker.length)
    .split('\n\n---\n\n', 1)[0]
    .trim();
}

function userMessageText(content) {
  if (!Array.isArray(content)) return '';
  return content.flatMap((item) => {
    if (item?.type === 'text') return [item.text];
    if (item?.type === 'skill') return [`[Skill: ${item.name || path.basename(item.path || '')}]`];
    if (item?.type === 'mention') return [`[@${item.name || path.basename(item.path || '')}]`];
    if (item?.type === 'image' || item?.type === 'localImage') return ['[图片]'];
    if (item?.type === 'audio' || item?.type === 'localAudio') return ['[音频]'];
    return [];
  }).filter(Boolean).join('\n').trim();
}

function threadMessages(thread) {
  const messages = [];
  for (const turn of Array.isArray(thread?.turns) ? thread.turns : []) {
    const timestamp = Number(turn.startedAt || turn.completedAt || thread.updatedAt || 0) * 1000;
    for (const item of Array.isArray(turn.items) ? turn.items : []) {
      if (item?.type === 'userMessage') {
        const text = localTeXDisplayPrompt(userMessageText(item.content));
        if (text) messages.push({
          id: String(item.id || randomUUID()),
          role: 'user',
          text,
          createdAt: timestamp,
        });
      } else if (item?.type === 'agentMessage' && item.text) {
        messages.push({
          id: String(item.id || randomUUID()),
          role: 'assistant',
          text: String(item.text),
          createdAt: timestamp,
        });
      } else if (item?.type === 'fileChange') {
        const change = fileChangeView(item, thread?.cwd);
        messages.push({
          id: String(item.id || randomUUID()),
          role: 'activity',
          status: change.status,
          text: fileChangeSummary(change.changes, change.status),
          createdAt: timestamp,
        });
      }
    }
    if (turn?.status === 'failed' && turn.error?.message) {
      messages.push({
        id: `turn-error-${turn.id || randomUUID()}`,
        role: 'notice',
        text: String(turn.error.message),
        createdAt: timestamp,
      });
    }
  }
  return messages;
}

function threadView(thread, includeMessages = false, options = {}) {
  const preview = localTeXDisplayPrompt(thread?.preview);
  const view = {
    id: normalizedThreadId(thread?.id),
    name: String(thread?.name || '').trim(),
    preview: preview.slice(0, 500),
    cwd: String(thread?.cwd || ''),
    createdAt: Number(thread?.createdAt || 0) * 1000,
    updatedAt: Number(thread?.recencyAt || thread?.updatedAt || thread?.createdAt || 0) * 1000,
    source: String(thread?.source || ''),
    modelProvider: String(thread?.modelProvider || ''),
    status: String(thread?.status?.type || thread?.status || ''),
  };
  if (includeMessages) {
    const turns = Array.isArray(options.turns) ? options.turns : thread?.turns;
    view.messages = threadMessages({ ...thread, turns });
    view.loadedTurnCount = Array.isArray(turns) ? turns.length : 0;
    view.historyTruncated = options.historyTruncated === true;
  }
  return view;
}

function codexHome() {
  return path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
}

function resolveProjectFile(projectRoot, relativePath) {
  const root = path.resolve(projectRoot);
  const normalized = path.normalize(String(relativePath || '').replaceAll('\\', '/'));
  const absolute = path.resolve(root, normalized);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Codex 上下文文件不在当前项目中。');
  }
  return absolute;
}

function publicError(error) {
  const message = String(error?.message || error || 'Codex 运行失败。');
  return message
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[已隐藏的凭据]')
    .replace(/CODEX_API_KEY=[^\s]+/gi, 'CODEX_API_KEY=[已隐藏]');
}

function isContextWindowError(error) {
  if (error?.codexErrorInfo === 'contextWindowExceeded') return true;
  const message = String(error?.message || error || '');
  return /context[_ -]?(?:window|length).{0,48}(?:exceed|limit|maximum|full|overflow)|(?:exceed|full|overflow).{0,48}context[_ -]?(?:window|length)|maximum.{0,24}context|too many (?:input )?tokens|prompt (?:is )?too long|上下文.{0,24}(?:上限|超出|过长|已满)|输入.{0,24}token.{0,24}(?:上限|过多)/i.test(message);
}

function permissionInstruction(mode) {
  if (mode === 'full-access') {
    return '当前为 Full access：可以按用户要求修改文件、执行命令和使用网络。只处理用户明确要求的范围，执行删除、覆盖或其他难以恢复的操作前先仔细核对目标。';
  }
  if (mode === 'workspace-write') {
    return '当前为项目可写：可以按用户要求修改当前工作区文件并执行必要命令，但不要访问或修改工作区以外的内容。';
  }
  return '本次运行是只读分析：不要修改、创建或删除任何文件，不要执行会改变项目状态的命令。';
}

function buildPrompt(context, permissionMode = 'read-only') {
  const sections = [
    `你是 LocalTeX 中的论文写作与 LaTeX 助手。请使用与用户相同的语言回答。`,
    permissionInstruction(permissionMode),
    permissionMode === 'read-only'
      ? `请优先给出准确、可操作的建议；如果建议修改源码，请明确指出文件、位置和建议替换内容。`
      : `请根据用户要求直接完成必要修改和验证。只要写入了文件，最终回复必须以“修改总结：”开头，用 1–3 条简短内容具体说明改了什么以及验证结果；不要只说“已完成”“已修改文件”，也不要只列文件名。`,
    `主文档：${context.mainFile || '未指定'}\n当前文件：${context.activeFile || '未选择'}`,
    `用户要求：\n${boundedText(context.prompt, MAX_USER_PROMPT)}`,
  ];

  if (context.selection) {
    const lineLabel = context.selectionStartLine
      ? `（第 ${context.selectionStartLine}${context.selectionEndLine && context.selectionEndLine !== context.selectionStartLine ? `–${context.selectionEndLine}` : ''} 行）`
      : '';
    sections.push(`当前选区${lineLabel}：\n\n${boundedText(context.selection, MAX_SELECTION)}`);
  }

  if (context.activeFileContent) {
    sections.push(`当前文件内容（${context.activeFile}）：\n\n${boundedText(context.activeFileContent, MAX_ACTIVE_FILE)}`);
  }

  if (context.compileOutput) {
    sections.push(`最近一次编译日志：\n\n${boundedText(context.compileOutput, MAX_COMPILE_LOG, true)}`);
  }

  return sections.join('\n\n---\n\n');
}

class CodexService {
  constructor(options = {}) {
    this.clientPromise = null;
    this.historyClient = options.historyClient || createCodexAppServerClient();
    this.permissionMode = 'read-only';
    this.model = '';
    this.reasoningEffort = '';
    this.jobs = new Map();
    this.projectThreads = new Map();
    this.runningProjects = new Map();
  }

  status(canUse = false) {
    const available = fs.existsSync(path.join(
      __dirname,
      'node_modules',
      '@openai',
      'codex-sdk',
      'package.json',
    ));
    const home = codexHome();
    if (!canUse) {
      return {
        available,
        canUse: false,
        configured: false,
        authDetected: false,
        configSource: 'hidden',
        access: 'host-only',
        permissionMode: 'hidden',
        model: 'hidden',
        configuredModel: 'hidden',
        reasoningEffort: 'hidden',
        configuredReasoningEffort: 'hidden',
        sandbox: 'hidden',
      };
    }
    const permissions = this.permissions();
    return {
      available,
      canUse: available,
      configured: fs.existsSync(path.join(home, 'config.toml')),
      authDetected: fs.existsSync(path.join(home, 'auth.json')),
      configSource: process.env.CODEX_HOME ? 'CODEX_HOME' : 'default',
      access: 'host-only',
      permissionMode: permissions.mode,
      permissionLabel: permissions.label,
      model: this.model,
      configuredModel: configuredModelId(),
      reasoningEffort: this.reasoningEffort,
      configuredReasoningEffort: configuredReasoningEffort(),
      sandbox: permissions.sandboxMode,
      networkAccessEnabled: permissions.networkAccessEnabled,
      webSearchMode: permissions.webSearchMode,
    };
  }

  setPermissionMode(mode) {
    const normalizedMode = String(mode || '').trim();
    if (!permissionProfiles[normalizedMode]) throw new Error('Codex 权限模式无效。');
    this.permissionMode = normalizedMode;
    return this.permissions();
  }

  permissions() {
    return { ...permissionProfiles[this.permissionMode] };
  }

  setModel(model) {
    this.model = normalizedModelId(model);
    return this.model;
  }

  setReasoningEffort(effort) {
    this.reasoningEffort = normalizedReasoningEffort(effort);
    return this.reasoningEffort;
  }

  async client() {
    if (!this.clientPromise) {
      this.clientPromise = import('@openai/codex-sdk').then(({ Codex }) => new Codex());
    }
    return this.clientPromise;
  }

  async listThreads(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 60, 1), 100);
    const searchTerm = String(options.searchTerm || '').trim().slice(0, MAX_HISTORY_SEARCH);
    const cwd = String(options.cwd || '').trim();
    const result = await this.historyClient.request('thread/list', {
      archived: false,
      cursor: options.cursor ? String(options.cursor) : null,
      cwd: cwd || null,
      limit,
      searchTerm: searchTerm || null,
      sourceKinds: [...visibleThreadSourceKinds],
      sortKey: 'recency_at',
      sortDirection: 'desc',
    });
    return {
      threads: (Array.isArray(result?.data) ? result.data : []).map((thread) => threadView(thread)),
      nextCursor: String(result?.nextCursor || ''),
    };
  }

  async listModels() {
    const result = await this.historyClient.request('model/list', { includeHidden: false });
    const models = (Array.isArray(result?.data) ? result.data : [])
      .map((entry) => {
        const id = normalizedModelId(entry?.id || entry?.model);
        if (!id) return null;
        return {
          id,
          displayName: String(entry.displayName || id).trim().slice(0, 80),
          description: String(entry.description || '').trim().slice(0, 240),
          isDefault: entry.isDefault === true,
          defaultReasoningEffort: String(entry.defaultReasoningEffort || ''),
          supportedReasoningEfforts: modelReasoningEfforts(entry),
          inputModalities: Array.isArray(entry.inputModalities)
            ? entry.inputModalities.map((value) => String(value)).slice(0, 8)
            : ['text', 'image'],
        };
      })
      .filter(Boolean);
    return { models };
  }

  async readThread(threadId, includeMessages = true) {
    const normalizedId = normalizedThreadId(threadId);
    const result = await this.historyClient.request('thread/read', {
      threadId: normalizedId,
      includeTurns: false,
    });
    if (!result?.thread) throw new Error('Codex 对话不存在。');
    if (!includeMessages) return threadView(result.thread);

    const turns = [];
    const cursors = new Set();
    let cursor = null;
    let historyTruncated = false;
    do {
      const page = await this.historyClient.request('thread/turns/list', {
        threadId: normalizedId,
        cursor,
        limit: THREAD_TURN_PAGE_SIZE,
        sortDirection: 'desc',
        itemsView: 'summary',
      });
      const pageTurns = Array.isArray(page?.data) ? page.data : [];
      turns.push(...pageTurns.slice(0, MAX_THREAD_TURNS - turns.length));
      const nextCursor = String(page?.nextCursor || '');
      if (turns.length >= MAX_THREAD_TURNS) {
        historyTruncated = Boolean(nextCursor);
        break;
      }
      if (!nextCursor || cursors.has(nextCursor)) break;
      cursors.add(nextCursor);
      cursor = nextCursor;
    } while (cursor);

    turns.reverse();
    return threadView(result.thread, true, { turns, historyTruncated });
  }

  async compactThread(threadId) {
    const normalizedId = normalizedThreadId(threadId);
    await this.historyClient.request('thread/resume', {
      threadId: normalizedId,
      excludeTurns: true,
    });
    const compacted = typeof this.historyClient.waitForNotification === 'function'
      ? this.historyClient.waitForNotification((message) => (
          message?.method === 'thread/compacted'
          && message?.params?.threadId === normalizedId
        ))
      : null;
    try {
      await this.historyClient.request('thread/compact/start', { threadId: normalizedId });
      if (compacted) await compacted;
    } finally {
      compacted?.cancel?.();
      await this.historyClient.request('thread/unsubscribe', { threadId: normalizedId }).catch(() => {});
    }
  }

  async renameThread(threadId, name) {
    const normalizedId = normalizedThreadId(threadId);
    const normalizedName = normalizedThreadName(name);
    await this.historyClient.request('thread/name/set', {
      threadId: normalizedId,
      name: normalizedName,
    });
    const thread = await this.readThread(normalizedId, false);
    thread.name = normalizedName;
    return thread;
  }

  cleanup() {
    const cutoff = Date.now() - TERMINAL_JOB_TTL;
    for (const [id, job] of this.jobs) {
      if (job.finishedAt && job.finishedAt < cutoff) this.jobs.delete(id);
    }
  }

  emit(job, event) {
    const entry = {
      ...event,
      sequence: job.nextSequence,
      timestamp: new Date().toISOString(),
    };
    job.nextSequence += 1;
    job.events.push(entry);
    if (job.events.length > MAX_RETAINED_EVENTS) job.events.shift();
    for (const listener of [...job.listeners]) {
      try {
        listener(entry);
      } catch {
        job.listeners.delete(listener);
      }
    }
  }

  view(job) {
    return {
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      createdAt: job.createdAt,
      threadId: job.threadId || '',
      context: job.contextSummary,
    };
  }

  getJob(runId, projectId) {
    const job = this.jobs.get(String(runId || ''));
    if (!job || job.projectId !== projectId) throw new Error('Codex 任务不存在或不属于当前项目。');
    return job;
  }

  snapshot(runId, projectId, afterSequence = 0) {
    const job = this.getJob(runId, projectId);
    const after = Math.max(0, Number(afterSequence) || 0);
    const firstSequence = job.events[0]?.sequence || job.nextSequence;
    return {
      run: this.view(job),
      events: job.events.filter((event) => event.sequence > after),
      lastSequence: job.nextSequence - 1,
      truncated: after > 0 && after < firstSequence - 1,
    };
  }

  async start(project, requestContext, compileOutput = '') {
    this.cleanup();
    if (this.runningProjects.has(project.id)) {
      const error = new Error('当前项目已有一个 Codex 任务正在运行。');
      error.code = 'CODEX_BUSY';
      throw error;
    }

    const prompt = boundedText(requestContext.prompt, MAX_USER_PROMPT).trim();
    if (!prompt) throw new Error('请输入要交给 Codex 的任务。');

    const threadId = normalizedThreadId(requestContext.threadId);
    const permissions = this.permissions();
    const model = this.model;
    const reasoningEffort = this.reasoningEffort;
    let workingDirectory = project.path;
    if (threadId) {
      const selectedThread = await this.readThread(threadId, false);
      if (!selectedThread.cwd) throw new Error('这段 Codex 历史没有可用的工作区记录。');
      const originalWorkspace = path.resolve(selectedThread.cwd);
      const workspaceStat = await fsp.stat(originalWorkspace).catch(() => null);
      if (!workspaceStat?.isDirectory()) {
        throw new Error(`原 Codex 工作区已不存在：${originalWorkspace}`);
      }
      workingDirectory = originalWorkspace;
    }

    const activeFile = String(requestContext.activeFile || '').trim();
    let activeFileContent = '';
    if (requestContext.includeCurrentFile && activeFile) {
      const absolutePath = resolveProjectFile(project.path, activeFile);
      const extension = path.extname(absolutePath).toLowerCase();
      if (!readableExtensions.has(extension)) throw new Error('当前文件不适合作为 Codex 文本上下文。');
      activeFileContent = await fsp.readFile(absolutePath, 'utf8');
    }

    const context = {
      prompt,
      mainFile: String(requestContext.mainFile || project.mainFile || ''),
      activeFile,
      selection: requestContext.includeSelection ? boundedText(requestContext.selection, MAX_SELECTION) : '',
      selectionStartLine: Number(requestContext.selectionStartLine) || 0,
      selectionEndLine: Number(requestContext.selectionEndLine) || 0,
      activeFileContent,
      compileOutput: requestContext.includeCompileLog ? compileOutput : '',
    };

    const job = {
      id: randomUUID(),
      projectId: project.id,
      projectPath: workingDirectory,
      status: 'queued',
      createdAt: new Date().toISOString(),
      finishedAt: 0,
      nextSequence: 1,
      events: [],
      listeners: new Set(),
      assistantOutput: '',
      assistantMessageId: '',
      fileChanges: new Map(),
      abortController: new AbortController(),
      threadId,
      newThread: Boolean(requestContext.newThread),
      permissions,
      model,
      reasoningEffort,
      userRequest: prompt,
      prompt: buildPrompt(context, permissions.mode),
      contextSummary: {
        activeFile: context.activeFile,
        mainFile: context.mainFile,
        includesSelection: Boolean(context.selection),
        includesCurrentFile: Boolean(context.activeFileContent),
        includesCompileLog: Boolean(context.compileOutput),
        permissionMode: permissions.mode,
        model: model || configuredModelId(),
        reasoningEffort: reasoningEffort || configuredReasoningEffort(),
        workspace: workingDirectory,
      },
    };

    this.jobs.set(job.id, job);
    this.runningProjects.set(project.id, job.id);
    this.emit(job, { type: 'status', status: 'queued', message: '正在准备本机 Codex…' });
    setImmediate(() => this.execute(job).catch(() => {}));
    return this.view(job);
  }

  async execute(job) {
    try {
      job.status = 'running';
      this.emit(job, { type: 'status', status: 'running', message: 'Codex 正在读取项目并分析…' });
      const client = await this.client();
      const threadOptions = {
        workingDirectory: job.projectPath,
        skipGitRepoCheck: true,
        sandboxMode: job.permissions.sandboxMode,
        approvalPolicy: job.permissions.approvalPolicy,
        networkAccessEnabled: job.permissions.networkAccessEnabled,
        webSearchMode: job.permissions.webSearchMode,
      };
      if (job.model) threadOptions.model = job.model;
      if (job.reasoningEffort) threadOptions.modelReasoningEffort = job.reasoningEffort;
      let thread = job.threadId
        ? client.resumeThread(job.threadId, threadOptions)
        : job.newThread
          ? null
          : this.projectThreads.get(job.projectId);
      if (!thread) {
        thread = client.startThread(threadOptions);
      }
      this.projectThreads.set(job.projectId, thread);

      const { events } = await thread.runStreamed(job.prompt, { signal: job.abortController.signal });
      for await (const event of events) {
        if (event.type === 'thread.started') {
          job.threadId = event.thread_id;
          this.emit(job, { type: 'thread', threadId: event.thread_id });
          continue;
        }
        if (event.type === 'item.started' && event.item.type === 'command_execution') {
          this.emit(job, { type: 'status', status: 'running', message: 'Codex 正在检查相关文件…' });
          continue;
        }
        if (
          (event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed')
          && event.item.type === 'file_change'
        ) {
          const change = fileChangeView(event.item, job.projectPath);
          const messageId = String(event.item.id || `file-change-${job.fileChanges.size + 1}`);
          job.fileChanges.set(messageId, change);
          this.emit(job, {
            type: 'file-change',
            messageId,
            status: change.status,
            changes: change.changes,
            text: fileChangeSummary(change.changes, change.status),
          });
          continue;
        }
        if ((event.type === 'item.updated' || event.type === 'item.completed') && event.item.type === 'agent_message') {
          const text = String(event.item.text || '');
          if (!text.trim()) continue;
          const messageId = String(event.item.id || job.assistantMessageId || `assistant-${job.id}`);
          job.assistantOutput = text;
          job.assistantMessageId = messageId;
          this.emit(job, {
            type: 'assistant',
            messageId,
            text,
            complete: event.type === 'item.completed',
          });
          continue;
        }
        if (event.type === 'item.completed' && event.item.type === 'error') {
          this.emit(job, { type: 'notice', level: 'error', message: event.item.message });
          continue;
        }
        if (event.type === 'turn.completed') {
          this.emit(job, { type: 'usage', usage: event.usage });
          continue;
        }
        if (event.type === 'turn.failed') {
          const turnError = new Error(event.error?.message || 'Codex 回合失败。');
          turnError.codexErrorInfo = event.error?.codexErrorInfo || null;
          throw turnError;
        }
        if (event.type === 'error') throw new Error(event.message || 'Codex 事件流失败。');
      }

      const completedChanges = [...job.fileChanges.values()]
        .filter((change) => change.status === 'completed')
        .flatMap((change) => change.changes);
      const failedChanges = [...job.fileChanges.values()]
        .filter((change) => change.status === 'failed')
        .flatMap((change) => change.changes);
      const uniqueCompletedFiles = new Set(completedChanges.map((change) => change.path));
      const filesChanged = uniqueCompletedFiles.size > 0;
      const fileChangesFailed = [...job.fileChanges.values()].some((change) => change.status === 'failed');
      if (!job.assistantOutput.trim()) {
        const fallbackText = filesChanged
          ? fallbackChangeSummary(job.userRequest, completedChanges)
          : fileChangesFailed
            ? '文件修改没有完成，请查看上方的失败记录。'
            : 'Codex 已完成，但没有返回文字说明。';
        const fallbackMessageId = `localtex-result-${job.id}`;
        job.assistantOutput = fallbackText;
        job.assistantMessageId = fallbackMessageId;
        this.emit(job, {
          type: 'assistant',
          messageId: fallbackMessageId,
          text: fallbackText,
          complete: true,
        });
      }

      job.status = 'completed';
      job.finishedAt = Date.now();
      const doneMessage = filesChanged
        ? `Codex 已完成 · 修改 ${uniqueCompletedFiles.size} 个文件`
        : fileChangesFailed || failedChanges.length
          ? 'Codex 已结束 · 文件修改失败'
          : 'Codex 已完成分析。';
      this.emit(job, {
        type: 'done',
        status: 'completed',
        message: doneMessage,
        filesChanged,
        fileChangesFailed,
        threadId: job.threadId || '',
        finalAssistant: {
          messageId: job.assistantMessageId,
          text: job.assistantOutput,
          complete: true,
        },
      });
    } catch (error) {
      const cancelled = job.abortController.signal.aborted;
      const filesChanged = [...job.fileChanges.values()]
        .some((change) => change.status === 'completed' && change.changes.length > 0);
      let contextRecovered = false;
      let failureMessage = publicError(error);
      if (!cancelled && job.threadId && isContextWindowError(error)) {
        this.emit(job, {
          type: 'status',
          status: 'running',
          message: '上下文已达上限，正在压缩历史…',
        });
        try {
          await this.compactThread(job.threadId);
          contextRecovered = true;
          failureMessage = '上下文已自动压缩。刚才的问题已放回输入框，点击发送即可继续。';
        } catch (compactionError) {
          failureMessage = `${failureMessage} 自动压缩失败：${publicError(compactionError)}`;
        }
      }
      job.status = cancelled ? 'cancelled' : 'failed';
      job.finishedAt = Date.now();
      this.emit(job, {
        type: cancelled ? 'done' : 'error',
        status: job.status,
        message: cancelled ? 'Codex 任务已停止。' : failureMessage,
        filesChanged,
        threadId: job.threadId || '',
        recoverable: contextRecovered ? 'context-window' : '',
        retryPrompt: contextRecovered ? job.userRequest : '',
        finalAssistant: job.assistantOutput.trim()
          ? {
              messageId: job.assistantMessageId || `assistant-${job.id}`,
              text: job.assistantOutput,
              complete: true,
            }
          : null,
      });
    } finally {
      if (this.runningProjects.get(job.projectId) === job.id) this.runningProjects.delete(job.projectId);
    }
  }

  subscribe(runId, projectId, afterSequence, listener) {
    const job = this.getJob(runId, projectId);
    const after = Number(afterSequence) || 0;
    for (const event of job.events) {
      if (event.sequence > after) listener(event);
    }
    if (!job.finishedAt) job.listeners.add(listener);
    return {
      job: this.view(job),
      unsubscribe: () => job.listeners.delete(listener),
    };
  }

  cancel(runId, projectId) {
    const job = this.getJob(runId, projectId);
    if (!job.finishedAt) job.abortController.abort();
    return this.view(job);
  }

  shutdown() {
    for (const job of this.jobs.values()) {
      if (!job.finishedAt) job.abortController.abort();
    }
    this.historyClient.close?.();
  }
}

function createCodexService(options = {}) {
  return new CodexService(options);
}

module.exports = {
  buildPrompt,
  createCodexService,
  localTeXDisplayPrompt,
};
