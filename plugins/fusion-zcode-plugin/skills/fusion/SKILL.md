---
name: fusion
description: Hybrid smart model fusion with auto-shifting between consensus, sequential, specialist, and fallback modes. Use whenever the user wants multiple models to collaborate on a task - automatically selects the optimal strategy based on task analysis.
---

# Fusion - Hybrid Smart Model Collaboration

Use this skill when the user wants to leverage multiple AI models on a single task. The skill automatically analyzes the request and selects the optimal fusion strategy.

## Available Fusion Modes

The skill operates in one of four modes, auto-selected based on task analysis:

### 1. Consensus Mode
- **When**: Complex reasoning, fact-finding, strategic decisions
- **How**: Query 2-3 models in parallel, synthesize agreement/disagreement
- **Models**: Analysis-focused models (o1, o3, Claude-3-Opus, GPT-4)
- **Use case**: "What are the trade-offs of microservices vs monolith?" or "Should we adopt technology X?"

### 2. Sequential Mode
- **When**: Multi-step tasks requiring iterative refinement
- **How**: Pipeline models in sequence (think → create → review → refine)
- **Models**: Specialized by step (reasoning → coding → review)
- **Use case**: "Build a React component with tests" or "Design and implement an API"

### 3. Specialist Mode
- **When**: Task type is clearly defined (coding, creative, analysis)
- **How**: Route to models optimized for that domain
- **Models**: Task-specific experts (DeepSeek-Coder, Claude-3.5-Sonnet, GPT-4V)
- **Use case**: "Write a Python script for data analysis" or "Create a marketing tagline"

### 4. Fallback Mode
- **When**: Reliability is critical, primary model might fail
- **How**: Try primary, automatically failover to alternatives
- **Models**: Primary + 2-3 backups
- **Use case**: Production code generation, critical analysis

## Task Analysis & Routing

When this skill triggers, analyze the user's request for:

1. **Complexity signals**: "compare", "evaluate", "pros/cons", "multiple perspectives" → Consensus mode
2. **Step signals**: "build", "implement", "create", "then" → Sequential mode
3. **Domain signals**:
   - Code: "write", "implement", "debug", "function" → Specialist (coding models)
   - Creative: "creative", "write", "design", "brainstorm" → Specialist (creative models)
   - Analysis: "analyze", "explain", "research", "compare" → Specialist (analysis models)
4. **Reliability signals**: "critical", "production", "important" → Fallback mode

## Model Pool Configuration

Default models organized by capability (configurable via environment):

- **Coding**: deepseek-coder, gpt-4, claude-3-5-sonnet
- **Analysis**: o1, o3, claude-3-opus, gpt-4
- **Creative**: gpt-4, claude-3-5-sonnet, command-r
- **Vision**: gpt-4-vision, claude-3-opus-vision

## Who picks the models?

Fusion supports two model-selection strategies, controlled by the `selection_strategy` parameter on `execute_fusion`:

- **`auto`** (default) — Fusion's classifier picks the best models for the task. Hands-off.
- **`user`** — Use **exactly** the models the user specified in the `models` array. Fusion will not override or add models. The classifier still suggests a `mode` so the agent knows *how* to run them, but the model list is the user's final choice.

### When to ask the user vs. decide for them

Default to `auto`. Only offer `user` selection when the user signals they care about which model runs. Signals:
- They name a model ("use Claude", "can GPT-4 handle this?")
- They ask to choose ("which models?", "can I pick?")
- They have a strong preference ("I don't want o1", "stick to open-source models")
- They're iterating and unhappy with a previous model's output

When you detect these signals:
1. Call `mcp__fusion__get_models` to fetch the available pools.
2. Present the pools to the user with a short description of each.
3. Ask which model(s) they want (use the AskUserQuestion tool if available, or ask inline).
4. Call `mcp__fusion__execute_fusion` with `selection_strategy: "user"` and their chosen `models`.

If the user does not care, use `selection_strategy: "auto"` and proceed silently.

## MCP Integration

If the Fusion MCP server is configured, use these tools:
- `mcp__fusion__analyze_task` - Get task classification (mode + recommended models + confidence)
- `mcp__fusion__execute_fusion` - Run multi-model execution. Supports `selection_strategy` ("auto" | "user"), `mode`, and `models`.
- `mcp__fusion__get_models` - List available models grouped by capability, with a description of each pool's strengths.

If MCP is not available, use skill-based delegation to existing agents with model hints.
