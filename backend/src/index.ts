import express from "express";
import { createServer } from "http";
import authRouter from "./controllers/auth/index.js";
import workspace from "./controllers/workspace/index.js";
import channel from "./controllers/channel/index.js";
import invite from "./controllers/invite/index.js";
import mssg from "./controllers/message/index.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import { setupWebSocket } from "./controllers/ws/channel/index.js";  // ← Import WebSocket setup
import cors from "cors";

const app = express();
const PORT = process.env.API_PORT || 4000;

// Create HTTP server (instead of app.listen)
const server = createServer(app);

// Setup WebSocket
const wss = setupWebSocket(server);  // ← Setup WebSocket here

// Express middleware
app.use(express.json());
app.use(cors({ origin: "*" }));

// Your existing routes
app.use("/auth", authRouter);
app.use("/workspace", workspace);
app.use("/channel", channel);
app.use("/invite",invite);
app.use("/message",mssg);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    websocket: {
      clients: wss.clients.size
    }
  });
});

app.use(globalErrorHandler);

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ HTTP API: http://localhost:${PORT}`);
  console.log(`✅ WebSocket: ws://localhost:${PORT}/ws/c`);
});