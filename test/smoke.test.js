const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const test = require('node:test');
const { WebSocket } = require('ws');
const Y = require('yjs');
const { createCodexAppServerClient } = require('../codex-app-server');
const { createCodexService } = require('../codex-service');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'localtex-test-'));
const testWorkspace = path.join(testRoot, 'workspace');
fs.mkdirSync(testWorkspace, { recursive: true });
fs.writeFileSync(path.join(testWorkspace, 'main.tex'), String.raw`\documentclass{article}
\begin{document}
LocalTeX First Document \cite{localtex2026}
\bibliographystyle{plain}
\bibliography{references}
\end{document}
`, 'utf8');
fs.writeFileSync(path.join(testWorkspace, 'references.bib'), String.raw`@article{localtex2026,
  title = {LocalTeX Clean Build Test},
  author = {LocalTeX},
  year = {2026}
}
`, 'utf8');
fs.writeFileSync(path.join(testWorkspace, 'collab.tex'), 'Collaborative document\n', 'utf8');
fs.writeFileSync(path.join(testWorkspace, 'external-sync.tex'), 'Before external edit\n', 'utf8');
process.env.LOCAL_TEX_DATA_ROOT = path.join(testRoot, 'data');
process.env.LOCAL_TEX_WORKSPACE = testWorkspace;
fs.mkdirSync(process.env.LOCAL_TEX_DATA_ROOT, { recursive: true });
fs.writeFileSync(path.join(process.env.LOCAL_TEX_DATA_ROOT, 'projects.json'), JSON.stringify([{
  id: 'localtex-workspace',
  name: 'Test project',
  path: testWorkspace,
  mainFile: 'main.tex',
  createdAt: new Date().toISOString(),
  lastOpenedAt: null,
}]), 'utf8');

const { createAppServer, parseLocalPickerOutput } = require('../server');

let server;
let baseUrl;

function waitForMessage(socket, predicate, timeout = 4_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for a collaboration message.'));
    }, timeout);

    function cleanup() {
      clearTimeout(timer);
      socket.off('message', onMessage);
      socket.off('close', onClose);
    }

    function onMessage(raw) {
      let message;
      try {
        message = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    }

    function onClose() {
      cleanup();
      reject(new Error('Collaboration socket closed unexpectedly.'));
    }

    socket.on('message', onMessage);
    socket.on('close', onClose);
  });
}

function makeLocalUpdate(document, edit, origin) {
  let update = null;
  const capture = (nextUpdate, nextOrigin) => {
    if (nextOrigin === origin) update = nextUpdate;
  };
  document.on('update', capture);
  document.transact(edit, origin);
  document.off('update', capture);
  assert.ok(update, 'The local edit should produce a Yjs update.');
  return update;
}

function closeSocket(socket) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise((resolve) => {
    socket.once('close', resolve);
    socket.close();
  });
}

function freeTcpPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function seedTestProjectRegistry(dataRoot) {
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(path.join(dataRoot, 'projects.json'), JSON.stringify([{
    id: 'localtex-workspace',
    name: 'Test project',
    path: testWorkspace,
    mainFile: 'main.tex',
    createdAt: new Date().toISOString(),
    lastOpenedAt: null,
  }]), 'utf8');
}

async function waitForService(url, child, errorOutput) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`LAN test server stopped early: ${errorOutput()}`);
    try {
      const response = await fetch(`${url}/api/config`);
      if (response.status === 200) return;
    } catch {
      // The child server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out starting the LAN test server: ${errorOutput()}`);
}

test.before(async () => {
  server = await createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  fs.rmSync(testRoot, { recursive: true, force: true });
});

test('serves the editor and local configuration', async () => {
  const pageResponse = await fetch(`${baseUrl}/`);
  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.text();
  assert.match(page, /LocalTeX/);
  assert.match(page, /id="sidebarResizer"/);
  assert.match(page, /id="collapseSidebarButton"/);
  assert.match(page, /id="expandSidebarButton"/);
  assert.match(page, /保存并编译 <kbd>Ctrl S<\/kbd>/);
  assert.doesNotMatch(page, /id="saveButton"/);
  assert.match(page, /id="previewResizer"/);
  assert.match(page, /id="pdfPreview" class="pdf-preview-scroll"/);
  assert.match(page, /右键拖动平移/);
  assert.doesNotMatch(page, /<iframe id="pdfPreview"/);
  assert.match(page, /id="wrapButton"/);
  assert.match(page, /id="fontIncreaseButton"/);
  assert.match(page, /id="editorFindbar"/);
  assert.match(page, /id="editorFindInput"/);
  assert.match(page, /id="editorFindPrevious"/);
  assert.match(page, /id="editorFindNext"/);
  assert.match(page, /<span>编译对象<\/span>/);
  assert.match(page, /id="mainDocumentSelect" aria-label="选择编译对象"/);
  assert.match(page, /id="sourceToPdfButton"/);
  assert.match(page, /id="codexReasoningSelect"/);
  assert.match(page, /<option value="high">High<\/option>/);
  assert.match(page, /<option value="xhigh">XHigh<\/option>/);
  assert.match(page, /id="pdfSyncHint"/);
  assert.match(page, /id="pdfPageIndicator"/);
  assert.match(page, /id="pdfResetZoomButton"/);
  assert.match(page, /id="pdfDownloadButton"/);
  assert.match(page, /id="pdfAnnotateButton"/);
  assert.match(page, /id="pdfAnnotationPanel"/);
  assert.match(page, /id="pdfSendAnnotationsButton"/);
  assert.match(page, />恢复缩放</);
  assert.match(page, /源码 → PDF/);
  assert.equal((page.match(/<kbd>Alt\+单击<\/kbd>/g) || []).length, 1);
  assert.doesNotMatch(page, /Ctrl\+单击/);
  assert.match(page, /源码 ⇄ PDF/);
  assert.match(page, /id="fileTree"[^>]+role="tree"/);
  assert.match(page, /id="sidebarModeLabel"/);
  assert.match(page, /class="project-overview"/);
  assert.match(page, /id="projectSearch"/);
  assert.doesNotMatch(page, /class="hero-workbench"/);
  assert.match(page, /id="shareDialog"/);
  assert.match(page, /id="shareToggleButton"/);
  assert.match(page, /id="copyShareLabel" aria-live="polite"/);
  assert.match(page, /id="workServiceToggle"/);
  assert.match(page, /id="resumeServiceButton"/);
  assert.match(page, /id="servicePausedScreen"/);
  assert.match(page, /id="collaborationButton"/);
  assert.match(page, /title="修改后会保存为主机默认显示名称"/);
  assert.match(page, /id="homeThemeButton"/);
  assert.match(page, /id="editorThemeButton"/);
  assert.match(page, /id="codexExpandButton"/);
  assert.match(page, /id="codexCollapseButton"/);
  assert.match(page, /id="codexResizer"/);
  assert.match(page, /id="codexPanel"/);
  assert.match(page, /id="codexHistoryList"/);
  assert.match(page, /id="codexHistoryCount"/);
  assert.match(page, /id="codexHistorySearch"/);
  assert.match(page, /id="codexHistoryRefreshButton"/);
  assert.match(page, /id="codexHistoryToggleButton"/);
  assert.match(page, /id="codexWorkspaceFilter"/);
  assert.match(page, /id="codexRenameForm"/);
  assert.match(page, /<strong>询问 Codex<\/strong>/);
  assert.doesNotMatch(page, /在论文项目中询问 Codex/);
  assert.ok(page.indexOf('id="codexExpandButton"') > page.indexOf('id="codexPanel"'));
  assert.doesNotMatch(page, /id="codexLauncher"/);
  assert.doesNotMatch(page, /id="codexTab"/);
  assert.match(page, /id="codexPrompt"/);
  assert.match(page, /id="codexConversationRefreshButton"/);
  assert.match(page, />刷新对话</);
  assert.ok(page.indexOf('id="codexConversationRefreshButton"') < page.indexOf('id="codexPrompt"'));
  assert.match(page, /id="codexModelSelect"/);
  assert.match(page, /跟随本机配置/);
  assert.match(page, /id="codexPermissionSelect"/);
  assert.match(page, /value="workspace-write">项目可写/);
  assert.match(page, /value="full-access">Full access/);
  assert.match(page, /本机 Codex 配置/);
  assert.doesNotMatch(page, /id="shareButton"/);
  assert.match(page, /\/vendor\/ace\/ace\.js/);
  assert.match(page, /\/vendor\/collaboration\.js/);
  assert.match(page, /\/vendor\/katex\/katex\.min\.css/);
  assert.match(page, /\/vendor\/katex\/katex\.min\.js/);
  assert.match(page, /\/vendor\/katex\/contrib\/auto-render\.min\.js/);
  assert.match(page, /\/vendor\/katex\/contrib\/copy-tex\.min\.js/);

  const appResponse = await fetch(`${baseUrl}/app.js`);
  assert.equal(appResponse.status, 200);
  const appScript = await appResponse.text();
  assert.match(appScript, /async function previewPdfFile\(file\)/);
  assert.match(appScript, /loadPdfPreview\(pdfUrl, '', file\.path\)/);
  assert.match(appScript, /async function sendCodexPrompt\(/);
  assert.match(appScript, /function setPdfAnnotationMode\(/);
  assert.match(appScript, /event\.key === 'Escape' && pdfAnnotationState\.active/);
  assert.match(appScript, /cancelPdfAnnotationDrag\(\);/);
  assert.match(appScript, /function renderPdfAnnotations\(/);
  assert.match(appScript, /pdfWidth \/ Math\.max\(1, rect\.width\)/);
  assert.match(appScript, /item\.x \/ pdfWidth/);
  assert.match(appScript, /async function sendPdfAnnotationsToCodex\(/);
  assert.match(appScript, /event\.key !== 'Enter' \|\| event\.shiftKey/);
  assert.match(appScript, /api\('\/api\/synctex\/edit'/);
  assert.match(appScript, /new EventSource\(eventUrl\)/);
  assert.match(appScript, /function receiveCodexEvent\(/);
  assert.match(appScript, /function scheduleCodexEventPoll\(/);
  assert.match(appScript, /async function pollCodexRunEvents\(/);
  assert.match(appScript, /async function refreshCodexConversation\(/);
  assert.match(appScript, /elements\.codexConversationRefreshButton\.addEventListener\('click', refreshCodexConversation\)/);
  assert.match(appScript, /const draft = elements\.codexPrompt\.value/);
  assert.match(appScript, /elements\.codexPrompt\.value = draft/);
  assert.match(appScript, /event\.recoverable === 'context-window'/);
  assert.match(appScript, /elements\.codexPrompt\.value = event\.retryPrompt/);
  assert.match(appScript, /data\.thread\?\.historyTruncated/);
  assert.match(appScript, /after=\$\{codexState\.lastEventSequence\}/);
  assert.match(appScript, /scheduleCodexEventPoll\(runId, 100\)/);
  assert.match(appScript, /function setCodexCollapsed\(/);
  assert.match(appScript, /\[elements\.codexResizer, 'codex'\]/);
  assert.doesNotMatch(appScript, /CODEX_HISTORY_STORAGE_PREFIX|saveCodexHistory/);
  assert.match(appScript, /\/api\/codex\/threads/);
  assert.match(appScript, /function renameCodexThread\(/);
  assert.match(appScript, /function renderCodexHistoryList\(/);
  assert.match(appScript, /function setCodexHistoryCollapsed\(/);
  assert.match(appScript, /async function updateCodexPermission\(/);
  assert.match(appScript, /async function updateCodexModel\(/);
  assert.match(appScript, /function renderCodexMessageBody\(/);
  assert.match(appScript, /function appendCodexTurnDivider\(/);
  assert.match(appScript, /if \(role === 'user'\) appendCodexTurnDivider\(\)/);
  assert.match(appScript, /function applyCodexFinalAssistant\(/);
  assert.match(appScript, /applyCodexFinalAssistant\(event\)/);
  assert.match(appScript, /function upsertCodexFileChange\(/);
  assert.match(appScript, /event\.type === 'file-change'/);
  assert.match(appScript, /function refreshProjectAfterCodex\(/);
  assert.match(appScript, /function showCodexThinking\(/);
  assert.match(appScript, /function hideCodexThinking\(/);
  assert.match(appScript, /showCodexThinking\(event\.message \|\| 'Codex 正在运行…'\)/);
  assert.match(appScript, /elements\.codexRunStatus\.hidden = running/);
  assert.match(appScript, /elements\.codexPrompt\.disabled = !canUseCodex/);
  assert.match(appScript, /可以先输入下一条 Prompt，当前回答结束后即可发送/);
  assert.match(appScript, /if \(codexState\.running\) return;\s*\n\s*event\.preventDefault\(\)/);
  assert.match(appScript, /window\.renderMathInElement\(body/);
  assert.match(appScript, /ignoredTags: \['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'\]/);
  assert.match(appScript, /\/api\/codex\/models/);
  assert.match(appScript, /\/api\/codex\/settings/);
  assert.match(appScript, /function renderCodexReasoningOptions\(/);
  assert.match(appScript, /function updateCodexReasoningEffort\(/);
  assert.match(appScript, /parameters\.set\('cwd', codexState\.workspaceFilter\)/);
  assert.doesNotMatch(appScript, /canContinueActiveCodexThread|这段历史属于其他工作区/);

  const aceResponse = await fetch(`${baseUrl}/vendor/ace/ace.js`);
  assert.equal(aceResponse.status, 200);
  assert.match(await aceResponse.text(), /ace\.define/);

  const latexModeResponse = await fetch(`${baseUrl}/vendor/ace/mode-latex.js`);
  assert.equal(latexModeResponse.status, 200);
  assert.match(await latexModeResponse.text(), /LatexHighlightRules/);

  const editorThemeResponse = await fetch(`${baseUrl}/vendor/ace/theme-textmate.js`);
  assert.equal(editorThemeResponse.status, 200);
  assert.match(await editorThemeResponse.text(), /textmate/);

  const pdfRuntimeResponse = await fetch(`${baseUrl}/vendor/pdfjs/build/pdf.mjs`);
  assert.equal(pdfRuntimeResponse.status, 200);
  assert.match(await pdfRuntimeResponse.text(), /getDocument/);

  const pdfWorkerResponse = await fetch(`${baseUrl}/vendor/pdfjs/build/pdf.worker.mjs`);
  assert.equal(pdfWorkerResponse.status, 200);
  assert.match(await pdfWorkerResponse.text(), /WorkerMessageHandler/);

  const katexRuntimeResponse = await fetch(`${baseUrl}/vendor/katex/katex.min.js`);
  assert.equal(katexRuntimeResponse.status, 200);
  assert.match(await katexRuntimeResponse.text(), /renderToString/);

  const katexAutoRenderResponse = await fetch(`${baseUrl}/vendor/katex/contrib/auto-render.min.js`);
  assert.equal(katexAutoRenderResponse.status, 200);
  assert.match(await katexAutoRenderResponse.text(), /renderMathInElement/);

  const katexFontResponse = await fetch(`${baseUrl}/vendor/katex/fonts/KaTeX_AMS-Regular.woff2`);
  assert.equal(katexFontResponse.status, 200);
  assert.match(katexFontResponse.headers.get('content-type'), /font\/woff2/);

  const collaborationRuntimeResponse = await fetch(`${baseUrl}/vendor/collaboration.js`);
  assert.equal(collaborationRuntimeResponse.status, 200);
  assert.match(await collaborationRuntimeResponse.text(), /LocalTeXCollaborationRuntime/);

  const scriptResponse = await fetch(`${baseUrl}/app.js`);
  assert.equal(scriptResponse.status, 200);
  const script = await scriptResponse.text();
  assert.match(script, /localtex\.panel-layout\.v1/);
  assert.match(script, /sidebarCollapsed/);
  assert.match(script, /setSidebarCollapsed/);
  assert.match(script, /setSidebarCollapsed\(!isSidebarCollapsed\(\)\)/);
  assert.match(script, /project-open-area/);
  assert.doesNotMatch(script, /open\.textContent = '打开'/);
  assert.match(script, /localtex\.editor-view\.v1/);
  assert.match(script, /localtex\.theme\.v1/);
  assert.match(script, /codeEditor\.setTheme\('ace\/theme\/textmate'\)/);
  assert.doesNotMatch(script, /ace\/theme\/github_dark/);
  assert.match(script, /toggleTheme/);
  assert.match(script, /ace\/mode\/latex/);
  assert.match(script, /function openEditorFindbar\(/);
  assert.match(script, /function closeEditorFindbar\(/);
  assert.match(script, /function findEditorMatch\(/);
  assert.match(script, /bindKey: \{ win: 'Ctrl-F', mac: 'Command-F' \}/);
  assert.match(script, /function isTexFilePath\(/);
  assert.match(script, /async function setMainDocument\(/);
  assert.match(script, /openFile\(file, false, true, true\)/);
  assert.match(script, /if \(selectForCompile && isTexFilePath\(data\.path\)\) await setMainDocument\(data\.path\)/);
  assert.match(script, /elements\.mainDocumentSelect\.disabled = running/);
  assert.match(script, /projectQuery/);
  assert.match(script, /function projectIdFromUrl/);
  assert.match(script, /function updateProjectUrl/);
  assert.match(script, /updateProjectUrl\(data\.project\.id\)/);
  assert.match(script, /if \(requestedProject\) await openProject\(requestedProject\.id\)/);
  assert.match(script, /pointerdown/);
  assert.match(script, /function collapseAllFolders/);
  assert.match(script, /if \(openInitial\) collapseAllFolders\(\)/);
  assert.match(script, /openFile\(initial, true, false\)/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /\/api\/lan/);
  assert.match(script, /\/api\/service\/state/);
  assert.match(script, /\/api\/profile/);
  assert.match(script, /PDFJS_ASSET_ROOT = '\/vendor\/pdfjs\/'/);
  assert.match(script, /build\/pdf\.mjs/);
  assert.match(script, /web\/pdf_viewer\.mjs/);
  assert.match(script, /pdf-page-canvas/);
  assert.match(script, /new pdfjsViewer\.TextLayerBuilder\(\{ pdfPage: page \}\)/);
  assert.match(script, /function clearPdfTextLayers\(/);
  assert.match(script, /viewport\.scale \* viewport\.userUnit/);
  assert.match(script, /const renderScaleX = canvas\.width \/ viewport\.width/);
  assert.match(script, /const renderScaleY = canvas\.height \/ viewport\.height/);
  assert.match(script, /pdf-text-layer/);
  assert.match(script, /zoomPdfPreview/);
  assert.match(script, /function updatePdfPageIndicator\(/);
  assert.match(script, /function schedulePdfPageIndicatorUpdate\(/);
  assert.match(script, /`第 \$\{currentPage\} \/ \$\{totalPages\} 页`/);
  assert.match(script, /function startPdfPan\(/);
  assert.match(script, /event\.button !== 2/);
  assert.match(script, /function movePdfPan\(/);
  assert.match(script, /pdfPreview\.scrollLeft -= deltaX/);
  assert.match(script, /pdfPreview\.scrollTop -= deltaY/);
  assert.match(script, /pdfPreview\.addEventListener\('pointerdown', startPdfPan\)/);
  assert.match(script, /pdfPreview\.addEventListener\('contextmenu'/);
  assert.match(script, /resetPdfPreview/);
  assert.match(script, /pdfResetZoomButton\.addEventListener\('click', resetPdfPreview\)/);
  assert.match(script, /function pdfDownloadFileName\(/);
  assert.match(script, /async function downloadPdfPreview\(/);
  assert.match(script, /link\.download = fileName/);
  assert.match(script, /pdfDownloadButton\.addEventListener\('click', downloadPdfPreview\)/);
  const resetPdfPreviewSource = script.match(/function resetPdfPreview\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(resetPdfPreviewSource, /capturePdfViewState\(\) \|\| pdfPreviewState\.savedView/);
  assert.match(resetPdfPreviewSource, /queuePdfRender\(0, pdfPreviewState\.savedView\)/);
  assert.doesNotMatch(resetPdfPreviewSource, /scrollTop\s*=\s*0/);
  assert.doesNotMatch(resetPdfPreviewSource, /scrollLeft\s*=\s*0/);
  assert.doesNotMatch(script, /pdfPreview\.addEventListener\('dblclick'/);
  assert.doesNotMatch(script, /previewPane\.addEventListener\('dblclick'/);
  assert.match(script, /function capturePdfViewState\(/);
  assert.match(script, /async function restorePdfViewState\(/);
  assert.match(script, /capturePdfViewState\(\) \|\| pdfPreviewState\.savedView/);
  assert.match(script, /loadPdfPreview\(pdfUrl, state\.mainDocument, '', previousPdfView\)/);
  assert.match(script, /jumpSourceToPdf/);
  assert.match(script, /codeEditor\.on\('click'/);
  assert.match(script, /jumpSourceToPdf\(position\)/);
  assert.match(script, /jumpPdfToSource/);
  assert.match(script, /async function jumpPdfToSource\(event\) \{\s*if \(!event\.altKey\) return;/);
  assert.match(script, /!domEvent\?\.altKey/);
  assert.match(script, /if \(event\.key === 'Alt'\)/);
  assert.doesNotMatch(script, /Ctrl\+单击/);
  assert.match(script, /event\.target\.closest\?\.\('\.pdf-page-shell'\)/);
  assert.match(script, /\/api\/synctex\/view/);
  assert.match(script, /\/api\/synctex\/edit/);
  assert.match(script, /document\.title = `LocalTex-\$\{data\.project\.name\}`/);
  assert.match(script, /function setCopyShareFeedback\(/);
  assert.match(script, /setCopyShareFeedback\('copied'\)/);
  assert.match(script, /showToast\('安全分享链接已复制。'\)/);
  assert.match(script, /干净编译成功/);
  assert.doesNotMatch(script, /document\.title = `\$\{fileName\}/);
  assert.doesNotMatch(script, /Ctrl-Enter|Command-Enter/);

  const styleResponse = await fetch(`${baseUrl}/styles.css`);
  assert.equal(styleResponse.status, 200);
  const styles = await styleResponse.text();
  assert.match(styles, /\.panel-resizer/);
  assert.match(styles, /\.theme-toggle/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.match(styles, /\.workspace-layout\.sidebar-collapsed/);
  assert.match(styles, /\.sidebar-expand-button/);
  assert.match(styles, /\.sidebar-control-chevron/);
  assert.match(styles, /\.sidebar-title-toggle/);
  assert.match(styles, /\.project-open-area:focus-visible/);
  assert.match(styles, /\.code-editor \.ace_comment/);
  assert.match(styles, /\.editor-findbar/);
  assert.match(styles, /\.editor-surface\.findbar-open/);
  assert.match(styles, /inset: var\(--editor-findbar-height, 0\) 0 0/);
  assert.match(styles, /\.tree-compile-target/);
  assert.match(styles, /\.pdf-sync-marker/);
  assert.match(styles, /#pdfPreview\[hidden\] \+ \.pdf-preview-controls/);
  assert.match(styles, /\.pdf-reset-zoom-button/);
  assert.match(styles, /\.pdf-download-button/);
  assert.match(styles, /\.pdf-page-indicator/);
  assert.match(styles, /#pdfPreview\.is-panning/);
  assert.match(styles, /cursor: grabbing !important/);
  assert.match(styles, /\.pdf-pages\s*\{[\s\S]{0,120}width: max-content/);
  assert.match(styles, /min-width: 156px/);
  assert.match(styles, /bottom: 3px/);
  assert.match(styles, /opacity: 0\.86/);
  assert.match(styles, /\.editor-surface\.sync-pdf-ready \.ace_content/);
  assert.match(styles, /\.ace_synctex-line/);
  assert.match(styles, /:root\[data-theme="dark"\][\s\S]*--editor: #fcfdfd/);
  assert.match(styles, /html\[data-theme="dark"\] \.code-editor[\s\S]*color: #21312c/);
  assert.match(styles, /\.project-overview/);
  assert.match(styles, /\.project-search/);
  assert.match(styles, /\.tree-children/);
  assert.match(styles, /\.tree-folder-icon/);
  assert.match(styles, /\.tree-file-icon\.tex/);
  assert.match(styles, /\.share-host-control/);
  assert.match(styles, /#copyShareButton\[data-state="copied"\]/);
  assert.match(styles, /\.host-service-control/);
  assert.match(styles, /\.service-stopped-screen/);
  assert.match(styles, /\.share-toggle-button\[data-state="enabled"\]/);
  assert.match(styles, /\.pdf-page-canvas/);
  assert.match(styles, /\.pdf-text-layer\s*\{[\s\S]{0,900}user-select: text/);
  assert.match(styles, /\.pdf-text-layer ::selection/);
  assert.match(styles, /\.pdf-text-layer \.endOfContent/);
  assert.match(styles, /\.pdf-text-layer\.selecting \.endOfContent/);
  assert.match(styles, /#pdfPreview\.sync-source-ready \.pdf-text-layer \*/);
  assert.match(styles, /cursor: crosshair !important/);
  assert.match(styles, /\.pdf-render-status/);
  assert.match(styles, /\.pdf-annotation-panel/);
  assert.match(styles, /\.pdf-annotation-mark/);
  assert.match(styles, /--codex-width:/);
  assert.match(styles, /\.workspace-layout\.codex-collapsed/);
  assert.match(styles, /\.codex-panel\s*\{[\s\S]{0,180}display: flex/);
  assert.match(styles, /\.codex-edge-button\s*\{[\s\S]{0,180}position: absolute/);
  assert.match(styles, /\.codex-history-list\s*\{/);
  assert.match(styles, /\.codex-history\.collapsed \.codex-history-body/);
  assert.match(styles, /\.codex-workspace-select/);
  assert.match(styles, /html\[data-theme="dark"\] \.codex-rename-form input/);
  assert.match(styles, /html\[data-theme="dark"\] \.codex-model-picker/);
  assert.match(styles, /\.codex-reasoning-picker\[data-effort="xhigh"\]/);
  assert.match(styles, /\.codex-permission-picker\[data-mode="full-access"\]/);
  assert.match(styles, /\.codex-message-body \.katex-display/);
  assert.match(styles, /\.codex-conversation-refresh\s*\{/);
  assert.match(styles, /\.codex-conversation-refresh\s*\{[\s\S]{0,140}margin-left: auto/);
  assert.match(styles, /#codexPrompt\s*\{[\s\S]{0,240}padding: 9px 10px/);
  assert.match(styles, /@keyframes codex-refresh-spin/);
  assert.match(styles, /\.codex-turn-divider\s*\{/);
  assert.match(styles, /linear-gradient\(90deg, transparent, var\(--line-strong\)/);
  assert.match(styles, /\.codex-message-body pre\[data-language\]/);
  assert.match(styles, /\.codex-message\.activity\.failed \.codex-message-body/);
  assert.match(styles, /\.codex-thinking-body\s*\{/);
  assert.match(styles, /@keyframes codex-thinking-dot/);
  assert.match(styles, /\.dirty-indicator\[hidden\]\s*\{[\s\S]{0,100}visibility: hidden/);
  assert.match(styles, /@container \(max-width: 360px\)[\s\S]{0,1400}\.dirty-indicator/);
  assert.match(styles, /#saveStatus\s*\{[\s\S]{0,120}width: 76px/);
  assert.match(styles, /html\[data-theme="dark"\] \.codex-message-body \.codex-inline-code/);
  assert.match(styles, /background: #10191d/);
  assert.match(styles, /color: #edf5f2/);
  assert.doesNotMatch(styles, /\.codex-launcher\s*\{/);

  const configResponse = await fetch(`${baseUrl}/api/config`);
  assert.equal(configResponse.status, 200);
  const config = await configResponse.json();
  assert.equal(config.workspace, testWorkspace);
  assert.equal(config.localOnly, true);
  assert.equal(config.lan.available, false);
  assert.equal(config.lan.enabled, false);
  assert.equal(config.service.active, true);
  assert.equal(config.service.controllerMode, 'background');
  assert.equal(config.service.canControl, true);
  assert.equal(config.codex.available, true);
  assert.equal(config.codex.canUse, true);
  assert.equal(config.codex.access, 'host-only');
  assert.equal(config.codex.permissionMode, 'read-only');
  assert.equal(config.codex.model, '');
  assert.equal(config.codex.reasoningEffort, '');
  assert.equal(config.codex.sandbox, 'read-only');
  if (config.compiler) {
    const portableRoot = path.resolve(__dirname, '..', 'tools', 'miktex');
    assert.ok(path.resolve(config.compilerPath).startsWith(`${portableRoot}${path.sep}`));
  }
});

test('validates Codex requests before starting a local agent', async () => {
  const response = await fetch(`${baseUrl}/api/codex/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '', mainFile: 'main.tex' }),
  });
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.match(result.error, /Codex/);

  const invalidThreadResponse = await fetch(`${baseUrl}/api/codex/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '检查当前论文', threadId: '../another-session' }),
  });
  const invalidThreadResult = await invalidThreadResponse.json();
  assert.equal(invalidThreadResponse.status, 400);
  assert.match(invalidThreadResult.error, /对话标识无效/);
});

test('does not reveal the host Codex configuration to collaborators', () => {
  const status = createCodexService().status(false);
  assert.equal(status.canUse, false);
  assert.equal(status.configured, false);
  assert.equal(status.authDetected, false);
  assert.equal(status.configSource, 'hidden');
  assert.equal(status.model, 'hidden');
  assert.equal(status.configuredModel, 'hidden');
  assert.equal(status.reasoningEffort, 'hidden');
  assert.equal(status.configuredReasoningEffort, 'hidden');
});

test('lists the Codex models available to the current local account', async () => {
  const calls = [];
  const service = createCodexService({
    historyClient: {
      async request(method, params) {
        calls.push({ method, params });
        return {
          data: [{
            id: 'gpt-5.6-sol',
            displayName: 'GPT-5.6-Sol',
            description: 'Latest frontier agentic coding model.',
            defaultReasoningEffort: 'low',
            supportedReasoningEfforts: [
              { reasoningEffort: 'medium' },
              { reasoningEffort: 'high' },
              { reasoningEffort: 'xhigh' },
            ],
            inputModalities: ['text', 'image'],
            isDefault: true,
          }],
        };
      },
      close() {},
    },
  });
  const result = await service.listModels();
  assert.equal(calls[0].method, 'model/list');
  assert.deepEqual(calls[0].params, { includeHidden: false });
  assert.equal(result.models[0].id, 'gpt-5.6-sol');
  assert.equal(result.models[0].isDefault, true);
  assert.deepEqual(result.models[0].supportedReasoningEfforts, ['medium', 'high', 'xhigh']);
  service.shutdown();
});

test('lets the host persistently switch Codex permissions, model, and reasoning effort', async () => {
  try {
    const fullResponse = await fetch(`${baseUrl}/api/codex/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissionMode: 'full-access',
        model: 'gpt-5.6-sol',
        reasoningEffort: 'xhigh',
      }),
    });
    const full = await fullResponse.json();
    assert.equal(fullResponse.status, 200);
    assert.equal(full.codex.permissionMode, 'full-access');
    assert.equal(full.codex.sandbox, 'danger-full-access');
    assert.equal(full.codex.networkAccessEnabled, true);
    assert.equal(full.codex.webSearchMode, 'live');
    assert.equal(full.codex.model, 'gpt-5.6-sol');
    assert.equal(full.codex.reasoningEffort, 'xhigh');

    const saved = JSON.parse(fs.readFileSync(
      path.join(process.env.LOCAL_TEX_DATA_ROOT, 'codex-settings.json'),
      'utf8',
    ));
    assert.equal(saved.permissionMode, 'full-access');
    assert.equal(saved.model, 'gpt-5.6-sol');
    assert.equal(saved.reasoningEffort, 'xhigh');

    const invalidResponse = await fetch(`${baseUrl}/api/codex/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reasoningEffort: 'ultra' }),
    });
    const invalid = await invalidResponse.json();
    assert.equal(invalidResponse.status, 400);
    assert.match(invalid.error, /推理强度无效/);
  } finally {
    const resetResponse = await fetch(`${baseUrl}/api/codex/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionMode: 'read-only', model: '', reasoningEffort: '' }),
    });
    assert.equal(resetResponse.status, 200);
  }
});

test('uses the shared Codex history service for listing, reading, and native renaming', async () => {
  const calls = [];
  let storedName = '';
  const historyClient = {
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'thread/list') {
        return {
          data: [{
            id: 'thread-global-1',
            name: storedName || null,
            preview: '历史论文检查',
            cwd: testWorkspace,
            createdAt: 100,
            updatedAt: 110,
            recencyAt: 120,
            source: 'cli',
            modelProvider: 'openai',
            status: { type: 'idle' },
            turns: [],
          }],
          nextCursor: 'next-page',
        };
      }
      if (method === 'thread/name/set') {
        storedName = params.name;
        return {};
      }
      if (method === 'thread/read') {
        return {
          thread: {
            id: 'thread-global-1',
            name: storedName || null,
            preview: '历史论文检查',
            cwd: testWorkspace,
            createdAt: 100,
            updatedAt: 120,
            source: 'cli',
            modelProvider: 'openai',
            status: { type: 'idle' },
            turns: [],
          },
        };
      }
      if (method === 'thread/turns/list') {
        return {
          data: [{
              id: 'turn-1',
              status: 'completed',
              startedAt: 115,
              items: [
                {
                  id: 'user-1',
                  type: 'userMessage',
                  content: [{
                    type: 'text',
                    text: 'LocalTeX 上下文\n\n用户要求：\n检查算法章节\n\n---\n\n当前文件内容',
                  }],
                },
                {
                  id: 'change-1',
                  type: 'fileChange',
                  status: 'completed',
                  changes: [{ path: path.join(testWorkspace, 'main.tex'), kind: 'update' }],
                },
                { id: 'assistant-1', type: 'agentMessage', text: '建议如下' },
              ],
            }],
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected method: ${method}`);
    },
    close() {},
  };
  const service = createCodexService({ historyClient });

  const list = await service.listThreads({ limit: 25, searchTerm: '论文', cwd: testWorkspace });
  assert.equal(list.threads.length, 1);
  assert.equal(list.threads[0].cwd, testWorkspace);
  assert.equal(list.nextCursor, 'next-page');
  assert.equal(calls[0].method, 'thread/list');
  assert.equal(calls[0].params.sortKey, 'recency_at');
  assert.equal(calls[0].params.cwd, testWorkspace);
  assert.deepEqual(calls[0].params.sourceKinds, [
    'cli',
    'vscode',
    'exec',
    'appServer',
    'unknown',
  ]);

  const thread = await service.readThread('thread-global-1');
  const readCall = calls.find((call) => call.method === 'thread/read');
  const turnsCall = calls.find((call) => call.method === 'thread/turns/list');
  assert.equal(readCall.params.includeTurns, false);
  assert.equal(turnsCall.params.itemsView, 'summary');
  assert.equal(turnsCall.params.sortDirection, 'desc');
  assert.deepEqual(thread.messages.map(({ role, text }) => ({ role, text })), [
    { role: 'user', text: '检查算法章节' },
    { role: 'activity', text: '修改 `main.tex`' },
    { role: 'assistant', text: '建议如下' },
  ]);

  const renamed = await service.renameThread('thread-global-1', '算法章节复核');
  assert.equal(renamed.name, '算法章节复核');
  assert.equal(calls.at(-2).method, 'thread/name/set');
  assert.equal(calls.at(-2).params.name, '算法章节复核');
  service.shutdown();
});

test('limits long Codex history refreshes to paginated summary turns', async () => {
  const calls = [];
  const historyClient = {
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'thread/read') {
        return {
          thread: {
            id: 'thread-long-history',
            name: '长历史',
            preview: '最近一轮',
            cwd: testWorkspace,
            createdAt: 100,
            updatedAt: 500,
            source: 'exec',
            modelProvider: 'openai',
            status: { type: 'idle' },
            turns: [],
          },
        };
      }
      if (method === 'thread/turns/list') {
        const page = params.cursor ? Number(params.cursor) : 0;
        const data = Array.from({ length: 50 }, (_, index) => {
          const turnNumber = 250 - (page * 50) - index;
          return {
            id: `turn-${turnNumber}`,
            status: 'completed',
            startedAt: turnNumber,
            items: [{
              id: `assistant-${turnNumber}`,
              type: 'agentMessage',
              text: `回答 ${turnNumber}`,
            }],
          };
        });
        return { data, nextCursor: String(page + 1) };
      }
      throw new Error(`Unexpected method: ${method}`);
    },
    close() {},
  };
  const service = createCodexService({ historyClient });

  const thread = await service.readThread('thread-long-history');
  const turnCalls = calls.filter((call) => call.method === 'thread/turns/list');
  assert.equal(turnCalls.length, 4);
  assert.ok(turnCalls.every((call) => call.params.itemsView === 'summary'));
  assert.equal(thread.loadedTurnCount, 200);
  assert.equal(thread.historyTruncated, true);
  assert.equal(thread.messages.length, 200);
  assert.equal(thread.messages[0].text, '回答 51');
  assert.equal(thread.messages.at(-1).text, '回答 250');
  service.shutdown();
});

test('resumes the Codex thread selected from conversation history', async () => {
  const originalThreadWorkspace = path.join(testRoot, 'other-codex-workspace');
  fs.mkdirSync(originalThreadWorkspace, { recursive: true });
  const historyClient = {
    async request(method, params) {
      assert.equal(method, 'thread/read');
      assert.equal(params.threadId, 'thread-history-1');
      assert.equal(params.includeTurns, false);
      return {
        thread: {
          id: 'thread-history-1',
          name: '其他项目对话',
          preview: '继续检查',
          cwd: originalThreadWorkspace,
          createdAt: 100,
          updatedAt: 120,
          source: 'cli',
          modelProvider: 'openai',
          status: { type: 'idle' },
          turns: [],
        },
      };
    },
    close() {},
  };
  const service = createCodexService({ historyClient });
  service.setPermissionMode('full-access');
  service.setModel('gpt-5.6-sol');
  service.setReasoningEffort('xhigh');
  let resumedThreadId = '';
  let resumedOptions = null;
  let submittedPrompt = '';
  const fakeThread = {
    async runStreamed(prompt) {
      submittedPrompt = prompt;
      return {
        events: (async function* events() {
          yield { type: 'thread.started', thread_id: 'thread-history-1' };
          yield {
            type: 'item.completed',
            item: { type: 'agent_message', id: 'message-1', text: '历史对话已恢复' },
          };
          yield { type: 'turn.completed', usage: {} };
        }()),
      };
    },
  };
  service.client = async () => ({
    resumeThread(threadId, options) {
      resumedThreadId = threadId;
      resumedOptions = options;
      return fakeThread;
    },
    startThread() {
      throw new Error('should resume the selected thread');
    },
  });

  const run = await service.start(
    { id: 'history-project', path: testWorkspace, mainFile: 'main.tex' },
    { prompt: '继续检查这篇论文', threadId: 'thread-history-1', newThread: false },
  );
  let doneEvent;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Codex history test timed out')), 2_000);
    service.subscribe(run.id, 'history-project', 0, (event) => {
      if (event.type !== 'done') return;
      doneEvent = event;
      clearTimeout(timeout);
      resolve();
    });
  });

  assert.equal(resumedThreadId, 'thread-history-1');
  assert.equal(resumedOptions.workingDirectory, originalThreadWorkspace);
  assert.equal(resumedOptions.sandboxMode, 'danger-full-access');
  assert.equal(resumedOptions.approvalPolicy, 'never');
  assert.equal(resumedOptions.networkAccessEnabled, true);
  assert.equal(resumedOptions.webSearchMode, 'live');
  assert.equal(resumedOptions.model, 'gpt-5.6-sol');
  assert.equal(resumedOptions.modelReasoningEffort, 'xhigh');
  assert.match(submittedPrompt, /当前为 Full access/);
  assert.match(submittedPrompt, /最终回复必须以“修改总结：”开头/);
  assert.doesNotMatch(submittedPrompt, /本次运行是只读分析/);
  assert.equal(doneEvent.threadId, 'thread-history-1');
  assert.deepEqual(doneEvent.finalAssistant, {
    messageId: 'message-1',
    text: '历史对话已恢复',
    complete: true,
  });
  const fullSnapshot = service.snapshot(run.id, 'history-project', 0);
  assert.equal(fullSnapshot.run.status, 'completed');
  assert.equal(fullSnapshot.lastSequence, doneEvent.sequence);
  assert.equal(fullSnapshot.events.at(-1).type, 'done');
  const assistantEvent = fullSnapshot.events.find((event) => event.type === 'assistant');
  const recoveredSnapshot = service.snapshot(run.id, 'history-project', assistantEvent.sequence - 1);
  assert.deepEqual(
    recoveredSnapshot.events.map((event) => event.type),
    ['assistant', 'usage', 'done'],
  );
  assert.equal(recoveredSnapshot.events.at(-1).finalAssistant.text, '历史对话已恢复');
  const terminalSnapshot = service.snapshot(run.id, 'history-project', doneEvent.sequence - 1);
  assert.deepEqual(terminalSnapshot.events, [doneEvent]);
  service.shutdown();
});

test('waits for the app-server context compaction notification', async () => {
  const client = createCodexAppServerClient();
  const notificationPromise = client.waitForNotification((message) => (
    message.method === 'thread/compacted'
    && message.params?.threadId === 'thread-notification'
  ));
  client.handleMessage(null, JSON.stringify({
    method: 'thread/compacted',
    params: { threadId: 'thread-notification', turnId: 'compact-turn' },
  }));
  const notification = await notificationPromise;
  assert.equal(notification.params.turnId, 'compact-turn');
  client.close();
});

test('compacts a full Codex context and returns the prompt for retry', async () => {
  const calls = [];
  const historyClient = {
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'thread/read') {
        assert.equal(params.includeTurns, false);
        return {
          thread: {
            id: 'thread-context-full',
            name: '长对话',
            preview: '继续修改论文',
            cwd: testWorkspace,
            createdAt: 100,
            updatedAt: 120,
            source: 'exec',
            modelProvider: 'openai',
            status: { type: 'idle' },
            turns: [],
          },
        };
      }
      if (method === 'thread/resume') return { thread: { id: params.threadId } };
      if (method === 'thread/compact/start') return {};
      if (method === 'thread/unsubscribe') return {};
      throw new Error(`Unexpected method: ${method}`);
    },
    waitForNotification(predicate) {
      const notification = {
        method: 'thread/compacted',
        params: { threadId: 'thread-context-full', turnId: 'compact-turn' },
      };
      assert.equal(predicate(notification), true);
      return Promise.resolve(notification);
    },
    close() {},
  };
  const service = createCodexService({ historyClient });
  const fakeThread = {
    async runStreamed() {
      return {
        events: (async function* events() {
          yield {
            type: 'turn.failed',
            error: {
              message: 'The model context window has been exceeded.',
              codexErrorInfo: 'contextWindowExceeded',
            },
          };
        }()),
      };
    },
  };
  service.client = async () => ({
    resumeThread() {
      return fakeThread;
    },
    startThread() {
      throw new Error('a full existing thread should be resumed');
    },
  });

  const retryPrompt = '继续修改论文的实验章节';
  const run = await service.start(
    { id: 'context-project', path: testWorkspace, mainFile: 'main.tex' },
    {
      prompt: retryPrompt,
      threadId: 'thread-context-full',
      newThread: false,
    },
  );
  let recoveryEvent;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Codex compaction test timed out')), 2_000);
    service.subscribe(run.id, 'context-project', 0, (event) => {
      if (event.type !== 'error') return;
      recoveryEvent = event;
      clearTimeout(timeout);
      resolve();
    });
  });

  assert.equal(recoveryEvent.recoverable, 'context-window');
  assert.equal(recoveryEvent.retryPrompt, retryPrompt);
  assert.match(recoveryEvent.message, /上下文已自动压缩/);
  assert.deepEqual(
    calls.slice(1).map((call) => call.method),
    ['thread/resume', 'thread/compact/start', 'thread/unsubscribe'],
  );
  assert.equal(calls[1].params.excludeTurns, true);
  service.shutdown();
});

test('reports completed Codex file changes even without a final agent message', async () => {
  const service = createCodexService({
    historyClient: {
      async request() {
        throw new Error('history should not be read for a new thread');
      },
      close() {},
    },
  });
  const fakeThread = {
    async runStreamed() {
      return {
        events: (async function* events() {
          yield { type: 'thread.started', thread_id: 'thread-file-change-1' };
          yield {
            type: 'item.completed',
            item: {
              type: 'file_change',
              id: 'file-change-1',
              status: 'completed',
              changes: [
                { path: path.join(testWorkspace, 'main.tex'), kind: 'update' },
                { path: path.join(testWorkspace, 'sections', 'method.tex'), kind: 'add' },
              ],
            },
          };
          yield { type: 'turn.completed', usage: {} };
        }()),
      };
    },
  };
  service.client = async () => ({
    startThread() {
      return fakeThread;
    },
    resumeThread() {
      throw new Error('a new thread should not be resumed');
    },
  });

  const run = await service.start(
    { id: 'file-change-project', path: testWorkspace, mainFile: 'main.tex' },
    { prompt: '修改论文文件', newThread: true },
  );
  const observedEvents = [];
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Codex file change test timed out')), 2_000);
    service.subscribe(run.id, 'file-change-project', 0, (event) => {
      observedEvents.push(event);
      if (event.type !== 'done') return;
      clearTimeout(timeout);
      resolve();
    });
  });

  const fileChange = observedEvents.find((event) => event.type === 'file-change');
  assert.deepEqual(fileChange.changes, [
    { path: 'main.tex', kind: 'update' },
    { path: 'sections/method.tex', kind: 'add' },
  ]);
  assert.match(fileChange.text, /修改 `main\.tex`/);
  assert.match(fileChange.text, /新增 `sections\/method\.tex`/);
  const fallback = observedEvents.find((event) => (
    event.type === 'assistant' && event.messageId.startsWith('localtex-result-')
  ));
  assert.match(fallback.text, /修改总结：/);
  assert.match(fallback.text, /已按要求处理：修改论文文件/);
  assert.match(fallback.text, /修改 `main\.tex`/);
  assert.match(fallback.text, /新增 `sections\/method\.tex`/);
  const done = observedEvents.find((event) => event.type === 'done');
  assert.equal(done.filesChanged, true);
  assert.match(done.message, /修改 2 个文件/);
  service.shutdown();
});

test('ships the modern Windows Explorer folder picker', async () => {
  const pickerSource = await readFile(
    path.join(__dirname, '..', 'tools', 'picker', 'ModernFolderPicker.cs'),
    'utf8',
  );
  assert.match(pickerSource, /IFileOpenDialog/);
  assert.match(pickerSource, /FileOpenOptions\.PickFolders/);
  assert.match(pickerSource, /SetClientGuid/);
});

test('ignores Windows picker warnings when reading the selected path', () => {
  const selectedPath = String.raw`D:\papers\example-project`;
  const output = [
    '[WARNING] Ignore caches that are heterogeneous',
    `__LOCALTEX_SELECTED_PATH__:${selectedPath}`,
    '',
  ].join('\r\n');

  assert.equal(parseLocalPickerOutput(output), selectedPath);
  assert.equal(parseLocalPickerOutput('[WARNING] Ignore caches that are heterogeneous\r\n'), '');
});

test('ships a detached reusable LocalTeX launcher', async () => {
  const launcher = await readFile(path.join(__dirname, '..', 'launch-localtex.ps1'), 'utf8');
  const windowlessLauncher = await readFile(path.join(__dirname, '..', 'LocalTeX.vbs'), 'utf8');
  const startCommand = await readFile(path.join(__dirname, '..', 'start-local.cmd'), 'utf8');
  const stopScript = await readFile(path.join(__dirname, '..', 'stop-localtex.ps1'), 'utf8');
  assert.match(launcher, /LOCAL_TEX_HOST = '0\.0\.0\.0'/);
  assert.match(launcher, /-WindowStyle Hidden/);
  assert.doesNotMatch(launcher, /-WindowStyle Normal/);
  assert.match(windowlessLauncher, /WScript\.Shell/);
  assert.match(windowlessLauncher, /launch-localtex\.ps1/);
  assert.match(startCommand, /launch-localtex\.ps1/);
  assert.doesNotMatch(startCommand, /node\.exe" server\.js/);
  assert.match(stopScript, /portable Node\.js process/);
});

test('lists and reads a project document', async () => {
  const filesResponse = await fetch(`${baseUrl}/api/files`);
  assert.equal(filesResponse.status, 200);
  const { files } = await filesResponse.json();
  assert.ok(files.some((file) => file.path === 'main.tex'));

  const fileResponse = await fetch(`${baseUrl}/api/file?path=main.tex`);
  assert.equal(fileResponse.status, 200);
  const file = await fileResponse.json();
  assert.match(file.content, /LocalTeX First Document/);
});

test('writes browser saves directly to the local project file', async () => {
  const content = 'Saved from the LocalTeX browser editor.\n';
  const saveResponse = await fetch(`${baseUrl}/api/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'disk-sync.tex', content }),
  });
  assert.equal(saveResponse.status, 200);
  assert.equal(fs.readFileSync(path.join(testWorkspace, 'disk-sync.tex'), 'utf8'), content);
});

test('provides a persistent local project list', async () => {
  const response = await fetch(`${baseUrl}/api/projects`);
  assert.equal(response.status, 200);
  const { projects } = await response.json();
  const project = projects.find((item) => item.id === 'localtex-workspace');
  assert.ok(project);
  assert.equal(project.name, 'Test project');
  assert.equal(project.exists, true);
  assert.equal(project.mainFile, 'main.tex');
});

test('persists the host display name outside browser storage', async () => {
  const response = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collaboratorName: 'LocalTeX Host' }),
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.profile.collaboratorName, 'LocalTeX Host');

  const persisted = JSON.parse(fs.readFileSync(
    path.join(process.env.LOCAL_TEX_DATA_ROOT, 'profile-settings.json'),
    'utf8',
  ));
  assert.equal(persisted.collaboratorName, 'LocalTeX Host');

  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(config.profile.collaboratorName, 'LocalTeX Host');
});

test('rejects paths outside the workspace', async () => {
  const response = await fetch(`${baseUrl}/api/file?path=..%2Fserver.js`);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /outside the configured workspace/i);
});

test('merges two concurrent collaborative edits and saves the result', { timeout: 10_000 }, async () => {
  const socketUrl = `${baseUrl.replace(/^http/, 'ws')}/collaboration?project=localtex-workspace&path=collab.tex`;
  const first = new WebSocket(socketUrl);
  const second = new WebSocket(socketUrl);
  const firstDocument = new Y.Doc();
  const secondDocument = new Y.Doc();

  try {
    const firstSyncPromise = waitForMessage(first, (message) => message.type === 'sync');
    const secondSyncPromise = waitForMessage(second, (message) => message.type === 'sync');
    await Promise.all([once(first, 'open'), once(second, 'open')]);
    const [firstSync, secondSync] = await Promise.all([firstSyncPromise, secondSyncPromise]);
    Y.applyUpdate(firstDocument, Buffer.from(firstSync.update, 'base64'));
    Y.applyUpdate(secondDocument, Buffer.from(secondSync.update, 'base64'));

    assert.equal(firstDocument.getText('content').toString(), 'Collaborative document\n');
    assert.equal(secondDocument.getText('content').toString(), 'Collaborative document\n');

    const twoUsersPromise = waitForMessage(first, (message) => (
      message.type === 'presence'
      && message.users.some((user) => user.name === 'Alice')
      && message.users.some((user) => user.name === 'Bob')
    ));
    first.send(JSON.stringify({ type: 'presence', user: { id: 'alice', name: 'Alice', color: 1 } }));
    second.send(JSON.stringify({ type: 'presence', user: { id: 'bob', name: 'Bob', color: 2 } }));
    const presence = await twoUsersPromise;
    assert.equal(presence.users.length, 2);

    const firstText = firstDocument.getText('content');
    const secondText = secondDocument.getText('content');
    const firstUpdate = makeLocalUpdate(
      firstDocument,
      () => firstText.insert(0, 'Alice: '),
      'alice-edit',
    );
    const secondUpdate = makeLocalUpdate(
      secondDocument,
      () => secondText.insert(secondText.length, 'Bob was here.\n'),
      'bob-edit',
    );

    const updateForSecond = waitForMessage(second, (message) => message.type === 'update');
    const updateForFirst = waitForMessage(first, (message) => message.type === 'update');
    const saved = waitForMessage(first, (message) => message.type === 'saved');
    first.send(JSON.stringify({ type: 'update', update: Buffer.from(firstUpdate).toString('base64') }));
    second.send(JSON.stringify({ type: 'update', update: Buffer.from(secondUpdate).toString('base64') }));

    const [fromFirst, fromSecond] = await Promise.all([updateForSecond, updateForFirst]);
    Y.applyUpdate(secondDocument, Buffer.from(fromFirst.update, 'base64'));
    Y.applyUpdate(firstDocument, Buffer.from(fromSecond.update, 'base64'));
    await saved;

    const merged = firstDocument.getText('content').toString();
    assert.equal(secondDocument.getText('content').toString(), merged);
    assert.match(merged, /Alice: /);
    assert.match(merged, /Bob was here\./);
    assert.equal(fs.readFileSync(path.join(testWorkspace, 'collab.tex'), 'utf8'), merged);
  } finally {
    firstDocument.destroy();
    secondDocument.destroy();
    await Promise.all([closeSocket(first), closeSocket(second)]);
  }
});

test('pushes external local file edits into an active browser document', { timeout: 10_000 }, async () => {
  const socket = new WebSocket(
    `${baseUrl.replace(/^http/, 'ws')}/collaboration?project=localtex-workspace&path=external-sync.tex`,
  );
  const document = new Y.Doc();

  try {
    const syncPromise = waitForMessage(socket, (message) => message.type === 'sync');
    await once(socket, 'open');
    const initialSync = await syncPromise;
    Y.applyUpdate(document, Buffer.from(initialSync.update, 'base64'));
    assert.equal(document.getText('content').toString(), 'Before external edit\n');

    const updatePromise = waitForMessage(socket, (message) => message.type === 'update', 6_000);
    const diskSyncedPromise = waitForMessage(socket, (message) => message.type === 'disk-synced', 6_000);
    fs.writeFileSync(path.join(testWorkspace, 'external-sync.tex'), 'After external edit\n', 'utf8');

    const update = await updatePromise;
    Y.applyUpdate(document, Buffer.from(update.update, 'base64'));
    await diskSyncedPromise;
    assert.equal(document.getText('content').toString(), 'After external edit\n');
  } finally {
    document.destroy();
    await closeSocket(socket);
  }
});

test('isolates oversized collaboration messages without stopping LocalTeX', { timeout: 10_000 }, async () => {
  const socket = new WebSocket(
    `${baseUrl.replace(/^http/, 'ws')}/collaboration?project=localtex-workspace&path=collab.tex`,
  );
  try {
    await once(socket, 'open');
    const closed = once(socket, 'close');
    socket.send(Buffer.alloc((8 * 1024 * 1024) + 1));
    const [closeCode] = await closed;
    assert.equal(closeCode, 1009);
    assert.equal((await fetch(`${baseUrl}/api/config`)).status, 200);
  } finally {
    await closeSocket(socket);
  }
});

test('lets the host enable, revoke, and reuse LAN sharing', { timeout: 20_000 }, async () => {
  const port = await freeTcpPort();
  const childDataRoot = path.join(testRoot, 'lan-data');
  seedTestProjectRegistry(childDataRoot);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      LOCAL_TEX_DATA_ROOT: childDataRoot,
      LOCAL_TEX_HOST: '0.0.0.0',
      LOCAL_TEX_OPEN_BROWSER: '0',
      LOCAL_TEX_PORT: String(port),
      LOCAL_TEX_WORKSPACE: testWorkspace,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let childErrors = '';
  child.stderr.on('data', (chunk) => { childErrors += chunk.toString('utf8'); });
  const childUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForService(childUrl, child, () => childErrors);
    const initialConfig = await (await fetch(`${childUrl}/api/config`)).json();
    assert.equal(initialConfig.localOnly, false);
    assert.equal(initialConfig.lan.available, true);
    assert.equal(initialConfig.lan.enabled, false);
    assert.equal(initialConfig.service.active, true);
    assert.equal(initialConfig.service.controllerMode, 'background');
    assert.equal(initialConfig.service.canControl, true);

    const enableResponse = await fetch(`${childUrl}/api/lan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(enableResponse.status, 200);
    const enabled = await enableResponse.json();
    assert.equal(enabled.lan.enabled, true);
    assert.ok(enabled.lan.shareUrls.length > 0);
    const originalShareUrl = new URL(enabled.lan.shareUrls[0]);
    const accessToken = originalShareUrl.searchParams.get('token');

    const remoteConfigUrl = new URL('/api/config', originalShareUrl.origin);
    assert.equal((await fetch(remoteConfigUrl)).status, 401);
    remoteConfigUrl.searchParams.set('token', accessToken);
    assert.equal((await fetch(remoteConfigUrl)).status, 200);

    const collaborationSocket = new WebSocket(
      `ws://127.0.0.1:${port}/collaboration?project=localtex-workspace&path=collab.tex`,
    );
    const syncPromise = waitForMessage(collaborationSocket, (message) => message.type === 'sync');
    await once(collaborationSocket, 'open');
    await syncPromise;
    const disconnected = once(collaborationSocket, 'close');

    const disableResponse = await fetch(`${childUrl}/api/lan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(disableResponse.status, 200);
    assert.equal((await disableResponse.json()).lan.enabled, false);
    const [closeCode] = await disconnected;
    assert.equal(closeCode, 4001);
    assert.equal((await fetch(originalShareUrl.origin)).status, 403);

    const reenableResponse = await fetch(`${childUrl}/api/lan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const reenabled = await reenableResponse.json();
    assert.equal(reenabled.lan.enabled, true);
    assert.equal(reenabled.lan.shareUrls[0], originalShareUrl.toString());
    assert.equal((await fetch(remoteConfigUrl)).status, 200);

    const secondSocket = new WebSocket(
      `ws://127.0.0.1:${port}/collaboration?project=localtex-workspace&path=collab.tex`,
    );
    const secondSync = waitForMessage(secondSocket, (message) => message.type === 'sync');
    await once(secondSocket, 'open');
    await secondSync;
    const pausedDisconnect = once(secondSocket, 'close');

    const pauseResponse = await fetch(`${childUrl}/api/service/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    assert.equal(pauseResponse.status, 200);
    const paused = await pauseResponse.json();
    assert.equal(paused.service.active, false);
    assert.equal(paused.lan.enabled, false);
    assert.equal((await pausedDisconnect)[0], 4002);
    assert.equal((await fetch(`${childUrl}/api/projects`)).status, 423);
    assert.equal((await fetch(`${childUrl}/`)).status, 200);
    assert.equal((await fetch(originalShareUrl.origin)).status, 403);

    const resumeResponse = await fetch(`${childUrl}/api/service/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    });
    const resumed = await resumeResponse.json();
    assert.equal(resumed.service.active, true);
    assert.equal(resumed.lan.enabled, false);
    assert.equal((await fetch(`${childUrl}/api/projects`)).status, 200);

    const enableAfterResume = await fetch(`${childUrl}/api/lan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal((await enableAfterResume.json()).lan.shareUrls[0], originalShareUrl.toString());
  } finally {
    if (child.exitCode === null) child.kill();
    if (child.exitCode === null) await once(child, 'exit');
  }
});

test('starts local work enabled and LAN sharing disabled after a restart', { timeout: 10_000 }, async () => {
  const port = await freeTcpPort();
  const childDataRoot = path.join(testRoot, 'restart-policy-data');
  const savedToken = 'restart-policy-token-0123456789';
  seedTestProjectRegistry(childDataRoot);
  fs.writeFileSync(path.join(childDataRoot, 'lan-settings.json'), JSON.stringify({
    token: savedToken,
    enabled: true,
    createdAt: new Date().toISOString(),
  }), 'utf8');
  fs.writeFileSync(path.join(childDataRoot, 'service-settings.json'), JSON.stringify({
    active: false,
  }), 'utf8');
  fs.writeFileSync(path.join(childDataRoot, 'profile-settings.json'), JSON.stringify({
    collaboratorName: 'Persistent Host',
    updatedAt: new Date().toISOString(),
  }), 'utf8');

  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      LOCAL_TEX_DATA_ROOT: childDataRoot,
      LOCAL_TEX_HOST: '0.0.0.0',
      LOCAL_TEX_OPEN_BROWSER: '0',
      LOCAL_TEX_PORT: String(port),
      LOCAL_TEX_WORKSPACE: testWorkspace,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let childErrors = '';
  child.stderr.on('data', (chunk) => { childErrors += chunk.toString('utf8'); });
  const childUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForService(childUrl, child, () => childErrors);
    const config = await (await fetch(`${childUrl}/api/config`)).json();
    assert.equal(config.service.active, true);
    assert.equal(config.lan.enabled, false);
    assert.equal(config.profile.collaboratorName, 'Persistent Host');

    const persistedService = JSON.parse(fs.readFileSync(path.join(childDataRoot, 'service-settings.json'), 'utf8'));
    const persistedLan = JSON.parse(fs.readFileSync(path.join(childDataRoot, 'lan-settings.json'), 'utf8'));
    assert.equal(persistedService.active, true);
    assert.equal(persistedLan.enabled, false);
    assert.equal(persistedLan.token, savedToken);
  } finally {
    if (child.exitCode === null) child.kill();
    if (child.exitCode === null) await once(child, 'exit');
  }
});

test('compiles the sample document and serves a PDF', { timeout: 120_000 }, async (context) => {
  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  if (!config.compiler) {
    context.skip('No local TeX compiler is installed.');
    return;
  }

  const buildRoot = path.join(testWorkspace, '.tex-build');
  const stableBuildDirectory = path.join(buildRoot, 'main');
  const staleMarker = path.join(stableBuildDirectory, 'stale-cache.marker');
  fs.mkdirSync(stableBuildDirectory, { recursive: true });
  fs.writeFileSync(path.join(stableBuildDirectory, 'main.aux'), '\\THIS_STALE_AUX_MUST_NOT_BE_READ\n', 'utf8');
  fs.writeFileSync(staleMarker, 'old build', 'utf8');

  const compileResponse = await fetch(`${baseUrl}/api/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mainFile: 'main.tex' }),
  });
  const compileResult = await compileResponse.json();
  assert.equal(compileResponse.status, 200, compileResult.output);
  assert.equal(compileResult.ok, true);
  assert.equal(compileResult.cleanBuild, true);
  assert.equal(compileResult.bibliographyTool, 'BibTeX');
  assert.match(compileResult.output, /干净编译：本次未读取上一次的辅助文件/);
  assert.equal(fs.existsSync(staleMarker), false);
  assert.equal(fs.existsSync(path.join(stableBuildDirectory, 'main.pdf')), true);
  assert.equal(fs.existsSync(path.join(stableBuildDirectory, 'main.bbl')), true);
  assert.deepEqual(
    fs.readdirSync(buildRoot).filter((name) => /^\.main\.(?:run|previous)-/.test(name)),
    [],
  );

  fs.writeFileSync(staleMarker, 'must disappear on the next compile too', 'utf8');
  const secondCompileResponse = await fetch(`${baseUrl}/api/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mainFile: 'main.tex' }),
  });
  const secondCompileResult = await secondCompileResponse.json();
  assert.equal(secondCompileResponse.status, 200, secondCompileResult.output);
  assert.equal(secondCompileResult.cleanBuild, true);
  assert.equal(fs.existsSync(staleMarker), false);
  assert.deepEqual(
    fs.readdirSync(buildRoot).filter((name) => /^\.main\.(?:run|previous)-/.test(name)),
    [],
  );

  const pdfResponse = await fetch(`${baseUrl}/api/pdf?main=main.tex`);
  assert.equal(pdfResponse.status, 200);
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  const pdfHeader = Buffer.from(pdfBytes).subarray(0, 5).toString('ascii');
  assert.equal(pdfHeader, '%PDF-');

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: pdfBytes, disableWorker: true });
  const parsedPdf = await loadingTask.promise;
  assert.equal(parsedPdf.numPages, 1);
  const parsedPage = await parsedPdf.getPage(1);
  const textContent = await parsedPage.getTextContent();
  assert.match(textContent.items.map((item) => item.str || '').join(' '), /LocalTeX First Document/);
  await loadingTask.destroy();

  const forwardResponse = await fetch(`${baseUrl}/api/synctex/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mainFile: 'main.tex',
      sourceFile: 'main.tex',
      line: 3,
      column: 1,
      pageHint: 1,
    }),
  });
  const forwardResult = await forwardResponse.json();
  assert.equal(forwardResponse.status, 200, forwardResult.error);
  assert.equal(forwardResult.positions[0].page, 1);
  assert.ok(Number.isFinite(forwardResult.positions[0].x));
  assert.ok(Number.isFinite(forwardResult.positions[0].y));

  const reverseResponse = await fetch(`${baseUrl}/api/synctex/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mainFile: 'main.tex',
      page: forwardResult.positions[0].page,
      x: forwardResult.positions[0].x,
      y: forwardResult.positions[0].y,
    }),
  });
  const reverseResult = await reverseResponse.json();
  assert.equal(reverseResponse.status, 200, reverseResult.error);
  assert.equal(reverseResult.sourceFile, 'main.tex');
  assert.ok(reverseResult.line >= 1);
});
