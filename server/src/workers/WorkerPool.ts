import { Worker } from 'worker_threads';
import path from 'path';

interface WorkerTask {
    data: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
}

/**
 * WorkerPool manages a pool of worker threads to handle CPU-intensive tasks.
 * It ensures efficient resource usage by reusing workers and queuing tasks
 * when all workers are busy.
 */
export class WorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Worker[] = [];
    private taskQueue: WorkerTask[] = [];
    private workerScript: string;
    private poolSize: number;

    constructor(workerScript: string, poolSize: number = 4) {
        this.workerScript = workerScript;
        this.poolSize = poolSize;
        this.initializePool();
    }

    private initializePool(): void {
        for (let i = 0; i < this.poolSize; i++) {
            const worker = this.createWorker();
            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
    }

    private createWorker(): Worker {
        const worker = new Worker(this.workerScript);

        worker.on('error', (error) => {
            console.error('Worker error:', error);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
        });

        return worker;
    }

    /**
     * Execute a task using an available worker from the pool.
     * If no workers are available, the task is queued.
     */
    public runTask(data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask = { data, resolve, reject };

            if (this.availableWorkers.length > 0) {
                this.executeTask(task);
            } else {
                this.taskQueue.push(task);
            }
        });
    }

    private executeTask(task: WorkerTask): void {
        const worker = this.availableWorkers.pop()!;

        const messageHandler = (result: any) => {
            // Clean up listeners
            worker.off('message', messageHandler);
            worker.off('error', errorHandler);

            // Return worker to pool
            this.availableWorkers.push(worker);

            // Process next task in queue if any
            if (this.taskQueue.length > 0) {
                const nextTask = this.taskQueue.shift()!;
                this.executeTask(nextTask);
            }

            // Resolve or reject based on result
            if (result.success) {
                task.resolve(result);
            } else {
                task.reject(new Error(result.error || 'Task failed'));
            }
        };

        const errorHandler = (error: Error) => {
            // Clean up listeners
            worker.off('message', messageHandler);
            worker.off('error', errorHandler);

            // Return worker to pool
            this.availableWorkers.push(worker);

            // Process next task in queue if any
            if (this.taskQueue.length > 0) {
                const nextTask = this.taskQueue.shift()!;
                this.executeTask(nextTask);
            }

            task.reject(error);
        };

        worker.once('message', messageHandler);
        worker.once('error', errorHandler);

        // Send task to worker
        worker.postMessage(task.data);
    }

    /**
     * Gracefully terminate all workers in the pool.
     */
    public async terminate(): Promise<void> {
        const terminationPromises = this.workers.map(worker => worker.terminate());
        await Promise.all(terminationPromises);
        this.workers = [];
        this.availableWorkers = [];
    }
}
