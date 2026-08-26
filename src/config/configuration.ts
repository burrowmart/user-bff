export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  cognito: {
    issuer: process.env.COGNITO_ISSUER ?? '',
    audience: process.env.COGNITO_AUDIENCE ?? '',
  },
  userServiceUrl: process.env.USER_SERVICE_URL ?? 'http://localhost:3001',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3005',
});
