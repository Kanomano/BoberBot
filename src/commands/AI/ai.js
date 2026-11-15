import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
const MAX_PROMPT_LENGTH = 1500;
const MAX_OUTPUT_LENGTH = 1800;
const COOLDOWN_MS = 12_000;
const userCooldowns = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Zadaj pytanie darmowemu AI')
    .addStringOption(option =>
      option
        .setName('pytanie')
        .setDescription('Co chcesz zapytać AI?')
        .setRequired(true)
        .setMaxLength(MAX_PROMPT_LENGTH)
    ),

  async execute(interaction) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return interaction.reply({
        content: 'AI nie jest jeszcze skonfigurowane. Administrator musi dodać OPENROUTER_API_KEY w zmiennych środowiskowych.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const prompt = interaction.options.getString('pytanie', true).trim();
    if (!prompt) {
      return interaction.reply({
        content: 'Wpisz pytanie, zanim uruchomisz AI.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const now = Date.now();
    const lastUsed = userCooldowns.get(interaction.user.id) || 0;
    const remaining = COOLDOWN_MS - (now - lastUsed);
    if (remaining > 0) {
      return interaction.reply({
        content: `Odczekaj jeszcze ${Math.ceil(remaining / 1000)} s przed kolejnym pytaniem.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    userCooldowns.set(interaction.user.id, now);

    await interaction.deferReply();

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Kanomano/BoberBot',
          'X-Title': 'BoberBot',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Jesteś pomocnym asystentem na serwerze Discord. Odpowiadaj po polsku, chyba że użytkownik poprosi o inny język. Pisz jasno, rzeczowo i bez niepotrzebnego rozwlekania. Nie używaj pingów Discorda.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 900,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiMessage = payload?.error?.message || `HTTP ${response.status}`;
        logger.warn('OpenRouter request failed', {
          status: response.status,
          message: String(apiMessage).slice(0, 300),
          guildId: interaction.guildId,
        });

        let friendlyMessage = 'Nie udało się uzyskać odpowiedzi z OpenRouter. Spróbuj ponownie za chwilę.';
        if (response.status === 401 || response.status === 403) {
          friendlyMessage = 'OpenRouter odrzucił klucz API. Sprawdź wartość OPENROUTER_API_KEY.';
        } else if (response.status === 429) {
          friendlyMessage = 'Darmowy model jest chwilowo przeciążony albo osiągnięto limit. Spróbuj ponownie później.';
        } else if (response.status === 402) {
          friendlyMessage = 'OpenRouter zgłosił brak dostępnego limitu dla tego konta.';
        }

        return interaction.editReply({ content: friendlyMessage, allowedMentions: { parse: [] } });
      }

      const answer = payload?.choices?.[0]?.message?.content;
      const answerText = typeof answer === 'string' ? answer.trim() : '';
      if (!answerText) {
        return interaction.editReply({
          content: 'AI zwróciło pustą odpowiedź. Spróbuj zadać pytanie ponownie.',
          allowedMentions: { parse: [] },
        });
      }

      const visibleAnswer = answerText.length > MAX_OUTPUT_LENGTH
        ? `${answerText.slice(0, MAX_OUTPUT_LENGTH - 3)}...`
        : answerText;

      await interaction.editReply({
        content: visibleAnswer,
        allowedMentions: { parse: [] },
      });

      logger.info('AI command completed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      logger.error('AI command failed:', error);
      await interaction.editReply({
        content: timedOut
          ? 'AI odpowiada zbyt długo. Spróbuj ponownie za chwilę.'
          : 'Wystąpił błąd podczas łączenia z AI. Spróbuj ponownie później.',
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  },
};