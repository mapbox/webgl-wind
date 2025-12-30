// 数据面板控制逻辑
class DataPanel {
    constructor() {
        this.wind = window.wind;
        this.availableData = [];
        this.currentDataIndex = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadAvailableData();
        this.setupControls();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const refreshBtn = document.getElementById('refreshBtn');
        const statusDiv = document.getElementById('status');

        // 文件上传处理
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // 刷新按钮
        refreshBtn.addEventListener('click', () => this.refreshVisualization());

        // 点击状态区域隐藏消息
        statusDiv.addEventListener('click', () => this.hideStatus());
    }

    // 显示上传进度
    showUploadProgress(message, progress = 0) {
        const progressContainer = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressContainer && progressFill && progressText) {
            progressContainer.style.display = 'block';
            progressFill.style.width = `${progress}%`;
            progressText.textContent = message;
        }
    }

    // 更新上传进度
    updateUploadProgress(message, progress) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill && progressText) {
            progressFill.style.width = `${progress}%`;
            progressText.textContent = message;
        }
    }

    // 隐藏上传进度
    hideUploadProgress() {
        const progressContainer = document.getElementById('uploadProgress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    // 显示状态消息
    showStatus(message, type = 'loading') {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;
            statusDiv.style.display = 'block';
        }
    }

    setupControls() {
        // 数据面板通过JavaScript控制风场参数，无需额外的GUI
        // 所有的中文控制选项都在左侧数据面板中提供
        console.log('风场控制面板已设置');
        
        // 为中文控制面板添加事件处理程序
        this.setupControlEventListeners();
    }

    setupControlEventListeners() {
        // 粒子数量控制
        const particleCount = document.getElementById('particleCount');
        const particleCountValue = document.getElementById('particleCountValue');
        
        if (particleCount && particleCountValue && this.wind) {
            particleCount.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                particleCountValue.textContent = value;
                this.wind.numParticles = value;
                console.log('粒子数量更新:', value);
            });
        }
        
        // 衰减透明度控制
        const fadeOpacity = document.getElementById('fadeOpacity');
        const fadeOpacityValue = document.getElementById('fadeOpacityValue');
        
        if (fadeOpacity && fadeOpacityValue && this.wind) {
            fadeOpacity.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                fadeOpacityValue.textContent = value.toFixed(3);
                this.wind.fadeOpacity = value;
                console.log('衰减透明度更新:', value);
            });
        }
        
        // 速度因子控制
        const speedFactor = document.getElementById('speedFactor');
        const speedFactorValue = document.getElementById('speedFactorValue');
        
        if (speedFactor && speedFactorValue && this.wind) {
            speedFactor.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                speedFactorValue.textContent = value.toFixed(2);
                this.wind.speedFactor = value;
                console.log('速度因子更新:', value);
            });
        }
        
        // 消失率控制
        const dropRate = document.getElementById('dropRate');
        const dropRateValue = document.getElementById('dropRateValue');
        
        if (dropRate && dropRateValue && this.wind) {
            dropRate.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                dropRateValue.textContent = value.toFixed(3);
                this.wind.dropRate = value;
                console.log('消失率更新:', value);
            });
        }
        
        // 消失率峰值控制
        const dropRateBump = document.getElementById('dropRateBump');
        const dropRateBumpValue = document.getElementById('dropRateBumpValue');
        
        if (dropRateBump && dropRateBumpValue && this.wind) {
            dropRateBump.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                dropRateBumpValue.textContent = value.toFixed(3);
                this.wind.dropRateBump = value;
                console.log('消失率峰值更新:', value);
            });
        }
        
        console.log('中文控制面板事件处理程序已设置');
    }

    async loadAvailableData() {
        try {
            // 实际可用数据列表 - WRF数据
            this.availableData = [
                {
                    id: 0,
                    name: 'WRF 数据 01:00',
                    filename: '2025062701',
                    path: 'data/wind_data/wrf_data/2025062701',
                    description: '2025年6月27日01:00风场数据',
                    size: '计算中...',
                    type: 'wind',
                    originalFile: 'WRFOUT_2025-06-27_01.nc'
                },
                {
                    id: 1,
                    name: 'WRF 数据 03:00',
                    filename: '2025062703',
                    path: 'data/wind_data/wrf_data/2025062703',
                    description: '2025年6月27日03:00风场数据',
                    size: '计算中...',
                    type: 'wind',
                    originalFile: 'WRFOUT_2025-06-27_03.nc'
                },
                {
                    id: 2,
                    name: 'WRF 数据 04:00',
                    filename: '2025062704',
                    path: 'data/wind_data/wrf_data/2025062704',
                    description: '2025年6月27日04:00风场数据',
                    size: '计算中...',
                    type: 'wind',
                    originalFile: 'WRFOUT_2025-06-27_04.nc'
                },
                {
                    id: 3,
                    name: 'WRF 数据 06:00',
                    filename: '2025062706',
                    path: 'data/wind_data/wrf_data/2025062706',
                    description: '2025年6月27日06:00风场数据',
                    size: '计算中...',
                    type: 'wind',
                    originalFile: 'WRFOUT_2025-06-27_06.nc'
                },
                {
                    id: 4,
                    name: 'WRF 数据 07:00',
                    filename: '2025062707',
                    path: 'data/wind_data/wrf_data/2025062707',
                    description: '2025年6月27日07:00风场数据',
                    size: '计算中...',
                    type: 'wind',
                    originalFile: 'WRFOUT_2025-06-27_07.nc'
                }
            ];

            // 计算文件大小
            await this.calculateFileSizes();
            
            this.renderDataList();
            this.selectData(0); // 默认选择第一个数据
        } catch (error) {
            console.error('加载数据列表失败:', error);
            this.showStatus('数据列表加载失败', 'error');
        }
    }

    async calculateFileSizes() {
        // 计算JSON文件大小
        for (const data of this.availableData) {
            try {
                const response = await fetch(`${data.path}.json`);
                if (response.ok) {
                    const contentLength = response.headers.get('content-length');
                    if (contentLength) {
                        const sizeKB = (parseInt(contentLength) / 1024).toFixed(1);
                        data.size = `${sizeKB}KB`;
                    } else {
                        // 如果没有content-length，估算大小
                        data.size = '约50KB';
                    }
                }
            } catch (error) {
                data.size = '未知';
            }
        }
    }

    renderDataList() {
        const container = document.getElementById('dataItems');
        container.innerHTML = '';

        this.availableData.forEach((data, index) => {
            const dataItem = document.createElement('div');
            dataItem.className = 'data-item';
            dataItem.onclick = () => this.selectData(index);

            dataItem.innerHTML = `
                <h3>${data.name}</h3>
                <p><strong>描述:</strong> ${data.description}</p>
                <p><strong>大小:</strong> ${data.size}</p>
                <p><strong>类型:</strong> ${data.type === 'wind' ? '风场数据' : '其他'}</p>
            `;

            container.appendChild(dataItem);
        });
    }

    selectData(index) {
        // 移除之前的选中状态
        const items = document.querySelectorAll('.data-item');
        items.forEach(item => item.classList.remove('active'));

        // 添加新的选中状态
        if (items[index]) {
            items[index].classList.add('active');
        }

        this.currentDataIndex = index;
        const selectedData = this.availableData[index];
        
        this.showStatus(`已选择: ${selectedData.name}`, 'success');
        this.enableRefreshButton();
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (files.length === 0) return;

        Array.from(files).forEach(file => {
            if (file.name.endsWith('.nc')) {
                this.processNCFile(file);
            } else {
                this.showStatus(`不支持的文件格式: ${file.name}`, 'error');
            }
        });
    }

    async processNCFile(file) {
        this.showUploadProgress('正在验证文件...', 0);
        
        try {
            // 验证文件格式
            this.updateUploadProgress('验证文件格式...', 10);
            const isValid = await this.validateNCFile(file);
            if (!isValid) {
                this.showUploadProgress('验证失败', 0);
                this.showStatus(`无效的NC文件格式: ${file.name}`, 'error');
                setTimeout(() => this.hideUploadProgress(), 3000);
                return;
            }

            this.updateUploadProgress('解析文件内容...', 30);
            
            // 模拟解析进度
            await this.simulateParsingProgress(file);
            
            // 解析NC文件
            this.updateUploadProgress('转换数据格式...', 70);
            const result = await this.convertNCFile(file);
            
            if (result.success) {
                this.updateUploadProgress('完成解析...', 90);
                
                // 将处理后的数据添加到可用数据列表
                const newData = {
                    id: this.availableData.length,
                    name: result.displayName,
                    filename: result.filename,
                    path: result.path,
                    description: `上传的NC文件: ${file.name}`,
                    size: `${(file.size / 1024).toFixed(1)}KB`,
                    type: 'wind',
                    uploaded: true,
                    originalFile: file.name
                };

                this.availableData.push(newData);
                this.renderDataList();
                
                this.updateUploadProgress('解析完成', 100);
                this.showStatus(`文件解析成功: ${file.name}`, 'success');
                
                // 3秒后隐藏进度条
                setTimeout(() => {
                    this.hideUploadProgress();
                    this.hideStatus();
                }, 3000);
                
            } else {
                this.showUploadProgress('解析失败', 0);
                this.showStatus(`文件解析失败: ${result.error}`, 'error');
                setTimeout(() => this.hideUploadProgress(), 3000);
            }
            
        } catch (error) {
            this.showUploadProgress('处理失败', 0);
            this.showStatus(`文件处理失败: ${error.message}`, 'error');
            setTimeout(() => this.hideUploadProgress(), 3000);
        }
    }

    // 模拟解析进度
    async simulateParsingProgress(file) {
        const steps = [
            { progress: 40, message: '读取文件数据...' },
            { progress: 50, message: '解析风场信息...' },
            { progress: 60, message: '处理坐标数据...' },
            { progress: 70, message: '生成纹理数据...' }
        ];

        for (const step of steps) {
            await new Promise(resolve => setTimeout(resolve, 500));
            this.updateUploadProgress(step.message, step.progress);
        }
    }

    async validateNCFile(file) {
        // 检查文件扩展名
        if (!file.name.toLowerCase().endsWith('.nc')) {
            this.showStatus('只支持.nc格式文件', 'error');
            return false;
        }

        // 检查文件大小 (限制为50MB)
        if (file.size > 50 * 1024 * 1024) {
            this.showStatus('文件大小超过50MB限制', 'error');
            return false;
        }

        // 这里可以添加更多格式验证
        return true;
    }

    async convertNCFile(file) {
        return new Promise((resolve) => {
            const formData = new FormData();
            formData.append('ncFile', file);
            
            // 创建XMLHttpRequest来跟踪进度
            const xhr = new XMLHttpRequest();
            
            // 跟踪上传进度
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    this.showStatus(`上传进度: ${percentComplete.toFixed(1)}%`, 'loading');
                }
            });
            
            // 处理响应
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve({
                            success: false,
                            error: '服务器响应格式错误'
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        error: `服务器错误: ${xhr.status}`
                    });
                }
            });
            
            // 处理错误
            xhr.addEventListener('error', () => {
                resolve({
                    success: false,
                    error: '网络连接失败'
                });
            });
            
            // 发送请求
            xhr.open('POST', '/api/upload-nc');
            xhr.send(formData);
        });
    }

    refreshVisualization() {
        if (this.currentDataIndex === null) {
            this.showStatus('请先选择要显示的数据', 'error');
            return;
        }

        const selectedData = this.availableData[this.currentDataIndex];
        this.showStatus(`正在加载: ${selectedData.name}`, 'loading');
        
        // 更新可视化
        this.updateWindVisualization(selectedData);
    }

    updateWindVisualization(data) {
        // 使用新的updateWindData函数
        if (typeof updateWindData === 'function') {
            updateWindData(data);
            this.showStatus(`可视化已更新: ${data.name}`, 'success');
        } else if (typeof updateWind === 'function') {
            updateWind(data.filename);
            this.showStatus(`可视化已更新: ${data.name}`, 'success');
        } else {
            // 如果updateWind函数不可用，使用直接加载方法
            this.loadWindDataDirectly(data);
        }
    }

    loadWindDataDirectly(data) {
        const jsonPath = `${data.path}.json`;
        const pngPath = `${data.path}.png`;

        fetch(jsonPath)
            .then(response => response.json())
            .then(windData => {
                const windImage = new Image();
                windData.image = windImage;
                windImage.src = pngPath;
                windImage.onload = () => {
                    this.wind.setWind(windData);
                    this.showStatus(`可视化已更新: ${data.name}`, 'success');
                };
                windImage.onerror = () => {
                    this.showStatus(`图像加载失败: ${pngPath}`, 'error');
                };
            })
            .catch(error => {
                this.showStatus(`数据加载失败: ${error.message}`, 'error');
            });
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        // 自动隐藏成功消息
        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 3000);
        }
    }

    hideStatus() {
        const statusDiv = document.getElementById('status');
        statusDiv.style.display = 'none';
    }

    enableRefreshButton() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.disabled = false;
    }
}

// 页面加载完成后初始化数据面板
document.addEventListener('DOMContentLoaded', async () => {
    // 等待WebGL组件加载完成
    setTimeout(async () => {
        try {
            window.dataPanel = new DataPanel();
            console.log('数据面板初始化完成');
        } catch (error) {
            console.error('数据面板初始化失败:', error);
        }
    }, 1000);
});