import mongoose from 'mongoose';

let mongoMemoryServer = null;

const connectDB = async () => {
  const uri = (process.env.MONGODB_URI !== 'undefined' && process.env.MONGODB_URI) || 
              (process.env.MONGO_URI !== 'undefined' && process.env.MONGO_URI) || 
              'mongodb://127.0.0.1:27017/rapidaid';
  
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000 // 4 seconds timeout
    });
    console.log(`MongoDB Connected successfully...`);
    return conn;
  } catch (err) {
    console.warn(`\n[DB FALLBACK] Standard connection failed: ${err.message}`);
    console.log(`[DB FALLBACK] Starting an in-memory MongoDB Server instead...`);
    
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongoMemoryServer = await MongoMemoryServer.create();
      const inMemoryUri = mongoMemoryServer.getUri();
      
      console.log(`[DB FALLBACK] In-Memory MongoDB Server started at: ${inMemoryUri}`);
      
      const conn = await mongoose.connect(inMemoryUri);
      console.log(`[DB FALLBACK] Connected to In-Memory MongoDB: ${conn.connection.host}`);
      return conn;
    } catch (fallbackErr) {
      console.error(`[DB FALLBACK ERROR] Failed to start and connect to in-memory database:`, fallbackErr);
      throw fallbackErr;
    }
  }
};

export default connectDB;
