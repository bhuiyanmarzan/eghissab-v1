package identity

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/mail"
	"net/smtp"
	"net/url"
	"strings"
	"time"
)

// LogMailer delivers verification tokens by writing them to structured logs (for development and tests).
type LogMailer struct {
	logger          *slog.Logger
	verificationURL string
}

// NewLogMailer constructs a logger-based verification mailer.
func NewLogMailer(verificationURL string, logger *slog.Logger) *LogMailer {
	if verificationURL == "" {
		verificationURL = "https://localhost:8080/verify-email"
	}
	return &LogMailer{logger: logger, verificationURL: verificationURL}
}

func (m *LogMailer) SendVerification(ctx context.Context, to, token string) error {
	if _, err := normalizeEmail(to); err != nil {
		return err
	}
	link := m.verificationURL + "?token=" + token
	m.logger.Info("verification email sent (development)", "recipient", to, "verification_url", link)
	return nil
}

type SMTPConfig struct{ Address, Username, Password, From, VerificationURL string }
type SMTPMailer struct {
	config SMTPConfig
	host   string
}

func NewSMTPMailer(c SMTPConfig) (*SMTPMailer, error) {
	host, _, err := net.SplitHostPort(c.Address)
	if err != nil || host == "" {
		return nil, fmt.Errorf("SMTP_ADDR must contain host:port")
	}
	a, err := mail.ParseAddress(c.From)
	if err != nil || a.Address != c.From || strings.ContainsAny(c.From, "\r\n") {
		return nil, fmt.Errorf("SMTP_FROM must be an email address")
	}
	u, err := url.Parse(c.VerificationURL)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" {
		return nil, fmt.Errorf("AUTH_VERIFICATION_URL must be an HTTPS frontend verification page")
	}
	if (c.Username == "") != (c.Password == "") {
		return nil, fmt.Errorf("SMTP username and password must be set together")
	}
	return &SMTPMailer{c, host}, nil
}
func (m *SMTPMailer) SendVerification(ctx context.Context, to, token string) error {
	if _, err := normalizeEmail(to); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", m.config.Address)
	if err != nil {
		return err
	}
	defer conn.Close()
	deadline, _ := ctx.Deadline()
	if err = conn.SetDeadline(deadline); err != nil {
		return err
	}
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	defer stop()
	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		return err
	}
	defer client.Close()
	// Fail closed: no credentials, recipient or token are sent before TLS.
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return fmt.Errorf("SMTP server requires STARTTLS support")
	}
	if err = client.StartTLS(&tls.Config{ServerName: m.host, MinVersion: tls.VersionTLS12}); err != nil {
		return err
	}
	if m.config.Username != "" {
		if err = client.Auth(smtp.PlainAuth("", m.config.Username, m.config.Password, m.host)); err != nil {
			return err
		}
	}
	if err = client.Mail(m.config.From); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}
	out, err := client.Data()
	if err != nil {
		return err
	}
	link, _ := url.Parse(m.config.VerificationURL)
	q := link.Query()
	q.Set("token", token)
	link.RawQuery = q.Encode()
	message := "From: " + m.config.From + "\r\nTo: " + to + "\r\nSubject: Verify your EGHissab email\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nVerify your email within 30 minutes:\r\n" + link.String() + "\r\n\r\nIf you did not request this, ignore this message.\r\n"
	if _, err = out.Write([]byte(message)); err != nil {
		return err
	}
	if err = out.Close(); err != nil {
		return err
	}
	// DATA acceptance confirms delivery to the relay; QUIT failure must not report a lost message.
	_ = client.Quit()
	return nil
}
