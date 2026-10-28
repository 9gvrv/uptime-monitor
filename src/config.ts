import dotenv from 'dotenv';
dotenv.config()

const config = {
  app_name: process.env.APP_NAME,
  app_version: process.env.APP_VERSION,
  database_url: process.env.DATABASE_URL
}

export default config;
