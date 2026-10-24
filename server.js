const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { attachCollaborationServer } = require('./collaboration-server');

const APP_ROOT = __dirname;
const PUBLIC_ROOT = path.join(APP_ROOT, 'public');
const ACE_ASSETS_ROOT = path.join(APP_ROOT, 'node_modules', 'ace-builds', 'src-min-noconflict');
const PDFJS_ASSETS_ROOT = path.join(APP_ROOT, 'node_modules', 'pdfjs-dist');
const DEFAULT_WORKSPACE_ROOT = path.resolve(
  process.env.LOCAL_TEX_WORKSPACE || path.join(APP_ROOT, 'workspace'),
);
const DATA_ROOT = path.resolve(process.env.LOCAL_TEX_DATA_ROOT || path.join(APP_ROOT, 'data'));
const PROJECTS_FILE = path.join(DATA_ROOT, 'projects.json');
const LAN_SETTINGS_FILE = path.join(DATA_ROOT, 'lan-settings.json');
const SERVICE_SETTINGS_FILE = path.join(DATA_ROOT, 'service-settings.json');
const PROFILE_SETTINGS_FILE = path.join(DATA_ROOT, 'profile-settings.json');
const SERVICE_PID_FILE = path.join(DATA_ROOT, 'localtex.pid');
const HOST = process.env.LOCAL_TEX_HOST || '127.0.0.1';
const PORT = Number(process.env.LOCAL_TEX_PORT || 4177);
const NETWORK_CAPABLE = !['127.0.0.1', 'localhost', '::1'].includes(HOST);
const MAX_BODY_BYTES = 30 * 1024 * 1024;
const BUILD_DIRECTORY = '.tex-build';

const ignoredNames = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  BUILD_DIRECTORY,
]);

const generatedExtensions = new Set([
  '.aux',
  '.bbl',
  '.bcf',
  '.blg',
  '.fdb_latexmk',
  '.fls',
  '.lof',
  '.log',
  '.lot',
  '.nav',
  '.out',
  '.run.xml',
  '.snm',
  '.synctex.gz',
  '.toc',
]);

const textExtensions = new Set([
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

const mimeTypes = {
  '.bcmap': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.tex': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

let compileInProgress = false;
let browseInProgress = false;
const compileHistory = new Map();
let projectRegistry = null;
let lanSettings = null;
let collaborationServer = null;
let serviceSettings = null;
let profileSettings = null;

function isLoopbackAddress(address = '') {
  const normalized = String(address).toLowerCase();
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === '::ffff:127.0.0.1';
}

function isHostRequest(request) {
  return isLoopbackAddress(request.socket.remoteAddress);
}

function requestToken(request, url) {
  return String(request.headers['x-localtex-token'] || url.searchParams.get('token') || '');
}

function tokenMatches(candidate) {
  if (!lanSettings?.token || !candidate) return false;
  const expected = Buffer.from(lanSettings.token);
  const received = Buffer.from(String(candidate));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function isAuthorizedRequest(request, url) {
  return isHostRequest(request) || (isLanSharingEnabled() && tokenMatches(requestToken(request, url)));
}

function isLanSharingEnabled() {
  return NETWORK_CAPABLE && isWorkServiceActive() && lanSettings?.enabled === true;
}

function isWorkServiceActive() {
  return serviceSettings?.active !== false;
}

async function saveLanSettings() {
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  const temporaryFile = `${LAN_SETTINGS_FILE}.tmp`;
  await fsp.writeFile(temporaryFile, `${JSON.stringify(lanSettings, null, 2)}\n`, 'utf8');
  await fsp.rename(temporaryFile, LAN_SETTINGS_FILE);
}

async function saveServiceSettings() {
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  const temporaryFile = `${SERVICE_SETTINGS_FILE}.tmp`;
  await fsp.writeFile(temporaryFile, `${JSON.stringify(serviceSettings, null, 2)}\n`, 'utf8');
  await fsp.rename(temporaryFile, SERVICE_SETTINGS_FILE);
}

async function saveProfileSettings() {
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  const temporaryFile = `${PROFILE_SETTINGS_FILE}.tmp`;
  await fsp.writeFile(temporaryFile, `${JSON.stringify(profileSettings, null, 2)}\n`, 'utf8');
  await fsp.rename(temporaryFile, PROFILE_SETTINGS_FILE);
}

async function loadProfileSettings() {
  if (profileSettings) return profileSettings;
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  try {
    const saved = JSON.parse(await fsp.readFile(PROFILE_SETTINGS_FILE, 'utf8'));
    const collaboratorName = String(saved.collaboratorName || '').trim().slice(0, 32);
    profileSettings = {
      collaboratorName: collaboratorName || null,
      updatedAt: saved.updatedAt || null,
    };
    return profileSettings;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not read profile settings: ${error.message}`);
  }
  profileSettings = { collaboratorName: null, updatedAt: null };
  return profileSettings;
}

function profileView(hostRequest) {
  return hostRequest
    ? { collaboratorName: profileSettings?.collaboratorName || null }
    : null;
}

async function loadServiceSettings() {
  if (serviceSettings) return serviceSettings;
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  // A fresh controller launch always restores local editing. Pausing is only
  // for the lifetime of the current controller process.
  serviceSettings = { active: true };
  await saveServiceSettings();
  return serviceSettings;
}

function serviceView() {
  return {
    active: isWorkServiceActive(),
    controllerMode: 'background',
    canControl: true,
  };
}

async function loadLanSettings() {
  if (lanSettings) return lanSettings;
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  try {
    const saved = JSON.parse(await fsp.readFile(LAN_SETTINGS_FILE, 'utf8'));
    if (typeof saved.token === 'string' && saved.token.length >= 24) {
      lanSettings = {
        ...saved,
        // Sharing is deliberately never restored after a controller restart.
        // The host must explicitly enable it for every collaboration session.
        enabled: false,
      };
      if (saved.enabled !== false) await saveLanSettings();
      return lanSettings;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not read LAN settings: ${error.message}`);
  }

  lanSettings = {
    token: randomBytes(24).toString('base64url'),
    enabled: false,
    createdAt: new Date().toISOString(),
  };
  await saveLanSettings();
  return lanSettings;
}

function lanAddresses() {
  const candidates = [];
  for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || entry.address.startsWith('169.254.')) continue;
      const isVirtual = /tailscale|zerotier|hamachi|vpn|vEthernet|virtualbox|vmware|wsl|docker/i.test(interfaceName);
      const isPrivate = entry.address.startsWith('10.')
        || entry.address.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(entry.address);
      const isCarrierGradeNat = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(entry.address);
      candidates.push({
        address: entry.address,
        priority: (isVirtual ? 100 : 0) + (isPrivate ? 0 : isCarrierGradeNat ? 20 : 40),
      });
    }
  }
  const bestPriority = new Map();
  for (const candidate of candidates) {
    bestPriority.set(
      candidate.address,
      Math.min(candidate.priority, bestPriority.get(candidate.address) ?? Number.POSITIVE_INFINITY),
    );
  }
  return [...bestPriority]
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0], 'en'))
    .map(([address]) => address);
}

function lanShareUrls() {
  if (!isLanSharingEnabled() || !lanSettings?.token) return [];
  return lanAddresses().map((address) => `http://${address}:${PORT}/?token=${encodeURIComponent(lanSettings.token)}`);
}

function lanView(hostRequest) {
  return {
    available: NETWORK_CAPABLE,
    enabled: isLanSharingEnabled(),
    isHost: hostRequest,
    shareUrls: hostRequest ? lanShareUrls() : [],
  };
}

function normalizeRelative(input = '') {
  return String(input).replaceAll('\\', '/').replace(/^\/+/, '');
}

function resolveInside(root, relativePath) {
  const normalized = normalizeRelative(relativePath);
  const absolute = path.resolve(root, normalized);
  const prefix = `${path.resolve(root)}${path.sep}`;

  if (absolute !== path.resolve(root) && !absolute.startsWith(prefix)) {
    throw new Error('Path is outside the configured workspace.');
  }

  return absolute;
}

function projectView(project) {
  return {
    ...project,
    exists: fs.existsSync(project.path),
  };
}

async function saveProjectRegistry() {
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  const temporaryFile = `${PROJECTS_FILE}.tmp`;
  await fsp.writeFile(temporaryFile, `${JSON.stringify(projectRegistry, null, 2)}\n`, 'utf8');
  await fsp.rename(temporaryFile, PROJECTS_FILE);
}

async function loadProjectRegistry() {
  if (projectRegistry) return projectRegistry;

  await fsp.mkdir(DEFAULT_WORKSPACE_ROOT, { recursive: true });
  await fsp.mkdir(DATA_ROOT, { recursive: true });
  try {
    const stored = JSON.parse(await fsp.readFile(PROJECTS_FILE, 'utf8'));
    projectRegistry = Array.isArray(stored) ? stored : [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not read project registry: ${error.message}`);
    projectRegistry = [];
  }

  await saveProjectRegistry();
  return projectRegistry;
}

async function getProject(projectId) {
  const projects = await loadProjectRegistry();
  const requestedId = String(projectId || '');
  const project = requestedId
    ? projects.find((item) => item.id === requestedId)
    : projects[0];
  if (!project) throw new Error('Project not found.');
  if (!fs.existsSync(project.path)) throw new Error('The project folder is no longer available.');
  return project;
}

async function projectFromRequest(request, url) {
  const projectId = String(
    request.headers['x-localtex-project']
    || url?.searchParams.get('project')
    || '',
  );
  return getProject(projectId);
}

async function findMainDocument(projectRoot, preferredFile = '') {
  if (preferredFile) {
    const preferred = normalizeRelative(preferredFile);
    const preferredPath = resolveInside(projectRoot, preferred);
    if (fs.existsSync(preferredPath) && path.extname(preferredPath).toLowerCase() === '.tex') {
      return preferred;
    }
  }

  const candidates = [];
  async function visit(directory, relativeBase = '', depth = 0) {
    if (depth > 4 || candidates.length > 300) return;
    const entries = await fsp.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (ignoredNames.has(entry.name) || entry.name.startsWith('.')) continue;
      const relativePath = normalizeRelative(path.join(relativeBase, entry.name));
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.tex')) {
        candidates.push(relativePath);
      }
    }
  }
  await visit(projectRoot);

  candidates.sort((left, right) => {
    const leftName = path.basename(left).toLowerCase();
    const rightName = path.basename(right).toLowerCase();
    if ((leftName === 'main.tex') !== (rightName === 'main.tex')) return leftName === 'main.tex' ? -1 : 1;
    const depthDifference = left.split('/').length - right.split('/').length;
    return depthDifference || left.localeCompare(right, 'en');
  });

  for (const candidate of candidates) {
    const content = await fsp.readFile(resolveInside(projectRoot, candidate), 'utf8').catch(() => '');
    if (/\\documentclass(?:\[[^\]]*\])?\{/.test(content)) return candidate;
  }
  return candidates[0] || '';
}

async function addProject(projectPath, preferredFile = '') {
  const absolutePath = path.resolve(String(projectPath || ''));
  const stat = await fsp.stat(absolutePath);
  if (!stat.isDirectory()) throw new Error('The selected project path is not a folder.');

  const projects = await loadProjectRegistry();
  let project = projects.find((item) => path.resolve(item.path).toLowerCase() === absolutePath.toLowerCase());
  if (!project) {
    project = {
      id: randomUUID(),
      name: path.basename(absolutePath) || absolutePath,
      path: absolutePath,
      mainFile: '',
      createdAt: new Date().toISOString(),
      lastOpenedAt: null,
    };
    projects.push(project);
  }

  project.mainFile = await findMainDocument(absolutePath, preferredFile || project.mainFile);
  project.lastOpenedAt = new Date().toISOString();
  await saveProjectRegistry();
  return project;
}

function browseLocalPath(mode) {
  if (process.platform !== 'win32') throw new Error('Native file browsing is currently available on Windows only.');

  const modernFolderPickerSource = path.join(APP_ROOT, 'tools', 'picker', 'ModernFolderPicker.cs').replaceAll("'", "''");
  const ownerScript = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Windows.Forms; public sealed class LocalTeXWindowWrapper : IWin32Window { public LocalTeXWindowWrapper(IntPtr handle) { Handle = handle; } public IntPtr Handle { get; private set; } } public static class LocalTeXNativeWindow { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); }' -ReferencedAssemblies System.Windows.Forms",
    '$foregroundHandle = [LocalTeXNativeWindow]::GetForegroundWindow()',
    '$owner = [LocalTeXWindowWrapper]::new($foregroundHandle)',
  ];
  const folderScript = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    `Add-Type -Path '${modernFolderPickerSource}'`,
    "$selected = [LocalTeX.NativeDialogs.ModernFolderPicker]::Pick('选择 LaTeX 项目文件夹', '选择文件夹')",
    'if (-not [string]::IsNullOrWhiteSpace($selected)) { Write-Output $selected }',
  ].join('; ');
  const fileScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    ...ownerScript,
    '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
    "$dialog.Title = '选择 LaTeX 主文档'",
    "$dialog.Filter = 'LaTeX files (*.tex)|*.tex|All files (*.*)|*.*'",
    '$dialog.Multiselect = $false',
    '$result = if ($foregroundHandle -eq [IntPtr]::Zero) { $dialog.ShowDialog() } else { $dialog.ShowDialog($owner) }',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName }',
  ].join('; ');

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-STA',
      '-Command',
      mode === 'file' ? fileScript : folderScript,
    ], {
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('The local file picker timed out.'));
    }, 10 * 60 * 1000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(stdout).toString('utf8').trim();
      const errorOutput = Buffer.concat(stderr).toString('utf8').trim();
      if (code !== 0) {
        reject(new Error(errorOutput || 'Could not open the local file picker.'));
        return;
      }
      resolve(output);
    });
  });
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function sendText(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(value),
    'Cache-Control': 'no-store',
  });
  response.end(value);
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function commandPath(command) {
  const executable = command.toLowerCase().endsWith('.exe') ? command : `${command}.exe`;

  if (process.platform === 'win32') {
    const portable = path.join(
      APP_ROOT,
      'tools',
      'miktex',
      'texmfs',
      'install',
      'miktex',
      'bin',
      'x64',
      executable,
    );
    if (fs.existsSync(portable)) return portable;
  }

  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(locator, [command], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status === 0) {
    const discovered = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (discovered) return discovered;
  }

  if (process.platform === 'win32') {
    const candidates = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64', executable),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'MiKTeX', 'miktex', 'bin', 'x64', executable),
    ].filter(Boolean);
    const bundled = candidates.find((candidate) => fs.existsSync(candidate));
    if (bundled) return bundled;
  }

  return null;
}

function detectCompiler() {
  const pdflatex = commandPath('pdflatex');
  if (pdflatex) return { kind: 'pdflatex', command: pdflatex, label: 'pdfLaTeX' };

  const latexmk = commandPath('latexmk');
  if (latexmk) return { kind: 'latexmk', command: latexmk, label: 'latexmk + pdfLaTeX' };

  const tectonic = commandPath('tectonic');
  if (tectonic) return { kind: 'tectonic', command: tectonic, label: 'Tectonic' };

  return null;
}

async function listWorkspace(directory, relativeBase = '') {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const result = [];

  entries.sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
    return left.name.localeCompare(right.name, 'en');
  });

  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) continue;

    const relativePath = normalizeRelative(path.join(relativeBase, entry.name));
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push({ path: relativePath, type: 'directory' });
      result.push(...await listWorkspace(absolutePath, relativePath));
      continue;
    }

    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (generatedExtensions.has(extension)) continue;

    const stat = await fsp.stat(absolutePath);
    result.push({
      path: relativePath,
      type: 'file',
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      editable: textExtensions.has(extension) || extension === '',
    });
  }

  return result;
}

function runProcess(command, args, cwd, environment = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...environment },
      windowsHide: true,
    });

    const output = [];
    let outputBytes = 0;
    const maxOutputBytes = 4 * 1024 * 1024;

    const collect = (chunk) => {
      if (outputBytes >= maxOutputBytes) return;
      outputBytes += chunk.length;
      output.push(chunk);
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const timeout = setTimeout(() => child.kill(), 120_000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        code: -1,
        durationMs: Date.now() - startedAt,
        output: `${output.join('')}\n${error.message}`.trim(),
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        code: code ?? -1,
        durationMs: Date.now() - startedAt,
        output: Buffer.concat(output).toString('utf8').trim(),
      });
    });
  });
}

function extractDiagnostics(output) {
  const diagnostics = [];
  const seen = new Set();
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    const fileLine = line.match(/^(.*?\.tex):(\d+):\s*(.+)$/i);
    const latexError = line.match(/^!\s*(.+)$/);
    const warning = line.match(/^(?:LaTeX|Package\s+\S+) Warning:\s*(.+)$/i);
    const match = fileLine || latexError || warning;
    if (!match) continue;

    const item = fileLine
      ? { file: normalizeRelative(fileLine[1]), line: Number(fileLine[2]), message: fileLine[3], level: 'error' }
      : { message: match[1], level: latexError ? 'error' : 'warning' };
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      diagnostics.push(item);
      seen.add(key);
    }
    if (diagnostics.length >= 30) break;
  }

  return diagnostics;
}

function parseSynctexOutput(output) {
  const records = [];
  const numericFields = new Set(['page', 'x', 'y', 'h', 'v', 'width', 'height', 'line', 'column', 'offset']);
  let current = null;
  let insideResult = false;

  for (const rawLine of String(output || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === 'SyncTeX result begin') {
      insideResult = true;
      continue;
    }
    if (line === 'SyncTeX result end') break;
    if (!insideResult) continue;

    const field = line.match(/^([A-Za-z]+):(.*)$/);
    if (!field) continue;
    const rawKey = field[1];
    const key = rawKey === 'W' ? 'width' : rawKey === 'H' ? 'height' : rawKey.toLowerCase();
    const value = field[2].trim();
    if (key === 'output' && current && Object.keys(current).length > 0) {
      records.push(current);
      current = null;
    }
    if (!current) current = {};
    current[key] = numericFields.has(key) ? Number(value) : value;
  }

  if (current && Object.keys(current).length > 0) records.push(current);
  return records;
}

function compiledArtifact(projectId, mainFile) {
  const normalizedMain = normalizeRelative(mainFile);
  const record = compileHistory.get(`${projectId}:${normalizedMain}`);
  if (!record?.pdfPath || !fs.existsSync(record.pdfPath)) return null;
  const stem = record.pdfPath.replace(/\.pdf$/i, '');
  const synctexPath = [`${stem}.synctex.gz`, `${stem}.synctex`].find((candidate) => fs.existsSync(candidate));
  return { mainFile: normalizedMain, pdfPath: record.pdfPath, synctexPath };
}

async function compileTex(mainFile, workspaceRoot, projectId) {
  const normalizedMain = normalizeRelative(mainFile);
  if (path.extname(normalizedMain).toLowerCase() !== '.tex') {
    throw new Error('The main document must be a .tex file.');
  }

  const sourcePath = resolveInside(workspaceRoot, normalizedMain);
  const sourceStat = await fsp.stat(sourcePath);
  if (!sourceStat.isFile()) throw new Error('The selected main document does not exist.');

  const compiler = detectCompiler();
  if (!compiler) {
    const message = [
      'No LaTeX compiler was found.',
      'Install MiKTeX or TeX Live, then ensure latexmk or pdflatex is available in PATH.',
    ].join('\n');
    return {
      ok: false,
      compiler: null,
      output: message,
      diagnostics: [{ level: 'error', message }],
    };
  }

  const sourceDirectory = path.dirname(sourcePath);
  const mainName = path.basename(sourcePath);
  const mainStem = path.basename(sourcePath, '.tex');
  const relativeDirectory = path.dirname(normalizedMain) === '.' ? '' : path.dirname(normalizedMain);
  const buildDirectory = resolveInside(
    workspaceRoot,
    path.join(BUILD_DIRECTORY, relativeDirectory, mainStem),
  );
  await fsp.mkdir(buildDirectory, { recursive: true });

  let result;
  let commandDescription;

  if (compiler.kind === 'latexmk') {
    const args = [
      '-pdf',
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      '-synctex=1',
      `-outdir=${buildDirectory}`,
      mainName,
    ];
    commandDescription = `latexmk ${args.join(' ')}`;
    result = await runProcess(compiler.command, args, sourceDirectory);
  } else if (compiler.kind === 'tectonic') {
    const args = ['-X', 'compile', mainName, '--outdir', buildDirectory, '--synctex'];
    commandDescription = `tectonic ${args.join(' ')}`;
    result = await runProcess(compiler.command, args, sourceDirectory);
  } else {
    const args = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      '-synctex=1',
      `-output-directory=${buildDirectory}`,
      mainName,
    ];
    commandDescription = `pdflatex ${args.join(' ')}`;
    const runs = [await runProcess(compiler.command, args, sourceDirectory)];

    const auxPath = path.join(buildDirectory, `${mainStem}.aux`);
    const bibtex = commandPath('bibtex');
    if (bibtex && fs.existsSync(auxPath)) {
      const auxContents = await fsp.readFile(auxPath, 'utf8').catch(() => '');
      if (auxContents.includes('\\bibdata')) {
        runs.push(await runProcess(bibtex, [mainStem], buildDirectory, {
          BIBINPUTS: `${sourceDirectory}${path.delimiter}`,
          BSTINPUTS: `${sourceDirectory}${path.delimiter}`,
        }));
      }
    }

    if (runs.every((run) => run.code === 0)) {
      runs.push(await runProcess(compiler.command, args, sourceDirectory));
      runs.push(await runProcess(compiler.command, args, sourceDirectory));
    }

    result = {
      code: runs.find((run) => run.code !== 0)?.code ?? 0,
      durationMs: runs.reduce((sum, run) => sum + run.durationMs, 0),
      output: runs.map((run, index) => `--- pass ${index + 1} ---\n${run.output}`).join('\n\n'),
    };
  }

  const pdfPath = path.join(buildDirectory, `${mainStem}.pdf`);
  const pdfExists = fs.existsSync(pdfPath);
  const output = `$ ${commandDescription}\n\n${result.output}`;
  const record = {
    ok: result.code === 0 && pdfExists,
    compiler: compiler.label,
    command: commandDescription,
    durationMs: result.durationMs,
    output,
    diagnostics: extractDiagnostics(output),
    pdfAvailable: pdfExists,
    compiledAt: new Date().toISOString(),
  };

  compileHistory.set(`${projectId}:${normalizedMain}`, { ...record, pdfPath });
  return record;
}

async function serveFile(response, absolutePath, cache = false) {
  const stat = await fsp.stat(absolutePath);
  if (!stat.isFile()) throw new Error('Not a file.');

  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': cache ? 'public, max-age=300' : 'no-store',
  });
  fs.createReadStream(absolutePath).pipe(response);
}

async function handleApi(request, response, url) {
  if (request.method === 'PUT' && url.pathname === '/api/service/state') {
    if (!isHostRequest(request)) {
      return sendJson(response, 403, { error: '只有主机可以控制 LocalTeX 工作服务。' });
    }
    const body = await readJsonBody(request);
    if (typeof body.active !== 'boolean') {
      return sendJson(response, 400, { error: '工作服务状态必须是布尔值。' });
    }
    serviceSettings.active = body.active;
    await saveServiceSettings();
    if (!body.active) {
      lanSettings.enabled = false;
      lanSettings.updatedAt = new Date().toISOString();
      await saveLanSettings();
      collaborationServer?.disconnectAll(4002, '主机已暂停 LocalTeX 工作服务');
    }
    return sendJson(response, 200, { service: serviceView(), lan: lanView(true) });
  }

  if (request.method === 'PUT' && url.pathname === '/api/lan') {
    if (!isHostRequest(request)) {
      return sendJson(response, 403, { error: '只有主机可以控制局域网分享。' });
    }
    if (!NETWORK_CAPABLE) {
      return sendJson(response, 409, { error: '当前服务只监听本机，请使用 LocalTeX 启动器重新打开。' });
    }
    const body = await readJsonBody(request);
    if (typeof body.enabled !== 'boolean') {
      return sendJson(response, 400, { error: '分享状态必须是布尔值。' });
    }
    lanSettings.enabled = body.enabled;
    lanSettings.updatedAt = new Date().toISOString();
    await saveLanSettings();
    if (!body.enabled) collaborationServer?.disconnectAll(4001, '主机已关闭局域网分享');
    return sendJson(response, 200, { lan: lanView(true) });
  }

  if (request.method === 'PUT' && url.pathname === '/api/profile') {
    if (!isHostRequest(request)) {
      return sendJson(response, 403, { error: '只有主机可以修改主机默认显示名称。' });
    }
    const body = await readJsonBody(request);
    const collaboratorName = String(body.collaboratorName || '').trim().slice(0, 32);
    if (!collaboratorName) {
      return sendJson(response, 400, { error: '显示名称不能为空。' });
    }
    profileSettings.collaboratorName = collaboratorName;
    profileSettings.updatedAt = new Date().toISOString();
    await saveProfileSettings();
    return sendJson(response, 200, { profile: profileView(true) });
  }

  if (request.method === 'GET' && url.pathname === '/api/projects') {
    const projects = await loadProjectRegistry();
    const sorted = [...projects].sort((left, right) => {
      const leftTime = left.lastOpenedAt ? Date.parse(left.lastOpenedAt) : 0;
      const rightTime = right.lastOpenedAt ? Date.parse(right.lastOpenedAt) : 0;
      return rightTime - leftTime || left.name.localeCompare(right.name, 'zh-CN');
    });
    return sendJson(response, 200, { projects: sorted.map(projectView) });
  }

  if (request.method === 'POST' && url.pathname === '/api/projects/browse') {
    if (!isHostRequest(request)) {
      return sendJson(response, 403, { error: '只有主机可以打开本机文件夹选择器。' });
    }
    if (browseInProgress) {
      return sendJson(response, 409, { error: 'A local file picker is already open.' });
    }
    const body = await readJsonBody(request);
    const mode = body.mode === 'file' ? 'file' : 'folder';
    browseInProgress = true;
    try {
      const selectedPath = await browseLocalPath(mode);
      if (!selectedPath) return sendJson(response, 200, { cancelled: true });
      const project = mode === 'file'
        ? await addProject(path.dirname(selectedPath), path.basename(selectedPath))
        : await addProject(selectedPath);
      return sendJson(response, 201, { project: projectView(project) });
    } finally {
      browseInProgress = false;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/projects/add') {
    if (!isHostRequest(request)) {
      return sendJson(response, 403, { error: '只有主机可以添加本地路径。' });
    }
    const body = await readJsonBody(request);
    if (!body.path) return sendJson(response, 400, { error: 'A project folder path is required.' });
    const project = await addProject(body.path, body.mainFile || '');
    if (body.name) project.name = String(body.name).trim() || project.name;
    await saveProjectRegistry();
    return sendJson(response, 201, { project: projectView(project) });
  }

  if (request.method === 'POST' && url.pathname === '/api/projects/select') {
    const body = await readJsonBody(request);
    const project = await getProject(String(body.id || ''));
    project.lastOpenedAt = new Date().toISOString();
    if (!project.mainFile) project.mainFile = await findMainDocument(project.path);
    await saveProjectRegistry();
    return sendJson(response, 200, { project: projectView(project) });
  }

  if (request.method === 'PUT' && url.pathname === '/api/projects') {
    const body = await readJsonBody(request);
    const project = await getProject(String(body.id || ''));
    if (typeof body.name === 'string' && body.name.trim()) project.name = body.name.trim();
    if (typeof body.mainFile === 'string') {
      const mainFile = normalizeRelative(body.mainFile);
      if (mainFile) {
        const mainPath = resolveInside(project.path, mainFile);
        if (!fs.existsSync(mainPath) || path.extname(mainPath).toLowerCase() !== '.tex') {
          return sendJson(response, 400, { error: 'The selected main document is not an existing .tex file.' });
        }
      }
      project.mainFile = mainFile;
    }
    await saveProjectRegistry();
    return sendJson(response, 200, { project: projectView(project) });
  }

  if (request.method === 'DELETE' && url.pathname === '/api/projects') {
    if (!isHostRequest(request)) {
      return sendJson(response, 403, { error: '只有主机可以管理项目列表。' });
    }
    const projectId = String(url.searchParams.get('id') || '');
    const projects = await loadProjectRegistry();
    const index = projects.findIndex((project) => project.id === projectId);
    if (index < 0) return sendJson(response, 404, { error: 'Project not found.' });
    projects.splice(index, 1);
    await saveProjectRegistry();
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/config') {
    const projects = await loadProjectRegistry();
    const requestedId = String(
      request.headers['x-localtex-project']
      || url.searchParams.get('project')
      || '',
    );
    const project = requestedId
      ? projects.find((item) => item.id === requestedId)
      : projects[0] || null;
    const compiler = detectCompiler();
    const hostRequest = isHostRequest(request);
    return sendJson(response, 200, {
      workspace: project?.path || DEFAULT_WORKSPACE_ROOT,
      project: project ? projectView(project) : null,
      compiler: compiler ? compiler.label : null,
      compilerPath: compiler ? compiler.command : null,
      localOnly: !NETWORK_CAPABLE,
      port: PORT,
      lan: lanView(hostRequest),
      service: serviceView(),
      profile: profileView(hostRequest),
    });
  }

  const project = await projectFromRequest(request, url);
  const workspaceRoot = project.path;

  if (request.method === 'GET' && url.pathname === '/api/files') {
    return sendJson(response, 200, { files: await listWorkspace(workspaceRoot) });
  }

  if (request.method === 'GET' && url.pathname === '/api/file') {
    const relativePath = url.searchParams.get('path') || '';
    const absolutePath = resolveInside(workspaceRoot, relativePath);
    const extension = path.extname(absolutePath).toLowerCase();
    if (!textExtensions.has(extension) && extension !== '') {
      return sendJson(response, 415, { error: 'This file is not editable as text.' });
    }
    const content = await fsp.readFile(absolutePath, 'utf8');
    return sendJson(response, 200, { path: normalizeRelative(relativePath), content });
  }

  if (request.method === 'PUT' && url.pathname === '/api/file') {
    const body = await readJsonBody(request);
    const relativePath = normalizeRelative(body.path);
    if (!relativePath) return sendJson(response, 400, { error: 'A file path is required.' });
    const absolutePath = resolveInside(workspaceRoot, relativePath);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, String(body.content ?? ''), 'utf8');
    return sendJson(response, 200, { ok: true, path: relativePath });
  }

  if (request.method === 'POST' && url.pathname === '/api/file/new') {
    const body = await readJsonBody(request);
    const relativePath = normalizeRelative(body.path);
    if (!relativePath) return sendJson(response, 400, { error: 'A file path is required.' });
    const absolutePath = resolveInside(workspaceRoot, relativePath);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    const handle = await fsp.open(absolutePath, 'wx');
    await handle.writeFile(String(body.content ?? ''), 'utf8');
    await handle.close();
    return sendJson(response, 201, { ok: true, path: relativePath });
  }

  if (request.method === 'POST' && url.pathname === '/api/upload') {
    const body = await readJsonBody(request);
    const relativePath = normalizeRelative(body.path);
    if (!relativePath || typeof body.data !== 'string') {
      return sendJson(response, 400, { error: 'A file path and base64 data are required.' });
    }
    const absolutePath = resolveInside(workspaceRoot, relativePath);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, Buffer.from(body.data, 'base64'));
    return sendJson(response, 201, { ok: true, path: relativePath });
  }

  if (request.method === 'POST' && url.pathname === '/api/compile') {
    if (compileInProgress) {
      return sendJson(response, 409, { error: 'A compile is already running.' });
    }

    const body = await readJsonBody(request);
    compileInProgress = true;
    try {
      const result = await compileTex(body.mainFile, workspaceRoot, project.id);
      return sendJson(response, result.ok ? 200 : 422, result);
    } finally {
      compileInProgress = false;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/synctex/view') {
    const body = await readJsonBody(request);
    const artifact = compiledArtifact(project.id, body.mainFile);
    if (!artifact) {
      return sendJson(response, 404, { error: 'Compile the main document before using source-to-PDF positioning.' });
    }
    if (!artifact.synctexPath) {
      return sendJson(response, 404, { error: 'The latest compile did not produce SyncTeX position data.' });
    }

    const sourceFile = normalizeRelative(body.sourceFile);
    const sourcePath = resolveInside(workspaceRoot, sourceFile);
    const line = Number(body.line);
    const column = Number(body.column);
    const pageHint = Number(body.pageHint);
    if (!sourceFile || !Number.isInteger(line) || line < 1) {
      return sendJson(response, 400, { error: 'A source file and a positive source line are required.' });
    }
    const sourceStat = await fsp.stat(sourcePath);
    if (!sourceStat.isFile()) return sendJson(response, 400, { error: 'The SyncTeX source is not a file.' });

    const synctex = commandPath('synctex');
    if (!synctex) return sendJson(response, 501, { error: 'The local SyncTeX utility is unavailable.' });
    // Omitting the optional page hint avoids a Windows drive-letter ambiguity in SyncTeX 1.5.
    const input = `${line}:${Number.isInteger(column) && column > 0 ? column : 1}:${sourcePath}`;
    const result = await runProcess(synctex, ['view', '-i', input, '-o', artifact.pdfPath], workspaceRoot);
    const positions = parseSynctexOutput(result.output)
      .filter((item) => Number.isInteger(item.page) && Number.isFinite(item.x) && Number.isFinite(item.y))
      .map((item) => ({
        page: item.page,
        x: item.x,
        y: item.y,
        h: Number.isFinite(item.h) ? item.h : item.x,
        v: Number.isFinite(item.v) ? item.v : item.y,
        width: Number.isFinite(item.width) ? item.width : 0,
        height: Number.isFinite(item.height) ? Math.abs(item.height) : 0,
      }));
    if (Number.isInteger(pageHint) && pageHint > 0) {
      positions.sort((left, right) => Math.abs(left.page - pageHint) - Math.abs(right.page - pageHint));
    }
    if (!positions.length) {
      return sendJson(response, 404, {
        error: 'No PDF position was found for this source line. Recompile and try a nearby line.',
      });
    }
    return sendJson(response, 200, { positions });
  }

  if (request.method === 'POST' && url.pathname === '/api/synctex/edit') {
    const body = await readJsonBody(request);
    const artifact = compiledArtifact(project.id, body.mainFile);
    if (!artifact) {
      return sendJson(response, 404, { error: 'Compile the main document before using PDF-to-source positioning.' });
    }
    if (!artifact.synctexPath) {
      return sendJson(response, 404, { error: 'The latest compile did not produce SyncTeX position data.' });
    }

    const page = Number(body.page);
    const x = Number(body.x);
    const y = Number(body.y);
    if (!Number.isInteger(page) || page < 1 || !Number.isFinite(x) || x < 0 || !Number.isFinite(y) || y < 0) {
      return sendJson(response, 400, { error: 'A valid PDF page and position are required.' });
    }

    const synctex = commandPath('synctex');
    if (!synctex) return sendJson(response, 501, { error: 'The local SyncTeX utility is unavailable.' });
    const outputPoint = `${page}:${x.toFixed(3)}:${y.toFixed(3)}:${artifact.pdfPath}`;
    const result = await runProcess(synctex, ['edit', '-o', outputPoint], workspaceRoot);
    const target = parseSynctexOutput(result.output)
      .find((item) => item.input && Number.isFinite(item.line));
    if (!target) {
      return sendJson(response, 404, {
        error: 'No source position was found at this PDF point. Try clicking directly on typeset text.',
      });
    }

    const mainSourcePath = resolveInside(workspaceRoot, artifact.mainFile);
    const absoluteInput = path.isAbsolute(target.input)
      ? path.resolve(target.input)
      : path.resolve(path.dirname(mainSourcePath), target.input);
    const sourceFile = normalizeRelative(path.relative(workspaceRoot, absoluteInput));
    const verifiedInput = resolveInside(workspaceRoot, sourceFile);
    const extension = path.extname(verifiedInput).toLowerCase();
    if (!textExtensions.has(extension) && extension !== '') {
      return sendJson(response, 415, { error: 'The mapped source file is not editable text.' });
    }
    return sendJson(response, 200, {
      sourceFile,
      line: Math.max(1, Math.trunc(target.line)),
      column: Number.isFinite(target.column) ? Math.trunc(target.column) : -1,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/compile/latest') {
    const mainFile = normalizeRelative(url.searchParams.get('main') || '');
    const record = compileHistory.get(`${project.id}:${mainFile}`);
    if (!record) return sendJson(response, 404, { error: 'No compile result is available.' });
    const { pdfPath: _pdfPath, ...publicRecord } = record;
    return sendJson(response, 200, publicRecord);
  }

  if (request.method === 'GET' && url.pathname === '/api/pdf') {
    const mainFile = normalizeRelative(url.searchParams.get('main') || '');
    const record = compileHistory.get(`${project.id}:${mainFile}`);
    if (!record?.pdfPath || !fs.existsSync(record.pdfPath)) {
      return sendJson(response, 404, { error: 'Compile the document before opening its PDF.' });
    }
    return serveFile(response, record.pdfPath);
  }

  if (request.method === 'GET' && url.pathname === '/api/asset') {
    const relativePath = url.searchParams.get('path') || '';
    return serveFile(response, resolveInside(workspaceRoot, relativePath), true);
  }

  return sendJson(response, 404, { error: 'Unknown API endpoint.' });
}

async function requestHandler(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const hostRequest = isHostRequest(request);

    if (!hostRequest && !isLanSharingEnabled()) {
      if (url.pathname.startsWith('/api/')) {
        return sendJson(response, 403, { error: 'LocalTeX 主机当前没有开启局域网分享。' });
      }
      return sendText(response, 403, 'LocalTeX LAN sharing is currently disabled by the host.');
    }

    if (url.pathname.startsWith('/api/')) {
      if (!isAuthorizedRequest(request, url)) {
        return sendJson(response, 401, { error: '需要有效的 LocalTeX 局域网访问链接。' });
      }
      const controllerEndpoint = url.pathname === '/api/config' || url.pathname === '/api/service/state';
      if (hostRequest && !isWorkServiceActive() && !controllerEndpoint) {
        return sendJson(response, 423, { error: 'LocalTeX 工作服务已由主机暂停。' });
      }
      return await handleApi(request, response, url);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/vendor/ace/')) {
      const requestedAsset = url.pathname.slice('/vendor/ace/'.length);
      return await serveFile(response, resolveInside(ACE_ASSETS_ROOT, requestedAsset), true);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/vendor/pdfjs/')) {
      const requestedAsset = url.pathname.slice('/vendor/pdfjs/'.length);
      return await serveFile(response, resolveInside(PDFJS_ASSETS_ROOT, requestedAsset), true);
    }

    const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname;
    const absolutePath = resolveInside(PUBLIC_ROOT, requestedPath);
    return await serveFile(response, absolutePath, false);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendJson(response, 404, { error: 'File not found.' });
    }
    if (error.code === 'EEXIST') {
      return sendJson(response, 409, { error: 'The file already exists.' });
    }
    if (error instanceof SyntaxError) {
      return sendJson(response, 400, { error: 'Invalid JSON request.' });
    }
    if (error.message === 'Path is outside the configured workspace.') {
      return sendJson(response, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(response, 500, { error: error.message || 'Internal server error.' });
  }
}

async function resolveCollaborationDocument(projectId, relativePath) {
  const project = await getProject(projectId);
  const normalizedPath = normalizeRelative(relativePath);
  const absolutePath = resolveInside(project.path, normalizedPath);
  const extension = path.extname(absolutePath).toLowerCase();
  if (!textExtensions.has(extension) && extension !== '') {
    throw new Error('This file is not editable as collaborative text.');
  }
  const stat = await fsp.stat(absolutePath);
  if (!stat.isFile()) throw new Error('The collaborative document is not a file.');
  return {
    key: `${project.id}:${normalizedPath}`,
    projectId: project.id,
    path: normalizedPath,
    absolutePath,
    initialContent: await fsp.readFile(absolutePath, 'utf8'),
  };
}

async function saveCollaborationDocument(context, content) {
  await fsp.writeFile(context.absolutePath, content, 'utf8');
}

async function loadCollaborationDocument(context) {
  return fsp.readFile(context.absolutePath, 'utf8');
}

async function createAppServer() {
  await loadProjectRegistry();
  await loadLanSettings();
  await loadServiceSettings();
  await loadProfileSettings();
  const server = http.createServer(requestHandler);
  const collaboration = attachCollaborationServer(server, {
    authenticate: (request, url) => isWorkServiceActive() && isAuthorizedRequest(request, url),
    resolveDocument: resolveCollaborationDocument,
    loadDocument: loadCollaborationDocument,
    saveDocument: saveCollaborationDocument,
  });
  collaborationServer = collaboration;
  server.collaboration = collaboration;
  server.on('close', () => {
    if (collaborationServer === collaboration) collaborationServer = null;
    collaboration.close().catch(() => {});
  });
  return server;
}

async function start() {
  const server = await createAppServer();
  await fsp.writeFile(SERVICE_PID_FILE, `${process.pid}\n`, 'ascii');
  process.once('exit', () => {
    try {
      const recordedPid = Number(fs.readFileSync(SERVICE_PID_FILE, 'utf8').trim());
      if (recordedPid === process.pid) fs.rmSync(SERVICE_PID_FILE, { force: true });
    } catch {
      // The launcher or stop script may already have removed the PID file.
    }
  });

  server.listen(PORT, HOST, () => {
    const compiler = detectCompiler();
    const localUrl = `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`;
    console.log(`LocalTeX is running at ${localUrl}`);
    console.log(`Project registry: ${PROJECTS_FILE}`);
    console.log(`Compiler: ${compiler ? compiler.label : 'not found'}`);
    console.log(`Work service: ${isWorkServiceActive() ? 'active' : 'paused'}`);
    if (NETWORK_CAPABLE) {
      const shareUrls = lanShareUrls();
      console.log(`LAN sharing is ${isLanSharingEnabled() ? 'enabled' : 'disabled'}.`);
      for (const shareUrl of shareUrls) console.log(`Share URL: ${shareUrl}`);
    }

    if (process.env.LOCAL_TEX_OPEN_BROWSER === '1') {
      const opener = process.platform === 'win32'
        ? { command: 'cmd.exe', args: ['/c', 'start', '', localUrl] }
        : process.platform === 'darwin'
          ? { command: 'open', args: [localUrl] }
          : { command: 'xdg-open', args: [localUrl] };
      const child = spawn(opener.command, opener.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    }
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { createAppServer };
