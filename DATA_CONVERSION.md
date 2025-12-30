# 风场数据转换详细文档

## 概述

本文档详细描述了从NetCDF (NC) 格式的WRF风场数据到WebGL可视化数据的完整转换过程，包括数据计算、格式转换和压缩优化。

## 数据转换流程图

```
NC原始数据 → 数据提取 → 计算处理 → 数据压缩 → PNG纹理 + JSON元数据 → WebGL可视化
    ↓            ↓          ↓          ↓            ↓              ↓
WRF模型输出    U10,V10      全流速      元数据       纹理编码       粒子系统
   文件        组件提取      方向计算     压缩        像素编码       动画渲染
```

## 1. 原始数据格式

### 1.1 NetCDF (NC) 文件结构
- **文件来源**: WRF (Weather Research and Forecasting) 模型输出
- **主要变量**:
  - `U10`: 10米高度东向风速分量 (m/s)
  - `V10`: 10米高度北向风速分量 (m/s)
  - `XLAT`: 纬度坐标
  - `XLONG`: 经度坐标

### 1.2 数据特征
- **空间分辨率**: 221×171网格点
- **地理范围**: 
  - 经度: 104°E - 126°E
  - 纬度: 14°N - 31°N
- **时间步长**: 每2小时一个时间点
- **数据精度**: 32位浮点数

## 2. 数据提取与处理

### 2.1 坐标系统转换

```python
# NC文件中的坐标转换
longitude = XLONG.flatten()  # 经度数组
latitude = XLAT.flatten()    # 纬度数组

# 计算地理边界
lon_min, lon_max = longitude.min(), longitude.max()
lat_min, lat_max = latitude.min(), latitude.max()
```

### 2.2 风场分量提取

```javascript
// 提取U10, V10分量
const u10 = data.variables.U10[time_idx].data;  // 东向风速
const v10 = data.variables.V10[time_idx].data;  // 北向风速

// 展平为1D数组
const uFlat = u10.flatten();
const vFlat = v10.flatten();
```

## 3. 核心数据计算

### 3.1 风速计算

**全风速 (Wind Speed)**
```
speed = √(U10² + V10²)
```

```javascript
// 计算每个网格点的风速
for (let i = 0; i < uFlat.length; i++) {
    const speed = Math.sqrt(uFlat[i] * uFlat[i] + vFlat[i] * vFlat[i]);
    speedArray.push(speed);
}
```

**风速统计值**
- `speedMin`: 最小风速 = Math.min(...speedArray)
- `speedMax`: 最大风速 = Math.max(...speedArray)

### 3.2 风向计算

**风向定义**
- 风向角: 从正北方向顺时针测量的角度
- 0°: 正北风
- 90°: 正东风
- 180°: 正南风
- 270°: 正西风

**计算公式**
```
direction = Math.atan2(U10, V10) * 180/π + 180
```

```javascript
// 计算风向（0-360度）
for (let i = 0; i < uFlat.length; i++) {
    const direction = Math.atan2(uFlat[i], vFlat[i]) * 180 / Math.PI + 180;
    directionArray.push(direction);
}
```

### 3.3 数据范围计算

**风分量极值**
- `uMin`: U10分量的最小值
- `uMax`: U10分量的最大值  
- `vMin`: V10分量的最小值
- `vMax`: V10分量的最大值

```javascript
// 计算统计值
const uMin = Math.min(...uFlat);
const uMax = Math.max(...uFlat);
const vMin = Math.min(...vFlat);
const vMax = Math.max(...vFlat);
```

## 4. 数据压缩技术

### 4.1 元数据分离策略

**原始问题**: 
- 完整坐标数组约4MB/文件
- 包含所有经纬度坐标点信息
- 造成文件过大和加载缓慢

**解决方案**: 只保存必要元数据

```javascript
// 压缩后的元数据结构
const metadata_json = {
    width: 221,                    // 网格宽度
    height: 171,                   // 网格高度
    uMin: -6.128969669342041,      // U分量最小值
    uMax: 10.277409553527832,      // U分量最大值
    vMin: -3.172968864440918,      // V分量最小值
    vMax: 8.976096153259277,       // V分量最大值
    speedMin: 0.022266598160266608, // 最小风速
    speedMax: 11.081674543723993,   // 最大风速
    longitude: [104, 126],          // 经度范围 [最小, 最大]
    latitude: [14, 31],             // 纬度范围 [最小, 最大]
    source: "WRF Model Output",     // 数据源
    date: "2025-06-27T01:00Z"       // 时间戳
};
```

**压缩效果**: 
- 原始文件: ~4MB (3,913,960字节)
- 压缩后: 362字节
- **压缩比**: 约10,000:1

### 4.2 PNG纹理编码

**编码原理**: 使用PNG图像的RGBA通道存储风场数据

- **R通道 (Red)**: 存储U10分量（归一化到0-255）
- **G通道 (Green)**: 存储V10分量（归一化到0-255）
- **B通道 (Blue)**: 保持为0
- **A通道 (Alpha)**: 保持为255（完全不透明）

```javascript
// 归一化编码
const r = Math.round((uFlat[i] - uMin) / (uMax - uMin) * 255);
const g = Math.round((vFlat[i] - vMin) / (vMax - vMin) * 255);

// 创建PNG数据
pngData.data[i * 4] = r;     // R
pngData.data[i * 4 + 1] = g; // G
pngData.data[i * 4 + 2] = 0; // B
pngData.data[i * 4 + 3] = 255; // A
```

## 5. WebGL数据解码

### 5.1 元数据加载

```javascript
// 从JSON文件加载元数据
fetch('2025062701.json')
    .then(response => response.json())
    .then(windData => {
        // windData包含所有必要信息
        const {width, height, uMin, uMax, vMin, vMax} = windData;
    });
```

### 5.2 纹理数据解码

```javascript
// PNG图像解码
windData.image.onload = function() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = windData.width;
    canvas.height = windData.height;
    ctx.drawImage(windData.image, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // 解码U10, V10分量
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];     // U10分量 (0-255)
        const g = imageData.data[i + 1]; // V10分量 (0-255)
        
        // 反归一化
        const u10 = r / 255 * (uMax - uMin) + uMin;
        const v10 = g / 255 * (vMax - vMin) + vMin;
    }
};
```

## 6. 可视化映射

### 6.1 粒子系统映射

**位置映射**
```javascript
// 将网格坐标映射到屏幕坐标
function mapToScreen(gridX, gridY, width, height) {
    const x = gridX / width;
    const y = gridY / height;
    return [x * canvas.width, y * canvas.height];
}
```

**速度映射**
```javascript
// 根据风速计算粒子移动距离
function calculateParticleVelocity(u10, v10, speedFactor) {
    const speed = Math.sqrt(u10 * u10 + v10 * v10);
    const normalizedSpeed = speed / speedMax; // 归一化到0-1
    
    return {
        dx: u10 * speedFactor * normalizedSpeed,
        dy: v10 * speedFactor * normalizedSpeed
    };
}
```

### 6.2 风速着色机制

#### 6.2.1 数据编码策略

**PNG纹理编码**
- **R通道 (Red)**: 存储U10分量（归一化到0-255）
- **G通道 (Green)**: 存储V10分量（归一化到0-255）
- **B通道 (Blue)**: 保持为0
- **A通道 (Alpha)**: 保持为255（完全不透明）

```javascript
// 编码归一化过程
const r = Math.round((u10 - uMin) / (uMax - uMin) * 255);  // U分量
const g = Math.round((v10 - vMin) / (vMax - vMin) * 255);  // V分量
```

#### 6.2.2 WebGL着色算法

**片元着色器逻辑** (draw.frag.glsl)

```glsl
precision mediump float;

uniform sampler2D u_wind;        // 风场纹理 (R=U分量, G=V分量)
uniform vec2 u_wind_min;         // U、V分量的最小值
uniform vec2 u_wind_max;         // U、V分量的最大值
uniform sampler2D u_color_ramp;  // 颜色渐变纹理

varying vec2 v_particle_pos;     // 粒子位置

void main() {
    // 1. 从纹理读取归一化的U、V分量
    vec2 normalized_velocity = texture2D(u_wind, v_particle_pos).rg;
    
    // 2. 还原到实际风速值
    vec2 velocity = mix(u_wind_min, u_wind_max, normalized_velocity);
    
    // 3. 计算风速大小
    float speed = length(velocity);
    
    // 4. 归一化风速 (0.0-1.0)
    float speed_t = speed / length(u_wind_max);
    
    // 5. 颜色映射：选择颜色渐变
    vec2 ramp_pos = vec2(
        fract(16.0 * speed_t),                          // 16x16颜色纹理
        floor(16.0 * speed_t) / 16.0
    );
    
    // 6. 输出最终颜色
    gl_FragColor = texture2D(u_color_ramp, ramp_pos);
}
```

**关键算法步骤**:
1. **纹理采样**: `texture2D(u_wind, v_particle_pos).rg` - 获取归一化U、V
2. **数值还原**: `mix(u_wind_min, u_wind_max, normalized)` - 转换到实际数值
3. **速度计算**: `length(velocity)` - 计算风速大小 √(u²+v²)
4. **归一化**: `speed / max_speed` - 标准化到0-1范围
5. **颜色选择**: 根据speed_t值从颜色渐变纹理中选择对应颜色

#### 6.2.3 颜色渐变映射表

**默认颜色映射**
```javascript
const defaultRampColors = {
    0.0: '#3288bd',  // 深蓝色 - 无风/微风 (0-1 m/s)
    0.1: '#66c2a5',  // 青色 - 轻风 (1-3 m/s)
    0.2: '#abdda4',  // 浅绿 - 和风 (3-5 m/s)
    0.3: '#e6f598',  // 黄绿 - 清风 (5-7 m/s)
    0.4: '#fee08b',  // 黄色 - 劲风 (7-9 m/s)
    0.5: '#fdae61',  // 橙色 - 清劲风 (9-11 m/s)
    0.6: '#f46d43',  // 橙红 - 强风 (11-13 m/s)
    1.0: '#d53e4f'   // 红色 - 飓风级 (13+ m/s)
};
```

**颜色渐变原理**:
- **冷色调 (蓝-青)**: 代表低风速区域
- **暖色调 (黄-橙-红)**: 代表高风速区域
- **平滑过渡**: 使用线性插值实现颜色渐变

#### 6.2.4 着色效果分析

**风速-颜色对应关系**:
- **蓝色粒子** (RGB: 50,136,189): 风速接近0，静止或微风区域
- **绿色粒子** (RGB: 102,194,165): 风速中等，温和的风力
- **黄色粒子** (RGB: 254,224,139): 风速较大，明显的风力
- **红色粒子** (RGB: 213,62,79): 风速很强，剧烈风力

**视觉反馈机制**:
- 粒子颜色直观反映局部风场强度
- 颜色变化平滑，避免视觉跳跃
- 高对比度颜色便于识别风力等级

#### 6.2.5 性能优化

**GPU并行计算**:
- 每个粒子独立计算着色
- 向量化操作支持批量处理
- 纹理采样硬件加速

**内存效率**:
- 颜色渐变纹理预生成 (16×16像素)
- 单纹理同时存储U、V分量
- 归一化减少数值精度损失

### 6.3 轨迹渲染

#### 6.3.1 粒子状态更新

**WebGL更新着色器** (update.frag.glsl)

```glsl
precision mediump float;

uniform sampler2D u_wind;        // 风场纹理
uniform sampler2D u_particles;   // 粒子状态纹理
uniform vec2 u_wind_res;         // 风场分辨率
uniform vec2 u_wind_min;         // 风场最小值
uniform vec2 u_wind_max;         // 风场最大值
uniform float u_speed_factor;    // 速度因子
uniform float u_drop_rate;       // 重新生成粒子概率
uniform float u_drop_rate_bump;  // 速度相关重新生成概率
uniform float u_rand_seed;       // 随机种子

varying vec2 v_particle_pos;     // 粒子位置

// 伪随机函数
float random(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 position = texture2D(u_particles, v_particle_pos).xy;
    vec2 velocity = texture2D(u_wind, position).rg;
    
    // 还原实际风速值
    velocity = mix(u_wind_min, u_wind_max, velocity);
    
    // 计算粒子移动
    position += velocity * u_speed_factor;
    
    // 边界重置
    if (position.x < 0.0 || position.x > 1.0 || 
        position.y < 0.0 || position.y > 1.0 ||
        random(position) < u_drop_rate + length(velocity) * u_drop_rate_bump) {
        position = vec2(random(position), random(position.yx));
    }
    
    gl_FragColor = vec4(position, 0.0, 1.0);
}
```

#### 6.3.2 粒子生命周期管理

**重生成机制**:
- **边界溢出**: 粒子超出显示区域时重新生成
- **随机重新生成**: 按固定概率随机重新分布粒子
- **速度相关重新生成**: 高风速区域粒子更容易重新生成

```javascript
// 重生成概率计算
const dropProbability = baseDropRate + windSpeed * speedBumpRate;
if (Math.random() < dropProbability) {
    // 重新生成粒子位置
    particle.position = getRandomPosition();
}
```

## 7. 性能优化

### 7.1 内存优化
- **元数据压缩**: 移除完整坐标数组，只保留边界信息
- **纹理压缩**: 使用PNG格式进行无损压缩
- **数据分离**: 将元数据和小量纹理数据分离加载

### 7.2 渲染优化
- **GPU加速**: 使用WebGL进行粒子系统计算
- **批处理**: 一次性处理大量粒子
- **纹理采样**: 使用线性插值平滑粒子运动

## 8. 数据验证

### 8.1 数据完整性检查

```javascript
// 验证数据范围
function validateWindData(metadata) {
    const checks = [
        {name: 'width', valid: metadata.width > 0},
        {name: 'height', valid: metadata.height > 0},
        {name: 'uMin < uMax', valid: metadata.uMin < metadata.uMax},
        {name: 'vMin < vMax', valid: metadata.vMin < metadata.vMax},
        {name: 'speedMin < speedMax', valid: metadata.speedMin < metadata.speedMax}
    ];
    
    return checks.every(check => check.valid);
}
```

### 8.2 可视化质量检查

- **风速分布**: 检查极值是否合理
- **风向一致性**: 确保风向计算正确
- **边界条件**: 验证海岸线边界处理
- **动画流畅性**: 检查粒子运动是否自然

## 9. 扩展功能

### 9.1 时间序列动画
- 支持多时间步数据切换
- 实现平滑的时间插值
- 提供播放控制界面

### 9.2 数据叠加
- 温度数据叠加显示
- 气压等值线显示
- 卫星云图背景

### 9.3 交互功能
- 鼠标悬停显示详细风场信息
- 点击选择特定区域
- 动态调整显示参数

## 10. 技术栈总结

- **数据处理**: Node.js + netcdfjs
- **图像处理**: PNG.js
- **可视化**: WebGL + GLSL着色器
- **前端框架**: 原生JavaScript
- **构建工具**: Rollup
- **服务**: Simple HTTP Server

这个转换系统实现了从科学计算数据到实时可视化的完整链路，在保证数据精度的同时实现了高效的压缩和渲染。