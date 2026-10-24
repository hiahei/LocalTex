# LocalTeX

LocalTeX 是一个自包含、本地优先的 LaTeX 写作工作台。它既可以只在本机使用，
也可以在可信局域网中通过安全分享链接进行多人实时协作。

## 当前功能

- Project file browser
- Text editing for `.tex`, `.bib`, `.sty`, `.cls`, and other text files
- 使用 `Ctrl+S` 保存并编译
- 无工具栏、全尺寸 PDF 预览
- Compile log and extracted LaTeX diagnostics
- Image and project-file upload
- 局域网多人实时编辑、在线成员显示和自动保存
- 带随机访问令牌的局域网鉴权
- 复用主机本地配置、支持权限切换的 Codex 写作与编译助手
- 项目文件始终保存在主机磁盘；只有主动调用 Codex 时，所选上下文才会交给 Codex

## Codex 助手

编辑页右侧提供独立的 Codex 抽屉，可分析编译日志、解释 LaTeX、润色选区或检查
当前文件；抽屉关闭后不占用编辑器或 PDF 预览空间。LocalTeX 使用主机已有的
`CODEX_HOME`、登录状态、模型和推理配置，不在
网页、`data` 或论文目录中复制 API Key。修改本机 Codex 配置后，重新启动
LocalTeX 服务即可生效。

Codex 消息中的 `$...$`、`$$...$$`、`\(...\)`、`\[...\]` 及常用公式环境会由
随项目安装的 KaTeX 在本地渲染；代码块不会被当成公式处理，复制渲染结果时仍会
保留对应的 TeX 源码。

当前版本采用以下权限边界：

- 只有通过 `127.0.0.1` 访问的主机可以调用 Codex，局域网协作者看不到主机配置。
- 主机可在编辑页底部选择“只读”“项目可写”或“Full access”，设置保存在本机
  `data/codex-settings.json`，适用于之后的新建和续聊任务。
- 模型入口默认跟随主机 `config.toml`；也可以从当前登录账号的 Codex 可用模型列表中
  覆盖选择。模型选择同样只保存在本机 `data/codex-settings.json`，下一次任务生效。
- “只读”不会修改文件；“项目可写”允许修改线程工作区；“Full access”允许访问
  工作区外的文件、执行系统命令，并开启命令网络访问和实时网页搜索。
- 所有模式均采用非交互运行；开启 Full access 后应在提示词中明确操作范围，并谨慎
  处理删除、覆盖和其他难以恢复的操作。
- 当前文件、选区和编译日志分别由用户勾选并作为直接上下文；为了解决跨文件的
  LaTeX 问题，Codex 会在所选历史原本的工作区继续运行。
- “停止”按钮会中断当前任务，同一个项目同时只运行一个 Codex 任务。

首次使用前应确保本机 Codex 已经登录：

```powershell
codex login status
```

本地登录既可以使用 ChatGPT，也可以使用 API Key；具体计费和数据策略由现有
Codex 登录方式及所属 OpenAI 工作区决定。

## Self-contained runtime

The runtime is stored inside this project:

```text
tools/
  node/node.exe
  miktex/texmfs/config
  miktex/texmfs/data
  miktex/texmfs/install
  repository/
```

The start scripts use the bundled Node.js runtime. The server always prefers the
bundled portable MiKTeX binaries, so neither Node.js nor MiKTeX needs to be
installed system-wide.

`tools\system-miktex-uninstall-residue` is a quarantined backup of files left by
the former per-user installation plus one invalid interrupted download. It is
not searched or used by LocalTeX and can be deleted independently.

## 启动与停止

从 GitHub 新克隆源码后，先在项目根目录恢复 JavaScript 依赖：

```powershell
npm ci
```

`workspace` 和 `data` 包含论文及本机运行信息，不进入 Git。首次启动时，
LocalTeX 会自动创建空工作区和新的本机配置；随后可在主页重新添加论文目录。

推荐直接双击无窗口启动入口：

```text
LocalTeX.vbs
```

兼容入口仍然可用，它只会短暂调用启动器，不会留下 CMD 窗口：

```text
start-local.cmd
```

在 LocalTeX 项目根目录打开 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

启动器会隐藏运行一个轻量主机控制器，并打开 `http://127.0.0.1:4177`。正常操作
全部在“主机与协作控制”页面完成：工作服务可以暂停或恢复，局域网分享可以独立
开启或关闭。暂停工作服务时，文件、编译、上传和协作接口全部锁定，但控制页仍然
在线，因此不需要通过 CMD 恢复。每次重新启动控制器时，本地工作服务都会自动
开启，局域网分享都会强制关闭。

只有需要完全退出主机控制器时才使用下面的应急停止入口；完全退出后必须重新双击
`LocalTeX.vbs` 才能启动：

```text
stop-localtex.cmd
```

开发调试时也可以运行下面的命令；这种方式只监听本机，不支持从页面动态开启分享：

```powershell
npm start
```

## 局域网协作

1. 双击 `LocalTeX.vbs` 打开 LocalTeX。
2. 在项目首页点击“协作分享”，或进入编辑器后点击右上角“分享”。
3. 在“主机与协作控制”中确认工作服务已开启，然后点击“开启分享”。
4. 点击“复制链接”，把完整链接发给同一局域网内的可信成员。
5. 对方打开链接并选择项目、文件后即可实时编辑；顶部会显示在线人数。
6. 不需要协作时点击“关闭分享”，远端页面和实时连接会立即失效。

再次开启时原安全链接可以继续使用，因此无需反复发送新链接。安全令牌会保存在
`data\lan-settings.json`，但每次重新启动控制器都会强制关闭分享，必须由主机再次
手动开启。旧的 `start-lan.cmd` 仍可作为兼容入口，但它与 `start-local.cmd` 现在
使用同一个后台启动器，分享是否有效完全由主机页面控制。

分享链接中的访问令牌会保存在当前浏览器标签页会话中，页面加载后会从地址栏
自动隐藏。远端成员可以查看和编辑项目列表中已登记的项目，但不能调用主机文件
选择器、添加本地路径或删除项目条目。

如果其他设备打不开链接，并且两台设备确实连接在同一个局域网，请以管理员身份
运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\allow-lan-firewall.ps1
```

该脚本只允许本地子网通过“专用网络”访问便携 Node 的 TCP `4177`，不会创建
公用网络规则。也可以在 Windows 首次弹出的网络访问提示中只勾选“专用网络”。
如果可信的家庭或办公 Wi-Fi 被 Windows 标记成“公用网络”，先在 Windows 的
“网络和 Internet → Wi-Fi → 当前网络”中把网络配置文件类型改为“专用网络”。
不要在酒店、机场等不可信网络上开启局域网模式。

安全令牌保存在 `data\lan-settings.json`。不要公开分享它；如需更换令牌，请先
停止 LocalTeX，删除该文件，再重新启动并开启分享。局域网模式没有互联网中继，
两台设备必须能够直接访问主机地址。

## Project list and local files

LocalTeX opens on a project list. Use one of these actions:

- **Open project folder**: choose any local folder containing a LaTeX project.
- **Open .tex file**: choose a main `.tex` file; its parent folder becomes the project.
- **Enter local path**: paste a full folder path when the native picker is not convenient.

The list remembers each project path, main document, creation time, and last-opened
time in `data\projects.json`. Removing an item from the list never deletes the
original project folder or files.

## Use an existing paper

Copy the contents of the paper project into:

```text
.\workspace
```

Keep the paper project's original relative file and folder layout. The
`workspace` directory is private local data and is excluded from Git.

Refresh the file list in LocalTeX, select the correct main `.tex` document from
the top of the editor, and compile.

To use a paper stored elsewhere, set an environment variable before starting:

```powershell
$env:LOCAL_TEX_WORKSPACE = 'D:\path\to\paper'
npm start
```

## Portable MiKTeX data

MiKTeX downloaded packages and portable startup defaults remain under
`tools\miktex`. Local `miktex.ini` settings can contain authentication tokens;
they, generated formats, file indexes, and font caches are excluded from Git.
MiKTeX creates the required local state when needed. A local `tools\repository`
cache may be kept for offline repair, but it is not required at runtime and is
also excluded from Git.

## 主机控制器与工作服务

隐藏控制器只负责本机控制页面。工作服务暂停时会自动关闭分享、断开协作者，并对
文件、项目、上传、编译、PDF 和 WebSocket 接口加锁；控制器本身不向局域网开放。
主机始终从 `127.0.0.1` 控制暂停/恢复与分享状态。暂停状态只在当前控制器进程内
有效；下次启动会恢复本地工作服务，同时保持局域网分享关闭。

实时文本合并运行在项目内置的 Yjs 运行时上，Node.js、Yjs、WebSocket 和 MiKTeX
依赖均位于当前 LocalTeX 项目目录内，不依赖 C 盘的全局安装。
