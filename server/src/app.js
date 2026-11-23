import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from './routes/auth.js';
import { createDeviceRouter } from './routes/device.js';
import { createFacultyRouter } from './routes/faculty.js';
import { createSettingsRouter } from './routes/settings.js';
import { createStudentRouter } from './routes/student.js';
import { isDatabaseDown } from './services/errors.js';

export function createApp({ db, config }) {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    })
  );
  app.use(compression()); // gzip for the API and the built app: much smaller downloads
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // ---- API ------------------------------------------------------------------
  app.get('/api/health', async (req, res) => {
    try {
      await db.ping();
      res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
      console.error('[health]', err.message);
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  app.use('/api/auth', createAuthRouter(db, config));
  app.use('/api/student', createStudentRouter(db, config));
  app.use('/api/device', createDeviceRouter(db, config)); // hardware entry point, see HARDWARE-INTEGRATION.md
  app.use('/api/settings', createSettingsRouter(db, config));
  app.use('/api', createFacultyRouter(db, config));
  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

  // ---- Built React app (after `npm run build`) --------------------------------
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    // Files in /assets have a hash in their name, so they can be cached for a year. index.html must always be re-checked.
    app.use(
      express.static(config.clientDist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  // ---- Errors ---------------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Invalid request.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request too large.' });
    }
    console.error('[server]', err);
    if (isDatabaseDown(err)) {
      return res.status(503).json({ message: 'The database is unavailable right now. Please try again shortly.' });
    }
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  });

  return app;
}
