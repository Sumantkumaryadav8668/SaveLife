import 'dotenv/config';

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rapidaid',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'rapidaid_jwt_access_secret_key_12345',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'rapidaid_jwt_refresh_secret_key_67890',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // Redis (optional)
  REDIS_URL: process.env.REDIS_URL || '',
};

export default env;
