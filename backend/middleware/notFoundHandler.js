/**
 * Centralized 404 Not Found Middleware
 * Intercepts requests that do not match any defined routes.
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Endpoint '${req.method} ${req.originalUrl}' not found on EXACTSPARE API.`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/health/db'
    ]
  });
};

export default notFoundHandler;
