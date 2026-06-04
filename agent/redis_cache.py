import redis
import json
import hashlib
import threading
from typing import Optional, Any, Dict
from config import get_redis_config, REDIS_ENABLED


class RedisCache:
    """Redis 缓存服务类，提供答案缓存功能"""

    def __init__(self):
        self._client = None
        self._lock = threading.Lock()
        self._enabled = REDIS_ENABLED
        self._ttl_seconds = 3600
        self._prefix = "qa_platform:cache:"
        
        if self._enabled:
            self._init_client()

    def _init_client(self):
        """初始化 Redis 客户端"""
        try:
            config = get_redis_config()
            self._ttl_seconds = config["ttl_seconds"]
            
            self._client = redis.Redis(
                host=config["host"],
                port=config["port"],
                password=config["password"] if config["password"] else None,
                db=config["db"],
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            
            # 测试连接
            self._client.ping()
            print("[INFO] Redis 缓存服务初始化成功")
        except Exception as e:
            print(f"[WARN] Redis 缓存服务初始化失败: {e}")
            self._client = None
            self._enabled = False

    def _get_key(self, user_input: str, session_id: str = None) -> str:
        """生成缓存键，基于用户输入的哈希值"""
        # 使用输入内容和会话ID生成唯一键
        content = f"{session_id}:{user_input}" if session_id else user_input
        return self._prefix + hashlib.md5(content.encode()).hexdigest()

    def get(self, user_input: str, session_id: str = None) -> Optional[Dict[str, Any]]:
        """获取缓存的答案"""
        if not self._enabled or not self._client:
            return None

        try:
            key = self._get_key(user_input, session_id)
            cached = self._client.get(key)
            
            if cached:
                print(f"[DEBUG] 缓存命中: {key[:30]}...")
                return json.loads(cached)
            return None
        except Exception as e:
            print(f"[WARN] Redis 获取缓存失败: {e}")
            return None

    def set(self, user_input: str, answer: str, session_id: str = None, 
            intent: str = None, ttl_seconds: int = None) -> bool:
        """设置缓存答案"""
        if not self._enabled or not self._client:
            return False

        try:
            key = self._get_key(user_input, session_id)
            data = {
                "answer": answer,
                "intent": intent,
                "timestamp": self._client.time()[0]
            }
            
            ttl = ttl_seconds if ttl_seconds else self._ttl_seconds
            self._client.setex(key, ttl, json.dumps(data))
            
            print(f"[DEBUG] 缓存写入: {key[:30]}... (TTL: {ttl}s)")
            return True
        except Exception as e:
            print(f"[WARN] Redis 设置缓存失败: {e}")
            return False

    def delete(self, user_input: str, session_id: str = None) -> bool:
        """删除指定缓存"""
        if not self._enabled or not self._client:
            return False

        try:
            key = self._get_key(user_input, session_id)
            result = self._client.delete(key)
            if result > 0:
                print(f"[DEBUG] 缓存删除: {key[:30]}...")
            return result > 0
        except Exception as e:
            print(f"[WARN] Redis 删除缓存失败: {e}")
            return False

    def clear(self, session_id: str = None) -> bool:
        """清除缓存（可按会话ID过滤）"""
        if not self._enabled or not self._client:
            return False

        try:
            if session_id:
                # 只清除指定会话的缓存
                pattern = self._prefix + hashlib.md5(f"{session_id}:".encode()).hexdigest()[:16] + "*"
            else:
                # 清除所有缓存
                pattern = self._prefix + "*"
            
            keys = self._client.keys(pattern)
            if keys:
                self._client.delete(*keys)
                print(f"[DEBUG] 缓存清除: {len(keys)} 条记录")
            return True
        except Exception as e:
            print(f"[WARN] Redis 清除缓存失败: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        if not self._enabled or not self._client:
            return {
                "enabled": False,
                "connected": False,
                "error": "Redis 未启用或未连接"
            }

        try:
            info = self._client.info("stats")
            return {
                "enabled": True,
                "connected": True,
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "ttl_seconds": self._ttl_seconds,
                "prefix": self._prefix
            }
        except Exception as e:
            return {
                "enabled": True,
                "connected": False,
                "error": str(e)
            }

    def is_enabled(self) -> bool:
        """检查缓存是否启用"""
        return self._enabled and self._client is not None


# 全局缓存实例
cache_service = RedisCache()
