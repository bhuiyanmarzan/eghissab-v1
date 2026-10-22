package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
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
	db, err := database.ConnectWithPool(cfg.DatabaseURL, database.PoolConfig{
		MaxOpenConns:    cfg.DBMaxOpenConns,
		MaxIdleConns:    cfg.DBMaxIdleConns,
		ConnMaxLifetime: cfg.DBConnMaxLifetime,
		ConnMaxIdleTime: cfg.DBConnMaxIdleTime,
	})
	if err != nil {
		log.Fatalf("main.db.connect: %v", err)
	}
	defer db.Close()

	logger.Info("database connected",
		"max_open_conns", cfg.DBMaxOpenConns,
		"max_idle_conns", cfg.DBMaxIdleConns,
		"conn_max_lifetime", cfg.DBConnMaxLifetime.String(),
		"conn_max_idle_time", cfg.DBConnMaxIdleTime.String(),
	)

	// Initialize transaction & tenant security manager
	txManager := database.NewTxManager(db)
	_ = txManager // Available for services requiring transactional boundary

	// HTTP Router
	mux := http.NewServeMux()

	// Initialize and register domain modules
	healthModule := health.NewModule()
	healthModule.RegisterRoutes(mux)

	listingModule := listing.NewModule(db, logger)
	listingModule.RegisterRoutes(mux)

	// Global middlewares
	handler := middleware.RequestId(mux)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  time.Second * 10,
		WriteTimeout: time.Second * 30,
		IdleTimeout:  time.Second * 60,
	}

	// Trap OS termination signals for graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("server is listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	select {
	case err := <-serverErrors:
		log.Fatalf("server failed to start or serve: %v", err)
	case <-ctx.Done():
		logger.Info("shutdown signal received, gracefully draining connections...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("server forced to shutdown", "err", err)
			_ = srv.Close()
		}
		logger.Info("server stopped gracefully")
	}
}
