---
name: zcode-remote-en
description: English guide for ZCode Remote Control and Bot Channel. Connecting to the desktop workspace from a phone, QR code, mobile control, WeChat/Feishu integration, bot management. Use whenever remote control, phone, mobile, QR code, bot channel, WeChat, Feishu, DingTalk, Discord, bot creation, or pairing is mentioned.
---

# Remote Access: Remote Control and Bot Channel

## Remote Control

Lets your phone connect to the current desktop ZCode workspace. You can check the task, type instructions; the actual code changes and project environment stay on the desktop.

### When to Use

- A desktop task is running and you need to step away
- You got a quick update and want to add one instruction from your phone
- A long task is running and you want to check Agent status

### Connecting

1. Click the **phone icon** in the lower-left sidebar of ZCode
2. Scan the QR code with your phone, or copy the link and open in a mobile browser
3. The phone joins the workspace; the desktop remains the runtime

### Controls

- Read the latest Agent response/progress
- Send a new instruction or extra context
- Confirm, continue, or stop a long-running task
- Jump back into the workspace from outside your desk

**Note:** Only one phone can connect at a time, and only to workspaces already open on the desktop.

---

## Bot Channel

Connects external chat tools to ZCode. Open the workspace from WeChat or Feishu, check progress, and keep sending instructions.

### Remote Control vs Bot Channel

| Feature | Remote Control | Bot Channel |
|---------|----------------|-------------|
| Best for | Quick QR access | Permanent entry point in a chat tool |
| Duration | Short, temporary | Long-lived, revisitable |

### Channels

- **WeChat:** Scan to sign in and bind automatically
- **Feishu:** Create an app, bind through messages
- DingTalk, Discord, WeCom — in later versions

### Feishu Pairing

1. Choose Feishu in ZCode, scan the QR code
2. ZCode creates the Feishu app automatically and generates a pairing code
3. Send `/bind pairing-code` in the Feishu conversation
4. Bot is ready — check status, create tasks, switch models/modes

### Bot Management

- Enable/disable
- Bind credentials (Bind Bot)
- Reply granularity (detail level)
- Workspace access scope limits
- Delete
