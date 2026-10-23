package main

import (
	"context"
	"errors"
	"fmt"
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
	"github.com/bhuiyanmarzan/eghissab-v1/internal/modules/identity"
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

	// logger.Info("database connected",
	// 	"max_open_conns", cfg.DBMaxOpenConns,
	// 	"max_idle_conns", cfg.DBMaxIdleConns,
	// 	"conn_max_lifetime", cfg.DBConnMaxLifetime.String(),
	// 	"conn_max_idle_time", cfg.DBConnMaxIdleTime.String(),
	// )
	fmt.Println("database connected")

	// Initialize transaction & tenant security manager
	txManager := database.NewTxManager(db)
	// Authentication must never run with a privileged/migration connection.
	authCtx, authCancel := context.WithTimeout(context.Background(), 5*time.Second)
	err = identity.CheckRuntime(authCtx, db)
	authCancel()
	if err != nil {
		log.Fatalf("identity database configuration: %v", err)
	}
	var mailer identity.VerificationMailer
	smtpAddr := os.Getenv("SMTP_ADDR")
	if smtpAddr != "" {
		m, err := identity.NewSMTPMailer(identity.SMTPConfig{
			Address:         smtpAddr,
			Username:        os.Getenv("SMTP_USERNAME"),
			Password:        os.Getenv("SMTP_PASSWORD"),
			From:            os.Getenv("SMTP_FROM"),
			VerificationURL: os.Getenv("AUTH_VERIFICATION_URL"),
		})
		if err != nil {
			log.Fatalf("identity mail configuration: %v", err)
		}
		mailer = m
	} else {
		// logger.Warn("SMTP_ADDR not configured; using LogMailer (verification links will be logged)")
		mailer = identity.NewLogMailer(os.Getenv("AUTH_VERIFICATION_URL"), logger)
	}

	signingKey := os.Getenv("AUTH_SIGNING_KEY")
	issuer := os.Getenv("AUTH_ISSUER")
	if issuer == "" {
		issuer = "eghissab-v1"
	}
	audience := os.Getenv("AUTH_AUDIENCE")
	if audience == "" {
		audience = "eghissab-v1-client"
	}
	if signingKey == "" && cfg.Env == "development" {
		signingKey = "ZGV2ZWxvcG1lbnQtYXV0aC1zaWduaW5nLWtleS0zMmJ5dGVzISE="
		logger.Warn("AUTH_SIGNING_KEY not set; using development fallback key")
	}

	identityModule, err := identity.NewModule(txManager, identity.Config{
		SigningKeyBase64:  signingKey,
		Issuer:            issuer,
		Audience:          audience,
		TrustedProxyCIDRs: os.Getenv("AUTH_TRUSTED_PROXY_CIDRS"),
	}, mailer, logger)
	if err != nil {
		log.Fatalf("identity configuration: %v", err)
	}

	// HTTP Router
	mux := http.NewServeMux()
	identityModule.RegisterRoutes(mux)

	// Initialize and register domain modules
	healthModule := health.NewModule()
	healthModule.RegisterRoutes(mux)

	listingModule := listing.NewModule(db, logger)
	listingModule.RegisterRoutes(mux)

	// Global middlewares
	rateLimiter, err := middleware.NewIPRateLimiter(middleware.RateLimiterConfig{
		RequestsPerMinute: cfg.RateLimitRPM,
		Burst:             cfg.RateLimitBurst,
		TrustedProxyCIDRs: cfg.TrustedProxyCIDRs,
		SkipPaths:         []string{"/healthz"},
	})
	if err != nil {
		log.Fatalf("rate limiter configuration: %v", err)
	}

	handler := middleware.RequestId(rateLimiter.Limit(mux))

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

	// Start rate limiter memory cleanup
	rateLimiter.StartCleanup(ctx, 5*time.Minute)

	// Background worker: Periodic cleanup for expired auth_attempts (Phase 1)
	go func() {
		pruneTicker := time.NewTicker(1 * time.Hour)
		defer pruneTicker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-pruneTicker.C:
				pruneCtx, pruneCancel := context.WithTimeout(context.Background(), 15*time.Second)
				deleted, err := identityModule.Service.PruneAttempts(pruneCtx, 24*time.Hour)
				pruneCancel()
				if err != nil {
					logger.Error("failed to prune expired auth attempts", "err", err)
				} else if deleted > 0 {
					logger.Info("pruned expired auth attempts", "deleted_count", deleted)
				}
			}
		}
	}()

	serverErrors := make(chan error, 1)
	go func() {
		// logger.Info("server is listening", "addr", srv.Addr)
		fmt.Println("server is listening", "addr", srv.Addr)
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
