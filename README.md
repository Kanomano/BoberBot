# TitanBot

A multi-feature Discord bot built with Node.js, Discord.js v14 and persistent JSON-file storage. The bot runs as **one Node.js deployment** and does not require PostgreSQL, SQL migrations, Redis, or a separate database service.

## Features

- Moderation: ban, kick, timeout, warnings, cases, notes, mass actions and channel locks
- Tickets: setup panels, claims, priority, transcripts and feedback
- Leveling: XP, ranks, leaderboards and level roles
- Economy: balances, bank, shop, inventory, transfers and activities
- Giveaways: creation, entries, winners and rerolls
- Welcome, goodbye, autoroles and server logging
- Birthdays, applications, verification and reaction roles
- Server statistics and temporary voice channels
- Music through Riffy and Lavalink nodes
- Utility, fun, search and administration commands
- Web health endpoints at `/health` and `/ready`

## Deploy on Bot-Hosting.net

1. Create **one Node.js server** and connect this GitHub repository.
2. Select Node.js 20.10 or newer.
3. Use `npm install` as the install command and `npm start` as the start command (or let the host run the package start script).
4. Add these two required environment variables:
   - `DISCORD_TOKEN` — token from the Discord Developer Portal
   - `CLIENT_ID` — Application ID from the Discord Developer Portal
5. Start the server. No SQL credentials, database deployment, or migration command are needed.

Optional: set `OWNER_IDS` to comma-separated Discord user IDs for owner-only commands. `BOT_DATA_DIR` changes the data folder; by default it is `./data`.

## Data and restarts

Bot records are saved as individual JSON files in the `data/` directory. Writes use temporary files and atomic renames, and the storage layer serializes updates to the same key. Normal process restarts preserve data **as long as the hosting provider keeps the server's filesystem**.

A restart is not the same as deleting/recreating the server. Reinstalling, deleting the deployment, moving to a host without persistent disk, or clearing its files can remove the JSON data. Keep a backup of the `data/` directory before destructive hosting changes.

## Fresh storage — no SQL migration

This version starts with a new, empty JSON data store. It does not connect to, read from, change, or migrate an old PostgreSQL database. Existing SQL data is left untouched; existing guild settings, tickets, balances and levels will not appear in the new store unless you add them again in Discord.

## Local run

```bash
npm install
cp .env.example .env
# Fill in DISCORD_TOKEN and CLIENT_ID
npm start
```

## Music

Music is enabled in the bot configuration and uses the Lavalink nodes listed in `lavalink/nodes.json`. The public nodes may change availability. You do not need to deploy a separate Lavalink server to run the other bot modules.

## Required Discord intents

Enable Guilds, Guild Members, Guild Messages, Message Content, Message Reactions and Guild Voice States in the Discord Developer Portal. Invite the bot with `bot` and `applications.commands` scopes and the permissions required by the modules you plan to use.

## Runtime

- Node.js 20.10+
- npm
- One running bot process

The bot's data folder is runtime data and should not be committed to GitHub.
