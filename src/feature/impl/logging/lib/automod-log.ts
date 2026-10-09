import { yesNo } from "@/lib/format";
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  type AutoModerationAction,
  type AutoModerationActionExecution,
  type AutoModerationRule,
} from "discord.js";
import { boldNameOrId, changeLine, code, codeList, detailLine, enumLabel, mentionList } from "./text";

const TRIGGER_NAMES: Record<number, string> = {
  [AutoModerationRuleTriggerType.Keyword]: "Keyword",
  [AutoModerationRuleTriggerType.Spam]: "Spam",
  [AutoModerationRuleTriggerType.KeywordPreset]: "Keyword Preset",
  [AutoModerationRuleTriggerType.MentionSpam]: "Mention Spam",
  [AutoModerationRuleTriggerType.MemberProfile]: "Member Profile",
};

const EVENT_NAMES: Record<number, string> = {
  [AutoModerationRuleEventType.MessageSend]: "Message Send",
  [AutoModerationRuleEventType.MemberUpdate]: "Member Update",
};

const ACTION_NAMES: Record<number, string> = {
  [AutoModerationActionType.BlockMessage]: "Block Message",
  [AutoModerationActionType.SendAlertMessage]: "Send Alert Message",
  [AutoModerationActionType.Timeout]: "Timeout",
  [AutoModerationActionType.BlockMemberInteraction]: "Block Member Interaction",
};

const PRESET_NAMES: Record<number, string> = {
  [AutoModerationRuleKeywordPresetType.Profanity]: "Profanity",
  [AutoModerationRuleKeywordPresetType.SexualContent]: "Sexual Content",
  [AutoModerationRuleKeywordPresetType.Slurs]: "Slurs",
};

function actionList(actions: readonly AutoModerationAction[]): string {
  if (actions.length === 0) {
    return "None";
  }
  return actions
    .map(action => {
      const name = enumLabel(ACTION_NAMES, action.type);
      const duration = action.metadata?.durationSeconds;
      return duration ? `${name} (${duration}s)` : name;
    })
    .join(", ");
}

function triggerLines(rule: AutoModerationRule): string[] {
  const lines: string[] = [];
  const metadata = rule.triggerMetadata;
  if (metadata.keywordFilter && metadata.keywordFilter.length > 0) {
    lines.push(detailLine("Keywords", codeList(metadata.keywordFilter)));
  }
  if (metadata.regexPatterns && metadata.regexPatterns.length > 0) {
    lines.push(detailLine("Regex", codeList(metadata.regexPatterns)));
  }
  if (metadata.presets && metadata.presets.length > 0) {
    lines.push(
      detailLine("Presets", metadata.presets.map(preset => enumLabel(PRESET_NAMES, preset)).join(", "))
    );
  }
  if (metadata.mentionTotalLimit !== null && metadata.mentionTotalLimit !== undefined) {
    lines.push(detailLine("Mention Limit", String(metadata.mentionTotalLimit)));
  }
  return lines;
}

function exemptionLines(rule: AutoModerationRule): string[] {
  const lines: string[] = [];
  if (rule.exemptRoles.size > 0) {
    lines.push(detailLine("Exempt Roles", mentionList([...rule.exemptRoles.keys()], "@&")));
  }
  if (rule.exemptChannels.size > 0) {
    lines.push(detailLine("Exempt Channels", mentionList([...rule.exemptChannels.keys()], "#")));
  }
  return lines;
}

export function automodRuleDetailLines(rule: AutoModerationRule): string[] {
  return [
    detailLine("Trigger", code(enumLabel(TRIGGER_NAMES, rule.triggerType))),
    detailLine("Event", code(enumLabel(EVENT_NAMES, rule.eventType))),
    detailLine("Actions", actionList(rule.actions)),
    detailLine("Enabled", code(yesNo(rule.enabled))),
    ...triggerLines(rule),
    ...exemptionLines(rule),
  ];
}

export function describeAutomodRuleChanges(
  oldRule: AutoModerationRule,
  newRule: AutoModerationRule
): string[] {
  const lines: string[] = [];
  if (oldRule.name !== newRule.name) {
    lines.push(changeLine("Name", code(oldRule.name), code(newRule.name)));
  }
  if (oldRule.triggerType !== newRule.triggerType) {
    lines.push(
      changeLine(
        "Trigger",
        enumLabel(TRIGGER_NAMES, oldRule.triggerType),
        enumLabel(TRIGGER_NAMES, newRule.triggerType)
      )
    );
  }
  if (oldRule.eventType !== newRule.eventType) {
    lines.push(
      changeLine(
        "Event",
        enumLabel(EVENT_NAMES, oldRule.eventType),
        enumLabel(EVENT_NAMES, newRule.eventType)
      )
    );
  }
  if (actionList(oldRule.actions) !== actionList(newRule.actions)) {
    lines.push(changeLine("Actions", actionList(oldRule.actions), actionList(newRule.actions)));
  }
  if (oldRule.enabled !== newRule.enabled) {
    lines.push(changeLine("Enabled", yesNo(oldRule.enabled), yesNo(newRule.enabled)));
  }
  lines.push(...changedBlocks(triggerLines(oldRule), triggerLines(newRule)));
  lines.push(...changedBlocks(exemptionLines(oldRule), exemptionLines(newRule)));
  return lines;
}

/**
 * The new side of a detail block that changed, or no lines at all. Both
 * sides are rebuilt from the rule rather than diffed field by field, since
 * a trigger's keyword list has no stable per-entry identity.
 */
function changedBlocks(oldLines: string[], newLines: string[]): string[] {
  return oldLines.join("\n") === newLines.join("\n") ? [] : newLines;
}

export function automodRuleLabel(rule: AutoModerationRule | null, ruleId: string): string {
  return boldNameOrId(rule?.name, ruleId);
}

/**
 * A rule's match as ready-to-print lines: the action taken, who triggered
 * it, and what the filter caught. The rule's own name is the caller's
 * headline, so it is not repeated here.
 */
export function automodExecutionLines(execution: AutoModerationActionExecution): string[] {
  const lines = [
    detailLine("Action", code(enumLabel(ACTION_NAMES, execution.action.type))),
    detailLine("User", mentionList([execution.userId], "@")),
  ];
  if (execution.channel) {
    lines.push(detailLine("Channel", mentionList([execution.channel.id], "#")));
  }
  if (execution.matchedKeyword) {
    lines.push(detailLine("Matched Keyword", code(execution.matchedKeyword)));
  }
  if (execution.matchedContent) {
    lines.push(detailLine("Matched Content", code(execution.matchedContent)));
  }
  if (execution.content) {
    lines.push(detailLine("Content", code(execution.content)));
  }
  return lines;
}
