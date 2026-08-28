import Command, { type ExecuteContext } from "../../../command/command";
import { stringOption } from "../../../command/option";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed, ephemeralErrorReply, errorEmbed, runes } from "../../../lib/embed";
import { pluralize } from "../../../lib/format";
import { randInt } from "../../../lib/math";
import { TimeUnit } from "../../../lib/time";
import { pick } from "../../../lib/utils";
import { addQuestProgress } from "../../quest/quests.service";
import { economyConfig } from "../config";
import { startEconomyCooldown } from "../cooldowns";
import { runesService } from "../runes.service";

/** Result lines keyed by job name. */
const JOB_RESULTS: Record<string, string[]> = {
  security: [
    `You clock in, put on the shades, and stand guard at the Summit entrance.`,
    `A kid tries to sneak a soda past you. One look and they put it back.`,
    `You patrol the food court looking suitably mysterious.`,
    `You catch a shoplifter trying to swipe a cheap soda. They pay double out of shame.`,
    `You spend the shift helping lost kids find their parents.`,
    `A stray Shiba wanders through. You guard it like a VIP for an hour.`,
    `You break up a turf war over a vending machine.`,
  ],
  vending: [
    `You restock the vending machines. The instant coffee vanishes first.`,
    `You wrestle the machine that ate someone's change.`,
    `Fully loaded soda racks, zero casualties.`,
    `You find an old bottle of Sobacola behind a machine and pocket it, plus a mystery soda.`,
    `A machine jams every single can. You fix it with a firm handshake and a lot of patience.`,
    `You rotate the stock so the fresh sodas are in front. Store policy.`,
    `You refill a machine with fifty sodas and only cry once.`,
  ],
  soda: [
    `You ferry sodas around the Summit in record time.`,
    `Twelve soda deliveries and only two spilled. Arona would be proud.`,
    `You run sodas until your legs give out.`,
    `You deliver a single soda across three floors because someone paid extra.`,
    `You transport a fresh batch to the security desk and get a nod of approval.`,
    `You almost trip with a full tray of sodas, then somehow save all of them.`,
    `You become known as the Soda Runner of the Summit. The legends grow.`,
  ],
  intern: [
    `You file foreclosure papers and dodge angry stares.`,
    `You organize the filing room. Nobody thanks you, but the runes show up.`,
    `You spend the shift photocopying and questioning your life choices.`,
    `You sort paperwork for hours and find a cheesy romance novel hidden in the archives.`,
    `You run the office coffee machine better than anyone.`,
    `You learn 30 ways to say "we'll call you back" while answering phones.`,
    `You sneak a nap in the storage closet and somehow don't get caught.`,
  ],
  barista: [
    `You craft a boba so perfect a customer takes a photo of it.`,
    `You survive the lunch rush with a smile (mostly).`,
    `You make a drink with extra boba and the customer's day is made.`,
    `You steam milk, shake tea, and refuse to ask how the boba gets in.`,
    `You name a drink after a shy customer's dog. They order it twice more.`,
    `Only three spills today. A personal record.`,
  ],
  gacha: [
    `You restock gacha machines. A kid pulls three rares in a row and you take full credit.`,
    `You refill the capsule machine and slip in a little bonus prize.`,
    `You wrestle a jammed gacha machine free with a spoon and sheer will.`,
    `You check that every capsule is seated. Nothing is jankier than a half-stuck capsule.`,
    `You witness someone get exactly what they wanted. Their scream of joy echoes.`,
    `You spend the shift keeping the machines from being shaken to death.`,
  ],
  janitor: [
    `You mop the food court while a kid skids across the wet floor. Liability paperwork avoided.`,
    `You clean up after a soda explosion that somehow involved confetti.`,
    `You polish the fountain and a coin lands at your feet like a tip.`,
    `You find a lost keychain in the vents and return it.`,
    `You take out the trash and feel a quiet sense of purpose.`,
    `You sweep up glitter for an hour. It's still glittering.`,
  ],
  delivery: [
    `You run food across the food court like a relay star.`,
    `You deliver a tray of steaming ramen without spilling a drop.`,
    `You shave seconds off your delivery record. The kitchen staff applaud.`,
    `You carry five orders at once and emerge victorious.`,
    `One customer tips you with a sticker of a smiling soda can and a new friend.`,
    `You brave the lunch rush and deliver everything hot.`,
  ],
};

/** Bonus payout lines for the internship's lucky days. */
const BONUS_LINES = [
  `A friendly old-timer slips you an extra tip for your trouble.`,
  `An old-timer pats you on the back and quietly tops up your pay. "Nice work, kid."`,
  `A grumpy old-timer tosses you a tip. "For the soda fund."`,
  `The old-timer at the counter winks and adds to your pay. "Don't tell the boss."`,
  `An old-timer pushes a tip toward you. "You earned it, unlike the last three."`,
  `A mysterious old-timer slides you a tip. "From a friend of a friend of an Arona."`,
  `The old-timer treats the whole office to coffee with your bonus... but you're the hero.`,
];

/**
 * Work a part-time job at the Summit for runes. Short cooldown, no RNG for
 * the base job; the intern/gacha jobs have a chance of a bonus payout.
 */
export default class WorkCommand extends Command {
  constructor() {
    super("work", "Work a part-time job at the Summit");
  }

  public override get userInstallable(): boolean {
    return true;
  }

  public override get options() {
    return [
      stringOption(true, "job", "Which job to work", {
        choices: {
          security: "Security",
          vending: "Vending restock",
          soda: "Soda runner",
          intern: "Foreclosure Office intern",
          barista: "Boba barista",
          gacha: "Gacha restock",
          janitor: "Janitor",
          delivery: "Food court delivery",
        },
      }),
    ];
  }

  protected override async onExecuteSlash({ globalUser, ctx, args, commandName }: ExecuteContext) {
    const cd = await startEconomyCooldown(globalUser.id, "work", economyConfig.workCooldownMs);
    if (!cd.ok) {
      const mins = Math.ceil(remainingMs(cd.cooldown.endsAt) / TimeUnit.toMillis(TimeUnit.Minute, 1));
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription(
            `You're still on shift cooldown. Come back in ${pluralize("minute", mins)}.`
          )
        )
      );
    }

    const jobName = args.string("job")!;
    const job = economyConfig.workJobs[jobName];
    if (!job) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("That's not a real job at the Summit.")
        )
      );
    }

    let pay: number;
    let bonus = 0;

    if (job.kind === "variable") {
      const [min, max] = job.pay;
      pay = randInt(min, max);
      if (job.bonus && Math.random() < job.bonus.chance) {
        bonus = job.bonus.amount;
      }
    } else {
      pay = job.pay;
    }

    const total = pay + bonus;
    const balance = await runesService.addMoney(globalUser.id, total, "wallet", "work");
    await addQuestProgress(globalUser.id, "work", 1);
    await addQuestProgress(globalUser.id, "earn", total);

    const resultLines = JOB_RESULTS[jobName] ?? [`You earn ${runes(pay)}.`];
    const lines = [pick(resultLines)];
    if (bonus > 0) {
      lines.push(pick(BONUS_LINES));
    }

    const embed = baseEmbed(commandName)
      .setTitle("💼 Clock In")
      .setDescription(
        `You earned **${total.toLocaleString()} runes**.\n${runes(balance.wallet)} in your wallet.\n\n*${lines.join(
          " "
        )}*`
      );
    return ctx.reply({ embeds: [embed] });
  }
}
