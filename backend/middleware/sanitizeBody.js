// Strips Mongo operator keys ($gt, $where, ...) and dotted paths out of
// req.body before any controller sees it — defense-in-depth against NoSQL
// injection, on top of the per-field validation each controller already
// does. Not every library's version of this exists: express-mongo-sanitize
// (the usual choice) reassigns req.query, which Express 5 made a
// getter-only property — it throws a TypeError on every single request
// (verified directly against this app's installed Express version before
// writing this). Scoped to req.body only, which is where it matters here:
// no route in this app filters a DB query by req.query, and req.params
// values are always plain strings from Express's own router, never
// attacker-shaped objects.
const PROHIBITED_KEY = /^\$|\./;

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const key of Object.keys(value)) {
      if (PROHIBITED_KEY.test(key)) continue; // drop it — never remapped, never recursed into
      clean[key] = sanitize(value[key]);
    }
    return clean;
  }
  return value;
}

module.exports = function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  next();
};
