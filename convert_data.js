#!/usr/bin/env node

const fs = require('fs');
const PNG = require('pngjs').PNG;

// 读取原始数据
function loadWindData(inputFile) {
    console.log('Loading wind data from:', inputFile);
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    const lon = data.variables.lon.data;
    const lat = data.variables.lat.data;
    const U10 = data.variables.U10.data;
    const V10 = data.variables.V10.data;
    
    console.log(`Data dimensions: ${U10.length} time steps, ${lat.length} lat, ${lon.length} lon`);
    
    return { lon, lat, U10, V10 };
}

// 将风场数据转换为PNG图像
function windToPNG(windData, timeIndex = 0) {
    const { lon, lat, U10, V10 } = windData;
    const ny = lat.length;
    const nx = lon.length;
    
    console.log(`Converting time step ${timeIndex} to PNG...`);
    
    // 创建PNG对象
    const png = new PNG({
        width: nx,
        height: ny,
        filterType: 4
    });
    
    // 获取当前时间步的数据
    const uData = U10[timeIndex];
    const vData = V10[timeIndex];
    
    // 计算风速和风向，并找到最小最大值
    let uMin = Infinity, uMax = -Infinity;
    let vMin = Infinity, vMax = -Infinity;
    let speedMin = Infinity, speedMax = -Infinity;
    
    for (let i = 0; i < ny; i++) {
        for (let j = 0; j < nx; j++) {
            const u = uData[i][j];
            const v = vData[i][j];
            const speed = Math.sqrt(u * u + v * v);
            
            uMin = Math.min(uMin, u);
            uMax = Math.max(uMax, u);
            vMin = Math.min(vMin, v);
            vMax = Math.max(vMax, v);
            speedMin = Math.min(speedMin, speed);
            speedMax = Math.max(speedMax, speed);
        }
    }
    
    console.log(`U range: ${uMin.toFixed(2)} to ${uMax.toFixed(2)}`);
    console.log(`V range: ${vMin.toFixed(2)} to ${vMax.toFixed(2)}`);
    console.log(`Speed range: ${speedMin.toFixed(2)} to ${speedMax.toFixed(2)}`);
    
    // 填充PNG数据
    // WebGL风场通常使用RGBA格式，其中：
    // R = U分量 (归一化到0-255)
    // G = V分量 (归一化到0-255) 
    // B = 0 (未使用)
    // A = 255 (完全不透明)
    
    for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
            const idx = (ny - 1 - y) * nx * 4 + x * 4; // 翻转Y轴，因为PNG从上到下，WebGL从下到上
            
            const u = uData[y][x];
            const v = vData[y][x];
            
            // 将U、V分量归一化到0-255范围
            png.data[idx] = Math.round((u - uMin) / (uMax - uMin) * 255); // R
            png.data[idx + 1] = Math.round((v - vMin) / (vMax - vMin) * 255); // G
            png.data[idx + 2] = 0; // B
            png.data[idx + 3] = 255; // A
        }
    }
    
    return {
        png,
        metadata: {
            source: "WRF Model Output",
            date: "2025-06-27T01:00Z",
            width: nx,
            height: ny,
            uMin: uMin,
            uMax: uMax,
            vMin: vMin,
            vMax: vMax,
            speedMin: speedMin,
            speedMax: speedMax,
            lonMin: Math.min(...lon),
            lonMax: Math.max(...lon),
            latMin: Math.min(...lat),
            latMax: Math.max(...lat)
        }
    };
}

// 保存转换后的数据
function saveWindData(windData, outputDir, timeIndex = 0) {
    const { png, metadata } = windToPNG(windData, timeIndex);
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 生成文件名
    const timestamp = '2025062701'; // 基于实际数据时间
    const jsonFile = `${outputDir}/${timestamp}.json`;
    const pngFile = `${outputDir}/${timestamp}.png`;
    
    // 保存JSON元数据
    fs.writeFileSync(jsonFile, JSON.stringify(metadata, null, 2));
    console.log(`Saved metadata to: ${jsonFile}`);
    
    // 保存PNG图像
    return new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(pngFile);
        png.pack().pipe(stream);
        stream.on('finish', () => {
            console.log(`Saved PNG to: ${pngFile}`);
            resolve({ jsonFile, pngFile, metadata });
        });
        stream.on('error', reject);
    });
}

// 主函数
async function main() {
    try {
        const inputFile = '/Users/michaellevine/Documents/trae_projects/data/outputV2.json';
        const outputDir = './demo/wind_wrf';
        
        console.log('=== WRF风场数据转换工具 ===');
        
        // 加载数据
        const windData = loadWindData(inputFile);
        
        // 转换第一个时间步
        const result = await saveWindData(windData, outputDir, 0);
        
        console.log('=== 转换完成 ===');
        console.log('生成的演示文件:');
        console.log(`  JSON: ${result.jsonFile}`);
        console.log(`  PNG:  ${result.pngFile}`);
        console.log('\n要使用这些文件，请更新demo/index.js中的文件路径。');
        
    } catch (error) {
        console.error('转换失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}