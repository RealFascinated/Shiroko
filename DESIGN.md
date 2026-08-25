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

## Buttons

Buttons are one-shot confirmations attached to a result card. They follow a
fixed label grammar and disable themselves the moment they're used.

### Labels

Action buttons use **Title Case**: capitalize the action and "Back",
e.g. **"Hug Back!"**, **"Kiss Back!"**, **"Headpat Back!"**, never
sentence case ("hug back!"). The verb form follows the interaction's `verb`
field, so "holds hands with" renders as **"Holdhands Back!"** (the command
id, not the full phrase), and the label stays under Discord's 80-char cap.

### Button life

Every button is **one-shot**:

- It lives on exactly one reply (each interaction gets its own button).
- On a valid press the components are stripped from the message
  (`button.update({ components: [] })`) _before_ the press is handled, so it
  can never fire twice.
- When the collection window (`interactionConfig.backButtonWindowMs`) elapses,
  the components are stripped again, leaving a clean card.
- Only the user the card is addressed to may press; presses from anyone else
  are ignored entirely.

The generic plumbing lives in `watchButtonPress(response, options)` in
`src/lib/embed.ts`: custom id + allowed user + window, then an `onPress`
callback. So every future button should route through it instead of
hand-rolling collectors.

## Mentions in embeds

User names inside result cards render as **mentions** (`<@id>`), and each
user is mentioned **exactly once** per embed. This keeps cards scannable and
ping-capable without repeating names:

> **@Lee** headpats **@Bray** for the **2nd time**!

Titles keep the pretty display name (e.g. _"Budd Dwyer's Avatar"_,
_"💰 Budd Dwyer's Balance"_); only body text mentions.

## Trade formatting

Currency is always written via the `runes()` helper, which renders an inline
code block with thousands separators: `` `1,234 runes` ``. Never hand-write a
bare number for a rune amount.

## Footer

One footer, one job: **`<bot name> · /<command>`**, e.g. "Shiroko · /balance".
The bot name is Discord's default look, so it stays; the command name is the
useful part. Never repurpose the footer for other data; put that in fields
(e.g. avatar's user ID) or in layer 3 (e.g. the anime title).

## Errors and cooldowns

Errors, failed actions, and locked-out cooldowns use `errorEmbed()`: same
shape rules, but with `Constants.errorColor` (`#e74c3c`) and the same
footer. Sparse text replies are reserved for bare/short answers with no
card-shaped content.

> **Rule:** errors and warnings are **ephemeral**; the error reply carries
> `flags: MessageFlags.Ephemeral`, so only the invoking user sees it. Success
> cards keep a normal channel reply. (Adopted 2026-08-25; replacement for the
> earlier temporary experiment marker.)

## Builder reference

```ts
baseEmbed("/balance"); // brand purple, footer "Shiroko · /balance"
errorEmbed("/beg"); // error red, same footer
runes(n); // `1,234 runes`
```

`baseEmbed` and `errorEmbed` return an `EmbedBuilder`, so chaining
`.setTitle()` and `.setDescription()` works as usual.
