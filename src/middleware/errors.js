import mongoose from 'mongoose';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// Every error leaves as { error: "readable message" }, which the admin shows as-is.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });

  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first?.message || 'Some fields are invalid.' });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ error: 'Not found.' });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ error: `That ${field} is already used. Choose another.` });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  if (err?.type?.startsWith?.('Stripe')) {
    return res.status(402).json({ error: `Stripe: ${err.message}` });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Check the backend logs.' });
}
