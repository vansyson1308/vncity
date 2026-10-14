using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;

namespace HanoiCity.Systems
{
    /// <summary>
    /// Conditional dialogue (docs/gdd/02-he-thong.md §9), same semantics as the UE functions of the same
    /// names and tools/playtest.py: a line whose condition fails is skipped (with its goto and choices)
    /// and the walk continues in array order; choices whose condition fails are hidden.
    /// </summary>
    public sealed class DialogueRunner
    {
        readonly HanoiWorld world;

        public DialogueRunner(HanoiWorld world) { this.world = world; }

        public bool IsLineAvailable(HanoiDialogueLine line) => world.EvaluateCondition(line.Condition);

        public bool IsChoiceAvailable(HanoiDialogueLineChoice choice) => world.EvaluateCondition(choice.Condition);

        /// <summary>Line lineId (null = start), or the first available line after it in list order; null at the end.</summary>
        public HanoiDialogueLine ResolveLine(HanoiDialogueRow dialogue, string lineId)
        {
            int index = 0;
            if (!string.IsNullOrEmpty(lineId))
            {
                index = dialogue.Lines.FindIndex(l => l.Id == lineId);
                if (index < 0)
                {
                    world.Warn($"Dialogue {dialogue.Id} has no line {lineId}");
                    return null;
                }
            }
            for (; index < dialogue.Lines.Count; ++index)
                if (IsLineAvailable(dialogue.Lines[index])) return dialogue.Lines[index];
            return null;
        }

        /// <summary>The line after one without choices: its goto, else the next available line in order; null at the end.</summary>
        public HanoiDialogueLine NextLine(HanoiDialogueRow dialogue, HanoiDialogueLine line)
        {
            if (!string.IsNullOrEmpty(line.Goto)) return ResolveLine(dialogue, line.Goto);
            int index = dialogue.Lines.FindIndex(l => l.Id == line.Id);
            if (index < 0 || index + 1 >= dialogue.Lines.Count) return null;
            return ResolveLine(dialogue, dialogue.Lines[index + 1].Id);
        }

        public List<HanoiDialogueLineChoice> AvailableChoices(HanoiDialogueLine line) =>
            line.Choices.Where(IsChoiceAvailable).ToList();

        /// <summary>The player picked a choice: applies its effect (money, reputation, items, set_flags) and returns where to go.</summary>
        public HanoiDialogueLine ApplyChoice(HanoiDialogueRow dialogue, HanoiDialogueLine line, HanoiDialogueLineChoice choice)
        {
            world.ApplyReward(choice.Effect);
            if (!string.IsNullOrEmpty(choice.Goto)) return ResolveLine(dialogue, choice.Goto);
            return NextLine(dialogue, line);
        }
    }
}
