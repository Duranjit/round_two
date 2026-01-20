import { parentPort } from 'worker_threads';
import { simulateHeavyEncryption } from '../utils/crypto';

/**
 * Worker thread for handling CPU-intensive encryption tasks.
 * This worker receives messages from the main thread and performs
 * the heavy encryption operation without blocking the event loop.
 */

if (parentPort) {
    parentPort.on('message', (data: { vitals: any }) => {
        try {
            // Perform the CPU-intensive encryption task
            simulateHeavyEncryption();

            // Send success response back to main thread
            parentPort!.postMessage({
                success: true,
                message: 'Vitals encrypted successfully'
            });
        } catch (error) {
            // Send error response back to main thread
            parentPort!.postMessage({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}