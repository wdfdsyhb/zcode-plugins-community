# 看板数据规范（DATA 结构与填写规则）

看板 = `assets/dashboard-template.html` 的渲染框架 + 你填入的 `DATA` 对象。**只替换 DATA 占位行，不改渲染代码。** 所有文字字段支持内联证据标记（【已确认：…】等），渲染时自动变成彩色徽章；`\n` 会转成换行。

## 顶层结构

```js
const DATA = {
  meta: { project, generatedAt, tagline },          // 必填。tagline=一句话项目定位（推断要标【推测】）
  overview: { checklist, checklistBasis, backend, frontend, runtime, conclusions, pending },
  architecture: { packages, diagramHtml, features, extras },
  modules: [ { name, pkg, desc, interfaces: [...] } ],
  matrix: { columns, rows, footnote },
  techs: [ ... ],
  flows: [ ... ],
  interview: [ ... ],                               // 全量分析留 []，面试审判模式才填
  terms: [ ... ]
};
```

除 `meta` 外字段均可缺省，渲染器显示空状态。**宁可缺省，不许编造。**

## overview（项目概览）

```js
checklist: [ { label:"Java Spring Boot", checked:true }, ... ],   // 项目类型勾选
checklistBasis: "微服务未勾选：未发现注册中心依赖【已确认：pom.xml】",
backend:  [ { tech:"Spring Boot", version:"4.0.1", purpose:"Web 应用框架", evidence:"libs.versions.toml" } ],
frontend: [ { tech:"React 18", purpose:"UI 框架", evidence:"package.json" } ],
runtime:  [ ["端口","8080【已确认：application.yml】"], ... ],
conclusions: [ { text:"……【已确认：文件:行】" } ],                 // 3-5 条
pending: [ { item:"Pinyin4j 调用点未定位", clue:"全局搜索 pinyin 相关 import" } ]
```

版本号必须来自版本目录/构建文件；找不到精确版本就写"随 Boot 管理"并说明，不许编小数点。

## architecture（架构总览）

```js
packages: [ { path:"modules/", duty:"5 个业务模块，模块内自含 controller/service/repository" } ],
diagramHtml: "<div class='dbox'><b>React 前端</b></div><div class='darr'>↓ HTTP</div>...",  // 用 dbox/drow/darr/dside 拼
features: [ { title:"无认证体系", text:"61 个接口全部匿名【已确认：全局搜索无 Spring Security/JWT】" } ],
extras: [ ["iText 8","报告导出 PDF","InterviewController.exportInterviewPdf"] ]
```

`diagramHtml` 写法：纵向主链用 `.dbox` 一层一格 + `.darr`（内容如 "↓ 调用"）连接；并列组件外包 `.drow`；侧向依赖（Redis/AI/存储）用 `.dbox.dside` 虚线框。只画真实存在的组件与调用。

## modules（模块与接口）

```js
modules: [ {
  name:"模拟面试", pkg:"modules/interview", desc:"一句话",
  interfaces: [ {
    method:"POST",                       // GET/POST/PUT/PATCH/DELETE/WS
    path:"/api/interview/sessions",      // 类级+方法级拼接后的完整路径
    handler:"InterviewController.createSession",
    summary:"创建面试会话（AI 出题）",
    rate:"G5/IP5",                       // 无限流就省略此字段
    detail: {                            // 核心接口才填；速览条目省略整个 detail
      purpose:"…", request:"POST /api/interview/sessions",
      params: [ ["skillId","String","面试主题 ID","@NotBlank"], ... ],  // 或直接给字符串
      controller:"…【已确认：文件:行】", service:"…", dataAccess:"…", tables:"…",
      techs:["Redis 限流","Spring AI","JPA"],
      chain: [ "InterviewController.createSession", "→ RateLimitAspect（Redis Lua）", "→ …" ],
      dataFlow:"…"
    }
  } ]
} ]
```

规则：每模块核心接口（1-3 个）填完整 detail 十节；其余接口只填 method/path/handler/summary。WS 端点也作为一个 interface（method:"WS"）。

## matrix（接口×技术矩阵）

```js
matrix: {
  columns:["接口","限流","JPA/PG","AI","向量库","存储","解析","Stream"],
  rows:[ ["创建面试会话","POST /api/interview/sessions","✓","✓","✓","-","-","-","-"], ... ],
  footnote:"✓ 仅当调用链真实出现该技术【已确认】；* 见技术档案"
}
```

第一列功能名、第二列接口路径，其后每列 `✓`/`-`/`✓*`，与 columns 一一对应。

## techs（技术档案，"为什么存在"七问）

```js
techs: [ { name:"Redis（Redisson）",
  summary:"一句话职责【已确认：…】",
  usage: [ ["common/aspect/RateLimitAspect.java","全文件","Lua 限流"], ... ],
  how:"关键机制与 key 格式…", what:"存什么/做什么…", why:"解决什么问题…",
  without:"没有它会怎样【推测】", relations:"与其他组件关系（能确认才写）",
  xuezha:"一段大白话比喻" } ]
```

## flows（数据流）

```js
flows: [ { name:"简历上传与分析", api:"POST /api/resumes/upload",
  steps: [ ["① 前端选文件","multipart 上传【已确认：ResumeController.java:52】"], ... ],
  shapes: [ ["传输","multipart 二进制","HTTP 请求体"], ... ],
  points: [ { title:"限流前置", text:"…【已确认：…】" } ] } ]
```

## interview（面试题，面试审判模式专用）

```js
interview: [ { q:"问题", point:"考察点", evidence:"UserController.java login()",
  answer:["要点1（代码依据：…）","要点2…"], followup:"追问：Token 过期后会发生什么？" } ]
```

## terms（学渣术语对照表）

```js
terms: [ ["前台接待","Controller（控制器层）"], ["真正干活的人","Service（业务逻辑层）"], ... ]
```

必须来自本项目真实结构；项目没有的组件不要编比喻。
