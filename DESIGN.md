# Embed Design

Every embed in Shiroko is a **result card**: it tells the reader what happened,
not which command they ran. The title names the event, the summary line carries
the news, details carry the numbers, and flavor carries the personality.

## The three layers

Each embed is built from up to three layers, composed top-to-bottom.

| Layer           | Purpose                    | Format                                          | Example                      |
| --------------- | -------------------------- | ----------------------------------------------- | ---------------------------- |
| **1 · Summary** | The news, in one bold line | First line of the description, `**bold**`       | "You claimed **120 runes**." |
| **2 · Details** | Supporting numbers         | `addFields`, or a plain block under the summary | Wallet / Bank fields         |
| **3 · Flavor**  | Personality, always last   | Italic, `*…*`, separated by a blank line        | "Arona's moody side stirs…"  |

Default every embed to layers 1 + 2. Flavor (layer 3) is optional; when present
it is always the final line of the description.

### One-line embeds

Small confirmations ("Deposited 20 runes") collapse to a single summary line
with the amount inline; no fields are forced.

## Titles

Titles follow the grammar "**command result card**": an emoji marking the
category, then an event-style label. They name what happened, not the command
that produced it.

| Category           | Emoji    | Examples                            |
| ------------------ | -------- | ----------------------------------- |
| Runes / money flow | 💰       | 💰 Balance, 💰 Bank Deposit, 💸 Beg |
| Chance / RNG       | 🎰       | 🎰 Gamble                           |
| Streak / claim     | 🍩       | 🍩 Daily Runes                      |
| Rankings           | 🏆       | 🏆 Richest Runers                   |
| Fun / games        | 🎱       | 🎱 The 8-Ball Says…                 |
| Roles / actions    | 🤝       | 🤝 Cuddle, 🤝 Hug                   |
| Generic tooling    | _(none)_ | Avatar, Pong!                       |

## Trade formatting

Currency is always written via the `runes()` helper, which renders an inline
code block with thousands separators: `` `1,234 runes` ``. Never hand-write a
bare number for a rune amount.

## Footer

One footer, one job: **`<bot name> · /<command>`**, e.g. "Shiroko · /balance".
The bot name is Discord's default look, so it stays; the command name is the
useful part. Never repurpose the footer for other data — put that in fields
(e.g. avatar's user ID) or in layer 3 (e.g. the anime title).

## Errors and cooldowns

Errors, failed actions, and locked-out cooldowns use `errorEmbed()` — same
shape rules, but with `Constants.errorColor` (`#e74c3c`) — and the same
footer. Sparse text replies are reserved for bare/short answers with no
card-shaped content.

## Builder reference

```ts
baseEmbed("/balance"); // brand purple, footer "Shiroko · /balance"
errorEmbed("/beg"); // error red, same footer
runes(n); // `1,234 runes`
```

`baseEmbed` and `errorEmbed` return an `EmbedBuilder`, so chaining
`.setTitle()` and `.setDescription()` works as usual.
