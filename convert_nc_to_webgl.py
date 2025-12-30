#!/usr/bin/env python3
"""
NC文件转WebGL可视化数据格式
支持风场数据的NC文件解析和转换
"""

import json
import os
import sys
import argparse
from datetime import datetime
import numpy as np
from PIL import Image

def validate_nc_file(nc_file_path):
    """验证NC文件格式"""
    try:
        import netCDF4 as nc
        with nc.Dataset(nc_file_path, 'r') as ds:
            # 检查必要的变量是否存在
            variables = list(ds.variables.keys())
            print(f"NC文件包含的变量: {variables}")
            
            # 查找风场相关变量
            wind_vars = []
            for var in variables:
                if any(keyword in var.lower() for keyword in ['u', 'v', 'wind', 'speed']):
                    wind_vars.append(var)
            
            if not wind_vars:
                print("⚠️  警告: 未找到风场相关变量")
                return False, []
            
            print(f"✓ 找到风场变量: {wind_vars}")
            return True, wind_vars
            
    except ImportError:
        print("❌ 错误: 缺少netCDF4库，请安装: pip install netCDF4")
        return False, []
    except Exception as e:
        print(f"❌ NC文件验证失败: {e}")
        return False, []

def extract_wind_data(nc_file_path, time_step=0):
    """从NC文件中提取风场数据"""
    try:
        import netCDF4 as nc
        
        with nc.Dataset(nc_file_path, 'r') as ds:
            print(f"正在解析NC文件: {os.path.basename(nc_file_path)}")
            
            # 获取维度信息
            dimensions = list(ds.dimensions.keys())
            print(f"文件维度: {dimensions}")
            
            # 查找经纬度变量
            lon_var = None
            lat_var = None
            
            for var_name in ds.variables:
                var = ds.variables[var_name]
                if var_name.lower() in ['lon', 'longitude', 'x']:
                    lon_var = var_name
                elif var_name.lower() in ['lat', 'latitude', 'y']:
                    lat_var = var_name
            
            if not lon_var or not lat_var:
                print("❌ 未找到经纬度变量")
                return None
            
            # 获取经纬度数据
            lon_data = ds.variables[lon_var][:]
            lat_data = ds.variables[lat_var][:]
            
            print(f"经度范围: {lon_data.min():.2f} 到 {lon_data.max():.2f}")
            print(f"纬度范围: {lat_data.min():.2f} 到 {lat_data.max():.2f}")
            
            # 查找U和V分量
            u_var = None
            v_var = None
            
            for var_name in ds.variables:
                var_lower = var_name.lower()
                if 'u' in var_lower and 'v' not in var_lower:
                    u_var = var_name
                elif 'v' in var_lower and 'u' not in var_lower:
                    v_var = var_name
            
            if not u_var or not v_var:
                print("❌ 未找到U、V风分量变量")
                return None
            
            # 获取风分量数据
            u_data = ds.variables[u_var][:]
            v_data = ds.variables[v_var][:]
            
            # 处理时间维度
            if len(u_data.shape) > 2:
                # 有时间维度，取第一个时间步
                u_data = u_data[time_step]
                v_data = v_data[time_step]
            
            print(f"U分量范围: {u_data.min():.2f} 到 {u_data.max():.2f}")
            print(f"V分量范围: {v_data.min():.2f} 到 {v_data.max():.2f}")
            
            # 计算风速和风向
            wind_speed = np.sqrt(u_data**2 + v_data**2)
            wind_direction = np.arctan2(u_data, v_data) * 180 / np.pi
            
            return {
                'longitude': lon_data.tolist(),
                'latitude': lat_data.tolist(),
                'u_component': u_data.tolist(),
                'v_component': v_data.tolist(),
                'wind_speed': wind_speed.tolist(),
                'wind_direction': wind_direction.tolist(),
                'metadata': {
                    'source_file': os.path.basename(nc_file_path),
                    'extraction_time': datetime.now().isoformat(),
                    'variables': {
                        'longitude': lon_var,
                        'latitude': lat_var,
                        'u_component': u_var,
                        'v_component': v_var
                    }
                }
            }
            
    except Exception as e:
        print(f"❌ 数据提取失败: {e}")
        return None

def create_png_visualization(data, output_path):
    """创建PNG可视化图像"""
    try:
        # 创建速度图像
        wind_speed = np.array(data['wind_speed'])
        
        # 归一化到0-255范围
        speed_min, speed_max = wind_speed.min(), wind_speed.max()
        if speed_max > speed_min:
            normalized_speed = ((wind_speed - speed_min) / (speed_max - speed_min) * 255).astype(np.uint8)
        else:
            normalized_speed = np.zeros_like(wind_speed, dtype=np.uint8)
        
        # 创建RGB图像
        height, width = normalized_speed.shape
        image_array = np.zeros((height, width, 3), dtype=np.uint8)
        
        # 速度映射到颜色（蓝色到红色）
        image_array[:, :, 0] = normalized_speed  # Red
        image_array[:, :, 1] = 0  # Green
        image_array[:, :, 2] = 255 - normalized_speed  # Blue
        
        # 保存图像
        image = Image.fromarray(image_array, 'RGB')
        image.save(output_path)
        print(f"✓ PNG图像已保存: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ PNG创建失败: {e}")
        return False

def convert_nc_file(nc_file_path, output_dir="demo/wind_wrf"):
    """转换单个NC文件"""
    print(f"\n=== 转换文件: {os.path.basename(nc_file_path)} ===")
    
    # 验证文件
    is_valid, wind_vars = validate_nc_file(nc_file_path)
    if not is_valid:
        return False
    
    # 提取数据
    wind_data = extract_wind_data(nc_file_path)
    if not wind_data:
        return False
    
    # 生成输出文件名
    base_name = os.path.splitext(os.path.basename(nc_file_path))[0]
    # 提取时间信息（例如：WRFOUT_2025-06-27_01 -> 2025062701）
    if 'WRFOUT_' in base_name:
        time_part = base_name.replace('WRFOUT_', '').replace('-', '').replace('_', '')
        output_name = time_part
    else:
        output_name = base_name
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 保存JSON数据
    json_path = os.path.join(output_dir, f"{output_name}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(wind_data, f, ensure_ascii=False, indent=2)
    print(f"✓ JSON数据已保存: {json_path}")
    
    # 创建PNG可视化
    png_path = os.path.join(output_dir, f"{output_name}.png")
    if create_png_visualization(wind_data, png_path):
        print(f"✓ 转换完成: {output_name}")
        return True
    else:
        return False

def main():
    parser = argparse.ArgumentParser(description='NC文件转WebGL可视化数据')
    parser.add_argument('input', help='输入NC文件路径或目录')
    parser.add_argument('--output', '-o', default='demo/wind_wrf', help='输出目录')
    parser.add_argument('--list', '-l', action='store_true', help='列出NC文件信息')
    
    args = parser.parse_args()
    
    if args.list:
        # 列出NC文件信息
        if os.path.isdir(args.input):
            nc_files = [f for f in os.listdir(args.input) if f.endswith('.nc')]
            print(f"在目录 {args.input} 中找到 {len(nc_files)} 个NC文件:")
            for nc_file in nc_files:
                print(f"  - {nc_file}")
        else:
            print(f"NC文件: {args.input}")
            validate_nc_file(args.input)
        return
    
    # 转换文件
    if os.path.isfile(args.input):
        convert_nc_file(args.input, args.output)
    elif os.path.isdir(args.input):
        nc_files = [f for f in os.listdir(args.input) if f.endswith('.nc')]
        success_count = 0
        
        for i, nc_file in enumerate(nc_files, 1):
            print(f"\n[{i}/{len(nc_files)}] 处理文件: {nc_file}")
            nc_path = os.path.join(args.input, nc_file)
            if convert_nc_file(nc_path, args.output):
                success_count += 1
        
        print(f"\n=== 批量转换完成 ===")
        print(f"成功: {success_count}/{len(nc_files)} 个文件")
    else:
        print(f"❌ 输入路径不存在: {args.input}")

if __name__ == "__main__":
    main()