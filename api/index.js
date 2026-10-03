/*
 * Vercel serverless entry point.
 *
 * Vercel runs each `api/*.js` file as a Node function, so the app must be
 * exported as a handler rather than started with `app.listen()`. `prepare()`
 * connects + migrates + seeds the database once per cold start.
 */
import { app, prepare } from '../server/app.js';

let ready;
const initOnce = () => (ready ??= prepare());

// Vercel drains an idle connection on an Express response, which can truncate
// SSE streams. Keep the socket open between chunks so chat replies stream live.
const handler = async (req, res) => {
  await initOnce();
  req.socket?.setTimeout(0);
  req.socket?.setNoDelay?.(true);
  req.socket?.setKeepAlive?.(true);
  return app(req, res);
};

export default handler;
export const config = { maxDuration: 300 };
