/**
 * Swagger / OpenAPI configuration placeholder.
 * Install swagger-jsdoc and swagger-ui-express to activate.
 *
 * npm install swagger-jsdoc swagger-ui-express
 */

export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeSave – SDEC API',
      version: '1.0.0',
      description: 'Smart Disaster & Emergency Controller – REST API Documentation',
    },
    servers: [
      { url: 'http://localhost:5000/api', description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.js', './src/routes/*.js'],
};

export default swaggerOptions;
