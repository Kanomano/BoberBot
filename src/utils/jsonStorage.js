import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

const isNotFound = (error) => error?.code === 'ENOENT';

export class JsonFileStorage {
    constructor(directory = process.env.BOT_DATA_DIR || path.join(process.cwd(), 'data')) {
        this.directory = path.resolve(directory);
        this.initialized = false;
        this.locks = new Map();
    }

    async initialize() {
        await fs.mkdir(this.directory, { recursive: true });
        this.initialized = true;
        logger.info(`Persistent JSON storage ready at ${this.directory}`);
        return true;
    }

    assertReady() {
        if (!this.initialized) {
            throw new Error('JSON storage has not been initialized.');
        }
    }

    fileFor(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new TypeError('Storage keys must be non-empty strings.');
        }
        const filename = Buffer.from(key, 'utf8').toString('base64url') + '.json';
        return path.join(this.directory, filename);
    }

    async withKeyLock(key, operation) {
        const previous = this.locks.get(key) || Promise.resolve();
        let release;
        const current = new Promise((resolve) => { release = resolve; });
        const tail = previous.then(() => current);
        this.locks.set(key, tail);
        await previous;

        try {
            return await operation();
        } finally {
            release();
            if (this.locks.get(key) === tail) {
                this.locks.delete(key);
            }
        }
    }

    async readRecord(key) {
        const filename = this.fileFor(key);

        try {
            const raw = await fs.readFile(filename, 'utf8');
            const record = JSON.parse(raw);

            if (!record || record.key !== key || !Object.prototype.hasOwnProperty.call(record, 'value')) {
                throw new Error(`Invalid JSON storage record for key "${key}".`);
            }

            if (record.expiresAt && Date.now() >= record.expiresAt) {
                await fs.unlink(filename).catch((error) => {
                    if (!isNotFound(error)) throw error;
                });
                return { found: false, value: undefined };
            }

            return { found: true, value: record.value };
        } catch (error) {
            if (isNotFound(error)) {
                return { found: false, value: undefined };
            }
            throw error;
        }
    }

    async writeRecord(key, value, ttl = null) {
        const filename = this.fileFor(key);
        const expiresAt = Number(ttl) > 0 ? Date.now() + Number(ttl) * 1000 : null;
        const record = { key, value, expiresAt, updatedAt: new Date().toISOString() };
        const serialized = JSON.stringify(record);

        if (typeof serialized !== 'string') {
            throw new TypeError(`Value for key "${key}" cannot be serialized to JSON.`);
        }

        const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
        let handle;

        try {
            handle = await fs.open(temporary, 'wx', 0o600);
            await handle.writeFile(serialized, 'utf8');
            await handle.sync();
            await handle.close();
            handle = null;
            await fs.rename(temporary, filename);
            return true;
        } finally {
            if (handle) await handle.close().catch(() => {});
            await fs.unlink(temporary).catch((error) => {
                if (!isNotFound(error)) logger.warn('Could not remove temporary storage file:', error.message);
            });
        }
    }

    async get(key, defaultValue = null) {
        this.assertReady();
        return this.withKeyLock(key, async () => {
            const record = await this.readRecord(key);
            return record.found ? record.value : defaultValue;
        });
    }

    async set(key, value, ttl = null) {
        this.assertReady();
        return this.withKeyLock(key, () => this.writeRecord(key, value, ttl));
    }

    async delete(key) {
        this.assertReady();
        return this.withKeyLock(key, async () => {
            try {
                await fs.unlink(this.fileFor(key));
            } catch (error) {
                if (!isNotFound(error)) throw error;
            }
            return true;
        });
    }

    async list(prefix = '') {
        this.assertReady();
        const entries = await fs.readdir(this.directory, { withFileTypes: true });
        const keys = [];

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

            let key;
            try {
                key = Buffer.from(entry.name.slice(0, -5), 'base64url').toString('utf8');
            } catch {
                continue;
            }

            if (!key.startsWith(prefix)) continue;

            try {
                const record = await this.get(key, undefined);
                if (record !== undefined) keys.push(key);
            } catch (error) {
                logger.warn(`Skipping unreadable storage entry "${entry.name}": ${error.message}`);
            }
        }

        return keys.sort();
    }

    async exists(key) {
        this.assertReady();
        return this.withKeyLock(key, async () => {
            const record = await this.readRecord(key);
            return record.found;
        });
    }

    async increment(key, amount = 1) {
        this.assertReady();
        return this.withKeyLock(key, async () => {
            const record = await this.readRecord(key);
            const current = record.found ? Number(record.value) : 0;
            if (!Number.isFinite(current) || !Number.isFinite(Number(amount))) {
                throw new TypeError(`Cannot increment non-numeric storage value for key "${key}".`);
            }
            const next = current + Number(amount);
            await this.writeRecord(key, next);
            return next;
        });
    }

    async decrement(key, amount = 1) {
        return this.increment(key, -Number(amount));
    }

    async clear() {
        this.assertReady();
        await Promise.all([...this.locks.values()]);
        const entries = await fs.readdir(this.directory, { withFileTypes: true });
        await Promise.all(entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => fs.unlink(path.join(this.directory, entry.name))));
        return true;
    }

    async close() {
        await Promise.all([...this.locks.values()]);
    }
}

export default JsonFileStorage;
