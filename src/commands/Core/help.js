import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';
import { createSelectMenu } from '../../utils/components.js';
import { buildCommandRegistry } from '../../services/commandAccessService.js';
import {
  formatCategoryName,
  getCategoryIcon,
} from '../../config/commands/commandCategories.js';

const CATEGORY_SELECT_ID = 'help-category-select';
const ALL_COMMANDS_ID = 'help-all-commands';
const BUG_REPORT_BUTTON_ID = 'help-bug-report';
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

export async function createInitialHelpMenu(client) {
  const registry = buildCommandRegistry(client);
  const categories = [...registry.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const options = [
    {
      label: '📋 All Commands',
      description: 'Browse every available command in one list',
      value: ALL_COMMANDS_ID,
    },
    ...categories.slice(0, 24).map(category => ({
      label: (category.icon + ' ' + category.displayName).slice(0, 100),
      description: ('Browse the ' + category.displayName + ' category').slice(0, 100),
      value: category.key,
    })),
  ];

  const botName = client?.user?.username || 'BoberBot';
  const embed = createEmbed({
    title: '📖 ' + botName + ' Help',
    description: 'Choose a category below to explore available commands.',
    color: 'primary',
    thumbnail: client.user?.displayAvatarURL?.({ size: 1024 }),
    fields: [
      {
        name: '🚀 Getting Started',
        value: [
          '**1. Configure the bot** — Run /configwizard to set up the main server options.',
          '**2. Manage features** — Use /commands dashboard to enable or disable command categories.',
          '**3. Explore commands** — Select a category below or browse the complete command list.',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'ℹ️ How It Works',
        value: [
          '• Each category groups related bot features.',
          '• Server settings are saved separately for each server.',
          '• Slash commands are registered automatically when the bot starts.',
        ].join('\n'),
        inline: false,
      },
      {
        name: '\u200B',
        value: '-# BoberBot is open source. Visit the project repository for details.',
        inline: false,
      },
    ],
  });

  embed.setFooter({ text: 'Made with ❤️' });
  embed.setTimestamp();

  const bugReportButton = new ButtonBuilder()
    .setCustomId(BUG_REPORT_BUTTON_ID)
    .setLabel('Report a Bug')
    .setStyle(ButtonStyle.Danger);

  const supportButton = new ButtonBuilder()
    .setLabel('Support Server')
    .setURL('https://discord.gg/QnWNz2dKCE')
    .setStyle(ButtonStyle.Link);

  const selectRow = createSelectMenu(CATEGORY_SELECT_ID, 'Select a command category', options);
  const buttonRow = new ActionRowBuilder().addComponents(bugReportButton, supportButton);

  return { embeds: [embed], components: [buttonRow, selectRow] };
}

export default {
  slashOnly: true,
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse the bot help menu and available commands'),

  async execute(interaction, guildConfig, client) {
    await InteractionHelper.safeDefer(interaction);
    const { embeds, components } = await createInitialHelpMenu(client);
    await InteractionHelper.safeEditReply(interaction, { embeds, components });

    setTimeout(async () => {
      try {
        if (!InteractionHelper.isInteractionValid(interaction)) return;
        const closedEmbed = createEmbed({
          title: 'Help menu closed',
          description: 'The help menu has closed. Run /help to open it again.',
          color: 'secondary',
        });
        await InteractionHelper.safeEditReply(interaction, { embeds: [closedEmbed], components: [] });
      } catch {
        // The interaction may have expired.
      }
    }, HELP_MENU_TIMEOUT_MS);
  },
};
