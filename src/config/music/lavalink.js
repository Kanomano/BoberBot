import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return ['true', '1', 'yes'].includes(String(value).toLowerCase());
}

function parseNodesFromEnv() {
    const raw = process.env.LAVALINK_NODES?.trim();
    if (!raw) {
        return null;
    }

    try {
        return parseNodesPayload(JSON.parse(raw));
    } catch {
        return null;
    }
}

function parseNodesPayload(parsed) {
    if (Array.isArray(parsed)) {
        return parsed;
    }
    if (Array.isArray(parsed?.nodes)) {
        return parsed.nodes;
    }
    return null;
}

function loadNodesFromFile() {
    const nodesFile = process.env.LAVALINK_NODES_FILE?.trim()
        || path.join(projectRoot, 'lavalink', 'nodes.json');

    if (!existsSync(nodesFile)) {
        return null;
    }

    try {
        const parsed = JSON.parse(readFileSync(nodesFile, 'utf8'));
        return parseNodesPayload(parsed);
    } catch {
        return null;
    }
}

export function getLavalinkNodes() {
    // Explicit JSON configuration has the highest priority.
    const fromJson = parseNodesFromEnv();
    if (fromJson?.length) {
        return fromJson;
    }

    // A configured single node must override the bundled public-node fallback.
    const host = process.env.LAVALINK_HOST?.trim();
    if (host) {
        const secure = parseBoolean(process.env.LAVALINK_SECURE, false);
        const port = Number(process.env.LAVALINK_PORT || (secure ? 443 : 2333));
        const password = process.env.LAVALINK_PASSWORD?.trim();

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('LAVALINK_PORT must be an integer between 1 and 65535.');
        }
        if (!password) {
            throw new Error('LAVALINK_PASSWORD is required when LAVALINK_HOST is configured.');
        }

        return [{
            host,
            port,
            password,
            secure,
            name: process.env.LAVALINK_NAME || 'Main',
        }];
    }

    const fromFile = loadNodesFromFile();
    if (fromFile?.length) {
        return fromFile;
    }

    return [{
        host: 'localhost',
        port: 2333,
        password: 'youshallnotpass',
        secure: false,
        name: 'Main',
    }];
}

export const lavalinkConfig = {
    nodes: getLavalinkNodes(),
    defaultSearchPlatform: process.env.LAVALINK_SEARCH_PLATFORM || 'ytmsearch',
    restVersion: process.env.LAVALINK_REST_VERSION || 'v4',
};

export default lavalinkConfig;
