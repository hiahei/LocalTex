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

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'localtex-test-'));
const testWorkspace = path.join(testRoot, 'workspace');
fs.mkdirSync(testWorkspace, { recursive: true });
fs.writeFileSync(path.join(testWorkspace, 'main.tex'), String.raw`\documentclass{article}
\begin{document}
LocalTeX First Document
\end{document}
`, 'utf8');
fs.writeFileSync(path.join(testWorkspace, 'collab.tex'), 'Collaborative document\n', 'utf8');
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

const { createAppServer } = require('../server');

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
  assert.doesNotMatch(page, /<iframe id="pdfPreview"/);
  assert.match(page, /id="wrapButton"/);
  assert.match(page, /id="fontIncreaseButton"/);
  assert.match(page, /id="sourceToPdfButton"/);
  assert.match(page, /源码 → PDF/);
  assert.match(page, /<kbd>Ctrl<\/kbd>/);
  assert.match(page, /单击 PDF 正文，定位源码/);
  assert.match(page, /id="fileTree"[^>]+role="tree"/);
  assert.match(page, /id="sidebarModeLabel"/);
  assert.match(page, /class="project-overview"/);
  assert.match(page, /id="projectSearch"/);
  assert.doesNotMatch(page, /class="hero-workbench"/);
  assert.match(page, /id="shareDialog"/);
  assert.match(page, /id="shareToggleButton"/);
  assert.match(page, /id="workServiceToggle"/);
  assert.match(page, /id="resumeServiceButton"/);
  assert.match(page, /id="servicePausedScreen"/);
  assert.match(page, /id="collaborationButton"/);
  assert.match(page, /title="修改后会保存为主机默认显示名称"/);
  assert.match(page, /id="homeThemeButton"/);
  assert.match(page, /id="editorThemeButton"/);
  assert.doesNotMatch(page, /id="shareButton"/);
  assert.match(page, /\/vendor\/ace\/ace\.js/);
  assert.match(page, /\/vendor\/collaboration\.js/);

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
  assert.match(script, /pdf-page-canvas/);
  assert.match(script, /zoomPdfPreview/);
  assert.match(script, /resetPdfPreview/);
  assert.match(script, /jumpSourceToPdf/);
  assert.match(script, /jumpPdfToSource/);
  assert.match(script, /\/api\/synctex\/view/);
  assert.match(script, /\/api\/synctex\/edit/);
  assert.match(script, /document\.title = `LocalTex-\$\{data\.project\.name\}`/);
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
  assert.match(styles, /\.pdf-sync-marker/);
  assert.match(styles, /#pdfPreview\[hidden\] \+ \.pdf-sync-hint/);
  assert.match(styles, /\.ace_synctex-line/);
  assert.match(styles, /:root\[data-theme="dark"\][\s\S]*--editor: #fcfdfd/);
  assert.match(styles, /html\[data-theme="dark"\] \.code-editor[\s\S]*color: #21312c/);
  assert.match(styles, /\.project-overview/);
  assert.match(styles, /\.project-search/);
  assert.match(styles, /\.tree-children/);
  assert.match(styles, /\.tree-folder-icon/);
  assert.match(styles, /\.tree-file-icon\.tex/);
  assert.match(styles, /\.share-host-control/);
  assert.match(styles, /\.host-service-control/);
  assert.match(styles, /\.service-stopped-screen/);
  assert.match(styles, /\.share-toggle-button\[data-state="enabled"\]/);
  assert.match(styles, /\.pdf-page-canvas/);
  assert.match(styles, /\.pdf-render-status/);

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
  if (config.compiler) {
    assert.match(config.compilerPath, /Local_Tex[\\/]tools[\\/]miktex/i);
  }
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
    body: JSON.stringify({ collaboratorName: 'ExamplePaper Host' }),
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.profile.collaboratorName, 'ExamplePaper Host');

  const persisted = JSON.parse(fs.readFileSync(
    path.join(process.env.LOCAL_TEX_DATA_ROOT, 'profile-settings.json'),
    'utf8',
  ));
  assert.equal(persisted.collaboratorName, 'ExamplePaper Host');

  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(config.profile.collaboratorName, 'ExamplePaper Host');
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

  const compileResponse = await fetch(`${baseUrl}/api/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mainFile: 'main.tex' }),
  });
  const compileResult = await compileResponse.json();
  assert.equal(compileResponse.status, 200, compileResult.output);
  assert.equal(compileResult.ok, true);

  const pdfResponse = await fetch(`${baseUrl}/api/pdf?main=main.tex`);
  assert.equal(pdfResponse.status, 200);
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  const pdfHeader = Buffer.from(pdfBytes).subarray(0, 5).toString('ascii');
  assert.equal(pdfHeader, '%PDF-');

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: pdfBytes, disableWorker: true });
  const parsedPdf = await loadingTask.promise;
  assert.equal(parsedPdf.numPages, 1);
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
