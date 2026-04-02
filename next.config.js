/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['bullmq', 'ioredis'],
  allowedDevOrigins: ['292f-2401-4900-1cba-ec17-d1b0-2c7-ba5f-8562.ngrok-free.app'],
};

module.exports = nextConfig;
