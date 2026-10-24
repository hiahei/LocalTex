const { WebSocket, WebSocketServer } = require('ws');
const Y = require('yjs');

const INITIAL_LOAD = Symbol('initial-load');
const EXTERNAL_LOAD = Symbol('external-load');
const ROOM_RETENTION_MS = 60_000;
const SAVE_DEBOUNCE_MS = 350;
const DISK_SYNC_INTERVAL_MS = 500;

function send(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function rejectUpgrade(socket, statusCode, message) {
  const body = String(message || 'Connection rejected.');
  socket.write([
    `HTTP/1.1 ${statusCode} ${statusCode === 401 ? 'Unauthorized' : 'Bad Request'}`,
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n'));
  socket.destroy();
}

function safeUser(value = {}) {
  return {
    id: String(value.id || '').slice(0, 80),
    name: String(value.name || '协作者').trim().slice(0, 32) || '协作者',
    color: Math.max(0, Math.min(7, Number(value.color) || 0)),
  };
}

function roomPresence(room) {
  return [...room.clients]
    .filter((socket) => socket.user)
    .map((socket) => socket.user);
}

function broadcast(room, message, except = null) {
  for (const client of room.clients) {
    if (client !== except) send(client, message);
  }
}

function broadcastPresence(room) {
  broadcast(room, { type: 'presence', users: roomPresence(room) });
}

function attachCollaborationServer(server, {
  authenticate,
  resolveDocument,
  loadDocument,
  saveDocument,
  endpoint = '/collaboration',
}) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
  const rooms = new Map();
  const pendingRooms = new Map();
  let closed = false;

  function replaceRoomText(room, content, origin) {
    if (room.text.toString() === content) return false;
    room.document.transact(() => {
      if (room.text.length > 0) room.text.delete(0, room.text.length);
      if (content) room.text.insert(0, content);
    }, origin);
    return true;
  }

  async function persistRoom(room) {
    clearTimeout(room.saveTimer);
    room.saveTimer = null;
    const content = room.text.toString();
    room.pendingSaves += 1;
    room.saving = room.saving
      .then(() => saveDocument(room.context, content))
      .then(() => {
        if (room.text.toString() !== content) return;
        room.dirty = false;
        broadcast(room, { type: 'saved' });
      })
      .catch((error) => broadcast(room, {
        type: 'save-error',
        message: error.message || '协作文档保存失败。',
      }))
      .finally(() => {
        room.pendingSaves -= 1;
      });
    return room.saving;
  }

  async function syncRoomFromDisk(room) {
    if (
      !loadDocument
      || room.destroyed
      || room.diskSyncing
      || room.dirty
      || room.saveTimer
      || room.pendingSaves > 0
    ) return false;

    room.diskSyncing = Promise.resolve(loadDocument(room.context))
      .then((content) => {
        if (
          room.destroyed
          || room.dirty
          || room.saveTimer
          || room.pendingSaves > 0
        ) return false;
        const changed = replaceRoomText(room, content, EXTERNAL_LOAD);
        if (changed) broadcast(room, { type: 'disk-synced' });
        return changed;
      })
      .catch((error) => {
        if (error?.code !== 'ENOENT') {
          broadcast(room, {
            type: 'save-error',
            message: error.message || '无法读取本地文档。',
          });
        }
        return false;
      })
      .finally(() => {
        room.diskSyncing = null;
      });
    return room.diskSyncing;
  }

  async function destroyRoom(room) {
    clearTimeout(room.cleanupTimer);
    clearTimeout(room.saveTimer);
    clearInterval(room.diskSyncTimer);
    room.cleanupTimer = null;
    room.saveTimer = null;
    room.destroyed = true;
    if (room.dirty) await persistRoom(room);
    else await room.saving.catch(() => {});
    room.document.destroy();
    rooms.delete(room.key);
  }

  async function createRoom(context) {
    const document = new Y.Doc();
    const text = document.getText('content');
    if (context.initialContent) {
      document.transact(() => text.insert(0, context.initialContent), INITIAL_LOAD);
    }

    const room = {
      key: context.key,
      context,
      document,
      text,
      clients: new Set(),
      cleanupTimer: null,
      saveTimer: null,
      saving: Promise.resolve(),
      pendingSaves: 0,
      diskSyncTimer: null,
      diskSyncing: null,
      dirty: false,
      destroyed: false,
    };

    document.on('update', (update, origin) => {
      broadcast(room, {
        type: 'update',
        update: Buffer.from(update).toString('base64'),
      }, origin instanceof WebSocket ? origin : null);

      if (origin === INITIAL_LOAD || origin === EXTERNAL_LOAD) return;
      room.dirty = true;
      clearTimeout(room.saveTimer);
      room.saveTimer = setTimeout(() => persistRoom(room), SAVE_DEBOUNCE_MS);
    });

    if (loadDocument) {
      room.diskSyncTimer = setInterval(() => syncRoomFromDisk(room), DISK_SYNC_INTERVAL_MS);
      room.diskSyncTimer.unref?.();
    }
    rooms.set(context.key, room);
    return room;
  }

  async function getRoom(context) {
    const existing = rooms.get(context.key);
    if (existing) {
      await syncRoomFromDisk(existing);
      return existing;
    }
    if (!pendingRooms.has(context.key)) {
      pendingRooms.set(context.key, createRoom(context).finally(() => pendingRooms.delete(context.key)));
    }
    return pendingRooms.get(context.key);
  }

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname !== endpoint) {
      rejectUpgrade(socket, 400, 'Unknown WebSocket endpoint.');
      return;
    }
    if (!authenticate(request, url)) {
      rejectUpgrade(socket, 401, 'A valid LocalTeX access token is required.');
      return;
    }

    const projectId = String(url.searchParams.get('project') || '');
    const filePath = String(url.searchParams.get('path') || '');
    if (!projectId || !filePath) {
      rejectUpgrade(socket, 400, 'A project and file path are required.');
      return;
    }

    Promise.resolve(resolveDocument(projectId, filePath))
      .then(getRoom)
      .then((room) => {
        webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
          webSocket.room = room;
          webSocketServer.emit('connection', webSocket, request);
        });
      })
      .catch((error) => rejectUpgrade(socket, 400, error.message || 'Could not open the document.'));
  });

  webSocketServer.on('connection', (socket) => {
    const room = socket.room;
    clearTimeout(room.cleanupTimer);
    room.clients.add(socket);
    // Protocol and payload errors belong to this connection. Handling the
    // event prevents an oversized or malformed client message from bringing
    // down the entire LocalTeX host process.
    socket.on('error', () => {});
    send(socket, {
      type: 'sync',
      update: Buffer.from(Y.encodeStateAsUpdate(room.document)).toString('base64'),
    });
    broadcastPresence(room);

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString('utf8'));
      } catch {
        send(socket, { type: 'error', message: 'Invalid collaboration message.' });
        return;
      }

      if (message.type === 'update' && typeof message.update === 'string') {
        try {
          Y.applyUpdate(room.document, Buffer.from(message.update, 'base64'), socket);
        } catch {
          send(socket, { type: 'error', message: 'Invalid document update.' });
        }
        return;
      }

      if (message.type === 'presence') {
        socket.user = safeUser(message.user);
        broadcastPresence(room);
        return;
      }

      if (message.type === 'cursor' && socket.user) {
        broadcast(room, {
          type: 'cursor',
          user: socket.user,
          cursor: message.cursor || null,
        }, socket);
      }
    });

    socket.on('close', () => {
      room.clients.delete(socket);
      broadcastPresence(room);
      if (room.clients.size > 0) return;
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = setTimeout(async () => {
        if (room.clients.size > 0) return;
        await destroyRoom(room);
      }, ROOM_RETENTION_MS);
    });
  });

  return {
    roomCount: () => rooms.size,
    disconnectAll: (code = 4001, reason = 'LAN sharing was disabled by the host.') => {
      const safeReason = String(reason).slice(0, 60);
      for (const room of rooms.values()) {
        for (const client of room.clients) client.close(code, safeReason);
      }
    },
    close: async () => {
      if (closed) return;
      closed = true;
      for (const room of rooms.values()) {
        for (const client of room.clients) client.close();
        await destroyRoom(room);
      }
      rooms.clear();
      webSocketServer.close();
    },
  };
}

module.exports = { attachCollaborationServer };
