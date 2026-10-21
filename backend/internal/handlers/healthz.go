package handlers

import (
	"github.com/bhuiyanmarzan/eghissab-v1/internal/modules/health"
)

// Health forwards to the health module handler for backwards compatibility.
var Health = health.Handler
