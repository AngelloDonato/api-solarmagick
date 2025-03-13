/******************************************************
 * middleware/errorMiddleware.js
 * Manejo de errores centralizado
 ******************************************************/
function errorMiddleware(err, req, res, next) {
  console.error('Middleware de error captó:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
}

module.exports = {
  errorMiddleware
};
