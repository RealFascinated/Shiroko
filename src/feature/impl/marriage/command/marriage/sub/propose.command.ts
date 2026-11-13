import Command, { type ExecuteContext } from "@/command/command";
import { userOption } from "@/command/option";
import Components from "@/component/components";
import { componentCustomId } from "@/component/component";
import { baseEmbed } from "@/lib/embed";
import { TimeUnit } from "@/lib/time";
import GlobalUsersManager from "@/user/global-users-manager";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { MARRIAGE_RESPONSE_COMPONENT_ID } from "../../../marriage-response.component";
import { marriageService } from "../../../marriage.service";

const PROPOSAL_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Hour, 1);

export default class ProposeCommand extends Command {
  constructor() {
    super({ id: "propose", displayName: "Propose to another member" });
  }

  public override get options() {
    return [userOption(true, "user", "Who to propose to")];
  }

  protected override async onExecuteSlash({ user, ctx, commandName }: ExecuteContext) {
    const guildId = ctx.guild!.id;
    const target = ctx.options.getUser("user", true);
    const refuse = (content: string) => ctx.reply({ content, flags: MessageFlags.Ephemeral });
    if (target.id === user.id) {
      return refuse("You can't marry yourself.");
    }
    if (target.bot) {
      return refuse("Bots can't get married.");
    }
    if (await marriageService.getMarriage(guildId, user.id)) {
      return refuse("You are already married in this server.");
    }
    if (await marriageService.getMarriage(guildId, target.id)) {
      return refuse(`${target} is already married in this server.`);
    }
    await GlobalUsersManager.getUser(target);
    const ids = [Components.newId(), Components.newId()];
    const buttons = [
      new ButtonBuilder().setLabel("Accept").setEmoji("💍").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setLabel("Decline").setEmoji("💔").setStyle(ButtonStyle.Danger),
    ].map((button, i) => button.setCustomId(componentCustomId(MARRIAGE_RESPONSE_COMPONENT_ID, ids[i]!)));
    const response = await ctx.reply({
      content: `${target}`,
      embeds: [
        baseEmbed(commandName)
          .setTitle("💍 Marriage Proposal")
          .setDescription(`${user.discordUser} is asking ${target} to marry them!`),
      ],
      components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons)],
      allowedMentions: { users: [target.id] },
    });
    await Promise.all(
      [true, false].map((accept, i) =>
        Components.create({
          id: ids[i]!,
          guildId,
          channelId: response.interaction.channelId,
          messageId: response.id,
          userId: target.id,
          type: "button",
          extraData: { proposerId: user.id, accept },
          expiresAt: new Date(Date.now() + PROPOSAL_WINDOW_MS),
        })
      )
    );
    return response;
  }
}
