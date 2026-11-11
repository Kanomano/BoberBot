import { JsonFileStorage } from '../jsonStorage.js';
import { logger } from '../logger.js';
import { validateGuildConfigOrThrow } from '../schemas.js';

class DatabaseWrapper {
    constructor() {
        this.initialized = false;
        this.db = null;
        this.useFallback = false;
        this.connectionType = 'none';
        this.degradedModeWarningShown = false;
        this.degradedReason = null;
    }

    async initialize() {
        if (this.initialized) return;

        const storage = new JsonFileStorage();
        await storage.initialize();

        this.db = storage;
        this.useFallback = false;
        this.connectionType = 'json-file';
        this.degradedReason = null;
        this.initialized = true;

        logger.info('Persistent JSON file storage initialized.');
    }

    async set(key, value, ttl = null) {
        if (!this.initialized) await this.initialize();

        if (typeof key === 'string' && /^guild:[^:]+:config$/.test(key)) {
            const guildId = key.split(':')[1];
            validateGuildConfigOrThrow(value, {
                guildId,
                errorCode: 'VALIDATION_FAILED',
            });
        }

        return this.db.set(key, value, ttl);
    }

    async get(key, defaultValue = null) {
        if (!this.initialized) await this.initialize();
        return this.db.get(key, defaultValue);
    }

    async delete(key) {
        if (!this.initialized) await this.initialize();
        return this.db.delete(key);
    }

    async list(prefix = '') {
        if (!this.initialized) await this.initialize();
        return this.db.list(prefix);
    }

    async exists(key) {
        if (!this.initialized) await this.initialize();
        return this.db.exists(key);
    }

    async increment(key, amount = 1) {
        if (!this.initialized) await this.initialize();
        return this.db.increment(key, amount);
    }

    async decrement(key, amount = 1) {
        if (!this.initialized) await this.initialize();
        return this.db.decrement(key, amount);
    }

    isDegraded() {
        return false;
    }

    isAvailable() {
        return Boolean(this.initialized && this.db);
    }

    getStatus() {
        return {
            initialized: this.initialized,
            connectionType: this.connectionType,
            isDegraded: false,
            isAvailable: this.isAvailable(),
            degradedReason: null,
            isPersistent: true,
            dataDirectory: this.db?.directory ?? null,
        };
    }

    getConnectionType() {
        return this.connectionType;
    }
}

export const db = new DatabaseWrapper();

export async function initializeDatabase() {
    try {
        await db.initialize();
        return { db };
    } catch (error) {
        logger.error('Persistent JSON storage initialization failed:', error);
        throw error;
    }
}

export async function getFromDb(key, defaultValue = null) {
    try {
        const value = await db.get(key, defaultValue);
        return value === null ? defaultValue : value;
    } catch (error) {
        logger.error(`Error getting value for key ${key}:`, error);
        return defaultValue;
    }
}

export async function setInDb(key, value, ttl = null) {
    try {
        await db.set(key, value, ttl);
        return true;
    } catch (error) {
        logger.error(`Error setting value for key ${key}:`, error);
        return false;
    }
}

export async function deleteFromDb(key) {
    try {
        await db.delete(key);
        return true;
    } catch (error) {
        logger.error(`Error deleting key ${key}:`, error);
        return false;
    }
}
