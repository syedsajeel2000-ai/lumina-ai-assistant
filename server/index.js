import { app, prepare } from './app.js';
import { config } from './config.js';

// Connect + migrate + seed before accepting any traffic.
await prepare();

app.listen(config.port, () => {
  console.log(`✦ Lumina API ready on http://localhost:${config.port} (${config.nodeEnv})`);
});
