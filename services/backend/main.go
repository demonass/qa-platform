package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
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

	c.JSON(http.StatusOK, agentResp)
}

func handleChatStream(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
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
