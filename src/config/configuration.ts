export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  userServiceUrl: process.env.USER_SERVICE_URL ?? 'http://localhost:3001',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3005',
});
