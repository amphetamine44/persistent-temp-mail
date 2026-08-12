import mongoose from 'mongoose';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.log('[mongo] MONGODB_URI not set — skipping');
      return null;
    }
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    const connectionInstance = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    return connectionInstance;
  } catch (error) {
    console.log('MONGODB connection error FAILED ', error);
    if (isServerless) throw error;
    process.exit(1);
  }
};

export default connectDB;
