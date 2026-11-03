import app from './app.js';
import { connectDB } from './config/db.js';

// Pre-warm database connection for serverless cold starts
connectDB().catch((err) => {
  console.error('[MongoDB Startup Error]:', err.message);
});

export default app;
export { app };
