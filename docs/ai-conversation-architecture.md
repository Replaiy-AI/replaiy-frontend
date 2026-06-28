# Replaiy AI conversation architecture (blueprint)

How the AI decides what to reply in a LinkedIn conversation. This is a living
blueprint for the backend build (which comes after the frontend surfaces are
done). It exists so the data model we build now maps cleanly to the runtime
later, with no rework. Directional, not binding.

## The core idea

For every incoming lead message, the AI's reply is produced by a single LLM
call whose system prompt is composed from SIX layers, plus the user's own
knowledge retrieved on demand (RAG):

```
reply = LLM(
  system_prompt =
      1. global_standards        (constant, ours)
    + 2. agent_config            (the avatar / settings the user picked)
    + 3. knowledge (RAG)         (the user's own facts, retrieved per message)
    + 4. conversation_history    (the thread so far, multimodal)
    + 5. lead_data (enriched)    (who the prospect is)
    + 6. live_context            (goal, language, timing)
)
```

## The six layers

### 1. Global standards  (constant, our responsibility)
Our built-in playbooks: communication strategy, sales strategy, follow-up
tactics, opening-message patterns, and the rules that make the AI write and
behave like a human. These are NOT user-configurable. They are the quality
floor under every agent. Source: our own strategy documents (to be ingested
into the backend prompt later). Independent of avatars/settings.

### 2. Agent config  (variable, built now in the frontend)
The persona/avatar and its settings = how the agent sounds and behaves. This is
the layer the Persona page configures. Each avatar is a preset of these
dimensions; the Custom agent exposes them for editing (cloned from the chosen
avatar). Dimensions (see custom-agent-model.md):
- Identity: voice, formality, message length
- Strategy: drive (patient/balanced/assertive), qualifying depth
- Guardrails: do's, don'ts
- Advanced: optional custom instructions (layers on top)
Plus the rich per-avatar behavior text kept under the hood as the quality base.
Serialization: every field maps to a prompt fragment (mapping table below).

### 3. Knowledge — RAG  (the user's own facts)
Personal + Workspace knowledge (Q&A, files, URLs, LinkedIn) indexed into a
vector store. Per incoming message, relevant chunks are retrieved and injected.
This is WHAT the agent knows (product, pricing, objection handling), distinct
from layer 5 (who the lead is). Config decides HOW it answers; RAG decides WITH
WHAT.

### 4. Conversation history  (the thread so far — MULTIMODAL)
The full back-and-forth up to now, so the AI references prior messages, avoids
repeating, and times follow-ups correctly. For long threads, summarize older
turns to stay within token limits.
- MULTIMODAL capability (built into this layer, not a separate layer): if the
  lead sends images, video, or files, a processing step "reads" them (image
  understanding / video transcription / document parsing) and the resulting
  understanding becomes part of the conversation context. So a human-like reply
  can react to what was actually sent.

### 5. Lead data — enriched  (who the prospect is)
- Base: name, title, company, seniority.
- Enriched: company size, industry, funding stage, tech stack, recent company
  news, growth signals.
- LinkedIn signals: recent posts, activity, mutual connections, profile
  highlights (fuel for personalized openers).
- Intent/engagement: opened, clicked, replied, warmth.
Source: enrichment integrations. This is the brandstof for personalization.

### 6. Live context  (the situation)
The campaign GOAL (meeting, demo, reply, intro, etc. - chosen per campaign, NOT
hard-coded), the lead's language (for auto-matching + the meeting-language
guard), timing, and channel.

## Field -> prompt mapping (agent_config, layer 2)
To be implemented in the backend; values must stay unambiguous (that's why
approach/closing/push were collapsed into one Drive axis).

| Field            | Example value | Becomes (prompt fragment, indicative) |
|------------------|---------------|----------------------------------------|
| voice            | free text     | "Write in this voice: <text>"          |
| formality        | neutral       | "Keep a neutral register."             |
| length           | short         | "Keep messages short (1-3 sentences)." |
| drive            | balanced      | "Push toward the goal only when intent is real; otherwise nurture." |
| drive=patient    | -             | "Nurture; never push; one soft follow-up at most." |
| drive=assertive  | -             | "Drive firmly to the next step; follow up persistently (about 2 nudges)." |
| qualifyingDepth  | thorough      | "Qualify deeply before proposing the next step." |
| dos[]            | list          | "Always: <items>"                      |
| donts[]          | list          | "Never: <items>"                       |
| customInstructions | free text   | appended verbatim as high-priority instructions |

## Why avatars and custom share one model
An avatar = a fixed fill of layer 2. The Custom agent = the same fields, made
editable (cloned from the selected avatar). So defining these dimensions well
defines how ALL agents behave. One model, five presets + one editable.

## Build order
Frontend surfaces first (Persona done; Knowledge next; Campaigns after), so the
data needs of every layer are settled before the backend runtime (layers wired
into a real prompt + RAG + enrichment) is built. Global standards (layer 1) and
the multimodal capability (layer 4) are implemented in the backend phase, using
our strategy documents as the source.
