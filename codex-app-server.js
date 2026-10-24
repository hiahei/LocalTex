const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REQUEST_TIMEOUT_MS = 30_000;
const NOTIFICATION_TIMEOUT_MS = 120_000;
const MAX_STDOUT_BUFFER = 16 * 1024 * 1024;
const MAX_STDERR_BUFFER = 12_000;

function codexCliScript() {
  return path.join(
    __dirname,
    'node_modules',
    '@openai',
    'codex',
    'bin',
    'codex.js',
  );
}

function rpcErrorMessage(error, fallback = 'Codex 历史服务请求失败。') {
  return String(error?.message || error?.data?.message || fallback)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[已隐藏的凭据]')
    .replace(/CODEX_API_KEY=[^\s]+/gi, 'CODEX_API_KEY=[已隐藏]');
}

class CodexAppServerClient {
  constructor() {
    this.child = null;
    this.startPromise = null;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.notificationWaiters = new Set();
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.closing = false;
  }

  async ensureStarted() {
    if (this.child && !this.child.killed && this.child.exitCode === null) return;
    if (!this.startPromise) {
      this.startPromise = this.launch().finally(() => {
        this.startPromise = null;
      });
    }
    await this.startPromise;
  }

  async launch() {
    const cliScript = codexCliScript();
    if (!fs.existsSync(cliScript)) {
      throw new Error('未找到随 LocalTeX 安装的 Codex CLI。');
    }

    this.closing = false;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    const child = spawn(process.execPath, [cliScript, 'app-server'], {
      cwd: __dirname,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.handleStdout(child, chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-MAX_STDERR_BUFFER);
    });
    child.once('error', (error) => this.handleExit(child, error));
    child.once('exit', (code, signal) => {
      const detail = this.closing
        ? 'Codex 历史服务已关闭。'
        : `Codex 历史服务意外退出（${signal || (code ?? 'unknown')}）。`;
      this.handleExit(child, new Error(detail));
    });

    await this.rawRequest('initialize', {
      clientInfo: {
        name: 'localtex',
        title: 'LocalTeX',
        version: '0.1.0',
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });
    this.notify('initialized', {});
  }

  handleStdout(child, chunk) {
    if (this.child !== child) return;
    this.stdoutBuffer += chunk;
    if (this.stdoutBuffer.length > MAX_STDOUT_BUFFER) {
      this.handleExit(child, new Error('Codex 历史服务返回的数据过大。'));
      child.kill();
      return;
    }

    while (true) {
      const newline = this.stdoutBuffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      this.handleMessage(child, line);
    }
  }

  handleMessage(child, line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const pending = this.pending.get(String(message.id));
      if (!pending) return;
      this.pending.delete(String(message.id));
      clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new Error(rpcErrorMessage(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      this.write(child, {
        id: message.id,
        error: { code: -32601, message: 'LocalTeX does not handle this server request.' },
      });
      return;
    }

    if (message.id === undefined && message.method) {
      for (const waiter of [...this.notificationWaiters]) {
        let matches = false;
        try {
          matches = waiter.predicate(message);
        } catch (error) {
          waiter.reject(error);
          continue;
        }
        if (matches) waiter.resolve(message);
      }
    }
  }

  waitForNotification(predicate, timeoutMs = NOTIFICATION_TIMEOUT_MS) {
    let waiter;
    let settled = false;
    let resolvePromise;
    let rejectPromise;
    const cleanup = () => {
      if (!waiter) return;
      clearTimeout(waiter.timeout);
      this.notificationWaiters.delete(waiter);
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    waiter = {
      predicate,
      resolve: (message) => settle(resolvePromise, message),
      reject: (error) => settle(rejectPromise, error),
      timeout: setTimeout(() => {
        settle(rejectPromise, new Error('等待 Codex 压缩上下文超时。'));
      }, Math.max(1_000, Number(timeoutMs) || NOTIFICATION_TIMEOUT_MS)),
    };
    this.notificationWaiters.add(waiter);
    promise.cancel = () => settle(resolvePromise, null);
    return promise;
  }

  handleExit(child, error) {
    if (this.child !== child) return;
    this.child = null;
    const detail = this.stderrBuffer.trim();
    const message = detail && !this.closing
      ? `${rpcErrorMessage(error)} ${rpcErrorMessage(detail)}`
      : rpcErrorMessage(error);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    this.pending.clear();
    for (const waiter of [...this.notificationWaiters]) waiter.reject(new Error(message));
    this.notificationWaiters.clear();
  }

  write(child, message) {
    if (!child || child.killed || child.exitCode !== null || !child.stdin.writable) {
      throw new Error('Codex 历史服务当前不可用。');
    }
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  rawRequest(method, params = {}) {
    const child = this.child;
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(String(id));
        reject(new Error(`Codex 历史服务请求超时：${method}`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(String(id), { resolve, reject, timeout });
      try {
        this.write(child, { method, id, params });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(String(id));
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.write(this.child, { method, params });
  }

  async request(method, params = {}) {
    await this.ensureStarted();
    return this.rawRequest(method, params);
  }

  close() {
    this.closing = true;
    const child = this.child;
    this.child = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Codex 历史服务已关闭。'));
    }
    this.pending.clear();
    for (const waiter of [...this.notificationWaiters]) {
      waiter.reject(new Error('Codex 历史服务已关闭。'));
    }
    this.notificationWaiters.clear();
    if (child && !child.killed && child.exitCode === null) child.kill();
  }
}

function createCodexAppServerClient() {
  return new CodexAppServerClient();
}

module.exports = {
  createCodexAppServerClient,
};
