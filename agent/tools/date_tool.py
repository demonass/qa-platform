"""
日期工具 - 获取当前日期和时间

功能：
1. 获取当前日期
2. 获取当前时间
3. 用于回答时效性问题（无需网络）
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional
import datetime


class DateTool(BaseTool):
    """获取当前日期时间工具"""

    name: str = "get_current_datetime"
    description: str = "用于获取当前日期和时间，适用于回答用户关于当前日期、星期几、时间等问题"

    def _run(self) -> str:
        """执行获取当前日期时间"""
        now = datetime.datetime.now()
        
        week_days = ['一', '二', '三', '四', '五', '六', '日']
        weekday = week_days[now.weekday()]
        
        result = f"""当前日期时间：
- 日期：{now.year}年{now.month}月{now.day}日
- 星期：星期{weekday}
- 时间：{now.hour}:{now.minute:02d}:{now.second:02d}"""
        
        return result
