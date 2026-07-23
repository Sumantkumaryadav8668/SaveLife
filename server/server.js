import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './src/config/db.js';
import handleSockets from './src/sockets/index.js';
import app from './src/app.js';
import User from './src/modules/users/user.model.js';
import { seedData } from './src/utils/seed.js';

const startServer = async () => {
  const server = http.createServer(app);

  // ── Socket.io ──
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  try {
    // 1. Connect to MongoDB (with automatic in-memory fallback)
    await connectDB();

    // 2. Auto-seed on first run (empty database)
    const userCount = await User.countDocuments().exec();
    if (userCount === 0) {
      console.log('[AUTO-SEED] Database is empty — seeding default data...');
      await seedData(false);
    }

    // 3. Attach real-time socket handlers
    handleSockets(io);

    // 4. Start HTTP server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`\n🚑  LifeSave – SDEC server running on http://localhost:${PORT}`);
      console.log(`📡  Socket.io ready`);
      console.log(`🌍  Client origin: ${process.env.CLIENT_URL || 'http://localhost:5173'}\n`);
    });
  } catch (error) {
    console.error('[STARTUP ERROR]', error.message);
    process.exit(1);
  }
};

startServer();
