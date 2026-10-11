const jwt = require('jsonwebtoken');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
