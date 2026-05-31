package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	AgentServiceURL = "http://127.0.0.1:8000"
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

func main() {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "qa-backend",
		})
	})

	r.POST("/api/chat", handleChat)
	r.POST("/api/chat/stream", handleChatStream)
	r.GET("/api/history/:session_id", handleGetHistory)
	r.DELETE("/api/history/:session_id", handleClearHistory)
	r.POST("/api/export", handleExport)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Backend service starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func handleChat(c *gin.Context) {
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

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "History cleared"})
}

func handleExport(c *gin.Context) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.SessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	if req.Format == "" {
		req.Format = "markdown"
	}

	exportReq := map[string]string{
		"session_id": req.SessionID,
		"format":     req.Format,
	}
	jsonData, _ := json.Marshal(exportReq)

	resp, err := http.Post(
		AgentServiceURL+"/export",
		"application/json",
		bytes.NewReader(jsonData),
	)
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
