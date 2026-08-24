import Command, { type ExecuteContext } from "../../../command/command";
import { stringOption } from "../../../command/option";
import { remainingMs } from "../../../lib/cooldown/cooldowns";
import { baseEmbed } from "../../../lib/embed";
import { TimeUnit } from "../../../lib/time";
import { pick } from "../../../lib/utils";
import { economyConfig } from "../config";
import { startEconomyCooldown } from "../cooldowns";
import { runesService } from "../runes.service";

/** Result lines keyed by job name; each renders the payout text. */
const JOB_RESULTS: Record<string, Array<(pay: number) => string>> = {
  security: [
    pay =>
      `You clock in, put on the shades, and stand guard at the Summit entrance. **${pay} runes** for your trouble.`,
    pay => `A kid tries to sneak a soda past you. One look and they put it back. **${pay} runes** earned.`,
    pay => `You patrol the food court looking suitably mysterious. **${pay} runes** in your pocket.`,
    pay =>
      `You catch a shoplifter trying to swipe a cheap soda. They pay double out of shame. **${pay} runes** for you.`,
    pay => `You spend the shift helping lost kids find their parents. **${pay} runes** for being a hero.`,
    pay => `A stray Shiba wanders through. You guard it like a VIP for an hour. **${pay} runes** earned.`,
    pay => `You break up a turf war over a vending machine. **${pay} runes** for your bravery.`,
  ],
  vending: [
    pay => `You restock the vending machines. The instant coffee vanishes first. **${pay} runes** earned.`,
    pay => `You wrestle the machine that ate someone's change. **${pay} runes** for your effort.`,
    pay => `Fully loaded soda racks, zero casualties. **${pay} runes** paid out.`,
    pay =>
      `You find an old bottle of Sobacola behind a machine and pocket it. **${pay} runes** plus a mystery soda.`,
    pay =>
      `A machine jams every single can. You fix it with a firm handshake and a lot of patience. **${pay} runes**.`,
    pay => `You rotate the stock so the fresh sodas are in front. Store policy. **${pay} runes** earned.`,
    pay => `You refill a machine with fifty sodas and only cry once. **${pay} runes** for your resilience.`,
  ],
  soda: [
    pay => `You ferry sodas around the Summit in record time. **${pay} runes** for the delivery.`,
    pay => `Twelve soda deliveries and only two spilled. Arona would be proud. **${pay} runes** earned.`,
    pay => `You run sodas until your legs give out. **${pay} runes** for your dedication.`,
    pay => `You deliver a single soda across three floors because someone paid extra. **${pay} runes**.`,
    pay =>
      `You transport a fresh batch to the security desk and get a nod of approval. **${pay} runes** earned.`,
    pay => `You almost trip with a full tray of sodas, then somehow save all of them. **${pay} runes**.`,
    pay => `You become known as the Soda Runner of the Summit. The legends grow. **${pay} runes** paid out.`,
  ],
  intern: [
    pay => `You file foreclosure papers and dodge angry stares. **${pay} runes** for your trouble.`,
    pay => `You organize the filing room. Nobody thanks you, but the runes show up. **${pay} runes** earned.`,
    pay => `You spend the shift photocopying and questioning your life choices. **${pay} runes**.`,
    pay =>
      `You sort paperwork for hours and find a cheesy romance novel hidden in the archives. **${pay} runes**.`,
    pay => `You run the office coffee machine better than anyone. **${pay} runes** for your service.`,
    pay => `You learn 30 ways to say "we'll call you back" while answering phones. **${pay} runes**.`,
    pay => `You sneak a nap in the storage closet and somehow don't get caught. **${pay} runes** earned.`,
  ],
  barista: [
    pay => `You craft a boba so perfect a customer takes a photo of it. **${pay} runes** for your art.`,
    pay => `You survive the lunch rush with a smile (mostly). **${pay} runes** earned.`,
    pay => `You make a drink with extra boba and the customer's day is made. **${pay} runes**.`,
    pay => `You steam milk, shake tea, and refuse to ask how the boba gets in. **${pay} runes** paid out.`,
    pay => `You name a drink after a shy customer's dog. They order it twice more. **${pay} runes** earned.`,
    pay => `Only three spills today. A personal record. **${pay} runes** for your grace.`,
  ],
  gacha: [
    pay =>
      `You restock gacha machines. A kid pulls three rares in a row and you take full credit. **${pay} runes**.`,
    pay =>
      `You refill the capsule machine and slip in a little bonus prize. **${pay} runes** for your kindness.`,
    pay => `You wrestle a jammed gacha machine free with a spoon and sheer will. **${pay} runes**.`,
    pay =>
      `You check that every capsule is seated. Nothing is jankier than a half-stuck capsule. **${pay} runes**.`,
    pay =>
      `You witness someone get exactly what they wanted. Their scream of joy echoes. **${pay} runes** earned.`,
    pay => `You spend the shift keeping the machines from being shaken to death. **${pay} runes**.`,
  ],
  janitor: [
    pay =>
      `You mop the food court while a kid skids across the wet floor. Liability paperwork avoided. **${pay} runes**.`,
    pay =>
      `You clean up after a soda explosion that somehow involved confetti. **${pay} runes** for your bravery.`,
    pay => `You polish the fountain and a coin lands at your feet like a tip. **${pay} runes** earned.`,
    pay => `You find a lost keychain in the vents and return it. **${pay} runes** plus a smile.`,
    pay => `You take out the trash and feel a quiet sense of purpose. **${pay} runes**.`,
    pay => `You sweep up glitter for an hour. It's still glittering. **${pay} runes** for your patience.`,
  ],
  delivery: [
    pay => `You run food across the food court like a relay star. **${pay} runes** earned.`,
    pay => `You deliver a tray of steaming ramen without spilling a drop. **${pay} runes**.`,
    pay =>
      `You shave seconds off your delivery record. The kitchen staff applaud. **${pay} runes** paid out.`,
    pay => `You carry five orders at once and emerge victorious. **${pay} runes** for your triumph.`,
    pay => `One customer tips you with a sticker of a smiling soda can. **${pay} runes** and a new friend.`,
    pay => `You brave the lunch rush and deliver everything hot. **${pay} runes** earned.`,
  ],
};

/** Bonus payout lines for the internship's lucky days. */
const BONUS_LINES: Array<(bonus: number) => string> = [
  bonus => `A friendly old-timer slips you an extra **${bonus} runes** for your trouble.`,
  bonus => `An old-timer pats you on the back and quietly hands you **${bonus} runes**. "Nice work, kid."`,
  bonus => `A grumpy old-timer tosses **${bonus} runes** at you. "For the soda fund."`,
  bonus =>
    `The old-timer at the counter winks and adds **${bonus} runes** to your pay. "Don't tell the boss."`,
  bonus =>
    `"Here's **${bonus} runes**," an old-timer says, pushing them toward you. "You earned it, unlike the last three."`,
  bonus =>
    `A mysterious old-timer gives you **${bonus} runes**. "A tip from a friend of a friend of an Arona."`,
  bonus =>
    `The old-timer treats the whole office to coffee with your bonus. **${bonus} runes**... but you're the hero.`,
] as const;

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

  protected override async onExecuteSlash({ globalUser, ctx, args }: ExecuteContext) {
    const cd = await startEconomyCooldown(globalUser.id, "work", economyConfig.workCooldownMs);
    if (!cd.ok) {
      const mins = Math.ceil(remainingMs(cd.cooldown.endsAt) / TimeUnit.toMillis(TimeUnit.Minute, 1));
      return ctx.reply(
        `You're still on shift cooldown. Come back in ${mins} minute${mins === 1 ? "" : "s"}.`
      );
    }

    const jobName = args.string("job")!;
    const job = economyConfig.workJobs[jobName];
    if (!job) {
      return ctx.reply("That's not a real job at the Summit.");
    }

    let pay: number;
    let bonus = 0;

    if (job.kind === "variable") {
      const [min, max] = job.pay;
      pay = min + Math.floor(Math.random() * (max - min + 1));
      if (job.bonus && Math.random() < job.bonus.chance) {
        bonus = job.bonus.amount;
      }
    } else {
      pay = job.pay;
    }

    const total = pay + bonus;
    await runesService.addMoney(globalUser.id, total, "wallet");

    const resultLines = JOB_RESULTS[jobName] ?? [pay => `You earn **${pay} runes**.`];
    const lines = [pick(resultLines)(pay)];
    if (bonus > 0) {
      lines.push(pick(BONUS_LINES)(bonus));
    }

    const embed = baseEmbed().setTitle("Work at the Summit").setDescription(lines.join("\n"));
    return ctx.reply({ embeds: [embed] });
  }
}
