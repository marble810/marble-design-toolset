## ADDED Requirements

### Requirement: Tool can instantiate a unified file input controller
Framework SHALL 提供一个可由 tool 直接导入的文件输入控制器。控制器 MUST 接收允许的输入类别配置，至少支持 `image`、`video`、`text` 三种 kind；并且 MUST 同时提供文件选择器可复用的 `accept` 约束以及一个统一的 ingest 入口，以便 picker 与 drop 输入走同一条处理路径。

#### Scenario: Tool configures image and text input
- **WHEN** 某个 tool 创建控制器并声明允许 `image` 与 `text`
- **THEN** 控制器返回与该声明一致的 `accept` 约束，并且只接受图像文件或文本文件进入后续解析流程

#### Scenario: Tool ingests files from a drop action
- **WHEN** 某个 tool 将拖放得到的文件集合交给控制器的 ingest 入口
- **THEN** 控制器按照与 picker 相同的校验和解析规则处理这些文件，而不是走一套独立逻辑

### Requirement: Successful imports are normalized into typed input items
Framework SHALL 将每一次成功导入标准化为一个 discriminated union 输入项，并暴露共享字段 `kind`、`source`、`file`、`name`、`mimeType`、`size`、`lastModified`。`image` 输入项 MUST 额外包含 `objectUrl`、`width`、`height`；`video` 输入项 MUST 额外包含 `objectUrl`、`width`、`height`、`duration`；`text` 输入项 MUST 额外包含已解码的文本内容。

#### Scenario: Image file import succeeds
- **WHEN** 控制器成功导入一个图像文件
- **THEN** tool 可以读取一个 `kind = image` 的标准化输入项，其中包含框架生成的 `objectUrl` 以及图像宽高

#### Scenario: Video file import succeeds
- **WHEN** 控制器成功导入一个影片文件
- **THEN** tool 可以读取一个 `kind = video` 的标准化输入项，其中包含框架生成的 `objectUrl`、视频宽高与时长

#### Scenario: Text file import succeeds
- **WHEN** 控制器成功导入一个文本文件
- **THEN** tool 可以读取一个 `kind = text` 的标准化输入项，其中包含解码后的完整文本内容

### Requirement: Invalid or failed imports surface stable errors without discarding the last success
Framework MUST 为空输入、超出允许类别、一次提交多个文件、文本读取失败、图像或影片元信息解析失败等情况暴露稳定的错误状态。控制器在导入失败时 MUST 保留最近一次成功的输入项不变，并仅更新错误状态；只有新的导入成功提交后，才可以替换当前成功结果。

#### Scenario: User provides an unsupported file type
- **WHEN** 控制器收到一个不在允许类别内的文件
- **THEN** 控制器返回稳定的错误状态，且不会清空当前已存在的成功输入项

#### Scenario: User provides multiple files to a single-item controller
- **WHEN** 控制器一次收到多个文件
- **THEN** 控制器将该次导入视为失败，更新错误状态，并保持当前成功输入项不变

#### Scenario: Metadata parsing fails for a media file
- **WHEN** 控制器在读取图像或影片元信息时失败
- **THEN** 控制器以失败状态结束该次导入，并保持此前的成功输入项仍可继续被 tool 使用

### Requirement: Runtime owns temporary resource cleanup
Framework MUST 对自己创建的临时资源负责，尤其是图像与影片输入项对应的 object URL。控制器在 `clear()`、`dispose()` 或成功结果被新的成功结果替换时 MUST 回收旧的 object URL，并且 MUST 在导入成功或失败后退出 busy 状态。

#### Scenario: Tool clears the current imported media
- **WHEN** tool 调用控制器的 `clear()`
- **THEN** 控制器清空当前成功输入项与错误状态，并回收当前媒体输入关联的 object URL

#### Scenario: Tool unmounts after importing a video
- **WHEN** tool 在已导入影片后调用控制器的 `dispose()`
- **THEN** 控制器回收该影片输入关联的 object URL，且不会把临时资源泄漏到工具生命周期之外

#### Scenario: A new successful image replaces an older one
- **WHEN** 控制器成功导入新的图像并替换旧的图像结果
- **THEN** 旧图像的 object URL 被回收，新的图像结果成为当前成功输入项