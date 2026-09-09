import Command, { type ExecuteContext } from "../../../../command/command";
import { baseEmbed } from "../../../../lib/embed";
import BiteCommand from "./sub/bite.command";
import BlowkissCommand from "./sub/blowkiss.command";
import BonkCommand from "./sub/bonk.command";
import CuddleCommand from "./sub/cuddle.command";
import DanceCommand from "./sub/dance.command";
import FeedCommand from "./sub/feed.command";
import HeadpatCommand from "./sub/headpat.command";
import HoldhandsCommand from "./sub/holdhands.command";
import HugCommand from "./sub/hug.command";
import KissCommand from "./sub/kiss.command";
import PatCommand from "./sub/pat.command";
import PokeCommand from "./sub/poke.command";
import SlapCommand from "./sub/slap.command";
import TeaseCommand from "./sub/tease.command";
import TickleCommand from "./sub/tickle.command";
import WinkCommand from "./sub/wink.command";

export default class InteractionCommand extends Command {
  constructor() {
    super("interact", "Interact with others");

    this.registerSubCommand(new HugCommand());
    this.registerSubCommand(new KissCommand());
    this.registerSubCommand(new SlapCommand());
    this.registerSubCommand(new PatCommand());
    this.registerSubCommand(new CuddleCommand());
    this.registerSubCommand(new DanceCommand());
    this.registerSubCommand(new FeedCommand());
    this.registerSubCommand(new HeadpatCommand());
    this.registerSubCommand(new HoldhandsCommand());
    this.registerSubCommand(new PokeCommand());
    this.registerSubCommand(new WinkCommand());
    this.registerSubCommand(new TeaseCommand());
    this.registerSubCommand(new TickleCommand());
    this.registerSubCommand(new BonkCommand());
    this.registerSubCommand(new BlowkissCommand());
    this.registerSubCommand(new BiteCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }

  protected override async onExecuteSlash({ ctx, commandName }: ExecuteContext) {
    return ctx.reply({
      embeds: [baseEmbed(commandName).setDescription("Choose a subcommand: `/interact hug`")],
    });
  }
}
