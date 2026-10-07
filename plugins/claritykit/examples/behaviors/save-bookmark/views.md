# save-bookmark — Behavior Views

> Fixture: YAML tier. The model (`behavior.yaml`) is the machine contract; these
> are hand-crafted views for the user's decisions. The prototype under
> `prototypes/save-bookmark/` mirrors the same states.

## Scenario episodes

1. **Happy** — Kayla hits ⌘S on a subway article; edits the fetched title, adds the
   tag `sewers`; online; sees "已保存" within ~2s.
2. **Offline** — same save with no signal: UI shows "已保存 · 待同步" immediately;
   when the train exits the tunnel, the badge flips to "已保存" without her touching
   anything (decided recovery: silent background sync, no modal).
3. **Peer down** — the sync peer is redeploying: after ~10s the badge shows
   "同步失败 · 重试"; she taps 重试 twice, then cancels — the bookmark stays readable
   and searchable, marked "待同步" (decided recovery: local truth is never blocked).
4. **Adversarial** — page has no title tag: the URL itself becomes the title
   (decided, no error state).

## View 1 — overall behavior (decision: is this the right shape?)

```mermaid
%% title: save-bookmark · behavior overview
%% group: save-bookmark
%% caption: states and user-visible transitions; same structure as the model — views subtract, never rearrange
stateDiagram-v2
  idle : 空闲
  editing : 编辑中
  state editing {
    view : 查看
    modify : 修改
  }
  syncing : 同步中
  saved : 已保存
  sync_failed : 同步失败
  pending : 待同步
  [*] --> idle
  idle --> editing : 保存网页
  editing --> view
  view --> modify : 编辑信息
  modify --> view : 确认
  modify --> idle : 取消
  view --> syncing : 确认
  syncing --> saved : 同步完成
  syncing --> sync_failed : 同步出错
  sync_failed --> syncing : 重试
  sync_failed --> pending : 取消
  syncing --> pending : 取消
  pending --> syncing : 网络恢复
  saved --> [*]
```

## View 2 — failure & cancel paths (decision: are these acceptable?)

```mermaid
%% title: save-bookmark · failure & cancel paths
%% group: save-bookmark
%% caption: only non-happy paths; guards shown in brackets
stateDiagram-v2
  syncing : 同步中
  sync_failed : 同步失败
  pending : 待同步
  syncing --> sync_failed : 同步出错
  sync_failed --> syncing : 重试 [允许重试]
  sync_failed --> pending : 取消
  syncing --> pending : 取消
  pending --> syncing : 网络恢复 [在线]
```

## View 3 — happy path as a linear flow (companion to the state view)

> The state view above reads in states; this is the same main scenario as a linear
> process — for readers who think in steps. (Necessary companion when the module is
> state-like.)

```mermaid
%% title: save-bookmark · happy path
%% group: save-bookmark
%% caption: the main scenario as a linear process — companion to the state overview
flowchart LR
  A(["按下保存"]) --> B["抓取并编辑标题/标签"]
  B --> C["确认"]
  C --> D["写入本地库"]
  D --> E["后台推送到对端"]
  E --> F(["徽标变为「已保存」"])
```

## Acceptance criteria (excerpt — one Given/When/Then per transition)

- Given 空闲 When 保存网页 Then 编辑中（元数据已记录）
- Given 查看 When 确认 Then 同步中
- Given 同步中 When 同步出错 Then 同步失败（retryCount+1）
- Given 同步失败 When 重试 [允许重试] Then 同步中
- Given 同步中 When 取消 Then 待同步（已入同步队列）
- Given 待同步 When 网络恢复 [在线] Then 同步中
- … (full list: one per transition, 13 total)
