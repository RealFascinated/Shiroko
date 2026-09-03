import Command, { type ExecuteContext } from "../../../command/command";
import { baseEmbed } from "../../../lib/embed";
import BiteCommand from "./sub/bite.command";
import BlowkissCommand from "./sub/blowkiss.command";
import BlushCommand from "./sub/blush.command";
import BonkCommand from "./sub/bonk.command";
import CarryCommand from "./sub/carry.command";
import ClapCommand from "./sub/clap.command";
import CryCommand from "./sub/cry.command";
import CuddleCommand from "./sub/cuddle.command";
import DanceCommand from "./sub/dance.command";
import FeedCommand from "./sub/feed.command";
import HeadpatCommand from "./sub/headpat.command";
import HighfiveCommand from "./sub/highfive.command";
import HoldhandsCommand from "./sub/holdhands.command";
import PeckCommand from "./sub/peck.command";
import PokeCommand from "./sub/poke.command";
import TeaseCommand from "./sub/tease.command";
import ThumbsupCommand from "./sub/thumbsup.command";
import TickleCommand from "./sub/tickle.command";
import WaveCommand from "./sub/wave.command";
import WinkCommand from "./sub/wink.command";
import YeetCommand from "./sub/yeet.command";

export default class InteractionCommand extends Command {
  constructor() {
    super("interact", "Interact with others");

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
    this.registerSubCommand(new WaveCommand());
    this.registerSubCommand(new CryCommand());
    this.registerSubCommand(new ThumbsupCommand());
    this.registerSubCommand(new BlowkissCommand());
    this.registerSubCommand(new PeckCommand());
    this.registerSubCommand(new BiteCommand());
    this.registerSubCommand(new HighfiveCommand());
    this.registerSubCommand(new ClapCommand());
    this.registerSubCommand(new YeetCommand());
    this.registerSubCommand(new CarryCommand());
    this.registerSubCommand(new BlushCommand());
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
