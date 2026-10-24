const { WebSocket, WebSocketServer } = require('ws');
const Y = require('yjs');

const INITIAL_LOAD = Symbol('initial-load');
const ROOM_RETENTION_MS = 60_000;
const SAVE_DEBOUNCE_MS = 350;

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
  saveDocument,
  endpoint = '/collaboration',
}) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
  const rooms = new Map();
  const pendingRooms = new Map();
  let closed = false;

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
    };

    document.on('update', (update, origin) => {
      broadcast(room, {
        type: 'update',
        update: Buffer.from(update).toString('base64'),
      }, origin instanceof WebSocket ? origin : null);

      if (origin === INITIAL_LOAD) return;
      clearTimeout(room.saveTimer);
      room.saveTimer = setTimeout(() => {
        const content = text.toString();
        room.saving = room.saving
          .then(() => saveDocument(room.context, content))
          .then(() => broadcast(room, { type: 'saved' }))
          .catch((error) => broadcast(room, {
            type: 'save-error',
            message: error.message || '协作文档保存失败。',
          }));
      }, SAVE_DEBOUNCE_MS);
    });

    rooms.set(context.key, room);
    return room;
  }

  async function getRoom(context) {
    const existing = rooms.get(context.key);
    if (existing) return existing;
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
        clearTimeout(room.saveTimer);
        room.saving = room.saving.then(() => saveDocument(room.context, room.text.toString()));
        await room.saving.catch(() => {});
        room.document.destroy();
        rooms.delete(room.key);
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
        clearTimeout(room.cleanupTimer);
        clearTimeout(room.saveTimer);
        for (const client of room.clients) client.close();
        await room.saving.catch(() => {});
        room.document.destroy();
      }
      rooms.clear();
      webSocketServer.close();
    },
  };
}

module.exports = { attachCollaborationServer };
