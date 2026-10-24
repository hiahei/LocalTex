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
  copyShareButton: document.querySelector('#copyShareButton'),
  cursorPosition: document.querySelector('#cursorPosition'),
  diagnostics: document.querySelector('#diagnostics'),
  dirtyIndicator: document.querySelector('#dirtyIndicator'),
  editor: document.querySelector('#editor'),
  editorApp: document.querySelector('#editorApp'),
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

const pdfPreviewState = {
  document: null,
  loadingTask: null,
  renderGeneration: 0,
  renderSequence: 0,
  renderTimer: 0,
  source: '',
  mainFile: '',
  zoom: 1,
};
const synctexState = {
  editorMarker: null,
  editorMarkerTimer: 0,
  pdfMarkerTimer: 0,
};
let pdfJsRuntimePromise = null;

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
        sidebarCollapsed: value.sidebarCollapsed === true,
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
    sidebarCollapsed: collapsed,
  };
  updateSidebarCollapseUi(collapsed);
  savePanelLayout();
  requestAnimationFrame(restorePanelLayout);
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
  const collapsed = isSidebarCollapsed();
  const base = width < 900
    ? { sidebar: collapsed ? 0 : 145, editor: 260, preview: 240 }
    : { sidebar: collapsed ? 0 : 170, editor: 320, preview: 280 };
  const dividerWidth = elements.sidebarResizer.offsetWidth + elements.previewResizer.offsetWidth;
  const available = Math.max(1, width - dividerWidth);
  const scale = Math.min(1, available / (base.sidebar + base.editor + base.preview));
  return {
    sidebar: Math.floor(base.sidebar * scale),
    editor: Math.floor(base.editor * scale),
    preview: Math.floor(base.preview * scale),
    available,
  };
}

function currentPanelSizes() {
  return {
    sidebar: isSidebarCollapsed()
      ? panelLayout.preferred?.sidebar || 230
      : elements.sidebarPane.getBoundingClientRect().width,
    preview: elements.previewPane.getBoundingClientRect().width,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function fitPanelSizes(sidebarWidth, previewWidth) {
  const minimums = panelMinimums();
  const collapsed = isSidebarCollapsed();
  const side = collapsed
    ? sidebarWidth
    : clamp(
      sidebarWidth,
      minimums.sidebar,
      minimums.available - minimums.editor - minimums.preview,
    );
  const occupiedSidebar = collapsed ? 0 : side;
  const preview = clamp(
    previewWidth,
    minimums.preview,
    minimums.available - minimums.editor - occupiedSidebar,
  );
  return { sidebar: side, preview };
}

function updateResizerAccessibility(sizes = currentPanelSizes()) {
  const minimums = panelMinimums();
  const occupiedSidebar = isSidebarCollapsed() ? 0 : sizes.sidebar;
  const sidebarMaximum = minimums.available - minimums.editor - sizes.preview;
  const previewMaximum = minimums.available - minimums.editor - occupiedSidebar;
  const values = [
    [elements.sidebarResizer, sizes.sidebar, minimums.sidebar, sidebarMaximum],
    [elements.previewResizer, sizes.preview, minimums.preview, previewMaximum],
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

function applyPanelSizes(sidebarWidth, previewWidth) {
  elements.workspaceLayout.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  elements.workspaceLayout.style.setProperty('--preview-width', `${previewWidth}px`);
  updateResizerAccessibility({ sidebar: sidebarWidth, preview: previewWidth });
  scheduleEditorResize();
}

function restorePanelLayout() {
  updateSidebarCollapseUi(panelLayout.preferred?.sidebarCollapsed === true);
  if (elements.workspaceLayout.clientWidth <= 0) return;
  if (!panelLayout.preferred) {
    updateResizerAccessibility();
    scheduleEditorResize();
    return;
  }
  const fitted = fitPanelSizes(panelLayout.preferred.sidebar, panelLayout.preferred.preview);
  applyPanelSizes(fitted.sidebar, fitted.preview);
}

function resetPanelLayout() {
  panelLayout.preferred = null;
  updateSidebarCollapseUi(false);
  elements.workspaceLayout.style.removeProperty('--sidebar-width');
  elements.workspaceLayout.style.removeProperty('--preview-width');
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
  if (kind === 'sidebar') {
    return {
      sidebar: clamp(
        startSizes.sidebar + deltaX,
        minimums.sidebar,
        minimums.available - startSizes.preview - minimums.editor,
      ),
      preview: startSizes.preview,
    };
  }
  const occupiedSidebar = isSidebarCollapsed() ? 0 : startSizes.sidebar;
  return {
    sidebar: startSizes.sidebar,
    preview: clamp(
      startSizes.preview - deltaX,
      minimums.preview,
      minimums.available - occupiedSidebar - minimums.editor,
    ),
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
    sidebarCollapsed: isSidebarCollapsed(),
  };
  savePanelLayout();
  updateResizerAccessibility(sizes);
}

function startPanelResize(event, kind) {
  if (event.button !== 0 || elements.workspaceLayout.clientWidth <= 0) return;
  event.preventDefault();
  const resizer = event.currentTarget;
  const sizes = currentPanelSizes();
  applyPanelSizes(sizes.sidebar, sizes.preview);
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
  applyPanelSizes(sizes.sidebar, sizes.preview);
}

function resizePanelWithKeyboard(event, kind) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const step = event.shiftKey ? 40 : 12;
  const sizes = resizedPanelSizes(kind, currentPanelSizes(), direction * step);
  applyPanelSizes(sizes.sidebar, sizes.preview);
  panelLayout.preferred = { ...sizes, sidebarCollapsed: isSidebarCollapsed() };
  savePanelLayout();
}

function initializePanelResizers() {
  const resizers = [
    [elements.sidebarResizer, 'sidebar'],
    [elements.previewResizer, 'preview'],
  ];
  for (const [resizer, kind] of resizers) {
    resizer.addEventListener('pointerdown', (event) => startPanelResize(event, kind));
    resizer.addEventListener('keydown', (event) => resizePanelWithKeyboard(event, kind));
    resizer.addEventListener('dblclick', resetPanelLayout);
  }
  elements.collapseSidebarButton.addEventListener('click', () => setSidebarCollapsed(!isSidebarCollapsed()));
  elements.expandSidebarButton.addEventListener('click', () => setSidebarCollapsed(false));
  updateSidebarCollapseUi(panelLayout.preferred?.sidebarCollapsed === true);
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

async function copyShareUrl() {
  if (!elements.shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(elements.shareUrl.value);
  } catch {
    elements.shareUrl.focus();
    elements.shareUrl.select();
    document.execCommand('copy');
  }
  showToast('安全分享链接已复制。');
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
      message: '试试项目名称、文件夹路径或主文档名称。',
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
    main.textContent = project.mainFile ? `主文档 ${project.mainFile}` : '未识别主文档';
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
  state.files = [];
  state.activePath = null;
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
  elements.compileTime.textContent = '尚未编译';
  renderDiagnostics([]);
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
  elements.saveStatus.textContent = value ? '有未保存修改' : state.activePath ? '已保存' : '等待编辑';
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
      row.type = 'button';
      row.className = `tree-row ${file.type}`;
      row.classList.toggle('active', file.path === state.activePath);
      row.dataset.path = file.path;
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(level));
      row.title = file.path;

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
        row.setAttribute('aria-selected', String(file.path === state.activePath));
        row.append(disclosure, icon, label);
        row.addEventListener('click', () => openFile(file));
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

async function confirmDiscard() {
  if (!state.dirty) return true;
  return window.confirm('当前文件还有未保存修改。确定放弃这些修改吗？');
}

async function openFile(file, force = false, revealInTree = true) {
  if (!file.editable) {
    if (/\.(png|jpe?g|svg|pdf)$/i.test(file.path)) {
      const assetUrl = authenticatedResourceUrl('/api/asset', {
        path: file.path,
        project: state.activeProject.id,
      });
      window.open(assetUrl, '_blank', 'noopener');
    } else {
      showToast('这个文件不能在文本编辑器中打开。', true);
    }
    return;
  }

  if (!force && file.path !== state.activePath && !await confirmDiscard()) return;
  clearSourceSyncMarker();
  stopDocumentCollaboration();

  const data = await api(`/api/file?path=${encodeURIComponent(file.path)}`);
  state.activePath = data.path;
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
  renderFileTree();
  const collaborative = await startDocumentCollaboration(data.path);
  if (!collaborative) {
    codeEditor.setReadOnly(false);
    codeEditor.focus();
  }
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

function switchPreview(tab) {
  const showPdf = tab === 'pdf';
  elements.pdfPanel.hidden = !showPdf;
  elements.logPanel.hidden = showPdf;
  elements.pdfTab.classList.toggle('active', showPdf);
  elements.logTab.classList.toggle('active', !showPdf);
  elements.pdfTab.setAttribute('aria-selected', String(showPdf));
  elements.logTab.setAttribute('aria-selected', String(!showPdf));
}

function renderDiagnostics(diagnostics = []) {
  elements.diagnostics.replaceChildren();
  for (const diagnostic of diagnostics) {
    const item = document.createElement('div');
    item.className = `diagnostic ${diagnostic.level || ''}`;
    const location = diagnostic.file
      ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ''} — `
      : '';
    item.textContent = `${location}${diagnostic.message}`;
    elements.diagnostics.append(item);
  }
}

const PDFJS_ASSET_ROOT = '/vendor/pdfjs/';

function setCompileButtonRunning(running) {
  elements.compileButton.disabled = running;
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

function setPdfRenderStatus(message = '', error = false) {
  elements.pdfRenderStatus.hidden = !message;
  elements.pdfRenderStatus.textContent = message;
  elements.pdfRenderStatus.classList.toggle('error', error);
}

function clearPdfPreview() {
  pdfPreviewState.renderGeneration += 1;
  pdfPreviewState.renderSequence += 1;
  clearTimeout(pdfPreviewState.renderTimer);
  pdfPreviewState.loadingTask?.destroy?.();
  pdfPreviewState.document?.destroy?.();
  pdfPreviewState.document = null;
  pdfPreviewState.loadingTask = null;
  pdfPreviewState.source = '';
  pdfPreviewState.mainFile = '';
  pdfPreviewState.zoom = 1;
  clearTimeout(synctexState.pdfMarkerTimer);
  elements.pdfPages.replaceChildren();
  setPdfRenderStatus();
  elements.pdfPreview.hidden = true;
}

async function renderPdfPages(generation = pdfPreviewState.renderGeneration) {
  const pdf = pdfPreviewState.document;
  if (!pdf || generation !== pdfPreviewState.renderGeneration) return;
  const renderSequence = pdfPreviewState.renderSequence + 1;
  pdfPreviewState.renderSequence = renderSequence;

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
    const pageShell = document.createElement('div');
    const canvas = document.createElement('canvas');
    pageShell.className = 'pdf-page-shell';
    pageShell.dataset.page = String(pageNumber);
    pageShell.dataset.scale = String(scale);
    pageShell.dataset.pdfWidth = String(naturalViewport.width);
    pageShell.dataset.pdfHeight = String(naturalViewport.height);
    canvas.className = 'pdf-page-canvas';
    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.setAttribute('aria-label', `PDF 第 ${pageNumber} 页`);
    pageShell.append(canvas);
    pages.append(pageShell);

    const context = canvas.getContext('2d', { alpha: false });
    await page.render({
      canvasContext: context,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    }).promise;
    if (generation !== pdfPreviewState.renderGeneration || renderSequence !== pdfPreviewState.renderSequence) return;
    setPdfRenderStatus(`正在渲染 ${pageNumber} / ${pdf.numPages} 页…`);
  }

  if (generation !== pdfPreviewState.renderGeneration || renderSequence !== pdfPreviewState.renderSequence) return;
  elements.pdfPages.replaceChildren(pages);
  setPdfRenderStatus();
}

function queuePdfRender(delay = 100) {
  clearTimeout(pdfPreviewState.renderTimer);
  pdfPreviewState.renderTimer = setTimeout(() => {
    renderPdfPages().catch((error) => {
      setPdfRenderStatus(`PDF 渲染失败：${error.message}`, true);
    });
  }, delay);
}

async function loadPdfPreview(source, mainFile = state.mainDocument) {
  const generation = pdfPreviewState.renderGeneration + 1;
  pdfPreviewState.renderGeneration = generation;
  pdfPreviewState.loadingTask?.destroy?.();
  pdfPreviewState.document?.destroy?.();
  pdfPreviewState.document = null;
  pdfPreviewState.source = source;
  pdfPreviewState.mainFile = mainFile;
  pdfPreviewState.zoom = 1;
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
    await renderPdfPages(generation);
    return true;
  } catch (error) {
    if (generation !== pdfPreviewState.renderGeneration) return;
    setPdfRenderStatus(`PDF 预览加载失败：${error.message}`, true);
    showToast('PDF 已生成，但预览加载失败。', true);
    return false;
  }
}

function resetPdfPreview() {
  if (!pdfPreviewState.document || elements.pdfPreview.hidden) return;
  pdfPreviewState.zoom = 1;
  elements.pdfPreview.scrollLeft = 0;
  queuePdfRender(0);
  showToast('PDF 预览已恢复为铺满宽度。');
}

function zoomPdfPreview(event) {
  if (!event.ctrlKey || !pdfPreviewState.document) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  pdfPreviewState.zoom = clamp(pdfPreviewState.zoom * factor, 0.6, 2.5);
  queuePdfRender();
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
  if (!(event.ctrlKey || event.metaKey)) return;
  const canvas = event.target.closest?.('.pdf-page-canvas');
  if (!canvas) return;
  event.preventDefault();
  event.stopPropagation();
  if (state.compileStale) {
    showToast('源码在上次编译后已有修改，请先按 Ctrl+S，再次 Ctrl+单击 PDF。', true);
    return;
  }

  const shell = canvas.closest('.pdf-page-shell');
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
    showToast('工作区中没有可以编译的 .tex 主文档。', true);
    return false;
  }
  if (state.compileRunning) return false;

  state.compileRunning = true;
  setCompileButtonRunning(true);
  elements.compileTime.textContent = '正在保存并编译';

  try {
    const saved = await saveFile(true);
    if (!saved) {
      elements.compileTime.textContent = '保存失败';
      return false;
    }
    elements.compileTime.textContent = '编译进行中';
    const result = await api('/api/compile', {
      method: 'POST',
      body: JSON.stringify({ mainFile: state.mainDocument }),
    });
    elements.compileLog.textContent = result.output || '编译完成。';
    renderDiagnostics(result.diagnostics);
    elements.compileTime.textContent = `${(result.durationMs / 1000).toFixed(1)} 秒前完成`;
    const pdfUrl = authenticatedResourceUrl('/api/pdf', {
      main: state.mainDocument,
      project: state.activeProject.id,
      t: Date.now(),
    });
    elements.previewEmpty.hidden = true;
    switchPreview('pdf');
    state.compileStale = false;
    const previewLoaded = await loadPdfPreview(pdfUrl, state.mainDocument);
    if (previewLoaded) showToast(`编译成功 · ${result.compiler}`);
    return previewLoaded;
  } catch (error) {
    const result = error.data || {};
    elements.compileLog.textContent = result.output || error.message;
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
    if (file) await openFile(file, true);
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
});
codeEditor.selection.on('changeCursor', updateCursorPosition);
codeEditor.on('click', (event) => {
  const domEvent = event.domEvent;
  if (
    !(domEvent?.ctrlKey || domEvent?.metaKey)
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
elements.homeThemeButton.addEventListener('click', toggleTheme);
elements.editorThemeButton.addEventListener('click', toggleTheme);
elements.compileButton.addEventListener('click', compileDocument);
elements.sourceToPdfButton.addEventListener('click', jumpSourceToPdf);
elements.refreshButton.addEventListener('click', () => refreshFiles());
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
elements.pdfTab.addEventListener('dblclick', (event) => {
  event.stopPropagation();
  resetPdfPreview();
});
elements.logTab.addEventListener('click', () => switchPreview('log'));
elements.pdfPreview.addEventListener('click', jumpPdfToSource);
elements.pdfPreview.addEventListener('dblclick', (event) => {
  event.stopPropagation();
  if (event.ctrlKey || event.metaKey) return;
  resetPdfPreview();
});
elements.pdfPreview.addEventListener('wheel', zoomPdfPreview, { passive: false });
elements.previewPane.addEventListener('dblclick', (event) => {
  if (event.ctrlKey || event.metaKey || event.target.closest?.('button') || elements.pdfPanel.hidden) return;
  resetPdfPreview();
});
if ('ResizeObserver' in window) {
  const pdfResizeObserver = new ResizeObserver(() => {
    if (pdfPreviewState.document && pdfPreviewState.zoom === 1 && !elements.pdfPreview.hidden) {
      queuePdfRender(160);
    }
  });
  pdfResizeObserver.observe(elements.pdfPreview);
}
elements.mainDocumentSelect.addEventListener('change', async () => {
  state.mainDocument = elements.mainDocumentSelect.value;
  state.compileStale = true;
  if (!state.activeProject) return;
  try {
    const data = await api('/api/projects', {
      method: 'PUT',
      body: JSON.stringify({ id: state.activeProject.id, mainFile: state.mainDocument }),
    });
    state.activeProject = data.project;
  } catch (error) {
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
  if (event.ctrlKey || event.metaKey) {
    if (pdfPreviewState.document) elements.pdfPreview.classList.add('sync-source-ready');
    if (state.activePath?.toLowerCase().endsWith('.tex')) {
      elements.editorSurface.classList.add('sync-pdf-ready');
    }
  }
  if (event.key === 'Escape' && !elements.shareDialog.hidden) {
    closeShareDialog();
    return;
  }
  if (!state.activeProject) return;
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
  if (event.key === 'Control' || event.key === 'Meta') {
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
