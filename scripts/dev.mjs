// Runs the API server and the web dev server together (Ctrl+C stops both).
import { spawn } from 'node:child_process';

// The API always listens on 8787 in dev; Vite owns 5173 and proxies /api and /socket.io to it.
// (Preview launchers often export PORT for the whole process tree, so it is overridden here.)
const API_PORT = process.env.API_PORT ?? '8787';

const procs = [
  ['server', '@shieldquest/server', '\x1b[34m', { PORT: API_PORT }],
  ['web', '@shieldquest/web', '\x1b[35m', { PORT: '', SHIELDQUEST_SERVER: `http://localhost:${API_PORT}` }],
].map(([name, ws, color, env]) => {
  const child = spawn('npm', ['run', 'dev', '-w', ws], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (buf) => out.write(buf.toString().replace(/^(?=.)/gm, tag)));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${tag}exited with code ${code}`);
    procs.forEach((p) => p !== child && p.kill());
    process.exit(code ?? 0);
  });
  return child;
});

process.on('SIGINT', () => procs.forEach((p) => p.kill()));
