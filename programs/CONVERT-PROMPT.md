# Converting a program document into i-lift JSON

Paste the prompt below into Claude, then paste your program document under it.
Claude returns JSON. Copy that into i-lift → Plans → Import Program.

---

Convert the training program below into JSON for my workout app. Return ONLY the
JSON in a single code block — no explanation before or after it.

## Shape

```json
[
  {
    "schemaVersion": 1,
    "name": "Program name",
    "weeks": 10,
    "restDays": [5, 6],
    "days": [
      {
        "name": "Quads + Abs",
        "exercises": [
          {
            "name": "Smith squat, feet forward",
            "muscle": "Quads",
            "type": "compound",
            "sets": 4,
            "reps": "6-8",
            "note": "[RP] rest-pause on final set. 3 ramp sets first. Rest 120s.",
            "superset": false
          }
        ]
      }
    ],
    "weekOverrides": [
      {
        "weeks": [4, 9],
        "label": "Joint back-off",
        "rules": [
          { "forType": "compound", "reps": "10-12" },
          { "match": "Barbell RDL", "reps": "8-10" }
        ]
      }
    ]
  }
]
```

## Rules

**Top level** is an array. The first program is activated; any others are filed
in the library. Use this to carry an alternate block or rotation.

- `restDays` — 0 = Sunday … 6 = Saturday. Training days fill the remaining
  weekdays in order, so `[5,6]` with 5 days gives Sun–Thu.
- `weeks` — total length of the block.

**Each exercise:**

| Field | Required | Notes |
|---|---|---|
| `name` | yes | The movement only. No day codes like "D1-A". |
| `muscle` | yes | The muscle this counts toward for weekly volume. |
| `sets` | yes | **Working sets only.** Ramp/warm-up sets go in `note`. |
| `reps` | yes | Free text: `"6-8"`, `"10-15"`, `"AMRAP"`. |
| `type` | no | `compound`, `isolation`, `fst7`, `abs`, `raise`. Used by override rules. |
| `fst7` | no | `true` marks an FST-7 finisher. Implied by `"type":"fst7"`. |
| `note` | no | Form cues, rest times, RIR targets, `[RP]` markers, ramp sets. |
| `superset` | no | `true` = performed with the NEXT exercise in the list. |

**Week overrides** change a base week rather than restating it. Each entry has
`weeks` (which weeks it applies to) and `rules`. A rule selects exercises by
`forType`, `forMuscle` or `match` (exact name), then applies `name`, `reps`,
`sets`, `note`, or `remove: true`.

`name` swaps the movement itself, which is how an exercise rotation is
expressed — one continuous program whose movements change partway, rather than
a second program that would restart the week counter:

```json
{ "weeks": [7, 8, 9, 10], "label": "Block B rotation",
  "rules": [ { "match": "Landmine row", "name": "Single-arm DB row" } ] }
```

Rules always match the exercise as written in `days`, never the result of an
earlier rule — so a later rule can still target a renamed movement by its
original name.

Rules run in order and later rules win, so a broad rule can be followed by a
specific exception:

```json
"rules": [
  { "forType": "compound", "reps": "10-12" },
  { "match": "Barbell RDL", "reps": "8-10" }
]
```

Several entries can touch the same week — they accumulate rather than replace,
so a deload and a retired exercise can both land on week 6.

## What to put where

- Deload weeks → an override with lower `reps` and `remove` on the FST-7 sets
- An exercise that retires partway → `remove` in an override for the later weeks
- A rotation or alternate block → `name` rules over the weeks it applies to,
  never a second program
- An exercise whose volume rises later → `sets` in an override
- Rest-pause, ramp sets, RIR caps, tempo, rest periods → `note`
- Weekly volume targets, cardio, nutrition, progression rules, checkpoints →
  **leave out**; the app tracks workouts, not programming rationale

## Check before returning

1. Weekly sets per muscle match the program's volume table (`sets` summed
   across all days for that muscle — FST-7 sets included)
2. Every `superset: true` has an exercise after it in the same day
3. `match` values are spelled exactly as the exercise `name`
4. Override weeks are within `1..weeks`
