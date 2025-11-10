const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3001;
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5175',
    ],
    methods: ['GET', 'POST']
  },
  // Allow larger payloads for base64 data URLs when sharing media
  maxHttpBufferSize: 5e7 // 50 MB
});

const whiteboards = new Map(); // roomId -> { actions: Array<stroke|fill> }
const roomMedia = new Map();   // roomId -> { items: Array<{name,type,dataUrl}> }
const roomDocs = new Map();    // roomId -> { text: string }
const roomTranscripts = new Map(); // roomId -> { segments: Array<{ userId, name, text, ts }> }
const roomChats = new Map();   // roomId -> { messages: Array<{ userId, name, text, ts, cid? }> }

const transcriptsDir = path.join(__dirname, 'transcripts');
try { if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true }); } catch {}
 
io.on('connection', (socket) => {
  let joinedRoom = null;
  let user = null;

  socket.on('room:join', ({ roomId, userId, name, avatar }) => {
    joinedRoom = roomId;
    user = { id: userId, name, avatar };
    socket.join(roomId);
    socket.to(roomId).emit('presence:join', user);

    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const members = clients
      .map((id) => io.sockets.sockets.get(id))
      .filter(Boolean)
      .map((s) => s.data.user)
      .filter(Boolean);

    socket.emit('presence:roster', members);
    socket.data.user = user;
    if (!whiteboards.has(roomId)) whiteboards.set(roomId, { actions: [] });
    if (!roomMedia.has(roomId)) roomMedia.set(roomId, { items: [] });
    if (!roomChats.has(roomId)) roomChats.set(roomId, { messages: [] });
  });

  // Transcript: collect final STT segments per room and broadcast
  socket.on('stt:segment', (payload) => {
    if (!joinedRoom || !payload || typeof payload.text !== 'string' || !payload.text.trim()) return;
    const entry = { userId: user?.id, name: user?.name || 'Guest', text: payload.text.trim(), ts: Date.now() };
    const bag = roomTranscripts.get(joinedRoom) || { segments: [] };
    bag.segments.push(entry);
    roomTranscripts.set(joinedRoom, bag);
    io.to(joinedRoom).emit('stt:segment', entry);
  });
  socket.on('stt:requestState', () => {
    if (!joinedRoom) return;
    const bag = roomTranscripts.get(joinedRoom) || { segments: [] };
    socket.emit('stt:state', bag);
  });
  socket.on('stt:summary', () => {
    if (!joinedRoom) return;
    const bag = roomTranscripts.get(joinedRoom) || { segments: [] };
    const all = bag.segments.map(s=>s.text).join(' ');
    if (!all.trim()) { socket.emit('stt:summary', { summary: '' }); return; }
    try {
      const sentences = all.split(/(?<=[.!?])\s+/).slice(0, 80);
      const words = all.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const stop = new Set(['the','and','a','an','to','of','in','is','it','that','for','on','with','as','are','was','be','this','you','i']);
      const freq = new Map();
      for (const w of words) { if (!stop.has(w)) freq.set(w, (freq.get(w)||0)+1); }
      const scored = sentences.map((s) => {
        const sw = s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
        const score = sw.reduce((sum, w) => sum + (freq.get(w)||0), 0) / Math.sqrt(sw.length || 1);
        return { s, score };
      });
      scored.sort((a,b)=> b.score - a.score);
      const top = scored.slice(0, Math.max(2, Math.min(6, Math.ceil(scored.length/3))))
                        .map(x=>x.s.trim()).join(' ');
      socket.emit('stt:summary', { summary: top });
    } catch {
      socket.emit('stt:summary', { summary: '' });
    }
  });

  function findSocketIdByUserId(roomId, targetUserId) {
    const clientIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    for (const sid of clientIds) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.data && s.data.user && s.data.user.id === targetUserId) {
        return sid;
      }
    }
    return null;
  }

  socket.on('webrtc:signal', (payload) => {
    if (!joinedRoom || !user) return;
    const { to, from, data } = payload || {};
    const targetSid = findSocketIdByUserId(joinedRoom, to);
    if (targetSid) {
      io.to(targetSid).emit('webrtc:signal', { from: from || user.id, data });
    }
  });

  socket.on('avatar:pose', (payload) => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit('avatar:pose', payload);
  });

  socket.on('avatar:update', (payload) => {
    if (!joinedRoom || !user) return;
    const { avatar } = payload || {};
    if (!avatar) return;
    user.avatar = avatar;
    socket.data.user = user;
    io.to(joinedRoom).emit('presence:update', user);
  });

  socket.on('cursor:pos', (payload) => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit('cursor:pos', payload);
  });

  socket.on('whiteboard:stroke', (payload) => {
    if (!joinedRoom) return;
    const board = whiteboards.get(joinedRoom) || { actions: [] };
    if (payload && Array.isArray(payload.points)) {
      const act = { type: 'stroke', tool: payload.tool || 'pencil', color: payload.color, size: payload.size, points: payload.points };
      board.actions.push(act);
      whiteboards.set(joinedRoom, board);
      socket.to(joinedRoom).emit('whiteboard:stroke', act);
    }
  });

  socket.on('whiteboard:fill', (payload) => {
    if (!joinedRoom) return;
    const board = whiteboards.get(joinedRoom) || { actions: [] };
    if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
      const act = { type: 'fill', color: payload.color, x: payload.x, y: payload.y };
      board.actions.push(act);
      whiteboards.set(joinedRoom, board);
      socket.to(joinedRoom).emit('whiteboard:fill', act);
    }
  });

  socket.on('whiteboard:clear', () => {
    if (!joinedRoom) return;
    whiteboards.set(joinedRoom, { actions: [] });
    io.to(joinedRoom).emit('whiteboard:clear');
  });

  socket.on('whiteboard:requestState', () => {
    if (!joinedRoom) return;
    const board = whiteboards.get(joinedRoom) || { actions: [] };
    socket.emit('whiteboard:state', board);
  });

  // Collaborative document editing: simple last-write-wins text sync
  socket.on('doc:requestState', () => {
    if (!joinedRoom) return;
    const doc = roomDocs.get(joinedRoom) || { text: '' };
    socket.emit('doc:state', doc);
  });
  socket.on('doc:update', (payload) => {
    if (!joinedRoom || !payload || typeof payload.text !== 'string') return;
    const current = roomDocs.get(joinedRoom) || { text: '' };
    current.text = payload.text;
    roomDocs.set(joinedRoom, current);
    socket.to(joinedRoom).emit('doc:update', { text: current.text });
  });

  // AI meeting summarization: lightweight extractive summary
  socket.on('ai:summarize', (payload) => {
    if (!payload || typeof payload.text !== 'string') return;
    const text = payload.text.trim();
    if (!text) { socket.emit('ai:summary', { summary: '' }); return; }
    try {
      const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 30);
      const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const stop = new Set(['the','and','a','an','to','of','in','is','it','that','for','on','with','as','are','was','be']);
      const freq = new Map();
      for (const w of words) { if (!stop.has(w)) freq.set(w, (freq.get(w)||0)+1); }
      const scored = sentences.map((s) => {
        const sw = s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
        const score = sw.reduce((sum, w) => sum + (freq.get(w)||0), 0) / Math.sqrt(sw.length || 1);
        return { s, score };
      });
      scored.sort((a,b)=> b.score - a.score);
      const top = scored.slice(0, Math.max(2, Math.min(5, Math.ceil(scored.length/3))))
                        .map(x=>x.s.trim()).join(' ');
      socket.emit('ai:summary', { summary: top });
    } catch {
      socket.emit('ai:summary', { summary: '' });
    } 
  });

  // Media sharing: broadcast newly added files as data URLs to the room
  socket.on('media:add', (payload) => {
    if (!joinedRoom) return;
    const items = (payload && Array.isArray(payload.items)) ? payload.items : [];
    if (!items.length) return;
    const stash = roomMedia.get(joinedRoom) || { items: [] };
    stash.items.push(...items);
    roomMedia.set(joinedRoom, stash);
    socket.to(joinedRoom).emit('media:add', { items });
  });

  socket.on('media:requestState', () => {
    if (!joinedRoom) return;
    const stash = roomMedia.get(joinedRoom) || { items: [] };
    socket.emit('media:state', stash);
  });

  socket.on('chat:message', (payload) => {
    if (!joinedRoom || !payload || typeof payload.text !== 'string') return;
    const msg = {
      userId: user?.id,
      name: user?.name || 'Guest',
      text: payload.text,
      ts: Date.now(),
      cid: payload.cid,
    };
    try {
      const chat = roomChats.get(joinedRoom) || { messages: [] };
      chat.messages.push({ userId: msg.userId, name: msg.name, text: msg.text, ts: msg.ts, cid: msg.cid });
      roomChats.set(joinedRoom, chat);
    } catch {}
    io.to(joinedRoom).emit('chat:message', msg);
  });

  // Compile and persist transcript when a client ends the meeting
  socket.on('meeting:end', () => {
    if (!joinedRoom) return;
    try {
      const rid = joinedRoom;
      const stt = roomTranscripts.get(rid) || { segments: [] };
      const chat = roomChats.get(rid) || { messages: [] };
      const combined = [];
      for (const s of (stt.segments || [])) combined.push({ kind: 'voice', userId: s.userId, name: s.name, text: s.text, ts: s.ts });
      for (const m of (chat.messages || [])) combined.push({ kind: 'chat', userId: m.userId, name: m.name, text: m.text, ts: m.ts });
      combined.sort((a,b)=> (a.ts||0)-(b.ts||0));
      const participantsMap = new Map();
      for (const ev of combined) { if (ev.userId) participantsMap.set(ev.userId, ev.name || 'Guest'); }
      const participants = Array.from(participantsMap.entries()).map(([id,name])=>({ id, name }));
      const startedAt = combined.length ? combined[0].ts : Date.now();
      const endedAt = Date.now();
      const transcriptText = combined.map(ev => {
        const t = new Date(ev.ts).toISOString();
        return `[${t}] ${ev.name}: ${ev.text}`;
      }).join('\n');
      const payload = { roomId: rid, startedAt, endedAt, participants, events: combined, transcriptText };
      const fname = `${rid}-${endedAt}.json`;
      const fpath = path.join(transcriptsDir, fname);
      try { fs.writeFileSync(fpath, JSON.stringify(payload, null, 2), 'utf8'); } catch {}
      socket.emit('transcript:ready', { roomId: rid, file: fname, ok: true, transcriptText });
    } catch {
      socket.emit('transcript:ready', { roomId: joinedRoom, ok: false });
    }
  });

  // Retrieve a list of saved transcripts for a room
  socket.on('transcript:list', ({ roomId }) => {
    try {
      const files = fs.readdirSync(transcriptsDir).filter(f => f.startsWith(`${roomId}-`) && f.endsWith('.json'));
      files.sort();
      socket.emit('transcript:list', { roomId, files });
    } catch { socket.emit('transcript:list', { roomId, files: [] }); }
  });

  // Fetch a specific saved transcript file
  socket.on('transcript:get', ({ roomId, file }) => {
    try {
      if (!file || !file.startsWith(`${roomId}-`) || !file.endsWith('.json')) { socket.emit('transcript:get', { roomId, error: 'bad_file' }); return; }
      const fpath = path.join(transcriptsDir, file);
      const raw = fs.readFileSync(fpath, 'utf8');
      const data = JSON.parse(raw);
      socket.emit('transcript:get', { roomId, file, data });
    } catch { socket.emit('transcript:get', { roomId, file, error: 'not_found' }); }
  });

  socket.on('disconnect', () => {
    if (joinedRoom && user) {
      socket.to(joinedRoom).emit('presence:leave', user);
    }
  });
});

server.listen(PORT, () => {
  console.log(`socket.io server listening on http://localhost:${PORT}`);
});
 
