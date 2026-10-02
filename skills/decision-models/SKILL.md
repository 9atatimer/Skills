---
name: decision-models
description: "Choosing how a system makes a bounded judgement -- yes/no, one of N, a score on an ordered rubric -- among rules, a fine-tuned small encoder (BERT-class), a decision model (Jev, Clef and kin: typed questions arrive per call, probabilities come out, nothing is generated), and a generative LLM. Defines the DecisionPort that keeps that choice an adapter swap, the threshold and abstention policy that belong in the core, and the evaluation that must precede adopting any of them. Load at phase 3 when a design asks a model to classify, gate, route, triage, or judge, and whenever a dependency on a decision model is proposed. Skip for open-ended generation, extracting free text, and retrieval (knowledge-base)."
---

# Decision Models

> **Purpose:** make "a model decides X" an architectural choice made on
> purpose, instead of a prompt that asks a chat model and parses its prose.
> **Scope:** the domain language of a judgement, the ladder of ways to make
> one, the one port that keeps the choice reversible, the policy that stays
> in the core, and the evaluation that decides between them.
> **Companion skills:** architecture (a judgement is an axis of change, and
> this is its seam), coding (stable core / volatile edges), testing,
> tech-radar (rows land with the code), knowledge-base (retrieval is a
> different problem).

## The short version

- **A judgement with a bounded answer is not a generation problem.** If the
  output is yes/no, one of a fixed set, or a point on a rubric, a model
  that scores the options directly is faster, cheaper, and returns a
  probability you can threshold. A chat model asked the same question
  returns prose you have to parse and a confidence you cannot trust.
- **Climb the ladder only as far as you must.** Rules, then a fine-tuned
  small encoder, then a decision model, then a generative LLM. Each rung
  costs more per call and buys flexibility the lower one lacks.
- **One port, every rung behind it.** `DecisionPort(state, schema) ->
  Decision`. The incumbent LLM prompt, a hosted decision API, and a local
  model are three adapters, so moving between them is a measurement, not a
  rewrite.
- **Nothing is adopted without a labelled eval set.** A vendor's benchmark
  says what the model does on its tasks. Only your examples say what it
  does on yours.

## What a decision model is

A pretrained model reads the input once, and a small head on top scores
every allowed answer of every question together. No tokens are generated.
It is the shape BERT made standard in 2018 -- a pretrained encoder plus a
classification head -- with two differences that matter:

- **The questions are inputs, not weights.** A classic classifier's label
  set is baked in at training time. A decision model takes the questions
  and their options with each call, so one deployment answers questions
  nobody had thought of when it was trained.
- **The backbone is a modern multimodal LLM**, so the state can be long and
  can include images, and the model brings world knowledge to the
  judgement.

## The domain

| Term | What it is | What it is not |
|---|---|---|
| **State** | Everything the judgement is about: text, structured fields, images | The question |
| **Question** | One typed ask with a stable id: **binary** (probability of yes), **choice** (one of a named option set), or **score** (a point on an ordered rubric) | A free-text prompt |
| **Schema** | The set of questions asked of one state in one call | A wire format |
| **Decision** | Per question: the probability of each option, and the expected score for a rubric -- or, from an adapter that cannot score, the label alone, marked uncalibrated | A single picked answer dressed up as a probability |
| **Threshold policy** | The rule that turns a Decision into an action, including when to abstain | Something the adapter or the model decides |
| **Abstention** | The outcome "not confident enough; route elsewhere" (a rule, a human, a bigger model) | An error |
| **Eval set** | Labelled states, with the answer each question should get | A vendor benchmark |

Three invariants, each a defect when violated:

- **An uncalibrated Decision never meets a threshold.** An adapter that can
  only produce a label (a parsed chat reply) reports the label with no
  probability. The threshold policy never compares it against a threshold:
  it acts on the label only through an explicit rule that says so -- the
  status quo of a wrapped incumbent -- or it abstains. A sentinel such as
  1.0 would pass every threshold and turn a guess into certainty.
- **Thresholds live in the core.** Which probability counts as "yes", and
  when to abstain, is a business rule stated once, in the problem's
  language. A threshold inside an adapter or a prompt is a leak.
- **A question's id and options are stable.** The eval set, the threshold
  policy, and every stored Decision key off them. Renaming an option is a
  migration, not an edit.

## The ladder

| Rung | Reach for it when | Costs | Cannot |
|---|---|---|---|
| **Rules** | A deterministic signal exists (a regex, a count, a field) | Nothing per call | Handle ambiguity |
| **Fine-tuned small encoder** (BERT-class) | The label set is fixed, volume is huge, and you have hundreds of labelled examples | Training once; milliseconds per call on CPU | Take a new question without retraining |
| **Decision model** (Jev, Clef and kin) | The questions vary per call or per feature, the state is long or visual, or there is too little data to fine-tune | A GPU or a hosted API; tens to hundreds of ms per call | Produce text, extract spans, or reason across steps |
| **Generative LLM** | The answer is open-ended, needs extraction, or needs multi-step reasoning | Seconds per call, metered tokens | Return a calibrated probability |

Two rules about the ladder:

- **Prefer a rule where one exists, whatever sits above it.** A
  deterministic rule beats a model judgement on the cases it covers. Run
  the rule first and send only what it cannot decide to the model.
- **Mixed jobs split.** "Classify the page, then list its headings" is a
  decision plus an extraction. Two calls, two ports -- not one prompt that
  does both badly.

## Decisions and mechanisms

| Core (decisions -- the domain) | Edge (mechanisms -- adapters) |
|---|---|
| The questions, their ids and options | The model, its weights, and its revision |
| The threshold and abstention policy | The hosted API, its endpoint, and its auth |
| What happens on abstention, and on a port failure | The serving runtime and the hardware |
| Which eval set gates adoption, and its floor | The prompt and parser of an LLM adapter |

The grep test applies: a model id, a vendor name, or an endpoint inside
domain code is a leak.

## The port

| Port | Contract | Why it is a seam |
|---|---|---|
| `DecisionPort` | State plus Schema in; a Decision out, or a typed failure (unavailable, rejected input) | The rung, the vendor, and where it runs are all volatile. Hosted, local, and the incumbent LLM prompt are adapters of one port |

- **Wrap the incumbent first.** If the judgement is made today by
  prompting a chat model, that prompt becomes the first `DecisionPort`
  adapter, unchanged. It is the baseline every other adapter is measured
  against, and it keeps running while they are.
- **A failure is not an answer.** When the port fails (unavailable, rejected
  input), the core decides what happens, once, in the problem's language:
  retry, fall back to another adapter, abstain, or deny. For a gate, a
  failure never takes the path a "yes" would.
- **Do not add a port for one call site that will never move.** A rule that
  will stay a rule needs no port (YAGNI; record the rejection in the design
  doc).

## Choosing where it runs

- **Hosted** -- fastest to try. Per-call cost, and the state leaves your
  machine: a scan, a document, or user data goes to the vendor. Decide
  that in the design doc, not by default.
- **Local** -- no per-call cost and nothing leaves the machine, so it suits
  large overnight batches. It needs the weights to fit the GPU's memory
  with headroom; check that before designing around a model, not after.
  In the LMDE the place for local decision models is the **decision
  arena** (tds-utils), behind the LMDE proxy layer -- not a model loaded
  inside each consumer.
- **Either way, behind the port.** Moving from hosted to local, or from one
  model to a better one, changes the composition root only.

## Evaluation before adoption

- **Label before you integrate.** Build the eval set from your own states
  first -- including the hard cases and the ones the incumbent gets wrong.
  It is what makes every later change measurable.
- **Size it to the decision.** Tens of examples prove the plumbing; they do
  not support a rate. Measure on enough cases per class that one flipped
  answer does not move the number by more than the difference you care
  about.
- **Report per question and per class**, not one blended accuracy: a model
  that is excellent on the common class and useless on the rare one looks
  fine on average.
- **Compare against the incumbent on the same set**, and report agreement
  as well as accuracy. Where they disagree is where the labelled answer
  earns its keep.
- **Check calibration** before trusting a threshold: of the cases scored
  near 0.9, about nine in ten should be right. A model that is accurate but
  miscalibrated needs its thresholds chosen from the eval set, not from
  intuition.
- **The floor goes in CI**, under the gates skill's law: a change is judged
  against the floor as it stood before the change.

## Security

- **The state is data, never instruction.** A document or image under
  judgement can carry text addressed to the model. A decision model cannot
  act on it beyond skewing a probability, but an LLM adapter behind the
  same port can; keep it out of any tool-calling loop.
- **Model code is code.** Some decision models ship their scoring head as
  Python in the model repository, loaded at run time. That is executable
  third-party code: it gets a radar row, it is pinned to a reviewed
  revision, and it is never loaded from a moving branch.
- **Probabilities can be gamed.** Where a party with an interest in the
  outcome controls the state (a submission, an application), a threshold
  is a target, and a gamed state clears it with a confident wrong answer
  that never reaches the abstention path. Put a rule or a human check in
  front of what auto-accepts, or audit a sample of above-threshold accepts
  -- not only the abstentions.

## Testing

- **Fake the port with canned Decisions.** Unit tests never load weights.
  Drive the threshold policy with probabilities just above, at, and just
  below each threshold, with an uncalibrated Decision, and with each typed
  failure.
- **One contract suite, every adapter**: valid probabilities per option,
  every question in the schema answered, the typed failures raised for an
  unavailable endpoint and a rejected input. Real-model runs are marked
  integration tests, run on demand.
- **The eval is a test**, per the section above, not a notebook.

## Anti-patterns

| Symptom | Why it hurts | Instead |
|---|---|---|
| "Answer YES or NO" prompts to a chat model, parsed with a regex | No probability, slow, and the parse fails in ways nobody sees | A binary question behind `DecisionPort`; the prompt becomes the baseline adapter |
| Asking the same question twice, from two sides, and comparing | The disagreement shows something is wrong but cannot settle it | One question whose state holds both sides, with a probability to tie-break on |
| A threshold in the prompt ("only say yes if very sure") | Uncalibrated, untestable, and moves with every prompt edit | Thresholds in the core, chosen from the eval set |
| Adopting on the vendor's benchmark | Their tasks are not yours | Your eval set, against the incumbent |
| One blended accuracy number | Hides the rare class that matters | Per question, per class |
| A decision model asked to extract text | It scores options; it does not write | Split the job: decision here, extraction elsewhere |

## Radar

Decision models are on the tds-utils LMDE radar at Trial (Issue#382 in
9atatimer/tds-utils). A repo that adopts one proposes its own row at phase 3
and lands it with the adapter, per the tech-radar skill.
