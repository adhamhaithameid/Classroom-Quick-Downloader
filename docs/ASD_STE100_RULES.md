# ASD-STE100 Output Rules for AI Agents

## Purpose
Write all prose output in ASD-STE100 Simplified Technical English (Issue 9
principles): short sentences, simple words, one meaning per word. The goal is
that a non-native English reader understands the text at first read, without
guessing.

## Scope
Applies to: chat replies, commit messages, PR descriptions, documentation,
release notes, status updates, and bug reports.
Does NOT apply to: code identifiers (variables, functions, classes), product
UI copy, quoted user text, file paths, and shell commands.

## Writing rules
1. Keep sentences short. Maximum 20 words in instructions; maximum 25 words
   in descriptive text.
2. Write one instruction (or one topic) per sentence.
3. Use the active voice. Use passive voice only when the agent is unknown
   ("The file was deleted."), and name the agent when you know it.
4. Write one topic per paragraph, with maximum 6 sentences per paragraph.
5. Use approved verb forms only: simple present, simple past, simple future,
   imperative, infinitive. Do not build complex verb constructions with
   auxiliary verbs.
6. Do not use the "-ing" form of a verb unless it is a technical noun
   ("the config file is missing" is STE; "ongoing refactoring efforts" is
   not).
7. Use each word with one meaning only. "Test" is a noun: "do a test",
   not "test it".
8. Do not use multi-word nouns with more than three words.
9. Do not use idioms, slang, metaphors, jokes, or cultural references.
   A game starts; it does not kick off.
10. Do not use double negatives. Write one clear negative or the positive
    statement.
11. Do not use contractions ("do not", not "don't"). Keep the articles
    ("the", "a") in sentences.
12. Use the same word for the same thing. Do not alternate synonyms.
13. Use vertical lists for data or steps with more than two items.
14. In procedures, start each step with the command verb. Put warnings and
    cautions before the step.
15. Split complex text into more sentences. Do not omit words (the subject,
    the article) only to make sentences shorter.

## Word guidance
- Prefer the shortest common word: "use", not "utilize"; "start", not
  "initiate"; "before", not "prior to".
- Treat the STE Approved Word List (~900 words) as the target vocabulary.
  You do not have the full list, so approximate it: high-frequency English
  words, one sense each.
- Technical terms that are not approved words are allowed (the spec calls
  them "technical names" and "technical verbs"). Define a technical term on
  first use: "O(n log n) — how the sort time grows as data grows".
- Do not invent a new term for a thing you already named.

## Examples

Commit message — before:
"Refactored auth layer to leverage modern async patterns, kicking off the
long-overdue cleanup of the legacy session nightmare."
After:
"Make the auth module use async functions. Remove the old session code. Do
not migrate session data; see ticket ABC-123."

Status update — before:
"We're currently experiencing some issues with the deployment pipeline,
which has been acting up since this morning, though we're actively looking
into it."
After:
"The deployment pipeline failed at 09:15. The build step gave error E403. We
are investigating the cause. The next update comes at 14:00."

Bug report — before:
"Users can't seem to export their reports whenever the dataset is
particularly large — it just silently fails without any error."
After:
"Export fails for datasets larger than 50000 rows. The app shows no error.
To reproduce: load the sample dataset, click Export, wait 60 seconds.
Expected: the export completes. Actual: no file is created."

## Conflicts with other styles
If another active style conflicts with these rules (for example a "caveman"
or ultra-terse style), these STE rules win for prose. STE does not govern
code identifiers or UI copy.

## Compliance check (before you send output)
- Are all sentences 25 words or fewer?
- Does each sentence give one instruction or one topic?
- Is the voice active, except where the agent is unknown?
- Are there no idioms, jokes, metaphors, contractions, or double negatives?
- Is every technical term defined on first use, and is terminology
  consistent?

## Sources
- https://asd-ste100.org/ — official site; official Issue 9 copy free on
  request (verified via fetch; no rule text public on the site)
- https://en.wikipedia.org/wiki/Simplified_Technical_English — verified
  non-exhaustive rule list (fetched)
- https://github.com/danyuchn/asd-ste100-skill — prior art: STE as an agent
  rule file
