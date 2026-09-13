import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { baseEmbed } from "../../lib/embed";
import { env } from "../../lib/env";
import Command, { type ExecuteContext } from "../command";

/**
 * Show general bot info: what Shiroko does, its commands, and links to the
 * privacy policy and terms of service.
 */
export default class HelpCommand extends Command {
  constructor() {
    super("help", "Show bot info and legal links");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    const sections: string[][] = [
      [
        "**ℹ️ About**",
        "Shiroko tracks server activity: message counts and voice time per user and per server, shown as stat cards. Members gain XP and levels from activity, with configurable rewards, and servers get leaderboards for levels, messages, voice time, and invites.",
      ],
      ["**📧 Contact**", "Questions or data requests: shiroko@fascinated.cc"],
    ];

    const lines = sections.map(section => section.join("\n")).join("\n\n");

    const embed = baseEmbed(commandName).setTitle("❓ Shiroko Help").setDescription(lines);

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Privacy Policy")
        .setStyle(ButtonStyle.Link)
        .setURL(env.PRIVACY_POLICY_URL),
      new ButtonBuilder()
        .setLabel("Terms of Service")
        .setStyle(ButtonStyle.Link)
        .setURL(env.TERMS_OF_SERVICE_URL)
    );

    return ctx.reply({ embeds: [embed], components: [row] });
  }
}
