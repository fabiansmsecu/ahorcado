import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// --- ESTADO GLOBAL DEL JUEGO Y ESTADÍSTICAS (SALON DE CLASES) ---
// Now supports multiple concurrent rooms!
const activeRooms: Record<string, any> = {};

let classStats = {
  players: {} as Record<string, { name: string, score: number, gamesPlayed: number }>,
  failedWords: {} as Record<string, number>,
  totalGames: 0,
  totalWins: 0
};

const TEACHER_PIN = process.env.TEACHER_PIN || "profe123";

app.post("/api/verify-pin", (req, res) => {
  if (req.body.pin === TEACHER_PIN) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: "PIN incorrecto" });
  }
});

// Obtener el estado actual (para estudiantes y profesores)
app.get("/api/game-state", (req, res) => {
  const roomPin = req.query.roomPin as string;
  if (roomPin && activeRooms[roomPin]) {
    res.json(activeRooms[roomPin]);
  } else {
    // Si no hay sala, devolvemos un estado inactivo genérico
    res.json({ isActive: false, isPlaying: false, roomPin: '', mode: 'infantil', customWords: null, sessionId: '', joinedStudents: [], gameEndTime: null });
  }
});

// Update the game state API
app.post("/api/game-state", (req, res) => {
  const { pin, mode, customWords, isActive, isPlaying, roomPin, forceRestart, gameEndTime } = req.body;
  if (pin !== TEACHER_PIN) {
    return res.status(403).json({ error: "PIN incorrecto" });
  }

  // If we are destroying a room
  if (isActive === false && activeRooms[roomPin]) {
    delete activeRooms[roomPin];
    return res.json({ success: true, state: { isActive: false, roomPin: '' } });
  }

  if (!activeRooms[roomPin]) {
    // Create new room
    activeRooms[roomPin] = {
      isActive: true,
      isPlaying: isPlaying || false,
      roomPin: roomPin,
      mode: mode || 'infantil',
      customWords: customWords || null,
      sessionId: Date.now().toString(),
      joinedStudents: [],
      gameEndTime: gameEndTime || null
    };
  } else {
    // Update existing room
    const currentRoom = activeRooms[roomPin];
    const newSessionId = forceRestart ? Date.now().toString() : currentRoom.sessionId;
    
    currentRoom.isActive = isActive !== undefined ? isActive : currentRoom.isActive;
    currentRoom.isPlaying = isPlaying !== undefined ? isPlaying : currentRoom.isPlaying;
    currentRoom.mode = mode !== undefined ? mode : currentRoom.mode;
    currentRoom.customWords = customWords !== undefined ? customWords : currentRoom.customWords;
    currentRoom.sessionId = newSessionId;
    currentRoom.joinedStudents = forceRestart ? [] : currentRoom.joinedStudents;
    currentRoom.gameEndTime = gameEndTime !== undefined ? gameEndTime : currentRoom.gameEndTime;
  }
  
  res.json({ success: true, state: activeRooms[roomPin] });
});

// Register student in lobby
app.post("/api/join-lobby", (req, res) => {
  const { name, roomPin } = req.body;
  const room = activeRooms[roomPin];
  if (room && room.isActive) {
     if (!room.joinedStudents.includes(name)) {
        room.joinedStudents.push(name);
     }
     res.json({ success: true });
  } else {
     res.status(400).json({ error: "PIN de sala inválido o sala cerrada" });
  }
});

// Guardar resultados de una partida (estudiantes)
app.post("/api/stats", (req, res) => {
  const { uid, name, won, word, score } = req.body;
  
  if (uid && name) {
    if (!classStats.players[uid]) {
      classStats.players[uid] = { name, score: 0, gamesPlayed: 0 };
    }
    classStats.players[uid].gamesPlayed += 1;
    classStats.players[uid].score += score || 0;
    // Keep name updated
    classStats.players[uid].name = name;
  }

  classStats.totalGames += 1;
  if (won) {
    classStats.totalWins += 1;
  } else if (word) {
    classStats.failedWords[word] = (classStats.failedWords[word] || 0) + 1;
  }

  res.json({ success: true });
});

// Obtener estadísticas (solo profesor)
app.get("/api/stats", (req, res) => {
  const pin = req.query.pin;
  if (pin !== TEACHER_PIN) {
    console.log("Teacher pin mismatch in GET /api/stats. Expected:", TEACHER_PIN, "Got:", pin);
    return res.status(403).json({ error: "PIN incorrecto" });
  }
  res.json(classStats);
});

// Reiniciar estadísticas (solo profesor)
app.post("/api/stats/reset", (req, res) => {
  const { pin } = req.body;
  if (pin !== TEACHER_PIN) {
    return res.status(403).json({ error: "PIN incorrecto" });
  }
  classStats = {
    players: {},
    failedWords: {},
    totalGames: 0,
    totalWins: 0
  };
  res.json({ success: true });
});
// ------------------------------------------------

app.post("/api/generate-keywords", async (req, res) => {
  try {
    const { promptInstructions } = req.body;
    
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptInstructions,
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("GenAI Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate text" });
  }
});

app.post("/api/generate-word", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("GenAI Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate text" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
