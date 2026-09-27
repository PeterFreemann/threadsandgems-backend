import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/errors.js';
import { cloudinary, cloudinaryReady } from '../../config/cloudinary.js';
import { env } from '../../config/env.js';

const router = Router();

// Signs a direct browser-to-Cloudinary upload. The API secret never leaves the server.
router.post('/sign', requirePermission('products:edit'), (req, res) => {
  if (!cloudinaryReady) throw new HttpError(503, 'Photo uploads are not set up yet. Add the Cloudinary keys to the backend.');
  const timestamp = Math.round(Date.now() / 1000);
  const folder = env.CLOUDINARY_FOLDER;
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.CLOUDINARY_API_SECRET);
  res.json({ timestamp, signature, folder, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME });
});

export default router;
