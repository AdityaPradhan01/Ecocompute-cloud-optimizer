// Centralized error handling. Full error detail is always logged server-side;
// clients only ever see a generic message (plus the stack in development) —
// stack traces and internal error text must never leak to callers in prod.

function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);

  if (res.headersSent) return;

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error: isDev ? (err.message || 'Internal server error.') : 'Internal server error.',
    ...(isDev && err.stack ? { stack: err.stack } : {})
  });
}

module.exports = { notFound, errorHandler };
