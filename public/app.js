const ACCESS_TOKEN_STORAGE_KEY = 'localtex.lan-token.v1';
const COLLABORATOR_STORAGE_KEY = 'localtex.collaborator.v1';
const COLLABORATOR_COLORS = ['#176b5a', '#7555a6', '#b15c32', '#2d7194', '#a14368', '#557d34', '#8a641c', '#465c92'];

function readAccessToken() {
  const currentUrl = new URL(window.location.href);
  const tokenFromUrl = currentUrl.searchParams.get('token');
  try {
    if (tokenFromUrl) {
      sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokenFromUrl);
      currentUrl.searchParams.delete('token');
      window.history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    return tokenFromUrl || sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';
  } catch {
    return tokenFromUrl || '';
  }
}

function projectIdFromUrl() {
  try {
    return new URL(window.location.href).searchParams.get('project') || '';
  } catch {
    return '';
  }
}

function updateProjectUrl(projectId = '') {
  const currentUrl = new URL(window.location.href);
  if (projectId) currentUrl.searchParams.set('project', projectId);
  else currentUrl.searchParams.delete('project');
  window.history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}

function loadCollaborator() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLABORATOR_STORAGE_KEY));
    if (saved?.id && saved?.name) return saved;
  } catch {
    // Generate a local identity below.
  }
  const id = globalThis.crypto?.randomUUID?.() || `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    name: `作者 ${id.slice(0, 4)}`,
    color: Math.abs([...id].reduce((sum, character) => sum + character.charCodeAt(0), 0)) % COLLABORATOR_COLORS.length,
  };
}

const accessToken = readAccessToken();

const elements = {
  activeFile: document.querySelector('#activeFile'),
  addPathButton: document.querySelector('#addPathButton'),
  compileButton: document.querySelector('#compileButton'),
  compileLog: document.querySelector('#compileLog'),
  compileTime: document.querySelector('#compileTime'),
  compilerStatus: document.querySelector('#compilerStatus'),
  collapseSidebarButton: document.querySelector('#collapseSidebarButton'),
  collaborationButton: document.querySelector('#collaborationButton'),
  collaborationLabel: document.querySelector('#collaborationLabel'),
  collaboratorList: document.querySelector('#collaboratorList'),
  collaboratorNameInput: document.querySelector('#collaboratorNameInput'),
  codexCompileLogContext: document.querySelector('#codexCompileLogContext'),
  codexCollapseButton: document.querySelector('#codexCollapseButton'),
  codexComposer: document.querySelector('#codexComposer'),
  codexConversationRefreshButton: document.querySelector('#codexConversationRefreshButton'),
  codexCurrentFileContext: document.querySelector('#codexCurrentFileContext'),
  codexCurrentFileLabel: document.querySelector('#codexCurrentFileLabel'),
  codexEmpty: document.querySelector('#codexEmpty'),
  codexLocalStatus: document.querySelector('#codexLocalStatus'),
  codexExpandButton: document.querySelector('#codexExpandButton'),
  codexHistoryCount: document.querySelector('#codexHistoryCount'),
  codexHistoryCurrent: document.querySelector('#codexHistoryCurrent'),
  codexHistoryBody: document.querySelector('#codexHistoryBody'),
  codexHistoryList: document.querySelector('#codexHistoryList'),
  codexHistoryMoreButton: document.querySelector('#codexHistoryMoreButton'),
  codexHistoryRefreshButton: document.querySelector('#codexHistoryRefreshButton'),
  codexHistorySearch: document.querySelector('#codexHistorySearch'),
  codexHistorySection: document.querySelector('#codexHistorySection'),
  codexHistoryToggleButton: document.querySelector('#codexHistoryToggleButton'),
  codexMessages: document.querySelector('#codexMessages'),
  codexModelPicker: document.querySelector('#codexModelPicker'),
  codexModelSelect: document.querySelector('#codexModelSelect'),
  codexNewThreadButton: document.querySelector('#codexNewThreadButton'),
  codexPanel: document.querySelector('#codexPanel'),
  codexPermissionPicker: document.querySelector('#codexPermissionPicker'),
  codexPermissionSelect: document.querySelector('#codexPermissionSelect'),
  codexPrompt: document.querySelector('#codexPrompt'),
  codexReasoningPicker: document.querySelector('#codexReasoningPicker'),
  codexReasoningSelect: document.querySelector('#codexReasoningSelect'),
  codexRenameCancelButton: document.querySelector('#codexRenameCancelButton'),
  codexRenameForm: document.querySelector('#codexRenameForm'),
  codexRenameInput: document.querySelector('#codexRenameInput'),
  codexResizer: document.querySelector('#codexResizer'),
  codexRunStatus: document.querySelector('#codexRunStatus'),
  codexSelectionContext: document.querySelector('#codexSelectionContext'),
  codexSelectionLabel: document.querySelector('#codexSelectionLabel'),
  codexSendButton: document.querySelector('#codexSendButton'),
  codexStopButton: document.querySelector('#codexStopButton'),
  codexWorkspaceFilter: document.querySelector('#codexWorkspaceFilter'),
  copyShareButton: document.querySelector('#copyShareButton'),
  copyShareLabel: document.querySelector('#copyShareLabel'),
  cursorPosition: document.querySelector('#cursorPosition'),
  diagnostics: document.querySelector('#diagnostics'),
  dirtyIndicator: document.querySelector('#dirtyIndicator'),
  editor: document.querySelector('#editor'),
  editorApp: document.querySelector('#editorApp'),
  editorFindbar: document.querySelector('#editorFindbar'),
  editorFindClose: document.querySelector('#editorFindClose'),
  editorFindCount: document.querySelector('#editorFindCount'),
  editorFindInput: document.querySelector('#editorFindInput'),
  editorFindNext: document.querySelector('#editorFindNext'),
  editorFindPrevious: document.querySelector('#editorFindPrevious'),
  editorPane: document.querySelector('#editorPane'),
  editorSurface: document.querySelector('#editorSurface'),
  editorThemeButton: document.querySelector('#editorThemeButton'),
  expandSidebarButton: document.querySelector('#expandSidebarButton'),
  fileTree: document.querySelector('#fileTree'),
  fileType: document.querySelector('#fileType'),
  fontDecreaseButton: document.querySelector('#fontDecreaseButton'),
  fontIncreaseButton: document.querySelector('#fontIncreaseButton'),
  fontSizeLabel: document.querySelector('#fontSizeLabel'),
  homeCompilerStatus: document.querySelector('#homeCompilerStatus'),
  homeShareButton: document.querySelector('#homeShareButton'),
  homeThemeButton: document.querySelector('#homeThemeButton'),
  hostProjectActions: document.querySelector('#hostProjectActions'),
  localModeBadge: document.querySelector('#localModeBadge'),
  localModeLabel: document.querySelector('#localModeLabel'),
  logPanel: document.querySelector('#logPanel'),
  logTab: document.querySelector('#logTab'),
  mainDocumentSelect: document.querySelector('#mainDocumentSelect'),
  newFileButton: document.querySelector('#newFileButton'),
  openFolderButton: document.querySelector('#openFolderButton'),
  openTexButton: document.querySelector('#openTexButton'),
  pdfPanel: document.querySelector('#pdfPanel'),
  pdfPages: document.querySelector('#pdfPages'),
  pdfPreview: document.querySelector('#pdfPreview'),
  pdfRenderStatus: document.querySelector('#pdfRenderStatus'),
  pdfDownloadButton: document.querySelector('#pdfDownloadButton'),
  pdfPageIndicator: document.querySelector('#pdfPageIndicator'),
  pdfResetZoomButton: document.querySelector('#pdfResetZoomButton'),
  pdfSyncHint: document.querySelector('#pdfSyncHint'),
  pdfTab: document.querySelector('#pdfTab'),
  previewEmpty: document.querySelector('#previewEmpty'),
  previewPane: document.querySelector('#previewPane'),
  previewResizer: document.querySelector('#previewResizer'),
  projectCount: document.querySelector('#projectCount'),
  projectHome: document.querySelector('#projectHome'),
  projectList: document.querySelector('#projectList'),
  projectSearch: document.querySelector('#projectSearch'),
  projectsButton: document.querySelector('#projectsButton'),
  refreshButton: document.querySelector('#refreshButton'),
  resumeServiceButton: document.querySelector('#resumeServiceButton'),
  saveStatus: document.querySelector('#saveStatus'),
  serviceControl: document.querySelector('#serviceControl'),
  serviceModeDescription: document.querySelector('#serviceModeDescription'),
  serviceRunMode: document.querySelector('#serviceRunMode'),
  servicePausedScreen: document.querySelector('#servicePausedScreen'),
  shareControl: document.querySelector('#shareControl'),
  shareControlStatus: document.querySelector('#shareControlStatus'),
  shareControlTitle: document.querySelector('#shareControlTitle'),
  shareDialog: document.querySelector('#shareDialog'),
  shareDialogClose: document.querySelector('#shareDialogClose'),
  shareDialogDescription: document.querySelector('#shareDialogDescription'),
  shareLinkBlock: document.querySelector('#shareLinkBlock'),
  shareStartGuide: document.querySelector('#shareStartGuide'),
  shareToggleButton: document.querySelector('#shareToggleButton'),
  shareToggleLabel: document.querySelector('#shareToggleLabel'),
  shareUrl: document.querySelector('#shareUrl'),
  sidebarPane: document.querySelector('#sidebarPane'),
  sidebarResizer: document.querySelector('#sidebarResizer'),
  sidebarModeLabel: document.querySelector('#sidebarModeLabel'),
  sourceToPdfButton: document.querySelector('#sourceToPdfButton'),
  toast: document.querySelector('#toast'),
  uploadButton: document.querySelector('#uploadButton'),
  uploadInput: document.querySelector('#uploadInput'),
  currentProjectName: document.querySelector('#currentProjectName'),
  workspaceLayout: document.querySelector('#workspaceLayout'),
  workspacePath: document.querySelector('#workspacePath'),
  workServiceToggle: document.querySelector('#workServiceToggle'),
  wrapButton: document.querySelector('#wrapButton'),
};

const state = {
  projects: [],
  activeProject: null,
  files: [],
  activePath: null,
  selectedPath: null,
  savedContent: '',
  dirty: false,
  mainDocument: '',
  compileRunning: false,
  compileStale: true,
  config: null,
  projectQuery: '',
  collapsedFolders: new Set(),
};

const collaborationState = {
  collaborator: loadCollaborator(),
  session: null,
  users: [],
};
let collaboratorNameSaveTimer = 0;
let copyShareFeedbackTimer = 0;

const pdfPreviewState = {
  document: null,
  loadingTask: null,
  textLayerBuilders: [],
  renderGeneration: 0,
  renderSequence: 0,
  renderTimer: 0,
  pageIndicatorFrame: 0,
  source: '',
  mainFile: '',
  previewPath: '',
  savedView: null,
  zoom: 1,
};
const pdfPanState = {
  active: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
};
const synctexState = {
  editorMarker: null,
  editorMarkerTimer: 0,
  pdfMarkerTimer: 0,
};
const codexState = {
  runId: '',
  eventSource: null,
  eventPollTimer: 0,
  eventPollFailures: 0,
  lastEventSequence: 0,
  running: false,
  newThread: true,
  compileLogAvailable: false,
  messageNodes: new Map(),
  activityNodes: new Map(),
  thinkingNode: null,
  filesChanged: false,
  threads: [],
  activeThreadId: '',
  activeThread: null,
  messages: [],
  historyCursor: '',
  historyCollapsed: false,
  historyLoading: false,
  historyRequestSequence: 0,
  historySearchTimer: 0,
  threadRequestSequence: 0,
  renameThreadId: '',
  workspaceFilter: '',
  workspaces: new Map(),
  models: [],
  modelsLoaded: false,
  modelsLoading: false,
};
const CODEX_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'];
const CODEX_REASONING_LABELS = Object.freeze({
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
});
const CODEX_MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\begin{equation}', right: '\\end{equation}', display: true },
  { left: '\\begin{equation*}', right: '\\end{equation*}', display: true },
  { left: '\\begin{align}', right: '\\end{align}', display: true },
  { left: '\\begin{align*}', right: '\\end{align*}', display: true },
  { left: '\\begin{gather}', right: '\\end{gather}', display: true },
  { left: '\\begin{gather*}', right: '\\end{gather*}', display: true },
  { left: '\\(', right: '\\)', display: false },
  { left: '$', right: '$', display: false },
];
let pdfJsRuntimePromise = null;
let pdfJsViewerRuntimePromise = null;

const PANEL_LAYOUT_STORAGE_KEY = 'localtex.panel-layout.v1';
const panelLayout = {
  activeDrag: null,
  editorResizeFrame: 0,
  preferred: loadPanelLayout(),
  resizeFrame: 0,
};

const EDITOR_VIEW_STORAGE_KEY = 'localtex.editor-view.v1';
const THEME_STORAGE_KEY = 'localtex.theme.v1';
const EDITOR_FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
let activeTheme = loadTheme();
const editorView = loadEditorView();
const codeEditor = initializeCodeEditor();
applyTheme(activeTheme, false);

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Use the light theme when browser storage is unavailable.
  }
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, persist = true) {
  activeTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.style.colorScheme = activeTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    activeTheme === 'dark' ? '#10171a' : '#edf2f0',
  );
  // Keep the writing surface paper-white in both application themes.
  codeEditor.setTheme('ace/theme/textmate');

  const dark = activeTheme === 'dark';
  for (const button of [elements.homeThemeButton, elements.editorThemeButton]) {
    const label = dark ? '切换到白天模式' : '切换到夜间模式';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(dark));
    button.querySelector('.theme-toggle-icon').textContent = dark ? '☀' : '☾';
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    } catch {
      // The current page can still switch themes without persistence.
    }
  }
}

function toggleTheme() {
  applyTheme(activeTheme === 'dark' ? 'light' : 'dark');
}

function initializeCodeEditor() {
  if (!window.ace) throw new Error('Ace editor failed to load.');

  window.ace.config.set('basePath', '/vendor/ace');
  window.ace.config.set('modePath', '/vendor/ace');
  window.ace.config.set('themePath', '/vendor/ace');

  const editor = window.ace.edit(elements.editor);
  editor.setTheme('ace/theme/textmate');
  editor.setOptions({
    animatedScroll: false,
    behavioursEnabled: true,
    displayIndentGuides: true,
    fadeFoldWidgets: true,
    fixedWidthGutter: true,
    fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
    highlightActiveLine: true,
    highlightGutterLine: true,
    highlightSelectedWord: true,
    navigateWithinSoftTabs: true,
    placeholder: '从左侧选择 .tex、.bib 或其他文本文件',
    scrollPastEnd: 0.22,
    showFoldWidgets: true,
    showPrintMargin: false,
    tabSize: 2,
    useSoftTabs: true,
  });
  editor.session.setMode('ace/mode/latex');
  editor.session.setUseWorker(false);
  editor.renderer.setScrollMargin(18, 36, 0, 0);
  editor.setReadOnly(true);

  const textInput = editor.textInput.getElement();
  textInput.setAttribute('aria-label', 'LaTeX 文件内容');
  textInput.setAttribute('spellcheck', 'false');

  editor.commands.addCommand({
    name: 'localtexSave',
    bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
    exec: () => compileDocument(),
  });
  editor.commands.addCommand({
    name: 'find',
    bindKey: { win: 'Ctrl-F', mac: 'Command-F' },
    exec: () => openEditorFindbar(),
    readOnly: true,
  });
  editor.commands.addCommand({
    name: 'localtexToggleWrap',
    bindKey: { win: 'Alt-Z', mac: 'Alt-Z' },
    exec: () => toggleEditorWrap(),
  });

  return editor;
}

function editorModeForPath(filePath = '') {
  const extension = filePath.split('.').at(-1).toLowerCase();
  const modes = {
    bib: 'bibtex',
    bst: 'latex',
    cls: 'latex',
    css: 'css',
    html: 'html',
    js: 'javascript',
    json: 'json',
    md: 'markdown',
    sty: 'latex',
    tex: 'latex',
    txt: 'text',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return modes[extension] || 'text';
}

function setEditorMode(filePath) {
  codeEditor.session.setMode(`ace/mode/${editorModeForPath(filePath)}`);
}

function editorFindOccurrences(query) {
  if (!query) return [];
  const source = codeEditor.getValue().toLowerCase();
  const needle = query.toLowerCase();
  const occurrences = [];
  let offset = 0;
  while (offset <= source.length - needle.length) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    occurrences.push(index);
    offset = index + Math.max(needle.length, 1);
  }
  return occurrences;
}

function updateEditorFindCount() {
  const query = elements.editorFindInput.value;
  const occurrences = editorFindOccurrences(query);
  const range = codeEditor.getSelectionRange();
  const selectedText = codeEditor.session.getTextRange(range);
  const selectionIndex = codeEditor.session.getDocument().positionToIndex(range.start, 0);
  let currentIndex = -1;

  if (selectedText.toLowerCase() === query.toLowerCase()) {
    currentIndex = occurrences.indexOf(selectionIndex);
  }
  if (currentIndex < 0 && occurrences.length) {
    currentIndex = occurrences.findIndex((index) => index >= selectionIndex);
    if (currentIndex < 0) currentIndex = occurrences.length - 1;
  }

  elements.editorFindCount.textContent = !query
    ? '0 / 0'
    : occurrences.length
      ? `${currentIndex + 1} / ${occurrences.length}`
      : '无结果';
  elements.editorFindbar.classList.toggle('no-match', Boolean(query) && occurrences.length === 0);
  elements.editorFindPrevious.disabled = occurrences.length === 0;
  elements.editorFindNext.disabled = occurrences.length === 0;
}

function findEditorMatch(backwards = false, skipCurrent = true) {
  const query = elements.editorFindInput.value;
  if (!query) {
    codeEditor.session.highlight(null);
    updateEditorFindCount();
    return;
  }

  codeEditor.find(query, {
    backwards,
    caseSensitive: false,
    preventScroll: false,
    regExp: false,
    skipCurrent,
    wholeWord: false,
    wrap: true,
  });
  codeEditor.session.highlight(codeEditor.$search?.$options?.re || null);
  codeEditor.renderer.updateBackMarkers();
  updateEditorFindCount();
}

function openEditorFindbar() {
  if (!state.activePath) return;
  const wasHidden = elements.editorFindbar.hidden;
  const selection = codeEditor.getSelectedText();
  if (wasHidden && selection && !/[\r\n]/.test(selection) && selection.length <= 200) {
    elements.editorFindInput.value = selection;
  }
  elements.editorFindbar.hidden = false;
  elements.editorSurface.classList.add('findbar-open');
  requestAnimationFrame(() => codeEditor.resize(true));
  elements.editorFindInput.focus();
  elements.editorFindInput.select();
  findEditorMatch(false, false);
}

function closeEditorFindbar(restoreFocus = true) {
  if (elements.editorFindbar.hidden) return;
  elements.editorFindbar.hidden = true;
  elements.editorSurface.classList.remove('findbar-open');
  codeEditor.session.highlight(null);
  requestAnimationFrame(() => codeEditor.resize(true));
  if (restoreFocus) codeEditor.focus();
}

function loadEditorView() {
  const fallback = { fontSize: 14, wrap: false };
  try {
    const value = JSON.parse(localStorage.getItem(EDITOR_VIEW_STORAGE_KEY));
    const fontSize = EDITOR_FONT_SIZES.includes(value?.fontSize) ? value.fontSize : fallback.fontSize;
    return { fontSize, wrap: value?.wrap === true };
  } catch {
    return fallback;
  }
}

function saveEditorView() {
  try {
    localStorage.setItem(EDITOR_VIEW_STORAGE_KEY, JSON.stringify(editorView));
  } catch {
    // Display settings remain usable for the current page without browser storage.
  }
}

function applyEditorView() {
  elements.editorPane.style.setProperty('--editor-font-size', `${editorView.fontSize}px`);
  codeEditor.setFontSize(editorView.fontSize);
  codeEditor.session.setUseWrapMode(editorView.wrap);
  elements.wrapButton.classList.toggle('active', editorView.wrap);
  elements.wrapButton.setAttribute('aria-pressed', String(editorView.wrap));
  elements.fontSizeLabel.value = `${editorView.fontSize} px`;
  elements.fontSizeLabel.textContent = `${editorView.fontSize} px`;
  const index = EDITOR_FONT_SIZES.indexOf(editorView.fontSize);
  elements.fontDecreaseButton.disabled = index === 0;
  elements.fontIncreaseButton.disabled = index === EDITOR_FONT_SIZES.length - 1;
}

function changeEditorFontSize(direction) {
  const currentIndex = EDITOR_FONT_SIZES.indexOf(editorView.fontSize);
  const nextIndex = clamp(currentIndex + direction, 0, EDITOR_FONT_SIZES.length - 1);
  editorView.fontSize = EDITOR_FONT_SIZES[nextIndex];
  applyEditorView();
  saveEditorView();
}

function toggleEditorWrap() {
  editorView.wrap = !editorView.wrap;
  applyEditorView();
  saveEditorView();
}

function loadPanelLayout() {
  try {
    const value = JSON.parse(localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY));
    if (Number.isFinite(value?.sidebar) && Number.isFinite(value?.preview)) {
      return {
        sidebar: value.sidebar,
        preview: value.preview,
        codex: Number.isFinite(value.codex) ? value.codex : 380,
        sidebarCollapsed: value.sidebarCollapsed === true,
        codexCollapsed: value.codexCollapsed === true,
      };
    }
  } catch {
    // A missing or invalid preference should simply fall back to the CSS layout.
  }
  return null;
}

function isSidebarCollapsed() {
  return elements.workspaceLayout.classList.contains('sidebar-collapsed');
}

function isCodexCollapsed() {
  return elements.workspaceLayout.classList.contains('codex-collapsed');
}

function updateSidebarCollapseUi(collapsed) {
  elements.workspaceLayout.classList.toggle('sidebar-collapsed', collapsed);
  elements.sidebarPane.setAttribute('aria-hidden', String(collapsed));
  elements.sidebarResizer.setAttribute('aria-hidden', String(collapsed));
  elements.sidebarResizer.tabIndex = collapsed ? -1 : 0;
  elements.collapseSidebarButton.setAttribute('aria-expanded', String(!collapsed));
  elements.expandSidebarButton.setAttribute('aria-expanded', String(!collapsed));
  elements.expandSidebarButton.hidden = !collapsed;
}

function setSidebarCollapsed(collapsed) {
  const currentSizes = currentPanelSizes();
  const storedSidebar = isSidebarCollapsed()
    ? panelLayout.preferred?.sidebar || 230
    : currentSizes.sidebar;
  panelLayout.preferred = {
    sidebar: storedSidebar,
    preview: currentSizes.preview,
    codex: currentSizes.codex,
    sidebarCollapsed: collapsed,
    codexCollapsed: isCodexCollapsed(),
  };
  updateSidebarCollapseUi(collapsed);
  savePanelLayout();
  requestAnimationFrame(restorePanelLayout);
}

function updateCodexCollapseUi(collapsed) {
  const available = Boolean(state.config?.codex?.canUse);
  const effectiveCollapsed = collapsed || !available;
  elements.workspaceLayout.classList.toggle('codex-available', available);
  elements.workspaceLayout.classList.toggle('codex-collapsed', effectiveCollapsed);
  elements.codexPanel.hidden = !available;
  elements.codexResizer.hidden = !available;
  elements.codexPanel.setAttribute('aria-hidden', String(effectiveCollapsed));
  elements.codexResizer.setAttribute('aria-hidden', String(effectiveCollapsed));
  elements.codexResizer.tabIndex = effectiveCollapsed ? -1 : 0;
  elements.codexCollapseButton.disabled = !available;
  elements.codexCollapseButton.setAttribute('aria-expanded', String(!effectiveCollapsed));
  elements.codexExpandButton.hidden = !available || !effectiveCollapsed;
  elements.codexExpandButton.setAttribute('aria-expanded', String(!effectiveCollapsed));
}

function setCodexCollapsed(collapsed, focusControl = true) {
  if (!state.config?.codex?.canUse) return;
  const currentSizes = currentPanelSizes();
  const storedCodex = isCodexCollapsed()
    ? panelLayout.preferred?.codex || 380
    : currentSizes.codex;
  panelLayout.preferred = {
    sidebar: currentSizes.sidebar,
    preview: currentSizes.preview,
    codex: storedCodex,
    sidebarCollapsed: isSidebarCollapsed(),
    codexCollapsed: collapsed,
  };
  updateCodexCollapseUi(collapsed);
  savePanelLayout();
  requestAnimationFrame(() => {
    restorePanelLayout();
    if (focusControl) {
      if (collapsed) elements.codexExpandButton.focus();
      else elements.codexPrompt.focus();
    }
  });
}

function savePanelLayout() {
  if (!panelLayout.preferred) return;
  try {
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(panelLayout.preferred));
  } catch {
    // Resizing still works when browser storage is unavailable.
  }
}

function panelMinimums() {
  const width = elements.workspaceLayout.clientWidth;
  const sidebarCollapsed = isSidebarCollapsed();
  const codexCollapsed = isCodexCollapsed();
  const base = width < 1100
    ? {
      sidebar: sidebarCollapsed ? 0 : 145,
      editor: 260,
      preview: 230,
      codex: codexCollapsed ? 0 : 250,
    }
    : {
      sidebar: sidebarCollapsed ? 0 : 170,
      editor: 320,
      preview: 280,
      codex: codexCollapsed ? 0 : 300,
    };
  const dividerWidth = elements.sidebarResizer.offsetWidth
    + elements.previewResizer.offsetWidth
    + elements.codexResizer.offsetWidth;
  const available = Math.max(1, width - dividerWidth);
  const scale = Math.min(1, available / (base.sidebar + base.editor + base.preview + base.codex));
  return {
    sidebar: Math.floor(base.sidebar * scale),
    editor: Math.floor(base.editor * scale),
    preview: Math.floor(base.preview * scale),
    codex: Math.floor(base.codex * scale),
    available,
  };
}

function currentPanelSizes() {
  return {
    sidebar: isSidebarCollapsed()
      ? panelLayout.preferred?.sidebar || 230
      : elements.sidebarPane.getBoundingClientRect().width,
    preview: elements.previewPane.getBoundingClientRect().width,
    codex: isCodexCollapsed()
      ? panelLayout.preferred?.codex || 380
      : elements.codexPanel.getBoundingClientRect().width,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function fitPanelSizes(sidebarWidth, previewWidth, codexWidth) {
  const minimums = panelMinimums();
  const collapsedSidebar = isSidebarCollapsed();
  const collapsedCodex = isCodexCollapsed();
  const occupied = {
    sidebar: collapsedSidebar ? 0 : Math.max(minimums.sidebar, Number(sidebarWidth) || minimums.sidebar),
    preview: Math.max(minimums.preview, Number(previewWidth) || minimums.preview),
    codex: collapsedCodex ? 0 : Math.max(minimums.codex, Number(codexWidth) || minimums.codex),
  };
  const minimumByPanel = {
    sidebar: minimums.sidebar,
    preview: minimums.preview,
    codex: minimums.codex,
  };
  const fixedBudget = Math.max(0, minimums.available - minimums.editor);
  const occupiedTotal = occupied.sidebar + occupied.preview + occupied.codex;
  const excess = Math.max(0, occupiedTotal - fixedBudget);
  if (excess > 0) {
    const panels = ['preview', 'codex', 'sidebar'];
    const totalHeadroom = panels.reduce(
      (sum, panel) => sum + Math.max(0, occupied[panel] - minimumByPanel[panel]),
      0,
    );
    if (totalHeadroom > 0) {
      for (const panel of panels) {
        const headroom = Math.max(0, occupied[panel] - minimumByPanel[panel]);
        occupied[panel] -= Math.min(headroom, excess * (headroom / totalHeadroom));
      }
    }
  }
  return {
    sidebar: collapsedSidebar ? sidebarWidth : occupied.sidebar,
    preview: occupied.preview,
    codex: collapsedCodex ? codexWidth : occupied.codex,
  };
}

function updateResizerAccessibility(sizes = currentPanelSizes()) {
  const minimums = panelMinimums();
  const occupiedSidebar = isSidebarCollapsed() ? 0 : sizes.sidebar;
  const occupiedCodex = isCodexCollapsed() ? 0 : sizes.codex;
  const sidebarMaximum = minimums.available - minimums.editor - sizes.preview - occupiedCodex;
  const previewMaximum = minimums.available - minimums.editor - occupiedSidebar - occupiedCodex;
  const codexMaximum = minimums.available - minimums.editor - occupiedSidebar - sizes.preview;
  const values = [
    [elements.sidebarResizer, sizes.sidebar, minimums.sidebar, sidebarMaximum],
    [elements.previewResizer, sizes.preview, minimums.preview, previewMaximum],
    [elements.codexResizer, sizes.codex, minimums.codex, codexMaximum],
  ];
  for (const [resizer, value, minimum, maximum] of values) {
    resizer.setAttribute('aria-valuemin', String(Math.round(minimum)));
    resizer.setAttribute('aria-valuemax', String(Math.round(Math.max(minimum, maximum))));
    resizer.setAttribute('aria-valuenow', String(Math.round(value)));
    resizer.setAttribute('aria-valuetext', `${Math.round(value)} 像素`);
  }
}

function scheduleEditorResize() {
  cancelAnimationFrame(panelLayout.editorResizeFrame);
  panelLayout.editorResizeFrame = requestAnimationFrame(() => codeEditor.resize());
}

function applyPanelSizes(sidebarWidth, previewWidth, codexWidth) {
  elements.workspaceLayout.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  elements.workspaceLayout.style.setProperty('--preview-width', `${previewWidth}px`);
  elements.workspaceLayout.style.setProperty('--codex-width', `${codexWidth}px`);
  updateResizerAccessibility({ sidebar: sidebarWidth, preview: previewWidth, codex: codexWidth });
  scheduleEditorResize();
}

function restorePanelLayout() {
  updateSidebarCollapseUi(panelLayout.preferred?.sidebarCollapsed === true);
  updateCodexCollapseUi(panelLayout.preferred?.codexCollapsed === true);
  if (elements.workspaceLayout.clientWidth <= 0) return;
  const current = currentPanelSizes();
  const requested = panelLayout.preferred || current;
  const fitted = fitPanelSizes(requested.sidebar, requested.preview, requested.codex);
  applyPanelSizes(fitted.sidebar, fitted.preview, fitted.codex);
}

function resetPanelLayout() {
  panelLayout.preferred = null;
  updateSidebarCollapseUi(false);
  updateCodexCollapseUi(false);
  elements.workspaceLayout.style.removeProperty('--sidebar-width');
  elements.workspaceLayout.style.removeProperty('--preview-width');
  elements.workspaceLayout.style.removeProperty('--codex-width');
  try {
    localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY);
  } catch {
    // The CSS defaults are enough when browser storage is unavailable.
  }
  requestAnimationFrame(() => {
    updateResizerAccessibility();
    codeEditor.resize();
  });
  showToast('工作区布局已恢复默认。');
}

function resizedPanelSizes(kind, startSizes, deltaX) {
  const minimums = panelMinimums();
  const occupiedSidebar = isSidebarCollapsed() ? 0 : startSizes.sidebar;
  const occupiedCodex = isCodexCollapsed() ? 0 : startSizes.codex;
  if (kind === 'sidebar') {
    return {
      sidebar: clamp(
        startSizes.sidebar + deltaX,
        minimums.sidebar,
        minimums.available - startSizes.preview - occupiedCodex - minimums.editor,
      ),
      preview: startSizes.preview,
      codex: startSizes.codex,
    };
  }
  if (kind === 'codex') {
    const pairWidth = startSizes.preview + startSizes.codex;
    const preview = clamp(
      startSizes.preview + deltaX,
      minimums.preview,
      pairWidth - minimums.codex,
    );
    return {
      sidebar: startSizes.sidebar,
      preview,
      codex: pairWidth - preview,
    };
  }
  return {
    sidebar: startSizes.sidebar,
    preview: clamp(
      startSizes.preview - deltaX,
      minimums.preview,
      minimums.available - occupiedSidebar - occupiedCodex - minimums.editor,
    ),
    codex: startSizes.codex,
  };
}

function finishPanelResize(event) {
  if (!panelLayout.activeDrag) return;
  if (event?.pointerId !== undefined && event.pointerId !== panelLayout.activeDrag.pointerId) return;
  const { resizer, pointerId } = panelLayout.activeDrag;
  if (resizer.hasPointerCapture?.(pointerId)) resizer.releasePointerCapture(pointerId);
  resizer.classList.remove('active');
  document.body.classList.remove('resizing-panels');
  panelLayout.activeDrag = null;
  const sizes = currentPanelSizes();
  panelLayout.preferred = {
    sidebar: sizes.sidebar,
    preview: sizes.preview,
    codex: sizes.codex,
    sidebarCollapsed: isSidebarCollapsed(),
    codexCollapsed: isCodexCollapsed(),
  };
  savePanelLayout();
  updateResizerAccessibility(sizes);
}

function startPanelResize(event, kind) {
  if (event.button !== 0 || elements.workspaceLayout.clientWidth <= 0) return;
  event.preventDefault();
  const resizer = event.currentTarget;
  const sizes = currentPanelSizes();
  applyPanelSizes(sizes.sidebar, sizes.preview, sizes.codex);
  panelLayout.activeDrag = {
    kind,
    pointerId: event.pointerId,
    resizer,
    startX: event.clientX,
    startSizes: sizes,
  };
  resizer.setPointerCapture?.(event.pointerId);
  resizer.classList.add('active');
  document.body.classList.add('resizing-panels');
}

function movePanelResize(event) {
  const drag = panelLayout.activeDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  event.preventDefault();
  const sizes = resizedPanelSizes(drag.kind, drag.startSizes, event.clientX - drag.startX);
  applyPanelSizes(sizes.sidebar, sizes.preview, sizes.codex);
}

function resizePanelWithKeyboard(event, kind) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const step = event.shiftKey ? 40 : 12;
  const sizes = resizedPanelSizes(kind, currentPanelSizes(), direction * step);
  applyPanelSizes(sizes.sidebar, sizes.preview, sizes.codex);
  panelLayout.preferred = {
    ...sizes,
    sidebarCollapsed: isSidebarCollapsed(),
    codexCollapsed: isCodexCollapsed(),
  };
  savePanelLayout();
}

function initializePanelResizers() {
  const resizers = [
    [elements.sidebarResizer, 'sidebar'],
    [elements.previewResizer, 'preview'],
    [elements.codexResizer, 'codex'],
  ];
  for (const [resizer, kind] of resizers) {
    resizer.addEventListener('pointerdown', (event) => startPanelResize(event, kind));
    resizer.addEventListener('keydown', (event) => resizePanelWithKeyboard(event, kind));
    resizer.addEventListener('dblclick', resetPanelLayout);
  }
  elements.collapseSidebarButton.addEventListener('click', () => setSidebarCollapsed(!isSidebarCollapsed()));
  elements.expandSidebarButton.addEventListener('click', () => setSidebarCollapsed(false));
  elements.codexCollapseButton.addEventListener('click', () => setCodexCollapsed(true));
  elements.codexExpandButton.addEventListener('click', () => setCodexCollapsed(false));
  updateSidebarCollapseUi(panelLayout.preferred?.sidebarCollapsed === true);
  updateCodexCollapseUi(panelLayout.preferred?.codexCollapsed === true);
  window.addEventListener('pointermove', movePanelResize);
  window.addEventListener('pointerup', finishPanelResize);
  window.addEventListener('pointercancel', finishPanelResize);
  window.addEventListener('resize', () => {
    cancelAnimationFrame(panelLayout.resizeFrame);
    panelLayout.resizeFrame = requestAnimationFrame(restorePanelLayout);
  });
}

function encodeBinary(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBinary(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function renderCollaborators(users = []) {
  collaborationState.users = users;
  elements.collaboratorList.replaceChildren();
  for (const user of users.slice(0, 4)) {
    const avatar = document.createElement('span');
    avatar.className = 'collaborator-avatar';
    avatar.style.setProperty('--collaborator-color', COLLABORATOR_COLORS[user.color] || COLLABORATOR_COLORS[0]);
    avatar.textContent = String(user.name || '协').trim().slice(0, 1).toUpperCase();
    avatar.title = user.name || '协作者';
    elements.collaboratorList.append(avatar);
  }
  if (users.length > 4) {
    const more = document.createElement('span');
    more.className = 'collaborator-avatar more';
    more.textContent = `+${users.length - 4}`;
    elements.collaboratorList.append(more);
  }
}

function setCollaborationStatus(status, users = collaborationState.users) {
  elements.collaborationButton.dataset.state = status;
  renderCollaborators(users);
  const sharingEnabled = state.config?.lan?.enabled === true;
  const labels = {
    connected: sharingEnabled ? (users.length > 1 ? `${users.length} 人在线` : '协作已同步') : '仅本机',
    connecting: sharingEnabled ? '正在连接' : '本机同步中',
    offline: sharingEnabled ? '协作已离线' : '仅本机',
    ready: sharingEnabled ? '协作就绪' : '仅本机',
    local: '仅本机',
  };
  elements.collaborationLabel.textContent = labels[status] || labels.local;
  elements.collaborationButton.setAttribute('aria-label', `${elements.collaborationLabel.textContent}，点击查看协作设置`);
}

function sendPresence(session = collaborationState.session) {
  if (!session?.socket || session.socket.readyState !== WebSocket.OPEN) return;
  session.socket.send(JSON.stringify({
    type: 'presence',
    user: collaborationState.collaborator,
  }));
}

function bindSharedText(session) {
  if (session.bound) return;
  const editorDocument = codeEditor.session.getDocument();
  const Range = window.ace.require('ace/range').Range;

  session.onAceChange = (delta) => {
    if (session.applyingRemote || session.destroyed) return;
    const index = editorDocument.positionToIndex(delta.start, 0);
    const changedText = delta.lines.join('\n');
    session.document.transact(() => {
      if (delta.action === 'insert') session.text.insert(index, changedText);
      if (delta.action === 'remove') session.text.delete(index, changedText.length);
    }, session.localOrigin);
  };

  session.onSharedTextChange = (event) => {
    if (event.transaction.origin === session.localOrigin || session.destroyed) return;
    let index = 0;
    session.applyingRemote = true;
    try {
      for (const operation of event.delta) {
        if (operation.retain) index += operation.retain;
        if (operation.delete) {
          const start = editorDocument.indexToPosition(index, 0);
          const end = editorDocument.indexToPosition(index + operation.delete, 0);
          editorDocument.remove(Range.fromPoints(start, end));
        }
        if (typeof operation.insert === 'string') {
          const position = editorDocument.indexToPosition(index, 0);
          editorDocument.insert(position, operation.insert);
          index += operation.insert.length;
        }
      }
    } finally {
      session.applyingRemote = false;
    }
  };

  codeEditor.session.on('change', session.onAceChange);
  session.text.observe(session.onSharedTextChange);
  session.bound = true;
}

function collaborationSocketUrl(filePath) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${window.location.host}/collaboration`);
  url.searchParams.set('project', state.activeProject.id);
  url.searchParams.set('path', filePath);
  if (accessToken) url.searchParams.set('token', accessToken);
  return url.toString();
}

function finishInitialCollaboration(session, success) {
  if (!session.initialResolve) return;
  clearTimeout(session.initialTimer);
  const resolve = session.initialResolve;
  session.initialResolve = null;
  resolve(success);
}

function abandonInitialCollaboration(session) {
  if (session.destroyed) return;
  session.destroyed = true;
  clearTimeout(session.reconnectTimer);
  if (session.socket && session.socket.readyState < WebSocket.CLOSING) session.socket.close();
  session.document.destroy();
  if (collaborationState.session === session) collaborationState.session = null;
  codeEditor.setReadOnly(false);
  setCollaborationStatus('offline', []);
  finishInitialCollaboration(session, false);
}

function connectCollaborationSocket(session) {
  if (session.destroyed) return;
  setCollaborationStatus('connecting');
  const socket = new WebSocket(collaborationSocketUrl(session.path));
  session.socket = socket;

  socket.addEventListener('open', () => sendPresence(session));
  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if ((message.type === 'sync' || message.type === 'update') && typeof message.update === 'string') {
      session.Y.applyUpdate(session.document, decodeBinary(message.update), session.remoteOrigin);
      if (message.type === 'sync') {
        if (!session.bound) {
          const sharedContent = session.text.toString();
          if (codeEditor.getValue() !== sharedContent) codeEditor.setValue(sharedContent, -1);
          codeEditor.session.getUndoManager().reset();
          state.savedContent = sharedContent;
          setDirty(false);
          bindSharedText(session);
          codeEditor.setReadOnly(false);
          codeEditor.focus();
        }
        socket.send(JSON.stringify({
          type: 'update',
          update: encodeBinary(session.Y.encodeStateAsUpdate(session.document)),
        }));
        sendPresence(session);
        session.synced = true;
        session.reconnectDelay = 800;
        setCollaborationStatus('connected');
        finishInitialCollaboration(session, true);
      }
      return;
    }

    if (message.type === 'presence' && Array.isArray(message.users)) {
      setCollaborationStatus(session.synced ? 'connected' : 'connecting', message.users);
      return;
    }

    if (message.type === 'saved') {
      const content = session.text.toString();
      if (codeEditor.getValue() === content) {
        state.savedContent = content;
        setDirty(false);
      }
      return;
    }

    if (message.type === 'disk-synced') {
      const content = session.text.toString();
      if (codeEditor.getValue() === content) {
        state.savedContent = content;
        state.compileStale = true;
        setDirty(false);
      }
      return;
    }

    if (message.type === 'save-error') showToast(message.message || '协作文档保存失败。', true);
  });

  socket.addEventListener('close', () => {
    if (session.destroyed || collaborationState.session !== session) return;
    setCollaborationStatus('offline');
    if (!session.synced) {
      abandonInitialCollaboration(session);
      return;
    }
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = setTimeout(() => connectCollaborationSocket(session), session.reconnectDelay);
    session.reconnectDelay = Math.min(session.reconnectDelay * 1.8, 8_000);
  });

  socket.addEventListener('error', () => {
    if (!session.synced) setCollaborationStatus('offline');
  });
}

async function startDocumentCollaboration(filePath) {
  stopDocumentCollaboration();
  const runtime = window.LocalTeXCollaborationRuntime;
  if (!runtime?.Y || !window.WebSocket) {
    codeEditor.setReadOnly(false);
    setCollaborationStatus('offline');
    return false;
  }

  const document = new runtime.Y.Doc();
  const session = {
    Y: runtime.Y,
    path: filePath,
    document,
    text: document.getText('content'),
    localOrigin: {},
    remoteOrigin: {},
    socket: null,
    synced: false,
    bound: false,
    destroyed: false,
    applyingRemote: false,
    reconnectDelay: 800,
    reconnectTimer: 0,
    initialResolve: null,
    initialTimer: 0,
  };
  collaborationState.session = session;
  codeEditor.setReadOnly(true);

  document.on('update', (update, origin) => {
    if (origin === session.remoteOrigin || session.destroyed) return;
    if (session.socket?.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify({ type: 'update', update: encodeBinary(update) }));
    }
  });

  const result = new Promise((resolve) => {
    session.initialResolve = resolve;
    session.initialTimer = setTimeout(() => {
      if (session.synced) return;
      abandonInitialCollaboration(session);
    }, 5_000);
  });
  connectCollaborationSocket(session);
  return result;
}

function stopDocumentCollaboration() {
  const session = collaborationState.session;
  if (!session) {
    setCollaborationStatus(state.config?.lan?.enabled ? 'ready' : 'local', []);
    return;
  }
  session.destroyed = true;
  finishInitialCollaboration(session, false);
  clearTimeout(session.initialTimer);
  clearTimeout(session.reconnectTimer);
  if (session.bound) {
    codeEditor.session.off('change', session.onAceChange);
    session.text.unobserve(session.onSharedTextChange);
  }
  if (session.socket && session.socket.readyState < WebSocket.CLOSING) session.socket.close();
  session.document.destroy();
  collaborationState.session = null;
  setCollaborationStatus(state.config?.lan?.enabled ? 'ready' : 'local', []);
}

function applyNetworkConfig(config) {
  state.config = config;
  updateCodexAvailability(config.codex);
  const lan = config.lan || { available: false, enabled: false, isHost: true, shareUrls: [] };
  const persistedHostName = lan.isHost
    ? String(config.profile?.collaboratorName || '').trim().slice(0, 32)
    : '';
  if (persistedHostName && persistedHostName !== collaborationState.collaborator.name) {
    collaborationState.collaborator.name = persistedHostName;
    saveCollaborator();
    sendPresence();
  }
  const workServiceActive = config.service?.active !== false;
  elements.hostProjectActions.hidden = !lan.isHost;
  elements.homeShareButton.hidden = !lan.isHost;
  elements.shareControl.hidden = !lan.isHost;
  elements.serviceControl.hidden = !lan.isHost;
  elements.localModeLabel.textContent = !workServiceActive ? '服务已暂停' : lan.enabled ? '局域网协作' : '本机模式';
  elements.sidebarModeLabel.textContent = !workServiceActive ? '工作服务已暂停' : lan.enabled ? '局域网实时协作' : '本机项目';
  elements.localModeBadge.classList.toggle('collaborating', lan.enabled);
  elements.collaboratorNameInput.value = collaborationState.collaborator.name;
  elements.shareToggleButton.disabled = !lan.available || !workServiceActive;
  elements.shareControl.dataset.state = lan.enabled ? 'enabled' : 'disabled';
  elements.shareToggleButton.dataset.state = lan.enabled ? 'enabled' : 'disabled';
  elements.shareToggleButton.setAttribute('aria-pressed', String(lan.enabled));
  elements.shareToggleLabel.textContent = lan.enabled ? '关闭分享' : '开启分享';
  elements.shareControlTitle.textContent = lan.enabled ? '局域网分享已开启' : '局域网分享已关闭';
  elements.shareControlStatus.textContent = !workServiceActive
    ? '工作服务暂停期间，局域网分享保持关闭。'
    : lan.enabled
      ? '安全链接当前有效，局域网成员可以进入协作。'
      : '只有这台主机可以访问项目，已有协作者会断开。';

  const shareUrl = lan.shareUrls?.[0] || '';
  elements.shareUrl.value = shareUrl;
  elements.shareLinkBlock.hidden = !lan.enabled || !shareUrl;
  elements.shareStartGuide.hidden = lan.available;
  elements.shareDialogDescription.textContent = !workServiceActive
    ? '工作服务当前已暂停；恢复后可继续编辑或开启分享。'
    : !lan.available
      ? '请使用新的 LocalTeX 启动器重新打开服务。'
      : lan.enabled
        ? '同一局域网的协作者可以通过下面的安全链接进入并实时编辑。'
        : '分享处于关闭状态；需要协作时再开启即可。';
  applyServiceConfig(config.service);
  setCollaborationStatus(collaborationState.session?.synced ? 'connected' : lan.enabled ? 'ready' : 'local');
}

function applyServiceConfig(service = {}) {
  const active = service.active !== false;
  elements.workServiceToggle.checked = active;
  elements.workServiceToggle.disabled = service.canControl !== true;
  elements.serviceRunMode.textContent = '后台控制器在线';
  elements.serviceRunMode.dataset.mode = 'controller';
  elements.serviceModeDescription.textContent = active
    ? '已开启：可以读取项目、编辑文件和编译 PDF。'
    : '已暂停：文件、编译与协作接口均被锁定。';
  elements.servicePausedScreen.hidden = active;
  elements.resumeServiceButton.disabled = service.canControl !== true;
}

function openShareDialog() {
  setCopyShareFeedback();
  elements.shareDialog.hidden = false;
  elements.collaboratorNameInput.value = collaborationState.collaborator.name;
  requestAnimationFrame(() => {
    if (elements.shareUrl.value) elements.copyShareButton.focus();
    else if (!elements.shareToggleButton.disabled) elements.shareToggleButton.focus();
    else elements.shareDialogClose.focus();
  });
}

function closeShareDialog() {
  elements.shareDialog.hidden = true;
}

function setCopyShareFeedback(status = 'idle') {
  clearTimeout(copyShareFeedbackTimer);
  const labels = {
    idle: '复制链接',
    copying: '复制中…',
    copied: '✓ 已复制',
    error: '复制失败',
  };
  elements.copyShareButton.dataset.state = status;
  elements.copyShareButton.disabled = status === 'copying';
  elements.copyShareLabel.textContent = labels[status] || labels.idle;
}

async function copyShareUrl() {
  if (!elements.shareUrl.value) return;
  setCopyShareFeedback('copying');
  try {
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
      await navigator.clipboard.writeText(elements.shareUrl.value);
      copied = true;
    } catch {
      elements.shareUrl.focus();
      elements.shareUrl.select();
      copied = document.execCommand('copy');
    }
    if (!copied) throw new Error('浏览器未允许写入剪贴板。');
    setCopyShareFeedback('copied');
    showToast('安全分享链接已复制。');
    copyShareFeedbackTimer = setTimeout(() => setCopyShareFeedback(), 1800);
  } catch (error) {
    setCopyShareFeedback('error');
    showToast(`复制失败：${error.message || '请手动选择链接复制。'}`, true);
    copyShareFeedbackTimer = setTimeout(() => setCopyShareFeedback(), 2600);
  }
}

async function toggleLanSharing() {
  const lan = state.config?.lan;
  if (!lan?.isHost || !lan.available) return;
  const enabled = !lan.enabled;
  elements.shareToggleButton.disabled = true;
  try {
    const data = await api('/api/lan', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    applyNetworkConfig({ ...state.config, lan: data.lan });
    showToast(enabled ? '局域网分享已开启。' : '局域网分享已关闭，远端连接已经断开。');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.shareToggleButton.disabled = !state.config?.lan?.available || state.config?.service?.active === false;
  }
}

async function setWorkServiceState(active) {
  if (!active) {
    if (state.activePath && state.dirty && !await saveFile(true)) {
      applyServiceConfig(state.config?.service);
      return;
    }
    const sharingNote = state.config?.lan?.enabled ? ' 局域网分享也会关闭，协作者将断开。' : '';
    if (!window.confirm(`确定暂停 LocalTeX 工作服务吗？${sharingNote}\n项目文件不会被删除，之后可直接在页面恢复。`)) {
      applyServiceConfig(state.config?.service);
      return;
    }
  }

  elements.workServiceToggle.disabled = true;
  elements.resumeServiceButton.disabled = true;
  try {
    const data = await api('/api/service/state', {
      method: 'PUT',
      body: JSON.stringify({ active }),
    });
    if (!active) stopDocumentCollaboration();
    applyNetworkConfig({ ...state.config, service: data.service, lan: data.lan });
    if (active) {
      await loadProjects();
      if (state.activePath && state.activeProject) await startDocumentCollaboration(state.activePath);
      showToast('LocalTeX 工作服务已恢复。');
    } else {
      closeShareDialog();
      showToast('工作服务已暂停，主机控制器仍保持在线。');
    }
  } catch (error) {
    applyServiceConfig(state.config?.service);
    showToast(error.message, true);
  }
}

async function updateCollaboratorName(value) {
  const name = String(value || '').trim().slice(0, 32);
  if (!name) {
    elements.collaboratorNameInput.value = collaborationState.collaborator.name;
    return false;
  }
  collaborationState.collaborator.name = name;
  elements.collaboratorNameInput.value = name;
  saveCollaborator();
  sendPresence();
  if (!state.config?.lan?.isHost) return true;
  if (state.config.profile?.collaboratorName === name) return true;

  try {
    const data = await api('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ collaboratorName: name }),
    });
    state.config = { ...state.config, profile: data.profile };
    showToast(`显示名称“${name}”已保存为主机默认值。`);
    return true;
  } catch (error) {
    showToast(`显示名称仅在当前浏览器生效：${error.message}`, true);
    return false;
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'X-LocalTeX-Token': accessToken } : {}),
      ...(state.activeProject ? { 'X-LocalTeX-Project': state.activeProject.id } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.output || `Request failed (${response.status})`);
    error.data = data;
    throw error;
  }
  return data;
}

function authenticatedResourceUrl(pathname, parameters = {}) {
  const url = new URL(pathname, window.location.origin);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  if (accessToken) url.searchParams.set('token', accessToken);
  return `${url.pathname}${url.search}${url.hash}`;
}

function saveCollaborator() {
  try {
    localStorage.setItem(COLLABORATOR_STORAGE_KEY, JSON.stringify(collaborationState.collaborator));
  } catch {
    // The generated identity remains valid for this page.
  }
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', isError);
  elements.toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    elements.toast.hidden = true;
  }, 3400);
}

function formatOpenedAt(value) {
  if (!value) return '尚未打开';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未打开';
  return `上次打开 ${date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

function renderProjectListEmpty({ icon, title, message, actionLabel = '', action = null }) {
  const empty = document.createElement('div');
  empty.className = 'project-list-empty';

  const mark = document.createElement('div');
  mark.className = 'project-list-empty-icon';
  mark.textContent = icon;
  const heading = document.createElement('strong');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = message;
  empty.append(mark, heading, copy);

  if (actionLabel && action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = actionLabel;
    button.addEventListener('click', action);
    empty.append(button);
  }

  elements.projectList.append(empty);
}

function renderProjects() {
  elements.projectList.replaceChildren();
  const query = state.projectQuery.trim().toLocaleLowerCase('zh-CN');
  const projects = query
    ? state.projects.filter((project) => [project.name, project.path, project.mainFile]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('zh-CN').includes(query)))
    : state.projects;
  elements.projectCount.textContent = query
    ? `${projects.length} / ${state.projects.length} 个项目`
    : `${state.projects.length} 个项目`;

  if (!state.projects.length) {
    renderProjectListEmpty({
      icon: 'Tx',
      title: '开始第一个项目',
      message: '打开一个本地文件夹或主 .tex 文件，即可开始写作。',
      actionLabel: '打开项目文件夹',
      action: () => browseProject('folder'),
    });
    return;
  }

  if (!projects.length) {
    renderProjectListEmpty({
      icon: '⌕',
      title: '没有匹配的项目',
      message: '试试项目名称、文件夹路径或编译对象名称。',
    });
    return;
  }

  for (const project of projects) {
    const item = document.createElement('article');
    item.className = 'project-item';

    const openArea = document.createElement('button');
    openArea.type = 'button';
    openArea.className = 'project-open-area';
    openArea.disabled = !project.exists;
    openArea.setAttribute('aria-label', `打开项目 ${project.name}`);
    openArea.addEventListener('click', () => openProject(project.id));

    const icon = document.createElement('div');
    icon.className = 'project-icon';
    icon.textContent = 'Tx';

    const details = document.createElement('div');
    details.className = 'project-details';
    const nameRow = document.createElement('div');
    nameRow.className = 'project-name-row';
    const name = document.createElement('strong');
    name.textContent = project.name;
    nameRow.append(name);

    const projectPath = document.createElement('p');
    projectPath.textContent = project.path;
    const meta = document.createElement('div');
    meta.className = 'project-meta';
    const main = document.createElement('span');
    main.textContent = project.mainFile ? `编译对象 ${project.mainFile}` : '未选择编译对象';
    const opened = document.createElement('span');
    opened.textContent = formatOpenedAt(project.lastOpenedAt);
    meta.append(main, opened);
    if (!project.exists) {
      const missing = document.createElement('span');
      missing.className = 'project-unavailable';
      missing.textContent = '文件夹不可用';
      meta.append(missing);
    }
    details.append(nameRow, projectPath, meta);

    const actions = document.createElement('div');
    actions.className = 'project-item-actions';

    if (state.config?.lan?.isHost !== false) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-project';
      remove.setAttribute('aria-label', `从列表移除 ${project.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => removeProject(project));
      actions.append(remove);
    }

    openArea.append(icon, details);
    item.append(openArea, actions);
    elements.projectList.append(item);
  }
}

async function loadProjects() {
  const data = await api('/api/projects');
  state.projects = data.projects;
  renderProjects();
}

function resetEditorState() {
  stopDocumentCollaboration();
  clearSourceSyncMarker();
  closeEditorFindbar(false);
  state.files = [];
  state.activePath = null;
  state.selectedPath = null;
  state.savedContent = '';
  codeEditor.setValue('', -1);
  codeEditor.setReadOnly(true);
  setEditorMode('');
  elements.activeFile.textContent = '请选择一个文件';
  elements.fileType.textContent = '—';
  elements.fileTree.replaceChildren();
  elements.sourceToPdfButton.disabled = true;
  state.compileStale = true;
  clearPdfPreview();
  elements.previewEmpty.hidden = false;
  elements.compileLog.textContent = '尚无编译日志。';
  codexState.compileLogAvailable = false;
  elements.compileTime.textContent = '尚未编译';
  elements.compileTime.title = '';
  renderDiagnostics([]);
  updateCodexContext();
  setDirty(false);
  updateCursorPosition();
}

async function openProject(projectId) {
  if (!await confirmDiscard()) return;
  try {
    const data = await api('/api/projects/select', {
      method: 'POST',
      body: JSON.stringify({ id: projectId }),
    });
    state.activeProject = data.project;
    state.collapsedFolders = new Set();
    state.mainDocument = data.project.mainFile || '';
    resetEditorState();
    loadCodexHistoryForProject();

    const config = await api('/api/config');
    applyNetworkConfig(config);
    elements.currentProjectName.textContent = data.project.name;
    document.title = `LocalTex-${data.project.name}`;
    elements.workspacePath.textContent = config.workspace;
    elements.compilerStatus.textContent = config.compiler || '未找到 TeX 编译器';
    elements.compilerStatus.className = `status-pill ${config.compiler ? 'ready' : 'missing'}`;
    elements.projectHome.hidden = true;
    elements.editorApp.hidden = false;
    updateProjectUrl(data.project.id);
    requestAnimationFrame(restorePanelLayout);
    await refreshFiles(true);
    await loadProjects();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function browseProject(mode) {
  const button = mode === 'file' ? elements.openTexButton : elements.openFolderButton;
  elements.openTexButton.disabled = true;
  elements.openFolderButton.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = '请在弹出窗口中选择…';
  try {
    const data = await api('/api/projects/browse', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    if (data.cancelled) return;
    await loadProjects();
    await openProject(data.project.id);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.openTexButton.disabled = false;
    elements.openFolderButton.disabled = false;
    button.textContent = originalLabel;
  }
}

async function addProjectByPath() {
  const projectPath = window.prompt('输入本地 LaTeX 项目文件夹的完整路径：');
  if (!projectPath) return;
  try {
    const data = await api('/api/projects/add', {
      method: 'POST',
      body: JSON.stringify({ path: projectPath }),
    });
    await loadProjects();
    await openProject(data.project.id);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function removeProject(project) {
  if (!window.confirm(`从项目列表移除“${project.name}”？\n不会删除磁盘上的任何文件。`)) return;
  try {
    await api(`/api/projects?id=${encodeURIComponent(project.id)}`, { method: 'DELETE' });
    await loadProjects();
    showToast('已从列表移除，原始文件没有删除。');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function showProjectHome() {
  if (!await confirmDiscard()) return;
  await stopCodexRun(true);
  closeEditorFindbar(false);
  unloadCodexHistory();
  stopDocumentCollaboration();
  state.activeProject = null;
  updateProjectUrl();
  document.title = 'LocalTeX';
  elements.editorApp.hidden = true;
  elements.projectHome.hidden = false;
  await loadProjects();
}

function setDirty(value) {
  state.dirty = value;
  elements.dirtyIndicator.hidden = !value;
  elements.saveStatus.textContent = value ? '未保存' : state.activePath ? '已保存' : '等待编辑';
  elements.saveStatus.dataset.state = value ? 'dirty' : state.activePath ? 'saved' : 'idle';
  elements.editorPane.classList.toggle('has-unsaved', value);
}

function updateCursorPosition() {
  const cursor = codeEditor.getCursorPosition();
  elements.cursorPosition.textContent = `Ln ${cursor.row + 1}, Col ${cursor.column + 1}`;
}

function collapseAllFolders() {
  state.collapsedFolders = new Set(
    state.files
      .filter((file) => file.type === 'directory')
      .map((file) => file.path),
  );
}

function parentDirectory(filePath) {
  const separator = filePath.lastIndexOf('/');
  return separator < 0 ? '' : filePath.slice(0, separator);
}

function isTexFilePath(filePath = '') {
  return String(filePath).toLowerCase().endsWith('.tex');
}

function fileIcon(file) {
  const extension = file.path.split('.').pop().toLowerCase();
  if (extension === 'tex') return 'T';
  if (extension === 'bib') return 'B';
  if (extension === 'sty' || extension === 'cls') return 'S';
  if (extension === 'pdf') return 'P';
  if (['png', 'jpg', 'jpeg', 'svg'].includes(extension)) return 'I';
  return 'F';
}

function fileIconKind(file) {
  const extension = file.path.split('.').pop().toLowerCase();
  if (extension === 'tex') return 'tex';
  if (extension === 'bib') return 'bib';
  if (extension === 'sty' || extension === 'cls') return 'style';
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'svg'].includes(extension)) return 'image';
  return 'other';
}

function expandFileParents(filePath) {
  const segments = filePath.split('/');
  segments.pop();
  let current = '';
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    state.collapsedFolders.delete(current);
  }
}

function renderFileTree() {
  elements.fileTree.replaceChildren();

  if (state.files.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tree-empty';
    empty.textContent = '工作区中还没有文件。点击上方“＋”创建 main.tex。';
    elements.fileTree.append(empty);
    return;
  }

  const children = new Map();
  for (const file of state.files) {
    const parent = parentDirectory(file.path);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(file);
  }
  for (const items of children.values()) {
    items.sort((left, right) => (
      (left.type === right.type ? 0 : left.type === 'directory' ? -1 : 1)
      || left.path.split('/').at(-1).localeCompare(right.path.split('/').at(-1), 'zh-CN')
    ));
  }

  function renderLevel(parent = '', level = 1) {
    const group = document.createElement('div');
    group.className = parent ? 'tree-children' : 'tree-root';
    group.setAttribute('role', 'group');

    for (const file of children.get(parent) || []) {
      const node = document.createElement('div');
      node.className = `tree-node ${file.type}`;

      const row = document.createElement('button');
      const isCompileTarget = file.type === 'file'
        && isTexFilePath(file.path)
        && file.path === state.mainDocument;
      row.type = 'button';
      row.className = `tree-row ${file.type}`;
      row.classList.toggle('active', file.path === state.activePath);
      row.classList.toggle('compile-target', isCompileTarget);
      row.dataset.path = file.path;
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(level));
      row.title = isCompileTarget ? `编译对象 · ${file.path}` : file.path;

      const disclosure = document.createElement('span');
      disclosure.className = 'tree-disclosure';
      disclosure.setAttribute('aria-hidden', 'true');

      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = file.path.split('/').at(-1);

      if (file.type === 'directory') {
        const expanded = !state.collapsedFolders.has(file.path);
        row.setAttribute('aria-expanded', String(expanded));
        disclosure.textContent = '›';
        disclosure.classList.toggle('expanded', expanded);
        icon.className = 'tree-folder-icon';

        const count = document.createElement('span');
        count.className = 'tree-item-count';
        count.textContent = String((children.get(file.path) || []).length);
        row.append(disclosure, icon, label, count);

        row.addEventListener('click', () => {
          if (expanded) state.collapsedFolders.add(file.path);
          else state.collapsedFolders.delete(file.path);
          renderFileTree();
          const nextRow = [...elements.fileTree.querySelectorAll('.tree-row.directory')]
            .find((candidate) => candidate.dataset.path === file.path);
          nextRow?.focus();
        });

        const nested = renderLevel(file.path, level + 1);
        nested.hidden = !expanded;
        node.append(row, nested);
      } else {
        disclosure.classList.add('placeholder');
        icon.className = `tree-file-icon ${fileIconKind(file)}`;
        icon.textContent = fileIcon(file);
        row.setAttribute('aria-selected', String(file.path === (state.selectedPath || state.activePath)));
        row.append(disclosure, icon, label);
        if (isCompileTarget) {
          const target = document.createElement('span');
          target.className = 'tree-compile-target';
          target.textContent = '编译';
          target.setAttribute('aria-label', '当前编译对象');
          row.append(target);
        }
        row.addEventListener('click', () => openFile(file, false, true, true));
        node.append(row);
      }
      group.append(node);
    }
    return group;
  }

  elements.fileTree.append(renderLevel());
}

function renderMainDocuments() {
  const texFiles = state.files.filter((file) => file.type === 'file' && file.path.toLowerCase().endsWith('.tex'));
  elements.mainDocumentSelect.replaceChildren();

  for (const file of texFiles) {
    const option = document.createElement('option');
    option.value = file.path;
    option.textContent = file.path;
    elements.mainDocumentSelect.append(option);
  }

  if (!texFiles.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '没有 .tex 文件';
    elements.mainDocumentSelect.append(option);
    state.mainDocument = '';
    return;
  }

  if (!texFiles.some((file) => file.path === state.mainDocument)) {
    state.mainDocument = texFiles.find((file) => file.path.toLowerCase().endsWith('main.tex'))?.path || texFiles[0].path;
  }
  elements.mainDocumentSelect.value = state.mainDocument;
}

async function setMainDocument(mainFile, persist = true) {
  const normalized = String(mainFile || '').replaceAll('\\', '/');
  if (normalized && !state.files.some((file) => (
    file.type === 'file' && file.path === normalized && isTexFilePath(file.path)
  ))) return false;

  elements.mainDocumentSelect.value = normalized;
  if (normalized === state.mainDocument) return true;

  state.mainDocument = normalized;
  state.compileStale = true;
  if (state.activeProject) {
    state.activeProject = { ...state.activeProject, mainFile: normalized };
  }

  if (
    normalized
    && pdfPreviewState.document
    && pdfPreviewState.mainFile
    && !pdfPreviewState.previewPath
    && pdfPreviewState.mainFile !== normalized
  ) {
    clearPdfPreview();
    updatePdfPreviewContext();
    elements.previewEmpty.hidden = false;
    elements.compileTime.textContent = `等待编译 · ${normalized}`;
    elements.compileTime.title = `当前编译对象：${normalized}`;
  } else {
    updatePdfPreviewContext();
  }
  renderFileTree();

  if (!persist || !state.activeProject) return true;
  try {
    const data = await api('/api/projects', {
      method: 'PUT',
      body: JSON.stringify({ id: state.activeProject.id, mainFile: normalized }),
    });
    if (state.mainDocument === normalized) state.activeProject = data.project;
  } catch (error) {
    showToast(`编译对象已切换，但默认设置保存失败：${error.message}`, true);
  }
  return true;
}

async function refreshFiles(openInitial = false) {
  const data = await api('/api/files');
  state.files = data.files;
  if (openInitial) collapseAllFolders();
  renderFileTree();
  renderMainDocuments();

  if (openInitial && !state.activePath) {
    const initial = state.files.find((file) => file.path === state.mainDocument)
      || state.files.find((file) => file.editable);
    if (initial) await openFile(initial, true, false);
  }
}

async function refreshWorkspace() {
  if (state.dirty) {
    showToast('当前文件有未保存修改，请保存后再刷新。', true);
    return;
  }

  try {
    const activePath = state.activePath;
    await refreshFiles();
    if (!activePath) {
      showToast('文件列表已刷新。');
      return;
    }

    const activeFile = state.files.find((file) => file.path === activePath && file.editable);
    if (!activeFile) {
      resetEditorState();
      await refreshFiles();
      showToast('当前文件已不在项目中，文件列表已刷新。');
      return;
    }

    await openFile(activeFile, true, false);
    showToast('已从本地磁盘重新载入当前文件。');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function confirmDiscard() {
  if (!state.dirty) return true;
  return window.confirm('当前文件还有未保存修改。确定放弃这些修改吗？');
}

async function openFile(file, force = false, revealInTree = true, selectForCompile = false) {
  if (selectForCompile && isTexFilePath(file.path) && state.compileRunning) {
    showToast('当前文档正在编译，请完成后再切换编译对象。', true);
    return false;
  }
  if (!file.editable) {
    if (/\.pdf$/i.test(file.path)) {
      await previewPdfFile(file);
    } else if (/\.(png|jpe?g|svg)$/i.test(file.path)) {
      const assetUrl = authenticatedResourceUrl('/api/asset', {
        path: file.path,
        project: state.activeProject.id,
      });
      window.open(assetUrl, '_blank', 'noopener');
    } else {
      showToast('这个文件不能在文本编辑器中打开。', true);
    }
    return false;
  }

  if (!force && file.path !== state.activePath && !await confirmDiscard()) return false;
  clearSourceSyncMarker();
  stopDocumentCollaboration();

  const data = await api(`/api/file?path=${encodeURIComponent(file.path)}`);
  state.activePath = data.path;
  state.selectedPath = data.path;
  if (revealInTree) expandFileParents(data.path);
  state.savedContent = data.content;
  codeEditor.setValue(data.content, -1);
  codeEditor.session.getUndoManager().reset();
  codeEditor.setReadOnly(true);
  setEditorMode(data.path);
  elements.activeFile.textContent = data.path;
  const fileName = data.path.split('/').at(-1);
  elements.fileType.textContent = fileName.includes('.') ? fileName.split('.').at(-1).toUpperCase().slice(0, 4) : 'TXT';
  elements.sourceToPdfButton.disabled = !data.path.toLowerCase().endsWith('.tex');
  setDirty(false);
  updateCursorPosition();
  updateCodexContext();
  if (selectForCompile && isTexFilePath(data.path)) await setMainDocument(data.path);
  renderFileTree();
  const collaborative = await startDocumentCollaboration(data.path);
  if (!collaborative) {
    codeEditor.setReadOnly(false);
    codeEditor.focus();
  }
  return true;
}

async function saveFile(silent = false) {
  if (!state.activePath) {
    if (!silent) showToast('请先选择一个文本文件。', true);
    return false;
  }

  if (!state.dirty) {
    if (!silent) showToast('文件已经是最新状态。');
    return true;
  }

  elements.saveStatus.textContent = '正在保存…';
  try {
    const content = codeEditor.getValue();
    await api('/api/file', {
      method: 'PUT',
      body: JSON.stringify({ path: state.activePath, content }),
    });
    state.savedContent = content;
    setDirty(false);
    if (!silent) showToast(`已保存 ${state.activePath}`);
    return true;
  } catch (error) {
    elements.saveStatus.textContent = '保存失败';
    showToast(error.message, true);
    return false;
  }
}

function updateCodexAvailability(config = state.config?.codex) {
  const available = Boolean(config?.canUse);
  const permissionMode = ['read-only', 'workspace-write', 'full-access'].includes(config?.permissionMode)
    ? config.permissionMode
    : 'read-only';
  elements.codexComposer.hidden = !available;
  renderCodexModelOptions(config);
  renderCodexReasoningOptions(config);
  elements.codexModelSelect.disabled = !available || codexState.running || codexState.modelsLoading;
  elements.codexReasoningSelect.disabled = !available || codexState.running || codexState.modelsLoading;
  elements.codexPermissionSelect.value = permissionMode;
  elements.codexPermissionSelect.disabled = !available || codexState.running;
  elements.codexPermissionPicker.dataset.mode = permissionMode;
  elements.codexLocalStatus.classList.toggle('ready', available);
  elements.codexLocalStatus.classList.toggle('error', Boolean(config && !config.available));
  elements.codexLocalStatus.lastElementChild.textContent = !config?.available
    ? 'Codex SDK 不可用'
    : config.authDetected
      ? `本机 Codex · ${config.permissionLabel || '只读'}`
      : '本机 Codex 配置';
  updateCodexCollapseUi(panelLayout.preferred?.codexCollapsed === true);
  requestAnimationFrame(restorePanelLayout);
  updateCodexContext();
  if (available && !codexState.modelsLoaded && !codexState.modelsLoading) {
    loadCodexModels().catch(() => {});
  }
}

function codexModelName(modelId) {
  const normalizedId = String(modelId || '').trim();
  return codexState.models.find((model) => model.id === normalizedId)?.displayName || normalizedId;
}

function renderCodexModelOptions(config = state.config?.codex) {
  const selectedModel = String(config?.model || '');
  const configuredModel = String(config?.configuredModel || '');
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = configuredModel
    ? `本机 · ${codexModelName(configuredModel)}`
    : '跟随本机配置';

  const options = [defaultOption];
  for (const model of codexState.models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.displayName}${model.isDefault ? ' · 推荐' : ''}`;
    option.title = model.description || model.id;
    options.push(option);
  }
  if (selectedModel && !codexState.models.some((model) => model.id === selectedModel)) {
    const option = document.createElement('option');
    option.value = selectedModel;
    option.textContent = codexModelName(selectedModel);
    options.push(option);
  }
  elements.codexModelSelect.replaceChildren(...options);
  elements.codexModelSelect.value = selectedModel;

  const activeModel = selectedModel || configuredModel;
  const catalogEntry = codexState.models.find((model) => model.id === activeModel);
  const source = selectedModel ? 'LocalTeX 覆盖选择' : '跟随本机 config.toml';
  elements.codexModelPicker.title = activeModel
    ? `${source}：${codexModelName(activeModel)}${catalogEntry?.description ? `\n${catalogEntry.description}` : ''}`
    : source;
}

function renderCodexReasoningOptions(config = state.config?.codex) {
  const selectedEffort = CODEX_REASONING_EFFORTS.includes(config?.reasoningEffort)
    ? config.reasoningEffort
    : '';
  const configuredEffort = CODEX_REASONING_EFFORTS.includes(config?.configuredReasoningEffort)
    ? config.configuredReasoningEffort
    : '';
  const activeModel = String(config?.model || config?.configuredModel || '');
  const catalogEntry = codexState.models.find((model) => model.id === activeModel);
  const supportedEfforts = Array.isArray(catalogEntry?.supportedReasoningEfforts)
    ? catalogEntry.supportedReasoningEfforts.filter((effort) => CODEX_REASONING_EFFORTS.includes(effort))
    : [];
  const catalogDefault = CODEX_REASONING_EFFORTS.includes(catalogEntry?.defaultReasoningEffort)
    ? catalogEntry.defaultReasoningEffort
    : '';
  const inheritedEffort = configuredEffort || catalogDefault;
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = inheritedEffort
    ? `自动 · ${CODEX_REASONING_LABELS[inheritedEffort]}`
    : '自动';

  const options = [defaultOption];
  for (const effort of CODEX_REASONING_EFFORTS) {
    const option = document.createElement('option');
    option.value = effort;
    option.textContent = CODEX_REASONING_LABELS[effort];
    option.disabled = supportedEfforts.length > 0 && !supportedEfforts.includes(effort) && effort !== selectedEffort;
    if (option.disabled) option.title = `${codexModelName(activeModel)} 不支持 ${option.textContent}`;
    options.push(option);
  }
  elements.codexReasoningSelect.replaceChildren(...options);
  elements.codexReasoningSelect.value = selectedEffort;
  elements.codexReasoningPicker.dataset.effort = selectedEffort || inheritedEffort;

  const selectedLabel = selectedEffort
    ? CODEX_REASONING_LABELS[selectedEffort]
    : inheritedEffort
      ? `自动（${CODEX_REASONING_LABELS[inheritedEffort]}）`
      : '自动（跟随本机配置或模型默认值）';
  elements.codexReasoningPicker.title = `Codex 推理强度：${selectedLabel}\nHigh / XHigh 更适合复杂任务，但响应通常更慢。`;
}

async function loadCodexModels() {
  if (codexState.modelsLoading || !state.config?.codex?.canUse) return;
  codexState.modelsLoading = true;
  elements.codexModelSelect.disabled = true;
  elements.codexReasoningSelect.disabled = true;
  try {
    const data = await api('/api/codex/models');
    codexState.models = Array.isArray(data.models) ? data.models : [];
    codexState.modelsLoaded = true;
    renderCodexModelOptions();
    renderCodexReasoningOptions();
  } catch (error) {
    elements.codexModelPicker.title = `暂时无法读取可用模型：${error.message}`;
  } finally {
    codexState.modelsLoading = false;
    elements.codexModelSelect.disabled = codexState.running || !state.config?.codex?.canUse;
    elements.codexReasoningSelect.disabled = codexState.running || !state.config?.codex?.canUse;
  }
}

async function updateCodexModel(model) {
  const previousModel = state.config?.codex?.model || '';
  if (model === previousModel) return;
  elements.codexModelSelect.disabled = true;
  elements.codexReasoningSelect.disabled = true;
  try {
    const requestedModel = model || state.config?.codex?.configuredModel || '';
    const catalogEntry = codexState.models.find((entry) => entry.id === requestedModel);
    const supportedEfforts = Array.isArray(catalogEntry?.supportedReasoningEfforts)
      ? catalogEntry.supportedReasoningEfforts
      : [];
    const currentEffort = state.config?.codex?.reasoningEffort || '';
    const resetReasoning = Boolean(
      currentEffort
      && supportedEfforts.length > 0
      && !supportedEfforts.includes(currentEffort)
    );
    const data = await api('/api/codex/settings', {
      method: 'PUT',
      body: JSON.stringify({
        model,
        ...(resetReasoning ? { reasoningEffort: '' } : {}),
      }),
    });
    state.config = { ...state.config, codex: data.codex };
    updateCodexAvailability(data.codex);
    const selectedName = data.codex.model
      ? codexModelName(data.codex.model)
      : `本机配置${data.codex.configuredModel ? `（${codexModelName(data.codex.configuredModel)}）` : ''}`;
    showToast(`Codex 模型已设为 ${selectedName}${resetReasoning ? '，推理强度已恢复自动' : ''}。`);
  } catch (error) {
    elements.codexModelSelect.value = previousModel;
    showToast(error.message, true);
  } finally {
    elements.codexModelSelect.disabled = codexState.running || !state.config?.codex?.canUse;
    elements.codexReasoningSelect.disabled = codexState.running || !state.config?.codex?.canUse;
  }
}

async function updateCodexReasoningEffort(reasoningEffort) {
  const previousEffort = state.config?.codex?.reasoningEffort || '';
  if (reasoningEffort === previousEffort) return;
  elements.codexReasoningSelect.disabled = true;
  try {
    const data = await api('/api/codex/settings', {
      method: 'PUT',
      body: JSON.stringify({ reasoningEffort }),
    });
    state.config = { ...state.config, codex: data.codex };
    updateCodexAvailability(data.codex);
    const label = data.codex.reasoningEffort
      ? CODEX_REASONING_LABELS[data.codex.reasoningEffort]
      : '自动';
    showToast(`Codex 推理强度已设为 ${label}。`);
  } catch (error) {
    elements.codexReasoningSelect.value = previousEffort;
    showToast(error.message, true);
  } finally {
    elements.codexReasoningSelect.disabled = codexState.running || !state.config?.codex?.canUse;
  }
}

async function updateCodexPermission(permissionMode) {
  const previousMode = state.config?.codex?.permissionMode || 'read-only';
  if (permissionMode === previousMode) return;
  if (permissionMode === 'full-access') {
    const confirmed = window.confirm(
      'Full access 将允许 Codex 访问工作区外的文件、执行系统命令并使用实时网络。\n\n确认开启吗？',
    );
    if (!confirmed) {
      elements.codexPermissionSelect.value = previousMode;
      return;
    }
  }

  elements.codexPermissionSelect.disabled = true;
  try {
    const data = await api('/api/codex/settings', {
      method: 'PUT',
      body: JSON.stringify({ permissionMode }),
    });
    state.config = { ...state.config, codex: data.codex };
    updateCodexAvailability(data.codex);
    const suffix = data.codex.networkAccessEnabled ? '，网络与实时搜索已开启' : '';
    showToast(`Codex 权限已切换为 ${data.codex.permissionLabel}${suffix}。`);
  } catch (error) {
    elements.codexPermissionSelect.value = previousMode;
    showToast(error.message, true);
  } finally {
    elements.codexPermissionSelect.disabled = codexState.running || !state.config?.codex?.canUse;
  }
}

function openCodexPane(focusPrompt = false) {
  if (!state.config?.codex?.canUse) return;
  updateCodexContext();
  setCodexCollapsed(false, focusPrompt);
}

function collapseCodexPane() {
  setCodexCollapsed(true);
}

function updateCodexContext() {
  const selectedText = codeEditor.getSelectedText();
  const usesCurrentProject = !codexState.activeThreadId || codexThreadInActiveProject(activeCodexThread());
  const hasSelection = Boolean(selectedText && usesCurrentProject);
  const hasCurrentFile = Boolean(state.activePath && usesCurrentProject);
  elements.codexSelectionContext.disabled = !hasSelection;
  if (!hasSelection) elements.codexSelectionContext.checked = usesCurrentProject;
  elements.codexSelectionLabel.textContent = hasSelection
    ? `选区 · ${selectedText.length} 字符`
    : '选区';
  elements.codexCurrentFileContext.disabled = !hasCurrentFile;
  elements.codexCurrentFileLabel.textContent = hasCurrentFile
    ? `当前文件 · ${state.activePath.split('/').pop()}`
    : '当前文件';
  elements.codexCompileLogContext.disabled = !codexState.compileLogAvailable || !usesCurrentProject;
  if (!codexState.compileLogAvailable || !usesCurrentProject) elements.codexCompileLogContext.checked = false;
}

function showCodexThinking(message = 'Codex 正在思考…') {
  let item = codexState.thinkingNode;
  if (!item?.isConnected) {
    item = document.createElement('article');
    item.className = 'codex-thinking';
    item.setAttribute('role', 'status');
    item.setAttribute('aria-live', 'polite');

    const label = document.createElement('span');
    label.className = 'codex-message-label';
    label.textContent = 'Codex';

    const body = document.createElement('div');
    body.className = 'codex-thinking-body';
    const text = document.createElement('span');
    text.className = 'codex-thinking-text';
    const dots = document.createElement('span');
    dots.className = 'codex-thinking-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 3; index += 1) dots.append(document.createElement('i'));
    body.append(text, dots);
    item.append(label, body);
    codexState.thinkingNode = item;
  }

  const statusText = String(message || 'Codex 正在思考')
    .replace(/^Codex\s*/i, '')
    .replace(/[.…]+$/, '')
    .trim() || '正在思考';
  item.querySelector('.codex-thinking-text').textContent = statusText;
  elements.codexEmpty.hidden = true;
  elements.codexMessages.append(item);
  scrollCodexMessages();
}

function hideCodexThinking() {
  codexState.thinkingNode?.remove();
  codexState.thinkingNode = null;
}

function setCodexRunning(running, message = '') {
  codexState.running = running;
  const canUseCodex = Boolean(state.config?.codex?.canUse);
  elements.codexPanel.classList.toggle('running', running);
  elements.codexExpandButton.classList.toggle('running', running);
  elements.codexSendButton.disabled = running || !canUseCodex;
  elements.codexSendButton.title = running ? '等待当前回答结束后发送' : '发送给 Codex';
  elements.codexPrompt.disabled = !canUseCodex;
  elements.codexPrompt.placeholder = running
    ? '可以先输入下一条 Prompt，当前回答结束后即可发送…'
    : '向 Codex 描述问题…（Enter 发送，Shift+Enter 换行）';
  elements.codexStopButton.hidden = !running;
  elements.codexNewThreadButton.disabled = running;
  elements.codexModelSelect.disabled = running || codexState.modelsLoading || !state.config?.codex?.canUse;
  elements.codexReasoningSelect.disabled = running || codexState.modelsLoading || !state.config?.codex?.canUse;
  elements.codexPermissionSelect.disabled = running || !state.config?.codex?.canUse;
  elements.codexRunStatus.hidden = running;
  if (running) showCodexThinking(message || 'Codex 正在思考…');
  else hideCodexThinking();
  if (message) elements.codexRunStatus.textContent = message;
  renderCodexHistoryList();
}

function closeCodexEventStream() {
  clearTimeout(codexState.eventPollTimer);
  codexState.eventPollTimer = 0;
  codexState.eventSource?.close();
  codexState.eventSource = null;
}

function createCodexLocalId(prefix = 'conversation') {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

function comparableCodexPath(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
    .toLocaleLowerCase();
}

function codexThreadInActiveProject(thread) {
  const projectPath = comparableCodexPath(state.activeProject?.path);
  const threadPath = comparableCodexPath(thread?.cwd);
  return Boolean(projectPath && threadPath && projectPath === threadPath);
}

function activeCodexThread() {
  if (!codexState.activeThreadId) return null;
  return codexState.activeThread
    || codexState.threads.find((thread) => thread.id === codexState.activeThreadId)
    || null;
}

function codexThreadTitle(thread) {
  const title = String(thread?.name || thread?.preview || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return '未命名对话';
  return title.length > 42 ? `${title.slice(0, 42)}…` : title;
}

function codexWorkspaceLabel(thread) {
  const cwd = String(thread?.cwd || '').replaceAll('\\', '/').replace(/\/+$/, '');
  if (!cwd) return '未知工作区';
  return cwd.split('/').pop() || cwd;
}

function codexWorkspaceName(cwd) {
  const normalized = String(cwd || '').replaceAll('\\', '/').replace(/\/+$/, '');
  if (!normalized) return '全部工作区';
  return normalized.split('/').pop() || normalized;
}

function rememberCodexWorkspaces(threads = []) {
  const paths = [state.activeProject?.path, ...threads.map((thread) => thread.cwd)].filter(Boolean);
  for (const workspacePath of paths) {
    const key = comparableCodexPath(workspacePath);
    if (key && !codexState.workspaces.has(key)) codexState.workspaces.set(key, String(workspacePath));
  }
}

function renderCodexWorkspaceOptions() {
  const selectedKey = comparableCodexPath(codexState.workspaceFilter);
  const options = [new Option('全部工作区', '')];
  const workspaces = [...codexState.workspaces.values()].sort((left, right) => (
    codexWorkspaceName(left).localeCompare(codexWorkspaceName(right), 'zh-CN')
  ));
  for (const workspacePath of workspaces) {
    const option = new Option(codexWorkspaceName(workspacePath), workspacePath);
    option.title = workspacePath;
    if (comparableCodexPath(workspacePath) === selectedKey) option.selected = true;
    options.push(option);
  }
  elements.codexWorkspaceFilter.replaceChildren(...options);
}

function setCodexHistoryCollapsed(collapsed) {
  codexState.historyCollapsed = Boolean(collapsed);
  elements.codexHistorySection.classList.toggle('collapsed', codexState.historyCollapsed);
  elements.codexHistoryToggleButton.setAttribute('aria-expanded', String(!codexState.historyCollapsed));
  elements.codexHistoryToggleButton.title = codexState.historyCollapsed ? '展开 Codex 历史' : '收起 Codex 历史';
}

function updateCodexHistoryHeading() {
  const thread = activeCodexThread();
  const selectedWorkspace = codexState.workspaceFilter
    ? codexWorkspaceName(codexState.workspaceFilter)
    : '全部工作区';
  elements.codexHistoryCurrent.textContent = thread
    ? `${codexWorkspaceLabel(thread)} · ${codexThreadTitle(thread)}`
    : selectedWorkspace;
  elements.codexHistoryCurrent.title = thread?.cwd || codexState.workspaceFilter || '全部工作区';
}

function formatCodexHistoryTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function renderCodexHistoryList() {
  updateCodexHistoryHeading();
  elements.codexHistoryCount.textContent = `${codexState.threads.length}${codexState.historyCursor ? '+' : ''}`;
  const items = codexState.threads.map((thread) => {
    const item = document.createElement('li');
    item.className = 'codex-history-item';
    item.classList.toggle('active', thread.id === codexState.activeThreadId);
    item.classList.toggle('current-workspace', codexThreadInActiveProject(thread));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'codex-history-select';
    button.disabled = codexState.running;
    button.dataset.threadId = thread.id;
    button.setAttribute('aria-current', thread.id === codexState.activeThreadId ? 'true' : 'false');
    button.title = `${codexThreadTitle(thread)}\n${thread.cwd || ''}`;

    const icon = document.createElement('span');
    icon.className = 'codex-history-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = codexThreadInActiveProject(thread) ? '●' : '✦';

    const copy = document.createElement('span');
    copy.className = 'codex-history-copy';
    const title = document.createElement('strong');
    title.textContent = codexThreadTitle(thread);
    const detail = document.createElement('small');
    detail.textContent = `${codexWorkspaceLabel(thread)} · ${formatCodexHistoryTime(thread.updatedAt)}`;
    copy.append(title, detail);
    button.append(icon, copy);
    button.addEventListener('click', () => selectCodexThread(thread.id));

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'codex-history-rename';
    rename.disabled = codexState.running;
    rename.title = '重命名此 Codex 对话';
    rename.setAttribute('aria-label', `重命名“${codexThreadTitle(thread)}”`);
    rename.textContent = '✎';
    rename.addEventListener('click', () => openCodexRename(thread.id));
    item.append(button, rename);
    return item;
  });
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'codex-history-empty';
    empty.textContent = codexState.historyLoading ? '正在读取 Codex 历史…' : '没有找到对话';
    items.push(empty);
  }
  elements.codexHistoryList.replaceChildren(...items);
  elements.codexHistoryMoreButton.hidden = !codexState.historyCursor;
  elements.codexHistoryMoreButton.disabled = codexState.historyLoading || codexState.running;
  elements.codexHistoryRefreshButton.disabled = codexState.historyLoading;
}

function renderCodexMessageList() {
  hideCodexThinking();
  codexState.messageNodes.clear();
  codexState.activityNodes.clear();
  elements.codexMessages.replaceChildren(elements.codexEmpty);
  elements.codexEmpty.hidden = codexState.messages.length > 0;
  for (const message of codexState.messages) {
    const item = createCodexMessage(message.role, message.text, message.id, false, false);
    if (message.role === 'assistant' && message.id) codexState.messageNodes.set(message.id, item);
    if (message.role === 'activity' && message.id) {
      const status = ['completed', 'failed', 'in_progress'].includes(message.status)
        ? message.status
        : 'completed';
      item.classList.add(status);
      codexState.activityNodes.set(message.id, item);
    }
  }
}

function renderActiveCodexConversation(statusMessage = '') {
  renderCodexMessageList();
  codexState.filesChanged = false;
  codexState.newThread = !codexState.activeThreadId;
  elements.codexPrompt.value = '';
  updateCodexContext();
  const status = statusMessage || (codexState.activeThreadId
    ? `工作区：${codexWorkspaceLabel(activeCodexThread())} · 已载入历史`
    : '新对话 · 等待指令');
  setCodexRunning(false, status);
  scrollCodexMessages();
}

async function selectCodexThread(threadId) {
  if (codexState.running) return;
  const summary = codexState.threads.find((item) => item.id === threadId);
  if (!summary) return;
  codexState.activeThreadId = threadId;
  codexState.activeThread = summary;
  codexState.messages = [];
  codexState.newThread = false;
  renderCodexHistoryList();
  renderActiveCodexConversation('正在读取这段 Codex 历史…');
  const requestSequence = ++codexState.threadRequestSequence;
  try {
    const data = await api(`/api/codex/threads/${encodeURIComponent(threadId)}`);
    if (requestSequence !== codexState.threadRequestSequence || codexState.activeThreadId !== threadId) return;
    codexState.activeThread = data.thread;
    codexState.messages = Array.isArray(data.thread.messages) ? data.thread.messages : [];
    const index = codexState.threads.findIndex((item) => item.id === threadId);
    if (index >= 0) codexState.threads[index] = { ...codexState.threads[index], ...data.thread, messages: undefined };
    renderCodexHistoryList();
    renderActiveCodexConversation();
    setCodexHistoryCollapsed(true);
  } catch (error) {
    if (requestSequence !== codexState.threadRequestSequence) return;
    renderActiveCodexConversation('无法读取这段历史');
    showToast(error.message, true);
  }
}

function startNewCodexConversation() {
  if (codexState.running) return;
  codexState.threadRequestSequence += 1;
  codexState.activeThreadId = '';
  codexState.activeThread = null;
  codexState.messages = [];
  codexState.newThread = true;
  closeCodexRename();
  renderCodexHistoryList();
  renderActiveCodexConversation();
  setCodexHistoryCollapsed(true);
  elements.codexPrompt.focus();
}

async function loadCodexThreads({ append = false } = {}) {
  if (codexState.historyLoading || !state.activeProject) return;
  codexState.historyLoading = true;
  renderCodexHistoryList();
  const requestSequence = ++codexState.historyRequestSequence;
  const parameters = new URLSearchParams({ limit: '60' });
  const search = elements.codexHistorySearch.value.trim();
  if (search) parameters.set('search', search);
  if (codexState.workspaceFilter) parameters.set('cwd', codexState.workspaceFilter);
  if (append && codexState.historyCursor) parameters.set('cursor', codexState.historyCursor);
  try {
    const data = await api(`/api/codex/threads?${parameters}`);
    if (requestSequence !== codexState.historyRequestSequence) return;
    const incoming = Array.isArray(data.threads) ? data.threads : [];
    rememberCodexWorkspaces(incoming);
    renderCodexWorkspaceOptions();
    if (append) {
      const byId = new Map(codexState.threads.map((thread) => [thread.id, thread]));
      for (const thread of incoming) byId.set(thread.id, thread);
      codexState.threads = [...byId.values()];
    } else {
      codexState.threads = incoming;
    }
    codexState.historyCursor = String(data.nextCursor || '');
    if (codexState.activeThreadId) {
      const refreshed = codexState.threads.find((thread) => thread.id === codexState.activeThreadId);
      if (refreshed) codexState.activeThread = { ...codexState.activeThread, ...refreshed };
    }
  } catch (error) {
    if (requestSequence === codexState.historyRequestSequence) showToast(error.message, true);
  } finally {
    if (requestSequence === codexState.historyRequestSequence) {
      codexState.historyLoading = false;
      renderCodexHistoryList();
    }
  }
}

async function loadCodexHistoryForProject() {
  const projectId = state.activeProject?.id || '';
  clearTimeout(codexState.historySearchTimer);
  closeCodexEventStream();
  codexState.runId = '';
  codexState.running = false;
  codexState.threads = [];
  codexState.activeThreadId = '';
  codexState.activeThread = null;
  codexState.messages = [];
  codexState.historyCursor = '';
  codexState.historyCollapsed = false;
  codexState.historyLoading = false;
  codexState.workspaceFilter = '';
  codexState.workspaces = new Map();
  elements.codexHistorySearch.value = '';
  rememberCodexWorkspaces();
  renderCodexWorkspaceOptions();
  setCodexHistoryCollapsed(false);
  renderCodexHistoryList();
  renderActiveCodexConversation('正在连接 Codex 历史…');
  await loadCodexThreads();
  if (!projectId || state.activeProject?.id !== projectId) return;
  const currentProjectThread = codexState.threads.find(codexThreadInActiveProject);
  if (currentProjectThread) await selectCodexThread(currentProjectThread.id);
  else startNewCodexConversation();
}

function unloadCodexHistory() {
  clearTimeout(codexState.historySearchTimer);
  closeCodexEventStream();
  codexState.historyRequestSequence += 1;
  codexState.threadRequestSequence += 1;
  codexState.runId = '';
  codexState.running = false;
  codexState.newThread = true;
  codexState.threads = [];
  codexState.activeThreadId = '';
  codexState.activeThread = null;
  codexState.messages = [];
  codexState.historyCursor = '';
  codexState.historyCollapsed = false;
  codexState.historyLoading = false;
  codexState.workspaceFilter = '';
  codexState.workspaces = new Map();
  codexState.messageNodes.clear();
  codexState.activityNodes.clear();
  hideCodexThinking();
  codexState.filesChanged = false;
  closeCodexRename();
  elements.codexEmpty.hidden = false;
  elements.codexMessages.replaceChildren(elements.codexEmpty);
  elements.codexHistoryList.replaceChildren();
  elements.codexHistoryCount.textContent = '0';
  elements.codexHistoryMoreButton.hidden = true;
  elements.codexHistorySearch.value = '';
  renderCodexWorkspaceOptions();
  setCodexHistoryCollapsed(false);
  elements.codexPrompt.value = '';
  setCodexRunning(false, '就绪');
}

function openCodexRename(threadId) {
  const thread = codexState.threads.find((item) => item.id === threadId);
  if (!thread || codexState.running) return;
  codexState.renameThreadId = threadId;
  elements.codexRenameInput.value = thread.name || codexThreadTitle(thread);
  elements.codexRenameForm.hidden = false;
  elements.codexRenameInput.focus();
  elements.codexRenameInput.select();
}

function closeCodexRename() {
  codexState.renameThreadId = '';
  elements.codexRenameForm.hidden = true;
  elements.codexRenameInput.value = '';
}

async function renameCodexThread() {
  const threadId = codexState.renameThreadId;
  const name = elements.codexRenameInput.value.replace(/\s+/g, ' ').trim();
  if (!threadId || !name) return;
  const buttons = elements.codexRenameForm.querySelectorAll('button');
  elements.codexRenameInput.disabled = true;
  for (const button of buttons) button.disabled = true;
  try {
    const data = await api(`/api/codex/threads/${encodeURIComponent(threadId)}/name`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    const index = codexState.threads.findIndex((thread) => thread.id === threadId);
    if (index >= 0) codexState.threads[index] = { ...codexState.threads[index], ...data.thread, messages: undefined };
    if (codexState.activeThreadId === threadId) codexState.activeThread = data.thread;
    closeCodexRename();
    renderCodexHistoryList();
    showToast('Codex 对话名称已更新。');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.codexRenameInput.disabled = false;
    for (const button of buttons) button.disabled = false;
  }
}

function scrollCodexMessages() {
  requestAnimationFrame(() => {
    elements.codexMessages.scrollTop = elements.codexMessages.scrollHeight;
  });
}

function renderCodexMessageBody(body, text) {
  const source = String(text || '');
  body.replaceChildren();

  const codePattern = /```([^\r\n`]*)\r?\n?([\s\S]*?)```|`([^`\r\n]+)`/g;
  let sourceOffset = 0;
  for (const match of source.matchAll(codePattern)) {
    if (match.index > sourceOffset) {
      body.append(document.createTextNode(source.slice(sourceOffset, match.index)));
    }
    if (match[0].startsWith('```')) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      const language = String(match[1] || '').trim().slice(0, 32);
      if (language) {
        pre.dataset.language = language;
        code.className = `language-${language.replace(/[^A-Za-z0-9_-]/g, '')}`;
      }
      code.textContent = match[2] || '';
      pre.append(code);
      body.append(pre);
    } else {
      const code = document.createElement('code');
      code.className = 'codex-inline-code';
      code.textContent = match[3] || '';
      body.append(code);
    }
    sourceOffset = match.index + match[0].length;
  }
  if (sourceOffset < source.length) {
    body.append(document.createTextNode(source.slice(sourceOffset)));
  }

  if (typeof window.renderMathInElement !== 'function') return;
  try {
    window.renderMathInElement(body, {
      delimiters: CODEX_MATH_DELIMITERS,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      errorCallback: () => {},
    });
  } catch {
    body.textContent = source;
  }
}

function appendCodexTurnDivider() {
  if (!elements.codexMessages.querySelector('.codex-message.user')) return;
  const divider = document.createElement('div');
  divider.className = 'codex-turn-divider';
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-label', '新一轮对话');
  elements.codexMessages.append(divider);
}

function createCodexMessage(role, text, messageId = '', persist = true, shouldScroll = true) {
  const storedId = messageId || createCodexLocalId('message');
  if (persist) {
    const existing = codexState.messages.find((message) => message.id === storedId);
    if (existing) {
      existing.text = text;
    } else {
      codexState.messages.push({
        id: storedId,
        role,
        text,
        createdAt: Date.now(),
      });
      codexState.messages = codexState.messages.slice(-240);
    }
  }
  elements.codexEmpty.hidden = true;
  if (role === 'user') appendCodexTurnDivider();
  const item = document.createElement('article');
  item.className = `codex-message ${role}`;
  item.dataset.messageId = storedId;
  const label = document.createElement('span');
  label.className = 'codex-message-label';
  label.textContent = role === 'user'
    ? '你'
    : role === 'assistant'
      ? 'Codex'
      : role === 'activity'
        ? '改动文件'
        : '提示';
  const body = document.createElement('div');
  body.className = 'codex-message-body';
  renderCodexMessageBody(body, text);
  item.append(label, body);
  elements.codexMessages.append(item);
  if (shouldScroll) scrollCodexMessages();
  return item;
}

function upsertCodexAssistantMessage(event) {
  hideCodexThinking();
  const messageId = event.messageId || `assistant-${event.sequence}`;
  let item = codexState.messageNodes.get(messageId);
  if (!item) {
    item = createCodexMessage('assistant', event.text || '', messageId);
    codexState.messageNodes.set(messageId, item);
  } else {
    renderCodexMessageBody(item.querySelector('.codex-message-body'), event.text || '');
  }
  const storedMessage = codexState.messages.find((message) => message.id === messageId);
  if (storedMessage) {
    storedMessage.text = event.text || '';
  }
  item.classList.toggle('pending', !event.complete);
  scrollCodexMessages();
}

function upsertCodexFileChange(event) {
  const messageId = event.messageId || `file-change-${event.sequence}`;
  const status = ['completed', 'failed', 'in_progress'].includes(event.status)
    ? event.status
    : 'completed';
  const text = String(event.text || (status === 'failed' ? '文件修改失败。' : '文件修改完成。'));
  let item = codexState.activityNodes.get(messageId);
  if (!item) {
    item = createCodexMessage('activity', text, messageId);
    codexState.activityNodes.set(messageId, item);
  } else {
    renderCodexMessageBody(item.querySelector('.codex-message-body'), text);
  }
  item.classList.remove('completed', 'failed', 'in_progress');
  item.classList.add(status);
  const storedMessage = codexState.messages.find((message) => message.id === messageId);
  if (storedMessage) {
    storedMessage.role = 'activity';
    storedMessage.status = status;
    storedMessage.text = text;
  }
  if (status === 'completed' && Array.isArray(event.changes) && event.changes.length > 0) {
    codexState.filesChanged = true;
  }
  if (codexState.running) showCodexThinking('Codex 正在整理修改总结…');
  scrollCodexMessages();
}

function refreshProjectAfterCodex() {
  state.compileStale = true;
  refreshWorkspace().catch((error) => showToast(`文件已修改，但自动刷新失败：${error.message}`, true));
}

function finishCodexRun(message, failed = false, filesChanged = false) {
  const shouldRefreshProject = (filesChanged || codexState.filesChanged)
    && codexThreadInActiveProject(activeCodexThread());
  closeCodexEventStream();
  codexState.runId = '';
  setCodexRunning(false, message || (failed ? 'Codex 运行失败' : 'Codex 已完成'));
  codexState.filesChanged = false;
  if (shouldRefreshProject) refreshProjectAfterCodex();
  if (!failed) loadCodexThreads().catch(() => {});
}

function applyCodexFinalAssistant(event) {
  const finalAssistant = event?.finalAssistant;
  if (!String(finalAssistant?.text || '').trim()) return;
  upsertCodexAssistantMessage({
    messageId: finalAssistant.messageId || `assistant-final-${event.sequence || Date.now()}`,
    text: finalAssistant.text,
    complete: true,
  });
}

function handleCodexEvent(event) {
  if (event.type === 'status') {
    showCodexThinking(event.message || 'Codex 正在运行…');
    return;
  }
  if (event.type === 'thread') {
    if (event.threadId) {
      const threadId = String(event.threadId).slice(0, 200);
      codexState.activeThreadId = threadId;
      const firstPrompt = codexState.messages.find((message) => message.role === 'user')?.text || '';
      const known = codexState.threads.find((thread) => thread.id === threadId);
      codexState.activeThread = known || {
        id: threadId,
        name: '',
        preview: firstPrompt,
        cwd: state.activeProject?.path || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (!known) codexState.threads.unshift(codexState.activeThread);
      codexState.newThread = false;
      renderCodexHistoryList();
    }
    return;
  }
  if (event.type === 'assistant') {
    upsertCodexAssistantMessage(event);
    return;
  }
  if (event.type === 'file-change') {
    upsertCodexFileChange(event);
    return;
  }
  if (event.type === 'notice') {
    createCodexMessage('notice', event.message || 'Codex 返回了一条提示。');
    return;
  }
  if (event.type === 'done') {
    applyCodexFinalAssistant(event);
    finishCodexRun(event.message || 'Codex 已完成', false, event.filesChanged === true);
    return;
  }
  if (event.type === 'error') {
    applyCodexFinalAssistant(event);
    if (event.recoverable === 'context-window') {
      if (!elements.codexPrompt.value.trim() && event.retryPrompt) {
        elements.codexPrompt.value = event.retryPrompt;
      }
      createCodexMessage('notice', event.message || '上下文已压缩，可以重新发送刚才的问题。');
      finishCodexRun('上下文已压缩 · 可继续发送', false, event.filesChanged === true);
      updateCodexContext();
      elements.codexPrompt.focus();
      return;
    }
    createCodexMessage('notice', event.message || 'Codex 运行失败。');
    finishCodexRun('Codex 运行失败', true, event.filesChanged === true);
  }
}

function receiveCodexEvent(event) {
  const sequence = Math.max(0, Number(event?.sequence) || 0);
  if (sequence && sequence <= codexState.lastEventSequence) return false;
  handleCodexEvent(event);
  if (sequence) codexState.lastEventSequence = sequence;
  return true;
}

function scheduleCodexEventPoll(runId, delay = 1200) {
  clearTimeout(codexState.eventPollTimer);
  if (!codexState.running || codexState.runId !== runId) return;
  codexState.eventPollTimer = setTimeout(() => pollCodexRunEvents(runId), delay);
}

async function pollCodexRunEvents(runId) {
  if (!codexState.running || codexState.runId !== runId || !state.activeProject) return;
  const projectId = state.activeProject.id;
  try {
    const data = await api(`/api/codex/runs/${encodeURIComponent(runId)}?after=${codexState.lastEventSequence}`);
    if (
      !codexState.running
      || codexState.runId !== runId
      || state.activeProject?.id !== projectId
    ) return;
    codexState.eventPollFailures = 0;
    for (const event of Array.isArray(data.events) ? data.events : []) {
      receiveCodexEvent(event);
      if (!codexState.running || codexState.runId !== runId) return;
    }
  } catch {
    if (!codexState.running || codexState.runId !== runId) return;
    codexState.eventPollFailures += 1;
    if (codexState.eventPollFailures === 1) {
      showCodexThinking('实时连接不稳定，正在自动同步回答…');
    }
  }
  const retryDelay = codexState.eventPollFailures
    ? Math.min(5000, 1200 * (codexState.eventPollFailures + 1))
    : 1200;
  scheduleCodexEventPoll(runId, retryDelay);
}

function codexHistoryContainsLatestTurn(messages) {
  const latestUser = [...codexState.messages].reverse().find((message) => message.role === 'user');
  if (!latestUser) return true;
  let matchingUserIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role === 'user' && messages[index].text === latestUser.text) {
      matchingUserIndex = index;
    }
  }
  return matchingUserIndex >= 0 && messages
    .slice(matchingUserIndex + 1)
    .some((message) => message.role === 'assistant' || message.role === 'activity');
}

async function refreshCodexConversation() {
  if (!state.activeProject || !state.config?.codex?.canUse) {
    showToast('当前无法刷新 Codex 对话。', true);
    return false;
  }
  if (elements.codexConversationRefreshButton.dataset.loading === 'true') return false;

  const projectId = state.activeProject.id;
  const draft = elements.codexPrompt.value;
  const thinkingMessage = elements.codexMessages
    .querySelector('.codex-thinking-text')?.textContent || 'Codex 正在思考…';
  elements.codexConversationRefreshButton.dataset.loading = 'true';
  elements.codexConversationRefreshButton.disabled = true;

  try {
    const runId = codexState.runId;
    if (runId && codexState.running) await pollCodexRunEvents(runId);
    if (state.activeProject?.id !== projectId) return false;

    const threadId = codexState.activeThreadId;
    if (!threadId) {
      showToast(codexState.running ? '任务状态已刷新，回答仍在生成中。' : '当前没有可刷新的已保存对话。');
      return true;
    }

    const data = await api(`/api/codex/threads/${encodeURIComponent(threadId)}`);
    if (state.activeProject?.id !== projectId || codexState.activeThreadId !== threadId) return false;
    const incomingMessages = Array.isArray(data.thread?.messages) ? data.thread.messages : [];
    if (codexState.running && !codexHistoryContainsLatestTurn(incomingMessages)) {
      showToast('任务状态已刷新，回答仍在生成中。');
      return true;
    }

    codexState.activeThread = data.thread;
    codexState.messages = incomingMessages;
    const threadIndex = codexState.threads.findIndex((thread) => thread.id === threadId);
    if (threadIndex >= 0) {
      codexState.threads[threadIndex] = { ...codexState.threads[threadIndex], ...data.thread, messages: undefined };
    }
    renderCodexHistoryList();
    renderCodexMessageList();
    elements.codexPrompt.value = draft;
    updateCodexContext();
    if (codexState.running) showCodexThinking(thinkingMessage);
    else {
      elements.codexRunStatus.textContent = data.thread?.historyTruncated
        ? `已刷新最近 ${data.thread.loadedTurnCount || 0} 轮`
        : '对话已刷新';
    }
    scrollCodexMessages();
    showToast(data.thread?.historyTruncated
      ? `对话很长，已刷新最近 ${data.thread.loadedTurnCount || 0} 轮。`
      : 'Codex 对话已刷新。');
    return true;
  } catch (error) {
    showToast(`刷新对话失败：${error.message}`, true);
    return false;
  } finally {
    elements.codexConversationRefreshButton.dataset.loading = 'false';
    elements.codexConversationRefreshButton.disabled = false;
  }
}

function connectCodexRun(runId) {
  closeCodexEventStream();
  codexState.lastEventSequence = 0;
  codexState.eventPollFailures = 0;
  const eventUrl = authenticatedResourceUrl(`/api/codex/runs/${encodeURIComponent(runId)}/events`, {
    project: state.activeProject.id,
  });
  const eventSource = new EventSource(eventUrl);
  codexState.eventSource = eventSource;
  eventSource.onmessage = (message) => {
    try {
      receiveCodexEvent(JSON.parse(message.data));
    } catch {
      createCodexMessage('notice', '无法读取 Codex 返回的消息。');
    }
  };
  eventSource.onerror = () => {
    if (codexState.eventSource !== eventSource || !codexState.running) return;
    showCodexThinking('Codex 连接暂时中断，正在重连…');
    scheduleCodexEventPoll(runId, 100);
  };
  scheduleCodexEventPoll(runId);
}

async function sendCodexPrompt(promptOverride = '') {
  const prompt = String(promptOverride || elements.codexPrompt.value).trim();
  if (!state.config?.codex?.canUse) {
    showToast('Codex 当前只允许这台 LocalTeX 主机使用。', true);
    return false;
  }
  if (!prompt || codexState.running) return false;

  if (state.dirty && !await saveFile(true)) return false;
  const selection = codeEditor.getSelectedText();
  const range = codeEditor.getSelectionRange();
  const usesCurrentProject = !codexState.activeThreadId || codexThreadInActiveProject(activeCodexThread());
  const includeSelection = Boolean(usesCurrentProject && selection && elements.codexSelectionContext.checked);
  const body = {
    prompt,
    activeFile: usesCurrentProject ? state.activePath || '' : '',
    mainFile: usesCurrentProject ? state.mainDocument || '' : '',
    includeCurrentFile: Boolean(usesCurrentProject && state.activePath && elements.codexCurrentFileContext.checked),
    includeSelection,
    selection: includeSelection ? selection : '',
    selectionStartLine: includeSelection ? range.start.row + 1 : 0,
    selectionEndLine: includeSelection ? range.end.row + 1 : 0,
    includeCompileLog: Boolean(usesCurrentProject && elements.codexCompileLogContext.checked),
    threadId: codexState.activeThreadId || '',
    newThread: !codexState.activeThreadId && codexState.newThread,
  };

  openCodexPane();
  codexState.filesChanged = false;
  createCodexMessage('user', prompt);
  elements.codexPrompt.value = '';
  setCodexRunning(true, '正在启动本机 Codex…');
  try {
    const result = await api('/api/codex/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    codexState.newThread = false;
    codexState.runId = result.run.id;
    connectCodexRun(result.run.id);
    return true;
  } catch (error) {
    createCodexMessage('notice', error.message);
    finishCodexRun('无法启动 Codex', true);
    return false;
  }
}

async function stopCodexRun(silent = false) {
  if (!codexState.runId || !codexState.running) return;
  const runId = codexState.runId;
  try {
    await api(`/api/codex/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
    showCodexThinking('正在停止 Codex…');
  } catch (error) {
    if (!silent) showToast(error.message, true);
  }
}

function askCodexAboutDiagnostic(diagnostic) {
  elements.codexCompileLogContext.checked = codexState.compileLogAvailable;
  elements.codexCurrentFileContext.checked = Boolean(state.activePath);
  const location = diagnostic.file
    ? `${diagnostic.file}${diagnostic.line ? ` 第 ${diagnostic.line} 行` : ''}`
    : '本次编译';
  return sendCodexPrompt(`请分析并给出修复这个 LaTeX 编译问题的具体方案：${location}，${diagnostic.message}`);
}

function handleCodexQuickAction(action) {
  if (action === 'compile') {
    if (!codexState.compileLogAvailable) {
      showToast('请先保存并编译一次，再让 Codex 分析日志。', true);
      return;
    }
    elements.codexCompileLogContext.checked = true;
    sendCodexPrompt('请分析最近一次 LaTeX 编译日志，定位关键问题，并给出可以直接执行的修复步骤。');
    return;
  }
  if (action === 'selection') {
    if (!codeEditor.getSelectedText()) {
      showToast('请先在编辑器中选中需要修改的内容。', true);
      return;
    }
    elements.codexSelectionContext.checked = true;
    sendCodexPrompt('请润色选中的论文内容，保留原有 LaTeX 命令、引用和数学表达，并说明主要修改。');
    return;
  }
  if (action === 'review') {
    if (!state.activePath) {
      showToast('请先打开一个文本文件。', true);
      return;
    }
    elements.codexCurrentFileContext.checked = true;
    sendCodexPrompt('请检查当前文件的 LaTeX 结构、学术表达和潜在编译问题，按优先级给出修改建议。');
  }
}

function switchPreview(tab) {
  const activeTab = tab === 'log' ? 'log' : 'pdf';
  const visibility = {
    pdf: activeTab === 'pdf',
    log: activeTab === 'log',
  };
  elements.pdfPanel.hidden = !visibility.pdf;
  elements.logPanel.hidden = !visibility.log;
  elements.pdfTab.classList.toggle('active', visibility.pdf);
  elements.logTab.classList.toggle('active', visibility.log);
  elements.pdfTab.setAttribute('aria-selected', String(visibility.pdf));
  elements.logTab.setAttribute('aria-selected', String(visibility.log));
}

function renderDiagnostics(diagnostics = []) {
  elements.diagnostics.replaceChildren();
  for (const diagnostic of diagnostics) {
    const item = document.createElement('div');
    item.className = `diagnostic ${diagnostic.level || ''}`;
    const location = diagnostic.file
      ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ''} — `
      : '';
    const message = document.createElement('span');
    message.className = 'diagnostic-message';
    message.textContent = `${location}${diagnostic.message}`;
    item.append(message);
    if (state.config?.codex?.canUse) {
      const codexButton = document.createElement('button');
      codexButton.className = 'diagnostic-codex-button';
      codexButton.type = 'button';
      codexButton.textContent = '✦ Codex';
      codexButton.title = '让 Codex 分析这个错误';
      codexButton.addEventListener('click', () => askCodexAboutDiagnostic(diagnostic));
      item.append(codexButton);
    }
    elements.diagnostics.append(item);
  }
}

const PDFJS_ASSET_ROOT = '/vendor/pdfjs/';

function setCompileButtonRunning(running) {
  elements.compileButton.disabled = running;
  elements.mainDocumentSelect.disabled = running;
  elements.sourceToPdfButton.disabled = running || !state.activePath?.toLowerCase().endsWith('.tex');
  elements.compileButton.textContent = running ? '正在保存并编译…' : '保存并编译 ';
  if (!running) {
    const shortcut = document.createElement('kbd');
    shortcut.textContent = 'Ctrl S';
    elements.compileButton.append(shortcut);
  }
}

function loadPdfJsRuntime() {
  if (!pdfJsRuntimePromise) {
    pdfJsRuntimePromise = import(`${PDFJS_ASSET_ROOT}build/pdf.mjs`).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSET_ROOT}build/pdf.worker.mjs`;
      return pdfjs;
    });
  }
  return pdfJsRuntimePromise;
}

function loadPdfJsViewerRuntime() {
  if (!pdfJsViewerRuntimePromise) {
    pdfJsViewerRuntimePromise = import(`${PDFJS_ASSET_ROOT}web/pdf_viewer.mjs`);
  }
  return pdfJsViewerRuntimePromise;
}

function setPdfRenderStatus(message = '', error = false) {
  elements.pdfRenderStatus.hidden = !message;
  elements.pdfRenderStatus.textContent = message;
  elements.pdfRenderStatus.classList.toggle('error', error);
}

function capturePdfViewState() {
  const preview = elements.pdfPreview;
  const shells = [...elements.pdfPages.querySelectorAll('.pdf-page-shell')];
  if (!pdfPreviewState.document || preview.hidden || !shells.length || preview.clientHeight <= 0) {
    return null;
  }

  const previewRect = preview.getBoundingClientRect();
  const centerX = previewRect.left + (preview.clientWidth / 2);
  const centerY = previewRect.top + (preview.clientHeight / 2);
  let selectedShell = shells[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const shell of shells) {
    const rect = shell.getBoundingClientRect();
    const containsCenter = centerY >= rect.top && centerY <= rect.bottom;
    const distance = containsCenter ? 0 : Math.min(Math.abs(centerY - rect.top), Math.abs(centerY - rect.bottom));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      selectedShell = shell;
    }
  }

  const shellRect = selectedShell.getBoundingClientRect();
  const verticalRatio = shellRect.height > 0 ? clamp((centerY - shellRect.top) / shellRect.height, 0, 1) : 0;
  const horizontalRatio = shellRect.width > 0 ? clamp((centerX - shellRect.left) / shellRect.width, 0, 1) : 0.5;
  return {
    page: Number(selectedShell.dataset.page) || 1,
    verticalRatio,
    horizontalRatio,
    zoom: pdfPreviewState.zoom,
  };
}

async function restorePdfViewState(viewState, generation = pdfPreviewState.renderGeneration) {
  if (!viewState || generation !== pdfPreviewState.renderGeneration) return;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (generation !== pdfPreviewState.renderGeneration) return;

  const page = clamp(Math.round(Number(viewState.page) || 1), 1, pdfPreviewState.document?.numPages || 1);
  const shell = elements.pdfPages.querySelector(`.pdf-page-shell[data-page="${page}"]`);
  if (!shell) return;
  const preview = elements.pdfPreview;
  const previewRect = preview.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  const verticalRatio = Number(viewState.verticalRatio);
  const horizontalRatio = Number(viewState.horizontalRatio);
  const targetY = shellRect.top + (shellRect.height * clamp(Number.isFinite(verticalRatio) ? verticalRatio : 0, 0, 1));
  const targetX = shellRect.left + (shellRect.width * clamp(Number.isFinite(horizontalRatio) ? horizontalRatio : 0.5, 0, 1));
  preview.scrollTop = clamp(
    preview.scrollTop + targetY - previewRect.top - (preview.clientHeight / 2),
    0,
    Math.max(0, preview.scrollHeight - preview.clientHeight),
  );
  preview.scrollLeft = clamp(
    preview.scrollLeft + targetX - previewRect.left - (preview.clientWidth / 2),
    0,
    Math.max(0, preview.scrollWidth - preview.clientWidth),
  );
  pdfPreviewState.savedView = capturePdfViewState() || viewState;
  schedulePdfPageIndicatorUpdate();
}

function clearPdfTextLayers() {
  for (const builder of pdfPreviewState.textLayerBuilders) builder.cancel();
  pdfPreviewState.textLayerBuilders = [];
}

function clearPdfPreview() {
  stopPdfPan();
  pdfPreviewState.renderGeneration += 1;
  pdfPreviewState.renderSequence += 1;
  clearTimeout(pdfPreviewState.renderTimer);
  cancelAnimationFrame(pdfPreviewState.pageIndicatorFrame);
  pdfPreviewState.pageIndicatorFrame = 0;
  clearPdfTextLayers();
  pdfPreviewState.loadingTask?.destroy?.();
  pdfPreviewState.document?.destroy?.();
  pdfPreviewState.document = null;
  pdfPreviewState.loadingTask = null;
  pdfPreviewState.source = '';
  pdfPreviewState.mainFile = '';
  pdfPreviewState.previewPath = '';
  pdfPreviewState.savedView = null;
  pdfPreviewState.zoom = 1;
  clearTimeout(synctexState.pdfMarkerTimer);
  elements.pdfPages.replaceChildren();
  setPdfRenderStatus();
  elements.pdfPreview.hidden = true;
  elements.pdfPageIndicator.hidden = true;
  elements.pdfPageIndicator.textContent = '第 — / — 页';
  elements.pdfDownloadButton.disabled = true;
  elements.pdfResetZoomButton.disabled = true;
}

async function renderPdfPages(generation = pdfPreviewState.renderGeneration) {
  const pdf = pdfPreviewState.document;
  if (!pdf || generation !== pdfPreviewState.renderGeneration) return;
  const pdfjsViewer = await loadPdfJsViewerRuntime();
  if (generation !== pdfPreviewState.renderGeneration) return;
  const renderSequence = pdfPreviewState.renderSequence + 1;
  pdfPreviewState.renderSequence = renderSequence;
  clearPdfTextLayers();
  const textLayerBuilders = [];
  pdfPreviewState.textLayerBuilders = textLayerBuilders;

  const availableWidth = Math.max(240, elements.pdfPreview.clientWidth - 32);
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const pages = document.createDocumentFragment();
  setPdfRenderStatus(`正在渲染 1 / ${pdf.numPages} 页…`);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (generation !== pdfPreviewState.renderGeneration || renderSequence !== pdfPreviewState.renderSequence) return;
    const page = await pdf.getPage(pageNumber);
    const naturalViewport = page.getViewport({ scale: 1 });
    const scale = (availableWidth / naturalViewport.width) * pdfPreviewState.zoom;
    const viewport = page.getViewport({ scale });
    const cssWidth = Math.max(1, Math.floor(viewport.width));
    const cssHeight = Math.max(1, Math.floor(viewport.height));
    const pageShell = document.createElement('div');
    const canvas = document.createElement('canvas');
    const textLayerBuilder = new pdfjsViewer.TextLayerBuilder({ pdfPage: page });
    const textLayer = textLayerBuilder.div;
    textLayerBuilders.push(textLayerBuilder);
    pageShell.className = 'pdf-page-shell';
    pageShell.dataset.page = String(pageNumber);
    pageShell.dataset.scale = String(scale);
    pageShell.dataset.pdfWidth = String(naturalViewport.width);
    pageShell.dataset.pdfHeight = String(naturalViewport.height);
    pageShell.style.width = `${cssWidth}px`;
    pageShell.style.height = `${cssHeight}px`;
    pageShell.style.setProperty('--total-scale-factor', String(viewport.scale * viewport.userUnit));
    pageShell.style.setProperty('--scale-round-x', '1px');
    pageShell.style.setProperty('--scale-round-y', '1px');
    canvas.className = 'pdf-page-canvas';
    canvas.width = Math.max(1, Math.round(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.round(viewport.height * outputScale));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.setAttribute('aria-label', `PDF 第 ${pageNumber} 页`);
    textLayer.classList.add('pdf-text-layer');
    textLayer.setAttribute('aria-label', `PDF 第 ${pageNumber} 页文字，可拖动选择并复制`);
    pageShell.append(canvas, textLayer);
    pages.append(pageShell);

    const context = canvas.getContext('2d', { alpha: false });
    const renderScaleX = canvas.width / viewport.width;
    const renderScaleY = canvas.height / viewport.height;
    const canvasRender = page.render({
      canvasContext: context,
      transform: [renderScaleX, 0, 0, renderScaleY, 0, 0],
      viewport,
    }).promise;
    const textRender = textLayerBuilder.render({
      viewport,
    }).catch(() => textLayer.remove());
    await Promise.all([canvasRender, textRender]);
    if (generation !== pdfPreviewState.renderGeneration || renderSequence !== pdfPreviewState.renderSequence) return;
    setPdfRenderStatus(`正在渲染 ${pageNumber} / ${pdf.numPages} 页…`);
  }

  if (generation !== pdfPreviewState.renderGeneration || renderSequence !== pdfPreviewState.renderSequence) return;
  elements.pdfPages.replaceChildren(pages);
  setPdfRenderStatus();
  schedulePdfPageIndicatorUpdate();
}

function queuePdfRender(delay = 100, viewState = capturePdfViewState() || pdfPreviewState.savedView) {
  clearTimeout(pdfPreviewState.renderTimer);
  pdfPreviewState.renderTimer = setTimeout(() => {
    const generation = pdfPreviewState.renderGeneration;
    renderPdfPages(generation)
      .then(() => restorePdfViewState(viewState, generation))
      .catch((error) => {
        setPdfRenderStatus(`PDF 渲染失败：${error.message}`, true);
      });
  }, delay);
}

function hasSourceMappedPdf() {
  return Boolean(
    pdfPreviewState.document
    && pdfPreviewState.mainFile
    && pdfPreviewState.mainFile === state.mainDocument
  );
}

function updatePdfPreviewContext() {
  const sourceMapped = hasSourceMappedPdf();
  elements.pdfSyncHint.hidden = !sourceMapped;
  elements.pdfPageIndicator.hidden = !pdfPreviewState.document;
  schedulePdfPageIndicatorUpdate();
  elements.pdfDownloadButton.disabled = !pdfPreviewState.document || !pdfPreviewState.source;
  elements.pdfResetZoomButton.disabled = !pdfPreviewState.document;
  elements.pdfPreview.title = sourceMapped
    ? '左键选择文字；右键拖动平移；Alt+单击定位源码'
    : '左键选择文字；右键拖动平移';
  elements.pdfPreview.setAttribute(
    'aria-label',
    pdfPreviewState.previewPath
      ? `PDF 预览：${pdfPreviewState.previewPath}`
      : '编译结果 PDF 预览',
  );
}

function pdfDownloadFileName() {
  const sourcePath = pdfPreviewState.previewPath
    || pdfPreviewState.mainFile
    || state.mainDocument
    || 'document.pdf';
  const fileName = String(sourcePath).replaceAll('\\', '/').split('/').pop() || 'document.pdf';
  if (/\.pdf$/i.test(fileName)) return fileName;
  const stem = fileName.replace(/\.[^.]+$/, '') || 'document';
  return `${stem}.pdf`;
}

async function downloadPdfPreview() {
  if (!pdfPreviewState.document || !pdfPreviewState.source || elements.pdfPreview.hidden) return;

  const source = pdfPreviewState.source;
  const fileName = pdfDownloadFileName();
  elements.pdfDownloadButton.disabled = true;
  elements.pdfDownloadButton.dataset.loading = 'true';

  try {
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) throw new Error(`PDF 下载失败（${response.status}）`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast(`已开始下载 ${fileName}`);
  } catch (error) {
    showToast(error.message || 'PDF 下载失败。', true);
  } finally {
    elements.pdfDownloadButton.dataset.loading = 'false';
    elements.pdfDownloadButton.disabled = !pdfPreviewState.document || !pdfPreviewState.source;
  }
}

async function loadPdfPreview(source, mainFile = state.mainDocument, previewPath = '', viewState = null) {
  stopPdfPan();
  const generation = pdfPreviewState.renderGeneration + 1;
  pdfPreviewState.renderGeneration = generation;
  clearPdfTextLayers();
  pdfPreviewState.loadingTask?.destroy?.();
  pdfPreviewState.document?.destroy?.();
  pdfPreviewState.document = null;
  pdfPreviewState.source = source;
  pdfPreviewState.mainFile = mainFile;
  pdfPreviewState.previewPath = previewPath;
  pdfPreviewState.savedView = null;
  pdfPreviewState.zoom = viewState ? clamp(Number(viewState.zoom) || 1, 0.6, 2.5) : 1;
  updatePdfPreviewContext();
  elements.pdfPages.replaceChildren();
  elements.pdfPreview.hidden = false;
  setPdfRenderStatus('正在加载 PDF…');

  try {
    const pdfjs = await loadPdfJsRuntime();
    const loadingTask = pdfjs.getDocument({
      url: source,
      cMapUrl: `${PDFJS_ASSET_ROOT}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_ASSET_ROOT}standard_fonts/`,
      wasmUrl: `${PDFJS_ASSET_ROOT}wasm/`,
    });
    pdfPreviewState.loadingTask = loadingTask;
    const pdf = await loadingTask.promise;
    if (generation !== pdfPreviewState.renderGeneration) {
      await pdf.destroy();
      return;
    }
    pdfPreviewState.loadingTask = null;
    pdfPreviewState.document = pdf;
    updatePdfPreviewContext();
    await renderPdfPages(generation);
    await restorePdfViewState(viewState, generation);
    return true;
  } catch (error) {
    if (generation !== pdfPreviewState.renderGeneration) return;
    setPdfRenderStatus(`PDF 预览加载失败：${error.message}`, true);
    showToast('PDF 预览加载失败。', true);
    return false;
  }
}

async function previewPdfFile(file) {
  try {
    const pdfUrl = authenticatedResourceUrl('/api/asset', {
      path: file.path,
      project: state.activeProject.id,
      t: Date.now(),
    });
    state.selectedPath = file.path;
    renderFileTree();
    elements.previewEmpty.hidden = true;
    elements.compileTime.textContent = `预览 · ${file.path}`;
    elements.compileTime.title = file.path;
    switchPreview('pdf');
    const previewLoaded = await loadPdfPreview(pdfUrl, '', file.path);
    if (previewLoaded) showToast(`正在预览 ${file.path}`);
  } catch (error) {
    showToast(error.message, true);
  }
}

function resetPdfPreview() {
  if (!pdfPreviewState.document || elements.pdfPreview.hidden) return;
  const viewState = capturePdfViewState() || pdfPreviewState.savedView;
  pdfPreviewState.zoom = 1;
  pdfPreviewState.savedView = viewState ? { ...viewState, zoom: 1 } : null;
  queuePdfRender(0, pdfPreviewState.savedView);
  showToast('PDF 预览已恢复为铺满宽度。');
}

function zoomPdfPreview(event) {
  if (!event.ctrlKey || !pdfPreviewState.document) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  pdfPreviewState.zoom = clamp(pdfPreviewState.zoom * factor, 0.6, 2.5);
  queuePdfRender();
}

function startPdfPan(event) {
  if (event.button !== 2 || !pdfPreviewState.document || elements.pdfPreview.hidden) return;
  event.preventDefault();
  pdfPanState.active = true;
  pdfPanState.pointerId = event.pointerId;
  pdfPanState.lastX = event.clientX;
  pdfPanState.lastY = event.clientY;
  elements.pdfPreview.classList.add('is-panning');
  elements.pdfPreview.focus({ preventScroll: true });
  elements.pdfPreview.setPointerCapture?.(event.pointerId);
}

function movePdfPan(event) {
  if (!pdfPanState.active || event.pointerId !== pdfPanState.pointerId) return;
  if ((event.buttons & 2) === 0) {
    stopPdfPan(event);
    return;
  }
  event.preventDefault();
  const deltaX = event.clientX - pdfPanState.lastX;
  const deltaY = event.clientY - pdfPanState.lastY;
  pdfPanState.lastX = event.clientX;
  pdfPanState.lastY = event.clientY;
  elements.pdfPreview.scrollLeft -= deltaX;
  elements.pdfPreview.scrollTop -= deltaY;
  const viewState = capturePdfViewState();
  if (viewState) pdfPreviewState.savedView = viewState;
}

function stopPdfPan(event) {
  if (!pdfPanState.active) return;
  if (event && event.pointerId !== pdfPanState.pointerId) return;
  const pointerId = pdfPanState.pointerId;
  pdfPanState.active = false;
  pdfPanState.pointerId = null;
  elements.pdfPreview.classList.remove('is-panning');
  if (pointerId !== null && elements.pdfPreview.hasPointerCapture?.(pointerId)) {
    elements.pdfPreview.releasePointerCapture(pointerId);
  }
}

function visiblePdfPage() {
  const previewRect = elements.pdfPreview.getBoundingClientRect();
  const centerY = previewRect.top + (previewRect.height / 2);
  let page = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (const shell of elements.pdfPages.querySelectorAll('.pdf-page-shell')) {
    const rect = shell.getBoundingClientRect();
    const nextDistance = Math.abs((rect.top + (rect.height / 2)) - centerY);
    if (nextDistance < distance) {
      distance = nextDistance;
      page = Number(shell.dataset.page) || 0;
    }
  }
  return page;
}

function updatePdfPageIndicator() {
  const totalPages = Number(pdfPreviewState.document?.numPages) || 0;
  if (!totalPages || elements.pdfPreview.hidden) {
    elements.pdfPageIndicator.hidden = true;
    return;
  }
  const currentPage = clamp(visiblePdfPage() || 1, 1, totalPages);
  elements.pdfPageIndicator.hidden = false;
  elements.pdfPageIndicator.textContent = `第 ${currentPage} / ${totalPages} 页`;
  elements.pdfPageIndicator.title = `当前第 ${currentPage} 页，共 ${totalPages} 页`;
}

function schedulePdfPageIndicatorUpdate() {
  if (pdfPreviewState.pageIndicatorFrame) return;
  pdfPreviewState.pageIndicatorFrame = requestAnimationFrame(() => {
    pdfPreviewState.pageIndicatorFrame = 0;
    updatePdfPageIndicator();
  });
}

function showPdfSyncPosition(position) {
  const shell = elements.pdfPages.querySelector(`.pdf-page-shell[data-page="${position.page}"]`);
  if (!shell) throw new Error(`PDF 第 ${position.page} 页尚未渲染。`);
  elements.pdfPages.querySelectorAll('.pdf-sync-marker').forEach((marker) => marker.remove());
  elements.pdfPages.querySelectorAll('.sync-target').forEach((page) => page.classList.remove('sync-target'));

  const scale = Number(shell.dataset.scale) || 1;
  const marker = document.createElement('span');
  marker.className = 'pdf-sync-marker';
  marker.setAttribute('aria-hidden', 'true');
  marker.style.left = `${position.x * scale}px`;
  marker.style.top = `${position.y * scale}px`;
  shell.append(marker);
  shell.classList.add('sync-target');

  elements.pdfPreview.scrollTo({
    top: Math.max(0, shell.offsetTop + (position.y * scale) - (elements.pdfPreview.clientHeight / 2)),
    left: Math.max(0, shell.offsetLeft + (position.x * scale) - (elements.pdfPreview.clientWidth / 2)),
    behavior: 'smooth',
  });

  clearTimeout(synctexState.pdfMarkerTimer);
  synctexState.pdfMarkerTimer = setTimeout(() => {
    marker.remove();
    shell.classList.remove('sync-target');
  }, 3200);
}

function clearSourceSyncMarker() {
  clearTimeout(synctexState.editorMarkerTimer);
  if (synctexState.editorMarker !== null) {
    codeEditor.session.removeMarker(synctexState.editorMarker);
    synctexState.editorMarker = null;
  }
}

function showSourceSyncPosition(line, column = -1) {
  clearSourceSyncMarker();
  const row = Math.max(0, line - 1);
  const editorColumn = column > 0 ? column - 1 : 0;
  codeEditor.gotoLine(line, editorColumn, true);
  const Range = window.ace.require('ace/range').Range;
  synctexState.editorMarker = codeEditor.session.addMarker(
    new Range(row, 0, row, 1),
    'ace_synctex-line',
    'fullLine',
  );
  codeEditor.focus();
  synctexState.editorMarkerTimer = setTimeout(clearSourceSyncMarker, 3200);
}

async function jumpSourceToPdf(sourcePosition = null) {
  if (!state.activePath?.toLowerCase().endsWith('.tex')) {
    showToast('请先打开一个 TeX 源文件。', true);
    return;
  }

  try {
    if (
      state.compileStale
      || !pdfPreviewState.document
      || pdfPreviewState.mainFile !== state.mainDocument
    ) {
      const compiled = await compileDocument();
      if (!compiled) return;
    }

    const cursor = Number.isInteger(sourcePosition?.row) && Number.isInteger(sourcePosition?.column)
      ? sourcePosition
      : codeEditor.getCursorPosition();
    const result = await api('/api/synctex/view', {
      method: 'POST',
      body: JSON.stringify({
        mainFile: state.mainDocument,
        sourceFile: state.activePath,
        line: cursor.row + 1,
        column: cursor.column + 1,
        pageHint: visiblePdfPage(),
      }),
    });
    switchPreview('pdf');
    showPdfSyncPosition(result.positions[0]);
    showToast(`已定位到 PDF 第 ${result.positions[0].page} 页。`);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function jumpPdfToSource(event) {
  if (!event.altKey) return;
  const shell = event.target.closest?.('.pdf-page-shell');
  const canvas = shell?.querySelector('.pdf-page-canvas');
  if (!shell || !canvas) return;
  if (!hasSourceMappedPdf()) return;
  event.preventDefault();
  event.stopPropagation();
  if (state.compileStale) {
    showToast('源码在上次编译后已有修改，请先按 Ctrl+S，再次 Alt+单击 PDF。', true);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const pdfWidth = Number(shell.dataset.pdfWidth) || rect.width;
  const pdfHeight = Number(shell.dataset.pdfHeight) || rect.height;
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left)) * (pdfWidth / rect.width);
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top)) * (pdfHeight / rect.height);

  try {
    const result = await api('/api/synctex/edit', {
      method: 'POST',
      body: JSON.stringify({
        mainFile: state.mainDocument,
        page: Number(shell.dataset.page),
        x,
        y,
      }),
    });
    let file = state.files.find((item) => item.path === result.sourceFile);
    if (!file) {
      await refreshFiles();
      file = state.files.find((item) => item.path === result.sourceFile);
    }
    if (!file) throw new Error(`未在项目中找到 ${result.sourceFile}。`);
    clearSourceSyncMarker();
    if (state.activePath !== result.sourceFile) await openFile(file, true);
    showSourceSyncPosition(result.line, result.column);
    showToast(`已定位到 ${result.sourceFile}:${result.line}。`);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function compileDocument() {
  if (!state.mainDocument) {
    showToast('工作区中没有可以编译的 .tex 文件。', true);
    return false;
  }
  if (state.compileRunning) return false;

  state.compileRunning = true;
  setCompileButtonRunning(true);
  elements.compileTime.textContent = '正在保存并编译';
  elements.compileTime.title = '';

  try {
    const saved = await saveFile(true);
    if (!saved) {
      elements.compileTime.textContent = '保存失败';
      return false;
    }
    elements.compileTime.textContent = '正在干净编译';
    const result = await api('/api/compile', {
      method: 'POST',
      body: JSON.stringify({ mainFile: state.mainDocument }),
    });
    elements.compileLog.textContent = result.output || '编译完成。';
    codexState.compileLogAvailable = true;
    updateCodexContext();
    renderDiagnostics(result.diagnostics);
    elements.compileTime.textContent = `干净编译 · ${(result.durationMs / 1000).toFixed(1)} 秒`;
    const previousPdfView = hasSourceMappedPdf()
      ? capturePdfViewState() || pdfPreviewState.savedView
      : null;
    const pdfUrl = authenticatedResourceUrl('/api/pdf', {
      main: state.mainDocument,
      project: state.activeProject.id,
      t: Date.now(),
    });
    elements.previewEmpty.hidden = true;
    switchPreview('pdf');
    state.compileStale = false;
    state.selectedPath = state.activePath;
    renderFileTree();
    const previewLoaded = await loadPdfPreview(pdfUrl, state.mainDocument, '', previousPdfView);
    if (previewLoaded) showToast(`干净编译成功 · ${result.compiler}`);
    return previewLoaded;
  } catch (error) {
    const result = error.data || {};
    elements.compileLog.textContent = result.output || error.message;
    codexState.compileLogAvailable = true;
    updateCodexContext();
    renderDiagnostics(result.diagnostics || [{ level: 'error', message: error.message }]);
    elements.compileTime.textContent = '编译失败';
    switchPreview('log');
    showToast('编译失败，请查看日志。', true);
    return false;
  } finally {
    state.compileRunning = false;
    setCompileButtonRunning(false);
  }
}

async function createFile() {
  const filePath = window.prompt('请输入新文件路径，例如 sections/method.tex：', 'main.tex');
  if (!filePath) return;

  const initialContent = filePath.toLowerCase().endsWith('.tex')
    ? '% 新建 LaTeX 文件\n'
    : '';
  try {
    await api('/api/file/new', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content: initialContent }),
    });
    await refreshFiles();
    const file = state.files.find((item) => item.path === filePath.replaceAll('\\', '/'));
    if (file) await openFile(file, true, true, true);
    showToast(`已创建 ${filePath}`);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function uploadFiles(fileList) {
  for (const file of fileList) {
    const target = window.prompt(`保存 ${file.name} 到项目中的路径：`, file.name);
    if (!target) continue;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const base64 = String(dataUrl).split(',')[1];
    await api('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ path: target, data: base64 }),
    });
  }
  await refreshFiles();
  showToast('文件上传完成。');
}

async function initialize() {
  try {
    const config = await api('/api/config');
    applyNetworkConfig(config);
    elements.homeCompilerStatus.textContent = config.compiler || '未找到 TeX 编译器';
    elements.homeCompilerStatus.className = `status-pill ${config.compiler ? 'ready' : 'missing'}`;
    if (config.service?.active !== false) {
      await loadProjects();
      const requestedProjectId = projectIdFromUrl();
      const requestedProject = state.projects.find((project) => project.id === requestedProjectId && project.exists);
      if (requestedProject) await openProject(requestedProject.id);
      else if (requestedProjectId) updateProjectUrl();
    }
  } catch (error) {
    showToast(`无法连接本地服务：${error.message}`, true);
  }
}

codeEditor.session.on('change', () => {
  const changed = codeEditor.getValue() !== state.savedContent;
  if (changed) state.compileStale = true;
  setDirty(changed);
  updateCursorPosition();
  if (!elements.editorFindbar.hidden) updateEditorFindCount();
});
codeEditor.selection.on('changeCursor', updateCursorPosition);
codeEditor.selection.on('changeSelection', () => {
  updateCodexContext();
  if (!elements.editorFindbar.hidden) updateEditorFindCount();
});
codeEditor.on('click', (event) => {
  const domEvent = event.domEvent;
  if (
    !domEvent?.altKey
    || !state.activeProject
    || !state.activePath?.toLowerCase().endsWith('.tex')
  ) return;
  domEvent.preventDefault();
  domEvent.stopPropagation();
  const position = event.getDocumentPosition?.() || codeEditor.getCursorPosition();
  jumpSourceToPdf(position);
});
elements.fontDecreaseButton.addEventListener('click', () => changeEditorFontSize(-1));
elements.fontIncreaseButton.addEventListener('click', () => changeEditorFontSize(1));
elements.wrapButton.addEventListener('click', toggleEditorWrap);
elements.editorFindInput.addEventListener('input', () => findEditorMatch(false, false));
elements.editorFindInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeEditorFindbar();
    return;
  }
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    findEditorMatch(event.shiftKey, true);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    elements.editorFindInput.select();
  }
});
elements.editorFindPrevious.addEventListener('click', () => {
  findEditorMatch(true, true);
  elements.editorFindInput.focus();
});
elements.editorFindNext.addEventListener('click', () => {
  findEditorMatch(false, true);
  elements.editorFindInput.focus();
});
elements.editorFindClose.addEventListener('click', () => closeEditorFindbar());
elements.homeThemeButton.addEventListener('click', toggleTheme);
elements.editorThemeButton.addEventListener('click', toggleTheme);
elements.compileButton.addEventListener('click', compileDocument);
elements.sourceToPdfButton.addEventListener('click', jumpSourceToPdf);
elements.refreshButton.addEventListener('click', refreshWorkspace);
elements.newFileButton.addEventListener('click', createFile);
elements.uploadButton.addEventListener('click', () => elements.uploadInput.click());
elements.uploadInput.addEventListener('change', async () => {
  try {
    await uploadFiles(elements.uploadInput.files);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.uploadInput.value = '';
  }
});
elements.pdfTab.addEventListener('click', () => switchPreview('pdf'));
elements.logTab.addEventListener('click', () => switchPreview('log'));
elements.codexComposer.addEventListener('submit', (event) => {
  event.preventDefault();
  sendCodexPrompt();
});
elements.codexPermissionSelect.addEventListener('change', () => {
  updateCodexPermission(elements.codexPermissionSelect.value);
});
elements.codexModelSelect.addEventListener('change', () => {
  updateCodexModel(elements.codexModelSelect.value);
});
elements.codexReasoningSelect.addEventListener('change', () => {
  updateCodexReasoningEffort(elements.codexReasoningSelect.value);
});
elements.codexConversationRefreshButton.addEventListener('click', refreshCodexConversation);
elements.codexPrompt.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  if (codexState.running) return;
  event.preventDefault();
  sendCodexPrompt();
});
elements.codexStopButton.addEventListener('click', () => stopCodexRun());
elements.codexNewThreadButton.addEventListener('click', () => {
  startNewCodexConversation();
});
elements.codexHistoryToggleButton.addEventListener('click', () => {
  setCodexHistoryCollapsed(!codexState.historyCollapsed);
});
elements.codexWorkspaceFilter.addEventListener('change', () => {
  codexState.workspaceFilter = elements.codexWorkspaceFilter.value;
  codexState.historyRequestSequence += 1;
  codexState.historyLoading = false;
  codexState.historyCursor = '';
  updateCodexHistoryHeading();
  loadCodexThreads().catch(() => {});
});
elements.codexHistoryRefreshButton.addEventListener('click', () => {
  codexState.historyRequestSequence += 1;
  codexState.historyLoading = false;
  codexState.historyCursor = '';
  loadCodexThreads().catch(() => {});
});
elements.codexHistoryMoreButton.addEventListener('click', () => {
  loadCodexThreads({ append: true }).catch(() => {});
});
elements.codexHistorySearch.addEventListener('input', () => {
  clearTimeout(codexState.historySearchTimer);
  codexState.historyRequestSequence += 1;
  codexState.historyLoading = false;
  codexState.historyCursor = '';
  codexState.historySearchTimer = setTimeout(() => {
    loadCodexThreads().catch(() => {});
  }, 260);
});
elements.codexRenameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  renameCodexThread();
});
elements.codexRenameCancelButton.addEventListener('click', closeCodexRename);
for (const button of elements.codexPanel.querySelectorAll('[data-codex-action]')) {
  button.addEventListener('click', () => handleCodexQuickAction(button.dataset.codexAction));
}
elements.pdfPreview.addEventListener('click', jumpPdfToSource);
elements.pdfDownloadButton.addEventListener('click', downloadPdfPreview);
elements.pdfResetZoomButton.addEventListener('click', resetPdfPreview);
elements.pdfPreview.addEventListener('wheel', zoomPdfPreview, { passive: false });
elements.pdfPreview.addEventListener('pointerdown', startPdfPan);
elements.pdfPreview.addEventListener('pointermove', movePdfPan);
elements.pdfPreview.addEventListener('pointerup', stopPdfPan);
elements.pdfPreview.addEventListener('pointercancel', stopPdfPan);
elements.pdfPreview.addEventListener('lostpointercapture', stopPdfPan);
elements.pdfPreview.addEventListener('contextmenu', (event) => {
  if (pdfPreviewState.document) event.preventDefault();
});
elements.pdfPreview.addEventListener('scroll', () => {
  const viewState = capturePdfViewState();
  if (viewState) pdfPreviewState.savedView = viewState;
  schedulePdfPageIndicatorUpdate();
}, { passive: true });
if ('ResizeObserver' in window) {
  const pdfResizeObserver = new ResizeObserver(() => {
    if (pdfPreviewState.document && pdfPreviewState.zoom === 1 && !elements.pdfPreview.hidden) {
      queuePdfRender(160);
    }
  });
  pdfResizeObserver.observe(elements.pdfPreview);
}
elements.mainDocumentSelect.addEventListener('change', async () => {
  const requestedPath = elements.mainDocumentSelect.value;
  const file = state.files.find((item) => item.type === 'file' && item.path === requestedPath);
  if (!file) {
    elements.mainDocumentSelect.value = state.mainDocument;
    return;
  }
  try {
    const opened = await openFile(file, false, true, true);
    if (!opened) elements.mainDocumentSelect.value = state.mainDocument;
  } catch (error) {
    elements.mainDocumentSelect.value = state.mainDocument;
    showToast(error.message, true);
  }
});
elements.openFolderButton.addEventListener('click', () => browseProject('folder'));
elements.openTexButton.addEventListener('click', () => browseProject('file'));
elements.addPathButton.addEventListener('click', addProjectByPath);
elements.projectsButton.addEventListener('click', showProjectHome);
elements.projectSearch.addEventListener('input', () => {
  state.projectQuery = elements.projectSearch.value;
  renderProjects();
});
elements.homeShareButton.addEventListener('click', openShareDialog);
elements.shareDialogClose.addEventListener('click', closeShareDialog);
elements.copyShareButton.addEventListener('click', copyShareUrl);
elements.shareToggleButton.addEventListener('click', toggleLanSharing);
elements.workServiceToggle.addEventListener('change', () => setWorkServiceState(elements.workServiceToggle.checked));
elements.resumeServiceButton.addEventListener('click', () => setWorkServiceState(true));
elements.shareDialog.addEventListener('click', (event) => {
  if (event.target === elements.shareDialog) closeShareDialog();
});
elements.collaboratorNameInput.addEventListener('input', () => {
  clearTimeout(collaboratorNameSaveTimer);
  collaboratorNameSaveTimer = setTimeout(
    () => updateCollaboratorName(elements.collaboratorNameInput.value),
    450,
  );
});
elements.collaboratorNameInput.addEventListener('change', () => {
  clearTimeout(collaboratorNameSaveTimer);
  updateCollaboratorName(elements.collaboratorNameInput.value);
});
elements.collaboratorNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') elements.collaboratorNameInput.blur();
});
elements.collaborationButton.addEventListener('click', () => {
  if (state.config?.lan?.isHost) {
    openShareDialog();
    return;
  }
  const name = window.prompt('设置你在协作中的显示名称：', collaborationState.collaborator.name);
  if (name) updateCollaboratorName(name);
});

window.addEventListener('keydown', (event) => {
  if (
    (event.ctrlKey || event.metaKey)
    && event.key.toLowerCase() === 'f'
    && elements.editorPane.contains(document.activeElement)
  ) {
    event.preventDefault();
    openEditorFindbar();
    return;
  }
  if (event.altKey) {
    if (hasSourceMappedPdf()) elements.pdfPreview.classList.add('sync-source-ready');
    if (state.activePath?.toLowerCase().endsWith('.tex')) {
      elements.editorSurface.classList.add('sync-pdf-ready');
    }
  }
  if (event.key === 'Escape' && !elements.shareDialog.hidden) {
    closeShareDialog();
    return;
  }
  if (
    event.key === 'Escape'
    && !isCodexCollapsed()
    && elements.codexPanel.contains(document.activeElement)
  ) {
    collapseCodexPane();
    return;
  }
  if (!state.activeProject) return;
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    if (isCodexCollapsed()) openCodexPane(true);
    else collapseCodexPane();
    return;
  }
  if (event.altKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    toggleEditorWrap();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    compileDocument();
  }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    jumpSourceToPdf();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'Alt') {
    elements.pdfPreview.classList.remove('sync-source-ready');
    elements.editorSurface.classList.remove('sync-pdf-ready');
  }
});
window.addEventListener('blur', () => {
  elements.pdfPreview.classList.remove('sync-source-ready');
  elements.editorSurface.classList.remove('sync-pdf-ready');
});

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

saveCollaborator();
applyEditorView();
initializePanelResizers();
initialize();
