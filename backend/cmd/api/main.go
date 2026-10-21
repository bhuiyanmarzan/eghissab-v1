package main

import (
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/config"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/middleware"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/modules/health"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/modules/listing"
)

func main() {
	// Lightweight health check flag for container orchestrators
	if len(os.Args) > 1 && os.Args[1] == "--health" {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		resp, err := http.Get("http://127.0.0.1:" + port + "/healthz")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	cfg := config.MustLoad()

	// Global structured JSON logger
	logHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelInfo,
	})
	logger := slog.New(logHandler)
	slog.SetDefault(logger)

	// Database connection pool
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("main.db.connect: %v", err)
	}
	defer db.Close()

	fmt.Println("database connected")
	fmt.Println("starting olx server...")

	// HTTP Router
	mux := http.NewServeMux()

	// Initialize and register domain modules
	healthModule := health.NewModule()
	healthModule.RegisterRoutes(mux)

	listingModule := listing.NewModule(db, logger)
	listingModule.RegisterRoutes(mux)

	// Global middlewares
	handler := middleware.RequestId(mux)

	srv := http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  time.Second * 10,
		WriteTimeout: time.Second * 30,
		IdleTimeout:  time.Second * 60,
	}

	logger.Info("server is listening", "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server failed: %v", err)
	}
}
