package health

import (
	"net/http"
)

// Handler serves healthcheck probe responses.
func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "hot reload working now"}`))
}
