# 统一Canvas托管
- 每个Tools的视觉预览都由Deshelf统一托管
- 在视觉呈现上对齐Figma，可放大缩小拖动以及“无限画布”，用Frames来承载内容
- 但Frames和Canvas内容由Tools声明
  - Tools可以声明range[1,n)个Frames，承载不同的内容
  - Tools可以声明Frames的尺寸
  - Tools只能在Frames内写入画面，Canvas只作为一个Layout承托
    - 具体Layout由Tools声明
      - 探讨缺省状态让Deshelf Auto arrange的可行性
- Tools -> Deshelf -> Canvas 多了一层的性能影响需要考量
