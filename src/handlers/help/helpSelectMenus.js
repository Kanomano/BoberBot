import { Collection, ActionRowBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { createButton, getPaginationRow } from '../../utils/components.js';
import { buildCommandRegistry } from '../../services/commandAccessService.js';
import {
  formatCategoryName,
  getCategoryIcon,
} from '../../config/commands/commandCategories.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

const BACK_BUTTON_ID = 'help-back-to-main';
const ALL_COMMANDS_ID = 'help-all-commands';
const PAGINATION_PREFIX = 'help-page';
const CATEGORY_SELECT_ID = 'help-category-select';
const FOOTER_TEXT = 'Made with ❤️';

function normalizeCommandData(command) {
  const rawData = command?.data;
  if (!rawData) return null;
  const jsonData = typeof rawData.toJSON === 'function' ? rawData.toJSON() : rawData;
  if (!jsonData?.name) return null;
  return { ...jsonData, options: Array.isArray(jsonData.options) ? jsonData.options : [] };
}

function buildHelpEntries(command, category) {
  const data = normalizeCommandData(command);
  if (!data) return [];
  const entries = [];

  for (const option of data.options) {
    if (option?.type === 1) {
      entries.push({
        baseName: data.name,
        displayName: data.name + ' ' + option.name,
        description: option.description || data.description || 'No description',
        category,
      });
    } else if (option?.type === 2) {
      for (const nested of option.options || []) {
        if (nested?.type === 1) {
          entries.push({
            baseName: data.name,
            displayName: data.name + ' ' + option.name + ' ' + nested.name,
            description: nested.description || option.description || data.description || 'No description',
            category,
          });
        }
      }
    }
  }

  if (!entries.length) {
    entries.push({
      baseName: data.name,
      displayName: data.name,
      description: data.description || 'No description',
      category,
    });
  }
  return entries;
}

async function getRegisteredCommands(client) {
  const registered = new Collection();
  try {
    if (client?.application?.commands?.fetch) {
      const commands = await client.application.commands.fetch();
      for (const command of commands.values()) registered.set(command.name, command);
    }
  } catch (error) {
    logger.warn('Could not fetch registered slash commands for the help menu.', { error: error.message });
  }
  return registered;
}

function getCommandsForCategory(client, category) {
  return [...client.commands.values()]
    .filter(command => command?.category === category.folder)
    .flatMap(command => buildHelpEntries(command, category.displayName))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function formatCommandLine(command, registeredCommands, includeCategory = false) {
  const registered = registeredCommands.get(command.baseName);
  const mention = registered?.id
    ? '</' + command.displayName + ':' + registered.id + '>'
    : '/' + command.displayName;
  return includeCategory ? mention + ' · ' + command.category : mention + ' · ' + command.description;
}

function addChunkedFields(embed, lines, fieldPrefix = 'Commands') {
  const chunks = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? current + '\n' + line : line;
    if (candidate.length > 1000 && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  chunks.forEach((chunk, index) => {
    embed.addFields({
      name: chunks.length > 1 ? fieldPrefix + ' (Part ' + (index + 1) + ')' : fieldPrefix,
      value: chunk,
      inline: false,
    });
  });
}

async function createCategoryCommandsMenu(categoryKey, client) {
  const registry = buildCommandRegistry(client);
  const category = registry.get(categoryKey);
  const categoryName = category?.displayName || formatCategoryName(categoryKey);
  const icon = category?.icon || getCategoryIcon(categoryKey);
  const entries = category ? getCommandsForCategory(client, category) : [];
  const registeredCommands = await getRegisteredCommands(client);

  const embed = createEmbed({
    title: icon + ' ' + categoryName + ' Commands',
    description: entries.length
      ? 'Select a command mention below to run it.'
      : 'No commands are currently registered in this category.',
  });

  if (entries.length) {
    addChunkedFields(embed, entries.map(entry => formatCommandLine(entry, registeredCommands)));
  }

  embed.setFooter({ text: FOOTER_TEXT });
  embed.setTimestamp();

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      createButton(BACK_BUTTON_ID, 'Back', 'primary', '⬅️', false),
    )],
  };
}

export async function createAllCommandsMenu(page = 1, client) {
  const commandsPerPage = 45;
  const registry = buildCommandRegistry(client);
  const allCommands = [...registry.values()]
    .flatMap(category => getCommandsForCategory(client, category))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const registeredCommands = await getRegisteredCommands(client);
  const totalPages = Math.max(1, Math.ceil(allCommands.length / commandsPerPage));
  const safePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const pageCommands = allCommands.slice((safePage - 1) * commandsPerPage, safePage * commandsPerPage);

  const embed = createEmbed({
    title: '📋 All Commands',
    description: 'Browse all commands currently loaded by the bot. Use the page buttons to navigate.',
  });
  embed.setFooter({ text: 'Page ' + safePage + ' of ' + totalPages + ' · ' + allCommands.length + ' entries' });
  embed.setTimestamp();

  if (pageCommands.length) {
    const lines = pageCommands.map(command => formatCommandLine(command, registeredCommands, true));
    const columnCount = pageCommands.length > 20 ? 3 : (pageCommands.length > 10 ? 2 : 1);
    const chunkSize = Math.ceil(lines.length / columnCount);
    for (let index = 0; index < columnCount; index++) {
      const chunk = lines.slice(index * chunkSize, (index + 1) * chunkSize);
      if (chunk.length) addChunkedFields(embed, chunk, 'Commands (Page ' + safePage + ')');
    }
  }

  const components = [];
  if (totalPages > 1) {
    components.push(getPaginationRow(PAGINATION_PREFIX, safePage, totalPages));
  }
  components.push(new ActionRowBuilder().addComponents(
    createButton(BACK_BUTTON_ID, 'Back', 'primary', '⬅️', false),
  ));

  return { embeds: [embed], components, currentPage: safePage, totalPages };
}

export const helpCategorySelectMenu = {
  name: CATEGORY_SELECT_ID,
  async execute(interaction, client) {
    try {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectedCategory = interaction.values[0];
      const view = selectedCategory === ALL_COMMANDS_ID
        ? await createAllCommandsMenu(1, client)
        : await createCategoryCommandsMenu(selectedCategory, client);
      await interaction.editReply({ embeds: view.embeds, components: view.components });
    } catch (error) {
      if (error?.code === 40060 || error?.code === 10062) {
        logger.warn('Help category selection interaction is no longer available.', {
          errorCode: String(error.code),
          customId: interaction.customId,
          interactionId: interaction.id,
        });
        return;
      }
      await handleInteractionError(interaction, error, {
        type: 'select_menu',
        customId: interaction.customId,
        handler: 'help_category',
      });
    }
  },
};
