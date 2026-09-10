import { PermissionFlagsBits } from "discord.js";
import Command, { type ExecuteContext } from "../command/command";
import { booleanOption, stringOption, type CommandOptionBuilder } from "../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../lib/embed";
import { PermissionFlags } from "../permission/permissions";
import { FeatureIds } from "./feature-ids";
import GuildFeatures from "./guild-features";

const FEATURE_CHOICES: Record<string, string> = Object.fromEntries(
  Object.values(FeatureIds).map(id => [id, id])
);

export default class FeatureCommand extends Command {
  constructor() {
    super("feature", "Enable or disable server features");
    this.slashCommand.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.FEATURE_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    return [
      stringOption(true, "feature", "Which feature to change", { choices: FEATURE_CHOICES }),
      booleanOption(true, "enabled", "Turn the feature on or off"),
    ];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild;
    if (!guild) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Features can only be changed in servers.")
        )
      );
    }
    const featureId = ctx.options.getString("feature", true)! as FeatureIds;
    if (!Object.values(FeatureIds).includes(featureId)) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(`Unknown feature: \`${featureId}\`.`)
        )
      );
    }
    const enabled = ctx.options.getBoolean("enabled", true)!;
    await GuildFeatures.setFeatureEnabled(guild, featureId, enabled);
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle("⚙️ Feature Updated")
          .setDescription(`**${featureId}** is now **${enabled ? "enabled" : "disabled"}**.`),
      ],
    });
  }
}
