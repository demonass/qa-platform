"""
代码分析工具 - CodeAnalyzerTool

功能：
1. 根据 Git Commit ID 获取代码变更
2. 分析代码变更点，识别受影响的模块
3. 生成测试建议，针对变更代码推荐测试用例
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
import subprocess
import os
import re


class CodeAnalyzerInput(BaseModel):
    commit_id: str = Field(description="Git commit ID")
    repo_path: Optional[str] = Field(default=None, description="代码仓库路径")


class CodeAnalyzerTool(BaseTool):
    """分析 Git 代码变更的工具"""
    
    name: str = "code_analyzer"
    description: str = "分析 Git 代码变更，输入 commit ID 获取代码差异，并提供测试建议"
    
    def _run(self, commit_id: str, repo_path: Optional[str] = None) -> str:
        """执行代码分析"""
        try:
            if repo_path is None:
                repo_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            
            diff = self._get_git_diff(commit_id, repo_path)
            
            if not diff:
                return f"无法获取 commit {commit_id} 的代码变更信息"
            
            analysis = self._analyze_diff(diff)
            suggestions = self._generate_test_suggestions(analysis)
            
            return f"""
## 代码变更分析报告

### Commit ID
{commit_id}

### 变更概览
- 修改文件数：{len(analysis['files_changed'])}
- 新增代码行数：{analysis['lines_added']}
- 删除代码行数：{analysis['lines_deleted']}

### 修改的文件
{chr(10).join(f"- {file}" for file in analysis['files_changed'])}

### 变更类型统计
{chr(10).join(f"- {change_type}: {count} 处" for change_type, count in analysis['change_types'].items())}

### 测试建议
{suggestions}
"""
        except Exception as e:
            return f"代码分析失败: {str(e)}"
    
    def _get_git_diff(self, commit_id: str, repo_path: str) -> str:
        """获取 Git commit 的 diff"""
        try:
            result = subprocess.run(
                ["git", "show", commit_id, "--stat"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                return ""
            return result.stdout
        except Exception:
            return ""
    
    def _analyze_diff(self, diff: str) -> Dict[str, Any]:
        """分析 diff 信息"""
        files_changed = []
        lines_added = 0
        lines_deleted = 0
        change_types = {
            "新增文件": 0,
            "修改文件": 0,
            "删除文件": 0,
            "配置变更": 0,
            "测试文件": 0,
        }
        
        lines = diff.strip().split('\n')
        for line in lines:
            match = re.match(r'^([^|]+?)\s+\|\s+(\d+)\s+([+-]+)$', line.strip())
            if match:
                file_path = match.group(1).strip()
                files_changed.append(file_path)
                
                if file_path.endswith('.py'):
                    if '/tests/' in file_path or file_path.startswith('test_'):
                        change_types["测试文件"] += 1
                    else:
                        change_types["修改文件"] += 1
                elif file_path.endswith('.json') or file_path.endswith('.yaml') or file_path.endswith('.yml'):
                    change_types["配置变更"] += 1
                elif 'deleted' in line.lower():
                    change_types["删除文件"] += 1
                else:
                    change_types["修改文件"] += 1
        
        return {
            "files_changed": files_changed,
            "lines_added": lines_added,
            "lines_deleted": lines_deleted,
            "change_types": {k: v for k, v in change_types.items() if v > 0}
        }
    
    def _generate_test_suggestions(self, analysis: Dict[str, Any]) -> str:
        """根据分析结果生成测试建议"""
        suggestions = []
        
        for file in analysis['files_changed']:
            if file.endswith('.py'):
                if '/services/' in file:
                    suggestions.append(f"- 🧪 建议为 `{file}` 中的新增功能编写单元测试")
                elif '/api/' in file:
                    suggestions.append(f"- 🔌 建议对 `{file}` 中的 API 接口进行集成测试")
                elif '/models/' in file:
                    suggestions.append(f"- 📊 建议对 `{file}` 中的数据模型进行边界测试")
        
        if analysis['change_types'].get("配置变更", 0) > 0:
            suggestions.append("- ⚙️ 建议验证配置变更是否会影响现有功能")
        
        if analysis['change_types'].get("测试文件", 0) == 0 and len(analysis['files_changed']) > 0:
            suggestions.append("- ⚠️ 警告：未发现新增测试文件，建议补充")
        
        if not suggestions:
            suggestions.append("- 根据代码变更，建议进行回归测试")
        
        return chr(10).join(suggestions)