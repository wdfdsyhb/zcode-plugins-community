#!/usr/bin/env node
// tokline SessionStart hook:轻量初始化提示。

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "[zcode-tokline] 已加载。每轮发消息时会注入最新速率行,按注入的显示规则在回复末尾原样引用。",
    },
  })
);
