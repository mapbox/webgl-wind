#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

// 读取风场数据
function loadWindData(inputFile) {
    console.log('Loading wind data from:', inputFile);
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    // 检查新的数据结构
    if (data.wind && data.wind.u_component && data.spatial && data.spatial.grid) {
        const lon = data.spatial.grid.longitude;
        const lat = data.spatial.grid.latitude;
        
        // 获取U和V分量数据
        const U10 = data.wind.u_component.data || data.wind.u_component.sample_data;
        const V10 = data.wind.v_component.data || data.wind.v_component.sample_data;
        
        console.log(`Data dimensions: ${lat.length} lat, ${lon.length} lon`);
        console.log(`U component shape: ${JSON.stringify(U10.length ? [U10.length, ...(U10[0] ? [U10[0].length] : [])] : 'unknown')}`);
        console.log(`V component shape: ${JSON.stringify(V10.length ? [V10.length, ...(V10[0] ? [V10[0].length] : [])] : 'unknown')}`);
        
        return { 
            lon, 
            lat, 
            U10, 
            V10, 
            timestamp: data.temporal.time_points[0] || '2025-06-27T01:00:00Z',
            metadata: data.metadata
        };
    } else if (data.variables) {
        // 兼容原始格式
        const lon = data.variables.lon.data;
        const lat = data.variables.lat.data;
        const U10 = data.variables.U10.data;
        const V10 = data.variables.V10.data;
        
        console.log(`Data dimensions: ${U10.length} time steps, ${lat.length} lat, ${lon.length} lon`);
        return { lon, lat, U10, V10, timestamp: '2025062701' };
    } else {
        throw new Error('Unknown data format in ' + inputFile);
    }
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
    const uData = Array.isArray(U10[0]) ? U10[timeIndex] : U10;
    const vData = Array.isArray(V10[0]) ? V10[timeIndex] : V10;
    
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
    for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
            const idx = (ny - 1 - y) * nx * 4 + x * 4; // 翻转Y轴
            
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
            date: windData.timestamp || "2025-06-27T01:00Z",
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
function saveWindData(windData, outputDir, filename, timeIndex = 0) {
    const { png, metadata } = windToPNG(windData, timeIndex);
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const jsonFile = `${outputDir}/${filename}.json`;
    const pngFile = `${outputDir}/${filename}.png`;
    
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

// 主函数 - 批量转换
async function main() {
    try {
        const inputDir = '/Users/michaellevine/Documents/trae_projects/data';
        const outputDir = './data/wind_data/wrf_data';
        
        console.log('=== 批量风场数据转换工具 ===');
        
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 处理所有风数据文件
        const files = [
            { input: 'wind_data_01.json', output: '2025062701', time: '01:00' },
            { input: 'wind_data_02.json', output: '2025062703', time: '03:00' },
            { input: 'wind_data_03.json', output: '2025062704', time: '04:00' },
            { input: 'wind_data_04.json', output: '2025062706', time: '06:00' },
            { input: 'wind_data_05.json', output: '2025062707', time: '07:00' }
        ];
        
        for (const fileInfo of files) {
            console.log(`\n--- 处理文件: ${fileInfo.input} ---`);
            
            try {
                const inputFile = path.join(inputDir, fileInfo.input);
                const windData = loadWindData(inputFile);
                
                // 使用文件名中的时间信息
                windData.timestamp = `2025-06-27T${fileInfo.time}:00Z`;
                
                const result = await saveWindData(windData, outputDir, fileInfo.output, 0);
                
                console.log(`✅ 成功转换: ${fileInfo.input} -> ${fileInfo.output}`);
                
            } catch (error) {
                console.error(`❌ 转换失败: ${fileInfo.input} - ${error.message}`);
            }
        }
        
        console.log('\n=== 批量转换完成 ===');
        console.log('现在可以更新数据面板文件列表！');
        
    } catch (error) {
        console.error('批量转换失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}