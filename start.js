import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting Kaizen PBI Backend Services...\n');

// Start auth-service
const authService = spawn('node', ['index.js'], {
    cwd: path.join(__dirname, 'services/auth-service'),
    env: { ...process.env, PORT: '4001' },
    stdio: 'inherit'
});

console.log('[AUTH] Starting on port 4001...');

authService.on('error', (err) => {
    console.error('[AUTH] Failed to start:', err);
    process.exit(1);
});

authService.on('exit', (code) => {
    console.error(`[AUTH] Exited with code ${code}`);
    process.exit(code || 1);
});

// Wait a bit for auth-service to start
setTimeout(() => {
    console.log('[EDGE] Starting on port', process.env.PORT || '10000', '...');

    // Start edge-api
    const edgeApi = spawn('node', ['index.js'], {
        cwd: path.join(__dirname, 'services/edge-api'),
        env: process.env,
        stdio: 'inherit'
    });

    edgeApi.on('error', (err) => {
        console.error('[EDGE] Failed to start:', err);
        authService.kill();
        process.exit(1);
    });

    edgeApi.on('exit', (code) => {
        console.error(`[EDGE] Exited with code ${code}`);
        authService.kill();
        process.exit(code || 1);
    });
}, 2000);

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    authService.kill('SIGTERM');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    authService.kill('SIGTERM');
    process.exit(0);
});
