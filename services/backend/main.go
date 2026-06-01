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
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	AgentServiceURL string
	AuthToken       string
	Port            string
)

type ChatRequest struct {
	Message   string `json:"message" binding:"required"`
	SessionID string `json:"session_id"`
}

type ChatResponse struct {
	Response string `json:"response"`
	Status   string `json:"status"`
}

type ExportRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Format    string `json:"format"`
}

type HistoryResponse struct {
	SessionID string      `json:"session_id"`
	History   interface{} `json:"history"`
}

type ExportResponse struct {
	Format  string `json:"format"`
	Content string `json:"content"`
}

type RequestLog struct {
	Timestamp    string  `json:"timestamp"`
	Method       string  `json:"method"`
	Path         string  `json:"path"`
	Duration     float64 `json:"duration_ms"`
	TokenUsed    int     `json:"token_used"`
	SessionID    string  `json:"session_id,omitempty"`
	StatusCode   int     `json:"status_code"`
	Error        string  `json:"error,omitempty"`
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if AuthToken == "" {
			c.Next()
			return
		}

		token := c.GetHeader("Authorization")
		token = strings.TrimPrefix(token, "Bearer ")

		if token == "" {
			token = c.GetHeader("X-Auth-Token")
		}

		if token != AuthToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: invalid or missing token"})
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

		tokenUsed := 0
		if promptTokens, exists := c.Get("prompt_tokens"); exists {
			tokenUsed += promptTokens.(int)
		}
		if completionTokens, exists := c.Get("completion_tokens"); exists {
			tokenUsed += completionTokens.(int)
		}

		rl := RequestLog{
			Timestamp:  time.Now().Format(time.RFC3339),
			Method:      c.Request.Method,
			Path:         c.Request.URL.Path,
			Duration:     float64(duration),
			TokenUsed:    tokenUsed,
			SessionID:    c.GetHeader("X-Session-ID"),
			StatusCode:   c.Writer.Status(),
			Error:        c.Errors.String(),
		}

		logJSON, _ := json.Marshal(rl)
		log.Printf("[REQUEST] %s", string(logJSON))
	}
}

func loadEnv() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	AgentServiceURL = getEnv("AGENT_SERVICE_URL", "http://127.0.0.1:8000")
	AuthToken = getEnv("AUTH_TOKEN", "")
	Port = getEnv("PORT", "8081")
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func main() {
	loadEnv()

	if AuthToken == "" {
		log.Println("WARNING: AUTH_TOKEN not set, authentication disabled")
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
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Auth-Token", "X-Session-ID"},
		ExposeHeaders:    []string{"Content-Length", "X-Session-ID"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "qa-backend",
		})
	})

	r.GET("/api/agent/config", handleGetAgentConfig)

	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.POST("/chat", handleChat)
		api.POST("/chat/stream", handleChatStream)
		api.GET("/history/:session_id", handleGetHistory)
		api.DELETE("/history/:session_id", handleClearHistory)
		api.POST("/export", handleExport)
	}

	log.Printf("Backend service starting on port %s...", Port)
	if err := r.Run(":" + Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

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

	agentReq := map[string]string{
		"message":    req.Message,
		"session_id": req.SessionID,
	}
	jsonData, _ := json.Marshal(agentReq)

	resp, err := http.Post(
		AgentServiceURL+"/chat",
		"application/json",
		bytes.NewReader(jsonData),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	var agentResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&agentResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse agent response"})
		return
	}

	duration := time.Since(start).Milliseconds()
	log.Printf("[CHAT] session=%s duration=%dms status=success", req.SessionID, duration)

	c.JSON(http.StatusOK, gin.H{
		"response":   agentResp.Response,
		"status":     agentResp.Status,
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

	agentReq := map[string]string{
		"message":    req.Message,
		"session_id": req.SessionID,
	}
	jsonData, _ := json.Marshal(agentReq)

	resp, err := http.Post(
		AgentServiceURL+"/chat/stream",
		"application/json",
		bytes.NewReader(jsonData),
	)
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
			log.Printf("Error reading stream: %v", err)
			break
		}

		if line == "\n" || line == "\r\n" {
			continue
		}

		c.Writer.WriteString(line)
		c.Writer.Flush()
	}
}

func handleGetHistory(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	resp, err := http.Get(AgentServiceURL + "/history/" + sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	var historyResp HistoryResponse
	if err := json.NewDecoder(resp.Body).Decode(&historyResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse history response"})
		return
	}

	c.JSON(http.StatusOK, historyResp)
}

func handleClearHistory(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	req, _ := http.NewRequest("DELETE", AgentServiceURL+"/history/"+sessionID, nil)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	c.JSON(http.StatusOK, gin.H{"status": "cleared", "session_id": sessionID})
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

	resp, err := http.Get(AgentServiceURL + "/export/" + req.SessionID + "?format=" + format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to agent service"})
		return
	}
	defer resp.Body.Close()

	var exportResp ExportResponse
	if err := json.NewDecoder(resp.Body).Decode(&exportResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse export response"})
		return
	}

	c.JSON(http.StatusOK, exportResp)
}