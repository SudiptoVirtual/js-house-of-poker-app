const path = require('path');

const backendRoot = path.resolve(__dirname, '../..');

module.exports = {
  apps: [
    {
      name: 'poker-backend',
      cwd: backendRoot,
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5000,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'https://www.jshouseofpoker.com',
      },
    },
  ],
};
