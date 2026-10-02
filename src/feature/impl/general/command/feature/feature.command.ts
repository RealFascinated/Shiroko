import Command, { type ExecuteContext } from "@/command/command";
import { booleanOption, stringOption, type CommandOptionBuilder } from "@/command/option";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import GuildFeatures from "@/feature/guild-features";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { PermissionFlags } from "@/permission/permissions";
import { PermissionFlagsBits } from "discord.js";

export default class FeatureCommand extends Command {
  constructor() {
    super("feature", "Enable or disable server features");
    this.slashCommand.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  }

  public override get requiredFlags(): bigint {
    return PermissionFlags.FEATURE_COMMAND;
  }

  public override get options(): CommandOptionBuilder[] {
    const choices: Record<string, string> = Object.fromEntries(
      Feature.all()
        .filter(feature => feature.toggleable)
        .map(feature => [feature.id, feature.name])
    );
    return [
      stringOption(true, "feature", "Which feature to change", { choices }),
      booleanOption(true, "enabled", "Turn the feature on or off"),
    ];
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const guild = ctx.guild!;
    const featureId = ctx.options.getString("feature", true) as FeatureIds;
    if (!Object.values(FeatureIds).includes(featureId)) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(`Unknown feature: \`${featureId}\`.`)
        )
      );
    }
    const enabled = ctx.options.getBoolean("enabled", true);
    await GuildFeatures.setFeatureEnabled(guild, featureId, enabled);
    const feature = Feature.get(featureId);
    const name = feature?.name ?? featureId;
    const line = enabled ? `**${name}** is now **enabled**.` : `**${name}** is now **disabled**.`;
    return ctx.reply({
      embeds: [
        baseEmbed(commandName)
          .setTitle(`${feature?.emoji ?? "⚙️"} Feature Toggled`)
          .setDescription(line),
      ],
    });
  }
}
