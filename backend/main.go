package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	AgentServiceURL string
	AuthToken       string
	JWTSecret       string
	Port            string
)

// ---------- types ----------

type ChatRequest struct {
	Message       string `json:"message" binding:"required"`
	SessionID     string `json:"session_id"`
	Mode          string `json:"mode"`
	WebSearchMode bool   `json:"web_search_mode"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role"`
}

type ChangePasswordRequest struct {
	UserID      string `json:"user_id"`
	NewPassword string `json:"new_password"`
}

type ExportRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Format    string `json:"format"`
}

type JWTClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type RequestLog struct {
	Timestamp  string  `json:"timestamp"`
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Duration   float64 `json:"duration_ms"`
	TokenUsed  int     `json:"token_used"`
	SessionID  string  `json:"session_id,omitempty"`
	StatusCode int     `json:"status_code"`
	Error      string  `json:"error,omitempty"`
}

// ---------- JWT helpers ----------

func generateJWT(userID, username, role string) (string, error) {
	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(JWTSecret))
}

func parseJWT(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, jwt.ErrSignatureInvalid
}

// ---------- middleware ----------

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Legacy static-token fallback
		if AuthToken != "" {
			token := c.GetHeader("Authorization")
			token = strings.TrimPrefix(token, "Bearer ")
			if token == "" {
				token = c.GetHeader("X-Auth-Token")
			}
			if token == AuthToken {
				c.Next()
				return
			}
		}

		// JWT verification
		authHeader := c.GetHeader("Authorization")
		authHeader = strings.TrimPrefix(authHeader, "Bearer ")

		// Allow unauthenticated access when no auth is configured
		if authHeader == "" {
			c.Next()
			return
		}

		claims, err := parseJWT(authHeader)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "登录已过期，请重新登录"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func adminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "仅管理员可操作"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func loggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start).Milliseconds()

		rl := RequestLog{
			Timestamp:  time.Now().Format(time.RFC3339),
			Method:     c.Request.Method,
			Path:       c.Request.URL.Path,
			Duration:   float64(duration),
			SessionID:  c.GetHeader("X-Session-ID"),
			StatusCode: c.Writer.Status(),
			Error:      c.Errors.String(),
		}
		logJSON, _ := json.Marshal(rl)
		log.Printf("[REQUEST] %s", string(logJSON))
	}
}

// ---------- helper: forward request to agent with user context ----------

func forwardToAgent(c *gin.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, AgentServiceURL+path, body)
	if err != nil {
		return nil, err
	}

	// Inject user context from JWT
	if userID, exists := c.Get("user_id"); exists {
		req.Header.Set("X-User-Id", userID.(string))
	}
	if role, exists := c.Get("role"); exists {
		req.Header.Set("X-User-Role", role.(string))
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Minute}
	return client.Do(req)
}

func proxyAgentResponse(c *gin.Context, resp *http.Response) {
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Copy headers
	for k, vs := range resp.Header {
		for _, v := range vs {
			c.Header(k, v)
		}
	}
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

// ---------- env ----------

func loadEnv() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}
	AgentServiceURL = getEnv("AGENT_SERVICE_URL", "http://127.0.0.1:8000")
	AuthToken = getEnv("AUTH_TOKEN", "")
	JWTSecret = getEnv("JWT_SECRET", "qa-platform-default-jwt-secret-change-me")
	Port = getEnv("PORT", "8081")
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// ---------- main ----------

func main() {
	loadEnv()

	if JWTSecret == "qa-platform-default-jwt-secret-change-me" {
		log.Println("WARNING: JWT_SECRET is using default value — change it in production!")
	}

	log.Println("Backend service starting...")
	log.Printf("Agent Service URL: %s", AgentServiceURL)
	log.Printf("Listening on port: %s", Port)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(loggingMiddleware())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Auth-Token", "X-Session-ID", "X-User-Id", "X-User-Role"},
		ExposeHeaders:    []string{"Content-Length", "X-Session-ID"},
		AllowCredentials: true,
	}))

	// ── Public routes ──
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "qa-backend"})
	})
	r.GET("/api/agent/config", handleGetAgentConfig)

	// ── Auth routes (public) ──
	r.POST("/api/auth/login", handleLogin)
	r.POST("/api/auth/register", handlePublicRegister)

	// ── Authenticated routes ──
	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		// Chat
		api.POST("/chat", handleChat)
		api.POST("/chat/stream", handleChatStream)

		// History
		api.GET("/history/:session_id", handleGetHistory)
		api.DELETE("/history/:session_id", handleClearHistory)
		api.GET("/sessions", handleListSessions)

		// Export
		api.POST("/export", handleExport)

		// Admin routes
		admin := api.Group("/admin")
		admin.Use(adminMiddleware())
		{
			admin.POST("/users", handleCreateUser)
			admin.GET("/users", handleListUsers)
			admin.DELETE("/users/:id", handleDeleteUser)
			admin.POST("/change-password", handleChangePassword)
		}
	}

	log.Printf("Backend service starting on port %s...", Port)
	if err := r.Run(":" + Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// ── Agent config ──

func handleGetAgentConfig(c *gin.Context) {
	resp, err := http.Get(AgentServiceURL + "/config")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	var config map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse config"})
		return
	}
	c.JSON(http.StatusOK, config)
}

// ── Auth handlers ──

func handleLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Forward credentials to agent service for verification
	jsonData, _ := json.Marshal(req)
	resp, err := http.Post(
		AgentServiceURL+"/auth/login",
		"application/json",
		bytes.NewReader(jsonData),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "认证服务异常"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		var agentErr map[string]interface{}
		json.Unmarshal(body, &agentErr)
		c.JSON(resp.StatusCode, gin.H{"error": agentErr["detail"]})
		return
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	user := result["user"].(map[string]interface{})

	// Generate JWT
	token, err := generateJWT(
		user["id"].(string),
		user["username"].(string),
		user["role"].(string),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token 生成失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func handlePublicRegister(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}

	jsonData, _ := json.Marshal(req)
	resp, err := http.Post(
		AgentServiceURL+"/auth/register",
		"application/json",
		bytes.NewReader(jsonData),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "注册失败"})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var agentErr map[string]interface{}
		json.Unmarshal(body, &agentErr)
		c.JSON(resp.StatusCode, gin.H{"error": agentErr["detail"]})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "注册成功"})
}

func handleCreateUser(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}

	jsonData, _ := json.Marshal(req)
	resp, err := forwardToAgent(c, "POST", "/auth/register", bytes.NewReader(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建用户失败"})
		return
	}
	proxyAgentResponse(c, resp)
}

func handleListUsers(c *gin.Context) {
	resp, err := forwardToAgent(c, "GET", "/auth/users", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户列表失败"})
		return
	}
	proxyAgentResponse(c, resp)
}

func handleDeleteUser(c *gin.Context) {
	userID := c.Param("id")
	resp, err := forwardToAgent(c, "DELETE", "/auth/users/"+userID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除用户失败"})
		return
	}
	proxyAgentResponse(c, resp)
}

func handleChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	jsonData, _ := json.Marshal(req)
	resp, err := forwardToAgent(c, "POST", "/auth/change-password", bytes.NewReader(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改密码失败"})
		return
	}
	proxyAgentResponse(c, resp)
}

// ── Chat handlers ──

func handleChat(c *gin.Context) {
	start := time.Now()

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SessionID == "" {
		req.SessionID = uuid.New().String()
	}

	jsonData, _ := json.Marshal(req)
	resp, err := forwardToAgent(c, "POST", "/chat", bytes.NewReader(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	var agentResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&agentResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse agent response"})
		return
	}

	duration := time.Since(start).Milliseconds()
	log.Printf("[CHAT] session=%s duration=%dms status=success", req.SessionID, duration)

	c.JSON(http.StatusOK, gin.H{
		"response":   agentResp["response"],
		"status":     agentResp["status"],
		"session_id": req.SessionID,
	})
}

func handleChatStream(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SessionID == "" {
		req.SessionID = uuid.New().String()
	}

	jsonData, _ := json.Marshal(req)
	resp, err := forwardToAgent(c, "POST", "/chat/stream", bytes.NewReader(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Session-ID", req.SessionID)
	c.Header("Connection", "keep-alive")

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			break
		}
		if line == "\n" || line == "\r\n" {
			continue
		}
		c.Writer.WriteString(line)
		c.Writer.Flush()
	}
}

// ── History / Session handlers ──

func handleGetHistory(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	resp, err := forwardToAgent(c, "GET", "/history/"+sessionID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	proxyAgentResponse(c, resp)
}

func handleClearHistory(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	resp, err := forwardToAgent(c, "DELETE", "/history/"+sessionID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	proxyAgentResponse(c, resp)
}

func handleListSessions(c *gin.Context) {
	resp, err := forwardToAgent(c, "GET", "/sessions", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	proxyAgentResponse(c, resp)
}

func handleExport(c *gin.Context) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	format := req.Format
	if format == "" {
		format = "markdown"
	}

	resp, err := forwardToAgent(c, "GET", "/export/"+req.SessionID+"?format="+format, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	proxyAgentResponse(c, resp)
}
