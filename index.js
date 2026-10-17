
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ARQUIVO_PINGS = path.join(__dirname, "pings.json");

let bancoPings = {};

if (fs.existsSync(ARQUIVO_PINGS)) {
  try {
    bancoPings = JSON.parse(fs.readFileSync(ARQUIVO_PINGS, "utf8"));
  } catch {
    console.error("Não foi possível ler pings.json.");
  }
}

function salvarPings() {
  fs.writeFileSync(ARQUIVO_PINGS, JSON.stringify(bancoPings, null, 2));
}

function listarPings(guildId) {
  if (!bancoPings[guildId]) bancoPings[guildId] = {};
  return bancoPings[guildId];
}

function registrarPing(guildId, role, nome = role.name) {
  listarPings(guildId)[role.id] = { roleId: role.id, nome };
  salvarPings();
}

function ehAdministrador(interaction) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

const comandos = [
  new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Mostra os comandos do BOT BFE"),

  new SlashCommandBuilder()
    .setName("criar-ping")
    .setDescription("Registra um cargo de ping existente")
    .addStringOption(option =>
      option.setName("nome")
        .setDescription("Nome do cargo, por exemplo Exames")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Menciona um cargo de ping registrado")
    .addStringOption(option =>
      option.setName("nome")
        .setDescription("ID do cargo de ping")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("painel-pings")
    .setDescription("Cria um botão para cada cargo mencionado")
    .addStringOption(option =>
      option.setName("cargos")
        .setDescription("Mencione os cargos que terão botões")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("anunciar-treino")
    .setDescription("Publica um anúncio de treinamento")
    .addStringOption(option =>
      option.setName("informacoes")
        .setDescription("Data, horário e informações")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("anunciar-exame")
    .setDescription("Publica um anúncio de exame")
    .addStringOption(option =>
      option.setName("informacoes")
        .setDescription("Data, horário e informações")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("cronograma-treino")
    .setDescription("Publica o cronograma de treinamentos")
    .addStringOption(option =>
      option.setName("cronograma")
        .setDescription("Dias, horários e informações")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(command => command.toJSON());

async function registrarComandos() {
  if (!TOKEN || !CLIENT_ID) {
    throw new Error("Configure TOKEN e CLIENT_ID no arquivo .env.");
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: comandos }
  );

  console.log("Comandos registrados.");
}

client.once("clientReady", () => {
  console.log(`BOT BFE conectado como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  try {
    // Autocomplete de /ping
    if (interaction.isAutocomplete()) {
      if (interaction.commandName !== "ping") return;

      const pings = Object.values(listarPings(interaction.guildId));
      const pesquisa = interaction.options.getFocused().toLowerCase();

      return interaction.respond(
        pings
          .filter(p => p.nome.toLowerCase().includes(pesquisa))
          .slice(0, 25)
          .map(p => ({ name: p.nome.slice(0, 100), value: p.roleId }))
      );
    }

    // Botões: adiciona ou remove o cargo correspondente
    if (interaction.isButton()) {
      if (!interaction.customId.startsWith("bfe_ping:")) return;

      const roleId = interaction.customId.split(":")[1];
      const role = await interaction.guild.roles.fetch(roleId);

      if (!role || role.id === interaction.guild.id || role.managed) {
        return interaction.reply({
          content: "Esse cargo não está disponível.",
          ephemeral: true,
        });
      }

      const membro = await interaction.guild.members.fetch(interaction.user.id);
      const botMembro = await interaction.guild.members.fetchMe();

      if (
        !botMembro.permissions.has(PermissionFlagsBits.ManageRoles) ||
        !role.editable
      ) {
        return interaction.reply({
          content: "Não consigo alterar esse cargo. Confira a permissão Gerenciar cargos e a hierarquia do bot.",
          ephemeral: true,
        });
      }

      if (membro.roles.cache.has(roleId)) {
        await membro.roles.remove(role);
        return interaction.reply({
          content: `🔕 Cargo removido: **${role.name}**`,
          ephemeral: true,
        });
      }

      await membro.roles.add(role);
      return interaction.reply({
        content: `🔔 Cargo recebido: **${role.name}**`,
        ephemeral: true,
      });
    }

    if (!interaction.isChatInputCommand()) return;

    const comando = interaction.commandName;

    if (comando === "ajuda") {
      const embed = new EmbedBuilder()
        .setColor(0x2b6cb0)
        .setTitle("BOT BFE — Ajuda")
        .setDescription([
          "`/ajuda` — lista de comandos",
          "`/criar-ping` — registra um cargo existente",
          "`/ping` — menciona um cargo registrado",
          "`/painel-pings` — cria botões para os cargos mencionados",
          "`/anunciar-treino` — anuncia treinamento",
          "`/anunciar-exame` — anuncia exame",
          "`/cronograma-treino` — publica cronograma",
        ].join("\n"));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const comandosAdmin = [
      "criar-ping", "ping", "painel-pings",
      "anunciar-treino", "anunciar-exame", "cronograma-treino",
    ];

    if (comandosAdmin.includes(comando) && !ehAdministrador(interaction)) {
      return interaction.reply({
        content: "⛔ Você precisa ser administrador para usar esse comando.",
        ephemeral: true,
      });
    }

    // Registra cargo existente sem criar outro
    if (comando === "criar-ping") {
      const nome = interaction.options.getString("nome", true).trim();
      const cargos = await interaction.guild.roles.fetch();
      const role = cargos.find(r =>
        [
          nome,
          `Ping | ${nome}`,
          `Ping-${nome}`,
          `『Ping-${nome} 👀』`,
        ].some(n => n.toLowerCase() === r.name.toLowerCase())
      );

      if (!role) {
        return interaction.reply({
          content: `Não encontrei o cargo **${nome}**. Confira o nome no servidor.`,
          ephemeral: true,
        });
      }

      registrarPing(interaction.guildId, role, role.name);

      return interaction.reply({
        content: `✅ Cargo ${role} registrado sem criar duplicatas.`,
        ephemeral: true,
      });
    }

    // Cria um botão para cada cargo mencionado no campo
    if (comando === "painel-pings") {
      const texto = interaction.options.getString("cargos", true);
      const ids = [...texto.matchAll(/<@&(\d+)>/g)].map(match => match[1]);
      const idsUnicos = [...new Set(ids)];

      if (idsUnicos.length === 0) {
        return interaction.reply({
          content: "Mencione os cargos no campo cargos. Exemplo: @『Ping-Exames 👀』",
          ephemeral: true,
        });
      }

      const cargos = await interaction.guild.roles.fetch();
      const roles = idsUnicos
        .map(id => cargos.get(id))
        .filter(role =>
          role &&
          role.id !== interaction.guild.id &&
          !role.managed
        );

      if (roles.length === 0) {
        return interaction.reply({
          content: "Não encontrei cargos válidos entre as menções enviadas.",
          ephemeral: true,
        });
      }

      const botMembro = await interaction.guild.members.fetchMe();

      if (!botMembro.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: "O bot precisa da permissão Gerenciar cargos.",
          ephemeral: true,
        });
      }

      const naoEditaveis = roles.filter(role => !role.editable);

      if (naoEditaveis.length > 0) {
        return interaction.reply({
          content: `Mova o cargo do bot para cima destes cargos: ${naoEditaveis.map(r => r.name).join(", ")}`,
          ephemeral: true,
        });
      }

      for (const role of roles) {
        registrarPing(interaction.guildId, role, role.name);
      }

      // 25 botões por mensagem: 5 linhas, 5 botões por linha.
      // Mais cargos geram mensagens adicionais.
      for (let inicio = 0; inicio < roles.length; inicio += 25) {
        const lote = roles.slice(inicio, inicio + 25);
        const linhas = [];

        for (let i = 0; i < lote.length; i += 5) {
          const linha = new ActionRowBuilder().addComponents(
            lote.slice(i, i + 5).map(role =>
              new ButtonBuilder()
                .setCustomId(`bfe_ping:${role.id}`)
                .setLabel(role.name.slice(0, 80))
                .setStyle(ButtonStyle.Primary)
            )
          );

          linhas.push(linha);
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b6cb0)
          .setTitle("🔔 Painel de Pings — BFE")
          .setDescription(
            "Clique no botão do cargo que deseja receber. Clique novamente para removê-lo."
          );

        await interaction.channel.send({
          embeds: [embed],
          components: linhas,
        });
      }

      return interaction.reply({
        content: `✅ Painel publicado com ${roles.length} botões, um para cada cargo válido.`,
        ephemeral: true,
      });
    }

    // Menciona um cargo registrado
    if (comando === "ping") {
      const roleId = interaction.options.getString("nome", true);
      const role = await interaction.guild.roles.fetch(roleId);

      if (!role || !listarPings(interaction.guildId)[role.id]) {
        return interaction.reply({
          content: "Esse cargo não está registrado. Use /criar-ping ou /painel-pings.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `🔔 Atenção! ${role}`,
        allowedMentions: { roles: [role.id] },
      });
    }

    // Anúncio de treinamento
    if (comando === "anunciar-treino") {
      const info = interaction.options.getString("informacoes", true);
      const embed = new EmbedBuilder()
        .setColor(0x228b22)
        .setTitle("📢 Anúncio de Treinamento — BFE")
        .setDescription(info)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Anúncio de exame
    if (comando === "anunciar-exame") {
      const info = interaction.options.getString("informacoes", true);
      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle("📢 Anúncio de Exame — BFE")
        .setDescription(info)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Cronograma de treinamento
    if (comando === "cronograma-treino") {
      const info = interaction.options.getString("cronograma", true);
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("📅 Cronograma de Treinamentos — BFE")
        .setDescription(info)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  } catch (erro) {
    console.error("Erro na interação:", erro);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Ocorreu um erro. Confira o console e as permissões do bot.",
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

registrarComandos()
  .then(() => client.login(TOKEN))
  .catch(erro => console.error("Erro ao iniciar o BOT BFE:", erro));
